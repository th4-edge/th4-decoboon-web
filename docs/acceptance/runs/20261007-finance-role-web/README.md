# 2026-10-07 · 财务角色 Web G1 渲染与闭环验收

## 范围

- 批次：`FINANCE-G1-20261007`
- 业务裁决：`ANS-BIZ-20261007-001`
- 产品基线：`docs/product/finance/FINANCE-G1-迭代包.md`
- 角色：Finance
- 真实账号：吴濛濛（19900000002）；本地验收临时口令已按原凭证行恢复
- 后端：本地 dev `http://127.0.0.1:8090`
- Web：本地 Vite `http://127.0.0.1:8080`

## 交付页面

| 页面 | 路由 | 结果 |
| --- | --- | --- |
| 财务工作台 | `/finance/workbench` | PASS |
| 应收计划 | `/finance/receivables` | PASS |
| 收款记录 | `/finance/receipts` | PASS |
| 应付账款 | `/finance/payables` | PASS |
| 工人工资 | `/finance/salaries` | PASS |
| 付款记录 | `/finance/payments` | PASS |
| 供应商往来 | `/finance/partners` | PASS |
| 资金台账 | `/finance/ledger` | PASS |
| 项目账本 | `/finance/projects` | PASS |
| 项目核算 | `/finance/projects/:projectId` | PASS |
| 收付凭证 | `/finance/vouchers` | PASS |
| 凭证模板 | `/finance/voucher-templates` | PASS |

## 验证项

### 构建

```text
npm run type-check -> PASS
npm run build      -> PASS
```

### 真实浏览器

- 财务账号登录后自动进入 `/finance/workbench`，顶部数据范围为 `Company`。
- 12 个财务路由均可直接打开，页面标题与核心业务区块存在。
- `finance/summary/report`、`project/page`、`receivable/page`、`receipt/page`、`payable/page`、`partner-ledger/report`、`ledger/page`、`document/voucher/page`、`document/template/page` 均通过页面真实调用。
- 浏览器会话新增：`Errors: 0, Warnings: 0`。
- 财务角色访问 `/designer/workbench` 跳转 `/forbidden`，角色路由隔离 PASS。
- 资金台账只读多选后，“批量生成凭证”按钮由 disabled 变为可点击；未执行真实生成，避免污染测试数据。
- 应收新增抽屉、手工记账抽屉均可打开，必填项与业务说明完整。
- 凭证模板页已修复 `el-checkbox-group` 对象绑定告警；复测错误/警告均为 0。

### 三档分辨率

截图位于 `output/playwright/finance-g1/`：

- `workbench-1440.png` / `workbench-1280.png` / `workbench-1024.png`
- `receivables-1440.png` / `receivables-1024.png`
- `ledger-1440.png` / `ledger-1024.png`
- `project-detail-1440.png` / `project-detail-1024.png`
- `voucher-templates-1440.png` / `voucher-templates-1024.png`

### 口径校验

- 财务总览实际返回“成本未完整”，页面显示成本完整度而不是 0 利润。
- 项目账本在 `costComplete=false` 时显示“成本未完整”，利润与毛利率不回填 0。
- 工人工资页面与员工工资/提成明确分链；后者登记为 `GAP-WEB-006`。
- 凭证金额、凭证号、合并条件、重打和模板能力均复用 App 已有 Provider，无 Web 专属 API。

## 注意

- 本轮为本地 dev 验收，不等于生产发布或生产真实用户验收。
- 未执行新增/修改业务数据的提交动作；页面写链路按 App 既有 Provider 契约和表单校验完成静态/可交互检查。
- 生产发布仍受 Web 重建版部署边界约束。

## 2026-10-07 选择器与中文日期纠偏

- 纠偏依据：业务智能体 `DEC-021` / `BR-019` / `ANS-BIZ-20261007-004`。
- 项目选择器改为项目专用选择器：项目状态分组、正常/接管来源、设计师、常用项目、名称/编号/客户/地址搜索。
- 账务分类改为树形选择器，保留一级/二级、方向、启用状态和路径。
- 应收、应付、工人使用各自专用选择器，不再复用同一个平铺业务列表。
- Web 增加 Element Plus `zhCn` 全局 locale。
- 浏览器验证：项目选择器打开成功；账务分类显示树节点；日期面板显示“2026 年 / 10 月 / 星期日 / 星期一”等中文。
- 证据截图：`output/playwright/picker-standard/`。

