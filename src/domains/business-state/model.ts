import type { StatusTone } from '@/core/tone'

export interface BusinessNextAction {
  key: string
  label: string
  hint?: string
  ownerRole?: string
  route?: string
  fromStatus?: string
  toStatus?: string
  enabled?: boolean
  blockedReasons?: string[]
  missingFields?: string[]
  reloadScopes?: string[]
  businessRefs?: string[]
}

export interface BusinessStateView {
  objectKey: string
  objectId: string
  status: string
  statusLabel?: string
  statusTone?: StatusTone
  derivedLabels?: Array<{ key: string; label: string; tone?: StatusTone }>
  nextAction?: BusinessNextAction | null
  blockedReasons?: string[]
  nextOwner?: string
  revision?: string
  updatedAt?: string
  businessRefs?: string[]
}

export interface BusinessStateNode {
  key: string
  label: string
  state?: 'done' | 'current' | 'todo' | 'blocked'
  hint?: string
}

export interface BusinessStateHistoryItem {
  id?: string
  status?: string
  statusLabel: string
  tone?: StatusTone
  operator?: string
  time?: string
  reason?: string
}
