import { post } from '@/core/http'
import type { Measure, MeasureStatus, Property, PropertyStatus } from './model'

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
    createdAt: str(recordOf(raw.createTime).dateTime ?? raw.createTime ?? raw.createdAt) || undefined
  }
}

export async function listProperties(customerId?: string): Promise<Property[]> {
  const raw = await post<unknown>('property/property/page', { customerId })
  return pageRows(raw).map(normalizeProperty)
}

export async function listMeasures(propertyId: string): Promise<Measure[]> {
  const raw = await post<unknown>('property/measure/page', { propertyId })
  return pageRows(raw).map(normalizeMeasure)
}

export interface SaveMeasureInput {
  propertyId: string
  measureTime?: string
  status: MeasureStatus
  originalStructure?: string
  dimensions?: string
  customerRequirements?: string
  designerConclusion?: string
}

export async function saveMeasure(input: SaveMeasureInput): Promise<Measure> {
  const statusMap: Record<MeasureStatus, string> = {
    scheduled: 'Scheduled',
    completed: 'Completed',
    cancelled: 'Cancelled'
  }
  return normalizeMeasure(recordOf(await post<unknown>('property/measure/save', {
    propertyId: input.propertyId,
    measureTime: input.measureTime,
    status: statusMap[input.status],
    originalStructure: input.originalStructure,
    dimensions: input.dimensions,
    customerRequirements: input.customerRequirements,
    designerConclusion: input.designerConclusion
  })))
}

export const propertyApi = { listProperties, listMeasures, saveMeasure }
