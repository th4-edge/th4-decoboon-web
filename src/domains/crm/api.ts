import { post } from '@/core/http'
import type {
  Customer,
  CustomerFollow,
  CustomerStage,
  FollowWay,
  MyCustomerOverview,
  MyCustomerQuery
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
  return {
    id: str(raw.custId ?? raw.id),
    name: str(raw.name),
    phone: str(raw.telNo ?? raw.phone),
    stage,
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
    imageUrls: Array.isArray(raw.imageUrls) ? raw.imageUrls.map((item) => str(item)).filter(Boolean) : [],
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
}

export async function pageCustomers(query: CustomerPageQuery = {}): Promise<Customer[]> {
  const raw = await post<unknown>('customer/customer/page', {
    current: query.current ?? 1,
    size: query.size ?? 100,
    keyword: query.keyword?.trim() || undefined,
    status: query.stage && query.stage !== 'unknown' ? STAGE_TO_API[query.stage] : undefined
  })
  return pageRows(raw).map(normalizeCustomer)
}

export async function customerInfo(customerId: string): Promise<Customer> {
  return normalizeCustomer(recordOf(await post<unknown>('customer/customer/info', { customerId })))
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
    sort: query.sort || undefined
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
  savePortrait,
  saveCustomer
}
