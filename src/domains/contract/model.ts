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
  conclusion?: string
  approvedAt?: string
  customerConfirmed: boolean
  customerConfirmedAt?: string
  evidenceImages: string[]
  signatureUrl?: string
  createdAt?: string
}
