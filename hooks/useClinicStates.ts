"use client";

import { useEffect, useState } from 'react';

export function useClinicStates() {
  const [states, setStates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function fetchStates() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/states', {
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
          },
        });

        const payload = (await response.json().catch(() => ({}))) as
          | { states?: string[]; error?: string }
          | undefined;

        if (!response.ok) {
          const message = payload?.error ?? `Request failed with status ${response.status}`;
          throw new Error(message);
        }

        if (!isActive) {
          return;
        }

        const options = Array.isArray(payload?.states) ? payload?.states : [];
        setStates(options);
      } catch (cause) {
        if (controller.signal.aborted || !isActive) {
          return;
        }
        const message = cause instanceof Error ? cause.message : 'Unknown error';
        setError(message);
        setStates([]);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    fetchStates();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  return {
    states,
    loading,
    error,
  };
}
