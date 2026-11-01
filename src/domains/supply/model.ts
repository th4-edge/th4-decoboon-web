export type SupplierPartnerType = 'supplier' | 'factory' | 'laborTeam' | 'installer' | 'logistics' | 'service'
export type SupplierPartnerStatus = 'active' | 'disabled'
export type SettlementMode = 'ReceiptDays' | 'MonthlyCutoff'

export interface SupplierPartner {
  id: string
  type: SupplierPartnerType
  name: string
  contactName?: string
  telNo?: string
  taxNo?: string
  addr?: string
  brands: string[]
  paymentCodeImages: string[]
  paymentCodeImageUrls?: string[]
  settlementTerms?: string
  settlementMode?: SettlementMode
  settlementDays?: number
  cutoffDay?: number
  bankName?: string
  bankAccount?: string
  remark?: string
  status: SupplierPartnerStatus
  payableAmount: number
  paidAmount: number
  outstandingAmount: number
  createdAt?: string
}

export interface SupplierPartnerPage {
  list: SupplierPartner[]
  total: number
  current: number
  size: number
  hasMore: boolean
}
