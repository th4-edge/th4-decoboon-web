/**
 * 客户诉求（DesignRequirement）的中文标签与语义色调。
 * 单一来源：在此之前 `DesignerCustomersView` / `DesignerCustomer360View` 各自复制过一份标签表；
 * 新增页面一律从这里引用，禁止再复制。（原独立队列页 `DesignerRequirementQueueView` 已随菜单下线）
 * 业务事实源：全局 `zhuangdeqing-business`；本文件只做展示映射，不新增状态或口径。
 */
import type { StatusTone } from '@/core/tone'
import type { RequirementCategory, RequirementKind, RequirementPriority, RequirementStatus } from './model'

export const REQUIREMENT_KIND_LABELS: Record<RequirementKind, string> = {
  demand: '诉求',
  reject: '排斥点'
}

export const REQUIREMENT_CATEGORY_LABELS: Record<RequirementCategory, string> = {
  function: '功能',
  style: '风格',
  material: '材料',
  budget: '预算',
  schedule: '工期',
  quality: '质量',
  other: '其他'
}

export const REQUIREMENT_PRIORITY_LABELS: Record<RequirementPriority, string> = {
  high: '高优先',
  medium: '中优先',
  low: '低优先'
}

export const REQUIREMENT_PRIORITY_TONES: Record<RequirementPriority, StatusTone> = {
  high: 'blocked',
  medium: 'pending',
  low: 'info'
}

export const REQUIREMENT_STATUS_LABELS: Record<RequirementStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  resolved: '已落实'
}

export const REQUIREMENT_STATUS_TONES: Record<RequirementStatus, StatusTone> = {
  pending: 'pending',
  confirmed: 'done',
  resolved: 'progress'
}

export const REQUIREMENT_KIND_OPTIONS: Array<{ value: RequirementKind; label: string }> =
  (Object.keys(REQUIREMENT_KIND_LABELS) as RequirementKind[]).map((value) => ({ value, label: REQUIREMENT_KIND_LABELS[value] }))

export const REQUIREMENT_CATEGORY_OPTIONS: Array<{ value: RequirementCategory; label: string }> =
  (Object.keys(REQUIREMENT_CATEGORY_LABELS) as RequirementCategory[]).map((value) => ({ value, label: REQUIREMENT_CATEGORY_LABELS[value] }))

export const REQUIREMENT_PRIORITY_OPTIONS: Array<{ value: RequirementPriority; label: string }> =
  (Object.keys(REQUIREMENT_PRIORITY_LABELS) as RequirementPriority[]).map((value) => ({ value, label: REQUIREMENT_PRIORITY_LABELS[value] }))
