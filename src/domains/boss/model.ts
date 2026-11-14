
/** 门店维度范围标注（DEC-067 BOSS-STORE-03）。 */
export interface StoreScopeInfo {
  scopeType: 'AllStores' | 'Store'
  storeId?: string
  storeName?: string
  /** 该企业范围内 `store` 为空的记录数（单店视图恒为 0）。 */
  unassignedCount: number
}

export interface DashboardMetric {
  value: number | null
  target: number
  achievementRate: number
  previousMonthValue: number
  previousYearValue: number
  monthOverMonthRate: number
  yearOverYearRate: number
  targetSet: boolean
  monthOverMonthComparable: boolean
  yearOverYearComparable: boolean
  complete: boolean
  warning: string
}

/** 企业经营驾驶舱四联指标（`statistic/boss/dashboard`，支持门店维度）。 */
export interface BossDashboardReport {
  month: string
  storeScope: StoreScopeInfo
  signedAmount: DashboardMetric
  receivedAmount: DashboardMetric
  grossProfit: DashboardMetric
  activeProjectCount: DashboardMetric
}

export interface BusinessAnalysisReport {
  month: string
  storeScope: StoreScopeInfo
  funnel: FunnelStage[]
  overallConversionRate: number
  quoteConversion: QuoteConversion
  channels: ChannelMetric[]
  regions: RegionMetric[]
  orderSizes: OrderSizeBucket[]
  medianOrderAmount: number
  maxOrderAmount: number
}

export interface FunnelStage { key: string; label: string; count: number; unit: string }

export interface QuoteConversion {
  finalQuoteAcceptanceRate: number
  firstQuoteAcceptanceRate: number
  decidedOpportunityCount: number
  pendingDecisionQuoteCount: number
  submittedQuoteCount: number
}

export interface ChannelMetric {
  source: string; label: string; leadCount: number; visitCount: number
  signedCount: number; signRate: number; avgOrderAmount: number
}

export interface RegionMetric { community: string; signedCount: number; signedAmount: number }
export interface OrderSizeBucket { key: string; label: string; count: number }

export interface OrganizationReport {
  month: string
  storeScope: StoreScopeInfo
  headcount: number
  newHires: number
  signedAmount: number
  newProjectCount: number
  perCapitaOutput: number
  perCapitaOrders: number
  roleCapacities: RoleCapacity[]
  designerRanking: EmployeePerformance[]
  marketerRanking: EmployeePerformance[]
  pmRanking: EmployeePerformance[]
  sampleSufficient: boolean
}

export interface RoleCapacity {
  role: string; label: string; count: number
  metricKey: string; metricLabel: string; metricValue: number
}

export interface EmployeePerformance {
  empId: string; name: string; role: string
  quoteCount: number; acceptedQuoteCount: number; designerConversionRate: number
  customerCount: number; signedCustomerCount: number; marketerSignRate: number
  deliveredProjectCount: number; onTimeProjectCount: number; pmOnTimeDeliveryRate: number
  acceptanceCount: number
}
