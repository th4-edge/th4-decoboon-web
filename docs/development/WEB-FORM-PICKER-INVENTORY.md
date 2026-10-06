# Web 表单与选择器全量清单

> 由 `node scripts/audit-web-form-picker.mjs --write` 生成。
> 执行规范：`docs/standards/WEB-业务选择器与表单设计规范.md`。

## 汇总

- 涉及文件：38
- 表单：25
- 表单项：130
- 普通 select：35
- 原生 select：1
- 原生 input/textarea：35
- Dialog：22
- Drawer：11
- 专用选择器引用：12
- 风险标记：0

## 风险标记

- 未发现静态高风险模式。

## 文件清单

| 文件 | 批次 | 表单 | 表单项 | Select | 原生选择/输入 | Dialog | Drawer | 专用选择器 | 状态 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `src/components/QuoteSheetGrid.vue` | 批次 C | 0 | 0 | 0 | 6 | 0 | 0 | 0 | 专业编辑网格 |
| `src/components/finance/FinanceAttendanceDrawer.vue` | 已完成/样板 | 1 | 8 | 0 | 0 | 0 | 1 | 0 | 已完成：考勤单据 |
| `src/components/finance/FinanceCollectionDrawer.vue` | 已完成/样板 | 1 | 6 | 1 | 0 | 0 | 1 | 2 | 已完成：收款单据 |
| `src/components/finance/FinanceCommissionDrawer.vue` | 已完成/样板 | 1 | 5 | 0 | 0 | 0 | 1 | 1 | 已完成：提成单据 |
| `src/components/finance/FinanceCompensationDrawer.vue` | 已完成/样板 | 1 | 5 | 0 | 0 | 0 | 1 | 0 | 已完成：薪酬单据 |
| `src/components/finance/FinanceEmployeePaymentDrawer.vue` | 已完成/样板 | 1 | 4 | 2 | 0 | 0 | 1 | 0 | 待审计/升级 |
| `src/components/finance/FinanceLedgerDrawer.vue` | 已完成/样板 | 1 | 10 | 2 | 0 | 0 | 1 | 2 | 已完成：手工记账单 |
| `src/components/finance/FinancePayableDrawer.vue` | 已完成/样板 | 1 | 9 | 1 | 0 | 0 | 1 | 1 | 已完成：应付单据 |
| `src/components/finance/FinancePaymentDrawer.vue` | 已完成/样板 | 1 | 8 | 1 | 0 | 0 | 1 | 3 | 已完成：付款单据 |
| `src/components/finance/FinanceReceivableDrawer.vue` | 已完成/样板 | 1 | 6 | 0 | 0 | 0 | 1 | 1 | 已完成：应收收据 |
| `src/components/finance/FinanceRefundDrawer.vue` | 已完成/样板 | 1 | 5 | 2 | 0 | 0 | 1 | 0 | 待审计/升级 |
| `src/components/finance/VoucherDesignerCanvas.vue` | 批次 A | 0 | 0 | 0 | 12 | 0 | 0 | 0 | 专业编辑器（保留） |
| `src/components/picker/CustomerPicker.vue` | 已完成/样板 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 已完成：客户专用选择器 |
| `src/components/picker/EmployeePicker.vue` | 已完成/样板 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 已完成：员工专用选择器 |
| `src/components/picker/LedgerCategoryPicker.vue` | 已完成/样板 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 选择器参考实现 |
| `src/components/picker/PayablePicker.vue` | 已完成/样板 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 已完成：应付专用选择器 |
| `src/components/picker/ProjectPicker.vue` | 已完成/样板 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 选择器参考实现 |
| `src/components/picker/PropertyPicker.vue` | 已完成/样板 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 已完成：房屋专用选择器 |
| `src/components/picker/ReceivablePicker.vue` | 已完成/样板 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 已完成：应收专用选择器 |
| `src/components/picker/RemoteSelectionShell.vue` | 已完成/样板 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 选择器参考实现 |
| `src/components/picker/WorkerPicker.vue` | 已完成/样板 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 选择器参考实现 |
| `src/views/auth/LoginView.vue` | 批次 D | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 已完成：轻量表单 |
| `src/views/designer/DesignerAcceptanceView.vue` | 批次 B | 1 | 5 | 0 | 2 | 1 | 0 | 0 | 已完成：验收提交单 |
| `src/views/designer/DesignerCatalogView.vue` | 批次 D | 1 | 5 | 4 | 0 | 0 | 0 | 0 | 已完成：只读筛选 |
| `src/views/designer/DesignerContractChangesView.vue` | 批次 A | 1 | 4 | 1 | 3 | 2 | 0 | 0 | 已完成 |
| `src/views/designer/DesignerCustomersView.vue` | 批次 B | 5 | 23 | 5 | 3 | 5 | 0 | 0 | 已完成：客户房屋上下文 |
| `src/views/designer/DesignerDesignWorkspaceView.vue` | 批次 B | 1 | 6 | 1 | 9 | 1 | 0 | 0 | 已完成：方案上下文与空间表单 |
| `src/views/designer/DesignerMaterialSelectionView.vue` | 批次 B | 1 | 6 | 0 | 0 | 0 | 0 | 0 | 字段编辑区 |
| `src/views/designer/DesignerProjectsView.vue` | 批次 D | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 已完成：项目列表筛选 |
| `src/views/designer/DesignerQuoteWorkspaceView.vue` | 批次 C | 1 | 3 | 3 | 1 | 4 | 0 | 0 | 已完成：专业工作区 |
| `src/views/designer/components/DesignCatalogPicker.vue` | 批次 C | 0 | 0 | 1 | 0 | 0 | 1 | 0 | 选择器参考实现 |
| `src/views/designer/components/DesignItemSheet.vue` | 批次 C | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 已接入专用选择器 |
| `src/views/finance/FinanceLedgerView.vue` | 已完成/样板 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 筛选器审计 |
| `src/views/finance/FinancePayablesView.vue` | 已完成/样板 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 筛选器审计 |
| `src/views/finance/FinancePaymentsView.vue` | 已完成/样板 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 已接入专用选择器 |
| `src/views/finance/FinanceReceivablesView.vue` | 已完成/样板 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 筛选器审计 |
| `src/views/finance/FinanceVoucherTemplatesView.vue` | 批次 A | 3 | 10 | 3 | 0 | 0 | 0 | 0 | 已完成：快速版式实时结果 |
| `src/views/finance/FinanceVouchersView.vue` | 已完成/样板 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 筛选器审计 |

