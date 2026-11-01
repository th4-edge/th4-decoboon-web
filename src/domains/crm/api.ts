import { post } from '@/core/http'
import { fileApi } from '@/domains/file/api'
import type {
  StoreScopeInfo,
  Customer,
  CustomerFollow,
  CustomerStage,
  FollowWay,
  MyCustomerOverview,
  MyCustomerQuery,
  CustomerLossRecord,
  CustomerOverviewReport,
  CustomerMetricCard,
  CustomerStageCount
} from './model'

type RawRecord = Record<string, unknown>

const STAGE_FROM_STATUS: Record<string, CustomerStage> = {
  New: 'intention',
  Following: 'following',
  PendingMeasure: 'pendingMeasure',
  Quoted: 'quote',
  Signed: 'sign',
  Serving: 'construction',
  Finished: 'done',
  Lost: 'lost',
  Dormant: 'dormant'
}

const STAGE_TO_API: Record<CustomerStage, string> = {
  intention: 'New',
  following: 'Following',
  pendingMeasure: 'PendingMeasure',
  quote: 'Quoted',
  sign: 'Signed',
  construction: 'Serving',
  done: 'Finished',
  lost: 'Lost',
  dormant: 'Dormant',
  unknown: ''
}

const FOLLOW_WAY_FROM_API: Record<string, FollowWay> = {
  Phone: 'phone',
  Visit: 'visit',
  Wechat: 'wechat',
  Video: 'video',
  Other: 'other'
}

const FOLLOW_WAY_TO_API: Record<FollowWay, string> = {
  phone: 'Phone',
  visit: 'Visit',
  wechat: 'Wechat',
  video: 'Video',
  other: 'Other'
}

function str(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

function num(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

function enumValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const record = raw as RawRecord
    return str(record.value ?? record.key ?? record.name)
  }
  return ''
}

function recordOf(raw: unknown): RawRecord {
  return raw && typeof raw === 'object' ? raw as RawRecord : {}
}

function pageRows(raw: unknown): RawRecord[] {
  if (Array.isArray(raw)) return raw as RawRecord[]
  const record = recordOf(raw)
  for (const key of ['content', 'list', 'records']) {
    if (Array.isArray(record[key])) return record[key] as RawRecord[]
  }
  return []
}

