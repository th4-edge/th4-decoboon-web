import type { Payment, Voucher } from '@/domains/finance/model'

export type ExpensePaymentMode = 'Direct' | 'Reimbursement'
export type ExpenseStatus = 'Draft' | 'Submitted' | 'Returned' | 'Approved' | 'Rejected' | 'Cancelled' | 'Voided' | 'Closed'
export type ExpenseDocumentType = 'Invoice' | 'Receipt' | 'PaymentScreenshot' | 'Itinerary' | 'Other'

export interface ExpenseEmployeeRef {
  id: string
  name: string
  role?: string
}

export interface ExpenseCategory {
  id: string
  code?: string
  name: string
  description?: string
  builtIn: boolean
  active: boolean
  sort: number
}

export interface ExpenseProjectRef {
  id: string
  no?: string
  name: string
  status?: string
}

export interface ExpenseStoreRef {
  id: string
  name: string
}

export interface ExpenseAttachment {
  attachmentId?: string
  documentType: ExpenseDocumentType
  fileUrl: string
  url: string
  fileName?: string
  size?: number
  sha256?: string
}

export interface ExpensePayable {
  id: string
  name: string
  type?: string
  amount: number
  paidAmount: number
  dueDate?: string
  status?: string
  payeeName?: string
  payeeEmployee?: ExpenseEmployeeRef
}

export interface ExpenseRevision {
  revisionId?: string
  version: number
  snapshotJson: string
  submittedBy?: ExpenseEmployeeRef
  submittedAt?: string
  returnedBy?: ExpenseEmployeeRef
  returnedAt?: string
  returnReason?: string
}

export interface Expense {
  id: string
  expenseNo: string
  paymentMode: ExpensePaymentMode
  amount: number
  expenseDate: string
  description: string
  category?: ExpenseCategory
  project?: ExpenseProjectRef
  store?: ExpenseStoreRef
  requester: ExpenseEmployeeRef
  owner: ExpenseEmployeeRef
  payeeEmployee?: ExpenseEmployeeRef
  status: ExpenseStatus
  version: number
  submittedAt?: string
  approvedBy?: ExpenseEmployeeRef
  approvedAt?: string
  payable?: ExpensePayable
  paymentStatus?: string
  paidAmount: number
  unpaidAmount: number
  approvalNote?: string
  selfApproved: boolean
  attachments: ExpenseAttachment[]
  /** 服务端按当前用户与状态推导；缺失表示动作投影暂不可确认。 */
  allowedActions?: string[]
  /** 服务端推导的下一步业务动作。 */
  nextAction?: string
  revisions?: ExpenseRevision[]
  payments: Payment[]
  vouchers: Voucher[]
  createdAt?: string
  updatedAt?: string
}

export interface ExpensePage<T> {
  list: T[]
  total: number
  hasMore: boolean
}

export interface ExpenseAttachmentInput {
  documentType: ExpenseDocumentType
  fileUrl: string
  fileName?: string
  size?: number
}

export interface ExpenseSaveInput {
  paymentMode: ExpensePaymentMode
  amount: number
  expenseDate: string
  description: string
  categoryId: string
  projectId?: string
  storeId?: string
  employeeId?: string
  payeeEmployeeId?: string
  idempotencyKey: string
  attachments: ExpenseAttachmentInput[]
}

export interface ExpenseUpdateInput {
  expenseId: string
  status?: Exclude<ExpenseStatus, 'Draft' | 'Voided' | 'Closed'>
  approvalNote?: string
  paymentMode?: ExpensePaymentMode
  amount?: number
  expenseDate?: string
  description?: string
  categoryId?: string
  projectId?: string
  storeId?: string
  employeeId?: string
  payeeEmployeeId?: string
  attachments?: ExpenseAttachmentInput[]
}

export interface ExpenseQuery {
  current?: number
  size?: number
  status?: ExpenseStatus
  keyword?: string
  projectId?: string
  payeeEmployeeId?: string
  storeId?: string
}

