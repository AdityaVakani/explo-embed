"use client";

import type { ReactNode } from 'react';

import { escapeHtml } from '@/lib/utils';
import type { ClinicFeature } from '@/types/clinics';

type SidebarProps = {
  clinic: ClinicFeature | null;
  loading: boolean;
  error: string | null;
};

type MetricKey = 'slots_available' | 'slots_booked' | 'total_slots_offered' | 'fill_rate_pct';

type MetricDefinition = {
  key: MetricKey;
  label: string;
  format?: (value: number | null) => string;
};

type DetailItem = {
  key: string;
  label: string;
  content: ReactNode;
};

const METRICS: MetricDefinition[] = [
  { key: 'slots_available', label: 'Available Slots' },
  { key: 'slots_booked', label: 'Booked Slots' },
  { key: 'total_slots_offered', label: 'Total Slots' },
  { key: 'fill_rate_pct', label: 'Fill Rate', format: formatRate },
];

export function Sidebar({ clinic, loading, error }: SidebarProps) {
  if (loading) {
    return (
      <aside className="flex h-full w-[300px] flex-col gap-4 border-r border-slate-200 bg-white px-5 py-6">
        <div className="h-6 w-1/2 animate-pulse rounded bg-slate-200/80" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-4 w-full animate-pulse rounded bg-slate-200/80" />
          ))}
        </div>
      </aside>
    );
  }

  if (error) {
    return (
      <aside className="flex h-full w-[300px] flex-col gap-3 border-r border-slate-200 bg-white px-5 py-6 text-sm text-red-400">
        <h2 className="text-base font-semibold text-slate-900">Unable to load data</h2>
        <p>{escapeHtml(error)}</p>
      </aside>
    );
  }

  if (!clinic) {
    return (
      <aside className="flex h-full w-[300px] flex-col justify-center gap-4 border-r border-slate-200 bg-white px-6 py-10 text-sm text-slate-500">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Location details</h2>
          <p>Click a pin to explore the surrounding metrics.</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-5">
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
  const safePetTypes = properties.pet_types_available ? escapeHtml(String(properties.pet_types_available)) : null;
  const safeAddress = properties.full_address ? escapeHtml(properties.full_address) : null;
  const safePhone = properties.phone_number ? escapeHtml(properties.phone_number) : null;
  const safeBms = properties.bms_system ? escapeHtml(properties.bms_system) : null;
  const websiteLink = buildLink(properties.website_url);

  const location = [safeCity, safeState].filter(Boolean).join(', ') || null;
  const detailItems: DetailItem[] = [];

  const leadTimeValue = properties.appointment_lead_time_hours;
  const leadTimeMissing =
    leadTimeValue === null || leadTimeValue === undefined || Number.isNaN(leadTimeValue);
  const leadTimeDisplay = leadTimeMissing ? 'No data' : `${formatNumber(leadTimeValue)} Hours`;

  if (location) {
    detailItems.push({ key: 'location', label: 'Location', content: location });
  }
  if (safeClinicId) {
    detailItems.push({ key: 'clinicId', label: 'Clinic ID', content: safeClinicId });
  }
  if (safePetTypes) {
    detailItems.push({ key: 'petTypes', label: 'Pet types', content: safePetTypes });
  }
  if (safeAddress) {
    detailItems.push({ key: 'address', label: 'Address', content: safeAddress });
  }
  if (websiteLink) {
    detailItems.push({
      key: 'website',
      label: 'Website',
      content: (
        <a
          className="break-words text-slate-700 underline decoration-slate-300 transition hover:text-slate-900"
          href={websiteLink.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {websiteLink.label}
        </a>
      ),
    });
  }
  if (safePhone) {
    detailItems.push({ key: 'phone', label: 'Phone', content: safePhone });
  }
  if (safeBms) {
    detailItems.push({ key: 'bms', label: 'BMS', content: safeBms });
  }

  return (
    <aside className="flex h-full w-[300px] flex-col gap-6 border-r border-slate-200 bg-white px-6 py-8 text-sm text-slate-700">
      <header className="space-y-4">
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-500">Selected clinic</div>
        <h2 className="text-xl font-semibold text-slate-900 break-words">{safeName}</h2>
        {detailItems.length ? (
          <dl className="space-y-3">
            {detailItems.map(({ key, label, content }) => (
              <div key={key} className="space-y-1">
                <dt className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-500">{label}</dt>
                <dd className="text-xs text-slate-700 break-words">{content}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </header>

      <section className="space-y-3">
        <h3 className="text-xs uppercase tracking-[0.3em] text-slate-500">Access Snapshot</h3>
        <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Average Lead Time</span>
            <span className={`font-semibold ${leadTimeMissing ? 'text-slate-400 italic' : 'text-slate-900'}`}>
              {leadTimeDisplay}
            </span>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs uppercase tracking-[0.3em] text-slate-500">Utilization</h3>
        <p className="text-[10px] text-slate-400">Metrics reflect a 7-day window.</p>
        <div className="space-y-2 text-xs">
          {METRICS.map(({ key, label, format }) => {
            const rawValue = properties[key];
            const isMissing = rawValue === null || rawValue === undefined || Number.isNaN(rawValue);
            const displayValue = format ? format(rawValue) : formatNumber(rawValue);
            return (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-100 px-3 py-2"
              >
                <span className="text-slate-500">{label}</span>
                <span className={`font-semibold ${isMissing ? 'text-slate-400 italic' : 'text-slate-900'}`}>
                  {displayValue}
                </span>
              </div>
            );
          })}
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
    return 'No data';
  }

  return `${Math.round(value)}%`;
}

type LinkDetails = {
  href: string;
  label: string;
};

function buildLink(raw: string | null): LinkDetails | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(normalized);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    const label = trimmed.replace(/^https?:\/\//i, '') || url.hostname;
    return {
      href: url.toString(),
      label,
    };
  } catch {
    return null;
  }
}
