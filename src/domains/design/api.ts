import { post } from '@/core/http'
import { unitLabel } from '@/domains/catalog/api'
import { fileApi } from '@/domains/file/api'
import type {
  DesignItem,
  DesignItemType,
  DesignRequirement,
  DesignScheme,
  DesignSpace,
  DesignStatus,
  PricingMode,
  RequirementCategory,
  RequirementKind,
  RequirementPriority,
  RequirementStatus,
  SpaceType,
  TalkPlan,
  TalkSection,
  TalkStatus
} from './model'

type RawRecord = Record<string, unknown>

const DESIGN_STATUS: Record<string, DesignStatus> = {
  Draft: 'draft',
  Ready: 'ready',
  Presented: 'presented',
  Selected: 'selected',
  Archived: 'archived'
}

const DESIGN_STATUS_API: Record<DesignStatus, string> = {
  draft: 'Draft',
  ready: 'Ready',
  presented: 'Presented',
  selected: 'Selected',
  archived: 'Archived'
}

const REQUIREMENT_KIND: Record<string, RequirementKind> = { Demand: 'demand', Reject: 'reject' }
const REQUIREMENT_KIND_API: Record<RequirementKind, string> = { demand: 'Demand', reject: 'Reject' }

const REQUIREMENT_CATEGORY: Record<string, RequirementCategory> = {
  Function: 'function',
  Style: 'style',
  Material: 'material',
  Budget: 'budget',
  Schedule: 'schedule',
  Quality: 'quality',
  Other: 'other'
}

const REQUIREMENT_CATEGORY_API: Record<RequirementCategory, string> = {
  function: 'Function',
  style: 'Style',
  material: 'Material',
  budget: 'Budget',
  schedule: 'Schedule',
  quality: 'Quality',
  other: 'Other'
}

const REQUIREMENT_PRIORITY: Record<string, RequirementPriority> = { High: 'high', Medium: 'medium', Low: 'low' }
const REQUIREMENT_PRIORITY_API: Record<RequirementPriority, string> = { high: 'High', medium: 'Medium', low: 'Low' }

const REQUIREMENT_STATUS: Record<string, RequirementStatus> = {
  Pending: 'pending',
  Confirmed: 'confirmed',
  Resolved: 'resolved'
}

const REQUIREMENT_STATUS_API: Record<RequirementStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  resolved: 'Resolved'
}

