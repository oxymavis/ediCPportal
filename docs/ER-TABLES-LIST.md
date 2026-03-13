# EDI Portal 后台数据库表清单（共 25 张表）

- **详细 ER 图（每表字段 + 主外键）**：**`docs/ER-diagram-detailed.svg`**（矢量，推荐）
- 简化 ER 图（仅表名与关系）：**`docs/ER-diagram.svg`**

带字段的 Mermaid 源文件：**`docs/ER-diagram.mmd`**（可用 [Mermaid Live](https://mermaid.live) 或 `npx @mermaid-js/mermaid-cli mmdc -i docs/ER-diagram.mmd -o out.svg` 导出为 SVG/PNG）。

---

## 表与关系概览

| # | 表名 | 说明 | 外键 |
|---|------|------|------|
| 1 | users | 用户 | - |
| 2 | sessions | 会话 | user_id → users.id |
| 3 | email_verification_tokens | 邮箱验证令牌 | user_id → users.id |
| 4 | partners | 贸易伙伴 | - |
| 5 | subsidiaries | 子公司/分部 | partner_id → partners.id |
| 6 | as2_profiles | AS2 配置 | subsidiary_id → subsidiaries.id |
| 7 | certificates | 证书 | - |
| 8 | transactions | 交易记录 | - |
| 9 | transaction_links | 交易关联 | from/to_transaction_id → transactions.id |
| 10 | notifications | 通知 | - |
| 11 | unis_specifications | UNIS 消息规范 | - |
| 12 | tp_specifications | 伙伴消息规范 | - |
| 13 | integration_clients | 集成客户端（API Key） | - |
| 14 | api_clients | OAuth API 客户端 | - |
| 15 | oauth_tokens | OAuth 令牌 | client_id → api_clients.client_id |
| 16 | api_call_logs | API 调用日志 | - |
| 17 | api_quotas | API 配额 | - |
| 18 | api_messages | API 消息类型 | - |
| 19 | api_message_schemas | 消息 JSON Schema | message_code → api_messages.code |
| 20 | api_message_samples | 消息示例 | message_code → api_messages.code |
| 21 | api_message_mappings | 消息字段映射 | message_code → api_messages.code |
| 22 | connection_test_runs | 连接测试运行 | - |
| 23 | connection_test_steps | 连接测试步骤 | run_id → connection_test_runs.id |
| 24 | document_test_reports | 文档测试报告 | - |
| 25 | validator_reports | 校验报告 | - |

---

## 各表字段明细（来源：`backend/app/models/models.py`）

### 1. users
- id (PK), email (UK), name, password_hash, password_algo, email_verified, created_at, updated_at

### 2. sessions
- id (PK), user_id (FK→users.id), expires_at, created_at

### 3. email_verification_tokens
- token (PK), user_id (FK→users.id), expires_at, used

### 4. partners
- id (PK), name, code, status, industry, website, contact_name, contact_email, contact_phone, integration_type, communication_channel, current_step_id, onboarding_start_date, step_completion_dates (JSON), api_config (JSON), environment, created_at

### 5. subsidiaries
- id (PK), partner_id (FK→partners.id), name, code, region, status, supported_doc_types_x12 (JSON), supported_doc_types_edifact (JSON), message_routing (JSON)

### 6. as2_profiles
- id (PK), subsidiary_id (FK→subsidiaries.id), name, as2_id, as2_url, status, encryption_cert, signing_cert, mdn_required, mdn_signed, encryption_algorithm, signature_algorithm

### 7. certificates
- id (PK), name, serial_number, fingerprint, issuer, subject, algorithm, key_size, created, expires, usage, type, status, partner, environment, file_path, created_at

### 8. transactions
- id (PK), type, doc_type, type_name, partner, direction, status, date, time, size, records, control_number, sender_id, receiver_id, integration_type, channel, source_system, external_event_id, idempotency_key (UK), business_refs (JSON), control_refs (JSON), occurred_at, raw (TEXT), logs (JSON), errors (JSON), environment, created_at

### 9. transaction_links
- id (PK), from_transaction_id (FK→transactions.id), to_transaction_id (FK→transactions.id), relation_type, match_rule, confidence, evidence (JSON), created_at

### 10. notifications
- id (PK), type, title, message (TEXT), date, time, read, archived, environment, action (JSON), details (JSON), created_at

### 11. unis_specifications
- id (PK), code (UK), name, description (TEXT), category, version, last_updated

### 12. tp_specifications
- id (PK), message_type, message_name, partner, partner_code, version, uploaded_date, uploaded_by, file_type, file_name, size, status, file_path, created_at

### 13. integration_clients
- id (PK), name, api_key_hash (UK), status, allowed_sources (JSON), created_at, last_used_at

### 14. api_clients
- client_id (PK), name, secret_hash, status, scopes (JSON), environment, created_at, last_used_at

### 15. oauth_tokens
- jti (PK), client_id (FK→api_clients.client_id), expires_at, revoked, created_at

### 16. api_call_logs
- id (PK), trace_id, client_id, method, path, status_code, latency_ms, created_at

### 17. api_quotas
- id (PK), client_id, period, period_key, count, updated_at

### 18. api_messages
- code (PK), name, category, x12_equivalent, version, created_at, updated_at

### 19. api_message_schemas
- id (PK), message_code (FK→api_messages.code), version, schema (JSON), created_at

### 20. api_message_samples
- id (PK), message_code (FK→api_messages.code), sample_type, content (JSON), created_at

### 21. api_message_mappings
- id (PK), message_code (FK→api_messages.code), json_field, x12_segment, x12_element, notes, created_at

### 22. connection_test_runs
- id (PK), partner_id, test_type, environment, status, summary (JSON), started_at, finished_at, trace_id

### 23. connection_test_steps
- id (PK), run_id (FK→connection_test_runs.id), step_no, name, status, latency_ms, detail, evidence (JSON), created_at

### 24. document_test_reports
- id (PK), partner_id, environment, message_type, status, errors (JSON), payload (JSON), created_at

### 25. validator_reports
- id (PK), format, valid, errors (JSON), warnings (JSON), created_at
