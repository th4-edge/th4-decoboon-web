import { post } from '@/core/http'
import type { ProjectBrief } from './model'

type RawRecord = Record<string, unknown>

function str(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
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

function normalize(raw: RawRecord): ProjectBrief {
  const quote = recordOf(raw.quote)
  const customer = recordOf(raw.customer)
  const property = recordOf(raw.property)
  return {
    id: str(raw.projectId ?? raw.id),
    no: str(raw.no),
    name: str(raw.name),
    status: enumValue(raw.status),
    quoteId: str(quote.quoteId ?? quote.id ?? raw.quoteId) || undefined,
    customerId: str(customer.custId ?? customer.id ?? raw.customerId) || undefined,
    propertyId: str(property.propertyId ?? property.id ?? raw.propertyId) || undefined,
    createdAt: str(recordOf(raw.createTime).dateTime ?? raw.createTime ?? raw.createdAt) || undefined
  }
}

export async function listProjects(): Promise<ProjectBrief[]> {
  const raw = await post<unknown>('project/project/page', { current: 1, size: 200 })
  return pageRows(raw).map(normalize)
}

export const projectApi = { listProjects }
