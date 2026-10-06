import { post } from '@/core/http'
import type { Customer, CustomerFollow, CustomerStage, FollowWay } from './model'

type RawRecord = Record<string, unknown>

const STAGE_FROM_STATUS: Record<string, CustomerStage> = {
  New: 'intention',
  Following: 'following',
  PendingMeasure: 'pendingMeasure',
  Quoted: 'quote',
  Signed: 'sign',
  Serving: 'construction',
  Finished: 'done',
  Lost: 'lost'
}

const STAGE_TO_API: Record<CustomerStage, string> = {
  intention: 'New',
  following: 'Following',
  pendingMeasure: 'PendingMeasure',
  quote: 'Quoted',
  sign: 'Signed',
  construction: 'Serving',
  done: 'Finished',
  lost: 'Lost'
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
  const stage = STAGE_FROM_STATUS[enumValue(raw.status ?? raw.stage)] ?? 'intention'
  return {
    id: str(raw.custId ?? raw.id),
    name: str(raw.name),
    phone: str(raw.telNo ?? raw.phone),
    stage,
    grade: (enumValue(grade.level).toUpperCase() as Customer['grade']) || undefined,
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
    measureAt: str(raw.measureAt) || undefined,
    pendingMeasureAt: str(raw.pendingMeasureAt) || undefined,
    createdAt: str(recordOf(raw.createTime).dateTime ?? raw.createTime ?? raw.createdAt) || undefined,
    tags,
    measured: tagKeys.has('measured') || tags.includes('已量房'),
    measureScheduled: tagKeys.has('measure:scheduled') || tags.includes('已预约量房')
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
    status: query.stage ? STAGE_TO_API[query.stage] : undefined
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
}

export async function saveFollow(input: FollowInput): Promise<CustomerFollow> {
  return normalizeFollow(recordOf(await post<unknown>('customer/customer-follow/save', {
    customerId: input.customerId,
    way: FOLLOW_WAY_TO_API[input.way],
    content: input.content,
    nextFollowAt: input.nextFollowAt
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
}

/** 变更客户负责人（Boss/店长；店长限本门店在职人员）。 */
export async function changeOwner(input: ChangeOwnerInput): Promise<Customer> {
  return normalizeCustomer(recordOf(await post<unknown>('customer/customer/update', {
    customerId: input.customerId,
    ownerId: input.ownerId
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

export const crmApi = { pageCustomers, customerInfo, customerFollows, saveFollow, scheduleMeasure, changeOwner, assignDesigner }
