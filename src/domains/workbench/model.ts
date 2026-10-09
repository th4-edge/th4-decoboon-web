export type WorkbenchKind = 'aggregate' | 'queue' | 'object' | 'workspace'
export type WorkbenchPriority = 'P0' | 'P1' | 'P2'
export type WorkbenchDecisionStatus = 'approved' | 'pending_business_review'

export interface WorkbenchInboundState {
  object: string
  statuses: string[]
}

export interface WorkbenchEntry {
  key: string
  label: string
  domain: string
  group: string
  kind: WorkbenchKind
  roles: string[]
  entryScenario: string
  inboundStates: WorkbenchInboundState[]
  objectAnchor: string
  mainline: string
  currentWorkSurface: string
  mainAction: string
  actionPolicyKeys: string[]
  handoff: string
  handoffTo: string[]
  priority: WorkbenchPriority
  deepLink: string
  emptyState: string
  exceptionState: string
  contextRecovery: {
    deepLink: boolean
    preserveFilters: boolean
    preserveScroll: boolean
    preserveDraft: boolean
    returnToSource: boolean
  }
  unsavedChangesGuard: boolean
  unsavedChangesReason?: string
  reloadScopes: string[]
  decisionStatus: WorkbenchDecisionStatus
  businessRefs: string[]
  notes?: string
}

export interface WorkbenchDomain {
  key: string
  label: string
  order: number
}

export interface WorkbenchGroup {
  key: string
  label: string
  domain: string
  order: number
}

export interface WorkbenchRegistry {
  version: number
  updated: string
  sources: string[]
  domains: WorkbenchDomain[]
  groups: WorkbenchGroup[]
  workbenches: WorkbenchEntry[]
}

/** 设计师业务工作台只读聚合响应，字段定义与后端 DesignerWorkbenchReport 对齐。 */
export interface BusinessWorkbenchSummaryMetric {
  key: string
  value: number
  unit: string
  previousValue?: number | null
  changeRate?: number | null
  comparisonState?: 'up' | 'down' | 'flat' | 'unavailable' | string
  comparisonLabel?: string
}

export interface BusinessWorkbenchBreakdown {
  key: string
  count: number
}

export interface BusinessWorkbenchPipelineStage {
  key: string
  label: string
  count: number
  rate?: number | null
  previousCount?: number | null
  state: string
  description: string
  route: string
}

export interface BusinessWorkbenchCardMetric {
  key: string
  count: number
  riskCount?: number | null
  status: string
  breakdown: BusinessWorkbenchBreakdown[]
}

export interface BusinessWorkbenchTrendPoint {
  date: string
  value: number
}

export interface BusinessWorkbenchChartSeries {
  key: string
  value?: number | null
  points?: BusinessWorkbenchTrendPoint[]
}

export interface BusinessWorkbenchChart {
  key: string
  type: string
  series: BusinessWorkbenchChartSeries[]
}

export interface BusinessWorkbenchWarning {
  key: string
  scopeKey?: string | null
  message: string
}

export interface DesignerPerformanceRankingItem {
  employeeId?: number | null
  employeeName: string
  rank: number
  value: number
  signedProjectCount: number
  currentEmployee: boolean
}

export interface DesignerPerformanceRanking {
  metricKey: string
  metricLabel: string
  periodLabel: string
  rank: number
  designerCount: number
  sampleSufficient: boolean
  myValue: number
  topValue: number
  peerAverage: number
  gapToTop: number
  gapToAverage: number
  topDesigners: DesignerPerformanceRankingItem[]
}

export interface DesignerBusinessWorkbenchReport {
  role: string
  employeeId: number
  employeeName: string
  companyId: number
  storeId?: number | null
  dataScope: string
  generatedAt: string
  month: string
  trendStart: string
  trendEnd: string
  status: string
  summary: BusinessWorkbenchSummaryMetric[]
  cards: BusinessWorkbenchCardMetric[]
  pipeline: BusinessWorkbenchPipelineStage[]
  charts: BusinessWorkbenchChart[]
  warnings: BusinessWorkbenchWarning[]
  performanceRanking: DesignerPerformanceRanking
}


/** 角色业务工作台 Today Queue 项。 */
export interface WorkQueueItem {
  queueKey: string
  objectType: string
  objectId: number
  customerId?: number | null
  propertyId?: number | null
  projectId?: number | null
  title: string
  subtitle: string
  stateKey: string
  stateLabel: string
  ownerName: string
  nextActionKey: string
  nextActionLabel: string
  route: string
  priority: number
  dueAt?: string | null
  stayDays: number
  riskLevel: string
  allowed: boolean
  blockReason?: string | null
}

/** 设计师待量房任务（客户 + 房屋级）；状态、风险与主行动均由服务端给出。 */
export interface DesignerMeasureTask {
  taskKey: string
  customerId: number
  customerName?: string | null
  telNo?: string | null
  customerStatus?: string | null
  customerStatusName?: string | null
  propertyId?: number | null
  propertyLabel?: string | null
  community?: string | null
  building?: string | null
  roomNo?: string | null
  address?: string | null
  area?: number | null
  layout?: string | null
  propertyStatus?: string | null
  propertyStatusName?: string | null
  measureId?: number | null
  measureStatus?: string | null
  scheduledAt?: string | null
  scheduleStateKey?: string | null
  scheduleStateName?: string | null
  completedAt?: string | null
  stateKey: string
  stateLabel: string
  riskLevel: string
  riskReason?: string | null
  mainActionKey: string
  mainActionLabel: string
  nextActionKey?: string | null
  nextActionLabel?: string | null
  completionHint?: string | null
  route?: string | null
  allowed: boolean
  blockReason?: string | null
  sitePhotoCount: number
  structureImageCount: number
  attachmentCount: number
  requirementCount: number
  designCount: number
  priority: number
}

export interface DesignerMeasureQuery {
  keyword?: string
  state?: string
}

/** 设计师设计工作台项（客户 + 房屋级）；左侧队列唯一业务源。 */
export interface DesignerDesignTask {
  customerId: string
  propertyId: string
  customerName: string
  telNo?: string
  community?: string
  address?: string
  area?: number
  customerStatus?: string
  customerStatusName?: string
  measureAt?: string
  pendingMeasureAt?: string
  designStatus: 'Pending' | 'Doing' | 'Done'
  designStatusName: string
  schemeCount: number
  hasRequirement: boolean
  lastDesignAt?: string
  stayDays: number
}
