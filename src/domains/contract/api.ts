import { post } from '@/core/http'
import { normalizeBusinessStateView } from '@/domains/business-state/api'
import { fileApi } from '@/domains/file/api'
import type { Contract, ContractChange, ContractChangeItem, ContractChangeStatus, ContractChangeType, ContractConstructionPlan, ContractFactNode, ContractFactTrace, ContractLine, ContractLinePage, ContractPaymentPlan, ContractStatus, ContractWorkbench } from './model'
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

/**
 * 业务时间入参统一转为 ISO（`YYYY-MM-DDTHH:mm:ss`）。
 *
 * 表单控件（DateClockField）对外是 `YYYY-MM-DD HH:mm:ss`，服务端 `LocalDateTime` 只接受 ISO 分隔符，
 * 直接提交会报「Failed to convert from type [String] to type [LocalDateTime]」。与
 * `domains/property/api.ts`、`domains/crm/api.ts` 保持同一口径。
 */
function isoDateTime(value?: string): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  return trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
}

function enumValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const record = raw as RawRecord
    return str(record.value ?? record.key ?? record.name)
  }
  return ''
}

function enumLabel(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const record = raw as RawRecord
    return str(record.name ?? record.label ?? record.value ?? record.key)
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

function normalizePaymentPlan(raw: unknown): ContractPaymentPlan | undefined {
  const record = recordOf(raw)
  if (!record.planId) return undefined
  return {
    id: str(record.planId),
    name: str(record.name),
    totalAmount: num(record.totalAmount),
    status: str(record.status) || undefined,
    nodes: Array.isArray(record.nodes) ? record.nodes.map((node) => {
      const value = recordOf(node)
      return {
        id: str(value.nodeId),
        code: str(value.code) || undefined,
        name: str(value.name),
        ratio: value.ratio == null ? undefined : num(value.ratio),
        amount: num(value.amount),
        dueDate: str(value.dueDate) || undefined,
        type: str(value.type) || undefined,
        triggerStageName: str(value.triggerStageName) || undefined
      }
    }) : []
  }
}

function normalizeConstructionPlan(raw: unknown): ContractConstructionPlan | undefined {
  const record = recordOf(raw)
  if (!record.planId) return undefined
  return {
    id: str(record.planId),
    name: str(record.name),
    startDate: str(record.startDate) || undefined,
    endDate: str(record.endDate) || undefined,
    status: str(record.status) || undefined,
    stages: Array.isArray(record.stages) ? record.stages.map((stage) => {
      const value = recordOf(stage)
      return {
        id: str(value.stageId),
        code: str(value.code) || undefined,
        name: str(value.name),
        sort: Number(value.sort ?? 0),
        plannedStart: str(value.plannedStart) || undefined,
        plannedEnd: str(value.plannedEnd) || undefined,
        acceptanceMode: enumLabel(value.acceptanceMode) || undefined,
        description: str(value.description) || undefined
      }
    }) : []
  }
}

function normalizeContract(raw: RawRecord): Contract {
  const quote = recordOf(raw.quote)
  const project = recordOf(raw.project)
  const customer = recordOf(raw.customer ?? project.customer)
  const property = recordOf(raw.property ?? project.property)
  const createdBy = recordOf(raw.createdBy ?? project.createdBy)
  return {
    id: str(raw.contractId ?? raw.id),
    no: str(raw.no),
    status: CONTRACT_STATUS[enumValue(raw.status)] ?? 'draft',
    businessStateView: normalizeBusinessStateView(raw.businessStateView),
    baselineAmount: raw.baselineAmount == null ? undefined : num(raw.baselineAmount),
    currentAmount: num(raw.currentAmount ?? raw.amount ?? raw.signedAmount),
    signedAmount: raw.signedAmount === undefined ? undefined : num(raw.signedAmount),
    signedAt: str(raw.signedAt) || undefined,
    effectiveAt: str(raw.effectiveAt) || undefined,
    startDate: str(raw.startDate) || undefined,
    planEndDate: str(raw.planEndDate) || undefined,
    paymentTerms: str(raw.paymentTerms) || undefined,
    quoteId: str(quote.quoteId ?? quote.id ?? raw.quoteId) || undefined,
    quoteNo: str(quote.no) || undefined,
    customerId: str(customer.custId ?? customer.id) || undefined,
    customerName: str(customer.name) || undefined,
    customerTelNo: str(customer.telNo) || undefined,
    propertyId: str(property.propertyId ?? property.id) || undefined,
    propertyCommunity: str(property.community) || undefined,
    propertyAddress: str(property.address) || undefined,
    projectId: str(project.projectId ?? project.id ?? raw.projectId) || undefined,
    projectNo: str(project.no) || undefined,
    projectName: str(project.name) || undefined,
    createdByName: str(createdBy.name) || undefined,
    paymentPlan: normalizePaymentPlan(raw.paymentPlan),
    constructionPlan: normalizeConstructionPlan(raw.constructionPlan),
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

function normalizeFact(raw: RawRecord): ContractFactNode {
  return {
    nodeId: str(raw.nodeId),
    nodeKey: str(raw.nodeKey),
    stage: enumValue(raw.stage) || undefined,
    factType: enumValue(raw.factType) || undefined,
    objectType: str(raw.objectType) || undefined,
    objectId: str(raw.objectId) || undefined,
    projectId: str(raw.projectId) || undefined,
    version: raw.version === undefined || raw.version === null ? undefined : num(raw.version),
    current: raw.current !== false,
    status: enumValue(raw.status) || undefined,
    statusName: str(raw.statusName) || undefined,
    businessTime: str(raw.businessTime) || undefined,
    recordedAt: str(raw.recordedAt) || undefined,
    actorName: str(raw.actorName) || undefined,
    title: str(raw.title) || undefined,
    summary: str(raw.summary) || undefined,
    sourceLabel: str(raw.sourceLabel) || undefined,
    amount: raw.amount === undefined || raw.amount === null ? undefined : num(raw.amount),
    costComplete: raw.costComplete === undefined || raw.costComplete === null ? undefined : raw.costComplete === true,
    uncertainty: str(raw.uncertainty) || undefined,
    navigationPath: str(raw.navigationPath) || undefined,
    returnPath: str(raw.returnPath) || undefined,
    returnAnchor: str(raw.returnAnchor) || undefined
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

export async function contractFactTrace(contractId: string): Promise<ContractFactTrace> {
  const raw = recordOf(await post<unknown>('project/contract/workbench', { contractId }))
  return {
    upstreamFacts: Array.isArray(raw.upstreamFacts) ? raw.upstreamFacts.map((item) => normalizeFact(recordOf(item))) : [],
    downstreamFacts: Array.isArray(raw.downstreamFacts) ? raw.downstreamFacts.map((item) => normalizeFact(recordOf(item))) : [],
    sourceGaps: Array.isArray(raw.sourceGaps) ? raw.sourceGaps.map(str).filter(Boolean) : []
  }
}

/** 合同履约档案服务端汇总：合同行、变更和合同事实共用同一数据范围。 */
export async function contractWorkbench(projectId: string): Promise<ContractWorkbench> {
  const raw = recordOf(await post<unknown>('project/contract/workbench', { projectId }))
  const change = recordOf(raw.change)
  return {
    contract: normalizeContract(recordOf(raw.contract)),
    lineCount: num(raw.lineCount),
    lineAmount: num(raw.lineAmount),
    change: {
      totalCount: num(change.totalCount),
      pendingCount: num(change.pendingCount),
      approvedCount: num(change.approvedCount),
      confirmedCount: num(change.confirmedCount),
      closedCount: num(change.closedCount),
      confirmedAmount: num(change.confirmedAmount)
    }
  }
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

/** 合同确认签约 / 确认生效的接口状态值（与后端 ContractStatus 枚举一致）。 */
const CONTRACT_STATUS_API: Record<'signed' | 'effective', string> = {
  signed: 'Signed',
  effective: 'Effective'
}

export interface SignContractInput {
  contractId: string
  /** 最终签约价格：由企业负责人 / 店长确认签约时填写，后端强制要求大于 0。 */
  signedAmount: number
  signedAt?: string
  startDate?: string
  planEndDate?: string
  paymentTerms?: string
}

/**
 * 企业负责人 / 店长确认签约（Draft / PendingSign → Signed）。
 * 设计师只发起合同、不携带签署价格；确认签约由企业负责人或店长完成（后续由 `effectuateContract` 确认生效）。
 */
export async function signContract(input: SignContractInput): Promise<Contract> {
  const raw = await post<unknown>('project/contract/update', {
    contractId: input.contractId,
    status: CONTRACT_STATUS_API.signed,
    signedAmount: input.signedAmount,
    signedAt: input.signedAt,
    startDate: input.startDate,
    planEndDate: input.planEndDate,
    paymentTerms: input.paymentTerms
  })
  return normalizeContract(recordOf(raw))
}

/** 企业负责人 / 店长确认生效（Signed → Effective）；生效后建立唯一项目，由项目经理承接。 */
export async function effectuateContract(contractId: string): Promise<Contract> {
  const raw = await post<unknown>('project/contract/update', {
    contractId,
    status: CONTRACT_STATUS_API.effective
  })
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
    customerConfirmedAt: isoDateTime(input.customerConfirmedAt),
    customerConfirmedBy: input.customerConfirmedBy,
    customerConfirmMethod: input.customerConfirmMethod
  })
  return normalizeChange(recordOf(raw))
}

function normalizeContractLine(row: RawRecord): ContractLine {
  return {
    id: str(row.lineId ?? row.id),
    contractId: str(row.contractId ?? recordOf(row.contract).contractId) || undefined,
    // type/unit 是枚举对象（{name,value,key}），必须取 value，不能用 str() 得到 "[object Object]"。
    type: enumValue(row.type) || undefined,
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
    cost: row.cost == null ? undefined : num(row.cost),
    formula: str(row.formula) || undefined,
    role: str(row.role) || undefined,
    spaceName: str(row.spaceName) || undefined,
    sort: Number(row.sort ?? 0)
  }
}

/** 合同基线行真实数据库分页：默认 20 条，前端与服务端同时钳制为最多 50 条。 */
export async function listContractLines(
  contractId: string,
  current = 1,
  size = 20
): Promise<ContractLinePage> {
  const safeCurrent = Math.max(1, Math.trunc(current))
  const safeSize = Math.min(50, Math.max(1, Math.trunc(size)))
  const raw = await post<unknown>('project/contract-line/page', {
    contractId,
    current: safeCurrent,
    size: safeSize
  })
  const record = recordOf(raw)
  const list = pageRows(raw).map(normalizeContractLine)
  return {
    list,
    current: safeCurrent,
    size: safeSize,
    total: num(record.totalElements ?? record.total ?? list.length)
  }
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

/** 增减项可变更来源（DEC-055/BR-041）：当前有效剩余 / 待审批占用 / 可变更量由服务端投影。 */
export interface ContractChangeSource {
  group: 'contract' | 'effective'
  sourceLineId?: string
  sourceChangeItemId?: string
  changeId?: string
  changeNo?: string
  name: string
  itemType?: string
  brand?: string
  spec?: string
  /** 区域（房屋区域名；已生效变更目标取来源行区域，无来源时为 undefined） */
  spaceName?: string
  unit?: string
  /** 单位枚举键（供前端 unitLabel() 统一展示，如 Area → ㎡） */
  unitKey?: string
  initialQuantity?: number
  effectiveRemainingQuantity?: number
  pendingReservedQuantity?: number
  availableQuantity?: number
  effectiveRemainingAmount?: number
  currentUnitPrice?: number
  confirmable?: boolean
  blockReason?: string
}

export interface ContractChangeRangeFacet {
  key: string
  label: string
  count: number
}

export interface ContractChangeRange {
  contract?: Contract
  current: number
  size: number
  total: number
  hasMore: boolean
  contractTotal: number
  effectiveTotal: number
  itemTypes: ContractChangeRangeFacet[]
  spaces: ContractChangeRangeFacet[]
  sources: ContractChangeSource[]
  selected?: ContractChangeSource
  confirmable?: boolean
}

export interface PreviewContractChangeInput {
  contractId: string
  type?: ContractChangeType
  items: Array<Record<string, unknown>>
}

function numberOrUndefined(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeSource(raw: Record<string, unknown>): ContractChangeSource {
  return {
    group: String(raw.group ?? 'contract') === 'effective' ? 'effective' : 'contract',
    sourceLineId: raw.sourceLineId == null ? undefined : String(raw.sourceLineId),
    sourceChangeItemId: raw.sourceChangeItemId == null ? undefined : String(raw.sourceChangeItemId),
    changeId: raw.changeId == null ? undefined : String(raw.changeId),
    changeNo: raw.changeNo == null ? undefined : String(raw.changeNo),
    name: String(raw.name ?? ''),
    itemType: raw.itemType == null ? undefined : String(raw.itemType),
    brand: raw.brand == null ? undefined : String(raw.brand),
    spec: raw.spec == null ? undefined : String(raw.spec),
    spaceName: raw.spaceName == null ? undefined : String(raw.spaceName),
    unit: raw.unit == null ? undefined : String(raw.unit),
    unitKey: raw.unitKey == null ? undefined : String(raw.unitKey),
    initialQuantity: numberOrUndefined(raw.initialQuantity),
    effectiveRemainingQuantity: numberOrUndefined(raw.effectiveRemainingQuantity),
    pendingReservedQuantity: numberOrUndefined(raw.pendingReservedQuantity),
    availableQuantity: numberOrUndefined(raw.availableQuantity),
    effectiveRemainingAmount: numberOrUndefined(raw.effectiveRemainingAmount),
    currentUnitPrice: numberOrUndefined(raw.currentUnitPrice),
    confirmable: raw.confirmable === true,
    blockReason: raw.blockReason == null ? undefined : String(raw.blockReason)
  }
}

/**
 * 增减项可变更来源与当前有效剩余（服务端权威投影；仅用于展示与前端预校验，
 * 正式提交与审批时服务端会重新投影，不得把展示值当作提交依据）。
 */
export async function contractChangeRange(input: {
  contractId: string
  sourceLineId?: string
  sourceChangeItemId?: string
  current?: number
  size?: number
  keyword?: string
  itemType?: string
  spaceName?: string
  group?: 'contract' | 'effective'
}): Promise<ContractChangeRange> {
  const current = Math.max(1, Math.trunc(input.current ?? 1))
  const size = Math.min(50, Math.max(1, Math.trunc(input.size ?? 20)))
  const raw = await post<unknown>('project/contract-change/range', {
    contractId: input.contractId,
    sourceLineId: input.sourceLineId,
    sourceChangeItemId: input.sourceChangeItemId,
    current,
    size,
    keyword: input.keyword?.trim() || undefined,
    itemType: input.itemType,
    spaceName: input.spaceName,
    group: input.group
  })
  const record = recordOf(raw)
  const sources = Array.isArray(record.sources) ? record.sources.map((item) => normalizeSource(recordOf(item))) : []
  const facets = (value: unknown): ContractChangeRangeFacet[] =>
    Array.isArray(value) ? value.map((item) => {
      const facet = recordOf(item)
      return { key: str(facet.key), label: str(facet.label), count: num(facet.count) }
    }) : []
  return {
    contract: record.contract ? normalizeContract(recordOf(record.contract)) : undefined,
    current: num(record.current) || current,
    size: num(record.size) || size,
    total: num(record.total),
    hasMore: record.hasMore === true,
    contractTotal: num(record.contractTotal),
    effectiveTotal: num(record.effectiveTotal),
    itemTypes: facets(record.itemTypes),
    spaces: facets(record.spaces),
    sources,
    selected: record.selected ? normalizeSource(recordOf(record.selected)) : undefined,
    confirmable: record.confirmable === true
  }
}

/**
 * 增减项草稿预览：与 batch-save 同源（同一套目标快照 / 当前有效剩余 / 差额口径），不落库。
 * 预览即所得：提交前必须试算通过，失败即阻断提交。
 */
export async function previewContractChange(input: PreviewContractChangeInput): Promise<ContractChange> {
  const raw = await post<unknown>('project/contract-change/preview', {
    contractId: input.contractId,
    type: input.type ? CHANGE_TYPE_API[input.type] : undefined,
    items: input.items.map((item) => ({
      ...item,
      changeType: item.changeType ? CHANGE_TYPE_API[item.changeType as ContractChangeType] : undefined
    }))
  })
  return normalizeChange(recordOf(raw))
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
    customerConfirmedAt: isoDateTime(input.customerConfirmedAt),
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
  contractWorkbench,
  contractByQuote,
  contractByProject,
  saveContract,
  signContract,
  effectuateContract,
  listContractChanges,
  listContractLines,
  saveContractChange,
  batchSaveContractChange,
  approveContractChange,
  cancelContractChange,
  customerConfirmContractChange,
  contractChangeRange,
  previewContractChange
}
