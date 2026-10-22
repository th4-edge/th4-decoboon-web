import type { StatusTone } from '@/core/tone'
import type {
  FundAccount,
  LedgerDirection,
  LedgerManualPurpose,
  PayableStatus,
  PayableType,
  ReceivableStatus,
  ReceivableType,
  SettlementStatus,
  VoucherStatus,
  VoucherType
} from './model'

export interface FinanceMeta {
  label: string
  tone: StatusTone
}

export const RECEIVABLE_TYPE_META: Record<ReceivableType, FinanceMeta> = {
  first: { label: '首期款', tone: 'info' },
  progress: { label: '进度款', tone: 'doing' },
  final: { label: '尾款', tone: 'pending' },
  retention: { label: '质保金', tone: 'special' },
  other: { label: '其他应收', tone: 'muted' }
}

export const RECEIVABLE_STATUS_META: Record<ReceivableStatus, FinanceMeta> = {
  pending: { label: '待收', tone: 'todo' },
  partial: { label: '部分收款', tone: 'pending' },
  received: { label: '已收清', tone: 'done' },
  overdue: { label: '已逾期', tone: 'blocked' },
  closed: { label: '已关闭', tone: 'closed' }
}

export const PAYABLE_TYPE_META: Record<PayableType, FinanceMeta> = {
  material: { label: '材料款', tone: 'accent' },
  salary: { label: '工人工资', tone: 'pending' },
  project: { label: '项目款', tone: 'doing' },
  supplier: { label: '供应商款', tone: 'progress' },
  expense: { label: '费用支出', tone: 'special' },
  other: { label: '其他应付', tone: 'muted' }
}

export const PAYABLE_STATUS_META: Record<PayableStatus, FinanceMeta> = {
  pending: { label: '待付款', tone: 'todo' },
  partial: { label: '部分付款', tone: 'pending' },
  paid: { label: '已付清', tone: 'done' },
  overdue: { label: '已逾期', tone: 'blocked' },
  closed: { label: '已关闭', tone: 'closed' }
}

/** 凭证类型/状态中文投影（规范 §5：集中定义，禁止页面内自建标签表）。 */
export const VOUCHER_TYPE_LABELS: Record<VoucherType, string> = {
  receipt: '收款凭证',
  payment: '付款凭证'
}

export const VOUCHER_STATUS_META: Record<VoucherStatus, FinanceMeta> = {
  active: { label: '有效', tone: 'done' },
  voided: { label: '已作废', tone: 'closed' }
}

export const ACCOUNT_LABEL: Record<FundAccount, string> = {
  companyBank: '企业对公',
  cash: '现金',
  wechat: '微信',
  alipay: '支付宝',
  other: '其他账户'
}

export const SETTLEMENT_STATUS_META: Record<SettlementStatus, FinanceMeta> = {
  draft: { label: '待确认', tone: 'todo' },
  confirmed: { label: '已确认', tone: 'doing' },
  closed: { label: '已关闭', tone: 'done' },
  retentionPending: { label: '待释放质保金', tone: 'pending' },
  retentionReleased: { label: '质保金已释放', tone: 'done' }
}

export const DIRECTION_META: Record<LedgerDirection, FinanceMeta> = {
  income: { label: '收入', tone: 'done' },
  expense: { label: '支出', tone: 'blocked' }
}

export const LEDGER_PURPOSE_META: Record<LedgerManualPurpose, FinanceMeta & { hint: string; directions: LedgerDirection[] }> = {
  projectIncidentalCost: {
    label: '项目零星成本',
    tone: 'pending',
    hint: '关联项目的计划外直接支出，计入项目实际成本',
    directions: ['expense']
  },
  companyExpense: {
    label: '企业费用',
    tone: 'special',
    hint: '房租、办公、推广、税费等企业运营费用',
    directions: ['expense']
  },
  otherIncome: {
    label: '其他收入',
    tone: 'done',
    hint: '设计费、材料销售、服务费等非工程款收入',
    directions: ['income']
  },
  capitalTransfer: {
    label: '资金往来',
    tone: 'info',
    hint: '借款、还款、押金、备用金、股东往来',
    directions: ['income', 'expense']
  },
  other: {
    label: '其他',
    tone: 'muted',
    hint: '无法归入以上用途的其他账务',
    directions: ['income', 'expense']
  }
}

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  preparing: '待开工',
  ongoing: '施工中',
  suspended: '已暂停',
  accepting: '验收中',
  finished: '已完工',
  settled: '已结算'
}

/** 工资项状态口径（与 App `PAYROLL_ITEM_STATUS_META` 同源）。 */
export const PAYROLL_ITEM_STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: '草稿', tone: 'todo' },
  confirmed: { label: '已确认', tone: 'doing' },
  paid: { label: '已发放', tone: 'done' },
  void: { label: '已作废', tone: 'blocked' }
}

/** 工资条状态口径（与 App `PAYSLIP_STATUS_META` 同源）。 */
export const PAYSLIP_STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  pendingPayment: { label: '待发放', tone: 'pending' },
  published: { label: '已发布', tone: 'done' },
  void: { label: '已作废', tone: 'blocked' }
}

/** 工资单状态口径（与 App `PAYROLL_SHEET_STATUS_META` 同源）。 */
export const PAYROLL_SHEET_STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: '草稿', tone: 'todo' },
  pending: { label: '待确认', tone: 'pending' },
  confirmed: { label: '已确认', tone: 'doing' },
  partialPaid: { label: '部分发放', tone: 'pending' },
  paid: { label: '已发放', tone: 'done' },
  closed: { label: '已关闭', tone: 'closed' },
  void: { label: '已作废', tone: 'blocked' }
}

/** 未登记状态必须显示「待确认」（ANT-010：不得用默认值兜底未知枚举）。 */
export function payrollSheetStatusLabel(status: string): string {
  return PAYROLL_SHEET_STATUS_META[status]?.label || '待确认'
}

export function payrollSheetStatusTone(status: string): StatusTone {
  return PAYROLL_SHEET_STATUS_META[status]?.tone || 'todo'
}
