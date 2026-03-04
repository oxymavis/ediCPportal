# GAP Analysis: PrototypeCP vs PRD/FSD vs `edibrifeportal`

## Scope

This report compares:

1. Current local implementation in this repository
2. Product intent in `docs/PRD.md` and `docs/Functional-Specification.md`
3. Reference production implementation in `oxymavis/edibrifeportal`

## Summary Status

| Domain | PRD/FSD Expectation | Local Before | Local After This Alignment |
|---|---|---|---|
| Backend architecture | FastAPI/OpenAPI + persistent DB | Next.js mock routes only | FastAPI backend baseline imported (`backend/`) |
| Auth | OAuth2 + session + scope | Not implemented in backend | Implemented in imported backend routers |
| Trading partners | Full CRUD + hierarchy + routing | Mock list/create only | `/v1/partners*` available in backend |
| Certificates | Upload/download/manage | Mock list/upload only | `/v1/certificates*` available |
| Specifications | Upload/download/manage | UI-only/static | `/v1/specifications*` available |
| Transactions | Query/upload/detail/related | Mock list/upload | `/v1/transactions*` and related query available |
| Notifications | Read/update/mark all | Mock read/update | `/v1/notifications*` available |
| Integrations ingest | Event ingest/idempotency/linking | Missing | `/v1/integrations/events*` available |
| API observability | trace/audit/quota | Missing | Implemented in backend middleware/tables |
| Frontend API contract | `/v1/*` + unified envelope | `/api/*` mock contract | `lib/api-client.ts` migrated to `/v1/*` |
| Local docs | Architecture/setup/migration notes | Partial | Added architecture, setup, migration docs |

## Detailed Gaps Closed

- Replaced mock backend dependency with production FastAPI baseline.
- Deprecated old Next.js mock endpoints (`410 Gone`) to avoid accidental use.
- Added root and backend environment templates for consistent local startup.
- Added backend operation and migration documents for developer onboarding.

## Remaining Known Gaps

- Some dashboard tabs still use embedded static dataset examples; they are not yet fully wired to live `/v1` queries.
- OpenAPI examples in certain UI docs tabs reference `/api/v2/messages/*` and should be normalized in a dedicated UI docs pass.
- `origin` remote is intentionally not configured because target repository URL is not provided yet.

## Recommended Next Iteration

1. Replace remaining static tab datasets with real backend queries.
2. Add frontend integration tests for `/v1` contract on key tabs.
3. Configure CI workflow for backend pytest + frontend build.
