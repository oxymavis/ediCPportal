# OpenAPI 白名单灰度发布流程（Nginx 网关）

## 1. 目标

在不影响现网稳定性的前提下，将外部客户从旧接入方式迁移到 OpenAPI 网关，使用白名单 + 分批灰度方式逐步放量。

## 2. 适用范围

- 网关：Nginx（配置模板见 `deploy/nginx/openapi-gateway.conf`）
- 认证：OAuth2 client credentials（`/v1/oauth/token`）
- 兼容期：可保留 `x-api-key` 一段版本周期

## 3. 发布前检查（T-1）

1. 配置检查
- Nginx 配置语法通过：`nginx -t`
- 白名单 CIDR 已录入并双人复核
- `client_max_body_size` 与后端 `API_MAX_REQUEST_SIZE_BYTES` 对齐

2. 功能检查
- `GET /v1/meta/health` 正常
- OAuth token 申请、业务接口读写、`/v1/integrations/events` 推送均可用

3. 观测检查
- 已接入请求量、5xx、P95、401/403/429 监控图表
- 告警已启用（5xx、OAuth 失败率、429 激增）

## 4. 灰度分阶段

## Phase 0（预发布验证）

- 仅内部办公网段在白名单。
- 用测试 client 进行全链路验证。
- 验收阈值（连续 30 分钟）：
  - 5xx <= 0.5%
  - token 成功率 >= 99%
  - P95 <= 500ms

## Phase 1（首批客户，5-10% 调用量）

- 新增首批客户出口 IP 到白名单。
- 仅放开只读 scope（优先 `transactions:read`、`partners:read`）。
- 观察 1 个工作日。

回退条件（任一命中立即回退）：
- 5xx > 1%
- OAuth 失败率 > 3%
- 核心接口 P95 > 800ms 持续 10 分钟

## Phase 2（扩大到 30-50% 调用量）

- 扩展更多客户 IP 白名单。
- 开放写操作 scope（如 `integrations:write`）。
- 观察 2-3 天，重点看幂等、429 与链路命中率。

## Phase 3（全量开放）

- 全客户迁移到 OpenAPI 域名。
- 旧接入路径进入冻结，仅保留应急回退窗口（建议 1 个版本周期）。

## 5. 执行步骤（每次发布）

1. 更新白名单配置
- 修改 `geo $allow_openapi` 的 CIDR 列表

2. 校验并热加载
```bash
nginx -t && nginx -s reload
```

3. 冒烟验证
- 从新增客户出口 IP 执行：
  - `/v1/oauth/token`
  - 至少 1 个读接口
  - 至少 1 个写接口（若该阶段允许）

4. 观察窗口
- 按阶段要求观测 30 分钟到 1 天

## 6. 回滚流程

1. 网关回滚
- 立即移除新增 CIDR 并 `nginx -s reload`

2. 客户侧回滚
- 通知受影响客户切回旧入口或暂停调用

3. 平台侧止血
- 禁用异常 client：`PUT /v1/oauth/clients/{id}/status` = `disabled`
- 轮换疑似泄露凭证：`POST /v1/oauth/clients/{id}/rotate-secret`

4. 复盘
- 输出事故时间线、根因、修复项、再次发布前置条件

## 7. 变更记录模板

- 变更编号：
- 变更时间：
- 发布阶段：Phase 0/1/2/3
- 新增白名单 CIDR：
- 影响客户：
- 验证结果：
- 监控结果（5xx/P95/OAuth 成功率）：
- 是否触发回滚：
- 操作人/复核人：
