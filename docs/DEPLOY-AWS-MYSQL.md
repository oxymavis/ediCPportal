# 数据库改为 MySQL + 部署到 AWS 需改动清单

## 一、数据库改为 MySQL

当前后端使用 **SQLAlchemy** + 默认 **SQLite**，文档与依赖中面向 **PostgreSQL**（`psycopg2-binary`）。改为 MySQL 需动以下部分。

### 1. 依赖与驱动


| 文件                                                   | 改动                                                                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [backend/requirements.txt](backend/requirements.txt) | 将 `psycopg2-binary` 改为 MySQL 驱动：`PyMySQL` 或 `mysqlclient`。连接串对应为 `mysql+pymysql://...` 或 `mysql+mysqldb://...`。 |


### 2. 配置与示例环境变量


| 文件                                                    | 改动                                                                                            |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [backend/app/core/config.py](backend/app/core.config) | 默认 `database_url` 仍可为 `sqlite:///./dev.db`（本地开发）；生产通过环境变量 `DATABASE_URL` 覆盖为 MySQL 即可，无需改默认值。 |
| [backend/.env.example](backend/.env.example)          | 将 `DATABASE_URL` 示例改为 MySQL，例如：`mysql+pymysql://user:password@localhost:3306/edi_portal`。     |
| [.env.example](.env.example)                          | 同上，根目录示例中的 `DATABASE_URL` 注释与示例改为 MySQL。                                                      |


### 3. 迁移与 DDL


