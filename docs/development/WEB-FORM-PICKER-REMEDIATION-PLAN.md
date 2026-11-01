# Web 表单与选择器升级计划

> 执行规范：`docs/standards/WEB-业务选择器与表单设计规范.md`
> 全量清单：`docs/development/WEB-FORM-PICKER-INVENTORY.md`
> 生成命令：`npm run audit:forms:write`

## 1. 当前盘点

当前静态扫描结果以 `WEB-FORM-PICKER-INVENTORY.md` 为准。升级不能一次性盲改，必须先按业务风险和复用价值分批处理。

### 治理层

- 业务概念注册表：`docs/standards/business-concepts.json`。
- 全生命周期规范：`docs/standards/WEB-业务概念全生命周期规范.md`。
- 自动检查：`npm run check:concepts`，必须与 `npm run check:forms` 同时通过。
- 状态机治理：`docs/standards/business-state-machines.json`，自动检查 `npm run check:states`；状态 META、转换和跨对象回读必须同时通过。
- 动作治理：`docs/standards/business-action-policies.json`，自动检查 `npm run check:actions`；权限、前置条件、幂等、审计和关联刷新范围必须同时通过。
- 指标治理：`docs/standards/business-metric-definitions.json`，自动检查 `npm run check:metrics`；公式、分母、缺失值和成本完整性必须同时通过。
- 权限治理：`docs/standards/business-permission-policies.json`，自动检查 `npm run check:permissions`；角色、数据范围和敏感字段边界必须同时通过。
- 页面系统治理：页面状态、字段格式、页面任务、组件行为和验收场景五份注册表，自动检查 `npm run check:page-system`。

## 2. 批次

### 已完成

- 财务财务壳层和财务菜单。
- 项目选择器：`ProjectPicker.vue`。
- 账务分类树：`LedgerCategoryPicker.vue`。
- 应收、应付、工人选择器。
- 财务单据二轮升级：应收收据、应付单、收款单、付款单、手工记账单统一为“业务上下文 + 可编辑单据正文 + 业务结果/约束侧栏”。
- 应收、应付选择器二轮升级：不再复用通用远程平铺列表，改为按项目、逾期、临期、付款优先级和状态展示业务卡片的专用选择器。
- 员工选择器与提成计提抽屉：员工从 `el-select` 升级为 EmployeePicker，项目使用 ProjectPicker，提成计提改为业务单据 + 结果侧栏。
- 2026-11-01 员工选择器 P1 收口：`EmployeePicker` 改为服务端搜索/筛选/数据库分页，默认 20 条、硬上限 50 条；已选员工按 `empId` 回读。负责人、设计师、项目经理、支持人、任务负责人和设计运营筛选完成接入；表单使用全宽员工卡，筛选使用紧凑摘要。证据见后端 `docs/acceptance/runs/20261101-web-employee-picker/`，变更 `CHG-20261101-016`。
- 2026-11-01 财务与项目筛选 P1 收口：员工薪酬发放“待发应付”接入 `EmployeePayablePicker`，客户退款“原收款”接入 `ReceiptPicker`；`ProjectPicker` 的设计师/项目经理筛选改用紧凑员工选择器并移除全量员工预取和 200 条项目兜底。证据见后端 `docs/acceptance/runs/20261101-web-finance-project-pickers/`，变更 `CHG-20261101-017`。
- 客户专用选择器：负责人、状态、最近跟进、客户卡片、阶段筛选和分页加载语义。
- 房屋专用选择器：必须绑定当前客户，按客户加载，展示小区、楼栋、房号、面积、户型和量房状态，禁止默认第一套。
- 财务表格筛选中的枚举 select。
- 新增应收节点：单据化录入、项目上下文、项目资金参考、内联类型 checkbox。
- 中文日期控件和 Element Plus 中文 locale。

### 批次 A：高风险业务上下文与单据（进行中）

已完成：

