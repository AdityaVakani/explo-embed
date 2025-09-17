import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { isAllowedOrigin, rateLimit } from '@/lib/security';
import { runSnowflakeQuery } from '@/lib/snowflake';
import { getClientIp, normalizeClinicId, normalizeState } from '@/lib/utils';
import { ClinicFeature } from '@/types/clinics';

const COORDINATE_FILTER = `(
  (c.LATITUDE BETWEEN 24.396308 AND 49.0 AND c.LONGITUDE BETWEEN -125.0 AND -66.93457)
  OR (c.LATITUDE BETWEEN 51.214183 AND 71.5388 AND c.LONGITUDE BETWEEN -179.148909 AND -129.9795)
  OR (c.LATITUDE BETWEEN 18.910361 AND 22.2356 AND c.LONGITUDE BETWEEN -160.2471 AND -154.8068)
)`;
const CLINIC_SQL = `
WITH base AS (
    SELECT CLINIC_ID, SNAPSHOT_ID, SNAPSHOT_INGESTED_AT
    FROM (
      WITH ranked AS (
        SELECT
          CLINIC_ID,
          SNAPSHOT_ID,
          INGESTED_AT,
          ROW_NUMBER() OVER (
            PARTITION BY CLINIC_ID
            ORDER BY INGESTED_AT DESC
          ) AS rn
        FROM VETSTORIA_POC.PUBLIC.RAW_BOOKING_EXTRACTS
      )
      SELECT CLINIC_ID, SNAPSHOT_ID,  INGESTED_AT AS SNAPSHOT_INGESTED_AT
      FROM ranked WHERE rn = 1
    )
    )

    ,ovw AS (
  SELECT
    ao.SNAPSHOT_ID,
    ao.CLINIC_ID,
    ao.WINDOW_DAYS,
    ao.WINDOW_START_AT,
    ao.WINDOW_END_AT,
    ao.SLOTS_AVAILABLE,
    ao.TOTAL_SLOTS_OFFERED,
    ao.SLOTS_BOOKED,
    ao.FILL_RATE_PCT,
    ao.NEXT_AVAILABLE_SLOT_DATETIME,
    ao.LEAD_TIME_HOURS_TO_NEXT_AVAILABLE,
    ao.AVG_LEAD_TIME_HOURS,
    ao.AVAILABLE_PCT_PEAK,
    ao.AVAILABLE_PCT_OFFPEAK,
    ao.PEAK_DEFINITION_TEXT,
    ao.TOTAL_APPOINTMENT_TYPES,
    ao.PET_TYPES_AVAILABLE,
    ao.TOTAL_PETS_SUPPORTED
  FROM VETSTORIA_POC.PUBLIC.AVAILABILITY_OVERVIEW  ao
)
SELECT
  c.CLINIC_ID,
  c.CLINIC_NAME,
  c.CITY,
  c.STATE,
  C.LATITUDE,
  C.LONGITUDE,
  ov.WINDOW_DAYS,
  ov.SLOTS_AVAILABLE,
  COALESCE(ov.TOTAL_SLOTS_OFFERED, NULL) AS TOTAL_SLOTS_OFFERED,
  COALESCE(ov.SLOTS_BOOKED, ov.TOTAL_SLOTS_OFFERED - ov.SLOTS_AVAILABLE) AS SLOTS_BOOKED,
  COALESCE(
    ov.FILL_RATE_PCT,
    CASE WHEN ov.TOTAL_SLOTS_OFFERED IS NOT NULL AND ov.TOTAL_SLOTS_OFFERED > 0
         THEN ROUND( (COALESCE(ov.TOTAL_SLOTS_OFFERED,0) - COALESCE(ov.SLOTS_AVAILABLE,0))::FLOAT
                     / ov.TOTAL_SLOTS_OFFERED * 100, 1)
    END
  ) AS FILL_RATE_PCT,
  ov.LEAD_TIME_HOURS_TO_NEXT_AVAILABLE,
  ov.AVG_LEAD_TIME_HOURS,
  ov.AVAILABLE_PCT_PEAK,
  ov.AVAILABLE_PCT_OFFPEAK,
  ov.PEAK_DEFINITION_TEXT,
  ov.TOTAL_APPOINTMENT_TYPES,
  ov.PET_TYPES_AVAILABLE,
  ov.TOTAL_PETS_SUPPORTED,
  a.SNAPSHOT_INGESTED_AT
FROM base a
JOIN VETSTORIA_POC.PUBLIC.CLINICS_MASTER c
  ON c.CLINIC_ID = a.CLINIC_ID
LEFT JOIN ovw ov
  ON ov.CLINIC_ID = a.CLINIC_ID
 AND ov.SNAPSHOT_ID = a.SNAPSHOT_ID
  AND WINDOW_DAYS = 7
WHERE ${COORDINATE_FILTER}
`;

