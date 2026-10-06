import { post } from '@/core/http'
import type { RiskCenterReport, RiskItemView, RiskLogView } from './model'

function text(value: unknown): string { return typeof value === 'string' ? value : value == null ? '' : String(value) }
function numberValue(value: unknown): number { return typeof value === 'number' ? value : Number(value ?? 0) || 0 }
function listOf(value: unknown): unknown[] { return Array.isArray(value) ? value : [] }

function typeDistributionOf(raw: unknown): RiskCenterReport['typeDistribution'] {
  return listOf(raw).map((value) => {
    const item = value as Record<string, unknown>
    return {
      key: text(item.key), label: text(item.label), description: text(item.description),
      count: numberValue(item.count), highCount: numberValue(item.highCount)
    }
  })
}

function responsibilityOf(raw: unknown): RiskCenterReport['responsibilityDistribution'] {
  return listOf(raw).map((value) => {
    const item = value as Record<string, unknown>
    return { name: text(item.name), count: numberValue(item.count), highCount: numberValue(item.highCount) }
  })
}

function itemOf(raw: unknown): RiskItemView {
  const item = (raw ?? {}) as Record<string, unknown>
  return {
    key: text(item.key), type: text(item.type), typeLabel: text(item.typeLabel),
    level: text(item.level), levelLabel: text(item.levelLabel),
    title: text(item.title), message: text(item.message),
    projectName: text(item.projectName), customerName: text(item.customerName), ownerName: text(item.ownerName),
    amount: numberValue(item.amount), dueDate: text(item.dueDate),
    timeText: text(item.timeText), timeTone: text(item.timeTone) || 'normal',
    nextAction: text(item.nextAction),
    riskId: item.riskId == null ? null : text(item.riskId),
    status: text(item.status), statusLabel: text(item.statusLabel), disposerName: text(item.disposerName),
    dueAt: text(item.dueAt), dueText: text(item.dueText), dueTone: text(item.dueTone) || 'normal',
    roundNo: numberValue(item.roundNo) || 1, recurrenceCount: numberValue(item.recurrenceCount)
  }
}

function logOf(raw: unknown): RiskLogView {
  const item = (raw ?? {}) as Record<string, unknown>
  return {
    logId: text(item.logId), action: text(item.action), actionLabel: text(item.actionLabel),
    fromStatusLabel: text(item.fromStatusLabel), toStatusLabel: text(item.toStatusLabel),
    operatorName: text(item.operatorName), note: text(item.note),
    evidenceUrls: listOf(item.evidenceUrls).map(text), occurredAt: text(item.occurredAt)
  }
}

function reportOf(raw: unknown): RiskCenterReport {
  const item = (raw ?? {}) as Record<string, unknown>
  return {
    asOf: text(item.asOf),
    totalCount: numberValue(item.totalCount),
    highCount: numberValue(item.highCount),
    mediumCount: numberValue(item.mediumCount),
    lowCount: numberValue(item.lowCount),
    typeDistribution: typeDistributionOf(item.typeDistribution),
    responsibilityDistribution: responsibilityOf(item.responsibilityDistribution),
    items: listOf(item.items).map(itemOf)
  }
}

export const riskApi = {
  report: async (asOf?: string): Promise<RiskCenterReport> =>
    reportOf(await post<unknown>('statistic/risk/report', { asOf })),
  assign: async (riskId: string, assigneeId: string, note?: string): Promise<void> =>
    void await post<unknown>('risk/item/assign', { riskId, assigneeId, note }),
  claim: async (riskId: string, note?: string): Promise<void> =>
    void await post<unknown>('risk/item/claim', { riskId, note }),
  record: async (riskId: string, note: string, urgent = false): Promise<void> =>
    void await post<unknown>('risk/item/record', { riskId, note, urgent }),
  close: async (riskId: string, result: string): Promise<void> =>
    void await post<unknown>('risk/item/close', { riskId, result }),
  reopen: async (riskId: string, reason: string): Promise<void> =>
    void await post<unknown>('risk/item/reopen', { riskId, reason }),
  logs: async (riskId: string): Promise<RiskLogView[]> =>
    listOf(await post<unknown>('risk/item/log/page', { riskId })).map(logOf)
}
