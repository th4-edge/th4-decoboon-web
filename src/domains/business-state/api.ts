import type { StatusTone } from '@/core/tone'
import { isStatusTone } from '@/core/tone'
import type { BusinessNextAction, BusinessStateHistoryItem, BusinessStateView } from './model'

type RawRecord = Record<string, unknown>

function recordOf(raw: unknown): RawRecord {
  return raw && typeof raw === 'object' ? raw as RawRecord : {}
}

function str(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined
  return String(value)
}

function stringList(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.map(str).filter((item): item is string => Boolean(item)) : undefined
}

function toneOf(value: unknown): StatusTone | undefined {
  const tone = str(value)
  return tone && isStatusTone(tone) ? tone : undefined
}

function normalizeNextAction(raw: unknown): BusinessNextAction | undefined {
  const record = recordOf(raw)
  const key = str(record.key)
  const label = str(record.label)
  if (!key || !label) return undefined
  return {
    key,
    label,
    hint: str(record.hint),
    ownerRole: str(record.ownerRole),
    route: str(record.route),
    fromStatus: str(record.fromStatus),
    toStatus: str(record.toStatus),
    toStatusLabel: str(record.toStatusLabel),
    enabled: record.enabled !== false,
    blockedReasons: stringList(record.blockedReasons),
    missingFields: stringList(record.missingFields),
    reloadScopes: stringList(record.reloadScopes),
    businessRefs: stringList(record.businessRefs)
  }
}

export function normalizeBusinessStateView(raw: unknown): BusinessStateView | undefined {
  const record = recordOf(raw)
  const objectKey = str(record.objectKey)
  const objectId = str(record.objectId)
  const status = str(record.status)
  if (!objectKey || !status) return undefined
  const derivedLabels = Array.isArray(record.derivedLabels)
    ? record.derivedLabels.map((item) => {
        const row = recordOf(item)
        return { key: str(row.key) ?? '', label: str(row.label) ?? '', tone: toneOf(row.tone) }
      }).filter((item) => item.label)
    : undefined
  return {
    objectKey,
    objectId: objectId ?? '',
    status,
    statusLabel: str(record.statusLabel),
    statusTone: toneOf(record.statusTone),
    derivedLabels,
    nextAction: normalizeNextAction(record.nextAction),
    blockedReasons: stringList(record.blockedReasons),
    nextOwner: str(record.nextOwner),
    revision: str(record.revision),
    updatedAt: str(record.updatedAt),
    businessRefs: stringList(record.businessRefs)
  }
}

export function normalizeStateHistory(raw: unknown): BusinessStateHistoryItem[] {
  return Array.isArray(raw)
    ? raw.map((item) => {
        const row = recordOf(item)
        return {
          id: str(row.id),
          status: str(row.status),
          statusLabel: str(row.statusLabel) ?? '待确认',
          tone: toneOf(row.tone),
          operator: str(row.operator),
          time: str(row.time),
          reason: str(row.reason)
        }
      })
    : []
}
