# Backend Setup Guide

## 1. Prerequisites

- Python 3.10+
- `pip`
- Optional: local PostgreSQL

## 2. Environment

Root env:

```bash
cp .env.example .env
```

Backend env:

```bash
cp backend/.env.example backend/.env
```

Minimum required keys:

- `DATABASE_URL`
- `AUTH_SECRET`
- `CORS_ORIGINS`
- `NEXT_PUBLIC_API_BASE_URL` (in root `.env`)

## 3. Install and Run

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
pnpm dev:backend
```

## 4. Database Initialization

When backend starts, migrations/bootstrap logic initializes required schema and seed baseline.

Optional explicit init:

```bash
pnpm backend:init
```

## 5. Verify

- Backend health: `GET http://localhost:8000/v1/meta/health`
- OpenAPI: `http://localhost:8000/docs`
- Frontend host health: `GET http://localhost:3000/api/health`

## 6. Tests

```bash
pnpm test:backend
```

## 7. Local Dev Notes

- Recommended production-like DB: PostgreSQL.
- SQLite fallback can be used during initial local bring-up.
- Keep `backend/storage` as runtime-generated data; do not version uploaded artifacts.
