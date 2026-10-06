# 设计方案工作区 · 页面落地与布局冒烟验收

- 日期：2026-10-06
- 批次：`DESIGNER-DESIGN-WORKSPACE-20261006`
- 页面：`/designer/design/:designId`
- 分辨率：1440×900 / 1280×800 / 1024×768
- 环境：本地 Vite `http://127.0.0.1:8080`，后端 `http://127.0.0.1:8090`

## 本轮完成

1. 从客户与设计页面的方案卡进入独立设计工作区。
2. 方案头部：方案名称、编号、版本、风格、面积、状态和状态推进。
3. 空间管理：新增、编辑、删除空间；展示面积、长宽高、设计项数量和备注。
4. 设计项管理：按空间归属展示施工 / 主材 / 软装等项目；展示品牌、规格、数量、材料价、人工价和金额。
5. 新增 / 编辑设计项：支持报价项目库检索和手工录入；项目库选中后自动带入名称、分类、品牌、规格、单位、材料价、人工价和计价模式。
6. 负向边界：设计工作区只做方案事实，正式报价金额仍由报价工作区服务端重算；不显示标准成本、采购价、项目利润。

## Provider 路由

| 用途 | Provider |
| --- | --- |
| 方案详情 | `design/scheme/info` |
| 方案状态推进 | `design/scheme/build` |
| 空间保存 / 删除 | `design/space/save`、`design/space/delete` |
| 设计项保存 / 删除 | `design/item/save`、`design/item/delete` |
| 项目库检索 | `catalog/item/page` |

## 验证结论

| 项 | 结果 |
| --- | --- |
| `npm run type-check` | PASS |
| `npm run build` | PASS |
| `/designer/design/:designId` 三档渲染 | PASS（路由 Mock 数据） |
| 浏览器控制台 | 0 error / 0 warning |
| 空间、设计项、项目库选择器渲染 | PASS（路由 Mock 数据） |
| 真实 Provider 写入与权限负向 | 待真实设计师账号登录后补验 |

## 数据说明

本轮截图使用 Playwright 路由 Mock 提供合成方案、空间和设计项数据，仅用于验证信息架构、表格密度、空间管理与设计项编辑入口。

**这不是 G3 真实数据验收，也不代表空间 / 设计项写操作已在真实服务端通过。**

## 截图

- `raw/screenshots/DESIGNER-DESIGN-WORKSPACE-1440x900.png`
- `raw/screenshots/DESIGNER-DESIGN-WORKSPACE-1280x800.png`
- `raw/screenshots/DESIGNER-DESIGN-WORKSPACE-1024x768.png`

## 后续必须补验

1. 使用真实设计师账号打开真实方案，验证空间和设计项的增删改。
2. 验证报价项目库检索、项目带入和不同计价模式。
3. 验证非本人方案、非设计师角色和其他设计师方案均被拒绝。
4. 真实数据下验证 1440 / 1280 / 1024 三档和键盘路径。
5. 设计项图片、方案图纸上传和 CAD / 平面图进后续文件能力批次。
