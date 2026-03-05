# DB Table Inventory (25)

## Core Auth
| Table | PK | Purpose |
|---|---|---|
| users | id | 系统用户账户 |
| sessions | id | 登录会话 |
| email_verification_tokens | token | 邮件验证令牌 |

## Partners / Integration
| Table | PK | Purpose |
|---|---|---|
| partners | id | 交易伙伴主表 |
| subsidiaries | id | 伙伴子公司 |
| as2_profiles | id | AS2 配置 |
| integration_clients | id | 集成客户端（API Key） |

## Business Domain
| Table | PK | Purpose |
|---|---|---|
| certificates | id | 证书资产 |
| transactions | id | 交易主表 |
| transaction_links | id | 交易关联 |
| notifications | id | 通知中心 |
| unis_specifications | id | UNIS 标准规范 |
| tp_specifications | id | TP 上传规范 |

## OAuth / Governance
| Table | PK | Purpose |
|---|---|---|
| api_clients | client_id | OAuth client |
| oauth_tokens | jti | OAuth token |
| api_call_logs | id | API 调用审计 |
| api_quotas | id | API 配额计数 |

## API Documentation
| Table | PK | Purpose |
|---|---|---|
| api_messages | code | 消息元数据 |
| api_message_schemas | id | schema 版本 |
| api_message_samples | id | 请求/响应样例 |
| api_message_mappings | id | JSON->X12 映射 |

## Connection Testing / Validation
| Table | PK | Purpose |
|---|---|---|
| connection_test_runs | id | 连接测试 run |
| connection_test_steps | id | 测试步骤结果 |
| document_test_reports | id | 文档测试报告 |
| validator_reports | id | payload 校验报告 |

## Frontend Mapping (high level)
- Dashboard: partners, transactions, notifications
- Partners: partners, subsidiaries, as2_profiles
- Certificates: certificates
- Specifications: unis_specifications, tp_specifications
- API Docs: api_messages + *_schemas/samples/mappings
- Connection Testing: connection_test_runs + connection_test_steps + validator_reports