- `DesignerContractChangesView.vue` 的发起增减项从传统字段弹窗升级为“项目/合同上下文 + 可编辑变更单据 + 结果预览”。
- `DesignerContractChangesView.vue` 的客户现场签认升级为“项目/合同/增减项上下文 + 客户签认单 + 签名/照片两个必交证据区 + 登记结果侧栏”。
- `FinanceVoucherTemplatesView.vue` 的快速版式完成审计和布局升级：设置区与实时凭证结果区并列，结果区在宽屏保持可见；高级设计器继续作为专业画布保留，不强制单据化。
- `DesignerContractHandoffView.vue` 完成审计：待交接报价、合同事实、项目事实和沟通记录均使用前置展示结构，不包含下拉式业务对象选择，无需强行改造。
- 已用设计师真实账号完成浏览器验证；提交接口、审批、客户签认和状态机边界未改变。

待处理：

- 任何带项目、客户、房屋、金额、收付款、成本的抽屉或弹窗。

升级要求：

- 业务对象信息区全宽。
- 单据形态动作按 `T17` 判断是否单据化。
- 颜色按区域，不逐字段着色。
- 普通枚举使用传统 select。
- 结果对象不再重复预览。

### 批次 B：设计师客户与项目工作区

文件：

- `DesignerCustomersView.vue`
- `DesignerDesignWorkspaceView.vue`
- `DesignerMaterialSelectionView.vue`
- `DesignerAcceptanceView.vue`
- `DesignerPerformanceView.vue`

先判断每个表单是简单设置、业务单据还是复合上下文，不强制全部改成单据化。

已完成：

- `DesignerCustomersView.vue`：新增客户/房屋精确切换器；移除多房屋自动选第一套；量房、方案、设计诉求等弹窗统一增加客户/房屋上下文和 T16 表单分区。
- `DesignerDesignWorkspaceView.vue`：新增客户/房屋/方案业务上下文；空间弹窗改为上下文条 + 2 列表单；设计分项继续保留专业表格和报价项目专用选择器。
- `DesignerAcceptanceView.vue`：阶段验收提交/复验从传统字段弹窗升级为“项目/客户/房屋/阶段上下文 + 验收提交单 + 业主确认结果预览”，明确员工不得代确认或代驳回。

### 批次 C：报价工作区专业弹窗

文件：

- `DesignerQuoteWorkspaceView.vue`
- `DesignCatalogPicker.vue`
- `DesignItemSheet.vue`

报价工作区保留专用表格与对象工作空间，不把报价编辑降级成通用表单。

审计结论：

- `DesignerQuoteWorkspaceView.vue` 保留专业报价表、公式栏、版本对比、Excel 导入预览和 PDF 导出；批量改价补入报价/作用范围上下文与结果预览，普通枚举继续使用 select。
- `DesignCatalogPicker.vue` 作为报价分项专用选择器保留分类树、品牌/系列/规格、区域、多选数量能力。
- `DesignItemSheet.vue` 保留专业分项表格和自动保存机制。

### 批次 D：筛选器和轻表单

处理：

- 角色/状态/类型筛选器。
- 简单设置表单。
- 登录和系统级表单。

这些场景优先保持传统 select/input，不强行单据化。

审计结论：

- `DesignerCatalogView.vue` 保留类型标签、搜索、分类/品牌/系列/规格传统 select 和只读项目表；依赖筛选会清空系列/规格，页面无横向溢出。
- `DesignerProjectsView.vue` 保留项目关键词、状态筛选、项目列表和项目详情；状态为封闭枚举，继续使用传统 select。
- `LoginView.vue` 是轻量登录表单，already 使用 top label、校验和错误恢复，不引入业务选择器。

## 3. 每个文件的升级判定

```text
是否包含业务对象选择？
├─ 是：专用选择器 + 全宽上下文摘要
└─ 否
   ├─ 是否有稳定单据形态？
   │  ├─ 是：T17 单据化表单
   │  └─ 否：T16 四区表单
   └─ 是否只有少量短字段？
      └─ 是：轻量表单即可
```

## 4. 完成门槛

- 文件在清单中不再标记“待审计/升级”。
- 业务对象选择器引用正确。
- 没有长对象名称挤压左右栅格的问题。
- 没有逐字段彩色背景。
- 简单选择使用传统控件。
- 单据化动作没有字段表单与预览重复。
- 三档浏览器截图和关键流程验证完成。
