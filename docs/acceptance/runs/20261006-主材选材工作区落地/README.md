# 主材选材工作区 · 页面落地与布局冒烟验收

- 日期：2026-10-06
- 批次：`DESIGNER-MATERIAL-SELECTION-20261006`
- 页面：`/designer/projects/:projectId/materials`
- 分辨率：1440×900 / 1280×800 / 1024×768
- 环境：本地 Vite `http://127.0.0.1:8080`，后端 `http://127.0.0.1:8090`

## 本轮完成

1. 从项目工地进入主材选材工作区。
2. 主材分项池：按项目加载合同主材分项，支持全部 / 待选样 / 待确认 / 已确认 / 已锁定筛选。
3. 选材对象事实：空间、分类、合同品牌规格、数量、采购状态和确认状态。
4. 选材编辑器：颜色/花色、规格/型号、品牌、工艺/材质、选材说明和备注。
5. 保存草稿：调用 `material/selection/save`，状态 `Draft`。
6. 提交客户确认：调用 `material/selection/save`，状态 `PendingConfirm`。
7. 锁定规则：已确认或已进入采购的主材禁止直接修改选材文本，需走增减项。
8. 业务边界：选材文本不改变报价、合同、成本、材料数量和采购事实。
9. GAP 边界：客户确认登记方式仍受 `GAP-005` 约束，本轮不实现 Web 自助或代登记入口。

## Provider 路由

| 用途 | Provider |
| --- | --- |
| 项目详情 | `project/project/info` |
| 主材选材分项 | `material/selection/item/page` |
| 保存 / 提交选材 | `material/selection/save` |

## 验证结论

| 项 | 结果 |
| --- | --- |
| `npm run type-check` | PASS |
| `npm run build` | PASS |
| `/designer/projects/:projectId/materials` 三档渲染 | PASS（路由 Mock 数据） |
| 浏览器控制台 | 0 error / 0 warning |
| 主材分项、编辑器和锁定态渲染 | PASS（路由 Mock 数据） |
| 真实写入 / 客户确认 / 采购联动 | 待真实设计师账号登录后补验 |

## 数据说明

本轮截图使用 Playwright 路由 Mock 提供合成主材分项数据，仅用于验证筛选、编辑和锁定态布局。

**这不是 G3 真实数据验收，也不代表选材写入或客户确认已在真实服务端通过。**

## 截图

- `raw/screenshots/DESIGNER-MATERIALS-1440x900.png`
- `raw/screenshots/DESIGNER-MATERIALS-1280x800.png`
- `raw/screenshots/DESIGNER-MATERIALS-1024x768.png`

## 后续必须补验

1. 使用真实设计师账号加载真实项目主材分项。
2. 验证草稿保存、提交客户确认、版本递增和历史保留。
3. 验证已确认 / 已采购选材的锁定与 403。
4. 按 `GAP-005` 裁决决定客户确认线上自助或现场代登记的最终入口。
5. 换材必须通过增减项路径，验证采购和退货冲减联动。
6. 补真实数据下 1440 / 1280 / 1024 三档和键盘路径。
