import type { BusinessStateView } from '@/domains/business-state/model'
export type ProjectBusinessOrigin = 'new' | 'carryover'

export type ProjectStatus = 'preparing' | 'ongoing' | 'suspended' | 'accepting' | 'finished' | 'settled'
export type StageStatus = 'todo' | 'doing' | 'accepting' | 'done' | 'cancelled'

export interface ProjectBrief {
  id: string
  no: string
  name: string
  status: ProjectStatus
  businessStateView?: BusinessStateView
  progress: number
  currentStageName?: string
  quoteId?: string
  customerId?: string
  customerName?: string
  designerId?: string
  managerId?: string
  designerName?: string
  managerName?: string
  businessOrigin?: ProjectBusinessOrigin
  propertyId?: string
  propertyName?: string
  community?: string
  address?: string
  area: number
  contractAmount: number
  /** 只读回款投影：应收工程款合计，来源于应收计划。 */
  receivableAmount?: number
  /** 只读回款投影：已收工程款，来源于应收计划。 */
  receivedAmount?: number
  startDate?: string
  /** 合同基准完工日（DEC-048 锁定） */
  planEndDate?: string
  /** 排期驱动的动态预计完工日 */
  expectedEndDate?: string
  createdAt?: string
}

export interface ProjectStage {
  id: string
  projectId: string
  name: string
  sort: number
  weight: number
  status: StageStatus
  progress: number
  plannedStart?: string
  plannedEnd?: string
  actualStart?: string
  actualEnd?: string
}

export interface ProjectTask {
  id: string
  projectId: string
  stageId: string
  name: string
  status: string
  quantity: number
  unit?: string
  progress: number
  ownerName?: string
  plannedStart?: string
  plannedEnd?: string
}

export interface SiteReport {
  id: string
  projectId: string
  stageId?: string
  title: string
  content: string
  reportAt?: string
  authorName?: string
  images?: string[]
  mediaUnavailable?: boolean
}

export interface AcceptanceBrief {
  id: string
  projectId: string
  stageId: string
  status: string
  result: string
  content?: string
  issues: string[]
  evidenceUrls?: string[]
  mediaUnavailable?: boolean
  createdAt?: string
  confirmedAt?: string
}
