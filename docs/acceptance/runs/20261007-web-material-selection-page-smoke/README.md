# Web 主材选材页面集成烟测

> 批次：`WEB-BATCH2-PM-20261007`
> 类型：`MOCK_NETWORK_INTEGRATION`
> 状态：保存、确认和越权路由契约通过；真实写入未验收
> 日期：2026-10-07

## 验证范围

- StoreManager 通过 `/workbench/materials/:projectId` 打开选材工作区。
- 未选择分项时不自动使用第一条。
- 保存草稿调用 `material/selection/save`。
- 登记客户确认调用 `material/selection/confirm`。
- Pm 访问 `/workbench/materials/:projectId` 被路由守卫拒绝到 `/forbidden`。

## 捕获 payload

```json
{
  "propertyId": "pr1",
  "projectId": "p1",
  "contractId": "ct1",
  "contractLineId": "m1",
  "title": "客餐厅地砖",
  "content": "颜色：暖灰；规格：750×1500",
  "status": "Draft"
}
```

```json
{
  "selectionId": "sel2",
  "confirmerName": "王先生"
}
```

## 结果

- 初始未自动选中任何主材。
- 保存草稿按钮发出正确请求。
- 客户确认登记按钮发出正确请求。
- Pm 直接访问选材工作区被拒绝。
- 构建和全部注册检查通过。

## 未覆盖

- 真实 Designer/Boss/StoreManager/Finance 写入。
- Pm/TeamLeader 服务端接口拒绝的真实 E2E。
- 采购锁定并发。
- 客户确认人身份的真实业务证据。
- 三档真实浏览器截图。
