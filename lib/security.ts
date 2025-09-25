import { NextRequest } from 'next/server';
import { z } from 'zod';

const stateSchema = z
  .string({ message: 'State is required' })
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z]{2}$/.test(value), {
    message: 'State must be a two-letter code',
  });

type TokenBucket = {
  tokens: number;
  lastRefill: number;
};

const DEFAULT_ALLOWED_HOSTS = ['app.explo.co', '*.explo.co', 'explo-embed.vercel.app', 'vet.shyftops.io'];

const buckets = new Map<string, TokenBucket>();
const MAX_TOKENS = 60;
const REFILL_INTERVAL_MS = 60_000;

function refill(bucket: TokenBucket, now: number) {
  const elapsed = now - bucket.lastRefill;
  if (elapsed <= 0) {
    return;
  }
  const tokensToAdd = (elapsed / REFILL_INTERVAL_MS) * MAX_TOKENS;
  bucket.tokens = Math.min(MAX_TOKENS, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;
}

function parseHost(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.host.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeAllowedEntry(entry: string): string | null {
  const unquoted = entry.trim().replace(/^['"]+|['"]+$/g, '');
  const lowered = unquoted.toLowerCase();
  if (!lowered) {
    return null;
  }
  if (lowered.includes('*')) {
    return lowered;
  }
  if (lowered.includes('://')) {
    try {
      return new URL(lowered).host.toLowerCase();
    } catch {
      return lowered;
    }
  }
  return lowered;
}

function getAllowList(): string[] {
  const raw = process.env.ALLOWED_EMBED_HOSTNAMES ?? '';
  const entries = [...DEFAULT_ALLOWED_HOSTS, ...raw.split(/\s+/)];
  const normalized = entries
    .map((entry) => normalizeAllowedEntry(entry))
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(normalized));
}

export function sanitizeState(value: string | null | undefined): string {
  if (typeof value !== 'string') {
    throw new Error('Missing state parameter');
  }
  return stateSchema.parse(value);
}

export function isAllowedOrigin(request: NextRequest): boolean {
  const allowList = getAllowList();
  if (!allowList.length) {
    return true;
  }

  const originHost = parseHost(request.headers.get('origin'));
  const refererHost = parseHost(request.headers.get('referer'));
  const appHost = request.nextUrl.host?.toLowerCase();

  const candidates = [originHost, refererHost, appHost].filter(
    (value): value is string => Boolean(value),
  );

  if (!candidates.length) {
    return false;
  }

  return candidates.some((host) => allowList.some((allowed) => matchHost(host, allowed)));
}

function matchHost(host: string, pattern: string): boolean {
  if (!pattern.includes('*')) {
    return host === pattern;
  }
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  const regex = new RegExp(`^${escaped}$`, 'i');
  return regex.test(host);
}

export function rateLimit(ip: string): boolean {
  const now = Date.now();
  const key = ip || 'unknown';
  const bucket = buckets.get(key) ?? { tokens: MAX_TOKENS, lastRefill: now };
  refill(bucket, now);
  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return true;
}