## 2026-10-07 项目选择器引导式布局

- 纠偏依据：`DEC-022` / `BR-020` / `ANS-BIZ-20261007-005`。
- 选择器打开即展示项目卡片，模糊搜索降为“精细查找”。
- 左侧按门店、设计师、项目经理定位。
- 顶部按项目状态、正常/接管来源筛选。
- 卡片标注合同金额、状态、来源、设计负责人、施工负责人、当前阶段、项目编号和客户/地址。
- 服务端新增向后兼容的 `storeId`、`managerId` 查询参数。
- 真实浏览器验证：项目经理“王昌富”筛选后从 17 个项目收敛到 5 个；控制台 0 error/0 warning。
- 三档截图：`output/playwright/picker-standard/web-project-picker-1440.png`、`web-project-picker-1024.png`。

## 2026-10-07 表单分区与结果确认

- 依据：`DEC-024` / `BR-022` / `ANS-BIZ-20261007-007`。
- 财务表单中的项目、应收、应付等业务对象选择改为全宽上下文卡片。
- 已选项目卡片展示状态、来源、合同金额、项目名称/编号、设计负责人、施工负责人和当前阶段。
- 金额、日期、账户、类型等短字段仍使用双列栅格。
- 应收、收款、应付、付款、手工台账均增加提交前结果预览区。
- 结果预览只描述当前提交将产生的结果，正式核验仍由服务端负责。
- 浏览器验证：项目选择后卡片高度稳定、长名称不挤压左右短字段，控制台 0 error/0 warning。

## 2026-10-07 结果对象驱动的单据化表单

- 依据：`DEC-025` / `BR-023` / `ANS-BIZ-20261007-008`。
- 新增应收节点已从“字段表单 + 结果预览”改为“可编辑应收节点单据”。
- 顶部使用全宽项目上下文卡片。
- 左侧直接编辑应收节点正文，右侧展示服务端项目资金参考。
- 不再保留重复的应收节点预览卡。
- 项目资金参考显示合同金额、累计已收、待收金额和逾期金额。
- 浏览器验证：选择项目后项目卡、应收单编辑区和资金参考同时显示，控制台 0 error/0 warning。
- 截图：`output/playwright/picker-standard/web-receivable-document-form-1440.png`。

## 2026-10-07 业务视觉层级与展开选择

- 依据：`DEC-026` / `BR-024` / `ANS-BIZ-20261007-009`。
- 已选项目卡改为满宽双区布局：左侧名称/编号/客户地址，右侧金额/设计/施工/阶段，长名称不再挤压右侧。
- 应收类型、应付类型、资金账户、账务用途改为展开式 `OptionTiles`，不再隐藏在 select 中。
- 应收金额使用成功色区域，到期日使用提醒色区域。
- 项目资金参考四项指标分别使用信息色、成功色、提醒色、警示色。
- 浏览器验证：选择项目后布局稳定，有限选项全部可见，控制台 0 error/0 warning。

## 2026-10-07 区域颜色与控件密度纠正

- 依据：`DEC-028` / `BR-026` / `ANS-BIZ-20261007-010`。
- 应收节点主体与项目资金参考都使用区域级柔和渐变，输入项恢复中性底色。
- 去除金额字段、日期字段和指标卡的逐项彩色背景。
- 应收类型、应付类型、资金账户、账务用途恢复传统 select；需要多选时使用传统 multi-select。
- 保留项目、客户等远程业务对象的专用选择器和已选摘要卡。
- 浏览器验证：应收节点表单中普通选项恢复下拉，项目资金参考保持渐变，控制台 0 error/0 warning。

## 2026-10-07 应收类型默认名称

- 选择应收类型时，如果节点名称为空，自动填入类型名称。
- 如果节点名称已有内容，不覆盖。
- 浏览器验证：空名称选择“尾款”后名称自动为“尾款”；已有“自定义节点名称”时切换类型保持不变。

## 2026-10-07 批次A：合同变更发起单据

- 文件：`src/views/designer/DesignerContractChangesView.vue`。
- 发起增减项从传统 label-width 表单升级为：
  - 项目 / 当前合同上下文；
  - 可编辑合同变更单据；
  - 变更类型、金额变化、原因和现场证据；
  - 右侧提交结果预览。
