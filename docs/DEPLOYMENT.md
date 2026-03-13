# 前后端发布指南

本文说明如何构建与发布前端（Next.js）和后端（FastAPI）。

---

## 一、环境变量

### 1.0 首次使用：初始化 .env 文件

在项目根目录执行一次即可生成缺失的 `.env`（不会覆盖已有文件）：

```bash
npm run env:init
```

- 会从 `.env.example` 复制生成根目录 `.env`（供前端与参考）
- 会从 `backend/.env.example` 复制生成 `backend/.env`（供后端加载）

后端会**始终从 `backend/` 目录读取 `backend/.env`**，与当前工作目录无关。

---

发布前在**部署环境**中配置以下变量。

### 前端（构建时 / 运行时）

| 变量 | 说明 | 示例 |
|------|------|------|
| `NEXT_PUBLIC_API_BASE_URL` | 后端 API 根地址（浏览器直连） | `https://api.yourdomain.com` |

- 根目录 `.env.example` 中有完整示例，复制为 `.env` 或 `.env.production` 后按环境修改。
- 前端构建时会内联 `NEXT_PUBLIC_*`，因此**生产构建**必须使用生产环境的后端地址。

### 后端

| 变量 | 说明 | 示例 |
|------|------|------|
| `DATABASE_URL` | 数据库连接串（生产建议 PostgreSQL） | `postgresql://user:pass@host:5432/edi_portal` |
| `AUTH_SECRET` | JWT/会话密钥，需足够随机 | 长随机字符串 |
| `CORS_ORIGINS` | 允许的前端来源，逗号分隔 | `https://yourdomain.com` |
| `EMAIL_MODE` | 邮件模式 | `mock` / 留空或 SMTP 配置 |
| 其他 | 见 `backend/.env.example`、根目录 `.env.example` | |

---

## 二、前端发布

### 2.1 本地 / 自托管（Node 服务器）

```bash
# 在项目根目录
cp .env.example .env
# 编辑 .env，设置 NEXT_PUBLIC_API_BASE_URL 为生产后端地址

npm ci
npm run build
npm run start
```

- 默认端口：`3000`。
- 生产建议使用进程管理器（如 systemd、PM2）或反向代理（Nginx）做 HTTPS 与负载均衡。

### 2.2 Vercel

1. 将仓库连接至 Vercel，选择根目录为项目目录。
2. Build Command: `npm run build`（或 `pnpm build`）。
3. Output Directory: 使用 Next.js 默认（`.next`）。
4. 在 Vercel 项目 **Environment Variables** 中配置：
   - `NEXT_PUBLIC_API_BASE_URL` = 生产后端 API 地址（如 `https://api.yourdomain.com`）。
5. 部署后，若后端与前端不同域，需在后端配置 `CORS_ORIGINS` 包含 Vercel 域名（如 `https://xxx.vercel.app`）。

---

## 三、后端发布

### 3.1 Docker（推荐）

在 **backend** 目录构建并运行：

```bash
cd backend

# 构建镜像（在 backend 目录下，确保 requirements.txt、app、alembic 等存在）
docker build -t edi-backend:latest .

# 运行（环境变量可用 .env 文件或 -e 传入）
docker run -d \
  --name edi-backend \
  -p 8000:8000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/edi_portal" \
  -e AUTH_SECRET="your-long-random-secret" \
  -e CORS_ORIGINS="https://yourdomain.com" \
  -v $(pwd)/storage:/app/storage \
  edi-backend:latest
```

- 首次部署或升级后，若使用 Alembic，需在**同一镜像或相同环境**中执行迁移后再启动服务（见下节）。
- 挂载 `storage` 可将证书、规格书等持久化到宿主机。

### 3.2 数据库迁移（生产）

使用 Alembic 时，在**能访问同一 DATABASE_URL 的环境**中执行（例如在容器内或 CI 中）：

```bash
cd backend
# 若在容器内：先进入运行中的 backend 容器，或启动一次性迁移容器
alembic -c alembic.ini upgrade head
```

