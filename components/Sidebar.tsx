"use client";

import { escapeHtml } from '@/lib/utils';
import type { ClinicFeature } from '@/types/clinics';

type SidebarProps = {
  clinic: ClinicFeature | null;
  loading: boolean;
  error: string | null;
};

type MetricKey = 'slots_available' | 'slots_booked' | 'total_slots_offered' | 'fill_rate_pct';

const METRICS: Array<{ key: MetricKey; label: string; format?: (value: number | null) => string }> = [
  { key: 'slots_available', label: 'Available Slots' },
  { key: 'slots_booked', label: 'Booked Slots' },
  { key: 'total_slots_offered', label: 'Total Slots' },
  { key: 'fill_rate_pct', label: 'Fill Rate', format: formatRate },
];

export function Sidebar({ clinic, loading, error }: SidebarProps) {
  if (loading) {
    return (
      <aside className="flex h-full w-[300px] flex-col gap-4 border-r border-slate-800/60 bg-slate-950/70 px-5 py-6">
        <div className="h-6 w-1/2 animate-pulse rounded bg-slate-800/60" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-4 w-full animate-pulse rounded bg-slate-800/60" />
          ))}
        </div>
      </aside>
    );
  }

  if (error) {
    return (
      <aside className="flex h-full w-[300px] flex-col gap-3 border-r border-slate-800/60 bg-slate-950/70 px-5 py-6 text-sm text-red-400">
        <h2 className="text-base font-semibold text-slate-100">Unable to load data</h2>
        <p>{escapeHtml(error)}</p>
      </aside>
    );
  }

  if (!clinic) {
    return (
      <aside className="flex h-full w-[300px] flex-col justify-center gap-4 border-r border-slate-800/60 bg-slate-950/70 px-6 py-10 text-sm text-slate-400">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Location details</h2>
          <p>Click a pin to explore the surrounding metrics.</p>
        </div>
        <div className="rounded-lg border border-slate-800/60 bg-slate-900/70 px-4 py-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Tip</p>
          <p className="text-sm text-slate-300">
            Use the map markers to compare performance, then select a clinic to reveal demographic and capacity details here.
          </p>
        </div>
      </aside>
    );
  }

  const { properties } = clinic;
  const safeName = properties.clinic_name ? escapeHtml(properties.clinic_name) : 'Unknown clinic';
  const safeCity = properties.city ? escapeHtml(properties.city) : null;
  const safeState = properties.state ? escapeHtml(properties.state) : null;
  const safeClinicId = properties.clinic_id ? escapeHtml(properties.clinic_id) : null;
  const safePetTypes = properties.pet_types_available
    ? escapeHtml(String(properties.pet_types_available))
    : null;

  const scoreValue = Number(properties.score ?? 0);
  const normalizedScore = Number.isFinite(scoreValue) ? Math.max(0, Math.min(100, scoreValue)) : 0;

  return (
    <aside className="flex h-full w-[300px] flex-col gap-6 border-r border-slate-800/60 bg-slate-950/75 px-6 py-8 text-sm text-slate-200">
      <header className="space-y-2">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Selected clinic</div>
        <h2 className="text-xl font-semibold text-slate-50">{safeName}</h2>
        <div className="text-xs text-slate-400">{[safeCity, safeState].filter(Boolean).join(', ')}</div>
        {safeClinicId ? (
          <div className="text-xs text-slate-500">ID: <span className="text-slate-200">{safeClinicId}</span></div>
        ) : null}
        {safePetTypes ? (
          <div className="text-xs text-slate-500">Pet types: <span className="text-slate-200">{safePetTypes}</span></div>
        ) : null}
      </header>

      <section className="rounded-xl border border-slate-800/70 bg-slate-900/60 px-5 py-4 shadow-[0_18px_34px_-20px_rgba(15,23,42,0.85)]">
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
          <span>Opportunity score</span>
          <span className="font-semibold text-slate-200">{formatNumber(properties.score)}</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-slate-800/80">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-cyan-400"
            style={{ width: `${normalizedScore}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border border-slate-800/60 bg-slate-900/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Rank</p>
            <p className="text-base font-semibold text-slate-100">{formatNumber(properties.rank)}</p>
          </div>
          <div className="rounded-lg border border-slate-800/60 bg-slate-900/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Available slots</p>
            <p className="text-base font-semibold text-slate-100">{formatNumber(properties.slots_available)}</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs uppercase tracking-[0.3em] text-slate-500">Utilization</h3>
        <div className="space-y-2 text-xs">
          {METRICS.map(({ key, label, format }) => (
            <div key={key} className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/50 px-3 py-2">
              <span className="text-slate-400">{label}</span>
              <span className="font-semibold text-slate-100">
                {format ? format(properties[key]) : formatNumber(properties[key])}
              </span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

function formatNumber(value: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }

  if (Math.abs(value) >= 1000 && Number.isInteger(value)) {
    return new Intl.NumberFormat('en-US').format(value);
  }

  if (Number.isInteger(value)) {
    return value.toString();
  }

  return value.toFixed(1);
}

function formatRate(value: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }

  return `${value.toFixed(1)}%`;
}
