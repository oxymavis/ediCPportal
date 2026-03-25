# Developer Self-Service Test Cases

This document provides executable test cases for the new self-service developer onboarding flow:

- User registration and login
- Session and logout correctness
- Self-service OAuth app creation in the portal
- Client secret rotation and status management
- Ownership isolation

## Scope

Frontend:

- `/`
- `/dashboard?tab=developer-apps`

Backend:

- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `GET /v1/auth/me`
- `POST /v1/auth/logout`
- `GET /v1/oauth/my/clients`
- `POST /v1/oauth/my/clients`
- `POST /v1/oauth/my/clients/{client_id}/rotate-secret`
- `PUT /v1/oauth/my/clients/{client_id}/status`
- `POST /v1/oauth/token`

## Environment Preconditions

- Frontend is running and can reach backend
- Backend is running with database initialized
- Browser cookies are enabled
- Test users used below are not pre-registered unless explicitly required

## 1. Registration and Login

### DEV-AUTH-001 Register success
- Precondition: email not registered
- Step: open `/`
- Step: switch to `Sign up`
- Step: input valid `name`, unique `email`, password `Password1`, confirm password `Password1`
- Step: submit form
- Expected: redirected to `/dashboard`
- Expected: browser has session cookie `edi_session`
- Expected: browser has csrf cookie `edi_csrf`
- Expected: refresh `/dashboard` still stays logged in

### DEV-AUTH-002 Register password mismatch
- Precondition: email not registered
- Step: sign up with different `password` and `confirmPassword`
- Expected: page shows `Passwords do not match`
- Expected: no redirect
- Expected: no authenticated session created

### DEV-AUTH-003 Register weak password
- Precondition: email not registered
- Step: sign up with password `password`
- Expected: request rejected
- Expected: backend response contains weak password error
- Expected: user remains on sign-up page

### DEV-AUTH-004 Register duplicate email
- Precondition: same email already registered
- Step: sign up again with same email
- Expected: backend returns `AUTH_EMAIL_EXISTS`
- Expected: no duplicate user created

### DEV-AUTH-005 Login success
- Precondition: user already registered
- Step: open `/`
- Step: input correct email and password
- Step: submit login
- Expected: redirected to `/dashboard`
- Expected: `GET /v1/auth/me` returns current user
- Expected: user name and email shown in sidebar

### DEV-AUTH-006 Login invalid credentials
- Precondition: user already registered
- Step: login with wrong password
- Expected: page shows `Invalid email or password`
- Expected: no redirect
- Expected: no valid session established

### DEV-AUTH-007 Logout success
- Precondition: logged-in user session exists
- Step: click `Logout`
- Expected: frontend returns to `/`
- Expected: protected page `/dashboard` redirects back to `/`
- Expected: `GET /v1/auth/me` returns `401`

### DEV-AUTH-008 Session persistence on refresh
- Precondition: logged in successfully
- Step: refresh `/dashboard`
- Expected: user remains authenticated
- Expected: active tab and page state remain usable

## 2. Developer Apps UI

### DEV-APP-001 Developer Apps tab visible after login
- Precondition: logged-in user
- Step: open `/dashboard`
- Step: inspect left sidebar
- Expected: `Developer Apps` entry is visible
- Step: click `Developer Apps`
- Expected: page title becomes `Developer Apps`
- Expected: app creation form is visible

### DEV-APP-002 Create app success
- Precondition: logged-in user
- Step: open `Developer Apps`
- Step: input app name `OMS Sandbox App`
- Step: choose environment `sandbox`
- Step: select scopes `integrations:write` and `transactions:read`
- Step: click `Create App`
- Expected: success panel appears
- Expected: panel shows one-time `client_id`
- Expected: panel shows one-time `client_secret`
- Expected: new app appears in `My Apps`
- Expected: app row shows selected environment and scopes

### DEV-APP-003 Create app without scopes
- Precondition: logged-in user
- Step: uncheck all scopes
- Expected: `Create App` button disabled

### DEV-APP-004 Create app invalid scope via API
- Precondition: logged-in user with valid session
- Step: call `POST /v1/oauth/my/clients` with scope `invalid:scope`
- Expected: request rejected with `400`
- Expected: error indicates invalid scope

