import type { ProjectBrief } from '@/domains/project/model'

export type ReceivableType = 'first' | 'progress' | 'final' | 'retention' | 'other'
export type ReceivableStatus = 'pending' | 'partial' | 'received' | 'overdue' | 'closed'
export type PayableType = 'material' | 'salary' | 'project' | 'supplier' | 'expense' | 'other'
export type PayableStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'closed'
export type FundAccount = 'companyBank' | 'cash' | 'wechat' | 'alipay' | 'other'
export type LedgerDirection = 'income' | 'expense'
export type LedgerSource = 'receipt' | 'refund' | 'payment' | 'manual' | 'adjustment'
export type LedgerManualPurpose = 'projectIncidentalCost' | 'companyExpense' | 'otherIncome' | 'capitalTransfer' | 'other'
export type SettlementStatus = 'draft' | 'confirmed' | 'closed' | 'retentionPending' | 'retentionReleased'
export type VoucherType = 'receipt' | 'payment'
export type VoucherStatus = 'active' | 'voided'

export interface FinanceEmployeeRef {
  id: string
  name: string
  role?: string
  status?: string
  storeName?: string
  teamName?: string
}

export interface FinanceCustomerRef {
  id: string
  name: string
}

export interface WorkerRef {
  id: string
  name: string
  trade?: string
  phone?: string
  status?: string
}

export interface Receivable {
  id: string
  project: ProjectBrief
  customer?: FinanceCustomerRef
  name: string
  stageName?: string
  type: ReceivableType
  amount: number
  receivedAmount: number
  outstandingAmount: number
  dueDate: string
  status: ReceivableStatus
  invoiceRequired: boolean
  invoiceNo?: string
  remark?: string
  createdBy?: FinanceEmployeeRef
  createdAt?: string
}

export interface Receipt {
  id: string
  project: ProjectBrief
  receivable?: Receivable
  customer?: FinanceCustomerRef
  amount: number
  account: FundAccount
  receivedAt: string
  payerName?: string
  voucherUrl?: string
  remark?: string
  createdBy?: FinanceEmployeeRef
  createdAt?: string
}

export interface ReceiptRefund {
  id: string
  project: ProjectBrief
  receipt: Receipt
  customer?: FinanceCustomerRef
  amount: number
  account: FundAccount
  refundAt: string
  reason?: string
  createdAt?: string
}

export type CommissionAdjustmentType = 'refund' | 'resignation' | 'crossPeriod'
export type CommissionAdjustmentStatus = 'pending' | 'included' | 'cancelled'

export interface CommissionAdjustment {
  id: string
  employee: FinanceEmployeeRef
  project?: ProjectBrief
  originalCommissionId?: string
  refundId?: string
  type: CommissionAdjustmentType
  status: CommissionAdjustmentStatus
  refundAmount: number
  deductionAmount: number
  appliedAmount: number
  occurredAt: string
  remark?: string
  payrollItemId?: string
  createdAt?: string
}

export type EmployeeCommissionStatus = 'pendingAccrual' | 'accrued' | 'released' | 'inPayment' | 'paid' | 'closed' | 'adjusted'
export type EmployeePayrollSheetStatus = 'draft' | 'pending' | 'confirmed' | 'partialPaid' | 'paid' | 'closed' | 'void'

export interface EmployeePayrollSheet {
  id: string
  period: string
  status: EmployeePayrollSheetStatus
  attendanceComplete: boolean
  commissionComplete: boolean
  totalGrossAmount: number
  totalDeductionAmount: number
  totalNetAmount: number
  confirmedBy?: FinanceEmployeeRef
  confirmedAt?: string
  remark?: string
  createdAt?: string
}

/**
 * 薪酬工作台报告（与 App `payroll/workbench/report` 同源）。
 * 用于回答「这个月的薪酬走到哪一步了」：待发应付、待确认考勤、各状态工资单数、待发提成与工资条发布数。
 */
export interface PayrollWorkbenchReport {
  period: string
  pendingAttendanceCount: number
  draftSheetCount: number
  pendingSheetCount: number
  confirmedSheetCount: number
  partialPaidSheetCount: number
  paidSheetCount: number
  pendingEmployeePayableAmount: number
  releasedUnpaidCommissionAmount: number
  pendingPayslipCount: number
  publishedPayslipCount: number
  /** 当前周期是否已有工资单；为 false 且存在历史工资单时，页面应给出「最近一次」兜底入口（App 同口径）。 */
  currentPeriodHasSheet: boolean
  latestSheetId?: string
  latestSheetPeriod?: string
  latestSheetStatus?: string
  latestSheetTotalNetAmount: number
}

export interface EmployeePayrollItem {
  id: string
  employee: FinanceEmployeeRef
  project?: ProjectBrief
  attribution: 'project' | 'company'
  baseSalaryAmount: number
  attendanceDeduction: number
  commissionAmount: number
  bonusAmount: number
  allowanceAmount: number
  socialInsuranceAmount: number
  taxAmount: number
  otherDeduction: number
  grossAmount: number
  deductionAmount: number
  netAmount: number
  status: string
  remark?: string
  createdAt?: string
}

