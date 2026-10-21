import { post } from '@/core/http'
import { runtime } from '@/core/runtime'
import type { ProjectBrief, ProjectStatus } from '@/domains/project/model'
import type {
  CommissionAdjustment,
  CommissionAdjustmentStatus,
  CommissionAdjustmentType,
  EmployeeCommissionItem,
  EmployeeCommissionStatus,
  EmployeeAttendanceStatus,
  EmployeeAttendanceSummary,
  EmployeeCompensationScheme,
  FinanceEmployeeRef,
  EmployeePayrollItem,
  EmployeePayrollSheet,
  EmployeePayrollSheetStatus,
  FinanceLedgerReport,
  FinancePage,
  FinancePayableReport,
  FinanceProjectReport,
  FinanceSummary,
  FundAccount,
  Ledger,
  LedgerCategory,
  LedgerDirection,
  LedgerManualPurpose,
  OpeningBalance,
  PartnerLedgerReport,
  Payable,
  PayableStatus,
  PayableType,
  Payment,
  Receipt,
  ReceiptRefund,
  Receivable,
  ReceivableStatus,
  ReceivableType,
  Settlement,
  SettlementStatus,
  Voucher,
  VoucherReport,
  WorkerRef,
  Payslip,
  PayslipStatus,
  PayrollWorkbenchReport
} from './model'

type RawRecord = Record<string, unknown>

function fileUrl(value: string): string {
  if (!value || /^https?:\/\//i.test(value) || value.startsWith('/api/')) return value
  const base = runtime.apiBase.endsWith('/') ? runtime.apiBase : `${runtime.apiBase}/`
  return `${base}${value.startsWith('/') ? value.slice(1) : value}`
}

const RECEIVABLE_TYPE_API: Record<ReceivableType, string> = {
  first: 'First', progress: 'Progress', final: 'Final', retention: 'Retention', other: 'Other'
}
const RECEIVABLE_TYPE_UI: Record<string, ReceivableType> = {
  first: 'first', progress: 'progress', final: 'final', retention: 'retention', other: 'other'
}
const RECEIVABLE_STATUS_UI: Record<string, ReceivableStatus> = {
  pending: 'pending', partial: 'partial', received: 'received', overdue: 'overdue', closed: 'closed'
}
const PAYABLE_TYPE_API: Record<PayableType, string> = {
  material: 'Material', salary: 'Salary', project: 'Project', supplier: 'Supplier', expense: 'Expense', other: 'Other'
}
const PAYABLE_TYPE_UI: Record<string, PayableType> = {
  material: 'material', salary: 'salary', project: 'project', supplier: 'supplier', expense: 'expense', other: 'other'
}
const PAYABLE_STATUS_UI: Record<string, PayableStatus> = {
  pending: 'pending', partial: 'partial', paid: 'paid', overdue: 'overdue', closed: 'closed'
}
const ACCOUNT_API: Record<FundAccount, string> = {
  companyBank: 'CompanyBank', cash: 'Cash', wechat: 'Wechat', alipay: 'Alipay', other: 'Other'
}
const ACCOUNT_UI: Record<string, FundAccount> = {
  companybank: 'companyBank', cash: 'cash', wechat: 'wechat', alipay: 'alipay', other: 'other'
}
const DIRECTION_API: Record<LedgerDirection, string> = { income: 'Income', expense: 'Expense' }
const PURPOSE_API: Record<LedgerManualPurpose, string> = {
  projectIncidentalCost: 'ProjectIncidentalCost',
  companyExpense: 'CompanyExpense',
  otherIncome: 'OtherIncome',
  capitalTransfer: 'CapitalTransfer',
  other: 'Other'
}
const PURPOSE_UI: Record<string, LedgerManualPurpose> = {
  projectincidentalcost: 'projectIncidentalCost',
  companyexpense: 'companyExpense',
  otherincome: 'otherIncome',
  capitaltransfer: 'capitalTransfer',
  other: 'other'
}
const SETTLEMENT_STATUS_API: Record<SettlementStatus, string> = {
  draft: 'Draft', confirmed: 'Confirmed', closed: 'Closed',
  retentionPending: 'RetentionPending', retentionReleased: 'RetentionReleased'
}
const PROJECT_STATUS_UI: Record<string, ProjectStatus> = {
  preparing: 'preparing', ongoing: 'ongoing', suspended: 'suspended',
  accepting: 'accepting', finished: 'finished', settled: 'settled'
}

function recordOf(value: unknown): RawRecord {
  return value && typeof value === 'object' ? value as RawRecord : {}
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

function optionalText(value: unknown): string | undefined {
  const result = text(value)
  return result || undefined
}

function numberValue(value: unknown): number {
  const result = Number(value ?? 0)
  return Number.isFinite(result) ? result : 0
}

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const result = Number(value)
  return Number.isFinite(result) ? result : undefined
}

function enumValue(value: unknown): string {
  if (typeof value === 'string') return value
  const record = recordOf(value)
  return text(record.value ?? record.key ?? record.name)
}

function enumKey(value: unknown): string {
  return enumValue(value).toLowerCase()
}

function dateTimeValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value || undefined
  const record = recordOf(value)
  return optionalText(record.dateTime ?? record.value)
}

function listOf(value: unknown): RawRecord[] {
  if (Array.isArray(value)) return value.map(recordOf)
  const record = recordOf(value)
  for (const key of ['content', 'list', 'records', 'items']) {
    if (Array.isArray(record[key])) return (record[key] as unknown[]).map(recordOf)
  }
  return []
}

function pageOf<T>(value: unknown, current: number, size: number, normalize: (raw: RawRecord) => T): FinancePage<T> {
  const list = listOf(value).map(normalize)
  const record = recordOf(value)
  const total = numberValue(record.totalElements ?? record.total ?? list.length)
  const hasMoreValue = record.hasMore
  return {
    list,
    total,
    hasMore: typeof hasMoreValue === 'boolean' ? hasMoreValue : current * size < total
  }
}

function projectOf(value: unknown): ProjectBrief {
  const raw = recordOf(value)
  const customer = recordOf(raw.customer)
  const property = recordOf(raw.property)
  const stage = recordOf(raw.currentStage)
  return {
    id: text(raw.projectId ?? raw.id),
    no: text(raw.no ?? raw.projectNo),
    name: text(raw.name),
    status: PROJECT_STATUS_UI[enumKey(raw.status)] ?? 'preparing',
    progress: numberValue(raw.progress),
    currentStageName: optionalText(stage.name ?? raw.currentStageName),
    customerId: optionalText(customer.custId ?? customer.id ?? raw.customerId),
    customerName: optionalText(customer.name),
    propertyId: optionalText(property.propertyId ?? property.id ?? raw.propertyId),
    propertyName: optionalText(property.community ?? property.address),
    community: optionalText(raw.community ?? property.community),
    address: optionalText(raw.address ?? raw.siteAddr ?? property.address),
    area: numberValue(raw.area),
    contractAmount: numberValue(raw.contractAmount),
    startDate: optionalText(raw.startDate),
    planEndDate: optionalText(raw.planEndDate),
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime)
  }
}