也可在 Dockerfile 或启动脚本中增加 `alembic upgrade head`，再执行 `uvicorn`（按你们发布流程选择其一）。

### 3.3 直接运行（无 Docker）

适用于已有 Python 环境的服务器：

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env，填写 DATABASE_URL、AUTH_SECRET、CORS_ORIGINS 等

alembic -c alembic.ini upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

生产建议使用 Gunicorn + Uvicorn worker 或 Supervisor/ systemd 管理进程。

---

## 四、发布顺序建议

1. **先发布后端**  
   - 启动后端服务并执行迁移（若使用）。  
   - 确认健康检查：`GET /health` 或 `GET /openapi.json` 可访问。

2. **再发布前端**  
   - 使用正确的 `NEXT_PUBLIC_API_BASE_URL` 构建并部署前端。  
   - 确保后端 `CORS_ORIGINS` 包含前端域名。

3. **验证**  
   - 浏览器打开前端，登录/调用 API，确认请求指向生产后端且无 CORS 错误。

---

## 五、快速自测（本地模拟发布）

```bash
# 终端 1：后端
cd backend
docker build -t edi-backend:latest .
docker run --rm -p 8000:8000 -e AUTH_SECRET=test -e CORS_ORIGINS=http://localhost:3000 edi-backend:latest

# 终端 2：前端（使用本地后端）
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build && npm run start
```

访问 `http://localhost:3000`，确认页面能连到 `http://localhost:8000` 的后端即可。

---

## 六、ngrok 单域名 + 前后端反向代理（ediportal.ngrok.app）

通过 **Next.js 反向代理**，前端与后端共用一个域名，便于用 ngrok 暴露为 `ediportal.ngrok.app`，浏览器只访问该域名即可。

### 6.1 已做的配置

- **next.config.mjs**：`rewrites` 将 `/v1/*`、`/openapi.json`、`/docs`、`/redoc` 代理到 `http://127.0.0.1:8000`。
- **lib/api-client.ts**：当 `NEXT_PUBLIC_API_BASE_URL` 为空时使用同源（相对路径），请求由 Next 转发到后端。
- **.env.local**：`NEXT_PUBLIC_API_BASE_URL=`（空），构建时前端 API 走同源。

### 6.2 停掉占用的 3000 / 8000 端口

在终端执行（或在本机停止正在跑的前端/后端进程）：

```bash
# macOS/Linux：按 PID 结束
lsof -ti :3000 | xargs kill -9
lsof -ti :8000 | xargs kill -9
```

若有 Cursor/IDE 或 PM2 等自动重启了 3000/8000，请先在对应终端或面板里停止相关任务，再执行上述命令。

### 6.3 启动顺序

```bash
# 终端 1：后端
cd backend
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# 终端 2：前端（已用 .env.local 同源，无需再设 NEXT_PUBLIC_API_BASE_URL）
cd /path/to/edi-portal-prototypeCP
npm run start
```

前端默认端口 3000，后端 8000。本地访问：`http://localhost:3000`，API 会经 Next 代理到 8000。

### 6.4 用 ngrok 暴露为 ediportal.ngrok.app

1. 安装 [ngrok](https://ngrok.com/download)，并登录配置自定义域名 `ediportal.ngrok.app`（付费自定义域名或使用免费随机域名）。
2. 只暴露**前端端口 3000**（后端已由 Next 代理，无需单独暴露 8000）：

   ```bash
   ngrok http 3000
   ```

3. 若使用**自定义域名**（如 ediportal.ngrok.app），在 ngrok 控制台将该域名指向当前 tunnel，或执行：

   ```bash
   ngrok http 3000 --domain=ediportal.ngrok.app
   ```

4. 浏览器访问 `https://ediportal.ngrok.app`：
   - 页面由 Next（3000）提供；
   - 前端请求 `/v1/*` 等会由 Next 反向代理到本机 8000，实现前后端统一通过 ediportal.ngrok.app 访问。