## 明细

### src/components/QuoteSheetGrid.vue

状态：专业编辑网格

#### nativeInput

- L308: `<input`
- L360: `<input`
- L379: `<input`
- L394: `<input`
- L409: `<input`
- L424: `<input`

### src/components/finance/FinanceAttendanceDrawer.vue

状态：已完成：考勤单据

#### drawer

- L122: `<el-drawer :model-value="visible" title="月度考勤" size="min(1040px, 96vw)" destroy-on-close @update:model-value="emit('update:visible', $event)">`

#### form

- L125: `<el-form label-position="top" class="finance-form-grid" @submit.prevent>`

#### formItem

- L126: `<el-form-item label="员工" class="finance-form-grid__wide">`
- L129: `<el-form-item label="工资月份">`
- L132: `<el-form-item label="应出勤"><el-input v-model="form.scheduledDays" type="number" /></el-form-item>`
- L133: `<el-form-item label="正常出勤"><el-input v-model="form.normalDays" type="number" /></el-form-item>`
- L134: `<el-form-item label="事假"><el-input v-model="form.personalLeaveDays" type="number" /></el-form-item>`
- L135: `<el-form-item label="病假"><el-input v-model="form.sickLeaveDays" type="number" /></el-form-item>`
- L136: `<el-form-item label="旷工"><el-input v-model="form.absenceDays" type="number" /></el-form-item>`
- L137: `<el-form-item label="备注" class="finance-form-grid__wide"><el-input v-model="form.remark" type="textarea" :rows="3" maxlength="300" show-word-limit /></el-form-item>`

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

- L73: `<el-drawer :model-value="visible" title="新增员工薪酬方案" size="min(900px, 96vw)" destroy-on-close @update:model-value="emit('update:visible', $event)">`

#### form

- L76: `<el-form label-position="top" class="finance-form-grid" @submit.prevent>`

#### formItem

- L77: `<el-form-item label="员工" class="finance-form-grid__wide">`
- L80: `<el-form-item label="月固定工资">`
- L85: `<el-form-item label="生效日期">`
- L88: `<el-form-item label="失效日期（可空）">`
- L91: `<el-form-item label="备注" class="finance-form-grid__wide">`

### src/components/finance/FinanceEmployeePaymentDrawer.vue

状态：待审计/升级

#### drawer

- L56: `<el-drawer :model-value="visible" title="员工薪酬发放" size="min(680px, 96vw)" @update:model-value="emit('update:visible', $event)">`

#### form

- L58: `<el-form label-position="top">`

#### formItem