function normalizeCustomer(raw: RawRecord): Customer {
  const grade = recordOf(raw.grade)
  const designer = recordOf(raw.designer)
  const owner = recordOf(raw.owner)
  const rawTags = Array.isArray(raw.tags) ? raw.tags.map((tag) => recordOf(tag)) : []
  const tags = rawTags.map((tag) => str(tag.name)).filter(Boolean)
  const tagKeys = new Set(rawTags.map((tag) => str(tag.key)).filter(Boolean))
  const stage = STAGE_FROM_STATUS[enumValue(raw.status ?? raw.stage)] ?? 'unknown'
  const store = recordOf(raw.store)
  const storeId = str(store.storeId ?? store.id)
  return {
    id: str(raw.custId ?? raw.id),
    name: str(raw.name),
    phone: str(raw.telNo ?? raw.phone),
    stage,
    store: storeId ? { id: storeId, name: str(store.name) } : undefined,
    gender: enumValue(raw.gender) || undefined,
    source: enumValue(raw.source) || undefined,
    grade: (['A', 'B', 'C'].includes(enumValue(grade.level ?? raw.grade).toUpperCase())
      ? enumValue(grade.level ?? raw.grade).toUpperCase() as Customer['grade']
      : undefined),
    community: str(raw.community) || undefined,
    addr: str(raw.addr ?? raw.address) || undefined,
    area: num(raw.area),
    budget: num(raw.budget),
    ownerId: str(owner.empId ?? owner.id) || undefined,
    ownerName: str(owner.name) || undefined,
    designerId: str(designer.empId ?? designer.id) || undefined,
    designerName: str(designer.name) || undefined,
    remark: str(raw.remark) || undefined,
    lastFollowAt: str(raw.lastFollowAt) || undefined,
    nextFollowAt: str(raw.nextFollowAt) || undefined,
    wechatAdded: raw.wechatAdded === true,
    wechatNo: str(raw.wechatNo) || undefined,
    wechatAddedAt: str(raw.wechatAddedAt) || undefined,
    visitCount: num(raw.visitCount),
    lastVisitAt: str(raw.lastVisitAt) || undefined,
    dormantReason: str(raw.dormantReason) || undefined,
    dormantReasonText: str(raw.dormantReasonText) || undefined,
    dormantAt: str(raw.dormantAt) || undefined,
    dormantByName: str(recordOf(raw.dormantBy).name) || undefined,
    restoredAt: str(raw.restoredAt) || undefined,
    restoredByName: str(recordOf(raw.restoredBy).name) || undefined,
    lossId: str(raw.lossId) || undefined,
    lossScope: (enumValue(raw.lossScope) as Customer['lossScope']) || undefined,
    lossStage: (enumValue(raw.lossStage) as Customer['lossStage']) || undefined,
    lossReason: (enumValue(raw.lossReason) as Customer['lossReason']) || undefined,
    lossReasonText: str(raw.lossReasonText) || undefined,
    competitorName: str(raw.competitorName) || undefined,
    lostAt: str(raw.lostAt) || undefined,
    lostByName: str(recordOf(raw.lostBy).name) || undefined,
    lossPropertyId: str(raw.lossPropertyId) || undefined,
    lossPropertyName: str(raw.lossPropertyName) || undefined,
    lossFromStatus: str(raw.lossFromStatus) || undefined,
    activeLossCount: num(raw.activeLossCount),
    partialLoss: raw.partialLoss === true,
    measureAt: str(raw.measureAt) || undefined,
    pendingMeasureAt: str(raw.pendingMeasureAt) || undefined,
    createdAt: str(recordOf(raw.createTime).dateTime ?? raw.createTime ?? raw.createdAt) || undefined,
    tags,
    measured: tagKeys.has('measured') || tags.includes('已量房'),
    measureScheduled: tagKeys.has('measure:scheduled') || tags.includes('已预约量房'),
    idleDays: num(raw.idleDays),
    riskLevel: (enumValue(raw.riskLevel) as Customer['riskLevel']) || undefined,
    riskReason: str(raw.riskReason) || undefined,
    nextAction: str(raw.nextAction) || undefined,
    mainlineKey: str(raw.mainlineKey) || undefined,
    mainlineLabel: str(raw.mainlineLabel) || undefined,
    mainlineHint: str(raw.mainlineHint) || undefined,
    quoteAmount: num(raw.quoteAmount),
    signedAmount: num(raw.signedAmount),
    projectId: str(raw.projectId) || undefined,
    projectName: str(raw.projectName) || undefined,
    portrait: raw.portrait && typeof raw.portrait === 'object' ? recordOf(raw.portrait) : null
  }
}

function normalizeFollow(raw: RawRecord): CustomerFollow {
  const emp = recordOf(raw.emp ?? raw.employee)
  const way = FOLLOW_WAY_FROM_API[enumValue(raw.way)] ?? 'other'
  return {
    id: str(raw.followId ?? raw.id),
    customerId: str(raw.customerId ?? recordOf(raw.customer).custId),
    way,
    content: str(raw.content),
    empName: str(emp.name) || undefined,
    nextFollowAt: str(raw.nextFollowAt) || undefined,
    images: Array.isArray(raw.images) ? raw.images.map((item) => str(item)).filter(Boolean) : [],
    imageUrls: Array.isArray(raw.imageUrls) ? raw.imageUrls.map((item) => fileApi.absolute(str(item))).filter(Boolean) : [],
    imageCount: Number(raw.imageCount ?? (Array.isArray(raw.images) ? raw.images.length : 0)),
    requestId: str(raw.requestId) || undefined,
    createdAt: str(recordOf(raw.createTime).dateTime ?? raw.createTime ?? raw.createdAt) || undefined
  }
}