- 原 Provider 和审批/客户签认边界不变。
- 真实设计师账号浏览器验证：项目/合同上下文、变更单据、结果预览和证据上传入口均正常，控制台 0 error/0 warning。
- 截图：`output/playwright/designer-contract-change-document-1440.png`。

## 2026-10-07 批次A：客户现场签认单据

- 文件：`src/views/designer/DesignerContractChangesView.vue`。
- 依据：`DEC-015`（合同变更现场代登记）、`DEC-025`（结果对象驱动的单据化表单）、`DEC-028`（区域级颜色与控件密度）。
- 原“登记客户现场签认”字段弹窗升级为：
  - 项目 / 合同 / 增减项全宽上下文；
  - 客户签认单正文，展示变更编号、类型、金额变化和原因；
  - 客户签名与现场照片两个必交证据区；
  - 右侧“客户已确认”登记结果，展示证据数量、操作人和提交边界；
  - 前端同时要求签名和至少一张现场照片，原 `customerConfirmContractChange` 接口、权限和状态机不变。
- 使用真实设计师账号「董夏鹏 / 19900000005」打开待签认增减项 `BC1790210546083`，弹窗、项目/合同/增减项上下文、双证据区和结果侧栏均正常渲染。
- 几何复验：1440×900 下弹窗 920px，正文 888px；左单据区 612px、右结果区 260px；两个证据区各 283px；无页面横向溢出。
- 控制台：0 error / 0 warning。本轮未提交签认，未改变签认事实或合同金额。
- 截图：
  - `output/playwright/designer-customer-confirmation-document-1440.png`
  - `output/playwright/designer-customer-confirmation-document-1024.png`

## 2026-10-07 批次A：凭证模板快速版式与专业设计器审计

- 范围：`FinanceVoucherTemplatesView.vue`、`VoucherDesignerCanvas.vue`。
- 审计结论：
  - `VoucherDesignerCanvas.vue` 是字段库、画布、拖拽/缩放、页面边界、属性面板组成的专业编辑器，保留为专业画布，不强行改成业务单据表单。
  - `FinanceVoucherTemplatesView.vue` 的“快速版式”保留传统配置表单，但将实时凭证结果从设置区下方提升为独立结果区，解决用户在 1500px 以下看不到结果的问题。
- 调整：
  - 模板设置区与实时结果区在宽屏并列，结果区使用独立材料和背景层级；
  - 实时预览表格改为固定布局并允许长编号换行，消除内部横向溢出；
  - 1024 及以下恢复单列，避免窄屏挤压；
  - 保存、发布、停用、版本历史和 `document/template/*` Provider 语义不变。
- 真实浏览器验证（本地 dev）：
  - 1440×1000：设置区 392px、结果区 380px、纸张 354px；预览表格无横向溢出；页面无横向滚动；控制台 0 error/0 warning。
  - 1024×900：设置区 340px、结果区 380px；页面无横向滚动；控制台 0 error/0 warning。
  - 输入“测试实时凭证”后，单据标题和结果标题即时更新；未保存、未发布、未改变模板数据。
- 截图：
  - `output/playwright/finance-voucher-template-quick-editor-1440.png`
  - `output/playwright/finance-voucher-template-quick-editor-1024.png`

## 2026-10-07 批次B：客户/房屋专用选择器与上下文表单

- 业务依据：`DEC-021` / `BR-019`（对象专用选择器与统一使用机制）、`DEC-002` / `BR-001`（多房屋必须显式选择）、`DEC-028` / `BR-026`（区域级颜色与控件密度）。
- 新增：
  - `src/components/picker/CustomerPicker.vue`：客户专用选择器，进入即展示客户卡片，左侧按客户阶段引导，顶部搜索辅助；卡片展示姓名、状态、小区/地址、电话、等级、负责人和最近跟进。
  - `src/components/picker/PropertyPicker.vue`：房屋专用选择器，必须绑定当前客户；展示小区/楼栋/房号、面积、户型、房屋编号、状态和最近量房；没有客户上下文时禁用。
  - `src/components/CustomerPropertyContext.vue`：客户、房屋、当前方案的只读业务上下文条，用于表单结果确认前的事实核对。