- L59: `<el-form-item label="待发应付"><el-select v-model="selectedId" :loading="loading" style="width:100%"><el-option v-for="item in payables" :key="item.id" :label="\`${item.employee.name} ·`
- L60: `<el-form-item label="付款账户"><el-select v-model="form.account" style="width:100%"><el-option v-for="(label,value) in ACCOUNT_LABEL" :key="value" :label="label" :value="value" /></el-`
- L61: `<el-form-item label="发放日期"><el-date-picker v-model="form.paidAt" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>`
- L62: `<el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="3" maxlength="300" /></el-form-item>`

#### select

- L59: `<el-form-item label="待发应付"><el-select v-model="selectedId" :loading="loading" style="width:100%"><el-option v-for="item in payables" :key="item.id" :label="\`${item.employee.name} ·`
- L60: `<el-form-item label="付款账户"><el-select v-model="form.account" style="width:100%"><el-option v-for="(label,value) in ACCOUNT_LABEL" :key="value" :label="label" :value="value" /></el-`

### src/components/finance/FinanceLedgerDrawer.vue

状态：已完成：手工记账单

#### drawer

- L166: `<el-drawer`

#### specializedPicker

- L176: `<ProjectPicker v-model="form.projectId" placeholder="选择关联项目（可选）" clearable @change="onProjectChange" />`
- L195: `<LedgerCategoryPicker v-model="form.categoryId" :direction="form.direction" @change="onCategoryChange" />`

#### form

- L181: `<el-form label-position="top" class="finance-form-grid" @submit.prevent>`

#### formItem

- L182: `<el-form-item label="用途">`
- L187: `<el-form-item label="方向">`
- L194: `<el-form-item label="账务分类">`
- L197: `<el-form-item label="金额">`
- L202: `<el-form-item label="资金账户">`
- L207: `<el-form-item label="发生日期">`
- L210: `<el-form-item label="对方">`
- L213: `<el-form-item label="摘要" class="finance-form-grid__wide">`
- L216: `<el-form-item label="备注" class="finance-form-grid__wide">`
- L219: `<el-form-item v-if="item" label="更正原因" class="finance-form-grid__wide">`

#### select

- L183: `<el-select v-model="form.purpose" style="width: 100%">`
- L203: `<el-select v-model="form.account" style="width: 100%">`

### src/components/finance/FinancePayableDrawer.vue

状态：已完成：应付单据

#### drawer

- L128: `<el-drawer`

#### specializedPicker

- L138: `<ProjectPicker v-model="form.projectId" placeholder="选择所属项目" :disabled="Boolean(item)" clearable @change="onProjectChange" />`

#### form

- L146: `<el-form label-position="top" class="finance-form-grid" @submit.prevent>`

#### formItem

- L147: `<el-form-item label="应付类型">`
- L152: `<el-form-item label="应付名称" class="finance-form-grid__wide">`
- L155: `<el-form-item label="收款方">`
- L158: `<el-form-item label="账期/期间">`
- L161: `<el-form-item label="应付金额">`
- L166: `<el-form-item label="到期日">`
- L169: `<el-form-item label="紧急付款">`
- L172: `<el-form-item label="来源单号">`
- L175: `<el-form-item label="备注" class="finance-form-grid__wide">`

#### select

- L148: `<el-select v-model="form.type" :disabled="Boolean(item)" style="width: 100%">`

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

- L162: `<el-drawer`

#### specializedPicker

- L174: `<ProjectPicker v-model="form.projectId" placeholder="选择所属项目" :disabled="Boolean(item)" @change="onProjectChange" />`

#### form

- L187: `<el-form label-position="top" @submit.prevent>`

#### formItem

- L188: `<el-form-item label="节点名称">`
- L191: `<el-form-item label="应收类型">`
- L204: `<el-form-item label="合同阶段 / 触发条件">`
- L209: `<el-form-item label="应收金额" class="receivable-document__amount-block">`
- L214: `<el-form-item label="到期日" class="receivable-document__due-block">`
- L224: `<el-form-item label="节点说明">`

### src/components/finance/FinanceRefundDrawer.vue

状态：待审计/升级

#### drawer

- L61: `<el-drawer :model-value="visible" title="登记客户退款" size="min(720px, 96vw)" destroy-on-close @update:model-value="emit('update:visible', $event)">`

#### form

- L63: `<el-form label-position="top" class="finance-form-grid" @submit.prevent>`

#### formItem