export type PayslipStatus = 'pendingPayment' | 'published' | 'void'

/**
 * 我的工资条（员工自助）。
 * 依据 App `payroll/payslip/my/page|info` 与 `view:ownPayslip`：**仅展示实际发放完成的工资条**。
 */
export interface Payslip {
  id: string
  period: string
  grossAmount: number
  deductionAmount: number
  netAmount: number
  /** 未登记状态为 null，页面必须显示「待确认」，不得用某个真实状态兜底。 */
  status: PayslipStatus | null
  publishedAt?: string
  createdAt?: string
}

export interface EmployeeCommissionItem {
  id: string
  employee: FinanceEmployeeRef
  project?: ProjectBrief
  contractAmount: number
  manualRate: number
  commissionAmount: number
  accruedAmount: number
  releasedAmount: number
  paidAmount: number
  status: EmployeeCommissionStatus
  remark?: string
  createdAt?: string
}

export type EmployeeAttendanceStatus = 'draft' | 'pending' | 'confirmed' | 'inPayroll' | 'disputed' | 'rejected'

export interface EmployeeAttendanceSummary {
  id: string
  employee: FinanceEmployeeRef
  payrollMonth: string
  scheduledDays: number
  normalDays: number
  personalLeaveDays: number
  sickLeaveDays: number
  absenceDays: number
  externalDays: number
  annualLeaveDays: number
  compLeaveDays: number
  status: EmployeeAttendanceStatus
  confirmedBy?: FinanceEmployeeRef
  confirmedAt?: string
  remark?: string
  createdAt?: string
}

export interface EmployeeCompensationScheme {
  id: string
  employee: FinanceEmployeeRef
  baseSalary: number
  scheduledDays: number
  effectiveFrom: string
  effectiveTo?: string
  status: 'draft' | 'active' | 'expired'
  remark?: string
  locked: boolean
  lockedReason?: string
  createdBy?: FinanceEmployeeRef
  createdAt?: string
  updatedAt?: string
}

export interface Payable {
  id: string
  project?: ProjectBrief
  materialPlan?: { id?: string; name?: string }
  name: string
  type: PayableType
  payeeEmployee?: FinanceEmployeeRef
  payeeName?: string
  period?: string
  amount: number
  estimated: boolean
  settledAmount?: number
  paidAmount: number
  outstandingAmount: number
  dueDate: string
  status: PayableStatus
  urgent: boolean
  sourceNo?: string
  remark?: string
  createdBy?: FinanceEmployeeRef
  createdAt?: string
}

export interface Payment {
  id: string
  project?: ProjectBrief
  payable?: Payable
  amount: number
  account: FundAccount
  paidAt: string
  payeeName?: string
  worker?: WorkerRef
  transactionNo?: string
  voucherUrl?: string
  remark?: string
  createdBy?: FinanceEmployeeRef
  createdAt?: string
}

export interface LedgerCategory {
  id: string
  name: string
  description?: string
  direction: LedgerDirection
  code?: string
  builtIn: boolean
  sort: number
  active: boolean
  children?: LedgerCategory[]
}

export interface OpeningBalance {
  id: string
  account: FundAccount
  amount: number
  asOfDate: string
  remark?: string
  createdAt?: string
}

export interface Ledger {
  id: string
  project?: ProjectBrief
  direction: LedgerDirection
  category: string
  categoryNode?: LedgerCategory
  purpose?: LedgerManualPurpose
  source: LedgerSource
  sourceId?: string
  amount: number
  account: FundAccount
  occurredAt: string
  counterparty?: string
  summary: string
  remark?: string
  createdBy?: FinanceEmployeeRef
  createdAt?: string
  originalLedgerId?: string
  correctionGroupId?: string
}

export interface Settlement {
  id: string
  project: ProjectBrief
  contractAmount: number
  changeAmount: number
  deductionAmount: number
  rewardAmount: number
  finalAmount: number
  retentionRate: number
  retentionAmount: number
  retentionReleaseAt?: string
  retentionReleasedAt?: string
  receivableAmount: number
  receivedAmount: number
  payableAmount: number
  paidAmount: number
  materialAmount: number
  salaryAmount: number
  projectAmount: number
  expenseAmount: number
  totalCost: number
  estimatedCost: number
  actualCost: number
  manualIncomeAmount?: number
  manualCostAmount?: number
  profitAmount?: number
  costComplete: boolean
  costIncompleteCount: number
  grossMargin?: number
  status: SettlementStatus
  confirmedBy?: FinanceEmployeeRef
  confirmedAt?: string
  closedAt?: string
  remark?: string
  createdAt?: string
}

