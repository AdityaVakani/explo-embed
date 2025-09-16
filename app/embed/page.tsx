"use client";

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

import { escapeHtml } from '@/lib/utils';
import { Sidebar } from '@/components/Sidebar';
import { StateFilter } from '@/components/StateFilter';
import { useClinics } from '@/hooks/useClinics';
import { useClinicStates } from '@/hooks/useClinicStates';
import type { ClinicFeature } from '@/types/clinics';

const Map = dynamic(() => import('@/components/Map').then((mod) => mod.Map), { ssr: false });

const RADIUS_METERS = Number(process.env.NEXT_PUBLIC_SELECTED_RADIUS_METERS ?? 500);

export default function EmbedPage() {
  const [stateFilter, setStateFilter] = useState('');
  const { states, loading: statesLoading } = useClinicStates();
  const { clinics, loading, error } = useClinics(stateFilter || null);
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

  const totalLocations = useMemo(() => clinics.length, [clinics.length]);

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
        <StateFilter
          value={stateFilter}
          options={states}
          onChange={setStateFilter}
          disabled={statesLoading}
        />
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
