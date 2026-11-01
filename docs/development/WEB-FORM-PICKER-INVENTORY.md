# Web 表单与选择器全量清单

> 由 `node scripts/audit-web-form-picker.mjs --write` 生成。
> 执行规范：`docs/standards/WEB-业务选择器与表单设计规范.md`。

## 汇总

- 涉及文件：88
- 表单：56
- 表单项：281
- 普通 select：65
- 原生 select：7
- 原生 input/textarea：53
- Dialog：48
- Drawer：40
- 专用选择器引用：39
- 风险标记：0

## 风险标记

- 未发现静态高风险模式。

## 文件清单

| 文件 | 批次 | 表单 | 表单项 | Select | 原生选择/输入 | Dialog | Drawer | 专用选择器 | 状态 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `src/components/QuoteSheetGrid.vue` | 批次 C | 0 | 0 | 0 | 6 | 0 | 0 | 0 | 专业编辑网格 |
| `src/components/StoreScopePicker.vue` | 批次 D | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 原生控件审计 |
| `src/components/customer/CustomerCreateSheet.vue` | 批次 D | 0 | 0 | 0 | 9 | 0 | 0 | 0 | 原生控件审计 |
| `src/components/customer/CustomerEditSheet.vue` | 批次 D | 0 | 0 | 0 | 11 | 0 | 0 | 0 | 原生控件审计 |
| `src/components/customer/CustomerFollowFormDrawer.vue` | 批次 D | 1 | 4 | 1 | 0 | 0 | 1 | 0 | 待审计/升级 |
| `src/components/customer/CustomerLossDrawer.vue` | 批次 D | 2 | 7 | 3 | 0 | 0 | 1 | 0 | 待审计/升级 |
| `src/components/design/RequirementFormDrawer.vue` | 批次 D | 1 | 7 | 3 | 0 | 0 | 1 | 0 | 待审计/升级 |
| `src/components/expense/ExpenseDetailDrawer.vue` | 批次 D | 1 | 6 | 1 | 0 | 1 | 1 | 0 | 待审计/升级 |
| `src/components/expense/ExpenseFormDrawer.vue` | 批次 D | 1 | 9 | 2 | 0 | 0 | 1 | 2 | 已接入专用选择器 |
| `src/components/finance/FinanceAttendanceDrawer.vue` | 已完成/样板 | 1 | 10 | 0 | 0 | 0 | 1 | 1 | 已完成：考勤单据 |
| `src/components/finance/FinanceCollectionDrawer.vue` | 已完成/样板 | 1 | 6 | 1 | 0 | 0 | 1 | 2 | 已完成：收款单据 |
| `src/components/finance/FinanceCommissionDrawer.vue` | 已完成/样板 | 1 | 5 | 0 | 0 | 0 | 1 | 2 | 已完成：提成单据 |
| `src/components/finance/FinanceCompensationDrawer.vue` | 已完成/样板 | 1 | 6 | 0 | 0 | 0 | 1 | 1 | 已完成：薪酬单据 |
| `src/components/finance/FinanceEmployeePaymentDrawer.vue` | 已完成/样板 | 1 | 4 | 1 | 0 | 0 | 1 | 1 | 已接入专用选择器 |
| `src/components/finance/FinanceLedgerDrawer.vue` | 已完成/样板 | 1 | 10 | 2 | 0 | 0 | 1 | 2 | 已完成：手工记账单 |
| `src/components/finance/FinanceMetricGlossary.vue` | 已完成/样板 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 事件/展示 |
| `src/components/finance/FinancePayableDrawer.vue` | 已完成/样板 | 1 | 9 | 1 | 0 | 0 | 1 | 1 | 已完成：应付单据 |
| `src/components/finance/FinancePaymentDrawer.vue` | 已完成/样板 | 1 | 8 | 1 | 0 | 0 | 1 | 3 | 已完成：付款单据 |
| `src/components/finance/FinanceReceivableDrawer.vue` | 已完成/样板 | 1 | 6 | 0 | 0 | 0 | 1 | 1 | 已完成：应收收据 |
| `src/components/finance/FinanceRefundDrawer.vue` | 已完成/样板 | 1 | 5 | 1 | 0 | 0 | 1 | 1 | 已接入专用选择器 |
| `src/components/finance/VoucherDesignerCanvas.vue` | 批次 A | 0 | 0 | 0 | 12 | 0 | 0 | 0 | 专业编辑器（保留） |
| `src/components/form/FileUploadField.vue` | 批次 D | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 原生控件审计 |
| `src/components/material/MaterialAssistant.vue` | 批次 D | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 事件/展示 |
| `src/components/picker/CustomerPicker.vue` | 已完成/样板 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 已完成：客户专用选择器 |
| `src/components/picker/EmployeePayablePicker.vue` | 已完成/样板 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 选择器参考实现 |
| `src/components/picker/EmployeePicker.vue` | 已完成/样板 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 已完成：员工专用选择器 |
| `src/components/picker/LedgerCategoryPicker.vue` | 已完成/样板 | 1 | 3 | 0 | 0 | 2 | 0 | 0 | 选择器参考实现 |
| `src/components/picker/PartnerPicker.vue` | 已完成/样板 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 选择器参考实现 |
| `src/components/picker/PayablePicker.vue` | 已完成/样板 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 已完成：应付专用选择器 |
| `src/components/picker/ProjectPicker.vue` | 已完成/样板 | 0 | 0 | 0 | 0 | 1 | 0 | 2 | 选择器参考实现 |
| `src/components/picker/PropertyPicker.vue` | 已完成/样板 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 已完成：房屋专用选择器 |
| `src/components/picker/ReceiptPicker.vue` | 已完成/样板 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 选择器参考实现 |
| `src/components/picker/ReceivablePicker.vue` | 已完成/样板 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 已完成：应收专用选择器 |
| `src/components/picker/RemoteSelectionShell.vue` | 已完成/样板 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 选择器参考实现 |
| `src/components/picker/WorkerPicker.vue` | 已完成/样板 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 选择器参考实现 |
| `src/components/property/PropertyFormDrawer.vue` | 批次 D | 1 | 7 | 0 | 0 | 0 | 1 | 0 | 待审计/升级 |
| `src/layouts/RoleAreaShell.vue` | 批次 D | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 事件/展示 |
| `src/views/account/AccountCenterView.vue` | 批次 D | 2 | 9 | 0 | 0 | 0 | 0 | 0 | 待审计/升级 |
| `src/views/account/MyAttendanceView.vue` | 批次 D | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 事件/展示 |
| `src/views/account/MyCommissionsView.vue` | 批次 D | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 事件/展示 |
| `src/views/account/MyPayslipsView.vue` | 批次 D | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 事件/展示 |
| `src/views/auth/LoginView.vue` | 批次 D | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 已完成：轻量表单 |
| `src/views/designer/DesignReviewView.vue` | 批次 D | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 已接入专用选择器 |
| `src/views/designer/DesignerAcceptanceView.vue` | 批次 B | 1 | 5 | 0 | 0 | 1 | 0 | 0 | 已完成：验收提交单 |
| `src/views/designer/DesignerCatalogView.vue` | 批次 D | 0 | 0 | 3 | 0 | 0 | 1 | 0 | 已完成：只读筛选 |
| `src/views/designer/DesignerContractChangesView.vue` | 批次 A | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 已完成 |
| `src/views/designer/DesignerContractHandoffView.vue` | 批次 D | 2 | 9 | 0 | 1 | 0 | 2 | 0 | 待审计/升级 |
| `src/views/designer/DesignerCustomerFeedbackView.vue` | 批次 D | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 事件/展示 |
| `src/views/designer/DesignerCustomersView.vue` | 批次 B | 4 | 22 | 3 | 1 | 3 | 1 | 0 | 已完成：客户房屋上下文 |
| `src/views/designer/DesignerDesignWorkspaceView.vue` | 批次 B | 1 | 9 | 1 | 0 | 1 | 0 | 0 | 已完成：方案上下文与空间表单 |
| `src/views/designer/DesignerFollowUpTasksView.vue` | 批次 D | 5 | 20 | 4 | 1 | 0 | 5 | 0 | 待审计/升级 |
| `src/views/designer/DesignerMaterialSelectionView.vue` | 批次 B | 1 | 6 | 0 | 0 | 0 | 0 | 0 | 字段编辑区 |
| `src/views/designer/DesignerMeasureTasksView.vue` | 批次 D | 4 | 13 | 2 | 1 | 0 | 4 | 0 | 待审计/升级 |
| `src/views/designer/DesignerMyCustomersView.vue` | 批次 D | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 原生控件审计 |
| `src/views/designer/DesignerProjectsView.vue` | 批次 D | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 已完成：项目列表筛选 |
| `src/views/designer/DesignerQuoteHistoryView.vue` | 批次 C | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 原生控件审计 |
| `src/views/designer/DesignerQuoteListView.vue` | 批次 C | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 原生控件审计 |
| `src/views/designer/DesignerQuoteQueueView.vue` | 批次 C | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 原生控件审计 |
| `src/views/designer/DesignerQuoteWorkspaceView.vue` | 批次 C | 1 | 3 | 3 | 1 | 4 | 0 | 0 | 已完成：专业工作区 |
| `src/views/designer/DesignerTemplateEditorView.vue` | 批次 D | 2 | 16 | 1 | 0 | 2 | 0 | 1 | 已接入专用选择器 |
| `src/views/designer/DesignerTemplateLibraryView.vue` | 批次 D | 1 | 6 | 4 | 0 | 1 | 0 | 0 | 待审计/升级 |
| `src/views/designer/components/CatalogMaintenanceDrawer.vue` | 批次 D | 4 | 17 | 3 | 0 | 0 | 1 | 0 | 待审计/升级 |
| `src/views/designer/components/DesignCatalogPicker.vue` | 批次 C | 0 | 0 | 1 | 0 | 0 | 1 | 0 | 选择器参考实现 |
| `src/views/designer/components/DesignItemSheet.vue` | 批次 C | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 已接入专用选择器 |
| `src/views/designer/components/DesignTemplateFormulaAssistant.vue` | 批次 D | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 事件/展示 |
| `src/views/designer/components/DesignTemplateItemSheet.vue` | 批次 D | 0 | 0 | 0 | 3 | 0 | 0 | 1 | 已接入专用选择器 |
| `src/views/designer/components/DesignerProjectMediaGrid.vue` | 批次 D | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 事件/展示 |
| `src/views/designer/components/ProjectMemberAssignSheet.vue` | 批次 D | 1 | 3 | 0 | 0 | 0 | 1 | 3 | 已接入专用选择器 |
| `src/views/designer/components/PropertyEditSheet.vue` | 批次 D | 0 | 0 | 0 | 7 | 0 | 0 | 0 | 原生控件审计 |
| `src/views/finance/FinanceCompensationSchemesView.vue` | 已完成/样板 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 筛选器审计 |
| `src/views/finance/FinanceExpensesView.vue` | 已完成/样板 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 已接入专用选择器 |
| `src/views/finance/FinanceLedgerView.vue` | 已完成/样板 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 筛选器审计 |
| `src/views/finance/FinanceMaterialOrderingView.vue` | 已完成/样板 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 已接入专用选择器 |
| `src/views/finance/FinanceMaterialSettlementView.vue` | 已完成/样板 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 已接入专用选择器 |
| `src/views/finance/FinancePayablesView.vue` | 已完成/样板 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 筛选器审计 |
| `src/views/finance/FinancePaymentsView.vue` | 已完成/样板 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 已接入专用选择器 |
| `src/views/finance/FinanceReceivablesView.vue` | 已完成/样板 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 筛选器审计 |
| `src/views/finance/FinanceVoucherTemplatesView.vue` | 批次 A | 3 | 10 | 3 | 0 | 0 | 0 | 0 | 已完成：快速版式实时结果 |
| `src/views/finance/FinanceVouchersView.vue` | 已完成/样板 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 筛选器审计 |
| `src/views/notice/NotificationCenterView.vue` | 批次 D | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 筛选器审计 |
| `src/views/pm/PmWorkbenchView.vue` | 批次 D | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 事件/展示 |
| `src/views/workbench/BossOrganizationView.vue` | 批次 D | 2 | 7 | 4 | 0 | 2 | 0 | 0 | 待审计/升级 |
| `src/views/workbench/MarketerCustomerView.vue` | 批次 D | 0 | 0 | 1 | 0 | 3 | 1 | 1 | 已接入专用选择器 |
| `src/views/workbench/MarketerProjectsView.vue` | 批次 D | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 事件/展示 |
| `src/views/workbench/ProjectExecutionView.vue` | 批次 D | 3 | 12 | 3 | 0 | 3 | 0 | 1 | 已接入专用选择器 |
| `src/views/workbench/RiskQueueView.vue` | 批次 D | 0 | 0 | 0 | 0 | 4 | 1 | 1 | 已接入专用选择器 |
| `src/views/workbench/StoreCustomerView.vue` | 批次 D | 0 | 0 | 1 | 0 | 2 | 0 | 3 | 已接入专用选择器 |
| `src/views/workbench/TeamCustomerView.vue` | 批次 D | 0 | 0 | 0 | 0 | 1 | 0 | 2 | 已接入专用选择器 |

