# Data Source Map

| Component | API | Tables |
|---|---|---|
| dashboard/tabs/overview-tab.tsx | `GET /v1/partners`, `GET /v1/transactions`, `GET /v1/notifications` | partners, transactions, notifications |
| dashboard/tabs/partners-tab.tsx | `GET/POST/PUT/DELETE /v1/partners` | partners, subsidiaries, as2_profiles |
| dashboard/modals/message-routing-modal.tsx | `GET/PUT /v1/partners/{pid}/subsidiaries/{sid}/routing` | subsidiaries.message_routing |
| dashboard/tabs/certificates-tab.tsx | `GET/POST /v1/certificates` | certificates |
| dashboard/unis-certificates-section.tsx | `GET /v1/certificates` | certificates |
| dashboard/tabs/specifications-tab.tsx | `GET /v1/specifications` | unis_specifications, tp_specifications |
| dashboard/partner-specifications-tab.tsx | `GET /v1/specifications?section=tp` | tp_specifications |
| dashboard/tabs/transactions-tab.tsx | `GET /v1/transactions` | transactions |
| dashboard/modals/transaction-detail-modal.tsx | tx list payload | transactions.errors/logs/raw |
| dashboard/tabs/notifications-tab.tsx | `GET/PUT /v1/notifications*` | notifications |
| dashboard/tabs/api-docs-tab.tsx | `GET /v1/api-docs/messages*` | api_messages, api_message_schemas, api_message_samples, api_message_mappings |
| dashboard/tabs/connection-testing-tab.tsx | `POST/GET /v1/connection-testing/*` | connection_test_runs, connection_test_steps, document_test_reports, validator_reports |

## Rule
页面业务展示字段必须来自上表 API/DB，不允许新增组件内硬编码业务数组。