export interface FinanceSummary {
  projectCount: number
  activeProjectCount: number
  contractAmount: number
  receivableAmount: number
  receivedAmount: number
  outstandingAmount: number
  overdueAmount: number
  payableAmount: number
  paidAmount: number
  unpaidAmount: number
  materialPayableAmount: number
  salaryPayableAmount: number
  projectPayableAmount: number
  otherPayableAmount: number
  monthIncome: number
  monthExpense: number
  monthNetCashFlowAmount: number
  receiptCount: number
  paymentCount: number
  receiptAmount: number
  paymentAmount: number
  monthReceiptAmount: number
  monthPaymentAmount: number
  urgentPayableAmount: number
  cashBalance: number
  openingBalanceAmount: number
  openingBalanceCaptured: boolean
  estimatedCost: number
  actualCost: number
  manualIncomeAmount?: number
  manualCostAmount?: number
  profitAmount?: number
  costComplete: boolean
  costIncompleteProjectCount: number
  costIncompleteItemCount: number
  collectionRate: number
  urgentReceivables: Receivable[]
  overdueReceivables: Receivable[]
  dueSoonReceivables: Receivable[]
  urgentPayables: Payable[]
  recentLedgers: Ledger[]
}

export interface FinanceProjectLedgerReport {
  projectCount: number
  activeProjectCount: number
  contractAmount: number
  receivedAmount: number
  receivableAmount: number
  collectionRate: number
  costComplete: boolean
  costIncompleteProjectCount: number
  asOf?: string
}

export interface FinanceProjectReport {
  project: ProjectBrief
  contractAmount: number
  receivableAmount: number
  receivedAmount: number
  outstandingAmount: number
  overdueAmount: number
  payableAmount: number
  paidAmount: number
  unpaidAmount: number
  receiptCount: number
  paymentCount: number
  receiptAmount: number
  paymentAmount: number
  monthReceiptAmount: number
  monthPaymentAmount: number
  urgentPayableAmount: number
  contractRevenue: number
  materialAmount: number
  materialCost: number
  salaryAmount: number
  laborCost: number
  projectPaymentAmount: number
  projectCost: number
  otherPayableAmount: number
  expenseAllocation: number
  totalCost: number
  estimatedCost: number
  actualCost: number
  manualIncomeAmount?: number
  manualCostAmount?: number
  profitAmount?: number
  costComplete: boolean
  costIncompleteCount: number
  grossProfit?: number
  grossMargin?: number
  collectionRate: number
  paymentRate: number
  receivableCleared: boolean
  payableCleared: boolean
  settlement?: Settlement
  receivables: Receivable[]
  payables: Payable[]
  recentLedgers: Ledger[]
}

export interface FinanceLedgerReport {
  count: number
  totalAmount: number
  incomeAmount: number
  expenseAmount: number
  netCashFlowAmount: number
  asOf?: string
}

export interface FinancePayableReport {
  count: number
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  urgentAmount: number
  asOf?: string
}

export interface PartnerLedger {
  partner?: { id?: string; name?: string; settlementMode?: string; settlementDays?: number; cutoffDay?: number }
  payableAmount?: number
  paidAmount?: number
  outstanding?: number
  overdueAmount?: number
  pendingCount?: number
  nearestDueDate?: string
}

export interface PartnerLedgerReport {
  rows: PartnerLedger[]
  partnerCount: number
  payableAmount: number
  paidAmount: number
  outstandingAmount: number
  overdueAmount: number
  asOf?: string
}

export interface VoucherMonthAmount {
  month: string
  count: number
  amount: number
}

export interface VoucherReport {
  count: number
  totalAmount: number
  receiptAmount: number
  paymentAmount: number
  monthlyAmounts: VoucherMonthAmount[]
}

export interface VoucherItem {
  id: string
  sourceNo: string
  businessDate: string
  account: FundAccount
  amount: number
  category?: string
  remark?: string
}

export interface Voucher {
  id: string
  project?: ProjectBrief
  type: VoucherType
  voucherNo: string
  title: string
  paymentId?: string
  sourceType?: string
  sourceId?: string
  totalAmount: number
  amountWords: string
  partyName?: string
  worker?: WorkerRef
  status: VoucherStatus
  fileName?: string
  generatedAt?: string
  items: VoucherItem[]
  url?: string
  urlExpiresAt?: string
}

export interface FinanceReceiptReport {
  receiptCount: number
  grossReceiptAmount: number
  reversalAmount: number
  receiptAmount: number
  asOf?: string
}

export interface FinancePaymentReport {
  paymentCount: number
  paymentAmount: number
  asOf?: string
}

export interface FinanceRefundReport {
  count: number
  totalAmount: number
  asOf?: string
}

export interface FinanceCommissionReport {
  count: number
  commissionAmount: number
  accruedAmount: number
  releasedAmount: number
  paidAmount: number
  asOf?: string
}

export interface FinanceReceivableReport {
  count: number
  totalAmount: number
  receivedAmount: number
  outstandingAmount: number
  overdueAmount: number
  asOf?: string
}

export interface FinancePage<T> {
  list: T[]
  total: number
  hasMore: boolean
}
