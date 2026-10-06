import { post } from '@/core/http'
import type {
  DesignRequirement,
  DesignScheme,
  DesignStatus,
  RequirementCategory,
  RequirementKind,
  RequirementPriority,
  RequirementStatus
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

function normalizeScheme(raw: RawRecord): DesignScheme {
  const property = recordOf(raw.property)
  const spaces = Array.isArray(raw.spaces) ? raw.spaces : []
  const items = Array.isArray(raw.items) ? raw.items : []
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
    spaceCount: spaces.length,
    itemCount: items.length,
    requirements,
    createdAt: str(recordOf(raw.createTime).dateTime ?? raw.createTime ?? raw.createdAt) || undefined,
    updatedAt: str(recordOf(raw.updateTime).dateTime ?? raw.updateTime ?? raw.updatedAt) || undefined
  }
}

export async function listSchemes(customerId: string): Promise<DesignScheme[]> {
  const raw = await post<unknown>('design/scheme/page', { customerId, current: 1, size: 100 })
  return pageRows(raw).map(normalizeScheme)
}

export async function schemeInfo(designId: string): Promise<DesignScheme> {
  return normalizeScheme(recordOf(await post<unknown>('design/scheme/info', { designId })))
}

export interface SchemeInput {
  designId?: string
  customerId: string
  propertyId?: string
  name: string
  style?: string
  layout?: string
  description?: string
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
    description: input.description
  })))
}

export async function buildScheme(designId: string, status: DesignStatus): Promise<DesignScheme> {
  return normalizeScheme(recordOf(await post<unknown>('design/scheme/build', {
    designId,
    status: DESIGN_STATUS_API[status]
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

export const designApi = { listSchemes, schemeInfo, saveScheme, buildScheme, listRequirements, saveRequirement }
