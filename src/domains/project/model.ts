import type { BusinessStateView } from '@/domains/business-state/model'
export type ProjectBusinessOrigin = 'new' | 'carryover'

export type ProjectStatus = 'preparing' | 'ongoing' | 'suspended' | 'accepting' | 'finished' | 'settled'
export type StageStatus = 'todo' | 'doing' | 'accepting' | 'done' | 'cancelled' | 'notApplicable'
export type StageAcceptanceMode = 'None' | 'ConstructionDone' | 'AcceptanceDone'

export type ProjectFactStage = 'source' | 'preSale' | 'signing' | 'fulfillment' | 'change' | 'acceptance' | 'finance' | 'afterSales'
export type ProjectFactVisibility = 'internal' | 'ownerVisible'

export interface ProjectFactRelation {
  relationType: string
  objectType: string
  objectId: string
  version: number
}

/** 项目 PHASE 事实节点；金额、成本与利润均继承服务端事实，不在前端重算。 */
export interface ProjectFactNode {
  nodeId: string
  nodeKey: string
  stage: ProjectFactStage
  stageName: string
  factType: string
  factTypeName: string
  objectType: string
  objectId: string
  projectId: string
  version: number
  current: boolean
  status?: string
  statusName?: string
  businessTime?: string
  recordedAt?: string
  actorName?: string
  title?: string
  summary?: string
  sourceLabel?: string
  amount?: number | null
  quantity?: number | null
  progress?: number | null
  costComplete?: boolean | null
  profitAmount?: number | null
  grossMargin?: number | null
  uncertainty?: string
  parentNodeId?: string
  relations: ProjectFactRelation[]
  visibility: ProjectFactVisibility
  navigationPath?: string
  returnPath?: string
  returnAnchor?: string
}

export interface ProjectFactSourceGap {
  nodeKey: string
  stage: ProjectFactStage
  stageName: string
  factType: string
  factTypeName: string
  label: string
  reason: string
  required: boolean
}

export interface ProjectFactTrace {
  projectId: string
  projectNo?: string
  projectName?: string
  defaultViewMode: 'PHASE' | 'TIMELINE' | 'RELATION' | 'EXCEPTION'
  asOf?: string
  nodes: ProjectFactNode[]
  sourceGaps: ProjectFactSourceGap[]
}

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
  /** 履约负责人（财务或企业负责人）。 */
  supportId?: string
  supportName?: string
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
  /** 只读投影：项目 PHASE 事实索引（project/project/info）。 */
  factTrace?: ProjectFactTrace
}

export interface ProjectStage {
  id: string
  projectId: string
  name: string
  sort: number
  weight: number
  /** 合同阶段快照继承；历史来源缺失时为空，展示“待核验”。 */
  acceptanceMode?: StageAcceptanceMode
  status: StageStatus
  progress: number
  plannedStart?: string
  plannedEnd?: string
  actualStart?: string
  actualEnd?: string
  /** 系统/人工判定「本项不涉及」的原因（GAP-039 / DEC-057）。 */
  notApplicableReason?: string
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
  ownerId?: string
  ownerName?: string
  priority?: string
  conceal?: boolean
  remark?: string
  plannedStart?: string
  plannedEnd?: string
  actualStart?: string
  actualEnd?: string
  evidenceUrls?: string[]
  nodes?: ProjectTaskNode[]
}

/** 施工进行 / 隐蔽工程 / 施工完成三类节点留证。 */
export interface ProjectTaskNode {
  id: string
  key: string
  note?: string
  confirmedByName?: string
  confirmedAt?: string
}

export interface SiteReport {
  id: string
  projectId: string
  stageId?: string
  taskId?: string
  type?: string
  title: string
  content: string
  reportAt?: string
  authorName?: string
  visibleToCustomer?: boolean
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
