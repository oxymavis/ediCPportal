# OpenAPI 企业级测试用例（详细版）

## 1. 文档目的

用于上线前全量验证 OpenAPI 平台能力，覆盖：
- 认证授权（OAuth2）
- 网关治理（Nginx 限流、白名单、请求体限制）
- 业务接口（partners/certificates/specifications/transactions/notifications/integrations）
- 交易关联链路（945↔940、856↔850、214↔204）
- 可观测与 SLO 验收
- 灰度发布与回滚

## 2. 测试范围与层级

- L1 单元测试：核心规则、校验器、权限判断
- L2 集成测试：API + DB + 中间件
- L3 端到端测试：前端 + 后端 + 网关
- L4 生产演练：灰度发布 + 监控告警 + 回滚

## 3. 环境与前置

环境：
- Sandbox: `http://localhost:8001`
- Production: `http://localhost:8000`

基础命令：
```bash
docker compose -f docker-compose.openapi.yml up -d --build
cd backend && .venv/bin/python -m pytest -q
```

前置数据：
1. 创建 OAuth admin key（`OAUTH_ADMIN_KEY`）
2. 创建 3 类 client：
- `client_readonly`：`transactions:read partners:read`
- `client_rw`：`partners:read partners:write integrations:write transactions:read`
- `client_sandbox`：`integrations:write` + `environment=sandbox`
3. 准备 partner 样例：`WMT/TGT`
4. 准备交易样例键：`poNo/orderNo/loadNo/warehouseOrderNo/shipmentNo/bolNo`

## 4. 用例优先级定义

- P0：阻断上线
- P1：核心功能
- P2：增强能力

## 5. 详细测试用例

### 5.1 OAuth2 认证与授权

| ID | 优先级 | 场景 | 前置 | 步骤 | 预期 |
|---|---|---|---|---|---|
| OAUTH-001 | P0 | 正常签发 token | client 有效 | 调 `/v1/oauth/token`，grant_type=client_credentials | 200，返回 access_token/token_type/expires_in/scope |
| OAUTH-002 | P0 | 错误 client_secret | client_id 有效 | 用错误 secret 获取 token | 401 |
| OAUTH-003 | P0 | 非法 grant_type | 无 | grant_type=password | 400 |
| OAUTH-004 | P0 | 越权 scope 请求 | client 仅 read | 请求 write scope | 403 |
| OAUTH-005 | P0 | token 吊销后失效 | 已有 token | `/v1/oauth/revoke` 后访问业务接口 | 401 |
| OAUTH-006 | P1 | token 过期失效 | TTL 可控 | 等待过期后访问业务接口 | 401 |
| OAUTH-007 | P1 | client 禁用 | client active | 设 status=disabled 后访问 | 新 token 401，旧 token 401 |
| OAUTH-008 | P1 | secret 轮换 | client active | rotate secret 前后分别取 token | 老 secret 失效，新 secret 生效 |
| OAUTH-009 | P1 | client 列表查询 | admin key 有效 | `GET /v1/oauth/clients` | 200，返回 client 元数据 |
| OAUTH-010 | P0 | admin key 无效 | 无 | 调 client 管理接口 | 401 |

### 5.2 Scope 权限边界

| ID | 优先级 | 场景 | 前置 | 步骤 | 预期 |
|---|---|---|---|---|---|
| SCOPE-001 | P0 | read scope 访问 GET | token: partners:read | `GET /v1/partners` | 200 |
| SCOPE-002 | P0 | read scope 访问写接口 | 同上 | `POST /v1/partners` | 403 |
| SCOPE-003 | P0 | write scope 写入成功 | token: partners:write | `POST /v1/partners` | 200 |
| SCOPE-004 | P0 | 跨模块越权阻断 | token 无 integrations:write | `POST /v1/integrations/events` | 403 |
| SCOPE-005 | P1 | cookie 用户兼容 | 已登录用户 | 访问业务接口 | 200（兼容期行为） |

### 5.3 Nginx 网关策略