- L64: `<el-form-item label="原收款" class="finance-form-grid__wide">`
- L69: `<el-form-item label="退款金额"><el-input v-model="form.amount" inputmode="decimal" placeholder="0.00"><template #prepend>¥</template></el-input></el-form-item>`
- L70: `<el-form-item label="退款账户"><el-select v-model="form.account" style="width:100%"><el-option v-for="(label, value) in ACCOUNT_LABEL" :key="value" :label="label" :value="value" /></el`
- L71: `<el-form-item label="退款日期"><el-date-picker v-model="form.refundAt" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>`
- L72: `<el-form-item label="退款原因"><el-input v-model="form.reason" type="textarea" :rows="3" maxlength="300" show-word-limit /></el-form-item>`

#### select

- L65: `<el-select v-model="form.receiptId" filterable :loading="loading" placeholder="选择原收款记录" style="width: 100%">`
- L70: `<el-form-item label="退款账户"><el-select v-model="form.account" style="width:100%"><el-option v-for="(label, value) in ACCOUNT_LABEL" :key="value" :label="label" :value="value" /></el`

### src/components/finance/VoucherDesignerCanvas.vue

状态：专业编辑器（保留）

#### nativeInput

- L509: `<input :value="Math.round(selectedElement.xMm)" type="number" @input="updateSelected({ xMm: Number(($event.target as HTMLInputElement).value) })">`
- L510: `<input :value="Math.round(selectedElement.yMm)" type="number" @input="updateSelected({ yMm: Number(($event.target as HTMLInputElement).value) })">`
- L514: `<input :value="Math.round(selectedElement.widthMm)" type="number" @input="updateSelected({ widthMm: Number(($event.target as HTMLInputElement).value) })">`
- L515: `<input :value="Math.round(selectedElement.heightMm)" type="number" @input="updateSelected({ heightMm: Number(($event.target as HTMLInputElement).value) })">`
- L519: `<input :value="selectedElement.style?.fontSize ?? 12" type="number" @input="updateElementStyle('fontSize', Number(($event.target as HTMLInputElement).value))">`
- L530: `<input :checked="Boolean(selectedElement.style?.bold)" type="checkbox" @change="updateElementStyle('bold', ($event.target as HTMLInputElement).checked)">`
- L541: `<input :value="selectedElement.binding ?? ''" @input="updateSelected({ binding: ($event.target as HTMLInputElement).value })">`
- L548: `<input :value="selectedTable.rowHeightMm" type="number" @input="updateSelected({ rowHeightMm: Number(($event.target as HTMLInputElement).value) })">`
- L552: `<input :value="selectedTable.rowsPerPage" type="number" @input="updateSelected({ rowsPerPage: Number(($event.target as HTMLInputElement).value) })">`
- L555: `<input :checked="selectedTable.headerRepeat" type="checkbox" @change="updateSelected({ headerRepeat: ($event.target as HTMLInputElement).checked })">`
- L562: `<input :checked="selectedTable.columns.some((item) => item.key === column.key)" type="checkbox" @change="toggleTableColumn(column.key)">`

#### nativeSelect

- L523: `<select :value="selectedElement.style?.align ?? 'left'" @change="updateElementStyle('align', ($event.target as HTMLSelectElement).value)">`

### src/components/picker/CustomerPicker.vue

状态：已完成：客户专用选择器

#### dialog

- L188: `<el-dialog v-model="visible" :title="title" width="min(980px, 96vw)" append-to-body destroy-on-close class="customer-picker__dialog">`

### src/components/picker/EmployeePicker.vue

状态：已完成：员工专用选择器

#### dialog

- L177: `<el-dialog v-model="visible" title="选择员工" width="min(1000px, 96vw)" append-to-body destroy-on-close class="employee-picker__dialog">`

### src/components/picker/LedgerCategoryPicker.vue

状态：选择器参考实现

#### dialog

- L150: `<el-dialog v-model="visible" title="选择账务分类" width="680px" destroy-on-close>`

### src/components/picker/PayablePicker.vue

状态：已完成：应付专用选择器

#### dialog

- L231: `<el-dialog v-model="visible" title="选择待付应付单" width="min(1000px, 96vw)" append-to-body destroy-on-close class="payable-picker__dialog">`

### src/components/picker/ProjectPicker.vue

状态：选择器参考实现

#### dialog

- L245: `<el-dialog v-model="visible" :title="title" width="min(1180px, 96vw)" destroy-on-close>`

### src/components/picker/PropertyPicker.vue

状态：已完成：房屋专用选择器

#### dialog

- L176: `<el-dialog v-model="visible" :title="title" width="min(960px, 96vw)" append-to-body destroy-on-close class="property-picker__dialog">`

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

### src/views/auth/LoginView.vue

状态：已完成：轻量表单

#### form

- L79: `<el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="submit">`

#### formItem