## 明细

### src/components/QuoteSheetGrid.vue

状态：专业编辑网格

#### nativeInput

- L321: `<input`
- L381: `<input`
- L401: `<input`
- L416: `<input`
- L431: `<input`
- L446: `<input`

### src/components/StoreScopePicker.vue

状态：原生控件审计

#### nativeSelect

- L71: `<select`

### src/components/customer/CustomerCreateSheet.vue

状态：原生控件审计

#### nativeInput

- L99: `<label><span>客户姓名 *</span><input v-model="basic.name" type="text" placeholder="请输入姓名" /></label>`
- L100: `<label><span>手机号 *</span><input v-model="basic.telNo" type="tel" placeholder="11 位手机号" /></label>`
- L115: `<label><span>小区</span><input v-model="basic.community" type="text" placeholder="小区名称" /></label>`
- L116: `<label><span>详细地址</span><input v-model="basic.addr" type="text" placeholder="楼栋房号或详细地址" /></label>`
- L117: `<label><span>面积（㎡）</span><input v-model="basic.area" type="number" min="0" placeholder="如 120" /></label>`
- L118: `<label><span>预算（元）</span><input v-model="basic.budget" type="number" min="0" placeholder="如 200000" /></label>`

#### nativeSelect

- L103: `<select v-model="basic.gender">`
- L110: `<select v-model="basic.source">`

#### textarea

- L119: `<label class="grid__wide"><span>备注</span><textarea v-model="basic.remark" rows="2" placeholder="补充说明" /></label>`

### src/components/customer/CustomerEditSheet.vue

状态：原生控件审计

#### nativeInput

- L172: `<label><span>客户姓名 *</span><input v-model="basic.name" type="text" placeholder="请输入姓名" /></label>`
- L173: `<label><span>手机号</span><input v-model="basic.telNo" type="tel" placeholder="11 位手机号" /></label>`
- L188: `<label><span>小区</span><input v-model="basic.community" type="text" placeholder="小区名称" /></label>`
- L189: `<label><span>详细地址</span><input v-model="basic.addr" type="text" placeholder="楼栋房号或详细地址" /></label>`
- L190: `<label><span>面积（㎡）</span><input v-model="basic.area" type="number" min="0" placeholder="如 120" /></label>`
- L191: `<label><span>预算（元）</span><input v-model="basic.budget" type="number" min="0" placeholder="如 200000" /></label>`
- L219: `<input v-model="concerns" type="checkbox" :value="item.value" />`

#### nativeSelect

- L176: `<select v-model="basic.gender">`
- L183: `<select v-model="basic.source">`
- L209: `<select v-model="portrait[field.key]">`

#### textarea

- L192: `<label class="grid__wide"><span>备注</span><textarea v-model="basic.remark" rows="2" placeholder="补充说明" /></label>`

### src/components/customer/CustomerFollowFormDrawer.vue

状态：待审计/升级

#### drawer

- L113: `<el-drawer v-model="visible" :title="title" size="520px" direction="rtl" append-to-body>`

#### form

- L115: `<el-form label-position="top">`

#### formItem

- L116: `<el-form-item label="跟进方式">`
- L121: `<el-form-item label="跟进内容" required>`
- L131: `<el-form-item label="现场图片（选填，最多 9 张）">`
- L141: `<el-form-item label="下次跟进时间">`

#### select

- L117: `<el-select v-model="form.way" style="width: 100%">`

### src/components/customer/CustomerLossDrawer.vue

状态：待审计/升级

#### drawer

- L141: `<el-drawer`

#### form

- L163: `<el-form label-position="top" class="cld__form">`
- L183: `<el-form label-position="top" class="cld__form">`

#### formItem

- L164: `<el-form-item label="恢复后的客户阶段">`
- L169: `<el-form-item label="恢复说明">`
- L184: `<el-form-item v-if="propertyId" label="流失范围" required>`
- L190: `<el-form-item label="流失阶段" required>`
- L195: `<el-form-item label="流失原因" required>`
- L200: `<el-form-item label="竞争对手名称">`
- L203: `<el-form-item :label="form.reasonCode === 'Other' ? '补充说明（必填）' : '补充说明'">`

#### select

- L165: `<el-select v-model="form.restoreStatus" style="width: 100%">`
- L191: `<el-select v-model="form.stage" style="width: 100%">`
- L196: `<el-select v-model="form.reasonCode" placeholder="请选择客户流失原因" style="width: 100%">`

### src/components/design/RequirementFormDrawer.vue

状态：待审计/升级

#### drawer

- L96: `<el-drawer :model-value="modelValue" title="记录客户诉求" size="560px" direction="rtl" append-to-body @update:model-value="emit('update:modelValue', $event)">`

#### form

- L100: `<el-form label-position="top">`

#### formItem

- L101: `<el-form-item label="诉求类型">`
- L106: `<el-form-item label="分类">`
- L111: `<el-form-item label="优先级">`
- L116: `<el-form-item label="空间（选填）">`
- L119: `<el-form-item label="标题" required>`
- L122: `<el-form-item label="详细说明">`
- L125: `<el-form-item label="设计回应">`

#### select

- L102: `<el-select v-model="form.kind" style="width: 100%">`
- L107: `<el-select v-model="form.category" style="width: 100%">`
- L112: `<el-select v-model="form.priority" style="width: 100%">`

### src/components/expense/ExpenseDetailDrawer.vue

状态：待审计/升级

#### drawer

- L301: `<el-drawer`

#### dialog

- L500: `<el-dialog v-model="paymentVisible" title="安排费用付款" width="min(620px, 92vw)" append-to-body>`

#### form

- L502: `<el-form label-position="top" class="finance-form-grid" @submit.prevent>`

#### formItem

- L503: `<el-form-item label="本次付款">`
- L506: `<el-form-item label="付款账户">`
- L511: `<el-form-item label="付款日期">`
- L514: `<el-form-item label="收款方">`
- L517: `<el-form-item label="交易号" class="finance-form-grid__wide">`
- L520: `<el-form-item label="备注" class="finance-form-grid__wide">`

#### select

- L507: `<el-select v-model="paymentForm.account" style="width:100%">`

### src/components/expense/ExpenseFormDrawer.vue

状态：已接入专用选择器

#### drawer

- L258: `<el-drawer`

#### form

- L300: `<el-form label-position="top" class="finance-form-grid" @submit.prevent>`

#### formItem

