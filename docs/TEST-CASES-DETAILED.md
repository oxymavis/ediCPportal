# Backend Detailed Test Cases

This document provides executable test cases for the backend alignment scope.

## Run

```bash
cd /Users/sheliasun/Library/Mobile\ Documents/com~apple~CloudDocs/edi-portal-prototypeCP/backend
python3 -m pytest -q
```

Automated coverage files:

- `backend/tests/test_alignment_full.py`
- `backend/tests/test_domain.py`
- `backend/tests/test_integrations.py`
- `backend/tests/test_oauth.py`
- `backend/tests/test_auth.py`

## 1. Authentication and Password Migration

### AUTH-001 Register success
- Precondition: email not registered
- Step: `POST /v1/auth/register` with password `StrongPass1`
- Expected: `success=true`, session cookie + csrf cookie set

### AUTH-002 Login success
- Precondition: user registered
- Step: `POST /v1/auth/login`
- Expected: `success=true`, user info returned

### AUTH-003 Progressive bcrypt migration
- Precondition: user in DB with `password_algo=pbkdf2`
- Step: login via `/v1/auth/login`
- Expected: login succeeds, DB updates `password_algo=bcrypt`

### AUTH-004 CSRF enforcement
- Precondition: authenticated session
- Step: call protected write endpoint without `x-csrf-token`
- Expected: `403`, `CSRF validation failed`

## 2. Partners Dual Path and Lifecycle

### PARTNER-001 Create API partner
- Step: `POST /v1/partners` with `integrationType=api`, `communicationChannel=REST_API`, `apiConfig`
- Expected: response includes `integrationType`, `communicationChannel`, `apiConfig`, `lifecycle.currentStepId=1`

### PARTNER-002 Update lifecycle
- Step: `PUT /v1/partners/{id}/lifecycle`
- Expected: `currentStepId`, `onboardingStartDate`, `stepCompletionDates` updated

### PARTNER-003 Advance lifecycle
- Step: `POST /v1/partners/{id}/lifecycle/advance`
- Expected: step increments by 1, completion date added

### PARTNER-004 Validate API config with masking
- Step: `POST /v1/partners/{id}/api-config/validate`
- Expected: `valid=true`, `apiKey` masked as `***MASKED***`

### PARTNER-005 Invalid channel rejected
- Step: create/update partner with invalid `communicationChannel`
- Expected: `PARTNER_VALIDATION` error

## 3. Connection Testing (AS2/API)

### CONN-AS2-001 AS2 7-step flow
- Precondition: RSA key/cert + signed payload + encrypted payload + MDN URL + ACK URL
- Step: `POST /v1/connection-testing/as2/run`
- Expected: run created, `GET /runs/{runId}` returns 7 steps

### CONN-AS2-002 Signature missing params
- Step: omit `signatureBase64` or `signerCertPem`
- Expected: step 4 fails

### CONN-AS2-003 Decryption failure
- Step: invalid private key or ciphertext
- Expected: step 5 fails

### CONN-AS2-004 MDN non-2xx
- Step: set `mdnUrl` returning 500
- Expected: step 6 fails

### CONN-AS2-005 ACK content invalid
- Step: `ackUrl` body without `ACK`/`997`
- Expected: step 7 fails

### CONN-API-001 API connectivity success
- Step: `POST /v1/connection-testing/api/run` with reachable endpoint
- Expected: run succeeds or partial with structured step results

### CONN-ENV-001 Environment isolation
- Precondition: oauth client environment `sandbox`
- Step: run test against `production`
- Expected: denied with `CONN_ENV_FORBIDDEN`

### CONN-RUN-001 Runs query
- Step: `GET /v1/connection-testing/runs?environment=sandbox&testType=as2`
- Expected: only matching runs returned

## 4. Document Testing and Validator

### DOC-001 Create document report passed
- Step: `POST /v1/connection-testing/document-tests` with empty `errors`
- Expected: `status=passed`

### DOC-002 Create document report failed
- Step: send non-empty `errors`
- Expected: `status=failed`

### DOC-003 Read report detail
- Step: `GET /v1/connection-testing/document-tests/{id}`
- Expected: returns `payload`, `errors`, `createdAt`

### VAL-JSON-001 Valid JSON
- Step: `POST /validator/validate` with `format=json`
- Expected: `valid=true`

### VAL-JSON-002 Invalid JSON
- Step: malformed JSON string
- Expected: `valid=false`, code `API-VAL-003`

### VAL-XML-001 Valid XML
- Step: `format=xml`, valid XML content
- Expected: `valid=true`

### VAL-X12-001 Missing ISA
- Step: `format=x12` without ISA segment
- Expected: `valid=false`, code `API-VAL-001`

## 5. API Docs Backend

### APIDOC-001 Create message
- Step: `POST /v1/api-docs/messages`
- Expected: created successfully

### APIDOC-002 Update message metadata
- Step: `PUT /v1/api-docs/messages/{code}`
- Expected: fields updated

### APIDOC-003 Schema upsert
- Step: `PUT /messages/{code}/schema`
- Expected: upsert success, `GET /schema` returns latest

### APIDOC-004 Mapping replace
- Step: `PUT /messages/{code}/mapping` with mapping array
- Expected: old entries replaced by new set

### APIDOC-005 Samples replace
- Step: `PUT /messages/{code}/samples`
- Expected: request/response samples replaced

### APIDOC-006 Search/filter
- Step: `GET /messages?category=...&search=...`
- Expected: filtered list

## 6. Transactions and Export

### TRX-001 Create transaction with integration fields
- Step: `POST /v1/transactions` with `integrationType` and `channel`
- Expected: response contains fields

### TRX-002 Query by integration type/channel
- Step: `GET /v1/transactions?integrationType=api&channel=REST_API`
- Expected: returns matching records

### TRX-003 Export CSV
- Step: `GET /v1/transactions/export?format=csv`
- Expected: content-type `text/csv`, header row present

### TRX-004 Export XLSX
- Step: `GET /v1/transactions/export?format=xlsx`
- Expected: content-type xlsx mime; body starts with `PK` (zip package)

### TRX-005 Related transaction query
- Step: `GET /v1/transactions/{id}/related`
- Expected: returns `upstream` and `downstream`

## 7. Notifications and SSE

### NOTIF-001 List notifications
- Step: `GET /v1/notifications?environment=production`
- Expected: unarchived list returned

### NOTIF-002 Mark all read
- Step: `PUT /v1/notifications/mark-all-read`
- Expected: `updated` count > 0 when records exist

### NOTIF-003 Mark one as read
- Step: `PUT /v1/notifications/{id}/read`
- Expected: target notification `read=true`

### NOTIF-004 SSE stream
- Step: `GET /v1/notifications/stream`
- Expected: `content-type=text/event-stream`, emits `event: notification`

## 8. Security and Governance Regression

### SEC-001 Scope enforcement
- Precondition: token with read-only scope
- Step: call write endpoint
- Expected: `403` insufficient scope

### SEC-002 Revoked oauth token
- Step: revoke token, call protected endpoint
- Expected: unauthorized/forbidden

### SEC-003 Quota exceeded
- Precondition: low quota test config
- Step: continuous requests over quota
- Expected: `429 API quota exceeded`

### SEC-004 Trace propagation
- Step: call protected endpoint
- Expected: response includes `x-trace-id`