- L80: `<el-form-item label="手机号" prop="phone">`
- L83: `<el-form-item label="登录密码" prop="password">`

### src/views/designer/DesignerAcceptanceView.vue

状态：已完成：验收提交单

#### dialog

- L310: `<el-dialog v-model="submitVisible" :title="isResubmit ? '提交复验' : '提交阶段验收'" width="min(980px, 96vw)" append-to-body class="aw__submit-dialog">`

#### form

- L335: `<el-form label-position="top">`

#### formItem

- L336: `<el-form-item label="验收说明" required><el-input v-model="submitForm.content" type="textarea" :rows="4" maxlength="500" show-word-limit /></el-form-item>`
- L337: `<el-form-item label="问题清单"><el-input v-model="submitForm.issuesText" type="textarea" :rows="3" placeholder="一行一个问题；没有可不填" /></el-form-item>`
- L338: `<el-form-item label="现场证据" required>`
- L348: `<el-form-item label="整改说明" required><el-input v-model="submitForm.rectificationNote" type="textarea" :rows="3" maxlength="500" show-word-limit /></el-form-item>`
- L349: `<el-form-item label="整改后照片" required>`

#### nativeInput

- L341: `<input ref="evidenceInput" type="file" accept="image/*,video/*" multiple hidden @change="uploadEvidence" />`
- L352: `<input ref="rectificationInput" type="file" accept="image/*" multiple hidden @change="uploadRectificationEvidence" />`

### src/views/designer/DesignerCatalogView.vue

状态：已完成：只读筛选

#### form

- L144: `<el-form label-position="top">`

#### formItem

- L145: `<el-form-item label="搜索">`
- L148: `<el-form-item label="分类">`
- L153: `<el-form-item label="品牌">`
- L158: `<el-form-item label="系列">`
- L163: `<el-form-item label="规格">`

#### select

- L149: `<el-select v-model="filters.category" clearable placeholder="全部分类" style="width: 100%" @change="loadItems">`
- L154: `<el-select v-model="filters.brand" clearable placeholder="全部品牌" style="width: 100%" @change="() => { filters.series = ''; filters.spec = ''; loadItems() }">`
- L159: `<el-select v-model="filters.series" clearable placeholder="全部系列" style="width: 100%" @change="() => { filters.spec = ''; loadItems() }">`
- L164: `<el-select v-model="filters.spec" clearable placeholder="全部规格" style="width: 100%" @change="loadItems">`

### src/views/designer/DesignerContractChangesView.vue

状态：已完成

#### dialog

- L308: `<el-dialog v-model="createVisible" title="发起增减项" width="min(860px, 96vw)" append-to-body class="cw__change-dialog">`
- L365: `<el-dialog v-model="confirmVisible" title="登记客户现场签认" width="min(920px, 96vw)" append-to-body class="cw__confirm-dialog">`

#### form

- L329: `<el-form label-position="top">`

#### formItem

- L330: `<el-form-item label="变更类型">`
- L335: `<el-form-item label="金额变化">`
- L338: `<el-form-item label="变更原因">`
- L341: `<el-form-item label="现场证据">`

#### select

- L331: `<el-select v-model="createForm.type" style="width: 100%">`

#### nativeInput

- L344: `<input ref="createEvidenceInput" type="file" accept="image/*,.pdf" multiple hidden @change="uploadFiles($event, 'createEvidence')" />`
- L414: `<input ref="signatureInput" type="file" accept="image/*" hidden @change="uploadFiles($event, 'signature')" />`
- L427: `<input ref="confirmEvidenceInput" type="file" accept="image/*" multiple hidden @change="uploadFiles($event, 'confirmEvidence')" />`

### src/views/designer/DesignerCustomersView.vue

状态：已完成：客户房屋上下文

#### select

- L645: `<el-select v-model="stageFilter" placeholder="全部阶段" clearable @change="loadCustomers">`
- L854: `<el-select v-model="followForm.way" style="width: 100%">`
- L926: `<el-form-item label="诉求类型"><el-select v-model="requirementForm.kind" style="width: 100%"><el-option label="诉求" value="demand" /><el-option label="排斥点" value="reject" /></el-select>`
- L927: `<el-form-item label="分类"><el-select v-model="requirementForm.category" style="width: 100%"><el-option v-for="item in requirementCategories" :key="item.value" :label="item.label" :v`
- L928: `<el-form-item label="优先级"><el-select v-model="requirementForm.priority" style="width: 100%"><el-option v-for="item in requirementPriorities" :key="item.value" :label="item.label" :`

#### dialog

