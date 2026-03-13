# UNIS EDI Portal PrototypeCP

Evolution branch of the frontend prototype, aligned to a production-grade Python backend.

## Stack

- Frontend: Next.js 16, React 19, TypeScript, Tailwind
- Backend: FastAPI + SQLAlchemy + Alembic
- Database: PostgreSQL (primary), SQLite (local fallback)

## Quick Start

```bash
pnpm install
cp .env.example .env
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
cd ..
pnpm dev
pnpm dev:backend
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- OpenAPI docs: http://localhost:8000/docs

## API Notes

- Legacy Next.js mock endpoints under `/api/*` are deprecated and return `410`.
- Keep-alive host endpoint remains at `/api/health`.
- Frontend data APIs now target Python backend `/v1/*` via `NEXT_PUBLIC_API_BASE_URL`.

## Scripts

- `pnpm dev` - start frontend
- `pnpm dev:backend` - start FastAPI backend
- `pnpm backend:init` - backend bootstrap/init helpers
- `pnpm test:backend` - run backend pytest