- L301: `<el-form-item label="费用支付方式" class="finance-form-grid__wide">`
- L312: `<el-form-item label="费用归属" class="finance-form-grid__wide">`
- L324: `<el-form-item v-if="form.projectScope === 'enterprise'" label="归属门店" class="finance-form-grid__wide">`
- L337: `<el-form-item label="费用分类" required>`
- L345: `<el-form-item label="金额" required>`
- L350: `<el-form-item label="费用发生日期" required>`
- L353: `<el-form-item label="费用归属员工" :required="form.paymentMode === 'Reimbursement'">`
- L369: `<el-form-item label="费用说明" class="finance-form-grid__wide" required>`
- L380: `<el-form-item label="证据附件" class="finance-form-grid__wide" :required="true">`

#### specializedPicker

- L318: `<ProjectPicker v-model="form.projectId" placeholder="选择费用所属项目" clearable :disabled="lockedAfterSubmission" @change="onProjectChange" />`
- L354: `<EmployeePicker`

#### select

- L338: `<el-select v-model="form.categoryId" :loading="categoriesLoading" placeholder="选择费用分类" style="width: 100%">`
- L382: `<el-select v-model="form.evidenceType" style="width: 180px">`

### src/components/finance/FinanceAttendanceDrawer.vue

状态：已完成：考勤单据

#### drawer

- L258: `<el-drawer :model-value="visible" title="月度考勤" size="min(1160px, 96vw)" destroy-on-close @update:model-value="emit('update:visible', $event)">`

#### form

- L261: `<el-form label-position="top" class="finance-form-grid" @submit.prevent>`

#### formItem

- L262: `<el-form-item label="员工" class="finance-form-grid__wide">`
- L265: `<el-form-item label="工资月份">`
- L277: `<el-form-item label="正常出勤"><el-input v-model="form.normalDays" type="number" min="0" max="31" /></el-form-item>`
- L278: `<el-form-item label="事假"><el-input v-model="form.personalLeaveDays" type="number" min="0" max="31" /></el-form-item>`
- L279: `<el-form-item label="病假"><el-input v-model="form.sickLeaveDays" type="number" min="0" max="31" /></el-form-item>`
- L280: `<el-form-item label="旷工"><el-input v-model="form.absenceDays" type="number" min="0" max="31" /></el-form-item>`
- L281: `<el-form-item label="外勤"><el-input v-model="form.externalDays" type="number" min="0" max="31" /></el-form-item>`
- L282: `<el-form-item label="年假"><el-input v-model="form.annualLeaveDays" type="number" min="0" max="31" /></el-form-item>`
- L283: `<el-form-item label="调休"><el-input v-model="form.compLeaveDays" type="number" min="0" max="31" /></el-form-item>`
- L284: `<el-form-item label="备注" class="finance-form-grid__wide"><el-input v-model="form.remark" type="textarea" :rows="3" maxlength="300" show-word-limit /></el-form-item>`

#### specializedPicker

- L263: `<EmployeePicker v-model="form.empId" :store-id="props.storeId" :disabled="isEditing" @change="onEmployeeChange" />`

### src/components/finance/FinanceCollectionDrawer.vue

状态：已完成：收款单据

#### drawer

- L118: `<el-drawer`

#### specializedPicker

- L128: `<ProjectPicker v-model="form.projectId" placeholder="选择所属项目" @change="onProjectChange" />`
- L135: `<ReceivablePicker v-model="form.receivableId" :project-id="form.projectId" @change="onReceivableChange" />`

#### form

- L133: `<el-form label-position="top" class="finance-form-grid" @submit.prevent>`

#### formItem

- L134: `<el-form-item label="待收节点" class="finance-form-grid__wide">`
- L137: `<el-form-item label="本次收款">`
- L142: `<el-form-item label="收款账户">`
- L147: `<el-form-item label="到账日期">`
- L150: `<el-form-item label="付款方">`
- L153: `<el-form-item label="备注" class="finance-form-grid__wide">`

#### select

- L143: `<el-select v-model="form.account" style="width: 100%">`

### src/components/finance/FinanceCommissionDrawer.vue

状态：已完成：提成单据

#### drawer

- L83: `<el-drawer :model-value="visible" title="提成计提" size="min(980px, 96vw)" destroy-on-close @update:model-value="emit('update:visible', $event)">`

#### specializedPicker

- L87: `<ProjectPicker v-model="form.projectId" placeholder="选择主合同项目" @change="onProjectChange" />`
- L94: `<EmployeePicker v-model="form.empId" :store-id="props.storeId" @change="onEmployeeChange" />`

#### form

- L92: `<el-form label-position="top" class="finance-form-grid" @submit.prevent>`

#### formItem

- L93: `<el-form-item label="员工" class="finance-form-grid__wide">`
- L96: `<el-form-item label="主合同签约额">`
- L101: `<el-form-item label="手工比例">`
- L106: `<el-form-item label="提成金额（可留空自动计算）">`
- L111: `<el-form-item label="备注">`

### src/components/finance/FinanceCompensationDrawer.vue

状态：已完成：薪酬单据

#### drawer

- L136: `<el-drawer :model-value="visible" :title="title" size="min(940px, 96vw)" destroy-on-close @update:model-value="emit('update:visible', $event)">`

#### form

- L146: `<el-form label-position="top" class="finance-form-grid" @submit.prevent>`

#### formItem

- L147: `<el-form-item label="发薪员工" class="finance-form-grid__wide">`
- L151: `<el-form-item label="月固定工资">`
- L156: `<el-form-item label="月应出勤天数">`
- L161: `<el-form-item label="生效日期">`
- L164: `<el-form-item label="失效日期（可空）">`
- L167: `<el-form-item label="备注" class="finance-form-grid__wide">`

#### specializedPicker

- L149: `<EmployeePicker v-else v-model="form.empId" :store-id="storeId" @change="onEmployeeChange" />`

### src/components/finance/FinanceEmployeePaymentDrawer.vue

状态：已接入专用选择器

#### drawer

- L70: `<el-drawer :model-value="visible" title="员工薪酬发放" size="min(680px, 96vw)" @update:model-value="emit('update:visible', $event)">`

#### form

- L72: `<el-form label-position="top">`

#### formItem

- L73: `<el-form-item label="待发应付">`
- L83: `<el-form-item label="付款账户"><el-select v-model="form.account" style="width:100%"><el-option v-for="(label,value) in ACCOUNT_LABEL" :key="value" :label="label" :value="value" /></el-`
- L84: `<el-form-item label="发放日期"><el-date-picker v-model="form.paidAt" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>`
- L85: `<el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="3" maxlength="300" /></el-form-item>`

#### specializedPicker

- L74: `<EmployeePayablePicker`

#### select

- L83: `<el-form-item label="付款账户"><el-select v-model="form.account" style="width:100%"><el-option v-for="(label,value) in ACCOUNT_LABEL" :key="value" :label="label" :value="value" /></el-`

### src/components/finance/FinanceLedgerDrawer.vue

状态：已完成：手工记账单

#### drawer

- L168: `<el-drawer`

#### specializedPicker

- L178: `<ProjectPicker v-model="form.projectId" placeholder="选择关联项目（可选）" clearable @change="onProjectChange" />`
- L197: `<LedgerCategoryPicker v-model="form.categoryId" :direction="form.direction" @change="onCategoryChange" />`

#### form

- L183: `<el-form label-position="top" class="finance-form-grid" @submit.prevent>`

#### formItem

- L184: `<el-form-item label="用途">`
- L189: `<el-form-item label="方向">`
- L196: `<el-form-item label="账务分类">`
- L200: `<el-form-item label="金额">`
- L205: `<el-form-item label="资金账户">`
- L210: `<el-form-item label="发生日期">`
- L213: `<el-form-item label="对方">`
- L216: `<el-form-item label="摘要" class="finance-form-grid__wide">`
- L219: `<el-form-item label="备注" class="finance-form-grid__wide">`
- L222: `<el-form-item v-if="item" label="更正原因" class="finance-form-grid__wide">`

#### select

- L185: `<el-select v-model="form.purpose" style="width: 100%">`
- L206: `<el-select v-model="form.account" style="width: 100%">`

### src/components/finance/FinanceMetricGlossary.vue

状态：事件/展示

#### drawer

- L66: `<el-drawer v-model="visible" title="指标口径" size="680px" append-to-body>`

### src/components/finance/FinancePayableDrawer.vue

状态：已完成：应付单据

#### drawer

- L135: `<el-drawer`

#### specializedPicker

- L145: `<ProjectPicker v-model="form.projectId" placeholder="选择所属项目" :disabled="Boolean(item)" clearable @change="onProjectChange" />`

#### form

- L153: `<el-form label-position="top" class="finance-form-grid" @submit.prevent>`

#### formItem

- L154: `<el-form-item label="应付类型">`
- L159: `<el-form-item label="应付名称" class="finance-form-grid__wide">`
- L162: `<el-form-item label="收款方">`
- L165: `<el-form-item label="账期/期间">`
- L168: `<el-form-item label="应付金额">`
- L173: `<el-form-item label="到期日">`
- L176: `<el-form-item label="紧急付款">`
- L179: `<el-form-item label="来源说明">`
- L182: `<el-form-item label="备注" class="finance-form-grid__wide">`

#### select

- L155: `<el-select v-model="form.type" :disabled="Boolean(item)" style="width: 100%">`

### src/components/finance/FinancePaymentDrawer.vue

状态：已完成：付款单据

#### drawer

- L137: `<el-drawer`

#### specializedPicker

- L147: `<ProjectPicker v-model="form.projectId" placeholder="选择所属项目" @change="onProjectChange" />`
- L154: `<PayablePicker v-model="form.payableId" :project-id="form.projectId" @change="onPayableChange" />`
- L173: `<WorkerPicker v-model="form.workerId" @change="onWorkerChange" />`

#### form

- L152: `<el-form label-position="top" class="finance-form-grid" @submit.prevent>`

#### formItem

