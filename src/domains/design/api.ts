import { post } from '@/core/http'
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
  SpaceType
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
  return {
    id: str(raw.requirementId ?? raw.id),
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

const ITEM_TYPE_API: Record<DesignItemType, string> = {
  general: 'General',
  construction: 'Construction',
  material: 'Material',
  custom: 'Custom',
  appliance: 'Appliance',
  soft: 'Soft'
}

const PRICING_MODE: Record<string, PricingMode> = {
  MaterialAndManual: 'materialAndManual',
  MaterialOnly: 'materialOnly',
  ManualOnly: 'manualOnly',
  FixedTotal: 'fixedTotal'
}

const PRICING_MODE_API: Record<PricingMode, string> = {
  materialAndManual: 'MaterialAndManual',
  materialOnly: 'MaterialOnly',
  manualOnly: 'ManualOnly',
  fixedTotal: 'FixedTotal'
}

const UNIT_API: Record<string, string> = {
  '㎡': 'Area',
  'm²': 'Area',
  'm': 'Metre',
  '米': 'Metre',
  '项': 'Item',
  '个': 'Count',
  '处': 'Place',
  '套': 'Set',
  '樘': 'Plate',
  '台': 'Pcs',
  '只': 'Pcs'
}

function normalizeSpace(raw: RawRecord): DesignSpace {
  return {
    id: str(raw.spaceId ?? raw.id),
    type: SPACE_TYPE[enumValue(raw.type)] ?? 'livingRoom',
    name: str(raw.name),
    length: raw.length === undefined || raw.length === null ? undefined : num(raw.length),
    width: raw.width === undefined || raw.width === null ? undefined : num(raw.width),
    height: raw.height === undefined || raw.height === null ? undefined : num(raw.height),
    area: num(raw.area),
    perimeter: num(raw.perimeter),
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
    unit: str(raw.unit),
    quantity: num(raw.quantity),
    materialPrice: num(raw.materialPrice),
    manualPrice: num(raw.manualPrice),
    price: num(raw.price),
    amount: num(raw.amount),
    pricingMode: PRICING_MODE[enumValue(raw.pricingMode)] ?? 'materialAndManual',
    remark: str(raw.remark) || undefined
  }
}

function normalizeScheme(raw: RawRecord): DesignScheme {
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
    propertyId: str(property.propertyId ?? property.id) || undefined,
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

export interface SpaceInput {
  designId: string
  spaceId?: string
  type: SpaceType
  name: string
  length?: number
  width?: number
  height?: number
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
    sort: input.sort,
    remark: input.remark
  })))
}

export async function deleteSpace(spaceId: string): Promise<DesignSpace> {
  return normalizeSpace(recordOf(await post<unknown>('design/space/delete', { spaceId })))
}

export interface ItemInput {
  designId: string
  itemId?: string
  spaceId?: string
  catalogItemId?: string
  type?: DesignItemType
  category?: string
  name?: string
  brand?: string
  spec?: string
  unit?: string
  quantity: number
  materialPrice?: number
  manualPrice?: number
  costPrice?: number
  pricingMode?: PricingMode
  criterion?: string
  remark?: string
  sort?: number
}

export async function saveItem(input: ItemInput): Promise<DesignItem> {
  return normalizeItem(recordOf(await post<unknown>('design/item/save', {
    designId: input.designId,
    itemId: input.itemId,
    spaceId: input.spaceId,
    catalogItemId: input.catalogItemId,
    type: input.type ? ITEM_TYPE_API[input.type] : undefined,
    category: input.category,
    name: input.name,
    brand: input.brand,
    spec: input.spec,
    unit: input.unit ? (UNIT_API[input.unit] ?? input.unit) : undefined,
    quantity: input.quantity,
    materialPrice: input.materialPrice,
    manualPrice: input.manualPrice,
    costPrice: input.costPrice,
    pricingMode: input.pricingMode ? PRICING_MODE_API[input.pricingMode] : undefined,
    criterion: input.criterion,
    remark: input.remark,
    sort: input.sort
  })))
}

export async function deleteItem(itemId: string): Promise<DesignItem> {
  return normalizeItem(recordOf(await post<unknown>('design/item/delete', { itemId })))
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

export async function listRequirements(customerId: string, propertyId?: string): Promise<DesignRequirement[]> {
  const raw = await post<unknown>('design/requirement/page', { customerId, propertyId, current: 1, size: 100 })
  return pageRows(raw).map(normalizeRequirement)
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

export const designApi = { listSchemes, schemeInfo, saveScheme, buildScheme, saveSpace, deleteSpace, saveItem, deleteItem, listRequirements, saveRequirement }
