export type AcceptanceStatus = 'pending' | 'confirmed' | 'rejected'

export interface Acceptance {
  id: string
  projectId: string
  stageId: string
  stageName?: string
  submitByName?: string
  status: AcceptanceStatus
  result: string
  content?: string
  issues: string[]
  images: string[]
  confirmedByName?: string
  confirmedAt?: string
  createdAt?: string
}

export interface AcceptanceRound {
  id: string
  acceptanceId: string
  roundNo: number
  result: string
  conclusion?: string
  issues: string[]
  rectificationNote?: string
  rectificationOwnerName?: string
  rectificationDueDate?: string
  submittedByName?: string
  confirmedByName?: string
  submittedAt?: string
  confirmedAt?: string
}
