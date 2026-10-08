export type NoticeType =
  | 'customer'
  | 'project'
  | 'quote'
  | 'task'
  | 'overdue'
  | 'dynamic'
  | 'accept'
  | 'system'
  | 'invite'

export interface Notice {
  id: string
  type: NoticeType
  title: string
  content: string
  read: boolean
  projectId?: string
  customerId?: string
  quoteId?: string
  createdAt?: string
}
