import type { FeedbackKind, FeedbackType } from './model'

/**
 * 客户意见/投诉中文投影唯一来源。
 *
 * 规范 §5：枚举中文标签集中定义，禁止页面内自建标签表。
 */

export const FEEDBACK_KIND_LABELS: Record<FeedbackKind, string> = {
  opinion: '意见',
  complaint: '投诉'
}

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  quality: '质量问题',
  design: '设计问题',
  material: '材料问题',
  schedule: '工期问题',
  service: '服务问题',
  fee: '费用问题',
  safety: '安全问题',
  other: '其他'
}
