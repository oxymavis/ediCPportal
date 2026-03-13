# EDI Portal Open API Reference (v1)

Base URL (local): `http://localhost:8000`

- OpenAPI JSON: `GET /openapi.json`
- Swagger UI: `GET /docs`
- ReDoc: `GET /redoc`

## 1. API conventions

### 1.1 Response envelope

Success:
```json
{ "success": true, "data": {} }
```

Error:
```json
{ "success": false, "error": "message", "code": "ERROR_CODE" }
```

### 1.2 Time and format

- All timestamps use ISO-8601 and UTC.
- Request and response body format is JSON unless specified as multipart.

### 1.3 Authentication modes

External Open API (recommended):
- OAuth2 bearer token from `/v1/oauth/token` (`client_credentials`).

Transition mode (temporary, compatibility):
- `x-api-key` supported for integration push endpoint.

Internal user session mode (frontend browser flow):
- Cookie session (`edi_session`) + CSRF for protected mutations.

## 2. OAuth2 API

### 2.1 Issue token

`POST /v1/oauth/token`

Content-Type: `application/x-www-form-urlencoded`

Request fields:
- `grant_type` required, fixed value `client_credentials`
- `client_id` required
- `client_secret` required
- `scope` optional, space-separated

Example:
```bash
curl -X POST http://localhost:8000/v1/oauth/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=client_credentials&client_id=cli_xxx&client_secret=sec_xxx&scope=transactions:read partners:read'
```

Response:
```json
{
  "success": true,
  "data": {
    "access_token": "<jwt>",
    "token_type": "bearer",
    "expires_in": 3600,
    "scope": "transactions:read partners:read"
  }
}
```

### 2.2 Revoke token

`POST /v1/oauth/revoke`

Content-Type: `application/x-www-form-urlencoded`

Request fields:
- `token` required

### 2.3 Create API client (bootstrap/admin helper)

`POST /v1/oauth/clients`

Content-Type: `application/x-www-form-urlencoded`

Request fields:
- `name` required
- `scopes` required, space-separated
- `environment` optional, default `production`

Response includes one-time plain `client_secret`.

Admin header (required):
```http
x-admin-key: <OAUTH_ADMIN_KEY>
```

### 2.4 List API clients

`GET /v1/oauth/clients` (admin header required)

### 2.5 Update client status

`PUT /v1/oauth/clients/{client_id}/status` (admin header required)

Form field:
- `status`: `active|disabled`

### 2.6 Rotate client secret

`POST /v1/oauth/clients/{client_id}/rotate-secret` (admin header required)

## 3. Meta APIs

### 3.1 Version
`GET /v1/meta/version`

### 3.2 Health
`GET /v1/meta/health`

## 4. Scope matrix

- `partners:read`, `partners:write`
- `certificates:read`, `certificates:write`
- `specifications:read`, `specifications:write`
- `transactions:read`, `transactions:write`
- `notifications:read`, `notifications:write`
- `integrations:read`, `integrations:write`

Read methods (`GET/HEAD/OPTIONS`) require `*:read`; write methods (`POST/PUT/DELETE`) require `*:write`.

## 5. Auth APIs (internal user flow)

These are primarily for first-party frontend session flow, not external Open API onboarding.

- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `GET /v1/auth/me`
- `POST /v1/auth/logout`
- `POST /v1/auth/verify-email/request`
- `POST /v1/auth/verify-email/confirm`

## 6. Partners APIs

OAuth scopes:
- Read endpoints: `partners:read`
- Write endpoints: `partners:write`

Endpoints:
- `GET /v1/partners`
- `GET /v1/partners/{partner_id}`
- `POST /v1/partners`
- `PUT /v1/partners/{partner_id}`
- `DELETE /v1/partners/{partner_id}`
- `GET /v1/partners/{partner_id}/subsidiaries/{subsidiary_id}/routing`
- `PUT /v1/partners/{partner_id}/subsidiaries/{subsidiary_id}/routing`

## 7. Certificates APIs

OAuth scopes:
- Read endpoints: `certificates:read`
- Write endpoints: `certificates:write`

Endpoints:
- `GET /v1/certificates`
- `GET /v1/certificates/{cert_id}`
- `POST /v1/certificates` (multipart)
- `PUT /v1/certificates/{cert_id}`
- `DELETE /v1/certificates/{cert_id}`
- `GET /v1/certificates/{cert_id}/download`

Upload fields (`POST /v1/certificates`):
- `file`, `name`, `partner`, `usage`, `type`, `environment`

