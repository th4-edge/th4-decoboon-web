export interface MaterialSelectionItem {
  itemId: string
  projectId: string
  projectNo?: string
  projectName?: string
  propertyId: string
  propertyAddress?: string
  designerName?: string
  contractId?: string
  contractNo?: string
  spaceName?: string
  category?: string
  materialName: string
  brand?: string
  spec?: string
  unit?: string
  quantity: number
  required: boolean
  selectionId?: string
  version?: number
  status?: string
  statusName?: string
  selectionText?: string
  selectionJson?: string
  attachments?: string[]
  orderStatus?: string
  orderStatusName?: string
  nextAction?: string
}

export interface SelectionSnapshot {
  color?: string
  spec?: string
  brand?: string
  process?: string
  remark?: string
}

/** 项目交付·主材选材队列项：当前员工数据范围内尚未完成逐项选材的在跑项目。 */
export interface SelectionBoardItem {
  projectId: string
  projectNo?: string
  projectName: string
  projectStatus?: string
  projectStatusName?: string
  propertyId: string
  propertyAddress?: string
  community?: string
  area?: number
  designerName?: string
  selectionId?: string
  selectionStatus?: string
  selectionStatusName: string
  totalItems: number
  selectedItems: number
  deliveredItems: number
  notSelectedItems: number
  orderedItems: number
  progress: number
  version?: number
  updatedAt?: number
  nextAction?: string
}

/* ------------------------------------------------------------------ *
 * 主材下单作业单与采购结算（SOL-014 / BR-044 / BR-045 / DEC-072 / DEC-073 / DEC-074）
 * ------------------------------------------------------------------ */

export type MaterialSheetStatus =
  | 'draft' | 'measuring' | 'measured' | 'submitted' | 'pricing'
  | 'ordered' | 'partiallyOrdered' | 'partiallyArrived' | 'arrived'
  | 'settled' | 'closed' | 'cancelled'

/** 价格状态：未定价与部分结算都表示「成本待结算」，利润必须为 null。 */
export type SheetPriceState = 'priced' | 'unpriced' | 'settled' | 'mixed'

export interface MaterialOrderSheetItem {
  id: string
  materialPlanId: string
  spaceName?: string
  locationName?: string
  materialName?: string
  brand?: string
  model?: string
  spec?: string
  color?: string
  size?: string
  quantity: number
  unit: string
  lossRate?: number
  lossQuantity?: number
  standardIncluded?: boolean
  orderedQuantity?: number
  priceState?: SheetPriceState
  remark?: string
}

export interface MaterialOrderSheet {
  id: string
  no: string
  sheetType: string
  projectId?: string
  projectName?: string
  propertyAddress?: string
  manufacturerName?: string
  supplierId?: string
  supplierName?: string
  measureAt?: string
  deliverAt?: string
  installAt?: string
  status: MaterialSheetStatus
  statusName?: string
  priceState?: SheetPriceState
  remark?: string
  items: MaterialOrderSheetItem[]
}

export type SettlementScope = 'perPurchaseOrder' | 'monthly'
export type SettlementStatus = 'confirmed' | 'cancelled'

/** 结算预演行：已结算明细不会出现（互斥 + 月结兜底）。 */
export interface SettlementPreviewRow {
  purchaseItemId: string
  purchaseOrderId?: string
  purchaseNo?: string
  supplierId?: string
  supplierName?: string
  materialName?: string
  quantity: number
  receivedQuantity: number
  purchasePrice: number
  /** 未定价明细为空，需人工填结算价 */
  suggestedSettlementPrice?: number | null
  unpriced: boolean
}

export interface MaterialSettlement {
  id: string
  no: string
  scope: SettlementScope
  period?: string
  supplierId?: string
  supplierName?: string
  settledAt?: string
  totalAmount: number
  status: SettlementStatus
  statusName?: string
  remark?: string
  cancelledAt?: string
  cancelReason?: string
  items: Array<{ id: string; quantity: number; settlementPrice: number; amount: number; remark?: string }>
}

/* ------------------------------------------------------------------ *
 * 材料业务助手上下文入口（B7 / REQ-MAT-016）
 * ------------------------------------------------------------------ */

export type MaterialAssistantAnswerType =
  | 'EXPLANATION' | 'LIVE_DATA' | 'PERMISSION_DENIED' | 'REFUSAL' | 'NO_EVIDENCE'

export interface MaterialAssistantCitation {
  type: string
  id: string
  label?: string
  detail?: string
}

export interface MaterialAssistantToolCall {
  name: string
  provider: string
  status?: string
  scope?: string
  readOnly: boolean
}

export interface MaterialAssistantAnswer {
  question: string
  intent: string
  answerType: MaterialAssistantAnswerType
  answer: string
  confidence: number
  readOnly: boolean
  citations: MaterialAssistantCitation[]
  toolCalls: MaterialAssistantToolCall[]
  nextActions: string[]
  suggestedQuestions: string[]
  auditId?: number
  auditStatus?: string
}

export interface MaterialAssistantSuggestions {
  contextType: string
  suggestions: string[]
  readOnly: boolean
}