function employeeOf(value: unknown): {
  id: string; name: string; role?: string; status?: string; storeName?: string; teamName?: string
} | undefined {
  const raw = recordOf(value)
  const id = text(raw.empId ?? raw.id)
  const name = text(raw.name)
  if (!id && !name) return undefined
  const store = recordOf(raw.store)
  const team = recordOf(raw.team)
  const role = enumValue(raw.role)
  return {
    id,
    name,
    role: role || undefined,
    status: enumValue(raw.status) || undefined,
    storeName: text(raw.storeName ?? store.name) || undefined,
    teamName: text(raw.teamName ?? team.name) || undefined
  }
}

function customerOf(value: unknown): { id: string; name: string } | undefined {
  const raw = recordOf(value)
  const id = text(raw.custId ?? raw.id)
  const name = text(raw.name)
  return id || name ? { id, name } : undefined
}

function workerOf(value: unknown): WorkerRef | undefined {
  const raw = recordOf(value)
  const id = text(raw.workerId ?? raw.id)
  const name = text(raw.name)
  if (!id && !name) return undefined
  return { id, name, trade: optionalText(raw.trade), phone: optionalText(raw.phone), status: optionalText(raw.status) }
}

function categoryOf(value: unknown): LedgerCategory {
  const raw = recordOf(value)
  return {
    id: text(raw.categoryId ?? raw.id),
    name: text(raw.name),
    description: optionalText(raw.description),
    direction: enumKey(raw.direction) === 'income' ? 'income' : 'expense',
    code: optionalText(raw.code),
    builtIn: raw.builtIn === true,
    sort: numberValue(raw.sort),
    active: raw.active !== false,
    children: Array.isArray(raw.children) ? raw.children.map(categoryOf) : []
  }
}

function receivableOf(value: unknown): Receivable {
  const raw = recordOf(value)
  const amount = numberValue(raw.amount)
  const receivedAmount = numberValue(raw.receivedAmount)
  return {
    id: text(raw.receivableId ?? raw.id),
    project: projectOf(raw.project),
    customer: customerOf(raw.customer),
    name: text(raw.name),
    stageName: optionalText(raw.stageName),
    type: RECEIVABLE_TYPE_UI[enumKey(raw.type)] ?? 'other',
    amount,
    receivedAmount,
    outstandingAmount: optionalNumber(raw.outstandingAmount) ?? Math.max(amount - receivedAmount, 0),
    dueDate: text(raw.dueDate),
    status: RECEIVABLE_STATUS_UI[enumKey(raw.status)] ?? 'pending',
    invoiceRequired: raw.invoiceRequired === true,
    invoiceNo: optionalText(raw.invoiceNo),
    remark: optionalText(raw.remark),
    createdBy: employeeOf(raw.createdBy),
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime)
  }
}

function receiptOf(value: unknown): Receipt {
  const raw = recordOf(value)
  return {
    id: text(raw.receiptId ?? raw.id),
    project: projectOf(raw.project),
    receivable: raw.receivable ? receivableOf(raw.receivable) : undefined,
    customer: customerOf(raw.customer),
    amount: numberValue(raw.amount),
    account: ACCOUNT_UI[enumKey(raw.account)] ?? 'other',
    receivedAt: text(raw.receivedAt),
    payerName: optionalText(raw.payerName),
    voucherUrl: optionalText(raw.voucherUrl),
    remark: optionalText(raw.remark),
    createdBy: employeeOf(raw.createdBy),
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime)
  }
}

function refundOf(value: unknown): ReceiptRefund {
  const raw = recordOf(value)
  return {
    id: text(raw.refundId ?? raw.id),
    project: projectOf(raw.project),
    receipt: receiptOf(raw.receipt),
    customer: raw.customer ? customerOf(raw.customer) : undefined,
    amount: numberValue(raw.amount),
    account: ACCOUNT_UI[enumKey(raw.account)] ?? 'other',
    refundAt: text(raw.refundAt),
    reason: optionalText(raw.reason),
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime)
  }
}

function commissionAdjustmentOf(value: unknown): CommissionAdjustment {
  const raw = recordOf(value)
  const employee = recordOf(raw.employee)
  const originalCommission = recordOf(raw.originalCommission)
  const refund = recordOf(raw.refund)
  const payrollItem = recordOf(raw.payrollItem)
  return {
    id: text(raw.adjustmentId ?? raw.id),
    employee: { id: text(employee.empId ?? employee.id), name: text(employee.name) },
    project: raw.project ? projectOf(raw.project) : undefined,
    originalCommissionId: originalCommission.commissionId ? text(originalCommission.commissionId) : undefined,
    refundId: refund.refundId ? text(refund.refundId) : undefined,
    type: (enumKey(raw.type) || 'crossperiod') as CommissionAdjustmentType,
    status: (enumKey(raw.status) || 'pending') as CommissionAdjustmentStatus,
    refundAmount: numberValue(raw.refundAmount),
    deductionAmount: numberValue(raw.deductionAmount),
    appliedAmount: numberValue(raw.appliedAmount),
    occurredAt: text(raw.occurredAt),
    remark: optionalText(raw.remark),
    payrollItemId: payrollItem.itemId ? text(payrollItem.itemId) : undefined,
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime)
  }
}

function employeePayrollSheetOf(value: unknown): EmployeePayrollSheet {
  const raw = recordOf(value)
  return {
    id: text(raw.sheetId ?? raw.id),
    period: text(raw.period),
    status: (enumKey(raw.status) || 'draft') as EmployeePayrollSheetStatus,
    attendanceComplete: raw.attendanceComplete === true,
    commissionComplete: raw.commissionComplete === true,
    totalGrossAmount: numberValue(raw.totalGrossAmount),
    totalDeductionAmount: numberValue(raw.totalDeductionAmount),
    totalNetAmount: numberValue(raw.totalNetAmount),
    confirmedBy: raw.confirmedBy ? employeeOf(raw.confirmedBy) : undefined,
    confirmedAt: optionalText(raw.confirmedAt),
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime)
  }
}

function employeePayrollItemOf(value: unknown): EmployeePayrollItem {
  const raw = recordOf(value)
  return {
    id: text(raw.itemId ?? raw.id),
    employee: employeeOf(raw.employee) || { id: '', name: '' },
    project: raw.project ? projectOf(raw.project) : undefined,
    attribution: (enumKey(raw.attribution) || 'company') as 'project' | 'company',
    baseSalaryAmount: numberValue(raw.baseSalaryAmount),
    attendanceDeduction: numberValue(raw.attendanceDeduction),
    commissionAmount: numberValue(raw.commissionAmount),
    bonusAmount: numberValue(raw.bonusAmount),
    allowanceAmount: numberValue(raw.allowanceAmount),
    socialInsuranceAmount: numberValue(raw.socialInsuranceAmount),
    taxAmount: numberValue(raw.taxAmount),
    otherDeduction: numberValue(raw.otherDeduction),
    grossAmount: numberValue(raw.grossAmount),
    deductionAmount: numberValue(raw.deductionAmount),
    netAmount: numberValue(raw.netAmount),
    // 接口返回 {name,key} 枚举对象；必须取枚举 key，不能当字符串取（否则状态恒为待业务确认）。
    status: enumKey(raw.status)
  }
}

/** 注意：`enumKey()` 返回**小写** key，映射键必须小写，否则会全部落到兜底值。 */
const PAYSLIP_STATUS: Record<string, PayslipStatus> = {
  pendingpayment: 'pendingPayment',
  published: 'published',
  void: 'void'
}