### DEV-APP-005 Refresh app list
- Precondition: at least one app exists
- Step: click `Refresh`
- Expected: list reloads without error
- Expected: no duplicate rows appear

## 3. Secret and Status Management

### DEV-APP-006 Rotate secret success
- Precondition: logged-in user owns at least one app
- Step: click `Rotate Secret` on an owned app
- Expected: success panel appears
- Expected: new `client_secret` is shown
- Expected: old secret is no longer valid for token issuance
- Expected: existing non-revoked oauth tokens for that client are revoked

### DEV-APP-007 Disable app success
- Precondition: logged-in user owns active app
- Step: click `Disable`
- Expected: app status becomes `disabled`
- Expected: subsequent `POST /v1/oauth/token` with that client returns failure

### DEV-APP-008 Re-enable app success
- Precondition: logged-in user owns disabled app
- Step: click `Enable`
- Expected: app status becomes `active`
- Expected: token issuance can succeed again with current secret

### DEV-APP-009 Disabled app cannot mint token
- Precondition: app status is `disabled`
- Step: call `POST /v1/oauth/token` with disabled `client_id` and valid secret
- Expected: request rejected with `401`

## 4. Ownership and Access Isolation

### DEV-APP-010 User only sees own apps
- Precondition: User A has created app A1
- Step: logout User A
- Step: register/login as User B
- Step: open `Developer Apps`
- Expected: `My Apps` does not show app A1

### DEV-APP-011 User cannot rotate another user's app
- Precondition: User A has created app A1; User B is logged in
- Step: call `POST /v1/oauth/my/clients/{A1}/rotate-secret`
- Expected: `404 Client not found`

### DEV-APP-012 User cannot change another user's app status
- Precondition: User A has created app A1; User B is logged in
- Step: call `PUT /v1/oauth/my/clients/{A1}/status`
- Expected: `404 Client not found`

## 5. Token Issuance Validation

### DEV-TOKEN-001 Token issuance with self-service app
- Precondition: logged-in user created app successfully and copied `client_id` / `client_secret`
- Step: call `POST /v1/oauth/token`
- Step: send `grant_type=client_credentials`
- Step: send created `client_id`, `client_secret`
- Expected: `success=true`
- Expected: response contains `access_token`, `token_type=bearer`, `expires_in`

### DEV-TOKEN-002 Token issuance with rotated secret
- Precondition: app secret rotated
- Step: call token endpoint with old secret
- Expected: rejected
- Step: call token endpoint with new secret
- Expected: succeeds

### DEV-TOKEN-003 Token issuance with narrowed scope subset
- Precondition: app has multiple scopes
- Step: request token using allowed subset in `scope`
- Expected: succeeds
- Expected: returned `scope` equals requested subset

### DEV-TOKEN-004 Token issuance with unauthorized scope
- Precondition: app has `transactions:read` only
- Step: request token with `transactions:write`
- Expected: `403 Requested scope not allowed`

## 6. Regression Checks

### DEV-REG-001 Existing admin OAuth client API still works
- Precondition: admin key available
- Step: call `POST /v1/oauth/clients`
- Expected: admin path still creates client successfully

### DEV-REG-002 Existing login form still works
- Precondition: known valid user exists
- Step: login from home page
- Expected: normal redirect and dashboard access

### DEV-REG-003 Existing protected pages still require auth
- Precondition: logged out
- Step: open `/dashboard`
- Expected: redirected to `/`

## 7. Suggested API Smoke Script

Use these API steps if another AI is validating without UI:

1. `POST /v1/auth/register`
2. Capture cookies `edi_session` and `edi_csrf`
3. `POST /v1/oauth/my/clients`
4. `GET /v1/oauth/my/clients`
5. `POST /v1/oauth/token`
6. `POST /v1/oauth/my/clients/{client_id}/rotate-secret`
7. `PUT /v1/oauth/my/clients/{client_id}/status`
8. `POST /v1/auth/logout` with csrf header

## 8. Automated Test References

Existing automated coverage files:

- `backend/tests/test_auth.py`
- `backend/tests/test_oauth.py`
- `backend/tests/test_developer_apps.py`

Recommended extra automated coverage if expanded later:

- Frontend E2E for register -> dashboard -> developer app create
- API test for old secret invalidation after rotate
- API test for disabled app token rejection
