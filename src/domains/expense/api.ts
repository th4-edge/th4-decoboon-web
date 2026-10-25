import { post } from '@/core/http'
import { fileApi } from '@/domains/file/api'
import { paymentOf, voucherOf } from '@/domains/finance/api'
import type {
  Expense,
  ExpenseAttachment,
  ExpenseAttachmentInput,
  ExpenseCategory,
  ExpenseDocumentType,
  ExpenseEmployeeRef,
  ExpensePage,
  ExpensePayable,
  ExpensePaymentMode,
  ExpenseProjectRef,
  ExpenseQuery,
  ExpenseRevision,
  ExpenseSaveInput,
  ExpenseStatus,
  ExpenseStoreRef,
  ExpenseUpdateInput
} from './model'

type RawRecord = Record<string, unknown>

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

function enumValue(value: unknown): string {
  if (typeof value === 'string') return value
  const record = recordOf(value)
  return text(record.value ?? record.key ?? record.name)
}

function dateTimeValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value || undefined
  const record = recordOf(value)
  return optionalText(record.dateTime ?? record.value)
}

function listOf(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  const record = recordOf(value)
  for (const key of ['content', 'list', 'records', 'items']) {
    if (Array.isArray(record[key])) return record[key] as unknown[]
  }
  return []
}

function pageOf(value: unknown, current: number, size: number): ExpensePage<Expense> {
  const list = listOf(value).map((item) => expenseOf(item))
  const record = recordOf(value)
  const total = numberValue(record.totalElements ?? record.total ?? list.length)
  return {
    list,
    total,
    hasMore: typeof record.hasMore === 'boolean' ? record.hasMore : current * size < total
  }
}

function employeeOf(value: unknown): ExpenseEmployeeRef {
  const raw = recordOf(value)
  return {
    id: text(raw.empId ?? raw.id),
    name: text(raw.name) || '员工待确认',
    role: optionalText(enumValue(raw.role))
  }
}

function categoryOf(value: unknown): ExpenseCategory | undefined {
  const raw = recordOf(value)
  const id = text(raw.categoryId ?? raw.id)
  if (!id) return undefined
  return {
    id,
    code: optionalText(raw.code),
    name: text(raw.name) || '分类待确认',
    description: optionalText(raw.description),
    builtIn: raw.builtIn === true,
    active: raw.active !== false,
    sort: numberValue(raw.sort)
  }
}

function projectOf(value: unknown): ExpenseProjectRef | undefined {
  const raw = recordOf(value)
  const id = text(raw.projectId ?? raw.id)
  if (!id) return undefined
  return {
    id,
    no: optionalText(raw.no ?? raw.projectNo),
    name: text(raw.name) || '项目待确认',
    status: optionalText(enumValue(raw.status))
  }
}

function storeOf(value: unknown): ExpenseStoreRef | undefined {
  const raw = recordOf(value)
  const id = text(raw.storeId ?? raw.id)
  if (!id) return undefined
  return {
    id,
    name: text(raw.name) || '门店待确认'
  }
}

function attachmentOf(value: unknown): ExpenseAttachment {
  const raw = recordOf(value)
  const fileUrl = text(raw.fileUrl ?? raw.path ?? raw.url)
  const documentType = enumValue(raw.documentType) as ExpenseDocumentType
  return {
    attachmentId: optionalText(raw.attachmentId ?? raw.id),
    documentType: documentType || 'Other',
    fileUrl,
    url: fileApi.absolute(fileUrl),
    fileName: optionalText(raw.fileName ?? raw.name),
    size: raw.size === null || raw.size === undefined ? undefined : numberValue(raw.size),
    sha256: optionalText(raw.sha256)
  }
}

function payableOf(value: unknown): ExpensePayable | undefined {
  const raw = recordOf(value)
  const id = text(raw.payableId ?? raw.id)
  if (!id) return undefined
  return {
    id,
    name: text(raw.name) || '费用应付',
    type: enumValue(raw.type) || undefined,
    amount: numberValue(raw.amount),
    paidAmount: numberValue(raw.paidAmount),
    dueDate: optionalText(raw.dueDate),
    status: optionalText(enumValue(raw.status)),
    payeeName: optionalText(raw.payeeName),
    payeeEmployee: raw.payeeEmployee ? employeeOf(raw.payeeEmployee) : undefined
  }
}

function revisionOf(value: unknown): ExpenseRevision | undefined {
  const raw = recordOf(value)
  const version = numberValue(raw.version)
  if (!version) return undefined
  return {
    revisionId: optionalText(raw.revisionId ?? raw.id),
    version,
    snapshotJson: text(raw.snapshotJson),
    submittedBy: raw.submittedBy ? employeeOf(raw.submittedBy) : undefined,
    submittedAt: dateTimeValue(raw.submittedAt),
    returnedBy: raw.returnedBy ? employeeOf(raw.returnedBy) : undefined,
    returnedAt: dateTimeValue(raw.returnedAt),
    returnReason: optionalText(raw.returnReason)
  }
}

