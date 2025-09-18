"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ClinicFeature, ClinicFeatureCollection } from '@/types/clinics';

type ClinicsResponse = ClinicFeatureCollection | { error?: unknown } | Record<string, unknown>;

type ClinicFilters = {
  clinicIds: string[];
};

function extractFeatures(payload: ClinicsResponse): ClinicFeature[] {
  if (payload && typeof payload === 'object' && 'features' in payload) {
    const { features } = payload as Partial<ClinicFeatureCollection>;
    if (Array.isArray(features)) {
      return features;
    }
  }
  return [];
}

function normalizeClinicIds(clinicIds: string[]): string[] {
  const normalized = new Set<string>();
  for (const value of clinicIds) {
    if (!value) {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    const upper = trimmed.toUpperCase();
    normalized.add(upper);
  }
  return Array.from(normalized);
}

export function useClinics({ clinicIds }: ClinicFilters) {
  const [clinics, setClinics] = useState<ClinicFeature[]>([]);
  const [availableClinics, setAvailableClinics] = useState<ClinicFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const normalizedClinicIds = useMemo(() => normalizeClinicIds(clinicIds), [clinicIds]);
  const normalizedKey = normalizedClinicIds.join('|');

  const refetch = useCallback(() => {
    setNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function fetchClinics() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/clinics', {
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
          },
        });

        const payload = (await response.json().catch(() => ({}))) as ClinicsResponse;

        if (!response.ok) {
          const message =
            payload &&
            typeof payload === 'object' &&
            'error' in payload &&
            typeof (payload as { error?: unknown }).error === 'string'
              ? String((payload as { error?: unknown }).error)
              : `Request failed with status ${response.status}`;
          throw new Error(message);
        }

        if (!isActive) {
          return;
        }

        const features = extractFeatures(payload);
        setAvailableClinics(features);
        setClinics(features);
      } catch (cause) {
        if (controller.signal.aborted || !isActive) {
          return;
        }
        const message = cause instanceof Error ? cause.message : 'Unknown error';
        setError(message);
        setAvailableClinics([]);
        setClinics([]);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    fetchClinics();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [nonce]);

  useEffect(() => {
    if (!availableClinics.length) {
      setClinics([]);
      return;
    }

    if (!normalizedClinicIds.length) {
      setClinics(availableClinics);
      return;
    }

    const selection = new Set(normalizedClinicIds);
    const filtered = availableClinics.filter((feature) => {
      const rawId = feature.properties.clinic_id;
      const id = typeof rawId === 'string' ? rawId.trim().toUpperCase() : null;
      return id !== null && selection.has(id);
    });
    setClinics(filtered);
  }, [availableClinics, normalizedKey, normalizedClinicIds]);

  return {
    clinics,
    availableClinics,
    loading,
    error,
    refetch,
  };
}
