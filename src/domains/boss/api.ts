import { post } from '@/core/http'
import type {
  BossDashboardReport, BusinessAnalysisReport, ChannelMetric, DashboardMetric, EmployeePerformance, FunnelStage,
  OrderSizeBucket, OrganizationReport, RegionMetric, RoleCapacity
} from './model'

function text(value: unknown): string { return typeof value === 'string' ? value : value == null ? '' : String(value) }
function num(value: unknown): number { return typeof value === 'number' ? value : Number(value ?? 0) || 0 }
function listOf(value: unknown): unknown[] { return Array.isArray(value) ? value : [] }
function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}
function enumText(value: unknown): string {
  const r = rec(value)
  return text(r.name ?? r.value ?? r.key ?? value)
}

function optionalNum(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

function dashboardMetricOf(raw: unknown): DashboardMetric {
  const i = rec(raw)
  return {
    value: optionalNum(i.value),
    target: num(i.target),
    achievementRate: num(i.achievementRate),
    previousMonthValue: num(i.previousMonthValue),
    previousYearValue: num(i.previousYearValue),
    monthOverMonthRate: num(i.monthOverMonthRate),
    yearOverYearRate: num(i.yearOverYearRate),
    targetSet: i.targetSet === true,
    monthOverMonthComparable: i.monthOverMonthComparable === true,
    yearOverYearComparable: i.yearOverYearComparable === true,
    complete: i.complete !== false,
    warning: text(i.warning)
  }
}

function dashboardOf(raw: unknown): BossDashboardReport {
  const i = rec(raw)
  return {
    month: text(i.month),
    storeScope: storeScopeOf(i.storeScope),
    signedAmount: dashboardMetricOf(i.signedAmount),
    receivedAmount: dashboardMetricOf(i.receivedAmount),
    grossProfit: dashboardMetricOf(i.grossProfit),
    activeProjectCount: dashboardMetricOf(i.activeProjectCount)
  }
}

function funnelOf(raw: unknown): FunnelStage {
  const i = rec(raw)
  return { key: text(i.key), label: text(i.label), count: num(i.count), unit: text(i.unit) }
}
function channelOf(raw: unknown): ChannelMetric {
  const i = rec(raw)
  return {
    source: text(i.source), label: text(i.label), leadCount: num(i.leadCount), visitCount: num(i.visitCount),
    signedCount: num(i.signedCount), signRate: num(i.signRate), avgOrderAmount: num(i.avgOrderAmount)
  }
}
function regionOf(raw: unknown): RegionMetric {
  const i = rec(raw)
  return { community: text(i.community), signedCount: num(i.signedCount), signedAmount: num(i.signedAmount) }
}
function bucketOf(raw: unknown): OrderSizeBucket {
  const i = rec(raw)
  return { key: text(i.key), label: text(i.label), count: num(i.count) }
}

function storeScopeOf(raw: unknown) {
  const i = rec(raw)
  const scopeType = text(i.scopeType) === 'Store' ? 'Store' as const : 'AllStores' as const
  return {
    scopeType,
    storeId: i.storeId == null ? undefined : String(i.storeId),
    storeName: i.storeName == null ? undefined : text(i.storeName),
    unassignedCount: num(i.unassignedCount)
  }
}

function businessOf(raw: unknown): BusinessAnalysisReport {
  const i = rec(raw)
  const storeScope = storeScopeOf(i.storeScope)
  const q = rec(i.quoteConversion)
  return {
    month: text(i.month),
    storeScope,
    funnel: listOf(i.funnel).map(funnelOf),
    overallConversionRate: num(i.overallConversionRate),
    quoteConversion: {
      finalQuoteAcceptanceRate: num(q.finalQuoteAcceptanceRate),
      firstQuoteAcceptanceRate: num(q.firstQuoteAcceptanceRate),
      decidedOpportunityCount: num(q.decidedOpportunityCount),
      pendingDecisionQuoteCount: num(q.pendingDecisionQuoteCount),
      submittedQuoteCount: num(q.submittedQuoteCount)
    },
    channels: listOf(i.channels).map(channelOf),
    regions: listOf(i.regions).map(regionOf),
    orderSizes: listOf(i.orderSizes).map(bucketOf),
    medianOrderAmount: num(i.medianOrderAmount),
    maxOrderAmount: num(i.maxOrderAmount)
  }
}

function capacityOf(raw: unknown): RoleCapacity {
  const i = rec(raw)
  return {
    role: text(i.role), label: text(i.label), count: num(i.count),
    metricKey: text(i.metricKey), metricLabel: text(i.metricLabel), metricValue: num(i.metricValue)
  }
}
function performanceOf(raw: unknown): EmployeePerformance {
  const i = rec(raw)
  const employee = rec(i.employee)
  return {
    empId: text(employee.empId), name: text(employee.name), role: enumText(i.role),
    quoteCount: num(i.quoteCount), acceptedQuoteCount: num(i.acceptedQuoteCount),
    designerConversionRate: num(i.designerConversionRate),
    customerCount: num(i.customerCount), signedCustomerCount: num(i.signedCustomerCount),
    marketerSignRate: num(i.marketerSignRate),
    deliveredProjectCount: num(i.deliveredProjectCount), onTimeProjectCount: num(i.onTimeProjectCount),
    pmOnTimeDeliveryRate: num(i.pmOnTimeDeliveryRate), acceptanceCount: num(i.acceptanceCount)
  }
}

function organizationOf(raw: unknown): OrganizationReport {
  const i = rec(raw)
  const storeScope = storeScopeOf(i.storeScope)
  return {
    month: text(i.month),
    storeScope,
    headcount: num(i.headcount), newHires: num(i.newHires),
    signedAmount: num(i.signedAmount), newProjectCount: num(i.newProjectCount),
    perCapitaOutput: num(i.perCapitaOutput), perCapitaOrders: num(i.perCapitaOrders),
    roleCapacities: listOf(i.roleCapacities).map(capacityOf),
    designerRanking: listOf(i.designerRanking).map(performanceOf),
    marketerRanking: listOf(i.marketerRanking).map(performanceOf),
    pmRanking: listOf(i.pmRanking).map(performanceOf),
    sampleSufficient: i.sampleSufficient !== false
  }
}

/**
 * 门店维度请求体：仅「真实门店 ID」才传参；「全部门店」不传（`DEC-067` BOSS-STORE-10 / P0A-06）。
 * 状态值 `'0'` 一律视为「全部门店」，绝不作为门店 ID 传给接口。
 */
function storeScopeBody(storeId?: string | null): Record<string, string> {
  const value = storeId?.trim()
  if (!value || value === '0') return {}
  return { storeId: value }
}

export const bossApi = {
  dashboard: async (storeId?: string): Promise<BossDashboardReport> =>
    dashboardOf(await post<unknown>('statistic/boss/dashboard', storeScopeBody(storeId))),
  businessReport: async (storeId?: string): Promise<BusinessAnalysisReport> =>
    businessOf(await post<unknown>('statistic/boss/business/report', storeScopeBody(storeId))),
  organizationReport: async (storeId?: string): Promise<OrganizationReport> =>
    organizationOf(await post<unknown>('statistic/organization/report', storeScopeBody(storeId)))
}