- L153: `<el-form-item label="待付应付单" class="finance-form-grid__wide">`
- L156: `<el-form-item label="本次付款">`
- L161: `<el-form-item label="付款账户">`
- L166: `<el-form-item label="付款日期">`
- L169: `<el-form-item label="收款方">`
- L172: `<el-form-item v-if="isSalaryPayment" label="发放工人" class="finance-form-grid__wide">`
- L175: `<el-form-item label="交易号" class="finance-form-grid__wide">`
- L178: `<el-form-item label="备注" class="finance-form-grid__wide">`

#### select

- L162: `<el-select v-model="form.account" style="width: 100%">`

### src/components/finance/FinanceReceivableDrawer.vue

状态：已完成：应收收据

#### drawer

- L169: `<el-drawer`

#### specializedPicker

- L181: `<ProjectPicker v-model="form.projectId" placeholder="选择所属项目" :disabled="Boolean(item)" @change="onProjectChange" />`

#### form

- L194: `<el-form label-position="top" @submit.prevent>`

#### formItem

- L195: `<el-form-item label="节点名称">`
- L198: `<el-form-item label="应收类型">`
- L211: `<el-form-item label="合同阶段 / 触发条件">`
- L216: `<el-form-item label="应收金额" class="receivable-document__amount-block">`
- L221: `<el-form-item label="到期日" class="receivable-document__due-block">`
- L231: `<el-form-item label="节点说明">`

### src/components/finance/FinanceRefundDrawer.vue

状态：已接入专用选择器

#### drawer

- L72: `<el-drawer :model-value="visible" title="登记客户退款" size="min(720px, 96vw)" destroy-on-close @update:model-value="emit('update:visible', $event)">`

#### form

- L74: `<el-form label-position="top" class="finance-form-grid" @submit.prevent>`

#### formItem

- L75: `<el-form-item label="原收款" class="finance-form-grid__wide">`
- L78: `<el-form-item label="退款金额"><el-input v-model="form.amount" inputmode="decimal" placeholder="0.00"><template #prepend>¥</template></el-input></el-form-item>`
- L79: `<el-form-item label="退款账户"><el-select v-model="form.account" style="width:100%"><el-option v-for="(label, value) in ACCOUNT_LABEL" :key="value" :label="label" :value="value" /></el`
- L80: `<el-form-item label="退款日期"><el-date-picker v-model="form.refundAt" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>`
- L81: `<el-form-item label="退款原因"><el-input v-model="form.reason" type="textarea" :rows="3" maxlength="300" show-word-limit /></el-form-item>`

#### specializedPicker

- L76: `<ReceiptPicker v-model="form.receiptId" clearable @change="onReceiptChange" />`

#### select

- L79: `<el-form-item label="退款账户"><el-select v-model="form.account" style="width:100%"><el-option v-for="(label, value) in ACCOUNT_LABEL" :key="value" :label="label" :value="value" /></el`

### src/components/finance/VoucherDesignerCanvas.vue

状态：专业编辑器（保留）

#### nativeInput

- L583: `<input :value="Math.round(selectedElement.xMm)" type="number" @input="updateSelected({ xMm: Number(($event.target as HTMLInputElement).value) })">`
- L584: `<input :value="Math.round(selectedElement.yMm)" type="number" @input="updateSelected({ yMm: Number(($event.target as HTMLInputElement).value) })">`
- L588: `<input :value="Math.round(selectedElement.widthMm)" type="number" @input="updateSelected({ widthMm: Number(($event.target as HTMLInputElement).value) })">`
- L589: `<input :value="Math.round(selectedElement.heightMm)" type="number" @input="updateSelected({ heightMm: Number(($event.target as HTMLInputElement).value) })">`
- L593: `<input :value="selectedElement.style?.fontSize ?? 12" type="number" @input="updateElementStyle('fontSize', Number(($event.target as HTMLInputElement).value))">`
- L604: `<input :checked="Boolean(selectedElement.style?.bold)" type="checkbox" @change="updateElementStyle('bold', ($event.target as HTMLInputElement).checked)">`
- L615: `<input :value="selectedElement.binding ?? ''" @input="updateSelected({ binding: ($event.target as HTMLInputElement).value })">`
- L622: `<input :value="selectedTable.rowHeightMm" type="number" @input="updateSelected({ rowHeightMm: Number(($event.target as HTMLInputElement).value) })">`
- L626: `<input :value="selectedTable.rowsPerPage" type="number" @input="updateSelected({ rowsPerPage: Number(($event.target as HTMLInputElement).value) })">`
- L629: `<input :checked="selectedTable.headerRepeat" type="checkbox" @change="updateSelected({ headerRepeat: ($event.target as HTMLInputElement).checked })">`
- L636: `<input :checked="selectedTable.columns.some((item) => item.key === column.key)" type="checkbox" @change="toggleTableColumn(column.key)">`

#### nativeSelect

- L597: `<select :value="selectedElement.style?.align ?? 'left'" @change="updateElementStyle('align', ($event.target as HTMLSelectElement).value)">`

### src/components/form/FileUploadField.vue

状态：原生控件审计

#### nativeInput

- L132: `<input ref="inputRef" type="file" :accept="accept" :multiple="multiple" hidden @change="onPick" />`

#### dialog

- L162: `<el-dialog`

### src/components/material/MaterialAssistant.vue

状态：事件/展示

#### drawer

- L183: `<el-drawer`

### src/components/picker/CustomerPicker.vue

状态：已完成：客户专用选择器

#### dialog

- L190: `<el-dialog v-model="visible" :title="title" width="min(980px, 96vw)" append-to-body destroy-on-close class="customer-picker__dialog">`

### src/components/picker/EmployeePayablePicker.vue

状态：选择器参考实现

#### dialog

- L199: `<el-dialog v-model="visible" :title="title" width="min(920px, 96vw)" append-to-body destroy-on-close>`

### src/components/picker/EmployeePicker.vue

状态：已完成：员工专用选择器

#### dialog

- L342: `<el-dialog v-model="visible" :title="title" width="min(1000px, 96vw)" append-to-body destroy-on-close class="employee-picker__dialog">`

### src/components/picker/LedgerCategoryPicker.vue

状态：选择器参考实现

#### dialog

- L177: `<el-dialog v-model="visible" title="选择业务分类" width="680px" destroy-on-close>`
- L207: `<el-dialog v-model="editorVisible" :title="editorTitle" width="560px" destroy-on-close>`

#### form

- L209: `<el-form label-position="top" style="margin-top: 16px">`

#### formItem

- L210: `<el-form-item label="分类名称">`
- L213: `<el-form-item label="分类说明">`
- L217: `<el-form-item v-if="editingCategory" label="启用状态">`

### src/components/picker/PartnerPicker.vue

状态：选择器参考实现

#### lowLevelPicker

- L18: `<RemoteSelectionShell`

### src/components/picker/PayablePicker.vue

状态：已完成：应付专用选择器

#### dialog

- L239: `<el-dialog v-model="visible" title="选择待付应付单" width="min(1000px, 96vw)" append-to-body destroy-on-close class="payable-picker__dialog">`

### src/components/picker/ProjectPicker.vue

状态：选择器参考实现

#### dialog

- L230: `<el-dialog v-model="visible" :title="title" width="min(1180px, 96vw)" destroy-on-close>`

#### specializedPicker

- L258: `<EmployeePicker`
- L271: `<EmployeePicker`

### src/components/picker/PropertyPicker.vue

状态：已完成：房屋专用选择器

#### dialog

- L178: `<el-dialog v-model="visible" :title="title" width="min(960px, 96vw)" append-to-body destroy-on-close class="property-picker__dialog">`

### src/components/picker/ReceiptPicker.vue

状态：选择器参考实现

#### dialog

- L190: `<el-dialog v-model="visible" :title="title" width="min(920px, 96vw)" append-to-body destroy-on-close>`

### src/components/picker/ReceivablePicker.vue

状态：已完成：应收专用选择器

#### dialog

- L229: `<el-dialog v-model="visible" title="选择待收节点" width="min(1000px, 96vw)" append-to-body destroy-on-close class="receivable-picker__dialog">`

### src/components/picker/RemoteSelectionShell.vue

状态：选择器参考实现

#### dialog

- L163: `<el-dialog v-model="visible" :title="title" width="720px" destroy-on-close>`

### src/components/picker/WorkerPicker.vue

状态：选择器参考实现

#### lowLevelPicker

- L10: `<RemoteSelectionShell`

### src/components/property/PropertyFormDrawer.vue

状态：待审计/升级

#### drawer

- L102: `<el-drawer v-model="visible" :title="isEdit ? '维护房屋档案' : '新增房屋'" size="520px" destroy-on-close>`

#### form

- L121: `<el-form ref="formRef" :model="form" :rules="rules" label-position="top">`

#### formItem

- L122: `<el-form-item label="小区 / 楼盘" prop="community">`
- L125: `<el-form-item label="楼栋 / 单元" prop="building">`
- L128: `<el-form-item label="房号" prop="roomNo">`
- L131: `<el-form-item label="详细地址" prop="address">`
- L134: `<el-form-item label="建筑面积（㎡）" prop="area">`
- L137: `<el-form-item label="户型" prop="layout">`
- L140: `<el-form-item label="备注" prop="remark">`

### src/layouts/RoleAreaShell.vue

状态：事件/展示

#### drawer

- L217: `<el-drawer v-model="mobileNavOpen" direction="ltr" size="280px" :with-header="false" class="role-frame__drawer">`

### src/views/account/AccountCenterView.vue

状态：待审计/升级

#### form

- L367: `<el-form label-position="top" @submit.prevent>`
- L399: `<el-form label-position="top" @submit.prevent>`

#### formItem

