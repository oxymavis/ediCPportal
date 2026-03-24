#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="${1:-main}"
DRY_RUN="${DRY_RUN:-0}"
SKIP_PIP_INSTALL="${SKIP_PIP_INSTALL:-0}"
SKIP_NPM_CI="${SKIP_NPM_CI:-0}"
SKIP_MIGRATE="${SKIP_MIGRATE:-0}"
SKIP_BUILD="${SKIP_BUILD:-0}"
SKIP_HEALTHCHECK="${SKIP_HEALTHCHECK:-0}"

BACKEND_VENV="$ROOT_DIR/backend/.venv"
BACKEND_HEALTH_URL="http://127.0.0.1:8000/health"
NGINX_HEALTH_URL="http://127.0.0.1/api/health"

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[dry-run] $*"
    return 0
  fi
  "$@"
}

log() {
  echo
  echo "==> $*"
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: missing command '$cmd'." >&2
    exit 1
  fi
}

log "Preflight checks"
require_command git
require_command python3
require_command npm
require_command pm2
require_command curl

if [[ ! -d "$ROOT_DIR/.git" ]]; then
  echo "ERROR: $ROOT_DIR is not a git repository." >&2
  exit 1
fi

if [[ ! -f "$ROOT_DIR/backend/alembic.ini" ]]; then
  echo "ERROR: missing backend/alembic.ini." >&2
  exit 1
fi

if [[ ! -f "$ROOT_DIR/backend/requirements.txt" ]]; then
  echo "ERROR: missing backend/requirements.txt." >&2
  exit 1
fi

if [[ ! -f "$ROOT_DIR/package.json" ]]; then
  echo "ERROR: missing package.json." >&2
  exit 1
fi

if [[ ! -d "$BACKEND_VENV" ]]; then
  echo "ERROR: missing Python venv at $BACKEND_VENV." >&2
  echo "Create it first: cd \"$ROOT_DIR/backend\" && python3 -m venv .venv" >&2
  exit 1
fi

cd "$ROOT_DIR"

log "Sync code from origin/$BRANCH"
run git fetch --all --prune
run git checkout "$BRANCH"
run git reset --hard "origin/$BRANCH"

log "Install backend dependencies"
if [[ "$SKIP_PIP_INSTALL" != "1" ]]; then
  # shellcheck disable=SC1091
  source "$BACKEND_VENV/bin/activate"
  run pip install -r "$ROOT_DIR/backend/requirements.txt"
else
  echo "Skipping pip install (SKIP_PIP_INSTALL=1)"
fi

log "Run database migrations"
if [[ "$SKIP_MIGRATE" != "1" ]]; then
  # shellcheck disable=SC1091
  source "$BACKEND_VENV/bin/activate"
  run env PYTHONPATH=backend alembic -c backend/alembic.ini upgrade head
else
  echo "Skipping alembic migrations (SKIP_MIGRATE=1)"
fi

log "Install frontend dependencies"
if [[ "$SKIP_NPM_CI" != "1" ]]; then
  run npm ci --legacy-peer-deps
else
  echo "Skipping npm ci (SKIP_NPM_CI=1)"
fi

log "Build frontend"
if [[ "$SKIP_BUILD" != "1" ]]; then
  run npm run build
else
  echo "Skipping frontend build (SKIP_BUILD=1)"
fi

log "Restart PM2 services"
run pm2 restart edi-backend --update-env
run pm2 restart edi-frontend --update-env
run pm2 save

log "Health checks"
if [[ "$SKIP_HEALTHCHECK" != "1" ]]; then
  run curl -fsS "$BACKEND_HEALTH_URL"
  run curl -fsS "$NGINX_HEALTH_URL"
else
  echo "Skipping health checks (SKIP_HEALTHCHECK=1)"
fi

log "Deploy completed successfully"
echo "Branch: $BRANCH"
echo "Backend health: $BACKEND_HEALTH_URL"
echo "Nginx health: $NGINX_HEALTH_URL"
echo
echo "Current PM2 status:"
run pm2 status