- L850: `<el-dialog v-model="followVisible" title="写跟进" width="520px" append-to-body>`
- L864: `<el-dialog v-model="measureVisible" title="安排量房" width="480px" append-to-body>`
- L873: `<el-dialog v-model="measureResultVisible" title="登记量房结论" width="680px" append-to-body>`
- L912: `<el-dialog v-model="schemeVisible" title="新建设计方案" width="600px" append-to-body>`
- L923: `<el-dialog v-model="requirementVisible" title="记录设计诉求" width="620px" append-to-body>`

#### form

- L852: `<el-form label-position="top">`
- L866: `<el-form label-position="top">`
- L875: `<el-form label-position="top" class="cd__dialog-grid">`
- L914: `<el-form label-position="top" class="cd__dialog-grid">`
- L925: `<el-form label-position="top" class="cd__dialog-grid">`

#### formItem

- L853: `<el-form-item label="跟进方式">`
- L858: `<el-form-item label="跟进内容"><el-input v-model="followForm.content" type="textarea" :rows="4" maxlength="500" show-word-limit /></el-form-item>`
- L859: `<el-form-item label="下次跟进"><el-date-picker v-model="followForm.nextFollowAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" /></el-form-item>`
- L867: `<el-form-item label="量房时间"><el-date-picker v-model="measureForm.measureAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" /></el-form-item>`
- L876: `<el-form-item label="量房时间"><el-date-picker v-model="measureResultForm.measureTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" /></el-form-item>`
- L877: `<el-form-item label="原始结构" class="cd__dialog-wide"><el-input v-model="measureResultForm.originalStructure" type="textarea" :rows="2" /></el-form-item>`
- L878: `<el-form-item label="尺寸记录" class="cd__dialog-wide"><el-input v-model="measureResultForm.dimensions" type="textarea" :rows="2" /></el-form-item>`
- L879: `<el-form-item label="客户诉求" class="cd__dialog-wide"><el-input v-model="measureResultForm.customerRequirements" type="textarea" :rows="3" /></el-form-item>`
- L880: `<el-form-item label="设计师结论" class="cd__dialog-wide"><el-input v-model="measureResultForm.designerConclusion" type="textarea" :rows="3" /></el-form-item>`
- L881: `<el-form-item label="现场照片" class="cd__dialog-wide">`
- L890: `<el-form-item label="结构 / 图纸" class="cd__dialog-wide">`
- L899: `<el-form-item label="其他附件" class="cd__dialog-wide">`
- L915: `<el-form-item label="方案名称"><el-input v-model="schemeForm.name" maxlength="80" /></el-form-item>`
- L916: `<el-form-item label="风格"><el-input v-model="schemeForm.style" maxlength="40" /></el-form-item>`
- L917: `<el-form-item label="户型"><el-input v-model="schemeForm.layout" maxlength="40" /></el-form-item>`
- L918: `<el-form-item label="方案说明" class="cd__dialog-wide"><el-input v-model="schemeForm.description" type="textarea" :rows="4" maxlength="500" show-word-limit /></el-form-item>`
- L926: `<el-form-item label="诉求类型"><el-select v-model="requirementForm.kind" style="width: 100%"><el-option label="诉求" value="demand" /><el-option label="排斥点" value="reject" /></el-select>`
- L927: `<el-form-item label="分类"><el-select v-model="requirementForm.category" style="width: 100%"><el-option v-for="item in requirementCategories" :key="item.value" :label="item.label" :v`
- L928: `<el-form-item label="优先级"><el-select v-model="requirementForm.priority" style="width: 100%"><el-option v-for="item in requirementPriorities" :key="item.value" :label="item.label" :`
- L929: `<el-form-item label="空间"><el-input v-model="requirementForm.spaceName" placeholder="如客厅 / 主卧，可留空" /></el-form-item>`
- L930: `<el-form-item label="标题" class="cd__dialog-wide"><el-input v-model="requirementForm.title" maxlength="80" /></el-form-item>`
- L931: `<el-form-item label="详细说明" class="cd__dialog-wide"><el-input v-model="requirementForm.detail" type="textarea" :rows="3" /></el-form-item>`
- L932: `<el-form-item label="设计回应" class="cd__dialog-wide"><el-input v-model="requirementForm.response" type="textarea" :rows="2" /></el-form-item>`

#### nativeInput

- L884: `<input ref="measureSiteInput" type="file" accept="image/*" multiple hidden @change="uploadMeasureFiles($event, 'site')" />`
- L893: `<input ref="measureStructureInput" type="file" accept="image/*,.pdf" multiple hidden @change="uploadMeasureFiles($event, 'structure')" />`
- L902: `<input ref="measureAttachmentInput" type="file" multiple hidden @change="uploadMeasureFiles($event, 'attachment')" />`

