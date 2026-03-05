# Frontend No-Mock Rules

1. 业务页面不得在组件内定义硬编码业务数组作为默认展示数据。
2. API 失败时仅展示 `loading/empty/error` 状态，不回退到 demo 数据。
3. 统一通过 `lib/api-client.ts` 调用 `/v1/*`。
4. 允许的常量仅限 UI 枚举/颜色映射，不得包含业务记录（partner/cert/transaction/spec/notification）。
5. PR 必须更新 `docs/DATA-SOURCE-MAP.md`（若新增模块）。

## Suggested CI Gate
- 扫描 `components/dashboard` 中 `const xxx = [{`、`useState([{` 这类大数组模式；命中后需要白名单说明。