function payslipOf(value: unknown): Payslip {
  const raw = recordOf(value)
  const key = enumKey(raw.status)
  return {
    id: text(raw.payslipId ?? raw.id),
    period: text(raw.period),
    grossAmount: numberValue(raw.grossAmount),
    deductionAmount: numberValue(raw.deductionAmount),
    netAmount: numberValue(raw.netAmount),
    // 未登记状态返回 null，由页面显示「待业务确认」——财务场景严禁用默认状态掩盖未知。
    status: PAYSLIP_STATUS[key] ?? null,
    publishedAt: text(raw.publishedAt) || undefined,
    createdAt: text(raw.createdAt) || undefined
  }
}

function employeeCommissionOf(value: unknown): EmployeeCommissionItem {
  const raw = recordOf(value)
  return {
    id: text(raw.commissionId ?? raw.id),
    employee: employeeOf(raw.employee) || { id: '', name: '' },
    project: raw.project ? projectOf(raw.project) : undefined,
    contractAmount: numberValue(raw.contractAmount),
    manualRate: numberValue(raw.manualRate),
    commissionAmount: numberValue(raw.commissionAmount),
    accruedAmount: numberValue(raw.accruedAmount),
    releasedAmount: numberValue(raw.releasedAmount),
    paidAmount: numberValue(raw.paidAmount),
    status: (enumKey(raw.status) || 'accrued') as EmployeeCommissionStatus,
    remark: optionalText(raw.remark),
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime)
  }
}

function employeeAttendanceOf(value: unknown): EmployeeAttendanceSummary {
  const raw = recordOf(value)
  return {
    id: text(raw.summaryId ?? raw.id),
    employee: employeeOf(raw.employee) || { id: '', name: '' },
    payrollMonth: text(raw.payrollMonth ?? raw.month),
    scheduledDays: numberValue(raw.scheduledDays),
    normalDays: numberValue(raw.normalDays),
    personalLeaveDays: numberValue(raw.personalLeaveDays),
    sickLeaveDays: numberValue(raw.sickLeaveDays),
    absenceDays: numberValue(raw.absenceDays),
    externalDays: numberValue(raw.externalDays),
    annualLeaveDays: numberValue(raw.annualLeaveDays),
    compLeaveDays: numberValue(raw.compLeaveDays),
    status: (enumKey(raw.status) || 'pending') as EmployeeAttendanceStatus,
    remark: optionalText(raw.remark)
  }
}

function employeeCompensationOf(value: unknown): EmployeeCompensationScheme {
  const raw = recordOf(value)
  return {
    id: text(raw.schemeId ?? raw.id),
    employee: employeeOf(raw.employee) || { id: '', name: '' },
    baseSalary: numberValue(raw.baseSalary),
    scheduledDays: numberValue(raw.scheduledDays),
    effectiveFrom: text(raw.effectiveFrom),
    effectiveTo: optionalText(raw.effectiveTo),
    status: (enumKey(raw.status) || 'active') as EmployeeCompensationScheme['status'],
    remark: optionalText(raw.remark),
    locked: raw.locked === true,
    lockedReason: optionalText(raw.lockedReason),
    createdBy: employeeOf(raw.createdBy),
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime),
    updatedAt: dateTimeValue(raw.updatedAt ?? raw.updateTime)
  }
}

function payableOf(value: unknown): Payable {
  const raw = recordOf(value)
  const amount = numberValue(raw.amount)
  const paidAmount = numberValue(raw.paidAmount)
  const materialPlan = recordOf(raw.materialPlan)
  return {
    id: text(raw.payableId ?? raw.id),
    project: raw.project ? projectOf(raw.project) : undefined,
    materialPlan: Object.keys(materialPlan).length ? {
      id: optionalText(materialPlan.planId ?? materialPlan.id),
      name: optionalText(materialPlan.name)
    } : undefined,
    name: text(raw.name),
    type: PAYABLE_TYPE_UI[enumKey(raw.type)] ?? 'other',
    payeeEmployee: employeeOf(raw.payeeEmployee),
    payeeName: optionalText(raw.payeeName),
    period: optionalText(raw.period),
    amount,
    estimated: raw.estimated === true,
    settledAmount: optionalNumber(raw.settledAmount),
    paidAmount,
    outstandingAmount: optionalNumber(raw.outstandingAmount) ?? Math.max(amount - paidAmount, 0),
    dueDate: text(raw.dueDate),
    status: PAYABLE_STATUS_UI[enumKey(raw.status)] ?? 'pending',
    urgent: raw.urgent === true,
    sourceNo: optionalText(raw.sourceNo),
    remark: optionalText(raw.remark),
    createdBy: employeeOf(raw.createdBy),
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime)
  }
}

function paymentOf(value: unknown): Payment {
  const raw = recordOf(value)
  return {
    id: text(raw.paymentId ?? raw.id),
    project: raw.project ? projectOf(raw.project) : undefined,
    payable: raw.payable ? payableOf(raw.payable) : undefined,
    amount: numberValue(raw.amount),
    account: ACCOUNT_UI[enumKey(raw.account)] ?? 'other',
    paidAt: text(raw.paidAt),
    payeeName: optionalText(raw.payeeName),
    worker: workerOf(raw.worker),
    transactionNo: optionalText(raw.transactionNo),
    voucherUrl: optionalText(raw.voucherUrl),
    remark: optionalText(raw.remark),
    createdBy: employeeOf(raw.createdBy),
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime)
  }
}

function ledgerOf(value: unknown): Ledger {
  const raw = recordOf(value)
  return {
    id: text(raw.ledgerId ?? raw.id),
    project: raw.project ? projectOf(raw.project) : undefined,
    direction: enumKey(raw.direction) === 'income' ? 'income' : 'expense',
    category: text(raw.category),
    categoryNode: raw.categoryNode ? categoryOf(raw.categoryNode) : undefined,
    purpose: PURPOSE_UI[enumKey(raw.purpose)],
    source: (['receipt', 'payment', 'manual', 'adjustment'].includes(enumKey(raw.source)) ? enumKey(raw.source) : 'manual') as Ledger['source'],
    sourceId: optionalText(raw.sourceId),
    amount: numberValue(raw.amount),
    account: ACCOUNT_UI[enumKey(raw.account)] ?? 'other',
    occurredAt: text(raw.occurredAt),
    counterparty: optionalText(raw.counterparty),
    summary: text(raw.summary),
    remark: optionalText(raw.remark),
    createdBy: employeeOf(raw.createdBy),
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime),
    originalLedgerId: optionalText(raw.originalLedgerId),
    correctionGroupId: optionalText(raw.correctionGroupId)
  }
}

function openingBalanceOf(value: unknown): OpeningBalance {
  const raw = recordOf(value)
  return {
    id: text(raw.openingBalanceId ?? raw.id),
    account: ACCOUNT_UI[enumKey(raw.account)] ?? 'other',
    amount: numberValue(raw.amount),
    asOfDate: text(raw.asOfDate),
    remark: optionalText(raw.remark),
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime)
  }
}