### src/views/designer/DesignerDesignWorkspaceView.vue

状态：已完成：方案上下文与空间表单

#### nativeInput

- L482: `<input ref="coverInput" type="file" accept="image/*" hidden @change="uploadSchemeFile($event, 'cover')" />`
- L492: `<input ref="cadInput" type="file" accept=".dwg,.dxf,.pdf" hidden @change="uploadSchemeFile($event, 'cad')" />`
- L493: `<input ref="originalPlanInput" type="file" accept="image/*,.pdf" hidden @change="uploadSchemeFile($event, 'originalPlan')" />`
- L500: `<input ref="sitePhotoInput" type="file" accept="image/*" multiple hidden @change="uploadSchemeFile($event, 'site')" />`
- L509: `<input ref="surveyPhotoInput" type="file" accept="image/*,.pdf" multiple hidden @change="uploadSchemeFile($event, 'survey')" />`
- L510: `<input ref="originalPlanImageInput" type="file" accept="image/*,.pdf" multiple hidden @change="uploadSchemeFile($event, 'originalPlanImage')" />`
- L520: `<input ref="demolitionInput" type="file" accept="image/*,.pdf" hidden @change="uploadSchemeFile($event, 'demolition')" />`
- L521: `<input ref="masonryInput" type="file" accept="image/*,.pdf" hidden @change="uploadSchemeFile($event, 'masonry')" />`
- L522: `<input ref="optimizationInput" type="file" accept="image/*,.pdf" hidden @change="uploadSchemeFile($event, 'optimization')" />`

#### dialog

- L538: `<el-dialog v-model="spaceVisible" :title="spaceForm.spaceId ? '编辑空间' : '新增空间'" width="min(720px, 96vw)" append-to-body>`

#### form

- L540: `<el-form label-position="top" class="dw__dialog-grid">`

#### formItem

- L541: `<el-form-item label="空间类型"><el-select v-model="spaceForm.type" style="width: 100%"><el-option v-for="(label, value) in SPACE_TYPE_LABELS" :key="value" :label="label" :value="value"`
- L542: `<el-form-item label="空间名称"><el-input v-model="spaceForm.name" maxlength="40" /></el-form-item>`
- L543: `<el-form-item label="长度（米）"><el-input-number v-model="spaceForm.length" :min="0" :precision="2" style="width: 100%" /></el-form-item>`
- L544: `<el-form-item label="宽度（米）"><el-input-number v-model="spaceForm.width" :min="0" :precision="2" style="width: 100%" /></el-form-item>`
- L545: `<el-form-item label="高度（米）"><el-input-number v-model="spaceForm.height" :min="0" :precision="2" style="width: 100%" /></el-form-item>`
- L546: `<el-form-item label="备注" class="dw__dialog-wide"><el-input v-model="spaceForm.remark" type="textarea" :rows="3" maxlength="300" show-word-limit /></el-form-item>`

#### select

- L541: `<el-form-item label="空间类型"><el-select v-model="spaceForm.type" style="width: 100%"><el-option v-for="(label, value) in SPACE_TYPE_LABELS" :key="value" :label="label" :value="value"`

### src/views/designer/DesignerMaterialSelectionView.vue

状态：字段编辑区

#### form

- L245: `<el-form label-position="top" :disabled="!isEditable(selectedItem)">`

#### formItem

- L247: `<el-form-item label="颜色 / 花色"><el-input v-model="editor.color" placeholder="例如：拉丝香槟金" /></el-form-item>`
- L248: `<el-form-item label="规格 / 型号"><el-input v-model="editor.spec" placeholder="例如：300×600mm" /></el-form-item>`
- L249: `<el-form-item label="品牌"><el-input v-model="editor.brand" placeholder="例如：奥普" /></el-form-item>`
- L250: `<el-form-item label="工艺 / 材质"><el-input v-model="editor.process" placeholder="例如：同色收边" /></el-form-item>`
- L252: `<el-form-item label="选材说明"><el-input v-model="editor.content" type="textarea" :rows="4" placeholder="留空时会根据上方字段自动汇总；也可以直接填写客户沟通确认的选材内容。" /></el-form-item>`
- L253: `<el-form-item label="备注"><el-input v-model="editor.remark" placeholder="客户偏好、到货要求或需要现场确认的事项" /></el-form-item>`

### src/views/designer/DesignerProjectsView.vue

状态：已完成：项目列表筛选

#### select

