export type FeedbackKind = 'opinion' | 'complaint'
export type FeedbackType = 'quality' | 'design' | 'material' | 'schedule' | 'service' | 'fee' | 'safety' | 'other'
export type FeedbackStatus = 'submitted' | 'processing' | 'resolved' | 'escalated' | 'closed'

/** 项目交付·客户意见投诉：员工侧读模型。 */
export interface CustomerFeedback {
  id: string
  projectId: string
  projectName?: string
  propertyId?: string
  propertyAddress?: string
  stageId?: string
  stageName?: string
  kind: FeedbackKind
  type: FeedbackType
  status: FeedbackStatus
  title: string
  content: string
  images: string[]
  handlerName?: string
  response?: string
  respondedAt?: string
  dueAt?: string
  closedAt?: string
  satisfaction?: number
  createdAt?: string
}
