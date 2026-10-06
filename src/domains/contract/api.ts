import { post } from '@/core/http'
import type { Contract, ContractStatus } from './model'

type RawRecord = Record<string, unknown>

const CONTRACT_STATUS: Record<string, ContractStatus> = {
  Draft: 'draft',
  PendingSign: 'pendingSign',
  Signed: 'signed',
  Effective: 'effective',
  Changing: 'changing',
  Active: 'active',
  Changed: 'changed',
  Completed: 'completed',
  Closed: 'closed',
  Settled: 'settled'
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

function normalize(raw: RawRecord): Contract {
  const quote = recordOf(raw.quote)
  const project = recordOf(raw.project)
  return {
    id: str(raw.contractId ?? raw.id),
    no: str(raw.no),
    status: CONTRACT_STATUS[enumValue(raw.status)] ?? 'draft',
    currentAmount: num(raw.currentAmount ?? raw.amount ?? raw.signedAmount),
    signedAmount: raw.signedAmount === undefined ? undefined : num(raw.signedAmount),
    signedAt: str(raw.signedAt) || undefined,
    effectiveAt: str(raw.effectiveAt) || undefined,
    startDate: str(raw.startDate) || undefined,
    planEndDate: str(raw.planEndDate) || undefined,
    paymentTerms: str(raw.paymentTerms) || undefined,
    quoteId: str(quote.quoteId ?? quote.id ?? raw.quoteId) || undefined,
    projectId: str(project.projectId ?? project.id ?? raw.projectId) || undefined,
    createdAt: str(recordOf(raw.createTime).dateTime ?? raw.createTime ?? raw.createdAt) || undefined
  }
}

export async function contractByQuote(quoteId: string): Promise<Contract | null> {
  const raw = await post<unknown>('project/contract/info', { quoteId })
  if (!raw) return null
  return normalize(recordOf(raw))
}

export const contractApi = { contractByQuote }