- L368: `<el-form-item label="企业展示名称" required>`
- L372: `<el-form-item label="企业简称" required>`
- L376: `<el-form-item label="企业办公地址">`
- L400: `<el-form-item label="服务区域">`
- L404: `<el-form-item label="企业客服电话">`
- L408: `<el-form-item label="售后专线">`
- L412: `<el-form-item label="统一社会信用代码">`
- L416: `<el-form-item label="施工资质">`
- L420: `<el-form-item label="企业简介">`

### src/views/account/MyAttendanceView.vue

状态：事件/展示

#### dialog

- L100: `<el-dialog v-model="detailVisible" title="我的考勤明细" width="560px">`

### src/views/account/MyCommissionsView.vue

状态：事件/展示

#### dialog

- L101: `<el-dialog v-model="detailVisible" title="我的提成明细" width="580px">`

### src/views/account/MyPayslipsView.vue

状态：事件/展示

#### dialog

- L91: `<el-dialog v-model="detailVisible" title="工资条明细" width="560px">`

### src/views/auth/LoginView.vue

状态：已完成：轻量表单

#### form

- L159: `<el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="submit">`

#### formItem

- L160: `<el-form-item label="手机号" prop="phone">`
- L163: `<el-form-item label="登录密码" prop="password">`

### src/views/designer/DesignReviewView.vue

状态：已接入专用选择器

#### select

- L121: `<el-select v-model="status" clearable placeholder="设计状态" @change="search">`

#### specializedPicker

- L124: `<EmployeePicker`

### src/views/designer/DesignerAcceptanceView.vue

状态：已完成：验收提交单

#### dialog

- L270: `<el-dialog v-model="submitVisible" :title="isResubmit ? '提交复验' : '提交阶段验收'" width="min(980px, 96vw)" append-to-body class="aw__submit-dialog">`

#### form

- L293: `<el-form label-position="top">`

#### formItem

- L294: `<el-form-item label="验收说明" required><el-input v-model="submitForm.content" type="textarea" :rows="4" maxlength="500" show-word-limit /></el-form-item>`
- L295: `<el-form-item label="问题清单"><el-input v-model="submitForm.issuesText" type="textarea" :rows="3" placeholder="一行一个问题；没有可不填" /></el-form-item>`
- L296: `<el-form-item label="现场证据" required>`
- L309: `<el-form-item label="整改说明" required><el-input v-model="submitForm.rectificationNote" type="textarea" :rows="3" maxlength="500" show-word-limit /></el-form-item>`
- L310: `<el-form-item label="整改后照片" required>`

### src/views/designer/DesignerCatalogView.vue

状态：已完成：只读筛选

#### select

- L472: `<el-select`
- L483: `<el-select`
- L494: `<el-select`

#### drawer

- L604: `<el-drawer`

### src/views/designer/DesignerContractChangesView.vue

状态：已完成

#### dialog

- L1215: `<el-dialog v-model="sourcePickerVisible" title="选择来源分项" width="980px" class="source-picker">`

#### specializedPicker

- L1319: `<DesignCatalogPicker`

### src/views/designer/DesignerContractHandoffView.vue

状态：待审计/升级

#### nativeInput

- L729: `<input v-model="keyword" type="search" placeholder="客户、房屋或报价标题" />`

#### drawer

- L1043: `<el-drawer v-model="createOpen" title="发起合同" size="560px" direction="rtl" append-to-body>`
- L1058: `<el-drawer v-model="signOpen" title="确认签约" size="560px" direction="rtl" append-to-body>`

#### form

- L1047: `<el-form label-position="top" class="cq__form-grid">`
- L1062: `<el-form label-position="top" class="cq__form-grid">`

#### formItem

- L1048: `<el-form-item label="计划开工日期"><el-date-picker v-model="createForm.startDate" type="date" value-format="YYYY-MM-DD" placeholder="选填" style="width: 100%" /></el-form-item>`
- L1049: `<el-form-item label="计划完工日期"><el-date-picker v-model="createForm.planEndDate" type="date" value-format="YYYY-MM-DD" placeholder="选填" style="width: 100%" /></el-form-item>`
- L1050: `<el-form-item label="付款说明" class="cq__form-wide"><el-input v-model="createForm.paymentTerms" type="textarea" :rows="2" maxlength="200" show-word-limit placeholder="如：首期 60%，开工 30%，`
- L1051: `<el-form-item label="备注" class="cq__form-wide"><el-input v-model="createForm.remark" type="textarea" :rows="3" maxlength="300" show-word-limit placeholder="选填，写给企业负责人 / 店长复核时参考" />`
- L1063: `<el-form-item label="最终签约价格（元）">`
- L1066: `<el-form-item label="签署日期">`
- L1069: `<el-form-item label="计划开工日期（必填）"><el-date-picker v-model="signForm.startDate" type="date" value-format="YYYY-MM-DD" placeholder="必填" style="width: 100%" /></el-form-item>`
- L1070: `<el-form-item label="基准完工日"><el-input :model-value="signBaselinePlanEnd || '选择开工日期后自动生成'" readonly /><template #label><span>基准完工日（自动生成并锁定）</span></template></el-form-item>`
- L1071: `<el-form-item label="付款条款" class="cq__form-wide"><el-input v-model="signForm.paymentTerms" type="textarea" :rows="2" maxlength="200" show-word-limit placeholder="如：合同签约款30% / 项目开工款`

### src/views/designer/DesignerCustomerFeedbackView.vue

状态：事件/展示

#### drawer

- L306: `<el-drawer v-model="detailVisible" title="客户意见投诉详情" size="760px">`

### src/views/designer/DesignerCustomersView.vue

状态：已完成：客户房屋上下文

#### nativeInput

- L1004: `<input v-model="keyword" type="search" placeholder="客户、手机号、小区或地址" @keyup.enter="loadCustomers(true)" />`

#### dialog

- L1268: `<el-dialog v-model="measureVisible" title="安排量房" width="480px" append-to-body>`
- L1277: `<el-dialog v-model="measureResultVisible" title="登记量房结论" width="680px" append-to-body>`
- L1418: `<el-dialog v-model="requirementVisible" title="记录设计诉求" width="620px" append-to-body>`

#### form

- L1270: `<el-form label-position="top">`
- L1279: `<el-form label-position="top" class="cd__dialog-grid">`
- L1338: `<el-form ref="schemeFormRef" :model="schemeForm" :rules="schemeRules" label-position="top">`
- L1420: `<el-form label-position="top" class="cd__dialog-grid">`

#### formItem

- L1271: `<el-form-item label="量房时间"><el-date-picker v-model="measureForm.measureAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" /></el-form-item>`
- L1280: `<el-form-item label="量房时间"><el-date-picker v-model="measureResultForm.measureTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" /></el-form-item>`
- L1281: `<el-form-item label="原始结构" class="cd__dialog-wide"><el-input v-model="measureResultForm.originalStructure" type="textarea" :rows="2" /></el-form-item>`
- L1282: `<el-form-item label="尺寸记录" class="cd__dialog-wide"><el-input v-model="measureResultForm.dimensions" type="textarea" :rows="2" /></el-form-item>`
- L1283: `<el-form-item label="客户诉求" class="cd__dialog-wide"><el-input v-model="measureResultForm.customerRequirements" type="textarea" :rows="3" /></el-form-item>`
- L1284: `<el-form-item label="设计师结论" class="cd__dialog-wide"><el-input v-model="measureResultForm.designerConclusion" type="textarea" :rows="3" /></el-form-item>`
- L1285: `<el-form-item label="现场照片" class="cd__dialog-wide">`
- L1296: `<el-form-item label="结构 / 图纸" class="cd__dialog-wide">`
- L1307: `<el-form-item label="其他附件" class="cd__dialog-wide">`
- L1343: `<el-form-item label="创建方式">`
- L1356: `<el-form-item prop="templateId" label="选择方案模版">`
- L1391: `<el-form-item label="方案名称" prop="name">`
- L1395: `<el-form-item label="风格">`
- L1398: `<el-form-item label="户型">`
- L1401: `<el-form-item label="方案说明" class="cd__dialog-wide">`
- L1421: `<el-form-item label="诉求类型"><el-select v-model="requirementForm.kind" style="width: 100%"><el-option label="诉求" value="demand" /><el-option label="排斥点" value="reject" /></el-select>`
- L1422: `<el-form-item label="分类"><el-select v-model="requirementForm.category" style="width: 100%"><el-option v-for="item in REQUIREMENT_CATEGORY_OPTIONS" :key="item.value" :label="item.la`
- L1423: `<el-form-item label="优先级"><el-select v-model="requirementForm.priority" style="width: 100%"><el-option v-for="item in REQUIREMENT_PRIORITY_OPTIONS" :key="item.value" :label="item.l`
- L1424: `<el-form-item label="空间"><el-input v-model="requirementForm.spaceName" placeholder="如客厅 / 主卧，可留空" /></el-form-item>`
- L1425: `<el-form-item label="标题" class="cd__dialog-wide"><el-input v-model="requirementForm.title" maxlength="80" /></el-form-item>`
- L1426: `<el-form-item label="详细说明" class="cd__dialog-wide"><el-input v-model="requirementForm.detail" type="textarea" :rows="3" /></el-form-item>`
- L1427: `<el-form-item label="设计回应" class="cd__dialog-wide"><el-input v-model="requirementForm.response" type="textarea" :rows="2" /></el-form-item>`

#### drawer

- L1322: `<el-drawer`

#### select

- L1421: `<el-form-item label="诉求类型"><el-select v-model="requirementForm.kind" style="width: 100%"><el-option label="诉求" value="demand" /><el-option label="排斥点" value="reject" /></el-select>`
- L1422: `<el-form-item label="分类"><el-select v-model="requirementForm.category" style="width: 100%"><el-option v-for="item in REQUIREMENT_CATEGORY_OPTIONS" :key="item.value" :label="item.la`
- L1423: `<el-form-item label="优先级"><el-select v-model="requirementForm.priority" style="width: 100%"><el-option v-for="item in REQUIREMENT_PRIORITY_OPTIONS" :key="item.value" :label="item.l`

