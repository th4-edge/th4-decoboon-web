# 客户跟进 · 房屋档案新增与维护（Web 对齐 App）

- 日期：2026-10-07
- 类型：`APP_PARITY_GAP_FIX`
- 现象：客户跟进工作台里，跟进中的客户**没有新增房屋、维护房屋入口**，业务员页还写着「量房前必须先建立并选择房屋档案」却没有建立出口 → 量房/设计/报价/合同/项目缺少对象锚点。

## 1. 根因（能力缺口，不是回归）

| 层 | 现状 |
| --- | --- |
| App（为准） | `subpackages/customer/pages/property-edit.vue` 新增/编辑房屋；客户详情「新增房屋」「编辑房屋」；约定量房时提示「请先建立房屋档案→是否现在新增？」 |
| 后端 | `property/property/save`、`property/property/update` 已存在（权限=数据范围：`customerContext.requireVisible` / `propertyContext.require`；同客户同地址重复返回 400） |
| Web（修复前） | `propertyApi` 只有 `listProperties/listMeasures/saveMeasure`；全仓无新增/编辑房屋入口，只有 `PropertyPicker` 选择已有 |
| git 历史 | Web 重建版从未实现过该能力（非删除回归） |

## 2. 修复

| 文件 | 内容 |
| --- | --- |
| `src/domains/property/api.ts` | 新增 `saveProperty` / `updateProperty` / `getProperty`（复用 App 同源 Provider，字段一致：小区/楼栋/房号/地址必填/面积/户型/备注） |
| `src/components/property/PropertyFormDrawer.vue` | 新增房屋档案单据化表单（新增/维护双模式，地址必填校验，失败保留输入并显示服务端原因） |
| `src/views/workbench/MarketerCustomerView.vue` | 量房弹窗新增「新增房屋」「维护当前房屋」，量房前可先建档 |
| `src/views/workbench/StoreCustomerView.vue`、`TeamCustomerView.vue` | 指派设计师弹窗新增「新增房屋」「维护当前房屋」 |
| `src/views/designer/DesignerCustomersView.vue` | 房屋区新增「新增房屋」「维护当前房屋」，保存后重新读取房屋列表并切到该房屋 |
| `docs/standards/business-action-policies.json` | 登记动作 `property/property/save`（新增房屋）、`property/property/update`（维护房屋） |

## 3. 验证

- UI：业务员「我的客户」→ 安排量房 → 弹窗出现「新增房屋 / 维护当前房屋」，抽屉渲染 7 个字段（截图 `screenshots/after-业务员-新增房屋入口.png`）。
- 写链路（业务员 `19900000004`，真实库，同一 payload）：
  - `property/property/save` → `success=true`，`propertyId=233484354251128832`，`propertyNo=H1791356607983`
  - `property/property/page` 回读 → 命中该房屋
  - `property/property/update` → `success=true`，`roomNo` 901→902
- 清理：测试房屋已按 `property_id + 地址标记` 精确删除，残留 0。
- 门禁：`npm run build` 与 9 项治理检查全部 PASS。

## 4. 未覆盖

- 未做浏览器内点击「建立房屋档案」的完整表单提交（本次以同一 payload 走接口验证写入链，UI 仅验证入口与抽屉渲染）；建议在验收时补一次页面内新增+维护。
- 动作 `decisionStatus=pending_business_review`：角色范围按 App 现状（能看见该客户即可维护），待业务智能体正式裁决。
- 房屋删除：App 与后端均无删除 Provider，Web 不提供删除入口。