## 8. Specifications APIs

OAuth scopes:
- Read endpoints: `specifications:read`
- Write endpoints: `specifications:write`

Endpoints:
- `GET /v1/specifications`
- `POST /v1/specifications`
- `POST /v1/specifications/upload` (multipart)
- `PUT /v1/specifications/{spec_id}`
- `GET /v1/specifications/{spec_id}/download`

Upload fields (`POST /v1/specifications/upload`):
- `messageType`, `messageName`, `partner`, `partnerCode`, `version`, `uploadedBy`, `file`

## 9. Transactions APIs

OAuth scopes:
- Read endpoints: `transactions:read`
- Write endpoints: `transactions:write`

Endpoints:
- `GET /v1/transactions`
- `GET /v1/transactions/{trx_id}`
- `POST /v1/transactions` (multipart/manual upload)
- `GET /v1/transactions/{trx_id}/related`

`GET /v1/transactions` common query params:
- `environment`, `type`, `status`, `direction`, `partner`
- `dateFrom`, `dateTo`, `search`
- `relatedDocType`, `relatedRef`

## 10. Notifications APIs

OAuth scopes:
- Read endpoints: `notifications:read`
- Write endpoints: `notifications:write`

Endpoints:
- `GET /v1/notifications`
- `GET /v1/notifications/{notif_id}`
- `PUT /v1/notifications/mark-all-read`
- `PUT /v1/notifications/{notif_id}`
- `PUT /v1/notifications/{notif_id}/read`

## 11. Integrations APIs (push ingestion)

OAuth scope:
- `integrations:write` (or temporary `x-api-key` fallback)

Endpoints:
- `POST /v1/integrations/events`
- `POST /v1/integrations/events/batch`

Environment isolation:
- OAuth client `environment=sandbox` can only push `environment=sandbox` events.
- OAuth client `environment=production` can only push `environment=production` events.
- `environment=all` can push both.

### 11.1 Single event request schema

```json
{
  "idempotencyKey": "evt-20260303-0001",
  "sourceSystem": "edi",
  "environment": "production",
  "partner": "Walmart",
  "docType": "856",
  "direction": "outbound",
  "status": "completed",
  "occurredAt": "2026-03-03T10:10:00Z",
  "businessRefs": {
    "poNo": "PO-1001",
    "shipmentNo": "SHP-2001"
  },
  "controlRefs": {
    "isaControlNo": "000000123",
    "gsControlNo": "987",
    "stControlNo": "0001"
  },
  "externalEventId": "oms-msg-778899",
  "rawPayload": {
    "records": 2,
    "senderId": "OMS-A",
    "receiverId": "UNIS"
  }
}
```

### 11.2 Single event response

```json
{
  "success": true,
  "data": {
    "success": true,
    "transactionId": "TRX-856-7ab4e9f1d2",
    "linking": {
      "linked": true,
      "relatedTransactionIds": ["TRX-850-4c91f0aa1b"],
      "reason": "linked"
    }
  }
}
```

## 12. Transaction relation query

### 12.1 Get related chain

`GET /v1/transactions/{trx_id}/related`

Response:
```json
{
  "success": true,
  "data": {
    "upstream": [
      {
        "transactionId": "TRX-940-abc",
        "docType": "940",
        "partner": "Walmart",
        "status": "completed",
        "relationType": "response_to",
        "matchRule": "warehouseOrderNo+partner+window",
        "confidence": 95
      }
    ],
    "downstream": []
  }
}
```

## 13. Error code examples

- `UNAUTHORIZED` (`401`): missing/invalid credentials
- `FORBIDDEN` (`403`): scope insufficient or CSRF failed
- `NOT_FOUND` (`404`): resource does not exist
- `VALIDATION_ERROR` (`422`): request schema/field validation failed
- `RATE_LIMITED` (`429`): gateway/app rate limit triggered
- `API_QUOTA_EXCEEDED` (`429`): client daily/monthly quota exceeded
- `IP_NOT_ALLOWED` (`403`): source IP not in allowlist
- `PAYLOAD_TOO_LARGE` (`413`): request body exceeds configured size

## 14. Idempotency and deduplication

For integration push APIs:
- Primary dedupe key: `idempotencyKey` (unique)
- Secondary dedupe: `externalEventId + sourceSystem`
- Replayed request with same idempotency key returns existing `transactionId`

## 15. Compatibility policy

- `v1` does not remove or change semantic of existing fields.
- New fields are additive and optional.
- Breaking changes only introduced in `/v2`.
