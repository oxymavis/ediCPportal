# OpenAPI SLO 仪表盘指标定义表

## 1. SLO 目标

- 可用性：>= 99.9%
- 核心查询接口 P95：<= 500ms
- 5xx 比例：<= 0.5%

时间窗口建议：
- 运营看板：5m / 1h / 24h
- SLO 评估：7d / 30d

## 2. 指标定义（平台级）

| 指标 | 口径定义 | 维度 | 目标/阈值 | 告警建议 |
|---|---|---|---|---|
| `http_requests_total` | 网关总请求数 | env, host, path, method, status | 无 | 基线趋势异常告警 |
| `http_2xx_ratio` | 2xx / 总请求 | env, path | >= 98% | <95% 持续10m 告警 |
| `http_4xx_ratio` | 4xx / 总请求 | env, path | 观察项 | >30% 持续10m 告警 |
| `http_5xx_ratio` | 5xx / 总请求 | env, path | <= 0.5% | >1% 持续5m 告警 |
| `http_p95_ms` | P95 响应时延 | env, path | <= 500ms | >800ms 持续10m 告警 |
| `http_p99_ms` | P99 响应时延 | env, path | <= 1200ms | >1500ms 持续10m 告警 |
| `inflight_requests` | 并发处理中请求数 | env, instance | 容量相关 | 超容量阈值告警 |
| `rate_limited_total` | 429 次数 | env, client_id/path | 观察项 | 突增>3x 基线告警 |

## 3. 认证与安全指标

| 指标 | 口径定义 | 维度 | 目标/阈值 | 告警建议 |
|---|---|---|---|---|
| `oauth_token_issued_total` | token 签发成功次数 | env, client_id | 无 | 异常下降告警 |
| `oauth_token_fail_total` | token 签发失败次数 | env, reason | <= 2% 失败率 | >5% 持续10m 告警 |
| `oauth_invalid_client_total` | client_id/secret 失败次数 | env, client_id | 观察项 | 短时高频触发安全告警 |
| `ip_blocked_total` | 白名单拦截次数 | env, source_ip | 观察项 | 突增告警 |
| `payload_too_large_total` | 413 次数 | env, path | 观察项 | 持续增加需评估上限 |

## 4. 业务指标（EDI 交易）

| 指标 | 口径定义 | 维度 | 目标/阈值 | 告警建议 |
|---|---|---|---|---|
| `integration_events_ingested_total` | 外部推送成功入库数 | env, source_system, doc_type | 无 | 突降告警 |
| `integration_events_failed_total` | 外部推送失败数 | env, error_code | 观察项 | 突增告警 |
| `integration_idempotent_hits_total` | 幂等命中数 | env, source_system | 观察项 | 突增排查重放 |
| `transaction_linked_total` | 自动建链成功数 | env, pair(856-850等) | 趋势稳定 | 突降告警 |
| `transaction_ambiguous_total` | 模糊冲突数 | env, pair | 越低越好 | >基线2x 告警 |
| `transaction_link_hit_ratio` | linked / ingest | env, pair | 逐步提升 | 连续下降告警 |

## 5. 审计与配额指标

| 指标 | 口径定义 | 维度 | 目标/阈值 | 告警建议 |
|---|---|---|---|---|
| `api_call_logs_write_fail_total` | 审计日志写入失败数 | env | =0 | >0 即告警 |
| `quota_exceeded_total` | 配额超限次数 | env, client_id | 观察项 | 单客户突增告警 |
| `top_clients_by_qps` | 客户 QPS 排名 | env, client_id | 观察项 | 用于容量规划 |

## 6. Dashboard 面板建议

1. 总览
- QPS、2xx/4xx/5xx、P95/P99、可用性

2. OAuth
- token 成功/失败趋势
- Top 失败 client 与失败原因

3. Integration
- ingest 成功/失败
- idempotent 命中
- link hit ratio / ambiguous

4. 安全
- IP blocked
- 429 与 413
- 可疑 client 高频失败

5. 客户运营
- Top 客户调用量
- 配额消耗进度（日/月）

## 7. 采集建议

- 网关日志：Nginx JSON access log（含 request_id、upstream_response_time）
- 应用日志：结构化 JSON（含 trace_id、client_id、path、status）
- 指标系统：Prometheus + Grafana（或等价方案）
- 告警：Alertmanager / 云监控

## 8. 验收规则

连续 7 天满足以下条件可视为 SLO 达标：
- 可用性 >= 99.9%
- 核心查询接口 P95 <= 500ms
- 5xx 比例 <= 0.5%
