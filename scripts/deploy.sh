#!/usr/bin/env bash
# 前后端发布脚本（本地/自托管）
# 用法: ./scripts/deploy.sh [frontend|backend|both]

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

build_frontend() {
  echo "==> 安装前端依赖..."
  npm install
  echo "==> 构建前端..."
  npm run build
  echo "==> 前端构建完成。启动: npm run start"
}

run_backend_docker() {
  echo "==> 构建后端 Docker 镜像..."
  cd "$ROOT/backend"
  docker build -t edi-backend:latest .
  echo "==> 运行后端容器示例:"
  echo "  docker run -d --name edi-backend -p 8000:8000 \\"
  echo "    -e AUTH_SECRET=your-secret -e CORS_ORIGINS=http://localhost:3000 \\"
  echo "    -e DATABASE_URL=postgresql://... edi-backend:latest"
}

run_backend_local() {
  echo "==> 后端本地运行（需已安装 Python 依赖）:"
  echo "  cd backend && source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000"
}

case "${1:-both}" in
  frontend) build_frontend ;;
  backend)
    if command -v docker &>/dev/null; then
      run_backend_docker
    else
      run_backend_local
    fi
    ;;
  both)
    build_frontend
    if command -v docker &>/dev/null; then
      run_backend_docker
    else
      run_backend_local
    fi
    ;;
  *) echo "用法: $0 [frontend|backend|both]"; exit 1 ;;
esac
