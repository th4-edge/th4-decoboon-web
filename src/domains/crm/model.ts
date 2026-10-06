export type CustomerStage = 'intention' | 'following' | 'pendingMeasure' | 'quote' | 'sign' | 'construction' | 'done' | 'lost'

export interface Customer {
  id: string
  name: string
  phone: string
  stage: CustomerStage
  grade?: 'A' | 'B' | 'C'
  community?: string
  addr?: string
  area?: number
  budget?: number
  designerId?: string
  designerName?: string
  remark?: string
  lastFollowAt?: string
  nextFollowAt?: string
  measureAt?: string
  pendingMeasureAt?: string
  createdAt?: string
  tags?: string[]
  /** 服务端按 Completed 量房事实推导的行为标签，不以后端客户生命周期状态代替。 */
  measured?: boolean
  /** 服务端按 Scheduled 量房事实推导的行为标签。 */
  measureScheduled?: boolean
}

export type FollowWay = 'phone' | 'visit' | 'wechat' | 'video' | 'other'

export interface CustomerFollow {
  id: string
  customerId: string
  way: FollowWay
  content: string
  empName?: string
  nextFollowAt?: string
  createdAt?: string
}