export interface CustomerPageQuery {
  keyword?: string
  stage?: CustomerStage
  current?: number
  size?: number
  /**
   * 门店维度（`DEC-067` BOSS-STORE-07/10）：**只传真实门店 ID**；
   * 「全部门店」不传（绝不把 UI 状态值 `'0'` 当门店 ID 发给服务端）。
   */
  storeId?: string | null
}

export async function pageCustomers(query: CustomerPageQuery = {}): Promise<Customer[]> {
  const storeId = query.storeId?.trim()
  const raw = await post<unknown>('customer/customer/page', {
    current: query.current ?? 1,
    size: query.size ?? 100,
    keyword: query.keyword?.trim() || undefined,
    status: query.stage && query.stage !== 'unknown' ? STAGE_TO_API[query.stage] : undefined,
    storeId: storeId && storeId !== '0' ? storeId : undefined
  })
  return pageRows(raw).map(normalizeCustomer)
}

/**
 * 客户经营聚合（`customer/customer/overview`，App 已在用）：只取门店维度范围标注，
 * 用于「含未归属门店 N 条」的**全量口径**（当前页 200 行计数只作降级兜底）。
 */
export async function customerOverviewScope(storeId?: string | null): Promise<StoreScopeInfo> {
  const value = storeId?.trim()
  const raw = recordOf(await post<unknown>('customer/customer/overview', {
    current: 1,
    size: 1,
    storeId: value && value !== '0' ? value : undefined
  }))
  const scope = recordOf(raw.storeScope)
  const scopedStoreId = str(scope.storeId)
  return {
    scopeType: str(scope.scopeType) === 'Store' ? 'Store' : 'AllStores',
    storeId: scopedStoreId || undefined,
    storeName: str(scope.storeName) || undefined,
    unassignedCount: num(scope.unassignedCount) ?? 0
  }
}

export async function customerInfo(customerId: string): Promise<Customer> {
  return normalizeCustomer(recordOf(await post<unknown>('customer/customer/info', { customerId })))
}
export interface CustomerOverviewQuery {
  current?: number
  size?: number
  keyword?: string
  stage?: CustomerStage | 'all'
  sort?: 'risk' | 'due' | 'newest' | 'value'
  storeId?: string | null
  ownerId?: string | null
}

