# EDI Portal 技术架构说明

本文档描述 UNIS EDI Portal 的技术栈、整体架构、关键设计及部署方式。架构图见 **`docs/architecture-diagram.svg`**（矢量图）。

---

## 一、技术栈总览

| 层次 | 技术选型 | 版本/说明 |
|------|----------|-----------|
| **前端框架** | Next.js | 16.x，App Router |
| **UI 与语言** | React、TypeScript | React 19，TypeScript 5 |
| **样式** | Tailwind CSS、PostCSS | Tailwind 4，tw-animate |
| **UI 组件** | Radix UI、shadcn 风格 | 无障碍、可定制 |
| **表单与校验** | React Hook Form、Zod | 服务端/客户端校验 |
| **图表与展示** | Recharts、date-fns、lucide-react | 仪表盘与图标 |
| **后端框架** | FastAPI | 异步、OpenAPI 自动文档 |
| **运行时** | Uvicorn (ASGI) | 标准 ASGI 服务器 |
| **ORM 与数据库** | SQLAlchemy 2、Alembic | 支持 SQLite / PostgreSQL |
| **认证与安全** | JWT、Session/Cookie、passlib(bcrypt)、python-jose | 登录、CSRF、密码哈希 |
| **配置与校验** | pydantic、pydantic-settings | 环境变量与请求体校验 |
| **测试** | pytest、httpx | 后端接口测试 |

---

## 二、整体架构

### 2.1 架构模式

- **前后端分离 + 可选同源代理**  
  - 前端：Next.js 独立部署（端口 3000），可直连后端 API（端口 8000）。  
  - 可选：将 `NEXT_PUBLIC_API_BASE_URL` 留空，由 Next 的 `rewrites` 把 `/v1/*`、`/openapi.json`、`/docs`、`/redoc` 代理到后端，实现**同源访问**，便于单域名（如 ngrok）或减少 CORS 配置。

- **后端分层**  
  - **Routers**：HTTP 入口，挂载在 FastAPI 上（如 `/v1/auth`、`/v1/partners`）。  
  - **Services**：业务逻辑（deps、mappers、storage、email、linking、validation）。  
  - **Models / Schemas**：SQLAlchemy 模型与 Pydantic 请求/响应模型。  
  - **Core**：配置（config）、安全（security）、中间件（http）。

- **数据库**  
  - 开发默认 SQLite；生产推荐 PostgreSQL。  
  - 使用 Alembic 做迁移；应用启动时可选自动建表与种子数据（`auto_create_tables`、`auto_seed`）。

### 2.2 请求与数据流

1. **浏览器** → 访问 Next.js（如 `https://example.com` 或 `localhost:3000`）。  
2. **页面与路由**：Next.js App Router 渲染页面（SSR/客户端），前端通过 `lib/api-client.ts` 调用后端。  
3. **API 调用**：  
   - 同源模式：请求发往同域（如 `/v1/auth/login`），Next 将请求 **rewrite** 到 `http://127.0.0.1:8000`。  
   - 直连模式：请求直接发往 `NEXT_PUBLIC_API_BASE_URL`（如 `http://localhost:8000`）。  
4. **后端**：Uvicorn 接收请求 → CORS → 安全头 → 限流（生产）→ 审计/追踪 → 路由 → 依赖注入（DB Session、当前用户等）→ 业务逻辑 → 返回 JSON。  
5. **数据持久化**：业务层通过 SQLAlchemy Session 访问数据库；文件类资源使用 `LOCAL_STORAGE_PATH` 本地存储。

---

## 三、前端技术说明

### 3.1 框架与构建

- **Next.js 16**：App Router（`app/` 目录）、服务端/客户端组件、内置 API 代理（rewrites）。  
- **开发**：`npm run dev` 使用 Webpack 模式（`next dev --webpack`），避免 Turbopack 在部分环境下的兼容问题。  
- **生产**：`npm run build` + `npm run start`，可部署到 Node 自托管或 Vercel。

### 3.2 前端关键依赖

- **React 19**、**TypeScript**：类型安全与现代 React 特性。  
- **Tailwind CSS 4**：原子类样式、主题变量（如 `--primary`、`--background`）。  
- **Radix UI**：无样式基础组件（Dialog、Select、Tabs 等），满足无障碍与可定制。  
- **React Hook Form + Zod**：表单状态与校验。  
- **Recharts**：仪表盘图表（如交易趋势）。  
- **统一 API 层**：`lib/api-client.ts` 封装 `fetch`、超时、CSRF、Cookie 携带与统一响应类型。

### 3.3 路由与页面结构

