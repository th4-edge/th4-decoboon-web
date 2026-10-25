import { post } from '@/core/http'
import type {
  DesignerBusinessWorkbenchReport,
  DesignerDesignTask,
  DesignerMeasureQuery,
  DesignerMeasureTask,
  DesignerQuoteTask,
  DesignerSignTask,
  DesignerQueueQuery,
  DesignerTaskPage,
  MarketerPerformanceReport,
  MeasureAppointmentItem,
  MeasureAppointmentReport,
  PerformancePeriodMetric,
  PerformanceRankingItem,
  PerformanceRateMetric,
  WorkQueueItem
} from './model'

/** 角色业务工作台只读聚合 Provider。 */
export function designerBusinessWorkbench(): Promise<DesignerBusinessWorkbenchReport> {
  return post<DesignerBusinessWorkbenchReport>('statistic/workbench/designer/report', {})
}

/** 设计师 Today Queue 独立 Provider。 */
export function designerWorkQueue(): Promise<WorkQueueItem[]> {
  return post<WorkQueueItem[]>('statistic/workbench/designer/queue/list', {})
}

type RawRecord = Record<string, unknown>

function str(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

function num(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

function normalizeDesignerDesignTask(raw: RawRecord): DesignerDesignTask {
  return {
    customerId: str(raw.custId ?? raw.customerId),
    propertyId: str(raw.propertyId),
    customerName: str(raw.customerName),
    telNo: str(raw.telNo) || undefined,
    community: str(raw.community) || undefined,
    address: str(raw.addr ?? raw.address) || undefined,
    area: num(raw.area),
    customerStatus: str(raw.customerStatus) || undefined,
    customerStatusName: str(raw.customerStatusName) || undefined,
    measureAt: str(raw.measureAt) || undefined,
    pendingMeasureAt: str(raw.pendingMeasureAt) || undefined,
    designStatus: raw.designStatus === 'Doing' || raw.designStatus === 'Done' ? raw.designStatus : 'Pending',
    designStatusName: str(raw.designStatusName) || '待设计',
    schemeCount: num(raw.schemeCount) ?? 0,
    hasRequirement: raw.hasRequirement === true,
    lastDesignAt: str(raw.lastDesignAt) || undefined,
    stayDays: num(raw.stayDays) ?? 0
  }
}

/** 设计师待量房任务队列：客户 + 房屋级，分页、筛选和主行动均由服务端返回。 */
export async function designerMeasureTasks(query: DesignerMeasureQuery = {}): Promise<DesignerTaskPage<DesignerMeasureTask>> {
  const current = query.current ?? 1
  const size = query.size ?? 20
  const raw = await post<unknown>('statistic/designer/measure/page', {
    current,
    size,
    keyword: query.keyword?.trim() || undefined,
    state: query.state || undefined
  })
  return pagedTasks(raw, current, size, (item) => item as unknown as DesignerMeasureTask)
}

/** 设计师设计工作台：资格、筛选、关键词、排序和分页均由服务端完成。 */
export async function designerDesignTasks(query: DesignerQueueQuery = {}): Promise<DesignerTaskPage<DesignerDesignTask>> {
  const current = query.current ?? 1
  const size = query.size ?? 20
  const raw = await post<unknown>('statistic/workbench/design/page', {
    current,
    size,
    keyword: query.keyword?.trim() || undefined,
    filter: query.filter || 'all'
  })
  return pagedTasks(raw, current, size, (item) => normalizeDesignerDesignTask(item as RawRecord))
}

function normalizeDesignerQuoteTask(raw: RawRecord): DesignerQuoteTask {
  return {
    custId: str(raw.custId),
    propertyId: str(raw.propertyId),
    customerName: str(raw.customerName),
    telNo: str(raw.telNo) || undefined,
    community: str(raw.community) || undefined,
    area: num(raw.area) ?? null,
    customerStatus: str(raw.customerStatus) || undefined,
    customerStatusName: str(raw.customerStatusName) || undefined,
    quoteId: str(raw.quoteId),
    quoteNo: str(raw.quoteNo),
    version: num(raw.version) ?? 1,
    amount: num(raw.amount) ?? 0,
    quoteStatus: str(raw.quoteStatus) || 'Draft',
    quoteStatusName: str(raw.quoteStatusName),
    submittedAt: str(raw.submittedAt) || null,
    lastFeedbackAt: str(raw.lastFeedbackAt) || null,
    adjustmentCount: num(raw.adjustmentCount) ?? 0,
    stayDays: num(raw.stayDays) ?? 0,
    riskLevel: str(raw.riskLevel) || 'Normal',
    riskReason: str(raw.riskReason) || null,
    nextActionKey: str(raw.nextActionKey),
    nextActionLabel: str(raw.nextActionLabel)
  }
}

function normalizeDesignerSignTask(raw: RawRecord): DesignerSignTask {
  return {
    custId: str(raw.custId),
    propertyId: str(raw.propertyId),
    customerName: str(raw.customerName),
    telNo: str(raw.telNo) || undefined,
    community: str(raw.community) || undefined,
    addr: str(raw.addr) || undefined,
    area: num(raw.area) ?? null,
    customerStatus: str(raw.customerStatus) || undefined,
    customerStatusName: str(raw.customerStatusName) || undefined,
    designerId: raw.designerId ? str(raw.designerId) : null,
    designerName: raw.designerName ? str(raw.designerName) : null,
    designerStoreName: raw.designerStoreName ? str(raw.designerStoreName) : null,
    quoteId: str(raw.quoteId),
    quoteNo: str(raw.quoteNo),
    version: num(raw.version) ?? 1,
    acceptedAmount: num(raw.acceptedAmount) ?? 0,
    acceptedAt: str(raw.acceptedAt) || null,
    converted: raw.converted === true,
    contractId: raw.contractId ? str(raw.contractId) : null,
    contractNo: raw.contractNo ? str(raw.contractNo) : null,
    contractStatus: raw.contractStatus ? str(raw.contractStatus) : null,
    contractStatusName: raw.contractStatusName ? str(raw.contractStatusName) : null,
    signedAt: raw.signedAt ? str(raw.signedAt) : null,
    projectId: raw.projectId ? str(raw.projectId) : null,
    projectName: raw.projectName ? str(raw.projectName) : null,
    projectStatus: raw.projectStatus ? str(raw.projectStatus) : null,
    projectStatusName: raw.projectStatusName ? str(raw.projectStatusName) : null,
    currentAmount: raw.currentAmount == null ? null : num(raw.currentAmount) ?? null,
    pendingChangeCount: raw.pendingChangeCount == null ? null : num(raw.pendingChangeCount) ?? null,
    stayDays: num(raw.stayDays) ?? 0,
    riskLevel: str(raw.riskLevel) || 'Normal',
    riskReason: str(raw.riskReason) || null,
    nextActionKey: str(raw.nextActionKey),
    nextActionLabel: str(raw.nextActionLabel)
  }
}

function pagedTasks<T>(
  raw: unknown,
  fallbackCurrent: number,
  fallbackSize: number,
  normalize: (item: RawRecord) => T
): DesignerTaskPage<T> {
  const record = raw && typeof raw === 'object' ? raw as RawRecord : {}
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray(record.content)
      ? record.content
      : []
  const total = Number(record.totalElements ?? record.total ?? rows.length)
  const size = Number(record.size ?? fallbackSize)
  const current = Number(record.number != null ? Number(record.number) + 1 : record.current ?? fallbackCurrent)
  const pages = Math.max(1, Number(record.totalPages ?? Math.ceil(total / Math.max(1, size))))
  return {
    list: rows.map((item) => normalize(item as RawRecord)),
    total,
    current,
    size,
    pages
  }
}

/** 待我谈单工作队列：复用 App 已有报价工作台 Provider，服务端分页、筛选和 Dormant 排除。 */
export async function designerQuoteTasks(query: DesignerQueueQuery = {}): Promise<DesignerTaskPage<DesignerQuoteTask>> {
  const current = query.current ?? 1
  const size = query.size ?? 20
  const raw = await post<unknown>('statistic/workbench/quote/page', {
    current,
    size,
    keyword: query.keyword?.trim() || undefined,
    filter: query.filter || 'all',
    quoteId: query.quoteId || undefined
  })
  return pagedTasks(raw, current, size, normalizeDesignerQuoteTask)
}

/** 待我签约工作队列：复用 App 已有签约工作台 Provider，服务端分页、筛选和 Dormant 排除。 */
export async function designerSignTasks(query: DesignerQueueQuery = {}): Promise<DesignerTaskPage<DesignerSignTask>> {
  const current = query.current ?? 1
  const size = query.size ?? 20
  const raw = await post<unknown>('statistic/workbench/sign/page', {
    current,
    size,
    keyword: query.keyword?.trim() || undefined,
    filter: query.filter || 'all',
    quoteId: query.quoteId || undefined
  })
  return pagedTasks(raw, current, size, normalizeDesignerSignTask)
}

export const workbenchApi = {
  measureAppointmentReport,
  marketerPerformanceReport,
  designerBusinessWorkbench,
  designerWorkQueue,
  designerMeasureTasks,
  designerDesignTasks,
  designerQuoteTasks,
  designerSignTasks
}

function normalizeMeasureAppointment(raw: RawRecord): MeasureAppointmentItem {
  const risk = String(raw.riskLevel ?? 'Normal')
  return {
    measureId: raw.measureId ? str(raw.measureId) : null,
    customerId: str(raw.customerId),
    propertyId: str(raw.propertyId),
    customerName: str(raw.customerName),
    telNo: str(raw.telNo) || null,
    customerStatus: str(raw.customerStatus) || null,
    customerStatusName: str(raw.customerStatusName) || null,
    source: str(raw.source) || null,
    sourceName: str(raw.sourceName) || null,
    marketerId: raw.marketerId ? str(raw.marketerId) : null,
    marketerName: raw.marketerName ? str(raw.marketerName) : null,
    marketerStoreName: raw.marketerStoreName ? str(raw.marketerStoreName) : null,
    community: raw.community ? str(raw.community) : null,
    building: raw.building ? str(raw.building) : null,
    roomNo: raw.roomNo ? str(raw.roomNo) : null,
    address: raw.address ? str(raw.address) : null,
    area: num(raw.area) ?? null,
    layout: raw.layout ? str(raw.layout) : null,
    propertyStatus: raw.propertyStatus ? str(raw.propertyStatus) : null,
    propertyStatusName: raw.propertyStatusName ? str(raw.propertyStatusName) : null,
    designerId: raw.designerId ? str(raw.designerId) : null,
    designerName: raw.designerName ? str(raw.designerName) : null,
    executorId: raw.executorId ? str(raw.executorId) : null,
    executorName: raw.executorName ? str(raw.executorName) : null,
    scheduledAt: raw.scheduledAt ? str(raw.scheduledAt) : null,
    completedAt: raw.completedAt ? str(raw.completedAt) : null,
    measureStatus: raw.measureStatus ? str(raw.measureStatus) : null,
    derivedState: str(raw.derivedState) || 'Unknown',
    derivedStateName: str(raw.derivedStateName) || '待确认',
    riskLevel: risk === 'Warning' || risk === 'Danger' || risk === 'Unknown' ? risk : 'Normal',
    nextAction: str(raw.nextAction),
    sitePhotoCount: num(raw.sitePhotoCount) ?? 0,
    structureImageCount: num(raw.structureImageCount) ?? 0,
    attachmentCount: num(raw.attachmentCount) ?? 0,
    handoffStarted: raw.handoffStarted === true,
    handoffStartedAt: raw.handoffStartedAt ? str(raw.handoffStartedAt) : null,
    stayHours: num(raw.stayHours) ?? null
  }
}

/**
 * 量房预约报告：**消费 App 已在用的 `statistic/boss/measure/report`**（App `workbenchApi.bossMeasure`），
 * 不是新开接口。服务端按登录角色裁剪数据范围——业务员得到本人客户，店长/负责人得到本店/本企业。
 */
export async function measureAppointmentReport(): Promise<MeasureAppointmentReport> {
  const raw = (await post<unknown>('statistic/boss/measure/report', {})) as RawRecord
  const items = Array.isArray(raw.items) ? (raw.items as RawRecord[]) : []
  return {
    asOf: raw.asOf ? str(raw.asOf) : null,
    itemCount: num(raw.itemCount) ?? items.length,
    todayCount: num(raw.todayCount) ?? 0,
    riskCount: num(raw.riskCount) ?? 0,
    scheduledCount: num(raw.scheduledCount) ?? 0,
    completedCount: num(raw.completedCount) ?? 0,
    overdue4hCount: num(raw.overdue4hCount) ?? 0,
    unassignedCount: num(raw.unassignedCount) ?? 0,
    handoff48hCount: num(raw.handoff48hCount) ?? 0,
    appointmentRate: num(raw.appointmentRate) ?? null,
    completionRate: num(raw.completionRate) ?? null,
    overdueRate: num(raw.overdueRate) ?? null,
    handoffRate: num(raw.handoffRate) ?? null,
    items: items.map(normalizeMeasureAppointment)
  }
}

function periodMetricOf(raw: RawRecord = {}): PerformancePeriodMetric {
  return {
    current: num(raw.current) ?? 0,
    previous: num(raw.previous) ?? 0,
    growthRate: num(raw.growthRate) ?? 0
  }
}

function rateMetricOf(raw: RawRecord = {}): PerformanceRateMetric {
  return {
    currentRate: num(raw.currentRate) ?? 0,
    previousRate: num(raw.previousRate) ?? 0,
    change: num(raw.change) ?? 0
  }
}

function rankingItemOf(raw: RawRecord): PerformanceRankingItem {
  return {
    id: (raw.id as number | string) ?? '',
    name: str(raw.name),
    rank: num(raw.rank) ?? 0,
    customerCount: num(raw.customerCount) ?? 0,
    measureCount: num(raw.measureCount) ?? 0,
    followCount: num(raw.followCount) ?? 0,
    measureRate: num(raw.measureRate) ?? 0
  }
}

/**
 * 业务员业绩报告：**消费 App 已在用的 `statistic/marketer/report`**（App `statisticApi.marketer()`），
 * 不是新开接口。服务端按登录员工范围返回本人业绩；本层不做任何金额/比率计算。
 */
export async function marketerPerformanceReport(): Promise<MarketerPerformanceReport> {
  const raw = (await post<unknown>('statistic/marketer/report', {})) as RawRecord
  const rankings = Array.isArray(raw.marketerRankings) ? (raw.marketerRankings as RawRecord[]) : []
  const storeRankings = Array.isArray(raw.storeRankings) ? (raw.storeRankings as RawRecord[]) : []
  const recentCustomers = Array.isArray(raw.recentCustomers) ? (raw.recentCustomers as RawRecord[]) : []
  const recentProjects = Array.isArray(raw.recentProjects) ? (raw.recentProjects as RawRecord[]) : []
  return {
    customerCount: num(raw.customerCount) ?? 0,
    newCustomerCount: num(raw.newCustomerCount) ?? 0,
    followingCustomerCount: num(raw.followingCustomerCount) ?? 0,
    signedCustomerCount: num(raw.signedCustomerCount) ?? 0,
    pendingMeasureCount: num(raw.pendingMeasureCount) ?? 0,
    quotedCustomerCount: num(raw.quotedCustomerCount) ?? 0,
    followDueCount: num(raw.followDueCount) ?? 0,
    followOverdueCount: num(raw.followOverdueCount) ?? 0,
    draftQuoteCount: num(raw.draftQuoteCount) ?? 0,
    submittedQuoteCount: num(raw.submittedQuoteCount) ?? 0,
    lostCustomerCount: num(raw.lostCustomerCount) ?? 0,
    projectCount: num(raw.projectCount) ?? 0,
    ongoingProjectCount: num(raw.ongoingProjectCount) ?? 0,
    finishedProjectCount: num(raw.finishedProjectCount) ?? 0,
    taskTodoCount: num(raw.taskTodoCount) ?? 0,
    taskOverdueCount: num(raw.taskOverdueCount) ?? 0,
    quoteAmount: num(raw.quoteAmount) ?? 0,
    acceptedQuoteAmount: num(raw.acceptedQuoteAmount) ?? 0,
    signedAmount: num(raw.signedAmount) ?? 0,
    wechatAddedCount: num(raw.wechatAddedCount) ?? 0,
    convertedCustomerCount: num(raw.convertedCustomerCount) ?? 0,
    conversionRate: num(raw.conversionRate) ?? 0,
    averageConversionDays: num(raw.averageConversionDays) ?? 0,
    goldenHotCount: num(raw.goldenHotCount) ?? 0,
    goldenWarmCount: num(raw.goldenWarmCount) ?? 0,
    goldenCoolingCount: num(raw.goldenCoolingCount) ?? 0,
    goldenRiskCount: num(raw.goldenRiskCount) ?? 0,
    customerInputDay: periodMetricOf(raw.customerInputDay as RawRecord),
    customerInputWeek: periodMetricOf(raw.customerInputWeek as RawRecord),
    customerInputMonth: periodMetricOf(raw.customerInputMonth as RawRecord),
    followDay: periodMetricOf(raw.followDay as RawRecord),
    followWeek: periodMetricOf(raw.followWeek as RawRecord),
    followMonth: periodMetricOf(raw.followMonth as RawRecord),
    measureRateDay: rateMetricOf(raw.measureRateDay as RawRecord),
    measureRateWeek: rateMetricOf(raw.measureRateWeek as RawRecord),
    measureRateMonth: rateMetricOf(raw.measureRateMonth as RawRecord),
    marketerRankings: rankings.map(rankingItemOf),
    storeRankings: storeRankings.map(rankingItemOf),
    myMarketerRank: num(raw.myMarketerRank) ?? 0,
    myStoreRank: num(raw.myStoreRank) ?? 0,
    companyMarketerCount: num(raw.companyMarketerCount) ?? 0,
    companyStoreCount: num(raw.companyStoreCount) ?? 0,
    recentCustomers: recentCustomers as unknown as MarketerPerformanceReport['recentCustomers'],
    recentProjects: recentProjects as unknown as MarketerPerformanceReport['recentProjects']
  }
}
