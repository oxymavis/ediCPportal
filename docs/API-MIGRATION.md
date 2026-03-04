# API Migration: Next.js Mock `/api/*` to FastAPI `/v1/*`

## Decision

This project uses a one-step migration:

- Old mock API namespace: `/api/*`
- New backend namespace: `/v1/*`

## Contract Changes

1. Base URL
- Before: `NEXT_PUBLIC_API_URL` (default `/api`)
- After: `NEXT_PUBLIC_API_BASE_URL` (example `http://localhost:8000`)

2. Response envelope
- Success: `{ "success": true, "data": ... }`
- Error: `{ "success": false, "error": "...", "code": "..." }`

3. Auth
- OAuth2 bearer for external clients
- Cookie session + CSRF for internal user flow

## Endpoint Mapping

| Old | New |
|---|---|
| `GET /api/partners` | `GET /v1/partners` |
| `POST /api/partners` | `POST /v1/partners` |
| `GET /api/certificates` | `GET /v1/certificates` |
| `POST /api/certificates/upload` | `POST /v1/certificates` (multipart) |
| `GET /api/transactions` | `GET /v1/transactions` |
| `POST /api/transactions/upload` | `POST /v1/transactions` (multipart) |
| `GET /api/notifications` | `GET /v1/notifications` |
| `PUT /api/notifications/:id/read` | `PUT /v1/notifications/{id}/read` |

## Transitional Behavior

- `/api/partners`, `/api/certificates`, `/api/transactions`, `/api/notifications` now return `410 Gone`.
- `/api/health` remains available for frontend host checks.

## Frontend Updates Applied

- `lib/api-client.ts` switched to `/v1/*`.
- Upload calls migrated to FastAPI multipart endpoints.
- `credentials: "include"` enabled for session-based endpoints.