/** 企业负责人客户经营聚合；复用 App 已在使用的 customer/customer/overview。 */
export async function customerOverview(query: CustomerOverviewQuery = {}): Promise<CustomerOverviewReport> {
  const raw = recordOf(await post<unknown>('customer/customer/overview', {
    current: query.current ?? 1,
    size: Math.min(query.size ?? 20, 20),
    keyword: query.keyword?.trim() || undefined,
    stage: query.stage || 'all',
    sort: query.sort || 'risk',
    storeId: query.storeId?.trim() && query.storeId !== '0' ? query.storeId : undefined,
    ownerId: query.ownerId || undefined
  }))
  const metric = (item: unknown): CustomerMetricCard => {
    const row = recordOf(item)
    return {
      key: str(row.key),
      label: str(row.label),
      value: num(row.value) ?? 0,
      valueType: str(row.valueType) || 'count',
      status: str(row.status) || 'normal',
      subText: str(row.subText),
      trendRate: row.trendRate == null ? undefined : num(row.trendRate),
      periods: Array.isArray(row.periods) ? row.periods.map((period) => {
        const value = recordOf(period)
        return { key: str(value.key), label: str(value.label), value: num(value.value) ?? 0, valueType: str(value.valueType) || 'count' }
      }) : undefined
    }
  }
  const stage = (item: unknown): CustomerStageCount => {
    const row = recordOf(item)
    return { key: str(row.key), label: str(row.label), count: num(row.count) ?? 0 }
  }
  const scope = recordOf(raw.storeScope)
  return {
    asOf: str(raw.asOf) || undefined,
    month: str(raw.month) || undefined,
    metrics: Array.isArray(raw.metrics) ? raw.metrics.map(metric) : [],
    stageCounts: Array.isArray(raw.stageCounts) ? raw.stageCounts.map(stage) : [],
    ownerGroups: Array.isArray(raw.ownerGroups) ? raw.ownerGroups.map((item) => {
      const group = recordOf(item)
      return {
        ownerId: group.ownerId == null ? null : str(group.ownerId),
        ownerName: str(group.ownerName) || '未分配负责人',
        storeName: group.storeName ? str(group.storeName) : null,
        customerCount: num(group.customerCount) ?? 0,
        riskCustomerCount: num(group.riskCustomerCount) ?? 0,
        pendingMeasureCount: num(group.pendingMeasureCount) ?? 0,
        signedCustomerCount: num(group.signedCustomerCount) ?? 0,
        quoteAmount: num(group.quoteAmount) ?? 0,
        signedAmount: num(group.signedAmount) ?? 0
      }
    }) : [],
    customers: (Array.isArray(raw.customers) ? raw.customers : pageRows(raw))
      .map(item => normalizeCustomer(recordOf(item))),
    current: num(raw.current) ?? 1,
    size: num(raw.size) ?? 200,
    total: num(raw.total) ?? 0,
    hasMore: raw.hasMore === true,
    storeScope: Object.keys(scope).length ? {
      scopeType: str(scope.scopeType) === 'Store' ? 'Store' : 'AllStores',
      storeId: str(scope.storeId) || undefined,
      storeName: str(scope.storeName) || undefined,
      unassignedCount: num(scope.unassignedCount) ?? 0
    } : undefined
  }
}

export async function customerFollows(customerId: string): Promise<CustomerFollow[]> {
  const raw = await post<unknown>('customer/customer-follow/page', { customerId, current: 1, size: 100 })
  return pageRows(raw).map(normalizeFollow)
}

export interface FollowInput {
  customerId: string
  way: FollowWay
  content: string
  nextFollowAt?: string
  images?: string[]
  requestId?: string
}

export async function saveFollow(input: FollowInput): Promise<CustomerFollow> {
  return normalizeFollow(recordOf(await post<unknown>('customer/customer-follow/save', {
    customerId: input.customerId,
    way: FOLLOW_WAY_TO_API[input.way],
    content: input.content,
    nextFollowAt: input.nextFollowAt,
    images: input.images || [],
    requestId: input.requestId
  })))
}

export async function scheduleMeasure(customerId: string, propertyId: string, measureAt: string): Promise<Customer> {
  return normalizeCustomer(recordOf(await post<unknown>('customer/customer/measure', {
    customerId,
    propertyId,
    measureAt: measureAt.replace(' ', 'T')
  })))
}

export interface ChangeOwnerInput {
  customerId: string
  ownerId: string
  reason: string
}

/** 变更客户负责人（Boss/店长；店长限本门店在职人员，必须填写变更原因）。 */
export async function changeOwner(input: ChangeOwnerInput): Promise<Customer> {
  return normalizeCustomer(recordOf(await post<unknown>('customer/customer/update', {
    customerId: input.customerId,
    ownerId: input.ownerId,
    reason: input.reason.trim()
  })))
}

export interface AssignDesignerInput {
  customerId: string
  designerId: string
  propertyId?: string
}

/** 指派/改派客户当前设计师（Boss/店长/团队负责人，按数据范围）。 */
export async function assignDesigner(input: AssignDesignerInput): Promise<Customer> {
  return normalizeCustomer(recordOf(await post<unknown>('customer/customer/handoff', {
    customerId: input.customerId,
    designerId: input.designerId,
    propertyId: input.propertyId
  })))
}

