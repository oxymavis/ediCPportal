# 为什么页面没有数据？数据库与登录说明

## 原因说明

1. **所有列表接口都需要登录**  
   后端 `/v1/partners`、`/v1/certificates`、`/v1/transactions`、`/v1/notifications`、`/v1/specifications` 等接口都会校验 **Session**。未登录时返回 **401**，前端就会显示空列表。

2. **之前登录是“假登录”**  
   前端登录页原先只做本地模拟（写 localStorage），**没有调用后端**，所以没有 Session Cookie，请求接口时一直是 401，页面看起来“没有数据”。

## 已做修改

- **登录**：已改为调用后端 `POST /v1/auth/login`，成功后由后端下发 Session + CSRF Cookie，后续请求会带 Cookie，接口可正常返回数据。
- **Dashboard**：进入 `/dashboard` 时会先请求 `GET /v1/auth/me` 校验登录；若未登录（401）会跳回首页 `/`。
- **首页**：增加演示账号提示，便于验收。

## 如何看到数据

1. 打开首页：`http://localhost:3001`（或你当前使用的前端地址）。
2. 使用 **演示账号** 登录（需后端已执行种子数据）：
   - 邮箱：**demo@example.com**
   - 密码：**DemoPass1**
3. 登录成功后会进入 Dashboard，此时 Partners、Certificates、Transactions、Notifications、Specifications 等会从后端拉取并显示数据。

## 数据库与种子数据

- 后端默认使用 **SQLite**：`sqlite:///./dev.db`（文件在 backend 目录下，即 `backend/dev.db`）。
- 若未配置 `backend/.env`，启动时会自动建表，并在 **auto_seed=True**（默认）时执行 **种子数据**，包括：
  - 用户：`demo@example.com` / `DemoPass1`，`seed-legacy@example.com` / `LegacyPass1`
  - 示例 Partners、Certificates、Transactions、Notifications、Specifications 等
- 若使用 **PostgreSQL**（在 `backend/.env` 中设置 `DATABASE_URL`），请先执行迁移：  
  `cd backend && alembic upgrade head`  
  再启动后端，种子数据同样会在首次启动时写入（当表为空时）。

## 重要：前端直连后端 + CORS

- 已改为 **前端直连后端**（`NEXT_PUBLIC_API_BASE_URL=http://localhost:8001`），登录后 Cookie 由后端下发给浏览器，后续请求会带上 Cookie，列表接口才能返回数据。
- 后端默认 CORS 已包含 `http://localhost:3001`，允许前端在 3001 端口请求 8001。
- 修改 `.env.local` 或后端端口后，需 **重新构建前端**（`npm run build`）并重启前端，否则仍会用旧配置。

## 若仍无数据

1. **确认后端已启动**（如 `uvicorn` 跑在 8001），且无报错。
2. **手动执行一次种子**（建表 + 写入演示数据）：
   ```bash
   cd backend && python3 -m app.cli init
   ```
3. **重新构建并启动前端**（使 `NEXT_PUBLIC_API_BASE_URL=http://localhost:8001` 生效）：
   ```bash
   npm run build && PORT=3001 npm run start
   ```
4. 打开 **http://localhost:3001**，用 **demo@example.com / DemoPass1** 登录（不要直接打开 `/dashboard`）。
5. 若仍无数据，在浏览器开发者工具 → Network 中查看：登录接口是否 200、是否返回 `Set-Cookie`；之后请求 `/v1/partners` 等是否带 Cookie 且返回 200。
