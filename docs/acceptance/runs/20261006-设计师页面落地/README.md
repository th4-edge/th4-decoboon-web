# 设计师 Web 页面落地 · 布局冒烟验收

- 日期：2026-10-06
- 批次：`DESIGNER-SHELL-SMOKE-20261006`
- 环境：本地 Vite `http://127.0.0.1:8080`，后端 `http://127.0.0.1:8090`
- 页面：
  - `/designer/workbench`
  - `/designer/quotes`
  - `/designer/quotes/:quoteId`
- 分辨率：1440×900 / 1280×800 / 1024×768（报价工作区）

## 本轮完成

1. 新增正式设计师壳层 `DesignerLayout`，包含今日工作、报价工作台、客户与设计、合同交接、项目工地、报价项目库、我的业绩导航。
2. 新增 `/designer/workbench` 今日工作页：报价总数、待处理、待客户确认、待合同交接和报价行动队列。
3. 新增 `/designer/quotes` 报价池列表：推进中、待客户确认、待交接/已转项目、历史版本筛选，支持搜索和直接输入 `quoteId` 打开工作区。
4. 将原 dev-only 报价工作区提升为正式 `/designer/quotes/:quoteId` 页面；`/__preview/quote` 继续保留为开发预览。
5. 报价工作区补齐返回报价池、删除报价行、提交客户确认；提交/删除复用 App 既有 Provider。
6. 版本对比补齐行级新增 / 删除 / 变化与差额展示，支持切换到对比版本。
7. 补齐 Excel 导入预览 / 确认落库、Excel 工作簿导出和客户版 PDF 导出；后端 Provider 为 `quote/workbook/import|apply|build` 与 `document/quote/build`。
5. 登录后设计师跳转 `/designer/workbench`；非设计师访问 `/designer/**` 进入无权限页。

## 验证结论

| 项 | 结果 |
| --- | --- |
| `npm run type-check` | PASS |
| `npm run build` | PASS |
| `/designer/workbench` 渲染 | PASS（布局冒烟，数据为路由 Mock） |
| `/designer/quotes` 渲染 | PASS（布局冒烟，数据为路由 Mock） |
| `/designer/quotes/:quoteId` 渲染 | PASS（布局冒烟，数据为路由 Mock） |
| 浏览器控制台 | 0 error / 0 warning |
| 未登录访问 `/designer/**` | 跳转登录并保留 redirect |
| 非设计师访问 `/designer/**` | 代码路径已实现跳转 `/forbidden`，待真实账号负向验证 |

## 数据说明

本轮截图使用 Playwright 路由 Mock 提供合成报价数据，仅用于验证壳层、列表和三栏工作区是否可渲染。

**这不是 G3 真实数据验收，不代表报价功能已全部完成。** 原本地测试账号口令已于 2026-10-06 03:54 被外部会话重置，真实设计师账号登录与真实 Provider 数据复验必须由用户当前有效账号完成。

## 截图

- `raw/screenshots/DESIGNER-WORKBENCH-1440x900.png`
- `raw/screenshots/DESIGNER-QUOTES-1440x900.png`
- `raw/screenshots/DESIGNER-QUOTE-WORKSPACE-1440x900.png`
- `raw/screenshots/DESIGNER-QUOTE-WORKSPACE-1280x800.png`
- `raw/screenshots/DESIGNER-QUOTE-WORKSPACE-1024x768.png`

## 后续必须补验

1. 使用真实设计师账号进入 `/designer/workbench` 和 `/designer/quotes`。
2. 使用真实报价 ID 打开 `/designer/quotes/:quoteId`，验证真实 Provider 数据、保存、版本切换、驳回重报和权限。
3. 补真实数据下的 1280 / 1024 三档截图与键盘路径。
4. 表头批量改价、行级版本差异、Excel 导入导出与 PDF 导出已实现，待真实 Provider 验证。
5. 批量套模板受 `GAP-WEB-003` OPEN 阻塞，需先定义 App 兼容模板 Provider。
6. 多行选择删除继续补齐。
