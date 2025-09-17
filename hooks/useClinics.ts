"use client";

import { useCallback, useEffect, useState } from 'react';

import type { ClinicFeature, ClinicFeatureCollection } from '@/types/clinics';

type ClinicsResponse = ClinicFeatureCollection | { error?: unknown } | Record<string, unknown>;

type ClinicFilters = {
  state: string | null;
  clinicId: string | null;
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

export function useClinics({ state, clinicId }: ClinicFilters) {
  const [clinics, setClinics] = useState<ClinicFeature[]>([]);
  const [availableClinics, setAvailableClinics] = useState<ClinicFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

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
        const params = new URLSearchParams();
        if (state) {
          params.set('state', state);
        }
        if (clinicId) {
          params.set('clinicId', clinicId);
        }

        const url = params.size ? `/api/clinics?${params.toString()}` : '/api/clinics';

        const response = await fetch(url, {
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
          },
        });

        const payload = (await response.json().catch(() => ({}))) as ClinicsResponse;

        if (!response.ok) {
          const message =
            payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
              ? payload.error
              : `Request failed with status ${response.status}`;
          throw new Error(message);
        }

        if (!isActive) {
          return;
        }

        const features = extractFeatures(payload);
        setAvailableClinics(features);
        const normalizedClinicId = clinicId?.trim() ?? null;
        const filteredFeatures =
          normalizedClinicId === null
            ? features
            : features.filter((feature) => {
                const id = feature.properties.clinic_id;
                return typeof id === 'string' && id.trim() === normalizedClinicId;
              });
        setClinics(filteredFeatures);
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
  }, [state, clinicId, nonce]);

  return {
    clinics,
    availableClinics,
    loading,
    error,
    refetch,
  };
}