function settlementOf(value: unknown): Settlement {
  const raw = recordOf(value)
  return {
    id: text(raw.settlementId ?? raw.id),
    project: projectOf(raw.project),
    contractAmount: numberValue(raw.contractAmount),
    changeAmount: numberValue(raw.changeAmount),
    deductionAmount: numberValue(raw.deductionAmount),
    rewardAmount: numberValue(raw.rewardAmount),
    finalAmount: numberValue(raw.finalAmount),
    retentionRate: numberValue(raw.retentionRate),
    retentionAmount: numberValue(raw.retentionAmount),
    retentionReleaseAt: optionalText(raw.retentionReleaseAt),
    retentionReleasedAt: optionalText(raw.retentionReleasedAt),
    receivableAmount: numberValue(raw.receivableAmount),
    receivedAmount: numberValue(raw.receivedAmount),
    payableAmount: numberValue(raw.payableAmount),
    paidAmount: numberValue(raw.paidAmount),
    materialAmount: numberValue(raw.materialAmount),
    salaryAmount: numberValue(raw.salaryAmount),
    projectAmount: numberValue(raw.projectAmount),
    expenseAmount: numberValue(raw.expenseAmount),
    totalCost: numberValue(raw.totalCost),
    estimatedCost: numberValue(raw.estimatedCost),
    actualCost: numberValue(raw.actualCost),
    manualIncomeAmount: optionalNumber(raw.manualIncomeAmount),
    manualCostAmount: optionalNumber(raw.manualCostAmount),
    profitAmount: optionalNumber(raw.profitAmount),
    costComplete: raw.costComplete !== false,
    costIncompleteCount: numberValue(raw.costIncompleteCount),
    grossMargin: optionalNumber(raw.grossMargin),
    status: (['draft', 'confirmed', 'closed', 'retentionpending', 'retentionreleased'].includes(enumKey(raw.status))
      ? enumKey(raw.status) === 'retentionpending' ? 'retentionPending' : enumKey(raw.status) === 'retentionreleased' ? 'retentionReleased' : enumKey(raw.status)
      : 'draft') as SettlementStatus,
    confirmedBy: employeeOf(raw.confirmedBy),
    confirmedAt: dateTimeValue(raw.confirmedAt),
    closedAt: dateTimeValue(raw.closedAt),
    remark: optionalText(raw.remark),
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime)
  }
}

function summaryOf(value: unknown): FinanceSummary {
  const raw = recordOf(value)
  return {
    projectCount: numberValue(raw.projectCount),
    activeProjectCount: numberValue(raw.activeProjectCount),
    contractAmount: numberValue(raw.contractAmount),
    receivableAmount: numberValue(raw.receivableAmount),
    receivedAmount: numberValue(raw.receivedAmount),
    outstandingAmount: numberValue(raw.outstandingAmount),
    overdueAmount: numberValue(raw.overdueAmount),
    payableAmount: numberValue(raw.payableAmount),
    paidAmount: numberValue(raw.paidAmount),
    unpaidAmount: numberValue(raw.unpaidAmount),
    materialPayableAmount: numberValue(raw.materialPayableAmount),
    salaryPayableAmount: numberValue(raw.salaryPayableAmount),
    projectPayableAmount: numberValue(raw.projectPayableAmount),
    otherPayableAmount: numberValue(raw.otherPayableAmount),
    monthIncome: numberValue(raw.monthIncome),
    monthExpense: numberValue(raw.monthExpense),
    monthNetCashFlowAmount: numberValue(raw.monthNetCashFlowAmount),
    receiptCount: numberValue(raw.receiptCount),
    paymentCount: numberValue(raw.paymentCount),
    receiptAmount: numberValue(raw.receiptAmount),
    paymentAmount: numberValue(raw.paymentAmount),
    monthReceiptAmount: numberValue(raw.monthReceiptAmount),
    monthPaymentAmount: numberValue(raw.monthPaymentAmount),
    urgentPayableAmount: numberValue(raw.urgentPayableAmount),
    cashBalance: numberValue(raw.cashBalance),
    openingBalanceAmount: numberValue(raw.openingBalanceAmount),
    openingBalanceCaptured: raw.openingBalanceCaptured === true,
    estimatedCost: numberValue(raw.estimatedCost),
    actualCost: numberValue(raw.actualCost),
    manualIncomeAmount: optionalNumber(raw.manualIncomeAmount),
    manualCostAmount: optionalNumber(raw.manualCostAmount),
    profitAmount: optionalNumber(raw.profitAmount),
    costComplete: raw.costComplete !== false,
    costIncompleteProjectCount: numberValue(raw.costIncompleteProjectCount),
    costIncompleteItemCount: numberValue(raw.costIncompleteItemCount),
    collectionRate: numberValue(raw.collectionRate),
    urgentReceivables: listOf(raw.urgentReceivables).map(receivableOf),
    overdueReceivables: listOf(raw.overdueReceivables).map(receivableOf),
    dueSoonReceivables: listOf(raw.dueSoonReceivables).map(receivableOf),
    urgentPayables: listOf(raw.urgentPayables).map(payableOf),
    recentLedgers: listOf(raw.recentLedgers).map(ledgerOf)
  }
}

function projectReportOf(value: unknown): FinanceProjectReport {
  const raw = recordOf(value)
  return {
    project: projectOf(raw.project),
    contractAmount: numberValue(raw.contractAmount),
    receivableAmount: numberValue(raw.receivableAmount),
    receivedAmount: numberValue(raw.receivedAmount),
    outstandingAmount: numberValue(raw.outstandingAmount),
    overdueAmount: numberValue(raw.overdueAmount),
    payableAmount: numberValue(raw.payableAmount),
    paidAmount: numberValue(raw.paidAmount),
    unpaidAmount: numberValue(raw.unpaidAmount),
    receiptCount: numberValue(raw.receiptCount),
    paymentCount: numberValue(raw.paymentCount),
    receiptAmount: numberValue(raw.receiptAmount),
    paymentAmount: numberValue(raw.paymentAmount),
    monthReceiptAmount: numberValue(raw.monthReceiptAmount),
    monthPaymentAmount: numberValue(raw.monthPaymentAmount),
    urgentPayableAmount: numberValue(raw.urgentPayableAmount),
    contractRevenue: numberValue(raw.contractRevenue),
    materialAmount: numberValue(raw.materialAmount),
    materialCost: numberValue(raw.materialCost),
    salaryAmount: numberValue(raw.salaryAmount),
    laborCost: numberValue(raw.laborCost),
    projectPaymentAmount: numberValue(raw.projectPaymentAmount),
    projectCost: numberValue(raw.projectCost),
    otherPayableAmount: numberValue(raw.otherPayableAmount),
    expenseAllocation: numberValue(raw.expenseAllocation),
    totalCost: numberValue(raw.totalCost),
    estimatedCost: numberValue(raw.estimatedCost),
    actualCost: numberValue(raw.actualCost),
    manualIncomeAmount: optionalNumber(raw.manualIncomeAmount),
    manualCostAmount: optionalNumber(raw.manualCostAmount),
    profitAmount: optionalNumber(raw.profitAmount),
    costComplete: raw.costComplete !== false,
    costIncompleteCount: numberValue(raw.costIncompleteCount),
    grossProfit: optionalNumber(raw.grossProfit),
    grossMargin: optionalNumber(raw.grossMargin),
    collectionRate: numberValue(raw.collectionRate),
    paymentRate: numberValue(raw.paymentRate),
    receivableCleared: raw.receivableCleared === true,
    payableCleared: raw.payableCleared === true,
    settlement: raw.settlement ? settlementOf(raw.settlement) : undefined,
    receivables: listOf(raw.receivables).map(receivableOf),
    payables: listOf(raw.payables).map(payableOf),
    recentLedgers: listOf(raw.recentLedgers).map(ledgerOf)
  }
}

