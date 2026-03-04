# OpenAPI 运维 Runbook（本地双环境 + 压测）

## 1. 目标

本 Runbook 用于在本地快速模拟企业级部署基础：
- 生产与沙箱物理隔离（独立 API + 独立 PostgreSQL）
- 独立凭证与配置
- 可执行的基础压测脚本

配套文档：
- Nginx 网关模板：`deploy/nginx/openapi-gateway.conf`
- 白名单灰度流程：`docs/openapi/WHITELIST-CANARY-ROLLOUT.md`
- SLO 指标定义：`docs/openapi/SLO-DASHBOARD-METRICS.md`

## 2. 本地双环境启动

在项目根目录执行：

```bash
docker compose -f docker-compose.openapi.yml up -d --build
```

服务端口：
- Production API: `http://localhost:8000`
- Sandbox API: `http://localhost:8001`
- Prod DB: `localhost:5433`
- Sandbox DB: `localhost:5434`

健康检查：

```bash
curl http://localhost:8000/v1/meta/health
curl http://localhost:8001/v1/meta/health
```

## 3. OAuth 初始化与验证

### 3.1 创建 OAuth client（production）

```bash
curl -X POST http://localhost:8000/v1/oauth/clients \
  -H 'x-admin-key: prod-admin-key' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'name=prod-partner-a&scopes=transactions:read integrations:write&environment=production'
```

### 3.2 获取 token

```bash
curl -X POST http://localhost:8000/v1/oauth/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=client_credentials&client_id=<client_id>&client_secret=<client_secret>'
```

## 4. 环境隔离验证

- 用 `environment=production` 的 client 调用 sandbox 事件推送，应返回 `403`。
- 用 `environment=sandbox` 的 client 调用 production 事件推送，应返回 `403`。

## 5. 请求防护策略

通过环境变量配置：
- `API_IP_ALLOWLIST`: 逗号分隔 IP 白名单
- `API_MAX_REQUEST_SIZE_BYTES`: 请求体字节上限

建议：
- 生产默认开启白名单
- 请求体上限按业务数据评估，通常 1-5MB

## 6. 压测

安装 k6 后执行：

```bash
k6 run scripts/loadtest/openapi-k6.js \
  -e BASE_URL=http://localhost:8000 \
  -e CLIENT_ID=openapi-default-client \
  -e CLIENT_SECRET=openapi-default-secret
```

默认阈值：
- `http_req_failed < 1%`
- `p95 < 500ms`

## 7. 日常运维检查清单

1. API 健康：`/v1/meta/health`
2. 版本确认：`/v1/meta/version`
3. 错误率：近 5 分钟 5xx 占比
4. 鉴权：token 获取成功率
5. 配额：是否有异常 client 快速耗尽
6. 关联命中：`linked/ambiguous` 比例趋势

## 8. 回滚建议

1. 禁用新 client：`PUT /v1/oauth/clients/{id}/status` -> `disabled`
2. 紧急轮换 secret：`POST /v1/oauth/clients/{id}/rotate-secret`
3. 临时收紧入口：缩小 `API_IP_ALLOWLIST`
4. 仅限必要时：关闭新集成入口并保留查询接口
