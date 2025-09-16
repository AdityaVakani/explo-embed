# explo-embed

Embeddable clinic analytics map built with Next.js 14 App Router, TypeScript, Tailwind CSS, and React Leaflet. The app renders an OpenStreetMap background, pulls clinic metrics from Snowflake on the server, and exposes a secure `/embed` route that can be safely embedded inside Explo dashboards.

## Features

- Server-only Snowflake access via `snowflake-sdk` with prepared statements, read-only query enforcement, and per-request connections.
- GeoJSON API (`/api/clinics`) that rate-limits by IP, caches responses, and returns all clinics with valid coordinates.
- React Leaflet map with custom ranked markers, automatic fit-to-bounds, optional selection radius, and sidebar with clinic metrics.
- Strict CSP and middleware-based origin allowlisting so the embed only renders from approved hosts.
- Tailwind-powered dark UI designed for iframe usage with graceful loading/error states.

## Getting Started

### Prerequisites

- Node.js 18.18+ (or 20.x recommended)
- pnpm 9+
- A Snowflake user with read-only access to the required views/tables

### Install dependencies

```bash
pnpm install
```

### Environment variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

Required values:

- `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USERNAME`, `SNOWFLAKE_PASSWORD`
- `SNOWFLAKE_WAREHOUSE`, `SNOWFLAKE_DATABASE`, `SNOWFLAKE_SCHEMA`, `SNOWFLAKE_ROLE`
- `ALLOWED_EMBED_HOSTNAMES` – space-separated hostnames allowed to embed the app (e.g. `app.explo.co *.explo.co`).

Optional helper:

- `NEXT_PUBLIC_SELECTED_RADIUS_METERS=500` to adjust the map radius around a selected clinic.

### Run the dev server

```bash
pnpm dev
```

The embed UI is available at [http://localhost:3000/embed](http://localhost:3000/embed). The API can be queried at [http://localhost:3000/api/clinics](http://localhost:3000/api/clinics).

### Linting

```bash
pnpm lint
```

### Production build

```bash
pnpm build
pnpm start
```

## Deployment

Deploy to Vercel or any Node-compatible environment. Ensure all environment variables are configured in the hosting platform, including `ALLOWED_EMBED_HOSTNAMES`. The provided `next.config.mjs` applies security headers (CSP, frame-ancestors, Referrer-Policy, etc.) automatically.

## Security Notes

- Snowflake credentials are never sent to the client; all requests flow through the `/api/clinics` route.
- The API enforces GET-only access, rate-limits by IP, filters out clinics without valid coordinates, and validates queries to prevent mutations or cross-database reads.
- Middleware rejects iframe loads where the `Origin`/`Referer` host is not in the allowlist.
- CSP restricts scripts/styles/images/connect targets and limits `frame-ancestors` to approved Explo origins.

---

Questions or follow-ups? Drop in additional metrics or UI tweaks as needed.
