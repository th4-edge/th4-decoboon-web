/**
 * 指标口径定义（来自服务端指标字典 `statistic/metric/dictionary`，与 App `MetricDefinition` 同源）。
 * 口径只有一个来源：服务端字典。前端不复制、不改写、不自造口径。
 */
export interface MetricDefinition {
  key: string
  name: string
  userLabel: string
  category: string
  definition: string
  formula: string
  source: string
  timeScope: string
  dataScope: string
  includes: string
  excludes: string
  missingValue: string
  example: string
  updatedAt: string
  status: string
}

/** 门店经营报告明细：设计师业绩（与 App `statistic/store/report` 同源）。 */
export interface StoreDesignerPerformance {
  designerId: string
  designerName: string
  customerCount: number
  pendingMeasureCount: number
  quoteCount: number
  acceptedQuoteCount: number
  pendingDecisionQuoteCount: number
  quoteAmount: number
  signedAmount: number
  projectCount: number
  ongoingProjectCount: number
  taskTodoCount: number
  taskOverdueCount: number
  finalQuoteAcceptanceRate: number
  firstQuoteAcceptanceRate: number
}

export interface StoreRecentItem {
  id: string
  no: string
  name: string
  /** 服务端返回的中文名（状态/来源），前端不做本地映射。 */
  statusLabel: string
  extraLabel: string
  amount: number | null
  progress: number | null
  createdAt: string
}

/** 门店维度范围标注（`DEC-067` BOSS-STORE-03 / `DESIGN-BIZ-20261013-003` P0D-02）。 */
export interface StoreScopeInfo {
  /** AllStores（全部门店，本页不提供合计，需先选门店）| Store（指定门店）。 */
  scopeType: 'AllStores' | 'Store'
  storeId?: string
  storeName?: string
  unassignedCount: number
}

/**
 * 门店经营报告（`statistic/store/report`）。
 * 注意：**该 Provider 不返回成本与毛利字段**，也不返回成本完整性标记 → 页面不得展示成本、更不得做减法推利润。
 */
export interface StoreReport {
  storeScope: StoreScopeInfo
  storeName: string
  memberCount: number
  designerCount: number
  marketerCount: number
  projectManagerCount: number
  unassignedDesignerCount: number
  customerCount: number
  newCustomerCount: number
  followingCustomerCount: number
  dormantCustomerCount: number
  pendingMeasureCount: number
  quoteCount: number
  pendingQuoteCount: number
  acceptedQuoteCount: number
  submittedQuoteCount: number
  pendingDecisionQuoteCount: number
  quoteAmount: number
  signedAmount: number
  conversionRate: number
  finalQuoteAcceptanceRate: number
  firstQuoteAcceptanceRate: number
  projectCount: number
  preparingProjectCount: number
  ongoingProjectCount: number
  acceptingProjectCount: number
  suspendedProjectCount: number
  finishedProjectCount: number
  taskTodoCount: number
  taskOverdueCount: number
  reportCount: number
  designerPerformances: StoreDesignerPerformance[]
  recentProjects: StoreRecentItem[]
  recentCustomers: StoreRecentItem[]
}
