/**
 * 业务状态语义色调（14 档）。
 * 与 App `src/styles/tokens.ts` 的 STATUS_COLOR 同源同值；色值真源仍是 `styles/tokens.scss`，
 * 本文件只提供语义名与 CSS 变量名，不重复定义色值。
 */
export const STATUS_TONES = [
  'idle', 'todo', 'muted', 'closed', 'dark',
  'doing', 'progress', 'alert', 'pending',
  'done', 'blocked', 'info', 'special', 'accent'
] as const

export type StatusTone = (typeof STATUS_TONES)[number]

/** 各 tone 的语义（与 App STATUS_COLOR 注释一致）。 */
export const TONE_MEANING: Record<StatusTone, string> = {
  idle: '未开始 / 已停用 / 已流失',
  todo: '待办 / 待开工 / 低优先级',
  muted: '已被替代 / 历史态',
  closed: '已关闭 / 已过期 / 已取消',
  dark: '已结算 / 已归档 / 通知',
  doing: '进行中',
  progress: '推进中',
  alert: '施工中 / 提醒',
  pending: '待确认 / 待处理 / 待验收',
  done: '已完成 / 已确认 / 通过',
  blocked: '异常 / 驳回 / 逾期',
  info: '信息类 / 待量房',
  special: '竣工验收 / 材料进场等特殊态',
  accent: '辅助强调'
}

export type TonePart = 'main' | 'soft' | 'border'

/** 取 tone 对应的 CSS 变量引用。 */
export function toneVar(tone: StatusTone, part: TonePart = 'main'): string {
  const suffix = part === 'main' ? '' : `-${part}`
  return `var(--th4-status-${tone}${suffix})`
}

export function isStatusTone(value: string): value is StatusTone {
  return (STATUS_TONES as readonly string[]).includes(value)
}
