import type { StatusTone } from '@/core/tone'
import type { BusinessNextAction } from '@/domains/business-state/model'
import type { Customer, CustomerStage } from './model'

/**
 * 客户经营展示口径。
 *
 * <p>状态与「推荐操作」的事实源在服务端：`CustomerInsightContext` 统一派生
 * riskLevel / riskReason / nextAction，本文件只负责把同一份事实渲染成
 * 阶段标签、经营时钟与工作面路由，禁止在前端重算风险或另造动作。</p>
 */

export const STAGE_META: Record<CustomerStage, { label: string; tone: StatusTone }> = {
  intention: { label: '待首联', tone: 'doing' },
  following: { label: '跟进中', tone: 'progress' },
  pendingMeasure: { label: '待量房', tone: 'info' },
  quote: { label: '方案报价', tone: 'special' },
  sign: { label: '已签约', tone: 'done' },
  construction: { label: '施工中', tone: 'alert' },
  done: { label: '已完工', tone: 'dark' },
  lost: { label: '已流失', tone: 'idle' },
  unknown: { label: '待业务确认', tone: 'info' }
}

/** 客户经营漏斗顺序（不含流失，流失单独作为异常终态）。 */
export const STAGE_ORDER: CustomerStage[] = [
  'intention', 'following', 'pendingMeasure', 'quote', 'sign', 'construction', 'done'
]

export type ClockKey = 'overdue' | 'today' | 'soon' | 'idle' | 'normal'

export interface CustomerClock {
  key: ClockKey
  label: string
  tone: StatusTone
}

function startOfDay(base: Date): number {
  const copy = new Date(base)
  copy.setHours(0, 0, 0, 0)
  return copy.getTime()
}

/** 参与跟进提醒的阶段（与服务端 CustomerInsightContext.openStatus 同口径）。 */
export const OPEN_STAGES: CustomerStage[] = ['intention', 'following', 'pendingMeasure', 'quote']

/** 参与「跟进逾期」判定的阶段：仅预约量房前（与服务端 CustomerInsightContext.followOverdueEligible 同口径）。 */
export const FOLLOW_OVERDUE_STAGES: CustomerStage[] = ['intention', 'following']

export function isOpenStage(stage: CustomerStage): boolean {
  return OPEN_STAGES.includes(stage)
}

export function isFollowOverdueStage(stage: CustomerStage): boolean {
  return FOLLOW_OVERDUE_STAGES.includes(stage)
}

/** 客户是否已写入预约量房事实（状态兜底：历史/异常数据可能仍停在跟进中）。 */
export function isMeasureBooked(customer: Customer): boolean {
  return !!customer.measureScheduled || !!customer.measureAt || !!customer.pendingMeasureAt
}

/**
 * 经营时钟：与服务端「逾期 / 今日 / 3天内 / 沉睡」四个计数严格同口径。
 * 已签约/施工中/已完工/已流失不参与跟进提醒，返回 null ——
 * 否则会出现「卡片写逾期 12 天、服务端逾期计数不含它」两套口径。
 */
export function customerClock(customer: Customer, now: Date = new Date()): CustomerClock | null {
  if (!isOpenStage(customer.stage)) return null
  const todayStart = startOfDay(now)
  const day = 24 * 60 * 60 * 1000
  const next = customer.nextFollowAt ? new Date(customer.nextFollowAt.replace(' ', 'T')).getTime() : Number.NaN
  if (!Number.isNaN(next)) {
    if (next < todayStart) {
      // 预约量房后不再判定跟进逾期：客户已进入量房/设计/报价主链，逾期提醒不应贯穿整个生命周期。
      if (!isFollowOverdueStage(customer.stage) || isMeasureBooked(customer)) return null
      const days = Math.max(1, Math.round((todayStart - next) / day))
      return { key: 'overdue', label: `逾期 ${days} 天`, tone: 'blocked' }
    }
    if (next < todayStart + day) return { key: 'today', label: '今日跟进', tone: 'pending' }
    if (next < todayStart + 4 * day) {
      const days = Math.max(1, Math.round((next - todayStart) / day))
      return { key: 'soon', label: `${days} 天后跟进`, tone: 'info' }
    }
  }
  const idle = customer.idleDays ?? 0
  if (idle >= 15) return { key: 'idle', label: `连续 ${idle} 天未推进`, tone: 'muted' }
  return { key: 'normal', label: customer.lastFollowAt ? '跟进节奏正常' : '尚未建立跟进', tone: 'closed' }
}

/** 生命周期分桶（与 App 客户列表一致，仅用于展示，不作为指标口径）。 */
export function lifecycleOf(customer: Customer): { label: string; tone: StatusTone } | null {
  const idle = customer.idleDays
  if (idle === undefined) return null
  if (idle <= 3) return { label: '黄金期 0-3 天', tone: 'blocked' }
  if (idle <= 7) return { label: '升温期 4-7 天', tone: 'pending' }
  if (idle <= 15) return { label: '保温期 8-15 天', tone: 'info' }
  return { label: '沉睡风险 15 天+', tone: 'muted' }
}

export function stageMetaOf(stage: CustomerStage): { label: string; tone: StatusTone } {
  return STAGE_META[stage] ?? STAGE_META.unknown
}

export function riskToneOf(customer: Customer): StatusTone {
  if (customer.riskLevel === 'High') return 'blocked'
  if (customer.riskLevel === 'Attention') return 'pending'
  return 'done'
}

/**
 * 推荐操作落地页：客户经营页只做「判断与跳转」，
 * 跟进/量房等写操作回到「客户与设计」对象工作区完成，报价/合同/项目进入各自工作台。
 */
export function workspaceRouteOf(customer: Customer): string {
  const id = encodeURIComponent(customer.id)
  switch (customer.stage) {
    case 'quote':
      return '/designer/quotes'
    case 'sign':
      return '/designer/contract'
    case 'construction':
    case 'done':
      return '/designer/projects'
    case 'lost':
      return `/designer/customers?activeCustomerId=${id}`
    default:
      return `/designer/customers?activeCustomerId=${id}`
  }
}

/* ── 主行动：事实源在服务端 ────────────────────────────────────────────────
 * 主链主行动由服务端 CustomerInsightContext.mainline() 统一派生
 * （未预约量房→跟进；已预约→录入量房；已量房→方案设计；有报价→跟进报价确认；
 * 已签约→合同交接；施工中→查看工地），与风险提示 nextAction 是两个不同的东西。
 * 前端只按 mainlineKey 映射落地路由，禁止在页面里重新推导动作。
 */
export function mainlineActionOf(customer: Customer): BusinessNextAction | null {
  if (!customer.mainlineLabel) return null
  return {
    key: customer.mainlineKey || `customer.${customer.stage}`,
    label: customer.mainlineLabel,
    hint: customer.mainlineHint,
    ownerRole: customer.designerName || customer.ownerName || '客户负责人',
    route: mainlineRouteOf(customer.mainlineKey, customer.id),
    fromStatus: customer.stage,
    enabled: true,
    businessRefs: ['BR-001', 'BR-005']
  }
}

export function mainlineRouteOf(key: string | undefined, customerId: string): string {
  const id = encodeURIComponent(customerId)
  switch (key) {
    case 'project':
      return '/designer/projects'
    case 'contract':
      return '/designer/contract'
    case 'quote':
    case 'quoteDecision':
      return '/designer/quotes'
    case 'recordMeasure':
      return `/designer/customers?activeCustomerId=${id}&surface=measure`
    default:
      return `/designer/customers?activeCustomerId=${id}`
  }
}