- 修复：
  - `DesignerCustomersView.vue` 切换客户时清空当前房屋、量房和方案上下文。
  - 客户工作区加载房屋后不再自动选中第一套房屋，也不再跨房屋自动挂接方案。
  - 量房安排、量房结论、新建设计方案、设计诉求等弹窗统一改为“客户/房屋上下文 + 表单分区”，普通枚举继续使用传统 select。
  - `DesignerContractHandoffView.vue` 完成审计：待交接报价、合同事实、项目事实和沟通记录已经前置展示，不包含下拉式业务对象选择，无需强行改造。
- 真实浏览器验证（设计师「董夏鹏」，本地 dev）：
  - `/designer/customers` 首屏客户选择器显示当前客户 `王爱人`；房屋选择器显示“请选择房屋”，且没有任何 active 房屋标签。
  - 打开客户选择器后直接展示 20 张客户卡片和 9 个阶段入口，不要求先输入关键词。
  - 选择当前客户后，房屋选择器仍显示“请选择房屋”，房屋标签仍无 active；验证多房屋不自动兜底。
  - 打开房屋选择器后展示当前客户的房屋卡片 `望江台 403`，包含面积、户型、状态和最近量房；显式选择后才写入当前房屋。
  - 新建设计方案、登记量房结论、记录设计诉求弹窗均显示客户/房屋上下文，并使用 2 列表单分区；1440 下无页面横向溢出，控制台 0 error/0 warning。
  - 本轮只打开表单和选择器，未保存跟进、量房、方案或诉求数据。
- 截图：
  - `output/playwright/designer-customer-property-selectors-1440.png`
  - `output/playwright/designer-customer-picker-1440.png`
  - `output/playwright/designer-property-picker-1440.png`
  - `output/playwright/designer-scheme-context-dialog-1440.png`
  - `output/playwright/designer-measure-context-dialog-1440.png`
  - `output/playwright/designer-requirement-context-dialog-1440.png`

## 2026-10-07 批次B：设计方案工作区上下文与空间表单

- 范围：`DesignerDesignWorkspaceView.vue`、`DesignSchemeContext.vue`、`DesignItemSheet.vue`。
- 审计结论：
  - 设计分项编辑器是专业表格工作区，已经接入 `DesignCatalogPicker`，保留专业编辑形态，不降级为普通表单。
  - 空间弹窗属于简单字段表单，采用“客户/房屋/方案上下文 + 2 列表单”的 T16 结构。
- 修复：
  - 设计方案模型补入服务端已有的客户、房屋摘要投影。
  - 新增客户、房屋、方案上下文条，房屋状态将服务端 `Measured` 等枚举映射为中文。
  - 空间弹窗由 label-width 改为 label-position top；空间类型、名称、长宽高和备注分区展示。
- 真实浏览器验证（设计师账号，方案 `11D1791256970107`）：
  - 工作区上下文显示客户 `王爱人`、房屋 `望江台`、方案编号与版本。
  - 打开“新增空间”后显示同一客户/房屋/方案上下文，表单网格存在，页面无横向溢出。
  - 设计分项专业表格存在，报价项目专用选择器入口未改变。
  - 控制台 0 error/0 warning；本轮未保存空间或设计分项数据。
- 截图：
  - `output/playwright/designer-design-workspace-context-1440.png`
  - `output/playwright/designer-space-context-dialog-1440.png`

## 2026-10-07 批次B：阶段验收提交单

- 业务依据：`DEC-015`（阶段验收必须由业主本人确认或驳回，员工不得代录）、`BR-008`（阶段验收整改循环与结论追加）、`DEC-025`（有稳定单据形态的动作优先单据化）。
- 文件：`src/views/designer/DesignerAcceptanceView.vue`。
- 调整：
  - “提交阶段验收 / 提交复验”由传统 label-width 弹窗升级为单据化表单。
  - 全宽展示项目、客户与房屋、验收阶段、任务完成度。
  - 主区为“阶段验收提交单 / 阶段验收整改复验单”，包含验收说明、问题清单、现场证据；复验追加整改说明与整改后照片。
  - 右侧明确展示提交结果“待业主确认”、轮次、问题数、证据数和提交人。
  - 明确说明员工只提交验收事实，业主本人在授权会话中确认或驳回，员工不得代确认、代驳回或代录通过。
  - 服务端 `project/acceptance/save`、整改轮次 Provider、任务完成门禁和业主确认权限均未改变。
