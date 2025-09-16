"use client";

import { useCallback, useEffect, useState } from 'react';

import type { ClinicFeature, ClinicFeatureCollection } from '@/types/clinics';

type ClinicsResponse = ClinicFeatureCollection | { error?: unknown } | Record<string, unknown>;

function extractFeatures(payload: ClinicsResponse): ClinicFeature[] {
  if (payload && typeof payload === 'object' && 'features' in payload) {
    const { features } = payload as Partial<ClinicFeatureCollection>;
    if (Array.isArray(features)) {
      return features;
    }
  }
  return [];
}

export function useClinics(state: string | null) {
  const [clinics, setClinics] = useState<ClinicFeature[]>([]);
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

        setClinics(extractFeatures(payload));
      } catch (cause) {
        if (controller.signal.aborted || !isActive) {
          return;
        }
        const message = cause instanceof Error ? cause.message : 'Unknown error';
        setError(message);
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
  }, [state, nonce]);

  return {
    clinics,
    loading,
    error,
    refetch,
  };
}
