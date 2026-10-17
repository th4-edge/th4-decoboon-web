import { post } from '@/core/http'
import type { MaterialSelectionItem, SelectionBoardItem } from './model'

type RawRecord = Record<string, unknown>

const UNIT_NAMES: Record<string, string> = {
  Area: '㎡',
  Count: '个',
  Item: '项',
  Place: '处',
  Set: '套',
  House: '户',
  Metre: 'm',
  Centimeter: 'cm',
  Step: '步',
  Plate: '樘',
  Block: '块',
  Root: '根',
  Hole: '扇',
  Pcs: '台',
  Stick: '支',
  Grid: '格',
  Sheet: '片'
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

function unitName(raw: unknown): string {
  const value = enumValue(raw)
  return (UNIT_NAMES[value] ?? value) || ''
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

function normalizeItem(raw: RawRecord): MaterialSelectionItem {
  return {
    itemId: str(raw.itemId ?? raw.id),
    projectId: str(raw.projectId),
    projectNo: str(raw.projectNo) || undefined,
    projectName: str(raw.projectName) || undefined,
    propertyId: str(raw.propertyId),
    propertyAddress: str(raw.propertyAddress) || undefined,
    designerName: str(raw.designerName) || undefined,
    contractId: str(raw.contractId) || undefined,
    contractNo: str(raw.contractNo) || undefined,
    spaceName: str(raw.spaceName) || undefined,
    category: str(raw.category) || undefined,
    materialName: str(raw.materialName),
    brand: str(raw.brand) || undefined,
    spec: str(raw.spec) || undefined,
    unit: (UNIT_NAMES[enumValue(raw.unit)] ?? str(raw.unit)) || undefined,
    quantity: num(raw.quantity),
    required: raw.required !== false,
    selectionId: str(raw.selectionId) || undefined,
    version: raw.version === undefined ? undefined : num(raw.version),
    status: enumValue(raw.status) || undefined,
    statusName: str(raw.statusName) || undefined,
    selectionText: str(raw.selectionText) || undefined,
    selectionJson: str(raw.selectionJson) || undefined,
    attachments: Array.isArray(raw.attachments) ? raw.attachments.map((v) => str(v)).filter(Boolean) : [],
    orderStatus: enumValue(raw.orderStatus) || undefined,
    orderStatusName: str(raw.orderStatusName) || undefined,
    nextAction: str(raw.nextAction) || undefined
  }
}

function normalizeBoardItem(raw: RawRecord): SelectionBoardItem {
  return {
    projectId: str(raw.projectId),
    projectNo: str(raw.projectNo) || undefined,
    projectName: str(raw.projectName) || '项目待命名',
    projectStatus: enumValue(raw.projectStatus) || undefined,
    projectStatusName: str(raw.projectStatusName) || undefined,
    propertyId: str(raw.propertyId),
    propertyAddress: str(raw.propertyAddress) || undefined,
    community: str(raw.community) || undefined,
    area: raw.area === undefined || raw.area === null ? undefined : num(raw.area),
    designerName: str(raw.designerName) || undefined,
    selectionId: str(raw.selectionId) || undefined,
    selectionStatus: enumValue(raw.selectionStatus) || undefined,
    selectionStatusName: str(raw.selectionStatusName) || '未发起',
    totalItems: num(raw.totalItems),
    selectedItems: num(raw.selectedItems),
    deliveredItems: num(raw.deliveredItems),
    notSelectedItems: num(raw.notSelectedItems),
    orderedItems: num(raw.orderedItems),
    progress: num(raw.progress),
    version: raw.version === undefined || raw.version === null ? undefined : num(raw.version),
    updatedAt: raw.updatedAt === undefined || raw.updatedAt === null ? undefined : num(raw.updatedAt),
    nextAction: str(raw.nextAction) || undefined
  }
}

/**
 * 项目交付·主材选材队列。
 *
 * <p>只消费既有 Provider，不在前端逐项目拼装或绕过数据权限。</p>
 */
export async function listSelectionBoard(): Promise<SelectionBoardItem[]> {
  const raw = await post<unknown>('material/selection/board', {})
  return pageRows(raw).map(normalizeBoardItem)
}

export async function listSelectionItems(projectId: string): Promise<MaterialSelectionItem[]> {
  const raw = await post<unknown>('material/selection/item/page', { projectId })
  return pageRows(raw).map(normalizeItem)
}

export interface SaveSelectionInput {
  propertyId: string
  projectId: string
  contractId?: string
  contractLineId: string
  title?: string
  content: string
  selectionJson?: string
  /** 是否同时交付财务下单。 */
  deliver?: boolean
}

export async function saveSelection(input: SaveSelectionInput): Promise<MaterialSelectionItem> {
  const raw = await post<unknown>('material/selection/save', {
    ...input,
    deliver: input.deliver === true
  })
  return normalizeItem(recordOf(raw))
}

export const materialApi = { listSelectionBoard, listSelectionItems, saveSelection }

/* ------------------------------------------------------------------ *
 * 主材下单作业单与采购结算 API（材料员与财务为同一角色，DEC-074）
 * ------------------------------------------------------------------ */

const SHEET_STATUS: Record<string, import('./model').MaterialSheetStatus> = {
  Draft: 'draft', Measuring: 'measuring', Measured: 'measured', Submitted: 'submitted', Pricing: 'pricing',
  Ordered: 'ordered', PartiallyOrdered: 'partiallyOrdered', PartiallyArrived: 'partiallyArrived', Arrived: 'arrived',
  Settled: 'settled', Closed: 'closed', Cancelled: 'cancelled'
}

const SHEET_PRICE_STATE: Record<string, import('./model').SheetPriceState> = {
  Priced: 'priced', Unpriced: 'unpriced', Settled: 'settled', Mixed: 'mixed'
}

const SETTLEMENT_SCOPE: Record<string, import('./model').SettlementScope> = {
  PerPurchaseOrder: 'perPurchaseOrder', Monthly: 'monthly'
}

const SETTLEMENT_STATUS: Record<string, import('./model').SettlementStatus> = {
  Confirmed: 'confirmed', Cancelled: 'cancelled'
}

function normalizeSheetItem(raw: RawRecord): import('./model').MaterialOrderSheetItem {
  const plan = recordOf(raw.materialPlan)
  const catalog = recordOf(plan.catalogItem)
  return {
    id: str(raw.itemId ?? raw.id),
    materialPlanId: str(raw.materialPlanId ?? plan.planId),
    spaceName: str(raw.spaceName) || undefined,
    locationName: str(raw.locationName) || undefined,
    materialName: str(raw.materialName) || str(catalog.name) || str(plan.name) || undefined,
    brand: str(raw.brand) || str(plan.selectedBrand) || undefined,
    model: str(raw.model) || str(plan.selectedModel) || undefined,
    spec: str(raw.spec) || str(plan.selectedSpec) || undefined,
    color: str(raw.color) || undefined,
    size: str(raw.size) || undefined,
    quantity: num(raw.quantity),
    unit: unitName(raw.unit),
    lossRate: raw.lossRate == null ? undefined : num(raw.lossRate),
    lossQuantity: raw.lossQuantity == null ? undefined : num(raw.lossQuantity),
    standardIncluded: raw.standardIncluded === true,
    orderedQuantity: num(raw.orderedQuantity),
    priceState: SHEET_PRICE_STATE[enumValue(raw.priceState)] || undefined,
    remark: str(raw.remark) || undefined
  }
}

function normalizeSheet(raw: RawRecord): import('./model').MaterialOrderSheet {
  const project = recordOf(raw.project)
  const property = recordOf(raw.property)
  const supplier = recordOf(raw.supplier)
  return {
    id: str(raw.sheetId ?? raw.id),
    no: str(raw.sheetNo ?? raw.no),
    sheetType: str(raw.sheetType),
    projectId: str(project.projectId ?? raw.projectId) || undefined,
    projectName: str(project.name) || undefined,
    propertyAddress: str(property.address) || undefined,
    manufacturerName: str(raw.manufacturerName) || undefined,
    supplierId: str(supplier.partnerId ?? raw.supplierId) || undefined,
    supplierName: str(supplier.name ?? raw.supplierName) || undefined,
    measureAt: str(raw.measureAt) || undefined,
    deliverAt: str(raw.deliverAt) || undefined,
    installAt: str(raw.installAt) || undefined,
    status: SHEET_STATUS[enumValue(raw.status)] || 'draft',
    statusName: str(recordOf(raw.status).name) || undefined,
    priceState: SHEET_PRICE_STATE[enumValue(raw.priceState)] || undefined,
    remark: str(raw.remark) || undefined,
    items: Array.isArray(raw.items) ? (raw.items as RawRecord[]).map(normalizeSheetItem) : []
  }
}

function normalizeSettlement(raw: RawRecord): import('./model').MaterialSettlement {
  const supplier = recordOf(raw.supplier)
  return {
    id: str(raw.settlementId ?? raw.id),
    no: str(raw.no),
    scope: SETTLEMENT_SCOPE[enumValue(raw.scope)] || 'perPurchaseOrder',
    period: str(raw.period) || undefined,
    supplierId: str(supplier.partnerId) || undefined,
    supplierName: str(supplier.name) || undefined,
    settledAt: str(raw.settledAt) || undefined,
    totalAmount: num(raw.totalAmount),
    status: SETTLEMENT_STATUS[enumValue(raw.status)] || 'confirmed',
    statusName: str(recordOf(raw.status).name) || undefined,
    remark: str(raw.remark) || undefined,
    cancelledAt: str(raw.cancelledAt) || undefined,
    cancelReason: str(raw.cancelReason) || undefined,
    items: Array.isArray(raw.items)
      ? (raw.items as RawRecord[]).map((item) => ({
          id: str(item.settlementItemId ?? item.id),
          quantity: num(item.quantity),
          settlementPrice: num(item.settlementPrice),
          amount: num(item.amount),
          remark: str(item.remark) || undefined
        }))
      : []
  }
}

function normalizePreviewRow(raw: RawRecord): import('./model').SettlementPreviewRow {
  return {
    purchaseItemId: str(raw.purchaseItemId),
    purchaseOrderId: str(raw.purchaseOrderId) || undefined,
    purchaseNo: str(raw.purchaseNo) || undefined,
    supplierId: str(raw.supplierId) || undefined,
    supplierName: str(raw.supplierName) || undefined,
    materialName: str(raw.materialName) || undefined,
    quantity: num(raw.quantity),
    receivedQuantity: num(raw.receivedQuantity),
    purchasePrice: num(raw.purchasePrice),
    suggestedSettlementPrice: raw.suggestedSettlementPrice == null ? null : num(raw.suggestedSettlementPrice),
    unpriced: raw.unpriced === true
  }
}

/** 作业单枚举：品类来自平台行业基线，前端不硬编码。 */
export async function loadSheetEnums(): Promise<{
  sheetTypes: Array<{ code: string; name: string }>
  statuses: Array<{ value: string; name: string }>
  units: Array<{ value: string; name: string }>
}> {
  const raw = recordOf(await post<unknown>('material/sheet/enums', {}))
  return {
    sheetTypes: (Array.isArray(raw.sheetTypes) ? raw.sheetTypes as RawRecord[] : [])
      .map((item) => ({ code: str(item.code), name: str(item.name) })),
    statuses: (Array.isArray(raw.statuses) ? raw.statuses as RawRecord[] : [])
      .map((item) => ({ value: str(item.value), name: str(item.name) })),
    units: (Array.isArray(raw.units) ? raw.units as RawRecord[] : [])
      .map((item) => ({ value: str(item.value), name: str(item.name) }))
  }
}

export const materialSheetApi = {
  list: async (query: { projectId?: string; sheetType?: string; status?: import('./model').MaterialSheetStatus } = {}) => {
    const raw = await post<unknown>('material/sheet/page', query)
    return (Array.isArray(raw) ? raw as RawRecord[] : []).map(normalizeSheet)
  },
  info: async (sheetId: string) => normalizeSheet(recordOf(await post<unknown>('material/sheet/info', { sheetId }))),
  submit: async (sheetId: string) => normalizeSheet(recordOf(await post<unknown>('material/sheet/submit', { sheetId }))),
  /** 下单：单价可空＝未定价（形成暂估应付，成本保持不完整）。 */
  order: async (input: {
    sheetId: string
    supplierId?: string
    supplierName?: string
    deliveryMode?: 'Direct' | 'Warehouse'
    expectedAt?: string
    remark?: string
    items: Array<{ itemId: string; quantity?: number; purchasePrice?: number | null }>
  }) => normalizeSheet(recordOf(await post<unknown>('material/sheet/order', input)))
}

export const materialSettlementApi = {
  list: async (supplierId?: string) => {
    const raw = await post<unknown>('material/settlement/page', { supplierId })
    return (Array.isArray(raw) ? raw as RawRecord[] : []).map(normalizeSettlement)
  },
  info: async (settlementId: string) =>
    normalizeSettlement(recordOf(await post<unknown>('material/settlement/info', { settlementId }))),
  /** 预演：不传 scope 时返回企业全部可结算明细（财务工作台口径）。 */
  preview: async (query: { supplierId?: string; scope?: 'PerPurchaseOrder' | 'Monthly'; period?: string; purchaseOrderId?: string; projectId?: string }) => {
    const raw = await post<unknown>('material/settlement/preview', query)
    return (Array.isArray(raw) ? raw as RawRecord[] : []).map(normalizePreviewRow)
  },
  confirm: async (input: {
    supplierId: string
    scope?: 'PerPurchaseOrder' | 'Monthly'
    period?: string
    remark?: string
    items: Array<{ purchaseItemId: string; quantity?: number; settlementPrice: number }>
  }) => normalizeSettlement(recordOf(await post<unknown>('material/settlement/confirm', {
    ...input,
    items: input.items.map((item) => ({ purchaseItem: { purchaseItemId: item.purchaseItemId }, quantity: item.quantity, settlementPrice: item.settlementPrice }))
  }))),
  /** 撤销结算（纠错）：结算头留痕，采购/应付/成本冲回未结算状态。 */
  cancel: async (input: { settlementId: string; reason?: string }) =>
    normalizeSettlement(recordOf(await post<unknown>('material/settlement/cancel', input)))
}

/* ------------------------------------------------------------------ *
 * 材料业务助手上下文入口（B7 / REQ-MAT-016）
 * ------------------------------------------------------------------ */

export interface MaterialAssistantAskInput {
  question: string
  projectId?: string
  sheetId?: string
  requestId?: string
  idempotencyKey?: string
}

function stringList(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map((value) => str(value)).filter(Boolean) : []
}

function normalizeAssistant(raw: RawRecord): import('./model').MaterialAssistantAnswer {
  return {
    question: str(raw.question),
    intent: str(raw.intent),
    answerType: (str(raw.answerType) || 'NO_EVIDENCE') as import('./model').MaterialAssistantAnswerType,
    answer: str(raw.answer),
    confidence: num(raw.confidence),
    readOnly: raw.readOnly !== false,
    citations: (Array.isArray(raw.citations) ? raw.citations as RawRecord[] : []).map((item) => ({
      type: str(item.type),
      id: str(item.id),
      label: str(item.label) || undefined,
      detail: str(item.detail) || undefined
    })),
    toolCalls: (Array.isArray(raw.toolCalls) ? raw.toolCalls as RawRecord[] : []).map((item) => ({
      name: str(item.name),
      provider: str(item.provider),
      status: str(item.status) || undefined,
      scope: str(item.scope) || undefined,
      readOnly: item.readOnly !== false
    })),
    nextActions: stringList(raw.nextActions),
    suggestedQuestions: stringList(raw.suggestedQuestions),
    auditId: raw.auditId === undefined || raw.auditId === null ? undefined : num(raw.auditId),
    auditStatus: str(raw.auditStatus) || undefined
  }
}

/** 单轮材料业务助手问答：只读，不执行审批/付款/删除/权限变更。 */
export async function askMaterialAssistant(input: MaterialAssistantAskInput): Promise<import('./model').MaterialAssistantAnswer> {
  return normalizeAssistant(recordOf(await post<unknown>('material/assistant/ask', input)))
}

/** 初始建议问题：服务端从同一黄金问题知识源按上下文类型挑选。 */
export async function loadMaterialAssistantSuggestions(query: {
  projectId?: string
  sheetId?: string
  contextType?: 'project' | 'sheet' | 'purchase' | 'settlement' | 'general'
} = {}): Promise<import('./model').MaterialAssistantSuggestions> {
  const raw = recordOf(await post<unknown>('material/assistant/suggestions', query))
  return {
    contextType: str(raw.contextType) || 'general',
    suggestions: stringList(raw.suggestions),
    readOnly: raw.readOnly !== false
  }
}

export const materialAssistantApi = {
  ask: askMaterialAssistant,
  suggestions: loadMaterialAssistantSuggestions
}
