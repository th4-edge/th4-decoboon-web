import { post } from '@/core/http'
import type { CarryoverBatch, CarryoverConfirmationRole, CarryoverProject } from './model'

type RawRecord = Record<string, unknown>

function text(value: unknown): string {
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
    return text(record.value ?? record.key ?? record.name)
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

function normalizeBatch(raw: RawRecord): CarryoverBatch {
  return {
    id: raw.batchId == null ? undefined : String(raw.batchId),
    asOfDate: raw.asOfDate == null ? undefined : text(raw.asOfDate),
    status: enumValue(raw.status)
  }
}

function normalizeProject(raw: RawRecord): CarryoverProject {
  return {
    id: text(raw.itemId),
    status: enumValue(raw.status),
    customerName: text(raw.customerName),
    customerPhone: text(raw.customerPhone),
    community: raw.community == null ? undefined : text(raw.community),
    address: text(raw.address),
    contractNo: text(raw.contractNo),
    currentAmount: num(raw.currentAmount),
    receivableOutstanding: num(raw.receivableOutstanding),
    payableOutstanding: num(raw.payableOutstanding),
    costStatus: enumValue(raw.costStatus),
    validationBlockers: Array.isArray(raw.validationBlockers) ? raw.validationBlockers.map(text) : [],
    carryoverReady: raw.carryoverReady === true,
    projectId: raw.project && recordOf(raw.project).projectId != null
      ? String(recordOf(raw.project).projectId) : undefined
  }
}

export const carryoverApi = {
  batchInfo: async (): Promise<CarryoverBatch> => normalizeBatch(recordOf(await post<unknown>('carryover/batch/info', {}))),
  page: async (): Promise<CarryoverProject[]> => pageRows(await post<unknown>('carryover/project/page', { current: 1, size: 200 }))
    .map(normalizeProject),
  confirm: async (itemId: string, requiredRole: CarryoverConfirmationRole, summary: string): Promise<void> => {
    await post('carryover/confirmation/save', { itemId, requiredRole, summary })
  },
  build: async (itemId: string): Promise<void> => {
    await post('carryover/project/build', { itemId })
  }
}
