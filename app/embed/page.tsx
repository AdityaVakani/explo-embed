"use client";

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

import { ClinicFilter } from '@/components/ClinicFilter';
import { Sidebar } from '@/components/Sidebar';
import { useClinics } from '@/hooks/useClinics';
import { escapeHtml } from '@/lib/utils';
import type { ClinicFeature } from '@/types/clinics';

const Map = dynamic(() => import('@/components/Map').then((mod) => mod.Map), { ssr: false });

const RADIUS_METERS = Number(process.env.NEXT_PUBLIC_SELECTED_RADIUS_METERS ?? 500);

type MapFocus =
  | { type: 'clinic'; clinic: ClinicFeature }
  | { type: 'bounds'; bounds: [[number, number], [number, number]] }
  | null;

export default function EmbedPage() {
  const [clinicFilters, setClinicFilters] = useState<string[]>([]);
  const [clinicOptions, setClinicOptions] = useState<Array<{ value: string; label: string }>>([]);

  const { clinics, availableClinics, loading, error } = useClinics({
    clinicIds: clinicFilters,
  });
  const [selectedClinic, setSelectedClinic] = useState<ClinicFeature | null>(null);

  useEffect(() => {
    if (!selectedClinic) {
      return;
    }
    const exists = clinics.some(
      (clinic) => identifyClinic(clinic) === identifyClinic(selectedClinic),
    );
    if (!exists) {
      setSelectedClinic(null);
    }
  }, [clinics, selectedClinic]);

  useEffect(() => {
    const seen = new globalThis.Map<string, string>();
    for (const clinic of availableClinics) {
      const rawId = clinic.properties.clinic_id;
      const id = typeof rawId === 'string' ? rawId.trim().toUpperCase() : null;
      const name = clinic.properties.clinic_name?.trim();
      if (!id) {
        continue;
      }
      if (!seen.has(id)) {
        seen.set(id, name ?? id);
      }
    }

    const baseOptions = Array.from(seen.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const existingValues = new Set(baseOptions.map((option) => option.value));
    const missingSelections = clinicFilters.filter((value) => !existingValues.has(value));
    const extras = missingSelections.map((value) => {
      const fallbackName =
        availableClinics.find((clinic) => {
          const rawId = clinic.properties.clinic_id;
          const id = typeof rawId === 'string' ? rawId.trim().toUpperCase() : null;
          return id === value;
        })?.properties.clinic_name?.trim() ?? value;
      return { value, label: fallbackName };
    });

    setClinicOptions([...extras, ...baseOptions]);
  }, [availableClinics, clinicFilters]);

  useEffect(() => {
    if (!clinicFilters.length) {
      return;
    }
    if (clinicFilters.length !== 1) {
      setSelectedClinic(null);
      return;
    }
    if (!clinics.length) {
      setSelectedClinic(null);
      return;
    }
    setSelectedClinic((current) => {
      if (
        current &&
        clinics.some((clinic) => identifyClinic(clinic) === identifyClinic(current))
      ) {
        return current;
      }
      return clinics[0];
    });
  }, [clinicFilters, clinics]);

  const focusTarget = useMemo<MapFocus>(() => {
    if (selectedClinic) {
      return { type: 'clinic', clinic: selectedClinic };
    }
    if (clinicFilters.length && clinics.length) {
      const bounds = computeBounds(clinics);
      if (bounds) {
        return { type: 'bounds', bounds };
      }
    }
    return null;
  }, [selectedClinic, clinicFilters.length, clinics]);

  const totalLocations = useMemo(() => clinics.length, [clinics.length]);

  const handleClinicFilterChange = (values: string[]) => {
    const normalized = Array.from(
      new Set(
        values
          .map((value) => value.trim().toUpperCase())
          .filter((value) => value.length > 0),
      ),
    );

    setClinicFilters((current) => {
      if (
        current.length === normalized.length &&
        current.every((value, index) => value === normalized[index])
      ) {
        return current;
      }
      return normalized;
    });

    if (normalized.length !== 1) {
      setSelectedClinic(null);
    }
  };

  return (
    <div className="flex h-full min-h-screen flex-col bg-gradient-to-br from-slate-100 via-slate-50 to-white">
      <header className="relative z-[2000] flex items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur px-8 py-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Map of analyzed clinics</h1>
          <p className="text-sm text-slate-600">
            Tracking <span className="font-semibold text-slate-700">{totalLocations}</span> locations across the selected network.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ClinicFilter
            values={clinicFilters}
            options={clinicOptions}
            onChange={handleClinicFilterChange}
            disabled={loading && !availableClinics.length}
          />
        </div>
      </header>
      <main className="flex flex-1 overflow-hidden">
        <Sidebar clinic={selectedClinic} loading={loading} error={error} />
        <section className="flex flex-1 flex-col gap-6 p-8">
          {error ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-sm text-red-300">
              {escapeHtml(error)}
            </div>
          ) : (
            <Map
              clinics={clinics}
              selectedClinic={selectedClinic}
              onSelectClinic={setSelectedClinic}
              focus={focusTarget}
              radiusMeters={Number.isFinite(RADIUS_METERS) ? RADIUS_METERS : undefined}
            />
          )}
        </section>
      </main>
    </div>
  );
}

function identifyClinic(clinic: ClinicFeature) {
  return clinic.properties.clinic_id ?? clinic.geometry.coordinates.join(',');
}

function computeBounds(clinics: ClinicFeature[]): [[number, number], [number, number]] | null {
  if (!clinics.length) {
    return null;
  }
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLng = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  for (const clinic of clinics) {
    const [longitude, latitude] = clinic.geometry.coordinates;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      continue;
    }
    if (latitude < minLat) minLat = latitude;
    if (latitude > maxLat) maxLat = latitude;
    if (longitude < minLng) minLng = longitude;
    if (longitude > maxLng) maxLng = longitude;
  }
  if (
    !Number.isFinite(minLat) ||
    !Number.isFinite(minLng) ||
    !Number.isFinite(maxLat) ||
    !Number.isFinite(maxLng)
  ) {
    return null;
  }
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}



