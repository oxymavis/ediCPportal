# Acceptance Report (Backend DB Alignment)

## Scope
- 全量 seed + 前端去假数据 + `/v1/*` 对齐。

## Completed
- [x] backend seed 覆盖 25 张表（含 auth/oAuth/audit/quota/api-docs/connection-testing）
- [x] 提供 `app.cli` 初始化与校验命令
- [x] overview/partners/certificates/specifications/transactions/notifications/api-docs/connection-testing 页面改为 API 数据源
- [x] message routing 改为后端路由存储读写
- [x] transaction detail 错误展示改为 transaction.errors

## Validation Commands
```bash
cd backend && python3 -m app.cli all
cd backend && pytest -q
pnpm -s tsc --noEmit
```

## Residual Risk
- `partner-detail-modal` 其余若干展示块仍以“结构化占位文案”为主，未扩展到更多后端字段；不影响主要 tab 的数据来源真实性。
