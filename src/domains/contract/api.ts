import { post } from '@/core/http'
import { fileApi } from '@/domains/file/api'
import type { Contract, ContractChange, ContractChangeStatus, ContractChangeType, ContractStatus } from './model'

type RawRecord = Record<string, unknown>

const CONTRACT_STATUS: Record<string, ContractStatus> = {
  Draft: 'draft',
  PendingSign: 'pendingSign',
  Signed: 'signed',
  Effective: 'effective',
  Changing: 'changing',
  Active: 'active',
  Changed: 'changed',
  Completed: 'completed',
  Closed: 'closed',
  Settled: 'settled',
  Terminated: 'terminated',
  Void: 'void'
}

const CHANGE_STATUS: Record<string, ContractChangeStatus> = {
  Pending: 'pending',
  Approved: 'approved',
  CustomerConfirmed: 'customerConfirmed',
  Rejected: 'rejected',
  Cancelled: 'cancelled'
}

const CHANGE_TYPE: Record<string, ContractChangeType> = {
  Add: 'add',
  Remove: 'remove',
  Replace: 'replace',
  Quantity: 'quantity',
  Price: 'price'
}

const CHANGE_TYPE_API: Record<ContractChangeType, string> = {
  add: 'Add',
  remove: 'Remove',
  replace: 'Replace',
  quantity: 'Quantity',
  price: 'Price'
}

function str(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isNaN(parsed) ? 0 : parsed
}

function enumValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const record = raw as RawRecord
    return str(record.value ?? record.key ?? record.name)
  }
  return ''
}

function recordOf(raw: unknown): RawRecord {
  return raw && typeof raw === 'object' ? raw as RawRecord : {}
}

function pageRows(raw: unknown): RawRecord[] {
  if (Array.isArray(raw)) return raw as RawRecord[]
  const record = recordOf(raw)
  for (const key of ['content', 'list', 'records']) {
    if (Array.isArray(record[key])) return record[key] as RawRecord[]
  }
  return []
}

function normalizeContract(raw: RawRecord): Contract {
  const quote = recordOf(raw.quote)
  const project = recordOf(raw.project)
  return {
    id: str(raw.contractId ?? raw.id),
    no: str(raw.no),
    status: CONTRACT_STATUS[enumValue(raw.status)] ?? 'draft',
    currentAmount: num(raw.currentAmount ?? raw.amount ?? raw.signedAmount),
    signedAmount: raw.signedAmount === undefined ? undefined : num(raw.signedAmount),
    signedAt: str(raw.signedAt) || undefined,
    effectiveAt: str(raw.effectiveAt) || undefined,
    startDate: str(raw.startDate) || undefined,
    planEndDate: str(raw.planEndDate) || undefined,
    paymentTerms: str(raw.paymentTerms) || undefined,
    quoteId: str(quote.quoteId ?? quote.id ?? raw.quoteId) || undefined,
    projectId: str(project.projectId ?? project.id ?? raw.projectId) || undefined,
    createdAt: str(recordOf(raw.createTime).dateTime ?? raw.createTime ?? raw.createdAt) || undefined
  }
}

async function normalizeChange(raw: RawRecord): Promise<ContractChange> {
  const change: ContractChange = {
    id: str(raw.changeId ?? raw.id),
    contractId: str(raw.contractId ?? recordOf(raw.contract).contractId),
    projectId: str(raw.projectId ?? recordOf(raw.project).projectId),
    no: str(raw.no),
    amount: num(raw.amount),
    type: CHANGE_TYPE[enumValue(raw.type)] ?? 'add',
    reason: str(raw.reason),
    status: CHANGE_STATUS[enumValue(raw.status)] ?? 'pending',
    requestedByName: str(recordOf(raw.requestedBy).name) || undefined,
    approvedByName: str(recordOf(raw.approvedBy).name) || undefined,
    conclusion: str(raw.conclusion) || undefined,
    approvedAt: str(raw.approvedAt) || undefined,
    customerConfirmed: raw.customerConfirmed === true,
    customerConfirmedAt: str(raw.customerConfirmedAt) || undefined,
    evidenceImages: Array.isArray(raw.evidenceImages) ? raw.evidenceImages.map(str).filter(Boolean) : [],
    signatureUrl: str(raw.signatureUrl) || undefined,
    createdAt: str(recordOf(raw.createTime).dateTime ?? raw.createTime ?? raw.createdAt) || undefined
  }
  if (!change.id) return change
  const paths = [...change.evidenceImages, ...(change.signatureUrl ? [change.signatureUrl] : [])]
  if (!paths.length) return change
  try {
    const signed = await fileApi.grantFiles('ContractChange', change.id, paths)
    let index = 0
    return {
      ...change,
      evidenceImages: change.evidenceImages.map(() => signed[index++] ?? ''),
      signatureUrl: change.signatureUrl ? signed[index] : undefined
    }
  } catch {
    return change
  }
}

export async function contractByQuote(quoteId: string): Promise<Contract | null> {
  const raw = await post<unknown>('project/contract/info', { quoteId })
  if (!raw) return null
  return normalizeContract(recordOf(raw))
}

export async function contractByProject(projectId: string): Promise<Contract | null> {
  const raw = await post<unknown>('project/contract/info', { projectId })
  if (!raw) return null
  return normalizeContract(recordOf(raw))
}

export async function listContractChanges(projectId: string): Promise<ContractChange[]> {
  const raw = await post<unknown>('project/contract-change/page', { projectId })
  return Promise.all(pageRows(raw).map((row) => normalizeChange(row)))
}

export interface SaveContractChangeInput {
  contractId: string
  reason: string
  type: ContractChangeType
  amount: number
  evidenceImages?: string[]
}

export async function saveContractChange(input: SaveContractChangeInput): Promise<ContractChange> {
  const raw = await post<unknown>('project/contract-change/save', {
    contractId: input.contractId,
    reason: input.reason,
    type: CHANGE_TYPE_API[input.type],
    amount: input.amount,
    evidenceImages: (input.evidenceImages ?? []).map((path) => fileApi.storagePath(path) || path)
  })
  return normalizeChange(recordOf(raw))
}

export async function customerConfirmContractChange(
  changeId: string,
  input: { signatureUrl?: string; evidenceImages?: string[] } = {}
): Promise<ContractChange> {
  const raw = await post<unknown>('project/contract-change/customer-confirm', {
    changeId,
    signatureUrl: fileApi.storagePath(input.signatureUrl),
    evidenceImages: (input.evidenceImages ?? []).map((path) => fileApi.storagePath(path) || path)
  })
  return normalizeChange(recordOf(raw))
}

export const contractApi = { contractByQuote, contractByProject, listContractChanges, saveContractChange, customerConfirmContractChange }
