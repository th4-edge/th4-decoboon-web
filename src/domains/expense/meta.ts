import type { StatusTone } from '@/core/tone'
import type { ExpenseDocumentType, ExpensePaymentMode, ExpenseStatus } from './model'

export interface ExpenseMeta {
  label: string
  tone: StatusTone
}

export const EXPENSE_PAYMENT_MODE_META: Record<ExpensePaymentMode, ExpenseMeta & { hint: string }> = {
  Direct: {
    label: '企业直付',
    tone: 'info',
    hint: '企业直接承担费用，不形成员工应收。'
  },
  Reimbursement: {
    label: '员工报销',
    tone: 'special',
    hint: '员工先行垫付，收款员工必须与费用归属员工一致。'
  }
}

export const EXPENSE_STATUS_META: Record<ExpenseStatus, ExpenseMeta & { next: string }> = {
  Draft: { label: '草稿', tone: 'todo', next: '补齐分类、金额和证据后提交' },
  Submitted: { label: '已提交', tone: 'pending', next: '等待企业负责人或店长审批' },
  Returned: { label: '退回补充', tone: 'blocked', next: '按退回原因补齐证据后重新提交' },
  Approved: { label: '已批准', tone: 'done', next: '费用事实已确认；付款由后续流程处理' },
  Rejected: { label: '已拒绝', tone: 'blocked', next: '本次费用流程终止' },
  Cancelled: { label: '已取消', tone: 'closed', next: '提交人已撤回本次费用' },
  Voided: { label: '已作废', tone: 'closed', next: '历史费用已作废' },
  Closed: { label: '已关闭', tone: 'dark', next: '费用流程已关闭' }
}

export const EXPENSE_DOCUMENT_TYPE_META: Record<ExpenseDocumentType, { label: string }> = {
  Invoice: { label: '发票' },
  Receipt: { label: '收据' },
  PaymentScreenshot: { label: '支付截图' },
  Itinerary: { label: '行程单' },
  Other: { label: '其他说明' }
}

export function expenseStatusMeta(status: string): ExpenseMeta & { next: string } {
  return EXPENSE_STATUS_META[status as ExpenseStatus] ?? {
    label: '状态待确认',
    tone: 'muted',
    next: '请刷新后重新确认当前费用状态'
  }
}

export function expensePaymentModeMeta(mode: string): ExpenseMeta & { hint: string } {
  return EXPENSE_PAYMENT_MODE_META[mode as ExpensePaymentMode] ?? {
    label: '支付方式待确认',
    tone: 'muted',
    hint: '请刷新后重新确认费用支付方式'
  }
}

export function expenseDocumentTypeLabel(type: string): string {
  return EXPENSE_DOCUMENT_TYPE_META[type as ExpenseDocumentType]?.label ?? '其他说明'
}