function str(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isNaN(parsed) ? 0 : parsed
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

function normalizeRequirement(raw: RawRecord): DesignRequirement {
  const customer = recordOf(raw.customer)
  const property = recordOf(raw.property)
  return {
    id: str(raw.requirementId ?? raw.id),
    customerId: str(customer.custId ?? customer.id ?? raw.customerId) || undefined,
    customerName: str(customer.name) || undefined,
    customerCommunity: str(customer.community) || undefined,
    propertyId: str(property.propertyId ?? property.id ?? raw.propertyId) || undefined,
    propertyNo: str(property.propertyNo) || undefined,
    propertyName: str(property.community) || str(property.address) || undefined,
    propertyAddress: str(property.address) || undefined,
    kind: REQUIREMENT_KIND[enumValue(raw.kind)] ?? 'demand',
    category: REQUIREMENT_CATEGORY[enumValue(raw.category)] ?? 'other',
    priority: REQUIREMENT_PRIORITY[enumValue(raw.priority)] ?? 'medium',
    status: REQUIREMENT_STATUS[enumValue(raw.status)] ?? 'pending',
    title: str(raw.title),
    detail: str(raw.detail) || undefined,
    response: str(raw.response) || undefined,
    spaceName: str(raw.spaceName) || undefined,
    confirmedAt: str(raw.confirmedAt) || undefined
  }
}

const SPACE_TYPE: Record<string, SpaceType> = {
  Bedroom: 'bedroom',
  Kitchen: 'kitchen',
  LivingRoom: 'livingRoom',
  DiningRoom: 'diningRoom',
  Bathroom: 'bathroom',
  Balcony: 'balcony'
}

const SPACE_TYPE_API: Record<SpaceType, string> = {
  bedroom: 'Bedroom',
  kitchen: 'Kitchen',
  livingRoom: 'LivingRoom',
  diningRoom: 'DiningRoom',
  bathroom: 'Bathroom',
  balcony: 'Balcony'
}

const ITEM_TYPE: Record<string, DesignItemType> = {
  General: 'general',
  Construction: 'construction',
  Material: 'material',
  Custom: 'custom',
  Appliance: 'appliance',
  Soft: 'soft'
}

const QUANTITY_SOURCE: Record<string, 'formula' | 'manual'> = { Formula: 'formula', Manual: 'manual' }

const PRICING_MODE: Record<string, PricingMode> = {
  MaterialAndManual: 'materialAndManual',
  MaterialOnly: 'materialOnly',
  ManualOnly: 'manualOnly',
  FixedTotal: 'fixedTotal'
}

function normalizeSpace(raw: RawRecord): DesignSpace {
  return {
    id: str(raw.spaceId ?? raw.id),
    type: SPACE_TYPE[enumValue(raw.type)] ?? 'livingRoom',
    name: str(raw.name),
    length: raw.length === undefined || raw.length === null ? undefined : num(raw.length),
    width: raw.width === undefined || raw.width === null ? undefined : num(raw.width),
    height: raw.height === undefined || raw.height === null ? undefined : num(raw.height),
    area: raw.area == null ? null : num(raw.area),
    perimeter: raw.perimeter == null ? null : num(raw.perimeter),
    areaSource: raw.areaSource == null ? null : (enumValue(raw.areaSource).toLowerCase() as 'measured' | 'estimated') || null,
    sort: num(raw.sort),
    remark: str(raw.remark) || undefined
  }
}

function normalizeItem(raw: RawRecord): DesignItem {
  const space = recordOf(raw.space)
  const catalog = recordOf(raw.catalogItem)
  return {
    id: str(raw.itemId ?? raw.id),
    spaceId: str(space.spaceId ?? space.id ?? raw.spaceId) || undefined,
    catalogItemId: str(catalog.itemId ?? catalog.id ?? raw.catalogItemId) || undefined,
    type: ITEM_TYPE[enumValue(raw.type)] ?? 'construction',
    category: str(raw.category),
    name: str(raw.name),
    brand: str(raw.brand) || undefined,
    spec: str(raw.spec) || undefined,
    unit: unitLabel(raw.unit),
    quantity: num(raw.quantity),
    quantitySource: QUANTITY_SOURCE[enumValue(raw.quantitySource)] ?? ((raw.formula ? 'formula' : 'manual')),
    materialPrice: num(raw.materialPrice),
    manualPrice: num(raw.manualPrice),
    price: num(raw.price),
    amount: num(raw.amount),
    pricingMode: PRICING_MODE[enumValue(raw.pricingMode)] ?? 'materialAndManual',
    // 待补尺寸以服务端投影为准（DEC-058）；仅在后端未返回时按公式前缀兜底，兼容旧部署。
    pendingMeasure: raw.pendingMeasure == null
      ? String(raw.formula ?? '').startsWith('__PENDING_MEASURE__')
      : Boolean(raw.pendingMeasure),
    formulaRevisionNeeded: Boolean(raw.formulaRevisionNeeded),
    remark: str(raw.remark) || undefined
  }
}

function normalizeScheme(raw: RawRecord): DesignScheme {
  const customer = recordOf(raw.customer)
  const property = recordOf(raw.property)
  const spaces = Array.isArray(raw.spaces) ? (raw.spaces as RawRecord[]).map(normalizeSpace) : []
  const items = Array.isArray(raw.items) ? (raw.items as RawRecord[]).map(normalizeItem) : []
  const requirements = Array.isArray(raw.requirements)
    ? (raw.requirements as RawRecord[]).map(normalizeRequirement)
    : []
  return {
    id: str(raw.designId ?? raw.id),
    no: str(raw.no),
    name: str(raw.name),
    customerId: str(customer.custId ?? customer.id ?? raw.customerId) || undefined,
    customerName: str(customer.name) || undefined,
    propertyId: str(property.propertyId ?? property.id) || undefined,
    propertyNo: str(property.propertyNo) || undefined,
    propertyName: str(property.community) || str(property.address) || undefined,
    propertyAddress: str(property.address) || [str(property.community), str(property.building), str(property.roomNo)].filter(Boolean).join(' ') || undefined,
    propertyArea: property.area === undefined || property.area === null ? undefined : num(property.area),
    propertyLayout: str(property.layout) || undefined,
    propertyStatus: enumValue(property.status) || undefined,
    version: num(raw.version) || 1,
    style: str(raw.style) || undefined,
    status: DESIGN_STATUS[enumValue(raw.status)] ?? 'draft',
    area: num(raw.area),
    layout: str(raw.layout) || undefined,
    description: str(raw.description) || undefined,
    coverUrl: str(raw.coverUrl) || undefined,
    cadUrl: str(raw.cadUrl) || undefined,
    originalPlanUrl: str(raw.originalPlanUrl) || undefined,
    sitePhotos: Array.isArray(raw.sitePhotos) ? raw.sitePhotos.map(str).filter(Boolean) : [],
    surveyPhotos: Array.isArray(raw.surveyPhotos) ? raw.surveyPhotos.map(str).filter(Boolean) : [],
    originalPlanImages: Array.isArray(raw.originalPlanImages) ? raw.originalPlanImages.map(str).filter(Boolean) : [],
    demolitionUrl: str(raw.demolitionUrl) || undefined,
    masonryUrl: str(raw.masonryUrl) || undefined,
    optimizationUrl: str(raw.optimizationUrl) || undefined,
    spaceCount: spaces.length,
    itemCount: items.length,
    spaces,
    items,
    requirements,
    createdAt: str(recordOf(raw.createTime).dateTime ?? raw.createTime ?? raw.createdAt) || undefined,
    updatedAt: str(recordOf(raw.updateTime).dateTime ?? raw.updateTime ?? raw.updatedAt) || undefined
  }
}

async function signScheme(scheme: DesignScheme): Promise<DesignScheme> {
  const paths = [
    scheme.coverUrl,
    scheme.cadUrl,
    scheme.originalPlanUrl,
    ...scheme.sitePhotos,
    ...scheme.surveyPhotos,
    ...scheme.originalPlanImages,
    scheme.demolitionUrl,
    scheme.masonryUrl,
    scheme.optimizationUrl
  ].filter((path): path is string => Boolean(path))
  if (!paths.length) return scheme
  const signed = await fileApi.grantFiles('Design', scheme.id, paths)
  let index = 0
  const next = () => signed[index++]
  return {
    ...scheme,
    coverUrl: scheme.coverUrl ? next() : undefined,
    cadUrl: scheme.cadUrl ? next() : undefined,
    originalPlanUrl: scheme.originalPlanUrl ? next() : undefined,
    sitePhotos: scheme.sitePhotos.map(() => next() ?? ''),
    surveyPhotos: scheme.surveyPhotos.map(() => next() ?? ''),
    originalPlanImages: scheme.originalPlanImages.map(() => next() ?? ''),
    demolitionUrl: scheme.demolitionUrl ? next() : undefined,
    masonryUrl: scheme.masonryUrl ? next() : undefined,
    optimizationUrl: scheme.optimizationUrl ? next() : undefined
  }
}

export async function listSchemes(customerId: string): Promise<DesignScheme[]> {
  const raw = await post<unknown>('design/scheme/page', { customerId, current: 1, size: 100 })
  return Promise.all(pageRows(raw).map((row) => signScheme(normalizeScheme(row))))
}

export async function schemeInfo(designId: string): Promise<DesignScheme> {
  return signScheme(normalizeScheme(recordOf(await post<unknown>('design/scheme/info', { designId }))))
}

export interface SchemeInput {
  designId?: string
  customerId?: string
  propertyId?: string
  name: string
  style?: string
  layout?: string
  description?: string
  coverUrl?: string
  cadUrl?: string
  originalPlanUrl?: string
  sitePhotos?: string[]
  surveyPhotos?: string[]
  originalPlanImages?: string[]
  demolitionUrl?: string
  masonryUrl?: string
  optimizationUrl?: string
}

export async function saveScheme(input: SchemeInput): Promise<DesignScheme> {
  const uri = input.designId ? 'design/scheme/update' : 'design/scheme/save'
  return normalizeScheme(recordOf(await post<unknown>(uri, {
    designId: input.designId,
    customerId: input.customerId,
    propertyId: input.propertyId,
    name: input.name,
    style: input.style,
    layout: input.layout,
    description: input.description,
    coverUrl: fileApi.storagePath(input.coverUrl),
    cadUrl: input.cadUrl === '' ? '' : fileApi.storagePath(input.cadUrl),
    originalPlanUrl: fileApi.storagePath(input.originalPlanUrl),
    sitePhotos: (input.sitePhotos ?? []).map((path) => fileApi.storagePath(path) || path),
    surveyPhotos: (input.surveyPhotos ?? []).map((path) => fileApi.storagePath(path) || path),
    originalPlanImages: (input.originalPlanImages ?? []).map((path) => fileApi.storagePath(path) || path),
    demolitionUrl: fileApi.storagePath(input.demolitionUrl),
    masonryUrl: fileApi.storagePath(input.masonryUrl),
    optimizationUrl: fileApi.storagePath(input.optimizationUrl)
  })))
}

export async function buildScheme(designId: string, status: DesignStatus): Promise<DesignScheme> {
  return normalizeScheme(recordOf(await post<unknown>('design/scheme/build', {
    designId,
    status: DESIGN_STATUS_API[status]
  })))
}

/** 复制方案：复用 App `design/scheme/save(copyFromId)`，新方案从设计中开始。 */
export async function copyScheme(designId: string): Promise<DesignScheme> {
  return normalizeScheme(recordOf(await post<unknown>('design/scheme/save', { copyFromId: designId })))
}

/** 删除方案：仅未完成且无报价/谈单事实的方案允许删除，最终以服务端门禁为准。 */
export async function deleteScheme(designId: string): Promise<DesignScheme> {
  return normalizeScheme(recordOf(await post<unknown>('design/scheme/delete', { designId })))
}

export interface SpaceInput {
  designId: string
  spaceId?: string
  type: SpaceType
  name: string
  /** 量房快照长/宽/层高（m）：只记录现场粗测，不用于推算面积与周长。 */
  length?: number
  width?: number
  height?: number
  /** 实测面积（㎡）：设计师按 CAD 录入，必填且 > 0（DEC-062）。 */
  area?: number
  /** 实测周长（m）：设计师按 CAD 录入，必填且 > 0。 */
  perimeter?: number
  sort?: number
  remark?: string
}

export async function saveSpace(input: SpaceInput): Promise<DesignSpace> {
  return normalizeSpace(recordOf(await post<unknown>('design/space/save', {
    designId: input.designId,
    spaceId: input.spaceId,
    type: SPACE_TYPE_API[input.type],
    name: input.name,
    length: input.length,
    width: input.width,
    height: input.height,
    area: input.area,
    perimeter: input.perimeter,
    sort: input.sort,
    remark: input.remark
  })))
}

export async function deleteSpace(spaceId: string): Promise<DesignSpace> {
  return normalizeSpace(recordOf(await post<unknown>('design/space/delete', { spaceId })))
}

/**
 * 设计分项保存入参。
 *
 * <p>后端只接受「报价项目库 + 区域 + 工程量 + 备注」：名称、规格、价格、公式、计价模式
 * 一律由所选 `catalog/item` 覆盖，前端传这些值会被静默忽略。因此这里只暴露真实可写字段，
 * 与 App 设计编辑器保持一致，杜绝“显示可改、服务端不生效”的假能力。</p>
 */
export interface ItemInput {
  designId: string
  itemId?: string
  spaceId?: string
  catalogItemId: string
  quantity: number
  quantitySource?: 'formula' | 'manual'
  remark?: string
  sort?: number
}

export async function saveItem(input: ItemInput): Promise<DesignItem> {
  return normalizeItem(recordOf(await post<unknown>('design/item/save', {
    designId: input.designId,
    itemId: input.itemId,
    spaceId: input.spaceId || undefined,
    catalogItemId: input.catalogItemId,
    quantity: input.quantity,
    quantitySource: input.quantitySource === 'manual' ? 'Manual' : input.quantitySource === 'formula' ? 'Formula' : undefined,
    remark: input.remark,
    sort: input.sort
  })))
}

export async function deleteItem(itemId: string): Promise<DesignItem> {
  return normalizeItem(recordOf(await post<unknown>('design/item/delete', { itemId })))
}

/**
 * 设计分项「整表原子保存」入参（V2 基线，Web 优先能力）。
 *
 * <p>一次提交整张草稿表：新增/更新行与删除行在同一事务内完成，任一行不合法整批回滚，
 * 避免「只保存了一部分却提示成功」的静默丢行。数量允许 0（赠送）。</p>
 */
export interface SaveItemsInput {
  designId: string
  items: Array<{
    itemId?: string
    spaceId?: string
    catalogItemId: string
    quantity: number
    quantitySource?: 'formula' | 'manual'
    remark?: string
    sort?: number
  }>
  deletedItemIds: string[]
}

/** 整表原子保存并返回服务端重算后的完整方案，用于保存后读回核对。 */
export async function saveItems(input: SaveItemsInput): Promise<DesignScheme> {
  return normalizeScheme(recordOf(await post<unknown>('design/items/save', {
    designId: input.designId,
    deletedItemIds: input.deletedItemIds,
    items: input.items.map((item) => ({
      itemId: item.itemId,
      space: item.spaceId ? { spaceId: item.spaceId } : null,
      catalogItem: item.catalogItemId ? { itemId: item.catalogItemId } : null,
      quantity: item.quantity,
      quantitySource: item.quantitySource === 'manual' ? 'Manual' : item.quantitySource === 'formula' ? 'Formula' : undefined,
      remark: item.remark,
      sort: item.sort
    }))
  })))
}

export interface RequirementInput {
  requirementId?: string
  customerId: string
  propertyId?: string
  kind: RequirementKind
  category: RequirementCategory
  priority: RequirementPriority
  title: string
  detail?: string
  response?: string
  spaceName?: string
}

export interface RequirementPageQuery {
  customerId?: string
  propertyId?: string
  kind?: RequirementKind
  status?: RequirementStatus
  current?: number
  size?: number
}

/** 客户诉求分页；未传客户/房屋时由服务端按当前员工数据范围返回。 */
export async function pageRequirements(query: RequirementPageQuery = {}): Promise<DesignRequirement[]> {
  const raw = await post<unknown>('design/requirement/page', {
    customerId: query.customerId,
    propertyId: query.propertyId,
    kind: query.kind ? REQUIREMENT_KIND_API[query.kind] : undefined,
    status: query.status ? REQUIREMENT_STATUS_API[query.status] : undefined,
    current: query.current ?? 1,
    size: query.size ?? 100
  })
  return pageRows(raw).map(normalizeRequirement)
}

export async function listRequirements(customerId: string, propertyId?: string): Promise<DesignRequirement[]> {
  return pageRequirements({ customerId, propertyId })
}

export async function saveRequirement(input: RequirementInput): Promise<DesignRequirement> {
  return normalizeRequirement(recordOf(await post<unknown>('design/requirement/save', {
    requirementId: input.requirementId,
    customerId: input.customerId,
    propertyId: input.propertyId,
    kind: REQUIREMENT_KIND_API[input.kind],
    category: REQUIREMENT_CATEGORY_API[input.category],
    priority: REQUIREMENT_PRIORITY_API[input.priority],
    title: input.title,
    detail: input.detail,
    response: input.response,
    spaceName: input.spaceName
  })))
}

// ── 谈单（TalkPlan）：复用 App 既有 Provider `design/talk/*` ──────────
const TALK_STATUS: Record<string, TalkStatus> = {
  Draft: 'draft',
  Generated: 'generated',
  Published: 'published',
  Archived: 'archived'
}

function normalizeTalkSection(raw: RawRecord): TalkSection {
  return {
    id: str(raw.sectionId ?? raw.id),
    type: str(raw.type),
    title: str(raw.title),
    subtitle: str(raw.subtitle) || undefined,
    content: str(raw.content) || undefined,
    images: Array.isArray(raw.images) ? raw.images.map((item) => str(item)).filter(Boolean) : undefined,
    sort: num(raw.sort) ?? 0,
    visible: raw.visible == null ? true : raw.visible === true
  }
}

function normalizeTalk(raw: RawRecord): TalkPlan {
  return {
    id: str(raw.talkId ?? raw.id),
    no: str(raw.no),
    designId: str(raw.designId ?? recordOf(raw.design).id) || undefined,
    quoteId: str(raw.quoteId ?? recordOf(raw.quote).id) || undefined,
    designName: str(recordOf(raw.design).name) || undefined,
    quoteNo: str(recordOf(raw.quote).no) || undefined,
    title: str(raw.title),
    version: num(raw.version) ?? 1,
    status: TALK_STATUS[enumValue(raw.status)] ?? 'draft',
    coverUrl: str(raw.coverUrl) || undefined,
    outputUrl: str(raw.outputUrl) || undefined,
    description: str(raw.description) || undefined,
    builtAt: str(raw.builtAt) || undefined,
    sections: Array.isArray(raw.sections) ? (raw.sections as RawRecord[]).map(normalizeTalkSection) : undefined,
    createdAt: str(recordOf(raw.createTime).dateTime ?? raw.createTime ?? raw.createdAt) || undefined
  }
}

/** 谈单封面、PPT 与章节图片都是私有文件，展示前必须签名。 */
async function signTalk(raw: RawRecord): Promise<TalkPlan> {
  const talk = normalizeTalk(raw)
  if (!talk.id) return talk
  const paths = [
    ...(talk.coverUrl ? [talk.coverUrl] : []),
    ...(talk.outputUrl ? [talk.outputUrl] : []),
    ...(talk.sections ?? []).flatMap((section) => section.images ?? [])
  ]
  if (!paths.length) return talk
  const signed = await fileApi.grantFiles('Talk', talk.id, paths)
  let index = 0
  const next = signed[index++] ?? ''
  const out = signed[index++] ?? ''
  return {
    ...talk,
    coverUrl: talk.coverUrl ? next : undefined,
    outputUrl: talk.outputUrl ? out : undefined,
    sections: talk.sections?.map((section) => ({
      ...section,
      images: section.images?.map(() => signed[index++] ?? '')
    }))
  }
}

export async function listTalks(designId: string): Promise<TalkPlan[]> {
  const raw = await post<unknown>('design/talk/page', { designId, current: 1, size: 20 })
  return Promise.all(pageRows(raw).map(signTalk))
}

/** 生成/重新生成谈单 PPT；传 talkId 表示在同一版本上重建。 */
export async function buildTalk(designId: string, quoteId?: string, talkId?: string): Promise<TalkPlan> {
  return signTalk(recordOf(await post<unknown>('design/talk/build', { designId, quoteId, talkId })))
}

export async function talkInfo(talkId: string): Promise<TalkPlan> {
  return signTalk(recordOf(await post<unknown>('design/talk/info', { talkId })))
}

export const designApi = { listSchemes, schemeInfo, saveScheme, buildScheme, copyScheme, deleteScheme, saveSpace, deleteSpace, saveItem, saveItems, deleteItem, pageRequirements, listRequirements, saveRequirement, listTalks, buildTalk, talkInfo }