### src/views/designer/DesignerDesignWorkspaceView.vue

状态：已完成：方案上下文与空间表单

#### dialog

- L773: `<el-dialog v-model="spaceVisible" :title="spaceForm.spaceId ? '编辑空间' : '新增空间'" width="min(720px, 96vw)" append-to-body>`

#### form

- L775: `<el-form label-position="top" class="dw__dialog-grid">`

#### formItem

- L776: `<el-form-item label="空间类型"><el-select v-model="spaceForm.type" style="width: 100%"><el-option v-for="(label, value) in SPACE_TYPE_LABELS" :key="value" :label="label" :value="value"`
- L777: `<el-form-item label="空间名称"><el-input v-model="spaceForm.name" maxlength="40" /></el-form-item>`
- L778: `<el-form-item label="取值来源">`
- L786: `<el-form-item label="量房记录 长（米）"><el-input-number v-model="spaceForm.length" :min="0" :precision="2" style="width: 100%" /></el-form-item>`
- L787: `<el-form-item label="量房记录 宽（米）"><el-input-number v-model="spaceForm.width" :min="0" :precision="2" style="width: 100%" /></el-form-item>`
- L788: `<el-form-item label="量房记录 层高（米）"><el-input-number v-model="spaceForm.height" :min="0" :precision="2" style="width: 100%" /></el-form-item>`
- L789: `<el-form-item label="实测面积（㎡）"><el-input-number v-model="spaceForm.area" :min="0" :precision="2" style="width: 100%" /></el-form-item>`
- L790: `<el-form-item label="实测周长（米）"><el-input-number v-model="spaceForm.perimeter" :min="0" :precision="2" style="width: 100%" /></el-form-item>`
- L792: `<el-form-item label="备注" class="dw__dialog-wide"><el-input v-model="spaceForm.remark" type="textarea" :rows="3" maxlength="300" show-word-limit /></el-form-item>`

#### select

- L776: `<el-form-item label="空间类型"><el-select v-model="spaceForm.type" style="width: 100%"><el-option v-for="(label, value) in SPACE_TYPE_LABELS" :key="value" :label="label" :value="value"`

### src/views/designer/DesignerFollowUpTasksView.vue

状态：待审计/升级

#### nativeInput

- L771: `<input v-model="keyword" type="search" placeholder="客户、手机号、小区或地址" />`

#### drawer

- L1050: `<el-drawer v-model="measureAppointmentOpen" title="预约量房" size="580px" direction="rtl" append-to-body>`
- L1103: `<el-drawer v-model="customerEditOpen" title="编辑客户资料" size="560px" direction="rtl" append-to-body>`
- L1152: `<el-drawer v-model="portraitOpen" title="完善客户画像" size="680px" direction="rtl" append-to-body>`
- L1185: `<el-drawer v-model="wechatOpen" title="记录客户微信" size="480px" direction="rtl" append-to-body>`
- L1200: `<el-drawer v-model="dormantOpen" title="设为休眠客户" size="520px" direction="rtl" append-to-body>`

#### form

- L1054: `<el-form label-position="top">`
- L1107: `<el-form label-position="top" class="fu__customer-edit-form">`
- L1156: `<el-form label-position="top">`
- L1189: `<el-form label-position="top">`
- L1204: `<el-form label-position="top">`

#### formItem

- L1072: `<el-form-item label="小区 / 楼盘">`
- L1075: `<el-form-item label="楼栋 / 单元">`
- L1078: `<el-form-item label="房号">`
- L1081: `<el-form-item label="面积（㎡）">`
- L1084: `<el-form-item label="详细地址" class="fu__form-wide" required>`
- L1087: `<el-form-item label="户型">`
- L1092: `<el-form-item label="约定量房时间" required>`
- L1109: `<el-form-item label="客户姓名" required>`
- L1112: `<el-form-item label="手机号" required>`
- L1115: `<el-form-item label="性别">`
- L1121: `<el-form-item label="客户来源">`
- L1129: `<el-form-item label="意向小区">`
- L1132: `<el-form-item label="面积（㎡）">`
- L1135: `<el-form-item label="详细地址" class="fu__form-wide">`
- L1138: `<el-form-item label="预算（万）">`
- L1141: `<el-form-item label="备注" class="fu__form-wide">`
- L1160: `<el-form-item v-for="key in section.keys" :key="key">`
- L1190: `<el-form-item label="客户微信号（选填）">`
- L1205: `<el-form-item label="休眠原因" required>`
- L1210: `<el-form-item v-if="dormantForm.reasonCode === 'Other'" label="补充说明" required>`

#### select

- L1116: `<el-select v-model="profileForm.gender" style="width: 100%">`
- L1122: `<el-select v-model="profileForm.source" clearable placeholder="请选择" style="width: 100%">`
- L1165: `<el-select v-model="portraitForm[key]" clearable placeholder="未填写" style="width: 100%">`
- L1206: `<el-select v-model="dormantForm.reasonCode" placeholder="请选择休眠原因" style="width: 100%">`

### src/views/designer/DesignerMaterialSelectionView.vue

状态：字段编辑区

#### form

- L223: `<el-form label-position="top" :disabled="!isEditable(selectedItem)">`

#### formItem

- L225: `<el-form-item label="颜色 / 花色"><el-input v-model="editor.color" placeholder="例如：拉丝香槟金" /></el-form-item>`
- L226: `<el-form-item label="规格 / 型号"><el-input v-model="editor.spec" placeholder="例如：300×600mm" /></el-form-item>`
- L227: `<el-form-item label="品牌"><el-input v-model="editor.brand" placeholder="例如：奥普" /></el-form-item>`
- L228: `<el-form-item label="工艺 / 材质"><el-input v-model="editor.process" placeholder="例如：同色收边" /></el-form-item>`
- L230: `<el-form-item label="选材说明"><el-input v-model="editor.content" type="textarea" :rows="4" placeholder="留空时会根据上方字段自动汇总；也可以直接填写客户沟通确认的选材内容。" /></el-form-item>`
- L231: `<el-form-item label="备注"><el-input v-model="editor.remark" placeholder="客户偏好、到货要求或需要现场确认的事项" /></el-form-item>`

### src/views/designer/DesignerMeasureTasksView.vue

状态：待审计/升级

#### nativeInput

- L673: `<input v-model="keyword" type="search" placeholder="房屋、小区、楼栋、客户或手机号" />`

#### drawer

- L983: `<el-drawer v-model="dormantOpen" title="设为休眠客户" size="520px" direction="rtl" append-to-body>`
- L1004: `<el-drawer v-model="scheduleOpen" :title="selectedTask?.scheduledAt ? '调整预约时间' : '预约量房'" size="520px" direction="rtl" append-to-body>`
- L1019: `<el-drawer v-model="measureOpen" title="登记量房结论" size="680px" direction="rtl" append-to-body>`
- L1089: `<el-drawer v-model="schemeOpen" title="新建设计方案" size="620px" direction="rtl" append-to-body>`

#### form

- L987: `<el-form label-position="top">`
- L1008: `<el-form label-position="top">`
- L1023: `<el-form label-position="top" class="mt__form-grid">`
- L1093: `<el-form label-position="top" class="mt__form-grid">`

#### formItem

- L988: `<el-form-item label="休眠原因" required>`
- L993: `<el-form-item v-if="dormantForm.reasonCode === 'Other'" label="补充说明" required>`
- L1009: `<el-form-item label="量房时间">`
- L1024: `<el-form-item label="量房时间" class="mt__form-wide"><DateClockField v-model="measureForm.measureTime" date-placeholder="量房日期" time-placeholder="量房时间" /></el-form-item>`
- L1025: `<el-form-item label="原始结构" class="mt__form-wide"><el-input v-model="measureForm.originalStructure" type="textarea" :rows="2" /></el-form-item>`
- L1026: `<el-form-item label="尺寸记录" class="mt__form-wide"><el-input v-model="measureForm.dimensions" type="textarea" :rows="2" /></el-form-item>`
- L1027: `<el-form-item label="原始区域实测（房屋原始结构）" class="mt__form-wide">`
- L1051: `<el-form-item label="客户诉求" class="mt__form-wide"><el-input v-model="measureForm.customerRequirements" type="textarea" :rows="3" placeholder="现场听到的需求、禁忌和偏好，先原样记录" /></el-form-item>`
- L1052: `<el-form-item label="设计师结论" class="mt__form-wide"><el-input v-model="measureForm.designerConclusion" type="textarea" :rows="3" /></el-form-item>`
- L1094: `<el-form-item label="方案名称"><el-input v-model="schemeForm.name" maxlength="80" /></el-form-item>`
- L1095: `<el-form-item label="风格"><el-input v-model="schemeForm.style" maxlength="40" /></el-form-item>`
- L1096: `<el-form-item label="户型"><el-input v-model="schemeForm.layout" maxlength="40" /></el-form-item>`
- L1097: `<el-form-item label="方案说明" class="mt__form-wide"><el-input v-model="schemeForm.description" type="textarea" :rows="4" maxlength="500" show-word-limit /></el-form-item>`

#### select

- L989: `<el-select v-model="dormantForm.reasonCode" placeholder="请选择休眠原因" style="width: 100%">`
- L1040: `<el-select v-model="draft.type" style="width: 96px">`

### src/views/designer/DesignerMyCustomersView.vue

状态：原生控件审计

#### nativeInput

- L232: `<input v-model="keyword" type="search" placeholder="搜索客户姓名、手机号、小区" @keyup.enter="load" />`

### src/views/designer/DesignerProjectsView.vue

状态：已完成：项目列表筛选

#### nativeInput

- L397: `<input v-model="keyword" type="search" placeholder="项目名称、客户、小区或地址" />`

### src/views/designer/DesignerQuoteHistoryView.vue

状态：原生控件审计

#### nativeInput

- L114: `<input v-model="keyword" type="search" placeholder="客户、房屋或报价标题" />`

