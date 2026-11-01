export type ContentAttributionType = 'platform' | 'uniqueCode' | 'manual' | 'selfReport' | 'inference'
export type ContentAttributionConfidence = 'high' | 'medium' | 'low'

/** 客户内容触点：只消费 App 已在使用的 `content/lead-touch/list` Provider。 */
export interface LeadTouch {
  id: string
  attributionType: ContentAttributionType
  confidence: ContentAttributionConfidence
  isPrimary: boolean
  evidence?: string
  touchedAt?: string
  taskTitle?: string
  employeeName?: string
  contentCaption?: string
}
