import { post } from '@/core/http'
import { fileApi } from '@/domains/file/api'
import type { Measure, MeasureStatus, Property, PropertyRegion, PropertyStatus, SpaceTypeName } from './model'

type RawRecord = Record<string, unknown>

const PROPERTY_STATUS: Record<string, PropertyStatus> = {
  PendingMeasure: 'pendingMeasure',
  Measuring: 'measuring',
  Measured: 'measured',
  Designing: 'designing',
  Quoted: 'quoted',
  Contracted: 'contracted',
  Serving: 'serving',
  Completed: 'completed'
}

const MEASURE_STATUS: Record<string, MeasureStatus> = {
  Scheduled: 'scheduled',
  Completed: 'completed',
  Cancelled: 'cancelled'
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

function normalizeProperty(raw: RawRecord): Property {
  return {
    id: str(raw.propertyId ?? raw.id),
    propertyNo: str(raw.propertyNo),
    customerId: str(raw.customerId ?? recordOf(raw.customer).custId),
    community: str(raw.community) || undefined,
    building: str(raw.building) || undefined,
    roomNo: str(raw.roomNo) || undefined,
    address: str(raw.address),
    area: num(raw.area),
    layout: str(raw.layout) || undefined,
    status: PROPERTY_STATUS[enumValue(raw.status)] ?? 'pendingMeasure',
    latestMeasureAt: str(raw.latestMeasureAt) || undefined,
    remark: str(raw.remark) || undefined,
    createdAt: str(recordOf(raw.createTime).dateTime ?? raw.createTime ?? raw.createdAt) || undefined
  }
}

function normalizeMeasure(raw: RawRecord): Measure {
  return {
    id: str(raw.measureId ?? raw.id),
    propertyId: str(raw.propertyId ?? recordOf(raw.property).propertyId),
    measureTime: str(raw.measureTime) || undefined,
    scheduledAt: str(raw.scheduledAt) || undefined,
    completedAt: str(raw.completedAt) || undefined,
    status: MEASURE_STATUS[enumValue(raw.status)] ?? 'scheduled',
    originalStructure: str(raw.originalStructure) || undefined,
    dimensions: str(raw.dimensions) || undefined,
    customerRequirements: str(raw.customerRequirements) || undefined,
    designerConclusion: str(raw.designerConclusion) || undefined,
    sitePhotos: Array.isArray(raw.sitePhotos) ? raw.sitePhotos.map(str).filter(Boolean) : [],
    structureImages: Array.isArray(raw.structureImages) ? raw.structureImages.map(str).filter(Boolean) : [],
    attachments: Array.isArray(raw.attachments) ? raw.attachments.map(str).filter(Boolean) : [],
    createdAt: str(recordOf(raw.createTime).dateTime ?? raw.createTime ?? raw.createdAt) || undefined
  }
}

export async function listProperties(customerId?: string): Promise<Property[]> {
  const raw = await post<unknown>('property/property/page', { customerId })
  return pageRows(raw).map(normalizeProperty)
}

async function signMeasure(measure: Measure): Promise<Measure> {
  const paths = [...measure.sitePhotos, ...measure.structureImages, ...measure.attachments]
  if (!paths.length) return measure
  const signed = await fileApi.grantFiles('Measure', measure.id, paths)
  let index = 0
  return {
    ...measure,
    sitePhotos: measure.sitePhotos.map(() => signed[index++] ?? ''),
    structureImages: measure.structureImages.map(() => signed[index++] ?? ''),
    attachments: measure.attachments.map(() => signed[index++] ?? '')
  }
}

export async function listMeasures(propertyId: string): Promise<Measure[]> {
  const raw = await post<unknown>('property/measure/page', { propertyId })
  return Promise.all(pageRows(raw).map((row) => signMeasure(normalizeMeasure(row))))
}

export interface SaveMeasureInput {
  propertyId: string
  measureTime?: string
  status: MeasureStatus
  originalStructure?: string
  dimensions?: string
  customerRequirements?: string
  designerConclusion?: string
  sitePhotos?: string[]
  structureImages?: string[]
  attachments?: string[]
}

export async function saveMeasure(input: SaveMeasureInput): Promise<Measure> {
  const statusMap: Record<MeasureStatus, string> = {
    scheduled: 'Scheduled',
    completed: 'Completed',
    cancelled: 'Cancelled'
  }
  return normalizeMeasure(recordOf(await post<unknown>('property/measure/save', {
    propertyId: input.propertyId,
    measureTime: input.measureTime?.replace(' ', 'T'),
    status: statusMap[input.status],
    originalStructure: input.originalStructure,
    dimensions: input.dimensions,
    customerRequirements: input.customerRequirements,
    designerConclusion: input.designerConclusion,
    sitePhotos: input.sitePhotos?.map((path) => fileApi.storagePath(path) || path),
    structureImages: input.structureImages?.map((path) => fileApi.storagePath(path) || path),
    attachments: input.attachments?.map((path) => fileApi.storagePath(path) || path)
  })))
}

/**
 * 删除房屋。
 * 服务端门禁：房屋存在 量房/诉求/方案/报价/合同/项目 任一事实时拒绝删除并返回原因；
 * 只有完全没有附带数据的房屋允许删除。前端不自行判断，只透传服务端结论。
 */
export async function deleteProperty(propertyId: string): Promise<Property> {
  return normalizeProperty(recordOf(await post<unknown>('property/property/delete', { propertyId })))
}

export const propertyApi = { listProperties, getProperty, listMeasures, saveMeasure, saveProperty, updateProperty, deleteProperty }

export interface SavePropertyInput {
  customerId: string
  community?: string
  building?: string
  roomNo?: string
  address: string
  area?: number
  layout?: string
  remark?: string
}

export interface UpdatePropertyInput {
  propertyId: string
  community?: string
  building?: string
  roomNo?: string
  address?: string
  area?: number
  layout?: string
  remark?: string
}

/** 新增房屋档案（App `property/property/save` 同源；后端按客户数据范围校验）。 */
export async function saveProperty(input: SavePropertyInput): Promise<Property> {
  return normalizeProperty(recordOf(await post<unknown>('property/property/save', {
    customerId: input.customerId,
    community: input.community,
    building: input.building,
    roomNo: input.roomNo,
    address: input.address,
    area: input.area,
    layout: input.layout,
    remark: input.remark
  })))
}

/** 维护房屋档案（App `property/property/update` 同源）。 */
export async function updateProperty(input: UpdatePropertyInput): Promise<Property> {
  return normalizeProperty(recordOf(await post<unknown>('property/property/update', {
    propertyId: input.propertyId,
    community: input.community,
    building: input.building,
    roomNo: input.roomNo,
    address: input.address,
    area: input.area,
    layout: input.layout,
    remark: input.remark
  })))
}

/** 取指定房屋档案（复用客户房屋列表，不新开 Provider）。 */
export async function getProperty(customerId: string, propertyId: string): Promise<Property | null> {
  if (!customerId || !propertyId) return null
  const list = await listProperties(customerId)
  return list.find((item) => item.id === propertyId) ?? null
}


/** 房屋区域类型：后端枚举值 ↔ 前端语义。 */
const REGION_TYPE: Record<string, SpaceTypeName> = {
  Bedroom: 'bedroom',
  Kitchen: 'kitchen',
  LivingRoom: 'livingRoom',
  DiningRoom: 'diningRoom',
  Bathroom: 'bathroom',
  Balcony: 'balcony'
}

const REGION_TYPE_API: Record<SpaceTypeName, string> = {
  bedroom: 'Bedroom',
  kitchen: 'Kitchen',
  livingRoom: 'LivingRoom',
  diningRoom: 'DiningRoom',
  bathroom: 'Bathroom',
  balcony: 'Balcony'
}

function normalizeRegion(raw: RawRecord): PropertyRegion {
  return {
    id: str(raw.regionId ?? raw.id),
    roomKey: str(raw.roomKey) || undefined,
    type: REGION_TYPE[enumValue(raw.roomType)] ?? 'bedroom',
    name: str(raw.name),
    length: raw.length === undefined || raw.length === null ? undefined : num(raw.length),
    width: raw.width === undefined || raw.width === null ? undefined : num(raw.width),
    height: raw.height === undefined || raw.height === null ? undefined : num(raw.height),
    area: raw.area == null ? null : num(raw.area),
    perimeter: raw.perimeter == null ? null : num(raw.perimeter),
    areaSource: raw.areaSource == null
      ? null
      : ((enumValue(raw.areaSource).toLowerCase() as 'measured' | 'estimated') || null),
    measuredAt: str(raw.measuredAt) || undefined,
    sort: num(raw.sort),
    remark: str(raw.remark) || undefined,
    linkedDesignCount: raw.linkedDesignCount == null ? undefined : num(raw.linkedDesignCount),
    pendingDesignCount: raw.pendingDesignCount == null ? undefined : num(raw.pendingDesignCount)
  }
}

/** 房屋区域实测档案列表（区域实测值的事实源）。 */
export async function listPropertyRegions(propertyId: string): Promise<PropertyRegion[]> {
  const raw = await post<unknown>('property/region/list', { propertyId })
  return (Array.isArray(raw) ? (raw as RawRecord[]) : []).map(normalizeRegion)
}

export interface SavePropertyRegionInput {
  propertyId: string
  regionId?: string
  roomKey?: string
  type: SpaceTypeName
  name: string
  length?: number
  width?: number
  height?: number
  /** 实测面积（㎡）/ 实测周长（m）：留空表示未录入，不得用 0 表达未录入。 */
  area?: number
  perimeter?: number
  sort?: number
  remark?: string
}

export async function savePropertyRegion(input: SavePropertyRegionInput): Promise<PropertyRegion> {
  return normalizeRegion(recordOf(await post<unknown>('property/region/save', {
    propertyId: input.propertyId,
    regionId: input.regionId,
    roomKey: input.roomKey,
    roomType: REGION_TYPE_API[input.type],
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

export async function deletePropertyRegion(regionId: string): Promise<PropertyRegion> {
  return normalizeRegion(recordOf(await post<unknown>('property/region/delete', { regionId })))
}

/** 历史方案区域实测值 → 房屋档案候选清单（只读；人工确认后再保存，不自动写入）。 */
export async function propertyRegionCandidates(propertyId: string): Promise<PropertyRegion[]> {
  const raw = await post<unknown>('property/region/candidates', { propertyId })
  return (Array.isArray(raw) ? (raw as RawRecord[]) : []).map((row) => ({
    ...normalizeRegion(row),
    fromCandidate: true
  }))
}
