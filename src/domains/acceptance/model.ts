export type AcceptanceStatus = 'pending' | 'confirmed' | 'rejected'
export type RectificationType = 'construction' | 'design'

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

/** 项目交付·整改跟进：仅返回当前处于驳回（整改中）的阶段验收。 */
export interface RectifyItem {
  acceptanceId: string
  projectId: string
  projectNo?: string
  projectName?: string
  stageId: string
  stageName?: string
  roundNo: number
  conclusion?: string
  issues: string[]
  rectificationOwnerName?: string
  rectificationType?: RectificationType
  rectificationTypeName?: string
  rectificationIssueImageCount: number
  rectificationDueDate?: string
  overdueDays: number
  confirmedAt?: string
  nextAction?: string
}
