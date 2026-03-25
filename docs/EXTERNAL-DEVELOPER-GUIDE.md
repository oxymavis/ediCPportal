# 外部开发者对接指南

本文面向需要与本项目进行 API 对接的外部开发者，重点说明认证方式、联调流程、请求示例和常见注意事项。

## 1. 对接范围

当前项目对外开放的主要能力包括：

- OAuth2 `client_credentials` 获取访问令牌
- 登录门户后自助注册开发者应用并生成 `client_id` / `client_secret`
- 通过 Open API 查询业务数据
- 外部系统向平台推送集成事件
- 使用 API 连接测试接口验证目标系统可达性和认证配置

当前推荐的认证方式是 OAuth2 Bearer Token。`x-api-key` 仅作为兼容模式保留，主要用于集成事件推送。

## 2. 基础信息

- **Base URL（生产环境，经 Nginx）**：`http://81.70.150.216/api`  
  文档中的路径均以此前缀拼接（例如 `/v1/oauth/token` 的完整地址为 `http://81.70.150.216/api/v1/oauth/token`）。绑定域名后请将 `81.70.150.216` 替换为你的公网域名，并尽快启用 HTTPS。
- **Base URL（本地开发，直连后端）**：`http://localhost:8000`
- **OpenAPI JSON**  
  - 生产：`GET http://81.70.150.216/api/openapi.json`  
  - 本地：`GET http://localhost:8000/openapi.json`
- **Swagger UI**  
  - 生产：`GET http://81.70.150.216/api/docs`  
  - 本地：`GET http://localhost:8000/docs`  
  - 可选（经 Next 同域转发，与本地 `http://localhost:3000/docs` 类似）：`GET http://81.70.150.216/docs`
- **ReDoc**  
  - 生产：`GET http://81.70.150.216/api/redoc`  
  - 本地：`GET http://localhost:8000/redoc`

响应格式统一为：

成功：

```json
{
  "success": true,
  "data": {}
}
```

失败：

```json
{
  "success": false,
  "error": "message",
  "code": "ERROR_CODE"
}
```

时间格式统一为 ISO-8601 UTC，例如：`2026-03-03T10:10:00Z`。

## 3. 认证方式

### 3.1 OAuth2 获取访问令牌

如果平台已开放开发者门户，外部开发者可先在页面中登录账号，并在 `Developer Apps` 页面自助创建一个 OAuth app。创建后系统会一次性展示：

- `client_id`
- `client_secret`
- app 所属环境
- 已授权 scopes

请在创建后立即保存 `client_secret`；后续如遗失，应通过“Rotate Secret”重新生成，而不是尝试找回原值。

接口：

`POST /v1/oauth/token`

请求头：

```http
Content-Type: application/x-www-form-urlencoded
```

表单字段：

- `grant_type`: 固定值 `client_credentials`
- `client_id`: 分配给外部系统的客户端 ID
- `client_secret`: 分配给外部系统的客户端密钥
- `scope`: 可选，空格分隔；如果不传，默认使用该 client 已授权的全部 scope

`client_id` 与 `client_secret` 由平台管理员通过 `POST /v1/oauth/clients` 创建后**单独交付**，勿写入公开文档或代码仓库。

示例：

```bash
curl -X POST http://81.70.150.216/api/v1/oauth/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=client_credentials&client_id=cli_xxx&client_secret=sec_xxx&scope=integrations:write transactions:read'
```

返回示例：

```json
{
  "success": true,
  "data": {
    "access_token": "<jwt>",
    "token_type": "bearer",
    "expires_in": 3600,
    "scope": "integrations:write transactions:read"
  }
}
```

后续调用在请求头中带上：

```http
Authorization: Bearer <access_token>
```

### 3.2 API Key 兼容模式

兼容模式下，可在请求头中传：

```http
x-api-key: <api_key>
```

说明：

- 推荐只用于集成事件推送接口
- 新对接优先使用 OAuth2
- API Key 不支持像 OAuth2 那样的精细 scope 管理