| ID | 优先级 | 场景 | 前置 | 步骤 | 预期 |
|---|---|---|---|---|---|
| GW-001 | P0 | 白名单允许 | 源 IP 在 allowlist | 调任意 API | 200/业务状态码 |
| GW-002 | P0 | 白名单阻断 | 源 IP 不在 allowlist | 调任意 API | 403 |
| GW-003 | P0 | 请求体超限 | `client_max_body_size`=5MB | 发送 >5MB payload | 413 |
| GW-004 | P0 | OAuth 限流 | oauth 限流开启 | 高频调用 `/v1/oauth/token` | 429 |
| GW-005 | P1 | 全局限流 | 全局限流开启 | 高频请求业务接口 | 429 |
| GW-006 | P1 | request_id 透传 | 网关已配置 | 请求 API 并查看响应头/日志 | request_id 存在且可追踪 |
| GW-007 | P1 | 上游超时保护 | 人为延迟上游 | 超时请求 | 504/超时返回，网关不阻塞 |

### 5.4 Integrations 推送与幂等

| ID | 优先级 | 场景 | 前置 | 步骤 | 预期 |
|---|---|---|---|---|---|
| INT-001 | P0 | 单条推送成功（OAuth） | token 有 integrations:write | POST `/v1/integrations/events` | 200，返回 transactionId |
| INT-002 | P1 | 单条推送成功（x-api-key 兼容） | fallback 开启 | 带 x-api-key 推送 | 200 |
| INT-003 | P0 | 无鉴权访问 | 无 token/key | 推送接口 | 401 |
| INT-004 | P0 | schema 缺失字段 | 缺 docType 等 | 推送接口 | 422 |
| INT-005 | P0 | 幂等重放 | 同 idempotencyKey | 重复提交 | 同 transactionId |
| INT-006 | P1 | 二级去重 | 同 externalEventId+sourceSystem | 重复提交 | 命中已有记录 |
| INT-007 | P1 | batch 部分失败 | 一条合法一条非法 | 调 `/batch` | successCount 正确，逐条结果正确 |
| INT-008 | P0 | 环境隔离（sandbox client 推 production） | client env=sandbox | 推送 production 事件 | 403 |
| INT-009 | P0 | 环境隔离（prod client 推 sandbox） | client env=production | 推送 sandbox 事件 | 403 |

### 5.5 交易关联引擎

| ID | 优先级 | 场景 | 前置 | 步骤 | 预期 |
|---|---|---|---|---|---|
| LINK-001 | P0 | 856 关联 850（poNo） | 先有 850 | 推送 856 同 poNo | 自动建链，confidence 高 |
| LINK-002 | P0 | 945 关联 940（warehouseOrderNo） | 先有 940 | 推送 945 同 warehouseOrderNo | 自动建链 |
| LINK-003 | P0 | 214 关联 204（loadNo/bolNo） | 先有 204 | 推送 214 同 loadNo/bolNo | 自动建链 |
| LINK-004 | P1 | 时间窗外不建链 | 相差 >7 天 | 推送后查 related | 无自动链路 |
| LINK-005 | P1 | 多候选冲突 ambiguous | 构造并列候选 | 推送后查结果 | 不自动建链，记录 ambiguous |
| LINK-006 | P0 | related 查询正确 | 有链路 | GET `/v1/transactions/{id}/related` | upstream/downstream 正确 |

### 5.6 核心业务模块回归

| ID | 优先级 | 场景 | 前置 | 步骤 | 预期 |
|---|---|---|---|---|---|
| TP-001 | P0 | Partners CRUD | token 有权限 | 增删改查 partner | 全链路成功 |
| CERT-001 | P1 | 证书上传下载 | token 有权限 | 上传证书后下载 | 元数据正确，文件可下载 |
| SPEC-001 | P1 | 规格上传与过滤 | token 有权限 | 上传 spec，按 messageType 查询 | 结果正确 |
| TRX-001 | P0 | 交易筛选组合 | 有多样本数据 | type/status/date/partner 联合筛选 | 命中正确 |
| NOTIF-001 | P1 | 通知已读归档 | 有通知数据 | mark read/archive | 状态正确 |

