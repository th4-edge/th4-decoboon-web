# 增减项工作区 · 页面落地与布局冒烟验收

- 日期：2026-10-06
- 批次：`DESIGNER-CONTRACT-CHANGES-20261006`
- 页面：`/designer/projects/:projectId/changes`
- 分辨率：1440×900 / 1280×800 / 1024×768
- 环境：本地 Vite `http://127.0.0.1:8080`，后端 `http://127.0.0.1:8090`

## 本轮完成

1. 从项目工地进入增减项工作区。
2. 增减项队列：展示全部 / 待审批 / 待客户签认 / 客户已确认 / 已驳回。
3. 变更对象事实：变更编号、类型、金额变化、原因、发起人、审批人、审批时间、客户签认时间。
4. 变更详情：审批结论、签认证据和合同当前金额。
5. 发起增减项：设计师范畴内可发起，填写变更类型、金额变化、原因，上传现场证据。
6. 客户现场签认：审批通过后可登记客户签名和现场照片。
7. 审批边界：设计师不可审批；审批由 Boss / 财务完成。
8. 成本边界：不展示成本变化明细，只展示销售侧金额变化。
9. 账务边界：签认后由服务端统一重算任务、材料、应收、成本和利润。

## Provider 路由

| 用途 | Provider |
| --- | --- |
| 项目详情 | `project/project/info` |
| 项目合同 | `project/contract/info` |
| 增减项列表 | `project/contract-change/page` |
| 发起增减项 | `project/contract-change/save` |
| 客户签认 | `project/contract-change/customer-confirm` |
| 签认 / 证据上传 | `file/private/grant` |

## 验证结论

| 项 | 结果 |
| --- | --- |
| `npm run type-check` | PASS |
| `npm run build` | PASS |
| `/designer/projects/:projectId/changes` 三档渲染 | PASS（路由 Mock 数据） |
| 浏览器控制台 | 0 error / 0 warning |
| 增减项队列、详情、签认入口渲染 | PASS（路由 Mock 数据） |
| 真实发起 / 审批 / 签认 / 履约重算 | 待真实设计师账号登录后补验 |

## 数据说明

本轮截图使用 Playwright 路由 Mock 提供合成增减项数据，仅用于验证信息架构、状态轨道、金额变化、审批和签认入口。

**这不是 G3 真实数据验收，也不代表变更已经真实发起、审批、签认或完成履约重算。**

## 截图

- `raw/screenshots/DESIGNER-CHANGES-1440x900.png`
- `raw/screenshots/DESIGNER-CHANGES-1280x800.png`
- `raw/screenshots/DESIGNER-CHANGES-1024x768.png`

## 后续必须补验

1. 使用真实设计师账号发起增减项，验证审批前不可客户签认。
2. 验证 Boss / 财务审批通过后，设计师只读审批意见。
3. 验证现场签认必须有签名和证据，重复签认幂等。
4. 验证签认完成后任务、材料、应收和成本由服务端统一重算。
5. 验证设计师不可审批、不可查看成本变化明细。
6. 补真实数据下 1440 / 1280 / 1024 三档和键盘路径。