- **`/`**：登录/注册页（LoginForm / RegisterForm）。  
- **`/dashboard`**：需登录；通过 `getMe()` 校验，成功后渲染 DashboardLayout；支持 `?tab=` 切换子模块（overview、partners、certificates、specifications、api-docs、connection-testing、transactions、notifications）。  
- **加载与错误**：`app/loading.tsx` 全局加载态；Dashboard 内对 `getMe` 做超时与错误态展示。

---

## 四、后端技术说明

### 4.1 框架与运行时

- **FastAPI**：异步 ASGI、自动 OpenAPI（Swagger UI `/docs`、ReDoc `/redoc`）、请求校验与依赖注入。  
- **Uvicorn**：ASGI 服务器，开发时 `--reload`，生产可配合 Gunicorn + Uvicorn worker。

### 4.2 中间件与安全

- **CORS**：`CORSMiddleware`，允许配置的 `CORS_ORIGINS`（如前端域名）。  
- **安全头**：SecurityHeadersMiddleware（X-Content-Type-Options、X-Frame-Options、Referrer-Policy 等）。  
- **请求守卫**：RequestGuardMiddleware（可选 IP 白名单）。  
- **限流**：RateLimitMiddleware，生产启用；开发环境（`APP_ENV=development`）关闭，避免本地 429。  
- **审计与追踪**：TraceAndAuditMiddleware，记录请求与审计信息。

### 4.3 认证与授权

- **登录**：`POST /v1/auth/login`，校验密码（passlib + bcrypt），写 Session/Cookie 与 CSRF Cookie。  
- **会话**：基于 Cookie 的 Session，JWT 存于服务端或 Cookie；`get_current_user` 从 Session/Token 解析当前用户。  
- **CSRF**：写请求需携带 `x-csrf-token`，值与 Cookie 中 `edi_csrf` 一致。  
- **OAuth 2**：`/v1/oauth/*` 支持客户端凭证等流程，与 API 配额、API Key 回退配合。

### 4.4 数据层

- **SQLAlchemy 2**：声明式模型（`app/models/models.py`），25 张表；关系与外键见 ER 图与 `docs/ER-TABLES-LIST.md`。  
- **会话管理**：`get_db()` 依赖注入，请求内单 Session，请求结束关闭。  
- **迁移**：Alembic，`alembic upgrade head` 应用于生产。  
- **种子**：`seed_if_empty` 在空库时写入演示用户与基础数据。

### 4.5 API 设计风格

- **RESTful**：资源路径如 `/v1/partners`、`/v1/transactions`、`/v1/notifications`。  
- **统一响应**：`{ "success": true, "data": ... }` 或 `{ "success": false, "error": "...", "code": "..." }`。  
- **版本前缀**：所有接口在 `/v1` 下，便于将来多版本并存。

---

## 五、部署与运行环境

### 5.1 开发

- **前端**：`npm run dev`（Next 3000）。  
- **后端**：`npm run dev:backend` 或 `cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000`。  
- **环境变量**：根目录 `.env`（前端）+ `backend/.env`（后端），可用 `npm run env:init` 从 example 初始化。

### 5.2 生产

- **前端**：构建 `npm run build`，运行 `npm run start`；或部署到 Vercel。  
- **后端**：推荐 Docker（`backend/Dockerfile`），或本机 Uvicorn/Gunicorn；需配置 `DATABASE_URL`（PostgreSQL）、`AUTH_SECRET`、`CORS_ORIGINS` 等。  
- **数据库**：生产使用 PostgreSQL；Alembic 迁移在发布流程中执行。  
- 详见 **`docs/DEPLOYMENT.md`**。

---

## 六、架构图说明

**`docs/architecture-diagram.svg`** 为矢量架构图，包含：

- **用户 → 浏览器**：访问前端。  
- **Next.js**：页面、静态资源、API 代理（rewrites）。  
- **FastAPI**：Routers、Services、Core、中间件。  
- **数据层**：SQLAlchemy → SQLite/PostgreSQL；本地文件存储（证书、规格等）。  
- **外部**：可选 SMTP、ngrok 等。

图中标出主要技术栈与数据流向，便于评审与交接。

---

## 七、文档与图索引

| 文档/图 | 说明 |
|---------|------|
| **docs/TECH-ARCHITECTURE.md** | 本文档，技术架构说明 |
| **docs/architecture-diagram.svg** | 整体架构图（矢量） |
| **docs/DEPLOYMENT.md** | 前后端发布与环境变量 |
| **docs/ER-diagram-detailed.svg** | 数据库详细 ER 图（25 表字段与主外键） |
| **docs/ER-TABLES-LIST.md** | 表清单与字段说明 |
