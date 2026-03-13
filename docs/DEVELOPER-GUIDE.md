# EDI Portal Open API Developer Guide

## 1. Purpose

This guide describes the current implementation of the FastAPI backend as an Open API platform baseline, including OAuth2, quotas, audit logs, integration event ingestion, and transaction traceability.

## 2. Architecture

Components:
- Frontend: Next.js (`app/`, `components/`, `lib/`)
- Backend: FastAPI (`backend/app`)
- ORM/Migrations: SQLAlchemy + Alembic
- Local DB default: SQLite (`backend/dev.db`)
- Production DB target: PostgreSQL (`DATABASE_URL`)
- File storage: local disk (`LOCAL_STORAGE_PATH`)

Main routers:
- `backend/app/routers/oauth.py`
- `backend/app/routers/meta.py`
- `backend/app/routers/auth.py`
- `backend/app/routers/partners.py`
- `backend/app/routers/certificates.py`
- `backend/app/routers/specifications.py`
- `backend/app/routers/transactions.py`
- `backend/app/routers/notifications.py`
- `backend/app/routers/integrations.py`

## 3. Security model

### 3.1 OAuth2 for external clients

Grant type:
- `client_credentials`

Token endpoint:
- `POST /v1/oauth/token`
- client management (admin key protected):
  - `POST /v1/oauth/clients`
  - `GET /v1/oauth/clients`
  - `PUT /v1/oauth/clients/{id}/status`
  - `POST /v1/oauth/clients/{id}/rotate-secret`

Token characteristics:
- JWT access token
- default TTL from `OAUTH_ACCESS_TOKEN_TTL_MINUTES`
- carries `scope`
- persisted `jti` in `oauth_tokens` for revoke/validity checks

### 3.2 API key fallback (transition)

- Header: `x-api-key`
- Controlled by `OAUTH_ENABLE_API_KEY_FALLBACK`
- Intended for migration period; phase-out after partner migration to OAuth2.

### 3.5 Request guard

- IP allowlist: `API_IP_ALLOWLIST` (comma-separated)
- Request size cap: `API_MAX_REQUEST_SIZE_BYTES`
- Applied by `RequestGuardMiddleware`

### 3.3 Internal user session

- HttpOnly cookie session (`edi_session`) for first-party UI flow
- CSRF required for state-changing user-session operations

### 3.4 Scope enforcement

All core business routers now enforce module scopes:
- `partners:*`
- `certificates:*`
- `specifications:*`
- `transactions:*`
- `notifications:*`
- `integrations:*`

Rule:
- `GET/HEAD/OPTIONS` => `module:read`
- `POST/PUT/DELETE` => `module:write`

## 4. Data model

Core tables:
- `users`, `sessions`
- `partners`
- `certificates`
- `tp_specifications`
- `transactions`
- `notifications`

Open API platform tables:
- `api_clients`
  - `client_id`, `secret_hash`, `status`, `scopes`, `environment`, `last_used_at`
- `oauth_tokens`
  - `jti`, `client_id`, `expires_at`, `revoked`
- `api_call_logs`
  - `trace_id`, `client_id`, `method`, `path`, `status_code`, `latency_ms`
- `api_quotas`
  - client-level daily/monthly counters

Integration + linking tables:
- `integration_clients`
- `transaction_links`

Transactions extension fields:
- `source_system`, `external_event_id`, `idempotency_key`
- `doc_type`, `business_refs`, `control_refs`, `occurred_at`

## 5. Request lifecycle and middleware

Middleware chain:
1. Security headers
2. Rate limit (in-memory)
3. Trace + audit log middleware

Trace:
- Every request gets `trace_id` (`x-trace-id` header echoed in response)

Audit log:
- OAuth/API-key requests persist into `api_call_logs`

Quota:
- OAuth client requests increment daily/monthly counters (`api_quotas`)
- Exceeding quota returns 429

## 6. Integration ingest and linking engine

Single/batch ingest:
- `POST /v1/integrations/events`
- `POST /v1/integrations/events/batch`

Idempotency:
- primary: `idempotency_key`
- secondary: `external_event_id + source_system`

Linking rules implemented:
- `945 -> 940`
- `856 -> 850`
- `214 -> 204`

Matching strategy:
- exact partner + environment + primary refs (high confidence)
- fallback secondary refs + time window (`LINKING_TIME_WINDOW_DAYS`, default 7)
- ambiguous top matches are marked and not auto-linked

Relation query:
- `GET /v1/transactions/{id}/related`

## 7. Configuration

Backend `.env` key variables:
- `DATABASE_URL`
- `AUTH_SECRET`
- `CORS_ORIGINS`
- `COOKIE_*`
- `INTEGRATION_API_KEYS`
- `LINKING_TIME_WINDOW_DAYS`
- `OAUTH_ACCESS_TOKEN_TTL_MINUTES`
- `OAUTH_ENABLE_API_KEY_FALLBACK`
- `OAUTH_ADMIN_KEY`
- `API_DAILY_QUOTA`
- `API_MONTHLY_QUOTA`
- `API_MAX_REQUEST_SIZE_BYTES`
- `API_IP_ALLOWLIST`
- `PLATFORM_VERSION`
- `LOCAL_STORAGE_PATH`
- `EMAIL_MODE` + SMTP fields

Frontend `.env` key variable:
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`

## 8. Local development

Backend setup:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Run API:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Run migrations:
```bash
alembic -c alembic.ini upgrade head
```

Run tests:
```bash
.venv/bin/python -m pytest -q
```

## 9. Test coverage snapshot

Current automated backend tests cover:
- OAuth issue/revoke/scope enforcement
- Auth and CSRF behavior
- Integration ingest and idempotency
- Transaction related chain querying
- Middleware security/rate-limit behavior

Latest local run:
- `24 passed`

## 10. Production hardening gaps (for enterprise go-live)

Already in code:
- OAuth2 token issuance and scope validation
- quota counters and API call audit logs
- trace id propagation
- request guard for IP allowlist and body size
- OAuth client disable and secret rotation APIs

Still required to fully satisfy enterprise launch criteria:
- API gateway level controls (WAF, tenant-level burst/QPS, IP allowlist)
- centralized observability stack (Prometheus/Grafana/ELK/OTel)
- sandbox and production environment physical isolation
- key/secret rotation workflows and admin UI/approval flow
- SDK publishing pipeline (Python/TypeScript package release)
- SLA dashboards and 7-day acceptance observation run

## 11. Suggested 12-week execution checkpoints

- Week 1-3: OAuth hardening, migration/backfill scripts, gateway policy baseline
- Week 4-6: full endpoint scope mapping validation, compatibility tests, docs freeze
- Week 7-9: sandbox rollout + SDK + partner onboarding guide
- Week 10-12: load/security tests, gray release, operation handover

## 12. Related documents

- `docs/API-REFERENCE.md`
- `docs/TEST-CASES-DETAILED.md`
- `docs/PYTHON-BACKEND-MIGRATION.md`
- `docs/PRD-IMPLEMENTATION-STATUS.md`
