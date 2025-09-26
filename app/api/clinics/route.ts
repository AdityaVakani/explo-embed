import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { isAllowedOrigin, rateLimit } from '@/lib/security';
import { runSnowflakeQuery } from '@/lib/snowflake';
import { getClientIp, normalizeClinicId, normalizeState, STATE_NAME_TO_CODE } from '@/lib/utils';
import { ClinicFeature } from '@/types/clinics';

const COORDINATE_FILTER = `(
  (cm.LATITUDE BETWEEN 24.396308 AND 49.0 AND cm.LONGITUDE BETWEEN -125.0 AND -66.93457)
  OR (cm.LATITUDE BETWEEN 51.214183 AND 71.5388 AND cm.LONGITUDE BETWEEN -179.148909 AND -129.9795)
  OR (cm.LATITUDE BETWEEN 18.910361 AND 22.2356 AND cm.LONGITUDE BETWEEN -160.2471 AND -154.8068)
)`;
const CLINIC_SQL = `
SELECT
  cm.CLINIC_ID,
  cm.CLINIC_NAME,
  cm.CITY,
  cm.STATE,
  cm.WEBSITE_URL,
  cm.PHONE_NUMBER,
  cm.BMS_SYSTEM,
  cm.ADDRESS,
  cm.LATITUDE,
  cm.LONGITUDE,
  cm.APPOINTMENT_LEAD_TIME_HOURS,
  cm.DOCTOR_COUNT,
  sw.SLOTS_AVAILABLE,
  IFNULL(sw.ESTIMATED_WEEKLY_SLOT_CAPACITY, cm.ESTIMATED_DAILY_SLOT_CAPACITY * 7) AS TOTAL_SLOTS_OFFERED,
  sw.SLOTS_BOOKED,
  (sw.FILL_RATE_PCT * 100)::INT AS FILL_RATE_PCT
FROM VET_CLINIC_HOSPITAL.PUBLIC.CLINICS_MASTER cm
LEFT JOIN VET_CLINIC_HOSPITAL.PUBLIC.SUMMARY_WEEK sw
  ON cm.CLINIC_ID = sw.CLINIC_ID
WHERE ${COORDINATE_FILTER}
`

const ORDER_BY = 'ORDER BY FILL_RATE_PCT DESC NULLS LAST, cm.CLINIC_NAME';

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
      row.LEAD_TIME_HOURS_TO_NEXT_AVAILABLE ?? row.lead_time_hours_to_next_available
    ),
    avg_lead_time_hours: toNumber(row.AVG_LEAD_TIME_HOURS ?? row.avg_lead_time_hours),
    available_pct_peak: toNumber(row.AVAILABLE_PCT_PEAK ?? row.available_pct_peak),
    available_pct_offpeak: toNumber(row.AVAILABLE_PCT_OFFPEAK ?? row.available_pct_offpeak),
    peak_definition_text: toStringOrNull(
      row.PEAK_DEFINITION_TEXT ?? row.peak_definition_text
    ),
    total_appointment_types: toNumber(
      row.TOTAL_APPOINTMENT_TYPES ?? row.total_appointment_types
    ),
    pet_types_available: toStringOrNull(row.PET_TYPES_AVAILABLE ?? row.pet_types_available),
    total_pets_supported: toNumber(row.TOTAL_PETS_SUPPORTED ?? row.total_pets_supported),
    snapshot_ingested_at: toStringOrNull(
      row.SNAPSHOT_INGESTED_AT ?? row.snapshot_ingested_at
    ),
    city: toStringOrNull(row.CITY ?? row.city),
    state: toStringOrNull(row.STATE ?? row.state),
    full_address: toStringOrNull(
      row.ADDRESS ?? row.address ?? row.FULL_ADDRESS ?? row.full_address
    ),
    website_url: toStringOrNull(row.WEBSITE_URL ?? row.website_url),
    phone_number: toStringOrNull(row.PHONE_NUMBER ?? row.phone_number),
    bms_system: toStringOrNull(row.BMS_SYSTEM ?? row.bms_system),
    appointment_lead_time_hours: toNumber(
      row.APPOINTMENT_LEAD_TIME_HOURS ?? row.appointment_lead_time_hours
    ),
    doctor_count: toNumber(row.DOCTOR_COUNT ?? row.doctor_count),
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
    const candidates = [state];
    const mappedState = STATE_NAME_TO_CODE[state];
    if (mappedState && !candidates.includes(mappedState)) {
      candidates.push(mappedState);
    }

    const placeholders = candidates.map(() => '?').join(', ');
    conditions.push(`TRIM(UPPER(cm.STATE)) IN (${placeholders})`);
    binds.push(...candidates);
  }

  if (clinicId) {
    conditions.push('UPPER(cm.CLINIC_ID) = ?');
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

  console.log('[api/clinics] input', { stateFilter, clinicId });

  try {
    const rows = await fetchClinics(stateFilter, clinicId);
    console.log('[api/clinics] rows', { count: rows.length });
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
