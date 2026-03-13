#!/usr/bin/env bash
# 环境变量初始化：若 .env 不存在则从 .env.example 复制（不覆盖已有 .env）
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "已创建 .env（从 .env.example 复制），请按需修改。"
else
  echo "根目录 .env 已存在，跳过。"
fi

if [[ ! -f backend/.env ]]; then
  cp backend/.env.example backend/.env
  echo "已创建 backend/.env（从 backend/.env.example 复制），请按需修改。"
else
  echo "backend/.env 已存在，跳过。"
fi

echo "环境变量文件就绪。前端使用根目录 .env，后端使用 backend/.env。"