| 文件                                                         | 改动                                                                                                                                                                                                                                      |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [backend/alembic.ini](backend/alembic.ini)                 | 第 3 行 `sqlalchemy.url` 当前为 `postgresql://...`。Alembic 的 [backend/alembic/env.py](backend/alembic/env.py) 已用 `settings.database_url` 覆盖，因此只要 `.env` 配成 MySQL 即会连 MySQL。可选：把 `alembic.ini` 里的示例改为 `mysql+pymysql://...` 或加注释说明以 MySQL 为准。 |
| [backend/alembic/versions/*.py](backend/alembic/versions/) | 现有迁移使用 `sa.JSON()`、`sa.String()`、`sa.DateTime()` 等，SQLAlchemy 会按 MySQL dialect 生成 DDL；MySQL 5.7+ 支持 JSON 类型，一般无需改迁移内容。若未来新增迁移，注意 MySQL 的 JSON 列在 8.0.13 之前不支持 `DEFAULT` 字面量，需避免或按 dialect 分支。                                           |


### 4. 应用内裸 SQL（需重点核对）


| 文件                                         | 改动                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [backend/app/main.py](backend/app/main.py) | `lifespan` 内有一批 `text("ALTER TABLE ... ADD COLUMN ... JSON DEFAULT '{}'")` 等裸 SQL。在 **MySQL 8.0.13 以下**，JSON 列不能使用 `DEFAULT '{}'`，会报错。可选方案：（1）改为按 `engine.dialect.name == 'mysql'` 分支，MySQL 用 `TEXT` 或 `JSON` 且不设 DEFAULT，或（2）保证生产使用 MySQL 8.0.13+ 并使用兼容语法；（3）或逐步用 Alembic 迁移替代这些启动时 ALTER，避免裸 SQL。 |


### 5. 测试


| 文件                                                     | 改动                                                                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| [backend/tests/conftest.py](backend/tests/conftest.py) | 当前 `DATABASE_URL` 默认为 `sqlite:///./test.db`。若希望 CI/本地测 MySQL，可增加从环境变量读取 `DATABASE_URL`（如 `mysql+pymysql://...`），未设置时仍用 SQLite。 |


### 6. 文档


| 文件                                                                                                                                                                                                                       | 改动                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| [backend/README.md](backend/README.md)、[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)、[docs/DEPLOY.md](docs/DEPLOY.md)、[docs/DATA-AND-LOGIN.md](docs/DATA-AND-LOGIN.md)、[docs/DB-INIT-AND-SEED.md](docs/DB-INIT-AND-SEED.md) 等 | 将所有“PostgreSQL”“postgresql://”的说明与示例改为 MySQL / `mysql+pymysql://...`（或同时写两种示例）。 |


---

## 二、部署到亚马逊 AWS

当前有 [backend/Dockerfile](backend/Dockerfile)，前端为 Next.js，文档中有 Docker / Vercel 等说明。部署到 AWS 时涉及以下部分。

### 1. 架构与资源（需在 AWS 侧配置，非代码）

- **数据库**：使用 **RDS for MySQL**，创建实例后得到 endpoint，填入 `DATABASE_URL`（如 `mysql+pymysql://user:pass@xxx.rds.amazonaws.com:3306/edi_portal`）。
- **后端**：用现有 Dockerfile 构建镜像，推送到 **ECR**，再以 **ECS (Fargate)** 或 **EC2** 运行；对外经 **ALB** 或 **API Gateway** 暴露 HTTPS。
- **前端**：可选 **Amplify**、**S3 + CloudFront** 或 **EC2** 跑 `npm run start`。
- **文件存储**：当前证书、规格书等使用 [backend/app/services/storage.py](backend/app/services/storage.py) 的本地路径 `local_storage_path`。多实例或无状态部署时，本地盘不共享，需改为 **S3** 等对象存储，并在配置中增加 S3 bucket/路径，或在后续迭代中抽象存储接口（本地/S3 可切换）。

### 2. 前端


| 文件                                 | 改动                                                                                                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 构建/运行环境变量                          | 设置 `NEXT_PUBLIC_API_BASE_URL` 为 AWS 上后端公网地址（如 `https://api.yourdomain.com` 或 ALB/CloudFront URL）。前端通过该变量请求后端，不再依赖本地代理。                                                                                             |
| [next.config.mjs](next.config.mjs) | 当前 `rewrites` 将 `/v1/*`、`/docs` 等指向 `http://127.0.0.1:8000`，仅适合本地或同机部署。生产若前后端分离（前端在 Amplify/S3，后端在 ECS），应依赖 `NEXT_PUBLIC_API_BASE_URL` 直连后端，可考虑：生产构建时禁用或替换这些 rewrites（例如用环境变量区分 destination），避免请求被错误代理到 127.0.0.1。 |


### 3. 后端


| 文件                                                       | 改动                                                                                                                                                                                                                     |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 运行环境变量                                                   | 在 ECS 任务定义或 EC2 环境中配置：`DATABASE_URL`（RDS MySQL）、`AUTH_SECRET`、`CORS_ORIGINS`（含前端域名，如 `https://your-app.amplifyapp.com`）、`APP_ENV=production` 等；若使用 S3 存储，增加 S3 相关配置（在未改 storage 层前可先保留 `LOCAL_STORAGE_PATH`，单实例时用挂载卷）。 |
| [backend/app/core/config.py](backend/app/core/config.py) | 若引入 S3，在此增加 S3 bucket、region 等配置项并从环境变量读取。                                                                                                                                                                             |
| [backend/Dockerfile](backend/Dockerfile)                 | 现有即可用于 ECR/ECS；若需多阶段构建或非 root 用户运行，可在此扩展。                                                                                                                                                                              |


### 4. 存储与文件访问（可选但推荐）


| 文件                                                                 | 改动                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [backend/app/services/storage.py](backend/app/services/storage.py) | 当前仅写本地路径。若部署到 AWS 且多实例/无状态：抽象“存储后端”（本地 vs S3），根据配置选择；上传/下载改为 S3 API，`file_path` 可存 S3 key 或 URL。证书与规格书下载接口 [backend/app/routers/certificates.py](backend/app/routers/certificates.py)、[backend/app/routers/specifications.py](backend/app/routers/specifications.py) 需改为从 S3 读流并返回。 |


### 5. 文档


| 文件                                         | 改动                                                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) 等 | 增加“部署到 AWS”小节：RDS MySQL 创建与连接、ECR/ECS 或 EC2 部署步骤、前端 Amplify/S3+CloudFront 配置、环境变量清单、以及（若已做）S3 存储配置说明。 |


---

## 三、改动关系概览

```mermaid
flowchart LR
  subgraph db [MySQL 迁移]
    A[requirements.txt]
    B[.env.example / config]
    C[main.py 裸 SQL]
    D[alembic.ini 示例]
    E[docs]
  end

  subgraph aws [AWS 部署]
    F[NEXT_PUBLIC_API_BASE_URL]
    G[next.config rewrites]
    H[RDS DATABASE_URL]
    I[CORS_ORIGINS]
    J[storage 可选 S3]
    K[Dockerfile / ECR / ECS]
  end

  db --> aws
  H --> db
```



- **仅改 MySQL**：动 一、1～6，重点检查 一、4（main.py 裸 SQL）。
- **仅部署 AWS（仍用现有 DB）**：动 二、2～3 和 二、5；数据库可仍为自建 PostgreSQL/MySQL，只要 `DATABASE_URL` 在 AWS 内网或公网可访问即可。
- **MySQL + AWS 一起**：先完成 MySQL 改动并验证迁移与 seed，再按 二 配置 RDS MySQL、ECS、前端域名与环境变量；若多实例再考虑 二、4 的 S3 存储。

---

## 四、建议顺序

1. **数据库改为 MySQL**：改 requirements、.env.example、文档 → 本地用 MySQL 跑迁移与 seed → 修 main.py 中 JSON DEFAULT 与 MySQL 的兼容性（或约束生产使用 MySQL 8.0.13+）→ 再跑一次完整测试。
2. **AWS 部署**：创建 RDS MySQL、ECR/ECS 或 EC2、前端托管 → 配置所有环境变量（含 `DATABASE_URL`、`NEXT_PUBLIC_API_BASE_URL`、`CORS_ORIGINS`）→ 视需求再做 storage 与 next.config 的改造。

以上为“需要改哪些”的完整清单，不包含具体补丁或实现细节；你确认后再按需分步实施即可。