/** 设计师「我的客户」聚合：统计 + 阶段计数 + 客户分页，全部由服务端按登录员工范围返回。 */
export async function myCustomerOverview(query: MyCustomerQuery = {}): Promise<MyCustomerOverview> {
  const raw = await post<unknown>('customer/my-customer/overview', {
    current: query.current ?? 1,
    size: query.size ?? 24,
    keyword: query.keyword?.trim() || undefined,
    stage: query.stage || undefined,
    sort: query.sort || undefined,
    followFilter: query.followFilter || undefined
  })
  const record = recordOf(raw)
  return {
    asOf: str(record.asOf) || undefined,
    metrics: (Array.isArray(record.metrics) ? record.metrics : []).map((item) => {
      const row = recordOf(item)
      return {
        key: str(row.key),
        label: str(row.label),
        value: num(row.value) ?? 0,
        subText: str(row.subText) || undefined
      }
    }),
    stageCounts: (Array.isArray(record.stageCounts) ? record.stageCounts : []).map((item) => {
      const row = recordOf(item)
      return { key: str(row.key), label: str(row.label), count: num(row.count) ?? 0 }
    }),
    followCounts: (Array.isArray(record.followCounts) ? record.followCounts : []).map((item) => {
      const row = recordOf(item)
      return { key: str(row.key), label: str(row.label), count: num(row.count) ?? 0 }
    }),
    customers: (Array.isArray(record.customers) ? record.customers : []).map((item) => normalizeCustomer(recordOf(item))),
    current: num(record.current) ?? 1,
    size: num(record.size) ?? 24,
    total: num(record.total) ?? 0,
    hasMore: record.hasMore === true
  }
}

export interface CustomerUpdateInput {
  customerId: string
  name?: string
  telNo?: string
  gender?: string
  source?: string
  community?: string
  addr?: string
  area?: number
  budget?: number
  remark?: string
}

/** 客户基本信息编辑（企业/门店/团队/角色不由前端提交）。 */
export async function updateCustomer(input: CustomerUpdateInput): Promise<Customer> {
  return normalizeCustomer(recordOf(await post<unknown>('customer/customer/update', { ...input })))
}

export interface CustomerCreateInput {
  name: string
  telNo: string
  gender?: string
  source?: string
  community?: string
  addr?: string
  area?: number
  budget?: number
  remark?: string
}

/** 新增客户：姓名与手机号必填（服务端 @NotEmpty），企业与负责人由服务端按登录员工裁决。 */
export async function saveCustomer(input: CustomerCreateInput): Promise<Customer> {
  return normalizeCustomer(recordOf(await post<unknown>('customer/customer/save', { ...input })))
}

/** 记录客户已加微信（复用 App `customer/customer/wechat`）。 */
export async function recordWechat(customerId: string, wechatNo?: string): Promise<Customer> {
  return normalizeCustomer(recordOf(await post<unknown>('customer/customer/wechat', {
    customerId,
    wechatNo: wechatNo?.trim() || undefined
  })))
}

/** 记一次客户到店（复用 App `customer/customer/visit`）。 */
export async function recordVisit(customerId: string): Promise<Customer> {
  return normalizeCustomer(recordOf(await post<unknown>('customer/customer/visit', { customerId })))
}

function normalizeLoss(raw: RawRecord): CustomerLossRecord {
  const lostBy = recordOf(raw.lostBy)
  const restoredBy = recordOf(raw.restoredBy)
  const property = recordOf(raw.property)
  return {
    id: str(raw.lossId),
    scope: enumValue(raw.scope) as CustomerLossRecord['scope'],
    stage: enumValue(raw.stage) as CustomerLossRecord['stage'],
    fromStatus: enumValue(raw.fromStatus) || undefined,
    reasonCode: enumValue(raw.reasonCode) as CustomerLossRecord['reasonCode'],
    reasonText: str(raw.reasonText) || undefined,
    competitorName: str(raw.competitorName) || undefined,
    lostAt: str(raw.lostAt) || undefined,
    lostByName: str(lostBy.name) || undefined,
    propertyId: str(property.propertyId) || undefined,
    propertyName: [str(property.community), str(property.building), str(property.roomNo)].filter(Boolean).join(' ') || undefined,
    restoredAt: str(raw.restoredAt) || undefined,
    restoredByName: str(restoredBy.name) || undefined,
    restoreStatus: enumValue(raw.restoreStatus) || undefined,
    restoreNote: str(raw.restoreNote) || undefined
  }
}

