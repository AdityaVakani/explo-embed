"use client";

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

import { ClinicFilter } from '@/components/ClinicFilter';
import { Sidebar } from '@/components/Sidebar';
import { StateFilter } from '@/components/StateFilter';
import { useClinics } from '@/hooks/useClinics';
import { useClinicStates } from '@/hooks/useClinicStates';
import { escapeHtml } from '@/lib/utils';
import type { ClinicFeature } from '@/types/clinics';

const Map = dynamic(() => import('@/components/Map').then((mod) => mod.Map), { ssr: false });

const RADIUS_METERS = Number(process.env.NEXT_PUBLIC_SELECTED_RADIUS_METERS ?? 500);

type MapFocus =
  | { type: 'clinic'; clinic: ClinicFeature }
  | { type: 'bounds'; bounds: [[number, number], [number, number]] }
  | null;

export default function EmbedPage() {
  const [stateFilter, setStateFilter] = useState('');
  const [clinicFilter, setClinicFilter] = useState('');
  const [clinicOptions, setClinicOptions] = useState<string[]>([]);

  const { states, loading: statesLoading } = useClinicStates();
  const { clinics, loading, error } = useClinics({
    state: stateFilter || null,
    clinic: clinicFilter || null,
  });
  const [selectedClinic, setSelectedClinic] = useState<ClinicFeature | null>(null);

  useEffect(() => {
    if (!selectedClinic) {
      return;
    }
    const exists = clinics.find(
      (clinic) => identifyClinic(clinic) === identifyClinic(selectedClinic),
    );
    if (!exists) {
      setSelectedClinic(null);
    }
  }, [clinics, selectedClinic]);

  useEffect(() => {
    const names = clinics
      .map((clinic) => clinic.properties.clinic_name?.trim())
      .filter((name): name is string => Boolean(name && name.length));
    const uniqueNames = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));

    if (clinicFilter && clinicFilter.length && !uniqueNames.includes(clinicFilter)) {
      uniqueNames.unshift(clinicFilter);
    }

    setClinicOptions(uniqueNames);
  }, [clinics, clinicFilter]);

  useEffect(() => {
    if (!clinicFilter) {
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
  }, [clinicFilter, clinics]);

  useEffect(() => {
    if (!clinicFilter) {
      return;
    }
    setClinicFilter('');
  }, [stateFilter, clinicFilter]);

  const focusTarget = useMemo<MapFocus>(() => {
    if (clinicFilter && clinics.length) {
      return { type: 'clinic', clinic: clinics[0] };
    }
    if (stateFilter && clinics.length) {
      const bounds = computeBounds(clinics);
      if (bounds) {
        return { type: 'bounds', bounds };
      }
    }
    return null;
  }, [clinicFilter, clinics, stateFilter]);

  const totalLocations = useMemo(() => clinics.length, [clinics.length]);

  const handleClinicFilterChange = (value: string) => {
    setClinicFilter(value);
    if (!value) {
      setSelectedClinic(null);
    }
  };

  return (
    <div className="flex h-full min-h-screen flex-col bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900">
      <header className="flex items-center justify-between border-b border-slate-800/70 bg-slate-950/80 px-8 py-6">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Explo embed</p>
          <h1 className="text-2xl font-semibold text-slate-100">Map of analyzed clinics</h1>
          <p className="text-sm text-slate-400">
            Tracking <span className="font-semibold text-slate-200">{totalLocations}</span> locations across the selected network.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <StateFilter
            value={stateFilter}
            options={states}
            onChange={setStateFilter}
            disabled={statesLoading}
          />
          <ClinicFilter
            value={clinicFilter}
            options={clinicOptions}
            onChange={handleClinicFilterChange}
            disabled={loading && !clinicFilter}
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

