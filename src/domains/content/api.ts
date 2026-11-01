import { post } from '@/core/http'
import type { ContentAttributionConfidence, ContentAttributionType, LeadTouch } from './model'

type RawRecord = Record<string, unknown>

function recordOf(raw: unknown): RawRecord {
  return raw && typeof raw === 'object' ? raw as RawRecord : {}
}

function valueOf(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const value = raw as RawRecord
    return String(value.value ?? value.key ?? value.name ?? '')
  }
  return ''
}

function attributionTypeOf(raw: unknown): ContentAttributionType {
  const value = valueOf(raw).toLowerCase()
  if (value === 'platform') return 'platform'
  if (value === 'uniquecode' || value === 'unique_code') return 'uniqueCode'
  if (value === 'selfreport' || value === 'self_report') return 'selfReport'
  if (value === 'inference') return 'inference'
  return 'manual'
}

function confidenceOf(raw: unknown): ContentAttributionConfidence {
  const value = valueOf(raw).toLowerCase()
  return value === 'high' || value === 'low' ? value : 'medium'
}

function normalizeLeadTouch(raw: unknown): LeadTouch {
  const row = recordOf(raw)
  const task = recordOf(row.task)
  const employee = recordOf(row.employee)
  const employeeContent = recordOf(row.employeeContent)
  return {
    id: String(row.id ?? row.touchId ?? ''),
    attributionType: attributionTypeOf(row.attributionType),
    confidence: confidenceOf(row.confidence),
    isPrimary: row.isPrimary === true || valueOf(row.isPrimary).toLowerCase() === 'true',
    evidence: typeof row.evidence === 'string' ? row.evidence : undefined,
    touchedAt: typeof row.touchedAt === 'string' ? row.touchedAt : undefined,
    taskTitle: typeof task.title === 'string' ? task.title : undefined,
    employeeName: typeof employee.name === 'string' ? employee.name : undefined,
    contentCaption: typeof employeeContent.caption === 'string' ? employeeContent.caption : undefined
  }
}

export async function listLeadTouches(customerId: string): Promise<LeadTouch[]> {
  const rows = await post<unknown[]>('content/lead-touch/list', { customerId })
  return (Array.isArray(rows) ? rows : []).map(normalizeLeadTouch).filter(item => item.id)
}
