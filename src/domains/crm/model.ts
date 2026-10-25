export type CustomerStage = 'intention' | 'following' | 'pendingMeasure' | 'quote' | 'sign' | 'construction' | 'done' | 'lost' | 'dormant' | 'unknown'

/** 客户风险等级（服务端只读投影，与 BOSS 客户经营同源）。 */
export type CustomerRiskLevel = 'Normal' | 'Attention' | 'High'

export type CustomerLossScope = 'Customer' | 'Property'
export type CustomerLossStage = 'FollowUp' | 'Measure' | 'Design' | 'Negotiation' | 'Signing'
export type CustomerLossReason =
  | 'ChoseOtherCompany'
  | 'PriceBudgetMismatch'
  | 'DesignUnsatisfied'
  | 'ScheduleMismatch'
  | 'SelfOrRelative'
  | 'ProjectCancelled'
  | 'ServiceTrust'
  | 'Other'

export interface CustomerLossRecord {
  id: string
  scope: CustomerLossScope
  stage: CustomerLossStage
  fromStatus?: string
  reasonCode: CustomerLossReason
  reasonText?: string
  competitorName?: string
  lostAt?: string
  lostByName?: string
  propertyId?: string
  propertyName?: string
  restoredAt?: string
  restoredByName?: string
  restoreStatus?: string
  restoreNote?: string
}

export interface Customer {
  id: string
  name: string
  phone: string
  stage: CustomerStage
  /**
   * 客户归属门店（`DEC-070` 单一事实源=客户门店）。
   * 为空表示「未归属门店」——BOSS 全部门店视图下必须显式标注，不得用 0 或占位值冒充。
   */
  store?: { id: string; name: string }
  gender?: string
  source?: string
  grade?: 'A' | 'B' | 'C'
  community?: string
  addr?: string
  area?: number
  budget?: number
  ownerId?: string
  ownerName?: string
  designerId?: string
  designerName?: string
  remark?: string
  lastFollowAt?: string
  nextFollowAt?: string
  measureAt?: string
  pendingMeasureAt?: string
  createdAt?: string
  tags?: string[]
  /** 服务端按 Completed 量房事实推导的行为标签，不以后端客户生命周期状态代替。 */
  measured?: boolean
  /** 服务端按 Scheduled 量房事实推导的行为标签。 */
  measureScheduled?: boolean
  /** 微信添加事实 */
  wechatAdded?: boolean
  wechatNo?: string
  wechatAddedAt?: string
  /** 到店事实 */
  visitCount?: number
  lastVisitAt?: string
  /** 休眠事实（仅业务员、店长、负责人可操作） */
  dormantReason?: string
  dormantReasonText?: string
  dormantAt?: string
  dormantByName?: string
  restoredAt?: string
  restoredByName?: string
  /* 以下为「我的客户」经营投影（服务端按 CustomerInsightContext 统一派生，前端不自行推算） */
  idleDays?: number
  riskLevel?: CustomerRiskLevel
  riskReason?: string
  nextAction?: string
  /** 主链主行动（服务端派生，与风险 nextAction 是两件事） */
  mainlineKey?: string
  mainlineLabel?: string
  mainlineHint?: string
  quoteAmount?: number
  signedAmount?: number
  projectId?: string
  projectName?: string
  /** 当前流失摘要（服务端只读投影；历史见 customer/loss/page）。 */
  lossId?: string
  lossScope?: CustomerLossScope
  lossStage?: CustomerLossStage
  lossReason?: CustomerLossReason
  lossReasonText?: string
  competitorName?: string
  lostAt?: string
  lostByName?: string
  lossPropertyId?: string
  lossPropertyName?: string
  lossFromStatus?: string
  activeLossCount?: number
  partialLoss?: boolean
  /** 客户画像（服务端只读投影；可能只填了部分枚举，缺失即缺失，不用默认值补齐）。 */
  portrait?: Record<string, unknown> | null
}

/** 我的客户经营指标（KPI 与经营时钟共用）。 */
export interface MyCustomerMetric {
  key: string
  label: string
  value: number
  subText?: string
}

/** 我的客户阶段计数。 */
export interface MyCustomerStageCount {
  key: string
  label: string
  count: number
}

/** 设计师「我的客户」聚合返回。 */
/** 门店维度范围标注（`DEC-067` BOSS-STORE-03，与 `P0B-04` 同构）。 */
export interface StoreScopeInfo {
  scopeType: 'AllStores' | 'Store'
  storeId?: string
  storeName?: string
  /** 全部门店口径：`store` 为空的客户**全量**条数（服务端 SQL 计数，不是当前页局部计数）。 */
  unassignedCount: number
}

export interface MyCustomerOverview {
  asOf?: string
  metrics: MyCustomerMetric[]
  stageCounts: MyCustomerStageCount[]
  followCounts: MyCustomerStageCount[]
  customers: Customer[]
  current: number
  size: number
  total: number
  hasMore: boolean
}

export interface MyCustomerQuery {
  keyword?: string
  stage?: CustomerStage
  sort?: 'risk' | 'due' | 'newest'
  current?: number
  size?: number
  /** all / overdue / today / soon / unplanned；设置后返回设计师待跟进队列。 */
  followFilter?: 'all' | 'overdue' | 'today' | 'soon' | 'unplanned'
}

export type FollowWay = 'phone' | 'visit' | 'wechat' | 'video' | 'other'

export interface CustomerFollow {
  id: string
  customerId: string
  way: FollowWay
  content: string
  empName?: string
  nextFollowAt?: string
  images?: string[]
  imageUrls?: string[]
  imageCount?: number
  requestId?: string
  createdAt?: string
}
