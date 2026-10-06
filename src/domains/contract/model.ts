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

export interface Contract {
  id: string
  no: string
  status: ContractStatus
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