function voucherItemOf(value: unknown) {
  const raw = recordOf(value)
  return {
    id: text(raw.itemId ?? raw.id),
    sourceNo: text(raw.sourceNo),
    businessDate: text(raw.businessDate),
    account: ACCOUNT_UI[enumKey(raw.account)] ?? 'other',
    amount: numberValue(raw.amount),
    category: optionalText(raw.category),
    remark: optionalText(raw.remark)
  }
}

function voucherOf(value: unknown): Voucher {
  const raw = recordOf(value)
  return {
    id: text(raw.voucherId ?? raw.id),
    project: raw.project ? projectOf(raw.project) : undefined,
    type: enumKey(raw.type) === 'payment' ? 'payment' : 'receipt',
    voucherNo: text(raw.voucherNo),
    title: text(raw.title),
    totalAmount: numberValue(raw.totalAmount),
    amountWords: text(raw.amountWords),
    partyName: optionalText(raw.partyName),
    worker: workerOf(raw.worker),
    status: enumKey(raw.status) === 'voided' ? 'voided' : 'active',
    fileName: optionalText(raw.fileName),
    generatedAt: dateTimeValue(raw.generatedAt ?? raw.createTime),
    items: listOf(raw.items).map(voucherItemOf),
    url: raw.url ? fileUrl(text(raw.url)) : undefined,
    urlExpiresAt: optionalText(raw.urlExpiresAt)
  }
}

export interface FinanceQuery {
  projectId?: string
  keyword?: string
  current?: number
  size?: number
  /** 门店维度（DEC-065）：为空表示不限门店（企业范围）或本店（门店范围），由服务端裁决。 */
  storeId?: string
}

