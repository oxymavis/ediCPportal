# 2026-03-25 Change Log

## Summary

This log records the application changes completed on 2026-03-25 for developer self-service onboarding, partner AS2 configuration, certificate handling, and related documentation.

## Backend

- Added self-service developer app management and OAuth client ownership support.
- Added user-owned OAuth app creation, listing, secret rotation, enable/disable, and token issuance support.
- Fixed registration flow integration so frontend registration uses backend auth APIs instead of local-only state.
- Added AS2 profile fields for `as2Port`, `senderId`, `senderQualifier`, `receiverId`, and `receiverQualifier`.
- Added validation and persistence for the new AS2 profile fields during partner creation and AS2 profile update.
- Exposed the new AS2 profile fields in partner list and partner detail APIs.
- Added certificate `rawContent` persistence and API support for PEM/Base64 text storage and retrieval.
- Extended certificate upload validation to allow `.cert` files.
- Added runtime compatibility bootstrap in app startup for newly introduced database columns.

## Frontend

- Fixed register and logout flows to use real backend session/auth endpoints.
- Added `Developer Apps` dashboard page for self-service OAuth app registration and credential generation.
- Added partner creation form inputs for:
  - `Port`
  - `Sender ID`
  - `Sender Qualifier`
  - `Receiver ID`
  - `Receiver Qualifier`
- Added AS2 profile edit support in partner detail view for the five AS2 fields above.
- Added AS2 summary display in partner expanded cards and partner detail AS2 profile cards so these values are visible in browse mode.
- Wired certificate upload buttons in partner detail view to the real upload workflow.
- Added certificate raw PEM/Base64 text input to certificate upload UI.
- Added certificate detail actions for copying PEM content and downloading PEM content.
- Updated certificate file pickers to accept `.cert`.

## Tests

- Added developer app backend test coverage.
- Extended partner domain tests for:
  - required AS2 port and sender/receiver IDs
  - AS2 profile update persistence
  - partner list/detail API response coverage for new AS2 fields
- Added certificate raw-content test coverage.

## Documentation

- Added external developer integration guide.
- Added developer self-service test case document.
- Added this daily change log.
- Added a separate database deployment note for schema changes introduced on 2026-03-25.

## Files Added

- `backend/alembic/versions/0003_api_client_owner.py`
- `backend/alembic/versions/0004_as2_sender_receiver_fields.py`
- `backend/alembic/versions/0005_certificate_raw_content.py`
- `backend/app/schemas/oauth.py`
- `backend/tests/test_developer_apps.py`
- `components/dashboard/tabs/developer-apps-tab.tsx`
- `docs/EXTERNAL-DEVELOPER-GUIDE.md`
- `docs/TEST-CASES-DEVELOPER-SELF-SERVICE.md`
- `docs/DB-DEPLOY-2026-03-25.md`

## Verification

- `npx tsc --noEmit` passed after frontend and shared type changes.
- Python test execution was not run in this environment because `pytest` is not installed locally.

---

## Infrastructure & documentation (same day follow-up)

- Added **CVM 一键发布脚本** [`scripts/deploy-cvm.sh`](../scripts/deploy-cvm.sh)：在服务器上 `git fetch` + `reset --hard` 对齐远端分支、安装依赖、执行 Alembic、前端 `npm ci`/`build`、重启 `pm2`、本机健康检查。
- 在 [`docs/DEPLOY-TENCENTCLOUD-MYSQL.md`](DEPLOY-TENCENTCLOUD-MYSQL.md) 增加 **「四、CVM 日常发布」** 说明与排障命令。
- [`docs/EXTERNAL-DEVELOPER-GUIDE.md`](EXTERNAL-DEVELOPER-GUIDE.md) 已对齐 **生产 Base URL**（经 Nginx 的 `/api` 前缀）及 OpenAPI/Swagger/ReDoc 的完整 URL；**不再在文档中粘贴真实 client_secret**。
- 新增本机辅助脚本 [`scripts/push-and-deploy-cvm.sh`](../scripts/push-and-deploy-cvm.sh)：`git push` 后通过 SSH 在 CVM 执行 `deploy-cvm.sh`（见脚本内环境变量说明）。
