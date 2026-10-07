export interface BusinessAnalysisReport {
  month: string
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
