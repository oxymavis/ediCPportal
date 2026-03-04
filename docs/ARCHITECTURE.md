# Architecture Overview

## Topology

- Frontend host: Next.js app (UI rendering, session-aware UX)
- Backend API: FastAPI service under `/v1/*`
- Database: PostgreSQL primary, SQLite fallback for local development
- Storage: backend local filesystem path configured by `LOCAL_STORAGE_PATH`

## Boundary

- Next.js is no longer the business API provider.
- Next.js `/api/*` routes are deprecated and return `410` except `/api/health`.
- All business data traffic flows from browser/frontend client to FastAPI `/v1`.

## Authentication Model

- External integrations: OAuth2 `client_credentials`, bearer token scopes.
- Internal user flow: cookie session + CSRF protections.
- Scope policy:
  - GET/HEAD/OPTIONS => `*:read`
  - POST/PUT/DELETE => `*:write`

## Core Modules

- `partners`: trading partner management and routing views
- `certificates`: certificate upload/download and metadata lifecycle
- `specifications`: message specification files and metadata
- `transactions`: transaction query/upload/detail + relation chain
- `notifications`: user-facing alert center
- `integrations`: external event ingestion and idempotency
- `oauth` and `auth`: integration identity and internal user auth
- `meta`: health/version endpoints

## Operational Controls

- Request guard (size cap and IP allowlist)
- Rate limit + quota controls
- API audit logs with trace ID propagation

## High-Level Request Flow

1. Frontend calls `/v1/*` using `NEXT_PUBLIC_API_BASE_URL`.
2. Backend middleware assigns trace ID and enforces security/rate rules.
3. Router validates auth/scope and executes service logic.
4. DB read/write occurs through SQLAlchemy models.
5. Response returns envelope: `{ success, data }` or `{ success: false, error, code }`.