### 5.7 可观测与审计

| ID | 优先级 | 场景 | 前置 | 步骤 | 预期 |
|---|---|---|---|---|---|
| OBS-001 | P0 | x-trace-id | 任意请求 | 查看响应头 | 存在 x-trace-id |
| OBS-002 | P0 | API 调用审计入库 | OAuth 调业务接口 | 查 api_call_logs | 记录含 client_id/path/status/latency |
| OBS-003 | P1 | 配额累计 | 连续调用 | 查 api_quotas | daily/monthly 计数准确 |
| OBS-004 | P1 | 配额超限 | 配额设小值 | 超阈值访问 | 429 |
| OBS-005 | P1 | 敏感信息脱敏 | 错误/日志场景 | 检查日志 | 无 token/secret 明文 |

### 5.8 前后端联调

| ID | 优先级 | 场景 | 前置 | 步骤 | 预期 |
|---|---|---|---|---|---|
| UI-001 | P0 | 登录到 Dashboard | 前后端启动 | UI 登录 | 成功跳转 |
| UI-002 | P0 | Transaction 详情关联侧栏 | 有关联链路 | 打开详情 | 显示 upstream/downstream，可跳转 |
| UI-003 | P1 | 通知轮询刷新 | 有新增通知 | 等待 15-30s | 自动刷新 |
| UI-004 | P1 | 上传流程回归 | 证书/规格可用 | UI 上传 | 列表与详情同步更新 |

### 5.9 灰度发布与回滚演练

| ID | 优先级 | 场景 | 前置 | 步骤 | 预期 |
|---|---|---|---|---|---|
| CANARY-001 | P0 | Phase 0 内部验证 | 仅内网白名单 | 跑冒烟与压测 | 指标达阈值 |
| CANARY-002 | P0 | Phase 1 小流量放量 | 加 1-2 客户白名单 | 观察 1 天 | 无重大告警 |
| CANARY-003 | P0 | 触发回滚流程 | 人工注入异常 | 执行白名单回退+禁用 client | 服务恢复 |
| CANARY-004 | P1 | 变更记录完整性 | 发布完成 | 填写变更模板 | 字段完整可审计 |

## 6. 非功能专项

### 6.1 性能测试

1. Token endpoint 压测
- 目标：RPS 50 下失败率 <1%

2. 核心查询接口压测（`/v1/transactions`）
- 目标：P95 <= 500ms

3. 批量推送压测（`/v1/integrations/events/batch`）
- 目标：无重复入库、无 5xx 飙升

### 6.2 安全测试

1. JWT 篡改测试（签名破坏、scope 篡改）
2. 越权测试（低权限 token 调高权限接口）
3. 暴力请求测试（token endpoint 高频错误请求）
4. 文件上传恶意 payload（超限、非法类型）

## 7. 自动化建议映射

- 可自动化（建议 CI 阻断）：
  - OAUTH-001~005, SCOPE-001~004, INT-001~009, LINK-001~006, OBS-001~004

- 半自动化（建议每周回归）：
  - GW-001~007（依赖网关环境）
  - UI-001~004（依赖 E2E 环境）

- 人工演练（每次发布前）：
  - CANARY-001~004

## 8. 测试通过准入标准（Go-Live Gate）

必须全部满足：
1. P0 用例 100% 通过
2. P1 用例 >= 95% 通过（且无阻断缺陷）
3. 最近 7 天 SLO 达标：
- 可用性 >= 99.9%
- 核心接口 P95 <= 500ms
- 5xx <= 0.5%
4. 完成一次可验证回滚演练并记录结果

## 9. 执行记录模板

- 执行日期：
- 环境：sandbox/production
- 测试版本（commit/tag）：
- 执行人：
- 总用例数/通过数/失败数/阻塞数：
- P0 失败清单：
- 风险与结论：Go / No-Go
