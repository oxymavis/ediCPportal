#!/usr/bin/env python3
"""生成技术架构图（矢量 SVG）。"""
import os
import xml.sax.saxutils as sax

def esc(s):
    return sax.escape(str(s))

def main():
    w, h = 900, 620
    lines = []
    lines.append('<?xml version="1.0" encoding="UTF-8"?>')
    lines.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">')
    lines.append("  <style>")
    lines.append("    .title { font: bold 18px sans-serif; fill: #1565c0; }")
    lines.append("    .layer { font: bold 12px sans-serif; fill: #37474f; }")
    lines.append("    .box { stroke: #1565c0; stroke-width: 2; fill: #f0f4f8; rx: 8; }")
    lines.append("    .box-front { stroke: #00897b; fill: #e0f2f1; }")
    lines.append("    .box-back { stroke: #546e7a; fill: #eceff1; }")
    lines.append("    .text { font: 11px sans-serif; fill: #333; }")
    lines.append("    .text-bold { font: bold 11px sans-serif; fill: #333; }")
    lines.append("    .arrow { stroke: #666; stroke-width: 1.5; fill: none; marker-end: url(#arrow); }")
    lines.append("  </style>")
    lines.append('  <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><polygon points="0 0, 8 4, 0 8" fill="#666"/></marker></defs>')

    # Title
    lines.append(f'  <text x="{w/2}" y="28" text-anchor="middle" class="title">EDI Portal 技术架构图</text>')

    # Layer labels and boxes (from top to bottom: User, Frontend, Backend, Data)
    # 1. User / Browser
    lines.append('  <text x="30" y="58" class="layer">用户层</text>')
    lines.append('  <rect x="30" y="64" width="840" height="52" class="box-back"/>')
    lines.append('  <text x="50" y="88" class="text">浏览器 (Chrome / Safari / ...) → 访问前端 (HTTPS / localhost:3000)</text>')

    # 2. Frontend - Next.js
    lines.append('  <text x="30" y="148" class="layer">前端 (Next.js)</text>')
    lines.append('  <rect x="30" y="154" width="410" height="160" class="box-front"/>')
    lines.append('  <text x="50" y="178" class="text-bold">Next.js 16 · App Router</text>')
    lines.append('  <text x="50" y="198" class="text">React 19, TypeScript 5, Tailwind CSS 4</text>')
    lines.append('  <text x="50" y="218" class="text">Radix UI, React Hook Form, Zod, Recharts</text>')
    lines.append('  <text x="50" y="238" class="text">lib/api-client.ts (fetch + CSRF + 超时)</text>')
    lines.append('  <text x="50" y="258" class="text">rewrites: /v1/* → 后端 8000 (同源代理)</text>')
    lines.append('  <text x="50" y="278" class="text">路由: / (登录), /dashboard?tab=...</text>')

    # 3. Backend - FastAPI
    lines.append('  <text x="460" y="148" class="layer">后端 (FastAPI)</text>')
    lines.append('  <rect x="460" y="154" width="410" height="160" class="box"/>')
    lines.append('  <text x="480" y="178" class="text-bold">FastAPI · Uvicorn (ASGI)</text>')
    lines.append('  <text x="480" y="198" class="text">中间件: CORS, 安全头, 限流(生产), 审计</text>')
    lines.append('  <text x="480" y="218" class="text">Routers: auth, partners, certificates, transactions,</text>')
    lines.append('  <text x="480" y="238" class="text">notifications, specifications, oauth, connection_testing...</text>')
    lines.append('  <text x="480" y="258" class="text">Services: deps, mappers, storage, email, security</text>')
    lines.append('  <text x="480" y="278" class="text">认证: Session/Cookie + JWT, CSRF, passlib(bcrypt)</text>')

    # 4. Data
    lines.append('  <text x="30" y="348" class="layer">数据层</text>')
    lines.append('  <rect x="30" y="354" width="410" height="120" class="box-back"/>')
    lines.append('  <text x="50" y="378" class="text-bold">SQLAlchemy 2 · Alembic</text>')
    lines.append('  <text x="50" y="398" class="text">开发: SQLite (dev.db) | 生产: PostgreSQL</text>')
    lines.append('  <text x="50" y="418" class="text">25 张表 (users, partners, transactions, api_* ...)</text>')
    lines.append('  <text x="50" y="438" class="text">本地文件: backend/storage (证书、规格书等)</text>')

    lines.append('  <rect x="460" y="354" width="410" height="120" class="box-back"/>')
    lines.append('  <text x="480" y="378" class="text-bold">配置与扩展</text>')
    lines.append('  <text x="480" y="398" class="text">pydantic-settings: backend/.env (DATABASE_URL, AUTH_SECRET,</text>')
    lines.append('  <text x="480" y="418" class="text">CORS_ORIGINS, EMAIL_MODE, LOCAL_STORAGE_PATH...)</text>')
    lines.append('  <text x="480" y="438" class="text">可选: SMTP 邮件, ngrok 单域名暴露</text>')

    # Arrows
    # User -> Frontend
    lines.append('  <path d="M 250 64 L 250 154" class="arrow"/>')
    lines.append('  <text x="255" y="112" class="text" font-size="9">HTTP</text>')
    # Frontend -> Backend (proxy or direct)
    lines.append('  <path d="M 440 234 L 460 234" class="arrow"/>')
    lines.append('  <text x="445" y="228" class="text" font-size="9">REST /v1/*</text>')
    # Backend -> Data
    lines.append('  <path d="M 665 314 L 665 354" class="arrow"/>')
    lines.append('  <text x="670" y="338" class="text" font-size="9">ORM</text>')
    lines.append('  <path d="M 250 314 L 250 354" class="arrow"/>')
    lines.append('  <text x="255" y="338" class="text" font-size="9">Session</text>')

    # Legend
    lines.append('  <rect x="30" y="500" width="840" height="100" fill="#fafbfc" stroke="#ddd" rx="4"/>')
    lines.append('  <text x="50" y="528" class="layer">图例</text>')
    lines.append('  <text x="50" y="550" class="text">前端: Next.js 提供页面与静态资源，并将 /v1/* 等代理到后端，实现同源或直连。</text>')
    lines.append('  <text x="50" y="568" class="text">后端: FastAPI 提供 REST API、OpenAPI 文档(/docs、/redoc)、认证与会话；生产可启用限流与 IP 白名单。</text>')
    lines.append('  <text x="50" y="586" class="text">数据: SQLAlchemy 访问关系库；Alembic 管理迁移；本地目录存储证书与规格文件。</text>')

    lines.append("</svg>")
    return "\n".join(lines)

if __name__ == "__main__":
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    path = os.path.join(base, "docs", "architecture-diagram.svg")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(main())
    print("Written:", path)