const ORDER_BY = 'ORDER BY COALESCE(ov.FILL_RATE_PCT, 0) DESC, c.CLINIC_NAME';


const CACHE_CONTROL = 's-maxage=120, stale-while-revalidate=300';

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return String(value);
}

function transformRow(row: Record<string, unknown>): ClinicFeature | null {
  const latitude = toNumber(row.LATITUDE ?? row.latitude);
  const longitude = toNumber(row.LONGITUDE ?? row.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  const clinic = {
    clinic_id: toStringOrNull(row.CLINIC_ID ?? row.clinic_id),
    clinic_name: toStringOrNull(row.CLINIC_NAME ?? row.clinic_name),
    score: toNumber(row.SCORE ?? row.score),
    rank: toNumber(row.RANK ?? row.rank),
    competitors: toNumber(row.COMPETITORS ?? row.competitors),
    synergy: toNumber(row.SYNERGY ?? row.synergy),
    detractors: toNumber(row.DETRACTORS ?? row.detractors),
    population: toNumber(row.POPULATION ?? row.population),
    median_income: toNumber(row.MEDIAN_INCOME ?? row.median_income),
    window_days: toNumber(row.WINDOW_DAYS ?? row.window_days),
    slots_available: toNumber(row.SLOTS_AVAILABLE ?? row.slots_available),
    total_slots_offered: toNumber(row.TOTAL_SLOTS_OFFERED ?? row.total_slots_offered),
    slots_booked: toNumber(row.SLOTS_BOOKED ?? row.slots_booked),
    fill_rate_pct: toNumber(row.FILL_RATE_PCT ?? row.fill_rate_pct),
    lead_time_hours_to_next_available: toNumber(
      row.LEAD_TIME_HOURS_TO_NEXT_AVAILABLE ?? row.lead_time_hours_to_next_available,
    ),
    avg_lead_time_hours: toNumber(row.AVG_LEAD_TIME_HOURS ?? row.avg_lead_time_hours),
    available_pct_peak: toNumber(row.AVAILABLE_PCT_PEAK ?? row.available_pct_peak),
    available_pct_offpeak: toNumber(row.AVAILABLE_PCT_OFFPEAK ?? row.available_pct_offpeak),
    peak_definition_text: toStringOrNull(
      row.PEAK_DEFINITION_TEXT ?? row.peak_definition_text,
    ),
    total_appointment_types: toNumber(
      row.TOTAL_APPOINTMENT_TYPES ?? row.total_appointment_types,
    ),
    pet_types_available: toStringOrNull(row.PET_TYPES_AVAILABLE ?? row.pet_types_available),
    total_pets_supported: toNumber(row.TOTAL_PETS_SUPPORTED ?? row.total_pets_supported),
    snapshot_ingested_at: toStringOrNull(
      row.SNAPSHOT_INGESTED_AT ?? row.snapshot_ingested_at,
    ),
    city: toStringOrNull(row.CITY ?? row.city),
    state: toStringOrNull(row.STATE ?? row.state),
  } as const;

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [longitude, latitude],
    },
    properties: clinic,
  };
}

function buildResponse(features: ClinicFeature[]) {
  const body = {
    type: 'FeatureCollection' as const,
    features,
  };

  const etag = createHash('sha256').update(JSON.stringify(body)).digest('hex');

  return NextResponse.json(body, {
    headers: {
      'Cache-Control': CACHE_CONTROL,
      ETag: `"${etag}"`,
    },
  });
}

async function fetchClinics(state: string | null, clinicId: string | null): Promise<Record<string, unknown>[]> {
  const conditions: string[] = [];
  const binds: unknown[] = [];

  if (state) {
    conditions.push('TRIM(UPPER(c.STATE)) = ?');
    binds.push(state);
  }

  if (clinicId) {
    conditions.push('c.CLINIC_ID = ?');
    binds.push(clinicId);
  }

  const filterClause = conditions.length ? `\n AND ${conditions.join(' AND ')}` : '';
  const sql = `${CLINIC_SQL}${filterClause}\n${ORDER_BY}`;

  return runSnowflakeQuery<Record<string, unknown>>(sql, binds);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ip = getClientIp(request.headers);
  if (!rateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too Many Requests' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
        },
      },
    );
  }

  const stateFilter = normalizeState(request.nextUrl.searchParams.get('state'));
  const clinicId = normalizeClinicId(request.nextUrl.searchParams.get('clinicId'));

  try {
    const rows = await fetchClinics(stateFilter, clinicId);
    const features = rows
      .map((row) => transformRow(row))
      .filter((feature): feature is ClinicFeature => Boolean(feature));

    return buildResponse(features);
  } catch (error) {
    console.error('Failed to load clinics', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

