import { post } from '@/core/http'
import type { Notice, NoticeType } from './model'

type RawRecord = Record<string, unknown>

function enumValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const value = raw as RawRecord
    return String(value.value ?? value.key ?? '')
  }
  return ''
}

function listOf(raw: unknown): RawRecord[] {
  if (Array.isArray(raw)) return raw as RawRecord[]
  if (raw && typeof raw === 'object') {
    const record = raw as RawRecord
    const rows = record.content ?? record.records ?? record.list
    if (Array.isArray(rows)) return rows as RawRecord[]
  }
  return []
}

function normalizeNotice(raw: RawRecord): Notice {
  const type = enumValue(raw.type).toLowerCase()
  const allowed = new Set<NoticeType>(['customer', 'project', 'quote', 'task', 'overdue', 'dynamic', 'accept', 'system', 'invite'])
  return {
    id: String(raw.id ?? raw.noticeId ?? ''),
    type: allowed.has(type as NoticeType) ? type as NoticeType : 'system',
    title: String(raw.title ?? ''),
    content: String(raw.content ?? ''),
    read: Boolean(raw.read),
    projectId: optionalId(raw.projectId ?? (raw.project as RawRecord | undefined)?.projectId),
    customerId: optionalId(raw.customerId ?? (raw.customer as RawRecord | undefined)?.custId),
    quoteId: optionalId(raw.quoteId ?? (raw.quote as RawRecord | undefined)?.quoteId),
    createdAt: stringValue(raw.createdAt ?? (raw.createTime as RawRecord | undefined)?.dateTime ?? raw.createTime)
  }
}

function optionalId(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined
  return String(value)
}

function stringValue(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined
  return String(value)
}

export const collabApi = {
  async notices(): Promise<Notice[]> {
    const raw = await post<unknown>('collab/notice/page', { current: 1, size: 20 })
    return listOf(raw).map(normalizeNotice).filter((item) => item.id)
  },

  async unread(): Promise<number> {
    const value = await post<unknown>('collab/notice/count', { read: false })
    return Number(value ?? 0)
  },

  read(id: string): Promise<unknown> {
    return post('collab/notice/update', { noticeId: id, read: true })
  }
}
