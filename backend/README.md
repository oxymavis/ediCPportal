# Backend (FastAPI)

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

默认使用 `sqlite:///./dev.db` 便于本地启动。要切换 PostgreSQL，请在 `backend/.env` 中设置 `DATABASE_URL=postgresql://...`。

文件会默认保存到本地目录 `backend/storage`（可通过 `LOCAL_STORAGE_PATH` 调整）。
邮件默认 `EMAIL_MODE=mock`，如需真实发送可配置 SMTP：
`SMTP_HOST/SMTP_PORT/SMTP_USERNAME/SMTP_PASSWORD/SMTP_USE_TLS/SMTP_FROM`。

外部系统日志接入：
- `POST /v1/integrations/events`
- `POST /v1/integrations/events/batch`
认证优先使用 OAuth2 bearer token（`/v1/oauth/token`），`x-api-key` 为过渡兼容模式。

## Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Initialize DB

```bash
python3 -m app.cli init
```

## Verify Seed Completeness (25 tables)

```bash
python3 -m app.cli verify
```

## Init + Verify (one-shot)

```bash
python3 -m app.cli all
```

## Migrations

```bash
alembic -c alembic.ini upgrade head
```

## Test

```bash
pytest -q
```

## OpenAPI

- OpenAPI JSON: `http://localhost:8000/openapi.json`
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## OAuth2 Quickstart

默认种子会创建一个开发用 client（仅本地开发）：
- `client_id`: `openapi-default-client`
- `client_secret`: `openapi-default-secret`

获取 token：

```bash
curl -X POST http://localhost:8000/v1/oauth/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=client_credentials&client_id=openapi-default-client&client_secret=openapi-default-secret'
```

创建新 API client（管理员）：

```bash
curl -X POST http://localhost:8000/v1/oauth/clients \
  -H 'x-admin-key: dev-oauth-admin-key' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'name=partner-a&scopes=integrations:write transactions:read&environment=sandbox'
```