### src/views/designer/DesignerQuoteListView.vue

状态：原生控件审计

#### nativeInput

- L431: `<input v-model="keyword" type="search" placeholder="客户、房屋或报价标题" />`

### src/views/designer/DesignerQuoteQueueView.vue

状态：原生控件审计

#### nativeInput

- L191: `<input v-model="keyword" type="search" placeholder="客户、电话、小区或报价标题" />`

### src/views/designer/DesignerQuoteWorkspaceView.vue

状态：已完成：专业工作区

#### nativeInput

- L1083: `<input ref="importInput" type="file" accept=".xlsx" hidden @change="handleImportFile" />`

#### dialog

- L1174: `<el-dialog v-model="diffVisible" title="版本对比" width="920px" append-to-body>`
- L1228: `<el-dialog v-model="batchVisible" title="批量改价" width="min(620px, 96vw)" append-to-body>`
- L1272: `<el-dialog v-model="importVisible" title="Excel 导入预览" width="920px" append-to-body>`
- L1322: `<el-dialog v-model="pdfVisible" title="报价 PDF" width="520px" append-to-body>`

#### select

- L1176: `<el-select v-model="diffBaseId" placeholder="选择对比版本" style="width: 220px" @change="loadVersionDiff">`
- L1243: `<el-select v-model="batchField" style="width: 100%">`
- L1249: `<el-select v-model="batchMode" style="width: 100%">`

#### form

- L1241: `<el-form label-position="top" class="qw__batch-grid">`

#### formItem

- L1242: `<el-form-item label="改价字段">`
- L1248: `<el-form-item label="改价方式">`
- L1257: `<el-form-item :label="batchMode.includes('Percent') ? '比例（%）' : '金额（元）'">`

### src/views/designer/DesignerTemplateEditorView.vue

状态：已接入专用选择器

#### dialog

- L395: `<el-dialog`
- L502: `<el-dialog v-model="instantiateVisible" title="从模版生成设计方案" width="560px">`

#### form

- L401: `<el-form label-position="top" class="room-form">`
- L508: `<el-form label-width="100px" class="room-form__instantiate">`

#### formItem

- L405: `<el-form-item label="区域键（公式锚点，保存后不可改）" required>`
- L408: `<el-form-item label="区域名称" required>`
- L412: `<el-form-item label="区域类型">`
- L426: `<el-form-item label="面积 A（㎡）">`
- L436: `<el-form-item label="周长 P（m）">`
- L452: `<el-form-item label="层高 H（m）">`
- L455: `<el-form-item label="门洞总宽 DW（m）">`
- L458: `<el-form-item label="门洞总面积 DA（㎡）">`
- L461: `<el-form-item label="窗洞总面积 WA（㎡）">`
- L464: `<el-form-item label="防水上返 WR（m）">`
- L467: `<el-form-item label="同型区域数量 N">`
- L477: `<el-form-item label="开间 L（m）">`
- L480: `<el-form-item label="进深 W（m）">`
- L488: `<el-form-item label="备注（可选）">`
- L509: `<el-form-item label="客户房屋" required>`
- L512: `<el-form-item label="方案名称">`

#### select

- L413: `<el-select v-model="roomForm.roomType" style="width: 100%">`

#### specializedPicker

- L510: `<PropertyPicker v-model="instantiateForm.propertyId" />`

### src/views/designer/DesignerTemplateLibraryView.vue

状态：待审计/升级

#### select

- L254: `<el-select v-model="filters.scope" placeholder="归属" clearable @change="load(true)">`
- L259: `<el-select v-model="filters.status" placeholder="状态" clearable @change="load(true)">`
- L265: `<el-select v-model="filters.areaRange" placeholder="面积区间" clearable @change="load(true)">`
- L381: `<el-select v-model="form.scope" style="width: 100%">`

#### dialog

- L361: `<el-dialog v-model="createVisible" title="新建方案模版" width="520px">`

#### form

- L362: `<el-form label-width="110px">`

#### formItem

- L363: `<el-form-item label="模版名称" required>`
- L366: `<el-form-item label="房型" required>`
- L369: `<el-form-item label="适用面积">`
- L377: `<el-form-item label="标签">`
- L380: `<el-form-item label="归属范围">`
- L387: `<el-form-item label="备注">`

### src/views/designer/components/CatalogMaintenanceDrawer.vue

状态：待审计/升级

#### drawer

- L192: `<el-drawer`

#### form

- L219: `<el-form label-position="top">`
- L252: `<el-form label-position="top">`
- L297: `<el-form label-position="top">`
- L306: `<el-form label-position="top">`

#### formItem

- L221: `<el-form-item label="项目类型" required>`
- L231: `<el-form-item label="项目编码">`
- L235: `<el-form-item label="项目名称" required>`
- L238: `<el-form-item label="项目分类" required>`
- L242: `<el-form-item label="品牌"><el-input v-model="form.brand" /></el-form-item>`
- L243: `<el-form-item label="系列"><el-input v-model="form.series" /></el-form-item>`
- L244: `<el-form-item label="规格"><el-input v-model="form.spec" placeholder="如 1200×600mm" /></el-form-item>`
- L254: `<el-form-item label="计量单位" required>`
- L259: `<el-form-item label="计价方式" required>`
- L271: `<el-form-item v-if="form.pricingMode === 'fixedTotal'" label="固定总价" required>`
- L275: `<el-form-item v-if="form.pricingMode !== 'manualOnly'" label="材料价">`
- L278: `<el-form-item v-if="form.pricingMode !== 'materialOnly'" label="人工价">`
- L298: `<el-form-item label="标准成本单价">`
- L307: `<el-form-item label="工艺要求"><el-input v-model="form.craft" type="textarea" :rows="3" /></el-form-item>`
- L308: `<el-form-item label="验收标准"><el-input v-model="form.criterion" type="textarea" :rows="3" /></el-form-item>`
- L309: `<el-form-item label="项目说明"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>`
- L310: `<el-form-item v-if="editing" label="项目状态">`

#### select

- L222: `<el-select v-model="form.type" style="width: 100%">`
- L255: `<el-select v-model="form.unit" style="width: 100%">`
- L260: `<el-select v-model="form.pricingMode" style="width: 100%">`

### src/views/designer/components/DesignCatalogPicker.vue

状态：选择器参考实现

#### drawer

- L433: `<el-drawer`

#### select

- L499: `<el-select v-model="spaceId" placeholder="选择归属区域" style="width: 220px">`

### src/views/designer/components/DesignItemSheet.vue

状态：已接入专用选择器

#### specializedPicker

- L1156: `<DesignCatalogPicker`

#### dialog

- L1166: `<el-dialog v-model="excelVisible" title="从 Excel 粘贴分项" width="820px" :append-to-body="!fullscreen" :modal-append-to-body="!fullscreen" destroy-on-close>`

### src/views/designer/components/DesignTemplateFormulaAssistant.vue

状态：事件/展示

#### drawer

- L109: `<el-drawer`

### src/views/designer/components/DesignTemplateItemSheet.vue

状态：已接入专用选择器

#### nativeInput

- L740: `<input`
- L748: `<input`
- L788: `<input v-model="row.remark" class="cell__remark" :disabled="!canWrite" placeholder="备注（可选）" @input="markDirty(row)" />`

#### specializedPicker

- L807: `<DesignCatalogPicker`

### src/views/designer/components/DesignerProjectMediaGrid.vue

状态：事件/展示

#### dialog

- L77: `<el-dialog v-model="videoVisible" title="查看视频" width="720px" append-to-body destroy-on-close>`

### src/views/designer/components/ProjectMemberAssignSheet.vue

状态：已接入专用选择器

#### drawer

- L82: `<el-drawer v-model="visible" title="指定项目成员" size="480px" :destroy-on-close="true">`

#### form

- L97: `<el-form label-position="top" class="member__form" @submit.prevent>`

#### formItem

- L98: `<el-form-item label="项目经理（必填）" required>`
- L107: `<el-form-item label="项目设计师">`
- L117: `<el-form-item label="履约负责人">`

#### specializedPicker

- L99: `<EmployeePicker`
- L108: `<EmployeePicker`
- L118: `<EmployeePicker`

### src/views/designer/components/PropertyEditSheet.vue

状态：原生控件审计

#### nativeInput

- L102: `<label><span>小区</span><input v-model="form.community" type="text" placeholder="小区名称" /></label>`
- L103: `<label><span>楼栋</span><input v-model="form.building" type="text" placeholder="如 3 栋" /></label>`
- L104: `<label><span>房号</span><input v-model="form.roomNo" type="text" placeholder="如 1502" /></label>`
- L105: `<label><span>面积（㎡）</span><input v-model="form.area" type="number" min="0" placeholder="如 120" /></label>`
- L106: `<label><span>户型</span><input v-model="form.layout" type="text" placeholder="如 三室两厅一厨两卫" /></label>`
- L107: `<label class="grid__wide"><span>详细地址 *</span><input v-model="form.address" type="text" placeholder="楼栋房号或详细地址" /></label>`

#### textarea

- L108: `<label class="grid__wide"><span>备注</span><textarea v-model="form.remark" rows="2" placeholder="补充说明" /></label>`

### src/views/finance/FinanceCompensationSchemesView.vue

状态：筛选器审计

#### select

- L200: `<el-select v-model="status" clearable placeholder="方案状态" style="width: 130px" @change="applyFilters">`

### src/views/finance/FinanceExpensesView.vue

状态：已接入专用选择器

#### select

- L232: `<el-select v-model="statusFilter" clearable placeholder="全部状态" style="width: 150px" @change="resetAndLoad">`

#### specializedPicker

- L236: `<ProjectPicker v-model="projectFilter" placeholder="全部项目/企业费用" clearable @change="resetAndLoad" />`

### src/views/finance/FinanceLedgerView.vue

状态：筛选器审计

#### select

