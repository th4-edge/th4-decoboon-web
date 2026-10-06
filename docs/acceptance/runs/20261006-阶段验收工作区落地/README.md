# 阶段验收工作区 · 页面落地与布局冒烟验收

- 日期：2026-10-06
- 批次：`DESIGNER-ACCEPTANCE-20261006`
- 页面：`/designer/projects/:projectId/acceptance`
- 分辨率：1440×900 / 1280×800 / 1024×768
- 环境：本地 Vite `http://127.0.0.1:8080`，后端 `http://127.0.0.1:8090`

## 本轮完成

1. 从项目工地进入阶段验收工作区。
2. 施工阶段池：展示阶段状态、进度、权重和验收状态。
3. 当前验收单：提交人、验收结论、业主确认、问题清单和验收证据。
4. 验收证据：现场照片 / 视频通过 `file/private/grant` 上传和签发。
5. 验收轮次：展示每轮结果、结论、问题、整改说明和时间。
6. 提交验收：设计师可提交首次验收或驳回后的复验。
7. 权限边界：设计师不可确认或驳回，确认/驳回必须由业主本人执行，员工不得代录。
8. 账务边界：验收和整改不改变金额、成本、应收、应付和利润。

## Provider 路由

| 用途 | Provider |
| --- | --- |
| 项目详情 | `project/project/info` |
| 施工阶段 | `project/stage/page` |
| 验收列表 | `project/acceptance/page` |
| 提交验收 | `project/acceptance/save` |
| 验收轮次 | `project/acceptance/round/page` |
| 验收证据上传 | `file/private/grant` |

## 验证结论

| 项 | 结果 |
| --- | --- |
| `npm run type-check` | PASS |
| `npm run build` | PASS |
| `/designer/projects/:projectId/acceptance` 三档渲染 | PASS（路由 Mock 数据） |
| 浏览器控制台 | 0 error / 0 warning |
| 阶段、验收单、轮次和提交入口渲染 | PASS（路由 Mock 数据） |
| 真实提交 / 业主确认 / 整改复验 | 待真实设计师账号登录后补验 |

## 数据说明

本轮截图使用 Playwright 路由 Mock 提供合成阶段、验收和轮次数据，仅用于验证信息架构、验收状态、证据和轮次布局。

**这不是 G3 真实数据验收，也不代表阶段验收、整改或复验已在真实服务端通过。**

## 截图

- `raw/screenshots/DESIGNER-ACCEPTANCE-1440x900.png`
- `raw/screenshots/DESIGNER-ACCEPTANCE-1280x800.png`
- `raw/screenshots/DESIGNER-ACCEPTANCE-1024x768.png`

## 后续必须补验

1. 使用真实设计师账号提交阶段验收并上传现场证据。
2. 验证业主本人确认 / 驳回，员工代确认被拒绝。
3. 验证驳回后的整改、复验和轮次追加不覆盖历史。
4. 验证验收不改变金额、成本、应收、应付和利润。
5. 补真实数据下 1440 / 1280 / 1024 三档和键盘路径。
