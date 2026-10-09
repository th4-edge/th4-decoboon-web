/**
 * 客户阶段的展示映射（唯一来源）。
 * 之前「待我跟进」与「待我量房」各写一套 STAGE/RISK/SOURCE 中文表，容易分叉；
 * 新增页面一律从这里引用。
 * 业务事实源：全局 `zhuangdeqing-business`；本文件只做展示映射，不新增状态或口径。
 */
import type { StatusTone } from '@/core/tone'
import type { CustomerRiskLevel, CustomerStage, FollowWay } from './model'

export const CUSTOMER_STAGE_META: Record<CustomerStage, { label: string; tone: StatusTone }> = {
  intention: { label: '待首联', tone: 'todo' },
  following: { label: '跟进中', tone: 'doing' },
  pendingMeasure: { label: '待量房', tone: 'info' },
  quote: { label: '方案报价', tone: 'pending' },
  sign: { label: '已签约', tone: 'done' },
  construction: { label: '施工中', tone: 'alert' },
  done: { label: '已完工', tone: 'dark' },
  lost: { label: '已流失', tone: 'closed' },
  dormant: { label: '已休眠', tone: 'muted' },
  unknown: { label: '待业务确认', tone: 'info' }
}

export const CUSTOMER_RISK_META: Record<CustomerRiskLevel, { label: string; tone: StatusTone }> = {
  Normal: { label: '正常', tone: 'done' },
  Attention: { label: '需关注', tone: 'pending' },
  High: { label: '高风险', tone: 'blocked' }
}

export const CUSTOMER_SOURCE_LABELS: Record<string, string> = {
  Lead: '线上线索',
  Referral: '转介绍',
  WalkIn: '到店',
  OldCustomer: '老客户',
  Video: '短视频',
  Other: '其他',
  BatchPhone: '批量导入'
}

/** 评级样式类：A/B/C/未评估。 */
export function customerGradeClass(grade?: string | null): string {
  return grade ? `grade--${grade.toLowerCase()}` : 'grade--none'
}

/** 评级文案：A 级客户 / 待评估。 */
export function customerGradeLabel(grade?: string | null): string {
  return grade ? `${grade} 级客户` : '待评估'
}

/** 跟进方式中文（客户诉求/跟进共享块与各页抽屉共用）。 */
export const CUSTOMER_FOLLOW_WAY_LABELS: Record<FollowWay, string> = {
  phone: '电话',
  visit: '到店',
  wechat: '微信',
  video: '视频',
  other: '其他'
}