- L251: `<el-select v-model="direction" clearable placeholder="全部方向" style="width: 130px" @change="resetAndLoad">`

### src/views/finance/FinanceMaterialOrderingView.vue

状态：已接入专用选择器

#### specializedPicker

- L228: `<PartnerPicker v-model="supplierId" @change="selectSupplier" />`

### src/views/finance/FinanceMaterialSettlementView.vue

状态：已接入专用选择器

#### specializedPicker

- L194: `<PartnerPicker v-model="supplierFilterId" @change="loadCandidates" />`

### src/views/finance/FinancePayablesView.vue

状态：筛选器审计

#### select

- L195: `<el-select v-if="!salaryMode" v-model="typeFilter" clearable placeholder="全部类型" style="width: 140px" @change="resetAndLoad">`
- L198: `<el-select v-model="statusFilter" clearable placeholder="全部状态" style="width: 140px" @change="resetAndLoad">`

### src/views/finance/FinancePaymentsView.vue

状态：已接入专用选择器

#### dialog

- L228: `<el-dialog v-model="workerDialogVisible" title="补录发放工人" width="560px" destroy-on-close>`

#### specializedPicker

- L231: `<WorkerPicker v-model="selectedWorkerId" />`

### src/views/finance/FinanceReceivablesView.vue

状态：筛选器审计

#### select

- L184: `<el-select v-model="typeFilter" clearable placeholder="全部类型" style="width: 140px" @change="resetAndLoad">`
- L187: `<el-select v-model="statusFilter" clearable placeholder="全部状态" style="width: 140px" @change="resetAndLoad">`

### src/views/finance/FinanceVoucherTemplatesView.vue

状态：已完成：快速版式实时结果

#### form

- L386: `<el-form label-position="top" class="finance-form-grid">`
- L415: `<el-form label-position="top" class="finance-form-grid">`
- L442: `<el-form label-position="top" class="finance-form-grid">`

#### formItem

- L387: `<el-form-item label="模板名称">`
- L390: `<el-form-item label="单据类型">`
- L396: `<el-form-item label="主色">`
- L399: `<el-form-item label="正文字号">`
- L402: `<el-form-item label="行距">`
- L416: `<el-form-item label="纸张">`
- L423: `<el-form-item label="方向">`
- L429: `<el-form-item label="页边距（毫米）">`
- L443: `<el-form-item v-for="(label, index) in layout.signatures" :key="index" :label="\`签字栏 ${index + 1}\`">`
- L446: `<el-form-item label="页脚说明">`

#### select

- L391: `<el-select :model-value="templateType" style="width: 100%" @change="switchType($event as TemplateType)">`
- L417: `<el-select v-model="layout.pageSize" style="width: 100%">`
- L424: `<el-select v-model="layout.orientation" style="width: 100%">`

### src/views/finance/FinanceVouchersView.vue

状态：筛选器审计

#### select

- L136: `<el-select v-model="typeFilter" clearable placeholder="全部类型" style="width: 130px" @change="resetAndLoad">`
- L139: `<el-select v-model="statusFilter" clearable placeholder="全部状态" style="width: 130px" @change="resetAndLoad">`

### src/views/notice/NotificationCenterView.vue

状态：筛选器审计

#### select

- L186: `<el-select v-model="typeFilter" class="notification-type-select" aria-label="筛选消息类型">`

### src/views/pm/PmWorkbenchView.vue

状态：事件/展示

#### dialog

- L445: `<el-dialog v-model="doneVisible" title="完成任务并上传证据" width="min(720px, 96vw)" append-to-body @closed="doneTask = null">`

### src/views/workbench/BossOrganizationView.vue

状态：待审计/升级

#### dialog

- L437: `<el-dialog v-model="editVisible" title="调整成员" width="480px">`
- L458: `<el-dialog v-model="inviteVisible" title="邀请员工" width="480px">`

#### form

- L438: `<el-form label-position="top" @submit.prevent>`
- L459: `<el-form label-position="top" @submit.prevent>`

#### formItem

- L439: `<el-form-item label="员工"><el-input :model-value="editMember?.name" disabled /></el-form-item>`
- L440: `<el-form-item label="岗位">`
- L445: `<el-form-item v-if="session.role === 'Boss'" label="门店">`
- L460: `<el-form-item label="姓名"><el-input v-model="inviteForm.inviteName" maxlength="15" /></el-form-item>`
- L461: `<el-form-item label="手机号"><el-input v-model="inviteForm.invitePhone" maxlength="11" /></el-form-item>`
- L462: `<el-form-item label="岗位">`
- L467: `<el-form-item v-if="inviteForm.role === 'Finance' && session.role === 'Boss'" label="归属门店" required>`

#### select

- L441: `<el-select v-model="editForm.role" style="width: 100%">`
- L446: `<el-select v-model="editForm.storeId" style="width: 100%" placeholder="请选择门店">`
- L463: `<el-select v-model="inviteForm.role" style="width: 100%">`
- L468: `<el-select v-model="inviteForm.storeId" placeholder="请选择门店" style="width: 100%">`

### src/views/workbench/MarketerCustomerView.vue

状态：已接入专用选择器

#### dialog

- L605: `<el-dialog v-model="measureVisible" title="安排量房" width="460px" destroy-on-close>`
- L617: `<el-dialog v-model="wechatVisible" title="记录客户微信" width="420px" destroy-on-close>`
- L626: `<el-dialog v-model="dormantVisible" title="设置休眠客户" width="460px" destroy-on-close>`

#### specializedPicker

- L607: `<PropertyPicker :key="propertyPickerKey" v-model="propertyId" :customer-id="activeCustomer?.id ?? ''" title="选择量房房屋" placeholder="选择本次量房的房屋" />`

#### select

- L628: `<el-select v-model="dormantForm.reasonCode" placeholder="选择休眠原因" style="width: 100%">`

#### drawer

- L647: `<el-drawer v-model="detailVisible" title="客户详情" size="620px">`

### src/views/workbench/MarketerProjectsView.vue

状态：事件/展示

#### drawer

- L174: `<el-drawer v-model="detailVisible" title="项目进度（只读）" size="620px">`

### src/views/workbench/ProjectExecutionView.vue

状态：已接入专用选择器

#### dialog

- L630: `<el-dialog v-model="scheduleVisible" title="调整施工排期" width="min(640px, 94vw)" append-to-body>`
- L667: `<el-dialog v-model="nodeVisible" :title="\`${taskNodeLabel(nodeKey)} · 节点留证\`" width="min(720px, 94vw)" append-to-body>`
- L691: `<el-dialog v-model="reportVisible" title="发布现场日报" width="min(720px, 94vw)" append-to-body>`

#### form

- L632: `<el-form label-position="top" class="dialog-form">`
- L670: `<el-form label-position="top">`
- L693: `<el-form label-position="top" class="dialog-form">`

#### formItem

- L633: `<el-form-item label="所属阶段" required>`
- L639: `<el-form-item label="计划开始">`
- L642: `<el-form-item label="计划结束">`
- L646: `<el-form-item label="任务责任人">`
- L657: `<el-form-item label="优先级"><el-input v-model="scheduleForm.priority" maxlength="32" /></el-form-item>`
- L658: `<el-form-item label="备注"><el-input v-model="scheduleForm.remark" maxlength="500" /></el-form-item>`
- L671: `<el-form-item label="现场说明">`
- L694: `<el-form-item label="日报标题" required>`
- L697: `<el-form-item label="现场内容" required>`
- L701: `<el-form-item label="所属阶段">`
- L706: `<el-form-item label="关联任务">`
- L712: `<el-form-item label="业主可见">`

#### select

- L634: `<el-select v-model="scheduleForm.stageId" filterable>`
- L702: `<el-select v-model="reportForm.stageId" clearable>`
- L707: `<el-select v-model="reportForm.taskId" clearable filterable>`

#### specializedPicker

- L647: `<EmployeePicker`

### src/views/workbench/RiskQueueView.vue

状态：已接入专用选择器

#### dialog

- L250: `<el-dialog v-model="assignVisible" title="指派受理人" width="460px" destroy-on-close>`
- L260: `<el-dialog v-model="recordVisible" title="写处置记录" width="460px" destroy-on-close>`
- L269: `<el-dialog v-model="closeVisible" title="关闭风险" width="460px" destroy-on-close>`
- L278: `<el-dialog v-model="reopenVisible" title="重开风险" width="460px" destroy-on-close>`

#### specializedPicker

- L252: `<EmployeePicker v-model="assigneeId" placeholder="选择受理人" />`

#### drawer

- L287: `<el-drawer v-model="logsVisible" title="处置时间线" size="480px">`

### src/views/workbench/StoreCustomerView.vue

状态：已接入专用选择器

#### select

- L1068: `<el-select v-if="!isStoreManager" v-model="previewStoreId" size="default" aria-label="预览门店">`

#### dialog

- L1459: `<el-dialog v-model="transferVisible" title="转交客户负责人" width="460px" destroy-on-close>`
- L1473: `<el-dialog v-model="assignVisible" title="指派客户设计师" width="460px" destroy-on-close>`

#### specializedPicker

- L1461: `<EmployeePicker`
- L1475: `<PropertyPicker :key="propertyPickerKey" v-model="propertyId" :customer-id="selectedCustomer?.id ?? ''" title="选择当前房屋" placeholder="选择本次指派对应的房屋" />`
- L1478: `<EmployeePicker`

### src/views/workbench/TeamCustomerView.vue

状态：已接入专用选择器

#### dialog

- L173: `<el-dialog v-model="assignVisible" title="指派客户设计师" width="460px" destroy-on-close>`

#### specializedPicker

- L175: `<PropertyPicker :key="propertyPickerKey" v-model="propertyId" :customer-id="activeCustomer?.id ?? ''" title="选择 activeProperty" placeholder="选择本次指派对应的房屋" />`
- L178: `<EmployeePicker`
