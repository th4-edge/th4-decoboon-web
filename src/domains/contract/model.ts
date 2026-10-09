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

export interface Contract {
  id: string
  no: string
  status: ContractStatus
  businessStateView?: BusinessStateView
  currentAmount: number
  signedAmount?: number
  signedAt?: string
  effectiveAt?: string
  startDate?: string
  planEndDate?: string
  paymentTerms?: string
  quoteId?: string
  projectId?: string
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
