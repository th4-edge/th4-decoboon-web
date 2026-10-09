import { post } from '@/core/http'
import { normalizeBusinessStateView } from '@/domains/business-state/api'
import { fileApi } from '@/domains/file/api'
import type { Contract, ContractChange, ContractChangeItem, ContractChangeStatus, ContractChangeType, ContractLine, ContractStatus } from './model'
import type { Employee } from '@/domains/identity/model'

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

const UNIT_NAMES: Record<string, string> = {
  Area: '㎡', Count: '个', Item: '项', Place: '处', Set: '套', House: '户', Metre: 'm',
  Centimeter: 'cm', Step: '步', Plate: '樘', Block: '块', Root: '根', Hole: '扇', Pcs: '台',
  Stick: '支', Grid: '格', Sheet: '片'
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
    businessStateView: normalizeBusinessStateView(raw.businessStateView),
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

function employeeOf(raw: unknown): Employee | undefined {
  const record = recordOf(raw)
  const empId = str(record.empId ?? record.id)
  if (!empId) return undefined
  return { empId, name: str(record.name) }
}

function normalizeChangeItem(raw: RawRecord): ContractChangeItem {
  return {
    id: str(raw.changeItemId ?? raw.id),
    changeType: CHANGE_TYPE[enumValue(raw.changeType)] ?? 'add',
    itemType: enumValue(raw.itemType) || undefined,
    name: str(raw.name),
    sourceLineId: str(raw.sourceLineId ?? recordOf(raw.sourceLine).lineId) || undefined,
    sourceChangeItemId: str(raw.sourceChangeItemId ?? recordOf(raw.sourceChangeItem).changeItemId) || undefined,
    targetCatalogItemId: str(raw.targetCatalogItemId ?? recordOf(raw.targetCatalogItem).itemId) || undefined,
    reduceQuantity: raw.reduceQuantity === undefined || raw.reduceQuantity === null ? undefined : num(raw.reduceQuantity),
    oldQuantity: num(raw.oldQuantity),
    newQuantity: num(raw.newQuantity),
    oldPrice: num(raw.oldPrice),
    newPrice: num(raw.newPrice),
    amountDelta: num(raw.amountDelta),
    costDelta: raw.costDelta === undefined || raw.costDelta === null ? undefined : num(raw.costDelta),
    remark: str(raw.remark) || undefined,
    sourceRemainingQuantity: raw.sourceRemainingQuantity === undefined || raw.sourceRemainingQuantity === null ? undefined : num(raw.sourceRemainingQuantity),
    sourceRemainingAmount: raw.sourceRemainingAmount === undefined || raw.sourceRemainingAmount === null ? undefined : num(raw.sourceRemainingAmount),
    sourceUnitPrice: raw.sourceUnitPrice === undefined || raw.sourceUnitPrice === null ? undefined : num(raw.sourceUnitPrice),
    targetName: str(raw.targetName) || undefined,
    targetType: enumValue(raw.targetType) || undefined,
    targetCategory: str(raw.targetCategory) || undefined,
    targetBrand: str(raw.targetBrand) || undefined,
    targetSeries: str(raw.targetSeries) || undefined,
    targetSpec: str(raw.targetSpec) || undefined,
    targetUnit: UNIT_NAMES[enumValue(raw.targetUnit)] ?? (str(raw.targetUnit) || undefined),
    targetQuantity: raw.targetQuantity === undefined || raw.targetQuantity === null ? undefined : num(raw.targetQuantity),
    targetAmount: raw.targetAmount === undefined || raw.targetAmount === null ? undefined : num(raw.targetAmount),
    targetCostComplete: raw.targetCostComplete === undefined || raw.targetCostComplete === null ? undefined : raw.targetCostComplete === true
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
    requestedBy: employeeOf(raw.requestedBy),
    approvedBy: employeeOf(raw.approvedBy),
    conclusion: str(raw.conclusion) || undefined,
    approvedAt: str(raw.approvedAt) || undefined,
    customerConfirmed: raw.customerConfirmed === true,
    customerConfirmedAt: str(raw.customerConfirmedAt) || undefined,
    customerConfirmedBy: str(raw.customerConfirmedBy) || undefined,
    customerConfirmMethod: str(raw.customerConfirmMethod) || undefined,
    evidenceImages: Array.isArray(raw.evidenceImages) ? raw.evidenceImages.map(str).filter(Boolean) : [],
    signatureUrl: str(raw.signatureUrl) || undefined,
    items: Array.isArray(raw.items) ? raw.items.map((item) => normalizeChangeItem(recordOf(item))) : undefined,
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

export interface SaveContractInput {
  quoteId: string
  /** 发起阶段只允许填写开工/计划完工与付款说明，不得携带 signedAt/signedAmount（后端强制校验）。 */
  startDate?: string
  planEndDate?: string
  paymentTerms?: string
  paymentPlanCode?: string
  constructionPlanCode?: string
  remark?: string
}

/** 从客户确认报价发起合同基线（只生成待签约合同，不直接完成签约；签约由企业负责人/店长确认）。 */
export async function saveContract(input: SaveContractInput): Promise<Contract> {
  const raw = await post<unknown>('project/contract/save', input)
  return normalizeContract(recordOf(raw))
}

export interface SaveContractChangeInput {
  contractId: string
  reason: string
  type: ContractChangeType
  amount: number
  evidenceImages?: string[]
  customerConfirmedAt?: string
  customerConfirmedBy?: string
  customerConfirmMethod?: string
}

export async function saveContractChange(input: SaveContractChangeInput): Promise<ContractChange> {
  const raw = await post<unknown>('project/contract-change/save', {
    contractId: input.contractId,
    reason: input.reason,
    type: CHANGE_TYPE_API[input.type],
    amount: input.amount,
    evidenceImages: (input.evidenceImages ?? []).map((path) => fileApi.storagePath(path) || path),
    customerConfirmedAt: input.customerConfirmedAt,
    customerConfirmedBy: input.customerConfirmedBy,
    customerConfirmMethod: input.customerConfirmMethod
  })
  return normalizeChange(recordOf(raw))
}

export async function listContractLines(contractId: string): Promise<ContractLine[]> {
  const raw = await post<unknown>('project/contract-line/page', { contractId, current: 1, size: 500 })
  return pageRows(raw).map((row) => ({
    id: str(row.lineId ?? row.id),
    contractId: str(row.contractId ?? recordOf(row.contract).contractId) || undefined,
    type: str(row.type) || undefined,
    category: str(row.category) || undefined,
    name: str(row.name),
    brand: str(row.brand) || undefined,
    spec: str(row.spec) || undefined,
    unit: UNIT_NAMES[enumValue(row.unit)] ?? str(row.unit),
    quantity: num(row.quantity),
    materialPrice: num(row.materialPrice),
    manualPrice: num(row.manualPrice),
    pricingMode: str(row.pricingMode) || undefined,
    amount: num(row.amount),
    cost: num(row.cost),
    formula: str(row.formula) || undefined,
    role: str(row.role) || undefined,
    spaceName: str(row.spaceName) || undefined,
    sort: Number(row.sort ?? 0)
  }))
}

export interface BatchContractChangeItemInput {
  name?: string
  itemType?: string
  changeType?: ContractChangeType
  sourceLineId?: string
  sourceChangeItemId?: string
  targetCatalogItemId?: string
  targetQuantity?: number
  reduceQuantity?: number
  newQuantity?: number
  newPrice?: number
  newCost?: number
  amountDelta?: number
  costDelta?: number
  remark?: string
}

export interface BatchSaveContractChangeInput {
  contractId: string
  reason: string
  type?: ContractChangeType
  evidenceImages?: string[]
  signatureUrl?: string
  customerConfirmedAt?: string
  customerConfirmedBy?: string
  customerConfirmMethod?: string
  items: BatchContractChangeItemInput[]
}

export async function batchSaveContractChange(input: BatchSaveContractChangeInput): Promise<ContractChange> {
  const raw = await post<unknown>('project/contract-change/batch-save', {
    contractId: input.contractId,
    reason: input.reason,
    type: input.type ? CHANGE_TYPE_API[input.type] : undefined,
    evidenceImages: (input.evidenceImages ?? []).map((path) => fileApi.storagePath(path) || path),
    signatureUrl: fileApi.storagePath(input.signatureUrl),
    customerConfirmedAt: input.customerConfirmedAt,
    customerConfirmedBy: input.customerConfirmedBy,
    customerConfirmMethod: input.customerConfirmMethod,
    items: input.items.map((item) => ({
      ...item,
      changeType: item.changeType ? CHANGE_TYPE_API[item.changeType] : undefined
    }))
  })
  return normalizeChange(recordOf(raw))
}

export async function approveContractChange(changeId: string, approved: boolean, conclusion?: string): Promise<ContractChange> {
  const raw = await post<unknown>('project/contract-change/update', {
    changeId,
    approved,
    conclusion: conclusion?.trim() || undefined
  })
  return normalizeChange(recordOf(raw))
}

export async function cancelContractChange(changeId: string): Promise<ContractChange> {
  const raw = await post<unknown>('project/contract-change/cancel', { changeId })
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

export const contractApi = {
  contractByQuote,
  contractByProject,
  saveContract,
  listContractChanges,
  listContractLines,
  saveContractChange,
  batchSaveContractChange,
  approveContractChange,
  cancelContractChange,
  customerConfirmContractChange
}
