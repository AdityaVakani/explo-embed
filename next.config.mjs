const allowedHosts = (process.env.ALLOWED_EMBED_HOSTNAMES ?? '')
  .split(/\s+/)
  .map((value) => value.trim())
  .filter(Boolean);

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

