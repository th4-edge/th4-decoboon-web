import type { StatusTone } from '@/core/tone'
import type { AcceptanceStatus } from './model'

export const ACCEPTANCE_STATUS_META: Record<AcceptanceStatus, { label: string; tone: StatusTone }> = {
  pending: { label: '待业主确认', tone: 'pending' },
  confirmed: { label: '业主已确认', tone: 'done' },
  rejected: { label: '业主已驳回', tone: 'blocked' }
}
