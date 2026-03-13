# 前端增删改查与后端接口对应说明

本文说明各功能模块的增删改查是否源自后端接口调用（非前台假数据）。

## 已对接后端的模块

### 1. Partners（交易伙伴）
- **列表**：`PartnersTab` 挂载时调用 `apiClient.getPartners()`，失败时回退到本地 mock。
- **新增**：`AddPartnerModal` 提交时调用 `apiClient.createPartner(payload)`，成功后重新拉取列表。
- **修改/删除**：前端暂无编辑、删除 Partner 的入口；后端已提供 `updatePartner`、`deletePartner`，后续若加 UI 需直接调用上述接口。

### 2. Certificates（证书）
- **列表**：`CertificatesTab` 挂载时调用 `apiClient.getCertificates()`，失败时使用本地 fallback 数据。
- **新增**：上传弹窗中填写名称、Partner、用途、类型、环境并选择文件后，调用 `apiClient.uploadCertificate(...)`，成功后更新本地列表。
- **查看/删除**：查看为本地展示；删除需后端接口，当前 UI 未实现删除按钮。

### 3. Transactions（交易）
- **列表**：`TransactionsTab` 挂载时调用 `apiClient.getTransactions()`，无 mock 回退。
- **筛选**：基于接口返回数据在前端做关键词、类型、状态、方向、伙伴、日期等筛选。
- **上传/详情**：后端提供 `uploadTransaction`、`getTransaction`、`getRelatedTransactions`；若页面有上传或详情入口，应直接调用这些接口。

### 4. Notifications（通知）
- **列表**：`NotificationsTab` 挂载时调用 `apiClient.getNotifications()`。
- **标记已读**：单条已读调用 `apiClient.markNotificationRead(id)`，全部已读调用 `apiClient.markAllNotificationsRead(environment)`。
- **归档**：调用 `apiClient.updateNotification(id, { archived: true })`，成功后更新本地状态。

### 5. Specifications（规格书）
- **TP 规格列表**：`SpecificationsTab` 中「Trading Partner uploaded specifications」通过 `apiClient.getSpecifications({ section: 'tp' })` 拉取。
- **UNIS 标准规格**：当前仍为前端静态列表（后端有 `section=unis` 可返回 unis 列表，可按需改为接口）。
- **上传**：后端有 `uploadSpecification`；若规格页有上传表单，应使用该接口提交。

### 6. API 客户端与 CSRF
- **lib/api-client.ts**：所有请求走 `API_BASE`（同源或 `NEXT_PUBLIC_API_BASE_URL`），POST/PUT/DELETE/PATCH 自动从 cookie 读取 `edi_csrf` 并设置 `x-csrf-token`。
- 需登录且带 CSRF 的写操作均由上述逻辑统一处理。

## 仍使用前端数据的部分

- **API Documentation 页（api-docs-tab）**：消息类型与示例为前端静态配置；后端有 `/v1/api-docs/messages` 系列接口，若需「从后台管理消息定义」可再对接。
- **Partner 详情中的 Message Routing**：路由规则当前为本地 state；若后端提供路由 CRUD 接口，可改为接口驱动。
- **Overview 仪表盘**：部分统计/图表可能仍用静态或本地数据，可按需改为调用后端统计接口。

## 小结

- **Partners / Certificates / Transactions / Notifications / Specifications（TP 列表）** 的**查与写**均已改为后端接口调用，数据来源为后端，仅在接口失败时部分模块保留 mock/fallback 以保页面可用。
- 新增、标记已读、归档、证书上传等写操作均通过 `apiClient` 调用对应后端 API，不再依赖纯前台假数据。
