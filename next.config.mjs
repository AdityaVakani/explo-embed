const DEFAULT_ALLOWED_HOSTS = ['app.explo.co', '*.explo.co', 'explo-embed.vercel.app', 'vet.shyftops.io'];
const rawAllowedHosts = process.env.ALLOWED_EMBED_HOSTNAMES ?? '';

function normalizeHost(entry) {
  if (!entry) return null;
  const unquoted = entry.trim().replace(/^['\"]+|['\"]+$/g, '');
  if (!unquoted) return null;
  const lowered = unquoted.toLowerCase();
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

const normalizedAllowedHosts = [...DEFAULT_ALLOWED_HOSTS, ...rawAllowedHosts.split(/\s+/)]
  .map((value) => normalizeHost(value))
  .filter((value) => Boolean(value));

const allowedHosts = Array.from(new Set(normalizedAllowedHosts));

function withHttpsPrefix(host) {
  if (!host) return host;
  if (host.startsWith('http://') || host.startsWith('https://')) {
    return host;
  }
  return `https://${host}`;
}

function createContentSecurityPolicy() {
  const frameAncestors = ["'self'", ...allowedHosts.map(withHttpsPrefix)];

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com",
    "connect-src 'self'",
    `frame-ancestors ${frameAncestors.join(' ')}`,
  ].join('; ');
}

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: createContentSecurityPolicy(),
  },
  {
    key: 'Referrer-Policy',
    value: 'no-referrer',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Permissions-Policy',
    value: 'geolocation=()',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
