import { post } from '@/core/http'
import type {
  DesignerBusinessWorkbenchReport,
  DesignerDesignTask,
  DesignerMeasureQuery,
  DesignerMeasureTask,
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

/** 设计师待量房任务队列：客户 + 房屋级，状态和主行动由服务端返回。 */
export function designerMeasureTasks(query: DesignerMeasureQuery = {}): Promise<DesignerMeasureTask[]> {
  return post<DesignerMeasureTask[]>('statistic/designer/measure/list', {
    keyword: query.keyword?.trim() || undefined,
    state: query.state || undefined
  })
}

/** 设计师设计工作台：复用 App 已有客户 + 房屋级 Provider，Web 仅做展示分组。 */
export async function designerDesignTasks(): Promise<DesignerDesignTask[]> {
  const raw = await post<unknown[]>('statistic/workbench/design/page', {})
  return (Array.isArray(raw) ? raw : []).map((item) => normalizeDesignerDesignTask(item as RawRecord))
}

export const workbenchApi = {
  measureAppointmentReport,
  marketerPerformanceReport,
  designerBusinessWorkbench,
  designerWorkQueue,
  designerMeasureTasks,
  designerDesignTasks
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
    derivedStateName: str(raw.derivedStateName) || '待业务确认',
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