export const financeApi = {
  summary: async (storeId?: string): Promise<FinanceSummary> =>
    summaryOf(await post<unknown>('finance/summary/report', { storeId })),

  frequentProjects: async (size = 8): Promise<ProjectBrief[]> =>
    listOf(await post<unknown>('document/frequent-project/list', { size })).map(projectOf),

  projectPage: async (params: FinanceQuery & { status?: string } = {}): Promise<FinancePage<FinanceProjectReport>> => {
    const current = params.current ?? 1
    const size = params.size ?? 50
    return pageOf(await post<unknown>('finance/project/page', { current, size, ...params }), current, size, projectReportOf)
  },

  projectReport: async (projectId: string): Promise<FinanceProjectReport> =>
    projectReportOf(await post<unknown>('finance/project/report', { projectId })),

  receivables: async (params: FinanceQuery & { type?: ReceivableType; status?: ReceivableStatus } = {}): Promise<FinancePage<Receivable>> => {
    const current = params.current ?? 1
    const size = params.size ?? 50
    return pageOf(await post<unknown>('finance/receivable/page', {
      current, size, projectId: params.projectId, keyword: params.keyword, storeId: params.storeId,
      type: params.type ? RECEIVABLE_TYPE_API[params.type] : undefined,
      status: params.status
    }), current, size, receivableOf)
  },

  saveReceivable: async (input: {
    projectId: string
    name: string
    stageName?: string
    type: ReceivableType
    amount: number
    dueDate: string
    invoiceRequired?: boolean
    invoiceNo?: string
    remark?: string
  }): Promise<Receivable> => receivableOf(await post<unknown>('finance/receivable/save', {
    ...input,
    type: RECEIVABLE_TYPE_API[input.type]
  })),

  updateReceivable: async (input: {
    id: string
    name?: string
    stageName?: string
    type?: ReceivableType
    amount?: number
    dueDate?: string
    invoiceRequired?: boolean
    invoiceNo?: string
    remark?: string
  }): Promise<Receivable> => receivableOf(await post<unknown>('finance/receivable/update', {
    receivableId: input.id,
    name: input.name,
    stageName: input.stageName,
    type: input.type ? RECEIVABLE_TYPE_API[input.type] : undefined,
    amount: input.amount,
    dueDate: input.dueDate,
    invoiceRequired: input.invoiceRequired,
    invoiceNo: input.invoiceNo,
    remark: input.remark
  })),

  receipts: async (params: FinanceQuery = {}): Promise<FinancePage<Receipt>> => {
    const current = params.current ?? 1
    const size = params.size ?? 50
    return pageOf(await post<unknown>('finance/receipt/page', {
      current, size, projectId: params.projectId, keyword: params.keyword, storeId: params.storeId
    }), current, size, receiptOf)
  },

  createReceipt: async (input: {
    projectId: string
    receivableId: string
    amount: number
    account: FundAccount
    receivedAt: string
    payerName?: string
    voucherUrl?: string
    remark?: string
    idempotencyKey: string
  }): Promise<Receipt> => receiptOf(await post<unknown>('finance/receipt/save', {
    ...input,
    account: ACCOUNT_API[input.account]
  })),

  refunds: async (params: FinanceQuery & { projectId?: string } = {}): Promise<FinancePage<ReceiptRefund>> => {
    const current = params.current ?? 1
    const size = params.size ?? 50
    return pageOf(await post<unknown>('finance/refund/page', {
      current, size, projectId: params.projectId, storeId: params.storeId
    }), current, size, refundOf)
  },

  createRefund: async (input: {
    receiptId: string
    amount: number
    account: FundAccount
    refundAt: string
    reason?: string
    idempotencyKey: string
  }): Promise<ReceiptRefund> => refundOf(await post<unknown>('finance/refund/save', {
    ...input,
    account: ACCOUNT_API[input.account]
  })),

  commissionAdjustments: async (params: FinanceQuery = {}): Promise<FinancePage<CommissionAdjustment>> => {
    const current = params.current ?? 1
    const size = params.size ?? 50
    return pageOf(await post<unknown>('payroll/commission/adjustment/page', { current, size }),
      current, size, commissionAdjustmentOf)
  },

  employeePayrollSheets: async (params: FinanceQuery = {}): Promise<FinancePage<EmployeePayrollSheet>> => {
    const current = params.current ?? 1
    const size = params.size ?? 50
    return pageOf(await post<unknown>('payroll/sheet/page', { current, size, storeId: params.storeId }),
      current, size, employeePayrollSheetOf)
  },

  employeePayrollItems: async (sheetId: string, storeId?: string): Promise<EmployeePayrollItem[]> => {
    const page = pageOf(await post<unknown>('payroll/item/page', { sheetId, storeId, current: 1, size: 200 }),
      1, 200, employeePayrollItemOf)
    return page.list
  },

  employeeCommissions: async (params: FinanceQuery = {}): Promise<FinancePage<EmployeeCommissionItem>> => {
    const current = params.current ?? 1
    const size = params.size ?? 50
    return pageOf(await post<unknown>('payroll/commission/page', { current, size, storeId: params.storeId }),
      current, size, employeeCommissionOf)
  },

  saveEmployeeCommission: async (input: {
    empId: string; projectId: string; contractAmount: number; manualRate: number; commissionAmount?: number; remark?: string
  }): Promise<EmployeeCommissionItem> =>
    employeeCommissionOf(await post<unknown>('payroll/commission/save', input)),

  employeeOptions: async (params: { storeId?: string } = {}): Promise<FinanceEmployeeRef[]> => {
    return listOf(await post<unknown>('payroll/employee/page', { current: 1, size: 200, storeId: params.storeId }))
      .map((item) => {
        const raw = recordOf(item)
        const store = recordOf(raw.store)
        const team = recordOf(raw.team)
        const rawRole = enumKey(raw.role)
        const role = ['Boss', 'StoreManager', 'TeamLeader', 'Marketer', 'Designer', 'Pm', 'Finance']
          .find((candidate) => candidate.toLowerCase() === rawRole.toLowerCase()) ?? rawRole
        return {
          id: text(raw.empId ?? raw.id),
          name: text(raw.name),
          role: role || undefined,
          status: enumKey(raw.status) || undefined,
          storeName: text(store.name) || undefined,
          teamName: text(team.name) || undefined
        }
      })
      .filter((item) => item.id)
  },

  employeeCompensations: async (params: FinanceQuery & {
    keyword?: string; status?: string; effectiveMonth?: string
  } = {}): Promise<FinancePage<EmployeeCompensationScheme>> => {
    const current = params.current ?? 1
    const size = params.size ?? 20
    return pageOf(await post<unknown>('payroll/compensation/page', {
      current,
      size,
      storeId: params.storeId,
      keyword: params.keyword || undefined,
      status: params.status || undefined,
      effectiveMonth: params.effectiveMonth || undefined
    }), current, size, employeeCompensationOf)
  },

  saveEmployeeCompensation: async (input: {
    empId: string; baseSalary: number; scheduledDays: number; effectiveFrom: string; effectiveTo?: string; remark?: string
  }): Promise<EmployeeCompensationScheme> =>
    employeeCompensationOf(await post<unknown>('payroll/compensation/save', input)),

  updateEmployeeCompensation: async (input: {
    schemeId: string; baseSalary?: number; scheduledDays?: number; effectiveFrom?: string; effectiveTo?: string; remark?: string
  }): Promise<EmployeeCompensationScheme> =>
    employeeCompensationOf(await post<unknown>('payroll/compensation/update', input)),

  deleteEmployeeCompensation: async (schemeId: string): Promise<void> => {
    await post<unknown>('payroll/compensation/delete', { schemeId })
  },

  employeeAttendances: async (month?: string): Promise<EmployeeAttendanceSummary[]> => {
    return listOf(await post<unknown>('attendance/summary/page', { current: 1, size: 200, month }))
      .map(employeeAttendanceOf)
  },

  saveEmployeeAttendance: async (input: {
    summaryId?: string; empId?: string; month?: string; scheduledDays: number; normalDays: number
    personalLeaveDays: number; sickLeaveDays: number; absenceDays: number; externalDays: number
    annualLeaveDays: number; compLeaveDays: number; remark?: string
  }): Promise<EmployeeAttendanceSummary> => {
    const uri = input.summaryId ? 'attendance/summary/update' : 'attendance/summary/save'
    return employeeAttendanceOf(await post<unknown>(uri, input))
  },

  confirmEmployeeAttendance: async (summaryId: string): Promise<EmployeeAttendanceSummary> =>
    employeeAttendanceOf(await post<unknown>('attendance/summary/update', { summaryId, status: 'Confirmed' })),

  buildEmployeePayrollSheet: async (period: string): Promise<EmployeePayrollSheet> =>
    employeePayrollSheetOf(await post<unknown>('payroll/sheet/build', { period })),

  confirmEmployeePayrollSheet: async (sheetId: string): Promise<EmployeePayrollSheet> =>
    employeePayrollSheetOf(await post<unknown>('payroll/sheet/update', { sheetId })),

  employeePayables: async (): Promise<Array<{
    id: string; employee: FinanceEmployeeRef; name: string; type: string; amount: number; paidAmount: number; outstandingAmount: number
  }>> => {
    return listOf(await post<unknown>('finance/payment/employee/page', { current: 1, size: 200 })).map((value) => {
      const raw = recordOf(value)
      const amount = numberValue(raw.amount)
      const paidAmount = numberValue(raw.paidAmount)
      return {
        id: text(raw.payableId ?? raw.id),
        employee: employeeOf(raw.payeeEmployee) || { id: '', name: '' },
        name: text(raw.name),
        type: text(raw.type),
        amount,
        paidAmount,
        outstandingAmount: Math.max(amount - paidAmount, 0)
      }
    })
  },

  payEmployee: async (input: {
    payableIds: string[]; amount: number; account: FundAccount; paidAt: string; batchNo?: string; idempotencyKey: string; remark?: string
  }): Promise<void> => {
    await post<unknown>('finance/payment/employee/save', { ...input, account: ACCOUNT_API[input.account] })
  },

  /** 薪酬工作台报告（按周期；服务端按登录员工数据范围裁决）。 */
  payrollWorkbench: async (period?: string): Promise<PayrollWorkbenchReport> => {
    const raw = recordOf(await post<unknown>('payroll/workbench/report', { period: period || undefined }))
    return {
      period: text(raw.period),
      pendingAttendanceCount: numberValue(raw.pendingAttendanceCount),
      draftSheetCount: numberValue(raw.draftSheetCount),
      pendingSheetCount: numberValue(raw.pendingSheetCount),
      confirmedSheetCount: numberValue(raw.confirmedSheetCount),
      partialPaidSheetCount: numberValue(raw.partialPaidSheetCount),
      paidSheetCount: numberValue(raw.paidSheetCount),
      pendingEmployeePayableAmount: numberValue(raw.pendingEmployeePayableAmount),
      releasedUnpaidCommissionAmount: numberValue(raw.releasedUnpaidCommissionAmount),
      pendingPayslipCount: numberValue(raw.pendingPayslipCount),
      publishedPayslipCount: numberValue(raw.publishedPayslipCount),
      currentPeriodHasSheet: raw.currentPeriodHasSheet === true,
      latestSheetId: text(raw.latestSheetId) || undefined,
      latestSheetPeriod: text(raw.latestSheetPeriod) || undefined,
      // 枚举 key 一律走 enumKey（小写），避免直接用对象字符串（ANT-010）
      latestSheetStatus: enumKey(raw.latestSheetStatus) || undefined,
      latestSheetTotalNetAmount: numberValue(raw.latestSheetTotalNetAmount)
    }
  },

  /** 我的工资条（员工自助，仅返回实际发放完成的工资条）。 */
  myPayslips: async (params: FinanceQuery = {}): Promise<FinancePage<Payslip>> => {
    const current = params.current ?? 1
    const size = params.size ?? 50
    return pageOf(await post<unknown>('payroll/payslip/my/page', { current, size }), current, size, payslipOf)
  },

  myPayslipDetail: async (payslipId: string): Promise<Payslip> =>
    payslipOf(await post<unknown>('payroll/payslip/info', { payslipId })),

  /** 本店薪酬明细（店长视角；服务端按登录员工数据范围裁剪）。 */
  storePayrollItems: async (params: FinanceQuery = {}): Promise<FinancePage<EmployeePayrollItem>> => {
    const current = params.current ?? 1
    const size = params.size ?? 50
    return pageOf(await post<unknown>('payroll/store-payroll/page', { current, size, storeId: params.storeId }), current, size, employeePayrollItemOf)
  },

  payables: async (params: FinanceQuery & {
    type?: PayableType
    status?: PayableStatus
    urgent?: boolean
    partnerId?: string
  } = {}): Promise<FinancePage<Payable>> => {
    const current = params.current ?? 1
    const size = params.size ?? 50
    return pageOf(await post<unknown>('finance/payable/page', {
      current, size, projectId: params.projectId, partnerId: params.partnerId, storeId: params.storeId,
      keyword: params.keyword, urgent: params.urgent, status: params.status,
      type: params.type ? PAYABLE_TYPE_API[params.type] : undefined
    }), current, size, payableOf)
  },

  payableReport: async (params: {
    projectId?: string
    type?: PayableType
    status?: PayableStatus
    urgent?: boolean
    partnerId?: string
    keyword?: string
  } = {}): Promise<FinancePayableReport> => {
    const raw = recordOf(await post<unknown>('finance/payable/report', {
      ...params,
      type: params.type ? PAYABLE_TYPE_API[params.type] : undefined
    }))
    return {
      count: numberValue(raw.count),
      totalAmount: numberValue(raw.totalAmount),
      paidAmount: numberValue(raw.paidAmount),
      outstandingAmount: numberValue(raw.outstandingAmount),
      urgentAmount: numberValue(raw.urgentAmount)
    }
  },

  savePayable: async (input: {
    projectId?: string
    materialPlanId?: string
    name: string
    type: PayableType
    payeeEmployeeId?: string
    payeeName?: string
    period?: string
    amount: number
    dueDate: string
    urgent?: boolean
    sourceNo?: string
    remark?: string
  }): Promise<Payable> => payableOf(await post<unknown>('finance/payable/save', {
    ...input,
    type: PAYABLE_TYPE_API[input.type]
  })),

  updatePayable: async (input: {
    id: string
    name?: string
    amount?: number
    dueDate?: string
    urgent?: boolean
    period?: string
    remark?: string
  }): Promise<Payable> => payableOf(await post<unknown>('finance/payable/update', {
    payableId: input.id,
    name: input.name,
    amount: input.amount,
    dueDate: input.dueDate,
    urgent: input.urgent,
    period: input.period,
    remark: input.remark
  })),

  payments: async (params: FinanceQuery = {}): Promise<FinancePage<Payment>> => {
    const current = params.current ?? 1
    const size = params.size ?? 50
    return pageOf(await post<unknown>('finance/payment/page', {
      current, size, projectId: params.projectId, keyword: params.keyword, storeId: params.storeId
    }), current, size, paymentOf)
  },

  createPayment: async (input: {
    payableId: string
    amount: number
    account: FundAccount
    paidAt: string
    payeeName?: string
    workerId?: string
    transactionNo?: string
    voucherUrl?: string
    remark?: string
    idempotencyKey: string
  }): Promise<Payment> => paymentOf(await post<unknown>('finance/payment/save', {
    ...input,
    account: ACCOUNT_API[input.account]
  })),

  updatePaymentWorker: async (paymentId: string, workerId: string): Promise<Payment> =>
    paymentOf(await post<unknown>('finance/payment/update', { paymentId, workerId })),

  ledgers: async (params: FinanceQuery & {
    ledgerId?: string
    direction?: LedgerDirection
    categoryId?: string
    category?: string
    uncategorized?: boolean
    startDate?: string
    endDate?: string
  } = {}): Promise<FinancePage<Ledger>> => {
    const current = params.current ?? 1
    const size = params.size ?? 50
    return pageOf(await post<unknown>('finance/ledger/page', {
      ...params,
      current,
      size,
      direction: params.direction ? DIRECTION_API[params.direction] : undefined
    }), current, size, ledgerOf)
  },

  ledgerReport: async (params: {
    projectId?: string
    direction?: LedgerDirection
    categoryId?: string
    category?: string
    uncategorized?: boolean
    keyword?: string
    startDate?: string
    endDate?: string
    ledgerIds?: string[]
  } = {}): Promise<FinanceLedgerReport> => {
    const raw = recordOf(await post<unknown>('finance/ledger/report', {
      ...params,
      direction: params.direction ? DIRECTION_API[params.direction] : undefined
    }))
    return {
      count: numberValue(raw.count),
      totalAmount: numberValue(raw.totalAmount),
      incomeAmount: numberValue(raw.incomeAmount),
      expenseAmount: numberValue(raw.expenseAmount),
      netCashFlowAmount: numberValue(raw.netCashFlowAmount)
    }
  },

  ledgerInfo: async (ledgerId: string): Promise<Ledger> => {
    const page = await financeApi.ledgers({ ledgerId, current: 1, size: 1 })
    const item = page.list.find((row) => row.id === ledgerId)
    if (!item) throw new Error('手工流水不存在或无权访问')
    return item
  },

  ledgerCategories: async (): Promise<LedgerCategory[]> => {
    const raw = await post<unknown>('finance/ledger-category/tree', {})
    return listOf(raw).map(categoryOf)
  },

  saveLedgerCategory: async (input: { name: string; description: string; direction: LedgerDirection; parentId?: string }): Promise<LedgerCategory> =>
    categoryOf(await post<unknown>('finance/ledger-category/save', {
      ...input,
      direction: DIRECTION_API[input.direction]
    })),

  updateLedgerCategory: async (input: { id: string; name: string; description: string; active: boolean }): Promise<LedgerCategory> =>
    categoryOf(await post<unknown>('finance/ledger-category/update', {
      categoryId: input.id, name: input.name, description: input.description, active: input.active
    })),

  deleteLedgerCategory: async (id: string): Promise<LedgerCategory> =>
    categoryOf(await post<unknown>('finance/ledger-category/delete', { categoryId: id })),

  openingBalances: async (): Promise<OpeningBalance[]> => {
    const page = await pageOf(await post<unknown>('finance/opening-balance/page', { current: 1, size: 100 }), 1, 100, openingBalanceOf)
    return page.list
  },

  saveOpeningBalance: async (input: {
    account: FundAccount
    amount: number
    asOfDate: string
    remark?: string
  }): Promise<OpeningBalance> => openingBalanceOf(await post<unknown>('finance/opening-balance/save', {
    ...input,
    account: ACCOUNT_API[input.account]
  })),

  saveLedger: async (input: {
    projectId?: string
    direction: LedgerDirection
    purpose: LedgerManualPurpose
    category: string
    categoryId?: string
    amount: number
    account: FundAccount
    occurredAt: string
    counterparty?: string
    summary: string
    remark?: string
  }): Promise<Ledger> => ledgerOf(await post<unknown>('finance/ledger/save', {
    ...input,
    purpose: PURPOSE_API[input.purpose],
    direction: DIRECTION_API[input.direction],
    account: ACCOUNT_API[input.account]
  })),

  updateLedger: async (input: {
    ledgerId: string
    purpose?: LedgerManualPurpose
    category?: string
    categoryId?: string
    projectId?: string
    counterparty?: string
    summary?: string
    remark?: string
    reason: string
  }): Promise<Ledger> => ledgerOf(await post<unknown>('finance/ledger/update', {
    ...input,
    purpose: input.purpose ? PURPOSE_API[input.purpose] : undefined
  })),

  deleteLedger: async (ledgerId: string, reason: string): Promise<Ledger> =>
    ledgerOf(await post<unknown>('finance/ledger/delete', { ledgerId, reason })),

  correctLedger: async (input: {
    ledgerId: string
    projectId?: string
    direction: LedgerDirection
    purpose: LedgerManualPurpose
    category: string
    categoryId?: string
    amount: number
    account: FundAccount
    occurredAt: string
    counterparty?: string
    summary: string
    remark?: string
    reason: string
  }): Promise<Ledger> => ledgerOf(await post<unknown>('finance/ledger/correct', {
    ...input,
    purpose: PURPOSE_API[input.purpose],
    direction: DIRECTION_API[input.direction],
    account: ACCOUNT_API[input.account]
  })),

  settlements: async (params: { projectId?: string; status?: SettlementStatus } = {}): Promise<Settlement[]> => {
    const current = 1
    const size = 100
    const page = pageOf(await post<unknown>('finance/settlement/page', { current, size, ...params }), current, size, settlementOf)
    return page.list
  },

  saveSettlement: async (projectId: string, remark?: string): Promise<Settlement> =>
    settlementOf(await post<unknown>('finance/settlement/save', { projectId, remark })),

  updateSettlement: async (id: string, status: SettlementStatus, remark?: string): Promise<Settlement> =>
    settlementOf(await post<unknown>('finance/settlement/update', {
      settlementId: id,
      status: SETTLEMENT_STATUS_API[status],
      remark
    })),

  releaseRetention: async (id: string, releasedAt?: string): Promise<Settlement> =>
    settlementOf(await post<unknown>('finance/settlement/retention-release', { settlementId: id, releasedAt })),

  partnerLedger: async (params: { partnerId?: string; overdueOnly?: boolean; storeId?: string } = {}): Promise<PartnerLedgerReport> => {
    const raw = recordOf(await post<unknown>('finance/partner-ledger/report', params))
    return {
      rows: listOf(raw.rows).map((item) => {
        const partner = recordOf(item.partner)
        return {
          partner: Object.keys(partner).length ? {
            id: optionalText(partner.partnerId ?? partner.id),
            name: optionalText(partner.name),
            settlementMode: optionalText(partner.settlementMode),
            settlementDays: optionalNumber(partner.settlementDays),
            cutoffDay: optionalNumber(partner.cutoffDay)
          } : undefined,
          payableAmount: optionalNumber(item.payableAmount),
          paidAmount: optionalNumber(item.paidAmount),
          outstanding: optionalNumber(item.outstanding),
          overdueAmount: optionalNumber(item.overdueAmount),
          pendingCount: optionalNumber(item.pendingCount),
          nearestDueDate: optionalText(item.nearestDueDate)
        }
      }),
      partnerCount: numberValue(raw.partnerCount),
      payableAmount: numberValue(raw.payableAmount),
      paidAmount: numberValue(raw.paidAmount),
      outstandingAmount: numberValue(raw.outstandingAmount),
      overdueAmount: numberValue(raw.overdueAmount)
    }
  },

  vouchers: async (params: {
    projectId?: string
    status?: string
    keyword?: string
    type?: string
    startDate?: string
    endDate?: string
    /** 门店维度（DEC-065 / P1-a2）：为空 = 全部门店或本店，由服务端裁决。 */
    storeId?: string
    current?: number
    size?: number
  } = {}): Promise<FinancePage<Voucher>> => {
    const current = params.current ?? 1
    const size = params.size ?? 50
    return pageOf(await post<unknown>('document/voucher/page', { current, size, ...params }), current, size, voucherOf)
  },

  voucherReport: async (params: {
    projectId?: string
    status?: string
    keyword?: string
    type?: string
    startDate?: string
    endDate?: string
    storeId?: string
  } = {}): Promise<VoucherReport> => {
    const raw = recordOf(await post<unknown>('document/voucher/report', params))
    return {
      count: numberValue(raw.count),
      totalAmount: numberValue(raw.totalAmount),
      receiptAmount: numberValue(raw.receiptAmount),
      paymentAmount: numberValue(raw.paymentAmount),
      monthlyAmounts: listOf(raw.monthlyAmounts).map((item) => ({
        month: text(item.month),
        count: numberValue(item.count),
        amount: numberValue(item.amount)
      }))
    }
  },

  buildVoucher: async (ledgerIds: string[]): Promise<Voucher> =>
    voucherOf(await post<unknown>('document/voucher/build', { ledgerIds })),

  updatePaymentWorkerLoose: async (paymentId: string, workerId: string): Promise<Payment> =>
    paymentOf(await post<unknown>('finance/payment/update', { paymentId, workerId }))
}