## 4. Scope 权限模型

接口按资源和读写权限控制：

- `partners:read`, `partners:write`
- `certificates:read`, `certificates:write`
- `specifications:read`, `specifications:write`
- `transactions:read`, `transactions:write`
- `notifications:read`, `notifications:write`
- `integrations:read`, `integrations:write`

规则：

- `GET/HEAD/OPTIONS` 需要 `*:read`
- `POST/PUT/DELETE` 需要 `*:write`

示例：

- 查询交易列表需要 `transactions:read`
- 推送外部事件需要 `integrations:write`

## 5. 环境隔离

OAuth client 会绑定环境：

- `production`
- `sandbox`
- `all`

调用集成事件推送接口时，token 所属环境必须与请求体中的 `environment` 一致；否则会返回 `403`。

例如：

- `production` client 不能推送 `sandbox` 事件
- `sandbox` client 不能推送 `production` 事件

## 6. 推荐联调流程

1. 平台侧分配 `client_id`、`client_secret`，并确认可用 scope 与环境。
2. 外部系统调用 `/v1/oauth/token` 获取 access token。
3. 先调用 `GET /v1/meta/health` 验证网络连通性。
4. 用测试数据调用目标 API。
5. 如果是事件接入，先向 `/v1/integrations/events` 推送单条事件。
6. 验证返回的 `transactionId`、幂等行为和环境限制。
7. 稳定后再切换到批量推送或生产环境。

## 7. 常用接口

### 7.1 健康检查

`GET /v1/meta/health`

用途：

- 验证 API 是否可访问
- 作为联调前连通性检查

### 7.2 版本查询

`GET /v1/meta/version`

用途：

- 核对当前平台版本
- 排查环境差异

### 7.3 集成事件推送

单条：

`POST /v1/integrations/events`

批量：

`POST /v1/integrations/events/batch`

认证：

- 推荐：`Authorization: Bearer <token>`
- 兼容：`x-api-key: <api_key>`

单条请求体示例：

```json
{
  "idempotencyKey": "evt-20260303-0001",
  "sourceSystem": "edi",
  "environment": "production",
  "partner": "Walmart",
  "docType": "856",
  "direction": "outbound",
  "status": "completed",
  "occurredAt": "2026-03-03T10:10:00Z",
  "businessRefs": {
    "poNo": "PO-1001",
    "shipmentNo": "SHP-2001"
  },
  "controlRefs": {
    "isaControlNo": "000000123",
    "gsControlNo": "987",
    "stControlNo": "0001"
  },
  "externalEventId": "oms-msg-778899",
  "rawPayload": {
    "records": 2,
    "integrationType": "api",
    "channel": "REST_API",
    "senderId": "OMS",
    "receiverId": "UNIS"
  }
}
```

字段说明：

- `idempotencyKey`: 幂等键，建议业务侧全局唯一
- `sourceSystem`: 允许值 `edi|oms|wms|tms`
- `environment`: `production|sandbox`
- `partner`: 业务伙伴名称
- `docType`: 单据类型，如 `850`、`856`
- `direction`: `inbound|outbound`
- `occurredAt`: 事件发生时间，UTC
- `businessRefs`: 业务参考号
- `controlRefs`: EDI 控制号
- `externalEventId`: 外部系统事件 ID，可选
- `rawPayload`: 原始报文或摘要信息

成功返回示例：

```json
{
  "success": true,
  "data": {
    "success": true,
    "transactionId": "TRX-856-abc123def0",
    "linking": {
      "linked": false,
      "relatedTransactionIds": []
    }
  }
}
```

幂等说明：

- 若 `idempotencyKey` 已存在，接口会返回已存在的结果，而不是重复创建新交易
- 若 `externalEventId + sourceSystem` 已存在，也会被识别为重复事件

批量请求体示例：

