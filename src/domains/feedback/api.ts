import { post } from '@/core/http'
import { fileApi } from '@/domains/file/api'
import type { CustomerFeedback, FeedbackKind, FeedbackStatus, FeedbackType } from './model'

type RawRecord = Record<string, unknown>

const KIND: Record<string, FeedbackKind> = { Opinion: 'opinion', Complaint: 'complaint' }
const TYPE: Record<string, FeedbackType> = {
  Quality: 'quality',
  Design: 'design',
  Material: 'material',
  Schedule: 'schedule',
  Service: 'service',
  Fee: 'fee',
  Safety: 'safety',
  Other: 'other'
}
const STATUS: Record<string, FeedbackStatus> = {
  Submitted: 'submitted',
  Processing: 'processing',
  Resolved: 'resolved',
  Escalated: 'escalated',
  Closed: 'closed'
}
const STATUS_API: Record<FeedbackStatus, string> = {
  submitted: 'Submitted',
  processing: 'Processing',
  resolved: 'Resolved',
  escalated: 'Escalated',
  closed: 'Closed'
}

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

function dateTimeValue(raw: unknown): string | undefined {
  if (raw === null || raw === undefined) return undefined
  if (typeof raw === 'object') {
    const record = raw as RawRecord
    return str(record.dateTime ?? record.value) || undefined
  }
  return str(raw) || undefined
}

async function normalizeFeedback(raw: RawRecord): Promise<CustomerFeedback> {
  const id = str(raw.feedbackId ?? raw.id)
  const project = recordOf(raw.project)
  const property = recordOf(raw.property)
  const stage = recordOf(raw.stage)
  const handler = recordOf(raw.handler)
  const imagePaths = Array.isArray(raw.images) ? raw.images.map(str).filter(Boolean) : []
  let images = imagePaths
  if (id && imagePaths.length) {
    try {
      images = await fileApi.grantFiles('Feedback', id, imagePaths)
    } catch {
      images = imagePaths
    }
  }
  return {
    id,
    projectId: str(raw.projectId ?? project.projectId),
    projectName: str(project.name) || undefined,
    propertyId: str(raw.propertyId ?? property.propertyId) || undefined,
    propertyAddress: str(property.address ?? property.community) || undefined,
    stageId: str(raw.stageId ?? stage.stageId) || undefined,
    stageName: str(stage.name) || undefined,
    kind: KIND[enumValue(raw.kind)] ?? 'opinion',
    type: TYPE[enumValue(raw.type)] ?? 'other',
    status: STATUS[enumValue(raw.status)] ?? 'submitted',
    title: str(raw.title),
    content: str(raw.content),
    images,
    handlerName: str(handler.name) || undefined,
    response: str(raw.response) || undefined,
    respondedAt: dateTimeValue(raw.respondedAt),
    dueAt: dateTimeValue(raw.dueAt),
    closedAt: dateTimeValue(raw.closedAt),
    satisfaction: raw.satisfaction === null || raw.satisfaction === undefined ? undefined : Number(raw.satisfaction),
    createdAt: dateTimeValue(raw.createTime ?? raw.createdAt)
  }
}

/** 员工侧项目意见投诉台账：显式不传 projectId，由服务端按数据范围返回。 */
export async function listProjectFeedback(): Promise<CustomerFeedback[]> {
  const raw = await post<unknown>('project/feedback/page', { size: 100 })
  const rows = Array.isArray(raw) ? raw : []
  return Promise.all(rows.map((row) => normalizeFeedback(recordOf(row))))
}

/** 员工提交处理回复；状态推进沿用 App 口径，Web 只提交 Resolved。 */
export async function resolveFeedback(feedbackId: string, response: string): Promise<CustomerFeedback> {
  const raw = await post<unknown>('project/feedback/update', {
    feedbackId,
    status: STATUS_API.resolved,
    response: response.trim()
  })
  return normalizeFeedback(recordOf(raw))
}

export const feedbackApi = { listProjectFeedback, resolveFeedback }