- 真实浏览器验证：
  - 设计师账号打开项目 `232968907537776640` 的 `/acceptance`，8 个施工阶段正常加载；当前“开工交底”已有 `Pending` 验收单，提交按钮按服务端事实正确禁用，未重复提交。
  - 对弹窗进行本地 dev 状态渲染校验：首次提交单据显示项目、客户/房屋、阶段 `开工交底`、`100% · 1 项任务 · 0 项未完成`，并有验收说明、问题清单、现场证据 3 个字段。
  - 复验分支显示整改说明和整改后照片，共 5 个字段；右侧包含“整改复验证据”检查项。
  - 页面无横向溢出，控制台 0 error/0 warning；未调用验收提交接口、未改变验收状态或证据。
- 截图：
  - `output/playwright/designer-acceptance-workspace-1440.png`
  - `output/playwright/designer-acceptance-submit-document-1440.png`
  - `output/playwright/designer-acceptance-resubmit-document-1440.png`

## 2026-10-07 批次B/C：设计师业绩审计与报价批量改价

### 设计师业绩

- 文件：`src/views/designer/DesignerPerformanceView.vue`。
- 审计结论：该页面是只读经营漏斗、月度交付和项目明细，不包含业务对象选择器或写入表单，保留专业分析视图，不强行单据化。

### 报价工作区批量改价

- 文件：`src/views/designer/DesignerQuoteWorkspaceView.vue`。
- 保留报价专业表格、公式栏、版本对比、Excel 导入预览和 PDF 导出，不降级为通用表单。
- 批量改价弹窗补齐：
  - 报价编号、版本、客户、房屋；
  - 作用范围“全部报价行”和实际行数；
  - 改价字段、改价方式、数值的 T16 分区；
  - 结果预览，例如“材料价统一设置为 100.00”；
  - 明确只修改本地草稿，保存后由服务端统一重算。
- 真实设计师报价 `Q1791255843140` V3 浏览器验证：批量改价入口可用，上下文显示 6 行作用范围；输入 100 后预览实时显示“材料价统一设置为 100.00”；无横向溢出，控制台 0 error/0 warning。
- 本轮点击批量改价后关闭弹窗，未点击应用、未保存报价，未改变服务端行数据。
- 截图：
  - `output/playwright/designer-quote-workspace-batch-audit-1440.png`
  - `output/playwright/designer-quote-batch-price-dialog-1440.png`

## 2026-10-07 批次D：轻量筛选与登录表单审计

- 范围：`DesignerCatalogView.vue`、`DesignerProjectsView.vue`、`LoginView.vue`。
- 结论：
  - 报价项目库保留类型标签、搜索、分类/品牌/系列/规格传统 select 和只读项目表；依赖筛选会清空系列/规格，不强行改造成专用弹窗选择器。
  - 项目工地保留项目关键词、状态筛选、项目列表和项目详情；状态是封闭枚举，继续使用传统 select。
  - 登录页已是 top label 轻量表单，包含手机号/密码校验、错误提示和恢复路径，不引入业务选择器。
- 真实浏览器冒烟（设计师账号，1440×1000）：
  - `/designer/catalog`：6 个类型标签、5 个筛选项、100 条只读项目行正常加载；无横向溢出，控制台 0 error/0 warning。
  - `/designer/projects`：项目关键词、状态筛选、10 个参与项目和当前项目详情正常加载；无横向溢出，控制台 0 error/0 warning。
  - 本轮为只读冒烟，未切换服务端数据或保存任何表单。
- 截图：
  - `output/playwright/designer-catalog-filter-audit-1440.png`
  - `output/playwright/designer-projects-filter-audit-1440.png`

## 2026-10-07 财务单据二轮优化（应收、应付、收款、付款、手工记账）