- L141: `<el-select v-model="statusFilter" clearable placeholder="全部状态" @change="loadProjects">`

### src/views/designer/DesignerQuoteWorkspaceView.vue

状态：已完成：专业工作区

#### nativeInput

- L988: `<input ref="importInput" type="file" accept=".xlsx" hidden @change="handleImportFile" />`

#### dialog

- L1061: `<el-dialog v-model="diffVisible" title="版本对比" width="920px" append-to-body>`
- L1115: `<el-dialog v-model="batchVisible" title="批量改价" width="min(620px, 96vw)" append-to-body>`
- L1159: `<el-dialog v-model="importVisible" title="Excel 导入预览" width="920px" append-to-body>`
- L1209: `<el-dialog v-model="pdfVisible" title="报价 PDF" width="520px" append-to-body>`

#### select

- L1063: `<el-select v-model="diffBaseId" placeholder="选择对比版本" style="width: 220px" @change="loadVersionDiff">`
- L1130: `<el-select v-model="batchField" style="width: 100%">`
- L1136: `<el-select v-model="batchMode" style="width: 100%">`

#### form

- L1128: `<el-form label-position="top" class="qw__batch-grid">`

#### formItem

- L1129: `<el-form-item label="改价字段">`
- L1135: `<el-form-item label="改价方式">`
- L1144: `<el-form-item :label="batchMode.includes('Percent') ? '比例（%）' : '金额（元）'">`

### src/views/designer/components/DesignCatalogPicker.vue

状态：选择器参考实现

#### drawer

- L418: `<el-drawer`

#### select

- L522: `<el-select v-model="spaceId" placeholder="选择归属区域" style="width: 200px">`

### src/views/designer/components/DesignItemSheet.vue

状态：已接入专用选择器

#### specializedPicker

- L727: `<DesignCatalogPicker`

### src/views/finance/FinanceLedgerView.vue

状态：筛选器审计

#### select

- L188: `<el-select v-model="direction" clearable placeholder="全部方向" style="width: 130px" @change="resetAndLoad">`

### src/views/finance/FinancePayablesView.vue

状态：筛选器审计

#### select

- L161: `<el-select v-if="!salaryMode" v-model="typeFilter" clearable placeholder="全部类型" style="width: 140px" @change="resetAndLoad">`
- L164: `<el-select v-model="statusFilter" clearable placeholder="全部状态" style="width: 140px" @change="resetAndLoad">`

### src/views/finance/FinancePaymentsView.vue

状态：已接入专用选择器

#### dialog

- L196: `<el-dialog v-model="workerDialogVisible" title="补录发放工人" width="560px" destroy-on-close>`

#### specializedPicker

- L199: `<WorkerPicker v-model="selectedWorkerId" />`

### src/views/finance/FinanceReceivablesView.vue

状态：筛选器审计

#### select

- L162: `<el-select v-model="typeFilter" clearable placeholder="全部类型" style="width: 140px" @change="resetAndLoad">`
- L165: `<el-select v-model="statusFilter" clearable placeholder="全部状态" style="width: 140px" @change="resetAndLoad">`

### src/views/finance/FinanceVoucherTemplatesView.vue

状态：已完成：快速版式实时结果

#### form

- L385: `<el-form label-position="top" class="finance-form-grid">`
- L414: `<el-form label-position="top" class="finance-form-grid">`
- L441: `<el-form label-position="top" class="finance-form-grid">`

#### formItem

- L386: `<el-form-item label="模板名称">`
- L389: `<el-form-item label="单据类型">`
- L395: `<el-form-item label="主色">`
- L398: `<el-form-item label="正文字号">`
- L401: `<el-form-item label="行距">`
- L415: `<el-form-item label="纸张">`
- L422: `<el-form-item label="方向">`
- L428: `<el-form-item label="页边距（毫米）">`
- L442: `<el-form-item v-for="(label, index) in layout.signatures" :key="index" :label="\`签字栏 ${index + 1}\`">`
- L445: `<el-form-item label="页脚说明">`

#### select

- L390: `<el-select :model-value="templateType" style="width: 100%" @change="switchType($event as TemplateType)">`
- L416: `<el-select v-model="layout.pageSize" style="width: 100%">`
- L423: `<el-select v-model="layout.orientation" style="width: 100%">`

### src/views/finance/FinanceVouchersView.vue

状态：筛选器审计

#### select

- L129: `<el-select v-model="typeFilter" clearable placeholder="全部类型" style="width: 130px" @change="resetAndLoad">`
- L132: `<el-select v-model="statusFilter" clearable placeholder="全部状态" style="width: 130px" @change="resetAndLoad">`
