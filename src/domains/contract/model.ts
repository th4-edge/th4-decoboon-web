import type { BusinessStateView } from '@/domains/business-state/model'
import type { Employee } from '@/domains/identity/model'
export type ContractStatus =
  | 'draft'
  | 'pendingSign'
  | 'signed'
  | 'effective'
  | 'changing'
  | 'active'
  | 'changed'
  | 'completed'
  | 'closed'
  | 'settled'
  | 'terminated'
  | 'void'


export interface ContractPaymentNode {
  id: string
  code?: string
  name: string
  ratio?: number
  amount: number
  dueDate?: string
  type?: string
  triggerStageName?: string
}

export interface ContractPaymentPlan {
  id: string
  name: string
  totalAmount: number
  status?: string
  nodes: ContractPaymentNode[]
}

export interface ContractConstructionStage {
  id: string
  code?: string
  name: string
  sort: number
  plannedStart?: string
  plannedEnd?: string
  acceptanceMode?: string
  description?: string
}

export interface ContractConstructionPlan {
  id: string
  name: string
  startDate?: string
  endDate?: string
  status?: string
  stages: ContractConstructionStage[]
}

export interface Contract {
  id: string
  no: string
  status: ContractStatus
  businessStateView?: BusinessStateView
  baselineAmount?: number
  currentAmount: number
  signedAmount?: number
  signedAt?: string
  effectiveAt?: string
  startDate?: string
  planEndDate?: string
  paymentTerms?: string
  quoteId?: string
  quoteNo?: string
  customerId?: string
  customerName?: string
  customerTelNo?: string
  propertyId?: string
  propertyCommunity?: string
  propertyAddress?: string
  projectId?: string
  projectNo?: string
  projectName?: string
  createdByName?: string
  paymentPlan?: ContractPaymentPlan
  constructionPlan?: ContractConstructionPlan
  createdAt?: string
}

export type ContractChangeType = 'add' | 'remove' | 'replace' | 'quantity' | 'price'
export type ContractChangeStatus = 'pending' | 'approved' | 'customerConfirmed' | 'rejected' | 'cancelled'

export interface ContractLine {
  id: string
  contractId?: string
  type?: string
  category?: string
  name: string
  brand?: string
  spec?: string
  unit: string
  quantity: number
  materialPrice?: number
  manualPrice?: number
  pricingMode?: string
  amount: number
  cost?: number
  formula?: string
  role?: string
  spaceName?: string
  sort?: number
}

export interface ContractLinePage {
  list: ContractLine[]
  /** 当前页从 1 开始；服务端 Page 对象未返回页码时由请求参数显式保留。 */
  current: number
  /** 请求页大小（服务端硬上限 50）。 */
  size: number
  total: number
}

export interface ContractChange {
  id: string
  contractId: string
  projectId: string
  no: string
  amount: number
  type: ContractChangeType
  reason: string
  status: ContractChangeStatus
  requestedByName?: string
  approvedByName?: string
  requestedBy?: Employee
  approvedBy?: Employee
  conclusion?: string
  approvedAt?: string
  customerConfirmed: boolean
  customerConfirmedAt?: string
  customerConfirmedBy?: string
  customerConfirmMethod?: string
  evidenceImages: string[]
  signatureUrl?: string
  items?: ContractChangeItem[]
  createdAt?: string
}

export interface ContractChangeItem {
  id: string
  changeType: ContractChangeType
  itemType?: string
  name: string
  sourceLineId?: string
  sourceChangeItemId?: string
  targetCatalogItemId?: string
  reduceQuantity?: number
  oldQuantity: number
  newQuantity: number
  oldPrice: number
  newPrice: number
  amountDelta: number
  costDelta?: number
  remark?: string
  sourceRemainingQuantity?: number
  sourceRemainingAmount?: number
  sourceUnitPrice?: number
  targetName?: string
  targetType?: string
  targetCategory?: string
  targetBrand?: string
  targetSeries?: string
  targetSpec?: string
  targetUnit?: string
  targetQuantity?: number
  targetAmount?: number
  targetCostComplete?: boolean
}

export interface ContractFactNode {
  nodeId: string
  nodeKey: string
  stage?: string
  factType?: string
  objectType?: string
  objectId?: string
  projectId?: string
  version?: number
  current?: boolean
  status?: string
  statusName?: string
  businessTime?: string
  recordedAt?: string
  actorName?: string
  title?: string
  summary?: string
  sourceLabel?: string
  amount?: number
  costComplete?: boolean
  uncertainty?: string
  navigationPath?: string
  returnPath?: string
  returnAnchor?: string
}

export interface ContractFactTrace {
  upstreamFacts: ContractFactNode[]
  downstreamFacts: ContractFactNode[]
  sourceGaps: string[]
}

export interface ContractWorkbenchChange {
  totalCount: number
  pendingCount: number
  approvedCount: number
  confirmedCount: number
  closedCount: number
  confirmedAmount: number
}

export interface ContractWorkbench {
  contract: Contract
  lineCount: number
  lineAmount: number
  change: ContractWorkbenchChange
}