- 纠偏说明：此前“已接入专用选择器”被误标为财务表单完成，但未逐项复核 `DEC-025/026/028` 和 T17。本轮重新打开五类财务抽屉，按“业务上下文 + 可编辑单据正文 + 业务结果/约束侧栏”统一升级。
- 公共组件：`src/components/finance/FinanceDocumentLayout.vue`，负责单据壳层、上下文区域、正文区和结果侧栏；具体字段仍由各业务抽屉定义。
- 改造：
  - 应收节点：保留原应收收据结构，项目上下文、内联应收类型、金额/日期正文和项目资金参考正常。
  - 应付单：改为宽幅应付单据，项目上下文 + 应付正文 + 待付款结果侧栏；展示类型、收款方、金额、到期日、来源单号。
  - 收款单：项目上下文 + 应收节点核销正文 + 原待收/本次收款/到账日结果侧栏；仍由服务端核销并写入台账。
  - 付款单：项目上下文 + 应付核销正文 + 原未付/本次付款/付款日期结果侧栏；工资付款继续强制选择工人。
  - 手工记账单：项目上下文 + 用途/方向/树形账务分类/金额正文 + 台账写入结果侧栏；更正原因和冲正重记边界保留。
- 真实浏览器验证（企业负责人可见财务角色路由，1440×1000）：
  - 新增应收、增加应付成本、登记客户收款、安排业务付款、手工记账均打开新单据壳层。
  - 应付/收款/付款/手工记账单据宽度分别为 1000/940/940/1000px，均无页面横向溢出。
  - 对应结果侧栏显示“待付款”“待服务端核销”“写入资金台账”，未重复堆叠字段表单。
  - 浏览器控制台 0 error/0 warning；本轮只打开抽屉，未提交任何资金、应收、应付或台账数据。
- 构建过程中发现并修复 `src/domains/finance/api.ts` 佣金调整关联对象读取的 TypeScript 类型回归，未改变接口字段和业务语义。
- 截图：
  - `output/playwright/finance-receivable-document-1440.png`
  - `output/playwright/finance-payable-document-1440.png`
  - `output/playwright/finance-collection-document-1440.png`
  - `output/playwright/finance-payment-document-1440.png`
  - `output/playwright/finance-ledger-document-1440.png`

### 应收、应付专用选择器纠偏

- 问题：`ReceivablePicker.vue`、`PayablePicker.vue` 最初复用 `RemoteSelectionShell` 平铺列表，只显示名称和摘要，没有按应收/应付对象模型提供筛选和决策数据，不符合 T15/DEC-023 与 BR-019。
- 修复：
  - `ReceivablePicker.vue` 改为应收专用选择器：项目上下文、全部待收/已逾期/7 天内到期/待收/部分收款/已收清/已关闭筛选，卡片展示类型、到期风险、应收金额、已收金额、待收金额、发票和项目。
  - `PayablePicker.vue` 改为应付专用选择器：项目上下文、逾期/临期/紧急/工人工资/待付款/部分付款/已付清/已关闭筛选，卡片展示类型、收款方、到期风险、应付金额、已付金额、未付金额和来源单号。
  - 已收清/已关闭应收、已付清/已关闭应付不可选择；选择后仍将原始对象回传给收款/付款单。
  - 移除 `finance/picker.ts` 中不再使用的通用应收、应付列表源，保留工人专用源。
- 真实浏览器验证：
  - 登记客户收款 → 选择待收节点：7 个筛选入口、20 张应收卡片，首卡显示“合同签约款 / 首期款 / 已逾期 13 天 / 应收 ¥10,675.77 / 待收 ¥10,675.77”，选择后回填金额和付款方。
  - 安排业务付款 → 选择待付应付单：9 个筛选入口、7 张应付卡片，首卡显示供应商款、到期日、应付/已付/未付金额和来源单号。
  - 两个选择器均无横向溢出，控制台 0 error/0 warning；未提交收款或付款。
- 截图：
  - `output/playwright/finance-receivable-picker-1440.png`
  - `output/playwright/finance-payable-picker-1440.png`

### 已选应收/应付回显与控件边界

- 已选回显升级：
  - 选择应收节点后，不再只显示“名称 + 一行描述”，而是与项目选择器一致的业务摘要卡。
  - 应收摘要卡展示：当前应收、状态、应收类型、待收金额、项目编号、应收金额、已收金额、待收金额和到期风险。
  - 应付摘要卡展示：当前应付、状态、应付类型、紧急付款、未付金额、项目、应付金额、已付金额、未付金额、到期日、收款方和来源单号。
- 控件边界：
  - 收款账户、付款账户、用途、方向等普通字段继续使用传统 select，不升级为 checkbox；依据 `DEC-028` / `BR-026`。
  - 只有“应收类型”这类单据核心类型保留紧凑 checkbox 特例，放在应收节点名称下方，业务语义仍是单值。
