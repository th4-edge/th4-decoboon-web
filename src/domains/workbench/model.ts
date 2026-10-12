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
  /** 降级并列动作（主行动不适用但现场事实已发生时使用，例如逾期时直接登记量房结论）。 */
  secondaryActionKey?: string | null
  secondaryActionLabel?: string | null
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

/**
 * 量房预约事项（`statistic/boss/measure/report`，App 侧同名端点，业务员页面标题为「我的预约量房」）。
 * 服务端按登录角色的数据范围裁剪：业务员看到的是**本人**客户的量房事项，不需要前端再分组。
 */
export interface MeasureAppointmentItem {
  measureId?: string | null
  customerId: string
  propertyId: string
  customerName: string
  telNo?: string | null
  customerStatus?: string | null
  customerStatusName?: string | null
  source?: string | null
  sourceName?: string | null
  marketerId?: string | null
  marketerName?: string | null
  marketerStoreName?: string | null
  community?: string | null
  building?: string | null
  roomNo?: string | null
  address?: string | null
  area?: number | null
  layout?: string | null
  propertyStatus?: string | null
  propertyStatusName?: string | null
  designerId?: string | null
  designerName?: string | null
  executorId?: string | null
  executorName?: string | null
  scheduledAt?: string | null
  completedAt?: string | null
  measureStatus?: string | null
  /** 服务端推导状态：NotScheduled | Unassigned | Scheduled | Overdue | Completed… | HandoffRisk 等。 */
  derivedState: string
  derivedStateName: string
  riskLevel: 'Normal' | 'Warning' | 'Danger' | 'Unknown'
  /** 服务端给出的下一步建议（前端不自行拼状态判断）。 */
  nextAction: string
  sitePhotoCount: number
  structureImageCount: number
  attachmentCount: number
  handoffStarted: boolean
  handoffStartedAt?: string | null
  stayHours?: number | null
}

/** 量房预约报告（汇总 + 明细）。业务员只用汇总与本人明细，不用分组面板。 */
export interface MeasureAppointmentReport {
  asOf?: string | null
  itemCount: number
  todayCount: number
  riskCount: number
  scheduledCount: number
  completedCount: number
  overdue4hCount: number
  unassignedCount: number
  handoff48hCount: number
  appointmentRate?: number | null
  completionRate?: number | null
  overdueRate?: number | null
  handoffRate?: number | null
  items: MeasureAppointmentItem[]
}

/** 期间指标（当期 / 上期 / 环比）。 */
export interface PerformancePeriodMetric {
  current: number
  previous: number
  growthRate: number
}

/** 比率指标（当期率 / 上期率 / 变化）。 */
export interface PerformanceRateMetric {
  currentRate: number
  previousRate: number
  change: number
}

/** 业绩榜单项（业务员榜 / 门店榜共用形状）。 */
export interface PerformanceRankingItem {
  id: number | string
  name: string
  rank: number
  customerCount: number
  measureCount: number
  followCount: number
  measureRate: number
}

/**
 * 业务员业绩报告（`statistic/marketer/report`，App 侧同名端点，业务员业绩页使用）。
 * 只读结论数据：**不含成本、利润、毛利**（业务员不可见，`BR-006`）。
 */
export interface MarketerPerformanceReport {
  customerCount: number
  newCustomerCount: number
  followingCustomerCount: number
  signedCustomerCount: number
  pendingMeasureCount: number
  quotedCustomerCount: number
  followDueCount: number
  followOverdueCount: number
  draftQuoteCount: number
  submittedQuoteCount: number
  lostCustomerCount: number
  projectCount: number
  ongoingProjectCount: number
  finishedProjectCount: number
  taskTodoCount: number
  taskOverdueCount: number
  quoteAmount: number
  acceptedQuoteAmount: number
  signedAmount: number
  wechatAddedCount: number
  convertedCustomerCount: number
  conversionRate: number
  averageConversionDays: number
  goldenHotCount: number
  goldenWarmCount: number
  goldenCoolingCount: number
  goldenRiskCount: number
  customerInputDay: PerformancePeriodMetric
  customerInputWeek: PerformancePeriodMetric
  customerInputMonth: PerformancePeriodMetric
  followDay: PerformancePeriodMetric
  followWeek: PerformancePeriodMetric
  followMonth: PerformancePeriodMetric
  measureRateDay: PerformanceRateMetric
  measureRateWeek: PerformanceRateMetric
  measureRateMonth: PerformanceRateMetric
  marketerRankings: PerformanceRankingItem[]
  storeRankings: PerformanceRankingItem[]
  myMarketerRank: number
  myStoreRank: number
  companyMarketerCount: number
  companyStoreCount: number
  recentCustomers: import('@/domains/crm/model').Customer[]
  recentProjects: import('@/domains/project/model').ProjectBrief[]
}
