# EDI Portal - 部署与发布

## 环境要求

- Node.js 18+
- pnpm（或 npm / yarn）
- PostgreSQL 数据库（用于持久化；可选，不配置则使用内存存储）

## 环境变量

复制 `.env.example` 为 `.env` 并填写：

```bash
cp .env.example .env
```

| 变量 | 说明 | 必填 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 连接串。不设置时使用内存存储，重启数据丢失 | 生产建议必填 |

示例：

- 本地：`postgresql://user:password@localhost:5432/edi_portal`
- [Neon](https://neon.tech)：在控制台创建项目后复制连接串（带 `?sslmode=require`）
- [Vercel Postgres](https://vercel.com/storage/postgres)：在 Vercel 项目 → Storage → Postgres 中创建并复制 `POSTGRES_URL`

## 本地开发

```bash
# 安装依赖
pnpm install

# 生成 Prisma Client（无需数据库也可执行）
pnpm db:generate

# 有数据库时：推送到数据库（创建/更新表，不生成迁移文件）
pnpm db:push

# 有数据库时：执行种子数据（UNIS 规范 + 示例伙伴/证书/通知）
pnpm db:seed

# 启动开发服务器
pnpm dev
```

访问 http://localhost:3000。未配置 `DATABASE_URL` 时，API 使用内存数据；配置后使用 PostgreSQL。

## 生产构建

```bash
pnpm build
```

会先执行 `prisma generate`，再执行 `next build`。部署前需在目标环境配置 `DATABASE_URL`。

## 部署到 Vercel

### 1. 连接仓库

1. 登录 [Vercel](https://vercel.com)，导入 Git 仓库（GitHub/GitLab/Bitbucket）。
2. 选择本仓库，框架预设为 Next.js，无需改构建命令。

### 2. 配置数据库（推荐）

**方式 A：Vercel Postgres**

1. 在项目页面打开 **Storage** → **Create Database** → **Postgres**。
2. 创建完成后，在 **Environment Variables** 中会自动添加 `POSTGRES_URL` 等。
3. 在项目 **Settings → Environment Variables** 中新增：
   - Name: `DATABASE_URL`
   - Value: 复制 Storage 中 Postgres 的 **Connection string**（或使用 `POSTGRES_URL` 若 Prisma 已支持该名称）。
4. 若 Vercel 提供的变量名是 `POSTGRES_URL`，可在 Vercel 中添加变量 `DATABASE_URL` = `POSTGRES_URL` 的值，或在本项目中使用 `POSTGRES_URL` 并在代码中读取（需改 `prisma/schema.prisma` 的 `url` 为 `env("POSTGRES_URL")`）。

**方式 B：Neon**

1. 在 [Neon](https://neon.tech) 创建项目，复制连接串。
2. 在 Vercel 项目 **Settings → Environment Variables** 添加：
   - `DATABASE_URL` = 你的 Neon 连接串（含 `?sslmode=require`）。

### 3. 构建与迁移

- **Build Command**：保持默认 `pnpm run build`（已含 `prisma generate`）。
- 首次使用数据库时，需执行迁移并（可选）执行种子：
  - 在 Vercel 项目 **Settings** 中可配置 **Build Command** 为：`prisma generate && prisma migrate deploy && next build`（需先本地执行一次 `prisma migrate dev --name init` 生成迁移文件并提交）。
  - 或使用 **Push** 方式：本地在配置好 `DATABASE_URL` 后执行 `pnpm db:push`，再部署；生产环境仅需 `prisma generate`（表结构已由 push 同步）。

### 4. 部署

推送代码到主分支或点击 **Redeploy**。构建成功后即可通过 Vercel 提供的 URL 访问。

### 5. 首次写入数据（可选）

若使用迁移并希望有初始数据，可在 Vercel 的 **Settings → Functions** 或本地连接生产库执行一次：

```bash
DATABASE_URL="你的生产库连接串" pnpm db:seed
```

## 其他平台（Docker / 自托管）

- 构建：`pnpm install && pnpm build`。
- 启动：`pnpm start`（或 `node .next/standalone/server.js` 若启用 Next.js standalone）。
- 务必设置环境变量 `DATABASE_URL`，并在首次部署后执行 `prisma migrate deploy` 或 `prisma db push`，以及按需执行 `pnpm db:seed`。

## 数据库迁移（可选）

若使用迁移工作流而非 `db push`：

```bash
# 本地首次生成迁移（需 DATABASE_URL）
pnpm exec prisma migrate dev --name init

# 生产环境应用迁移（CI 或部署后执行）
pnpm db:migrate
```

提交 `prisma/migrations/` 目录到 Git，部署时在构建或启动前执行 `prisma migrate deploy`。