- 真实浏览器验证：
  - 收款单选择应收后，摘要卡显示“合同签约款 / 首期款 / 应收 ¥10,675.77 / 已收 ¥0 / 待收 ¥10,675.77 / 已逾期 13 天”。
  - 付款单选择应付后，摘要卡显示“期初未付供应商款 / 供应商款 / 应付 ¥50,000 / 已付 ¥0 / 未付 ¥50,000 / 到期日 2026-10-20 / 收款方 验收供应商 / 来源单号 AP-E2E-001”。
  - 账户控件仍为传统 select，显示“企业对公”；页面无横向溢出，控制台 0 error/0 warning。
- 截图：
  - `output/playwright/finance-collection-receivable-selected-card-1440.png`
  - `output/playwright/finance-payment-payable-selected-card-1440.png`

### 员工专用选择器与提成计提

- 问题：此前 `EmployeePicker` 只是把 `el-select` 换成简单名单，只展示姓名，没有角色、门店、团队、状态筛选，也没有项目式已选摘要卡，不能算规范完成。
- 数据源：扩展 `financeApi.employeeOptions`，接入薪酬员工 Provider 已返回的角色、状态、门店和团队白名单投影。
- 修复：
  - 员工角色统一归一化为 Boss、StoreManager、TeamLeader、Marketer、Designer、Pm、Finance 七类。
  - 弹窗左侧按角色、门店、团队筛选，顶部支持在职/全部状态和姓名/角色/门店/团队搜索。
  - 员工卡展示姓名、角色、门店、团队、状态和员工编号。
  - 已选回显升级为全宽摘要卡，展示当前员工、状态、角色、门店、团队和员工编号。
  - `FinanceCommissionDrawer.vue` 的项目改为 ProjectPicker，员工改为 EmployeePicker，提成计提改为业务单据 + 服务端计提结果侧栏。
- 真实浏览器验证：
  - 计提提成弹窗加载 10 名在职员工，显示 3 组筛选维度。
  - 员工卡正确显示“吴濛濛 / 在职 / 财务 / 总店 / 未分团队 / 员工编号”。
  - 选择后摘要卡显示“当前员工 / 在职 / 财务”，并展示角色、门店、团队、状态。
  - 页面无横向溢出，控制台 0 error/0 warning；未提交提成数据。
- 截图：
  - `output/playwright/finance-employee-picker-1440.png`
  - `output/playwright/finance-employee-selected-card-1440.png`

## 2026-10-07 业务概念全生命周期规范与自动门禁

- 问题根因：业务对象选择、已选回显、枚举中文、状态映射散落在页面，之前按文件审查只能发现局部问题，不能阻止新页面再次漏掉。
- 新增规范：`docs/standards/WEB-业务概念全生命周期规范.md`。
- 新增机器可读注册表：`docs/standards/business-concepts.json`，当前登记项目、客户、房屋、员工、工人、供应商/经销商、应收、应付、增减项、报价分项、账务分类。
- 新增检查：`npm run check:concepts`，检查注册完整性、专用选择器登记、远程对象误用 el-select、裸枚举渲染、选择器文件缺失和已选回显定义。
- 本次纠偏：
  - 员工选择器补齐角色、门店、团队、状态、员工编号和已选摘要卡。
  - 考勤、薪酬抽屉的员工选择从 el-select 改为 EmployeePicker。
  - 考勤状态、项目状态等裸枚举改为中文 META 映射。
  - 体检发现并修复了薪酬、考勤、提成、合同交接中的存量业务概念遗漏。
- 验证：
  - `npm run check:forms`：PASS。
  - `npm run check:concepts`：PASS，当前没有发现未登记的 Picker、远程对象 el-select 或裸枚举直接展示。
  - `npm run build`：PASS。
  - `knowledge.py validate`：PASS。

## 2026-10-07 业务状态机与闭环一致性规范

- 新增规范：`docs/standards/WEB-业务状态机与闭环一致性规范.md`。
- 新增机器注册表：`docs/standards/business-state-machines.json`，首批覆盖客户、房屋、项目、设计、报价、合同、增减项、应收、应付、验收、项目阶段和任务。
- 核心约束：
  - 状态只能由服务端事实裁决；
  - 前端只消费 `BusinessStateView`，不得自行推导正式状态；
  - 状态必须有中文 label 和 tone；
  - 动作可用性必须来自服务端 `allowedActions`，不得由页面自行拼接状态和角色条件；
  - 动作后必须声明关联对象刷新范围，并核对客户、房屋、项目、合同、账务和待办投影。