export interface MarkCustomerLossInput {
  customerId: string
  propertyId?: string
  scope: 'Customer' | 'Property'
  stage: string
  reasonCode: string
  reasonText?: string
  competitorName?: string
  expectedStatus?: string
  requestId?: string
}

/** 标记客户或单套房屋在签约前流失。 */
export async function markCustomerLoss(input: MarkCustomerLossInput): Promise<CustomerLossRecord> {
  return normalizeLoss(recordOf(await post<unknown>('customer/loss/save', {
    ...input,
    reasonText: input.reasonText?.trim() || undefined,
    competitorName: input.competitorName?.trim() || undefined,
    requestId: input.requestId || `web-loss-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  })))
}

/** 恢复一条流失记录；是否恢复客户整体状态由服务端按剩余流失事实裁决。 */
export async function restoreCustomerLoss(lossId: string, restoreStatus?: string, restoreNote?: string, requestId?: string): Promise<CustomerLossRecord> {
  return normalizeLoss(recordOf(await post<unknown>('customer/loss/update', {
    lossId,
    restoreStatus,
    restoreNote: restoreNote?.trim() || undefined,
    requestId: requestId || `web-restore-loss-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  })))
}

/** 客户流失历史，服务端分页。 */
export async function customerLossHistory(customerId: string, current = 1, size = 20): Promise<CustomerLossRecord[]> {
  const raw = await post<unknown>('customer/loss/page', { customerId, current, size })
  return pageRows(raw).map(normalizeLoss)
}

/** 设置休眠客户；服务端重新校验角色、数据范围和状态前置。 */
export async function setDormant(customerId: string, reasonCode: string, reasonText?: string, expectedStatus?: string): Promise<Customer> {
  return normalizeCustomer(recordOf(await post<unknown>('customer/customer/dormant', {
    customerId,
    reasonCode,
    reasonText: reasonText?.trim() || undefined,
    expectedStatus,
    requestId: `web-dormant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  })))
}

/** 恢复休眠客户；不传恢复状态时由服务端回到休眠前状态。 */
export async function resumeDormant(customerId: string, restoreStatus?: string, nextFollowAt?: string): Promise<Customer> {
  return normalizeCustomer(recordOf(await post<unknown>('customer/customer/resume', {
    customerId,
    restoreStatus,
    nextFollowAt,
    requestId: `web-resume-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  })))
}

export interface PortraitSaveInput {
  customerId: string
  decisionRole?: string
  purpose?: string
  houseCondition?: string
  startWindow?: string
  style?: string
  eco?: string
  household?: string
  payment?: string
  competitor?: string
  concerns?: string[]
}

/** 客户画像保存：字段为空表示未填写，不做默认值补齐。 */
export async function savePortrait(input: PortraitSaveInput): Promise<void> {
  await post<unknown>('customer/customer-portrait/save', { ...input })
}

export const crmApi = {
  pageCustomers,
  customerOverviewScope,
  customerOverview,
  customerInfo,
  customerFollows,
  saveFollow,
  scheduleMeasure,
  changeOwner,
  assignDesigner,
  myCustomerOverview,
  updateCustomer,
  recordWechat,
  recordVisit,
  setDormant,
  resumeDormant,
  markCustomerLoss,
  restoreCustomerLoss,
  customerLossHistory,
  savePortrait,
  saveCustomer
}