export async function listFinanceWorkerPage(keyword = '', current = 1, size = 50): Promise<FinancePage<WorkerRef>> {
  const raw = await post<unknown>('labor/worker/page', { current, size, keyword: keyword || undefined })
  const page = pageOf(raw, current, size, workerOf)
  return {
    ...page,
    list: page.list.filter((item): item is WorkerRef => Boolean(item))
  }
}

/* ------------------------------------------------------------------ *
 * 供应商/经销商（Partner）分页：供业务概念选择器 PartnerPicker 使用（BR-019）
 * ------------------------------------------------------------------ */

export interface PartnerOption {
  id: string
  name: string
  contactName?: string
  telNo?: string
  status: string
  settlementTerms?: string
  settlementMode?: string
  settlementDays?: number
  brands: string[]
  payableAmount: number
}

function partnerRows(raw: unknown): RawRecord[] {
  if (Array.isArray(raw)) return raw as RawRecord[]
  const record = (raw && typeof raw === 'object' ? raw : {}) as RawRecord
  const list = record.content ?? record.list ?? record.records ?? record.rows
  return Array.isArray(list) ? (list as RawRecord[]) : []
}

/** 供应商分页（企业范围）。后端按企业返回合作方，关键字在本地过滤（单企业合作方数量有限）。 */
export async function listPartnerOptions(keyword?: string, type: 'Supplier' | 'Dealer' = 'Supplier'): Promise<PartnerOption[]> {
  const raw = await post<unknown>('partner/page', { type })
  const rows = partnerRows(raw)
  const key = (keyword || '').trim().toLowerCase()
  return rows
    .map((item) => {
      const status = recordOf(item.status)
      return {
        id: optionalText(item.partnerId ?? item.id) || '',
        name: optionalText(item.name) || '未命名合作方',
        contactName: optionalText(item.contactName),
        telNo: optionalText(item.telNo),
        status: optionalText(status.value ?? status.key ?? item.status) || '',
        settlementTerms: optionalText(item.settlementTerms),
        settlementMode: optionalText(recordOf(item.settlementMode).value ?? item.settlementMode),
        settlementDays: item.settlementDays == null ? undefined : Number(item.settlementDays),
        brands: Array.isArray(item.brands) ? (item.brands as unknown[]).map((b) => optionalText(b) || '') : [],
        payableAmount: Number(item.payableAmount ?? 0)
      } as PartnerOption
    })
    .filter((item) => item.id)
    .filter((item) => !key
      || item.name.toLowerCase().includes(key)
      || (item.contactName || '').toLowerCase().includes(key)
      || (item.telNo || '').includes(key))
}