- 自动检查：`npm run check:states`，检查状态注册完整性、状态中文、transition 引用、必备状态机、业务概念枚举覆盖和裸状态展示，禁止通过前端猜测未裁决的状态转换。
- 当前结论：
  - `npm run check:states`：PASS。
  - 员工、工人、供应商/经销商的状态转换暂时标记为 `pending_business_review`，不得无依据补齐。
  - `npm run check:forms`、`npm run check:concepts`、`npm run build`、`knowledge.py validate`：PASS。

## 2026-10-07 业务动作与闭环注册规范

- 新增规范：`docs/standards/WEB-业务动作与闭环注册规范.md`。
- 新增注册表：`docs/standards/business-action-policies.json`，登记跟进、量房、设计、报价、合同、增减项、应收、收款、应付、付款、验收、阶段和任务动作。
- 每个动作登记：服务端 Provider、角色、数据范围、源状态、目标状态、前置条件、幂等、二次确认、审计、失败恢复、金额影响和关联刷新范围。
- `business-state-machines.json` 新增 `projectionScopes`，明确区分：
  - 可选择业务概念；
  - 有独立状态机的业务对象；
  - 只参与闭环刷新的派生投影，如 measure、receipt、payment、ledger、projectReport、tasks、materials、cost。
- 新增自动检查：`npm run check:actions`。
  - 状态机的 actionPolicy 必须能在动作注册表找到；
  - frozen 动作必须声明角色、权限、前置条件、幂等、审计、失败恢复；
  - 动作引用的对象、状态和刷新范围必须有效；
  - 金额动作必须声明账务/金额闭环范围。
- 当前结果：
  - `npm run check:actions`：PASS。
  - 业主确认/驳回阶段验收已标记为 frozen；其余未裁决动作继续标记为 `pending_business_review`，不由前端补造转换。

## 2026-10-07 业务指标与权限注册规范

- 新增规范：`docs/standards/WEB-业务指标与权限注册规范.md`。
- 新增指标注册表：`docs/standards/business-metric-definitions.json`，登记报价接受率、首版接受率、待决策报价量、项目毛利/毛利率、回款额、本月回款、待收、未付、现金流、账户余额、成本完整性、公司经营利润、API 响应时长和页面加载时长。
- 新增权限注册表：`docs/standards/business-permission-policies.json`，登记 Company/Store/Team/Self/ProjectParticipant/ProjectOwner、七类员工角色、Owner 外部主体、财务/成本/利润/薪酬/工人隐私和验收权限。
- 新增自动检查：
  - `npm run check:metrics`：公式、分子、分母、时间范围、排除项、缺失值、成本完整性和业务规则引用；
  - `npm run check:permissions`：角色、数据范围、敏感级别、动作角色和 Provider 边界。
- 当前状态：
  - `check:metrics` PASS；同时明确标记 `quoteFinalAcceptanceRate` 和 `monthReceiptAmount` 的实现差异，未修正前不得作为正式经营结果；
  - `check:permissions` PASS；
  - 公司经营利润保留 draft/pending，不进入 P0 实现。

## 2026-10-07 页面系统五层注册

- 新增规范：`docs/standards/WEB-业务页面系统注册规范.md`。
- 新增注册表：
  - `business-page-states.json`：loading、empty、error、unauthorized、expired、partial、stale、success；
  - `business-field-formats.json`：金额、比例、数量、日期、日期时间、枚举、状态、长文本、电话、身份证、银行卡、交易号、时长和布尔；
  - `business-page-tasks.json`：客户跟进、量房、设计推进、报价提交、收款、付款、验收、增减项确认和任务推进；
  - `business-component-behaviors.json`：业务选择器、表单/单据、抽屉/弹窗、表格、上传、状态显示、主行动按钮和异步数据壳层；
  - `business-acceptance-scenarios.json`：正常、拒绝、越权、并发和闭环场景。
- 新增自动检查：`npm run check:page-system`，交叉校验业务概念、状态机、动作和验收场景引用。
- 当前页面系统注册检查 PASS；未覆盖的页面必须补齐对应任务和验收场景后才能声明交付完成。