```json
[
  {
    "idempotencyKey": "evt-20260303-0001",
    "sourceSystem": "oms",
    "environment": "production",
    "partner": "Walmart",
    "docType": "940",
    "direction": "outbound",
    "status": "sent",
    "occurredAt": "2026-03-03T10:10:00Z",
    "businessRefs": {},
    "controlRefs": {},
    "rawPayload": {}
  }
]
```

批量返回中，每条结果会独立给出 `success`、错误原因或生成的 `transactionId`。

### 7.4 API 连接测试

接口：

`POST /v1/connection-testing/api/run`

用途：

- 验证目标 API 地址是否可达
- 验证 TLS 证书
- 验证 OAuth2 或 API Key 是否可用于调用目标接口

支持认证模式：

- `oauth2`
- `api-key`
- `none`

如果使用 `oauth2`，可直接传已有 token，也可以传 `tokenUrl + clientId + clientSecret` 让平台在测试过程中临时换取 token。

示例：

```json
{
  "environment": "sandbox",
  "endpoint": "https://partner.example.com/api/orders",
  "auth": "oauth2",
  "tokenUrl": "https://partner.example.com/oauth/token",
  "clientId": "partner-client",
  "clientSecret": "partner-secret",
  "samplePayload": {
    "id": 1
  }
}
```

说明：

- 该接口更适合联调和网络诊断
- 它不是长期凭证托管或自动刷新机制

## 8. 错误处理建议

常见状态码：

- `200`: 请求成功
- `400`: 请求参数错误
- `401`: 未认证或凭证无效
- `403`: 权限不足或环境不匹配
- `404`: 资源不存在
- `429`: 超出配额

建议外部系统：

- 对 `401` 先重新获取 token 再重试
- 对 `403` 检查 scope 和环境
- 对 `429` 做退避重试
- 对 5xx 做有限次数重试，并保留请求日志

## 9. 安全建议

- 不要在前端页面、浏览器脚本或移动端应用中暴露 `client_secret`
- 生产环境中按系统、环境、用途分配独立 client
- 定期轮换 `client_secret` 或 API Key
- 为每个调用请求记录 `idempotencyKey`、时间戳和响应结果
- 避免在日志中输出完整 token、secret、api key

## 10. 最小联调示例

获取 token：

```bash
curl -X POST http://81.70.150.216/api/v1/oauth/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=client_credentials&client_id=cli_xxx&client_secret=sec_xxx&scope=integrations:write'
```

推送事件：

```bash
curl -X POST http://81.70.150.216/api/v1/integrations/events \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <access_token>' \
  -d '{
    "idempotencyKey": "evt-20260303-0001",
    "sourceSystem": "oms",
    "environment": "production",
    "partner": "Walmart",
    "docType": "940",
    "direction": "outbound",
    "status": "sent",
    "occurredAt": "2026-03-03T10:10:00Z",
    "businessRefs": {"orderNo": "SO-10001"},
    "controlRefs": {},
    "rawPayload": {"records": 1}
  }'
```

健康检查：

```bash
curl http://81.70.150.216/api/v1/meta/health
```

## 11. 当前能力边界

当前项目已经实现：

- 平台向外部开发者签发 OAuth2 token
- 平台校验 Bearer Token 和兼容 API Key
- 外部系统推送事件到平台
- 联调阶段临时测试第三方 OAuth2 token 获取

当前未作为正式开放能力提供：

- 平台长期托管第三方系统凭证
- 平台自动刷新第三方 OAuth token 的完整生产流程
- 面向外部开发者的 webhook 签名校验规范

## 12. 建议补充给外部开发者的交付物

正式接入时，建议平台侧同步提供以下信息：

- 生产和沙箱的实际 Base URL
- 分配的 `client_id`
- 一次性下发的 `client_secret`
- 已授权 scope 列表
- client 所属环境
- 接口限流/配额要求
- 联系人和故障升级路径

## 13. 参考文档

- `docs/API-REFERENCE.md`
- `backend/README.md`
- `docs/OPENAPI-OPS-RUNBOOK.md`