function expenseOf(value: unknown): Expense {
  const raw = recordOf(value)
  const status = enumValue(raw.status) as ExpenseStatus
  const paymentMode = enumValue(raw.paymentMode) as ExpensePaymentMode
  return {
    id: text(raw.expenseId ?? raw.id),
    expenseNo: text(raw.expenseNo),
    paymentMode: paymentMode || 'Direct',
    amount: numberValue(raw.amount),
    expenseDate: text(raw.expenseDate),
    description: text(raw.description),
    category: categoryOf(raw.category),
    project: projectOf(raw.project),
    store: storeOf(raw.store),
    requester: employeeOf(raw.requester),
    owner: employeeOf(raw.owner),
    payeeEmployee: raw.payeeEmployee ? employeeOf(raw.payeeEmployee) : undefined,
    status: status || 'Draft',
    version: numberValue(raw.version),
    submittedAt: dateTimeValue(raw.submittedAt),
    approvedBy: raw.approvedBy ? employeeOf(raw.approvedBy) : undefined,
    approvedAt: dateTimeValue(raw.approvedAt),
    payable: payableOf(raw.payable),
    paymentStatus: optionalText(enumValue(raw.paymentStatus)),
    paidAmount: numberValue(raw.paidAmount),
    unpaidAmount: numberValue(raw.unpaidAmount),
    approvalNote: optionalText(raw.approvalNote),
    selfApproved: raw.selfApproved === true,
    attachments: listOf(raw.attachments).map((item) => attachmentOf(item)).filter((item) => Boolean(item.fileUrl)),
    allowedActions: Array.isArray(raw.allowedActions)
      ? raw.allowedActions.map((item) => text(item)).filter(Boolean)
      : undefined,
    nextAction: optionalText(raw.nextAction),
    revisions: listOf(raw.revisions).map((item) => revisionOf(item)).filter((item): item is ExpenseRevision => Boolean(item)),
    payments: listOf(raw.payments).map((item) => paymentOf(item)),
    vouchers: listOf(raw.vouchers).map((item) => voucherOf(item)),
    createdAt: dateTimeValue(raw.createTime ?? raw.createdAt),
    updatedAt: dateTimeValue(raw.updateTime ?? raw.updatedAt)
  }
}

function attachmentsOf(items: ExpenseAttachmentInput[]): Record<string, unknown>[] {
  return items.map((item) => ({
    documentType: item.documentType,
    fileUrl: fileApi.storagePath(item.fileUrl) || item.fileUrl,
    fileName: item.fileName,
    size: item.size
  }))
}

export const expenseApi = {
  categories: async (): Promise<ExpenseCategory[]> =>
    listOf(await post<unknown>('expense/categories/list', {}))
      .map((item) => categoryOf(item))
      .filter((item): item is ExpenseCategory => Boolean(item)),

  page: async (params: ExpenseQuery = {}): Promise<ExpensePage<Expense>> => {
    const current = params.current ?? 1
    const size = params.size ?? 20
    return pageOf(await post<unknown>('expense/expenses/page', {
      current,
      size,
      status: params.status,
      keyword: params.keyword,
      projectId: params.projectId,
      payeeEmployeeId: params.payeeEmployeeId,
      storeId: params.storeId
    }), current, size)
  },

  info: async (expenseId: string): Promise<Expense> => {
    const expense = expenseOf(await post<unknown>('expense/expenses/info', { expenseId }))
    if (!expense.attachments.length) return expense
    try {
      const granted = await fileApi.grantFiles('Expense', expense.id,
        expense.attachments.map((item) => item.fileUrl))
      return {
        ...expense,
        attachments: expense.attachments.map((item, index) => ({
          ...item,
          url: granted[index] || item.url
        }))
      }
    } catch {
      return expense
    }
  },

  save: async (input: ExpenseSaveInput): Promise<Expense> =>
    expenseOf(await post<unknown>('expense/expenses/save', {
      ...input,
      attachments: attachmentsOf(input.attachments)
    })),

  update: async (input: ExpenseUpdateInput): Promise<Expense> =>
    expenseOf(await post<unknown>('expense/expenses/update', {
      ...input,
      attachments: input.attachments ? attachmentsOf(input.attachments) : undefined
    })),

  remove: async (expenseId: string): Promise<Expense> =>
    expenseOf(await post<unknown>('expense/expenses/delete', { expenseId }))
}
