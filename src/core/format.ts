const MONEY = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 金额格式化：一律两位小数、千分位。缺值返回空串，由 MoneyText 决定展示「暂不可确认」。 */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return MONEY.format(value)
}

/** 带符号金额（用于差额展示）。 */
export function formatSignedMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}¥${MONEY.format(Math.abs(value))}`
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return `${(value * 100).toFixed(digits)}%`
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return String(value)
}

/** 数量：最多 3 位小数，去掉无意义的尾零。 */
export function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return String(Number(value.toFixed(3)))
}

/**
 * 可编辑输入框内的数字格式：**不带千分位**。
 * 原因：展示型金额可以带千分位，但输入框里出现 "1,200.00" 会让 Number() 解析失败，
 * 提交时会把用户输入变成 NaN 造成数据丢失。
 */
export function formatEditableNumber(value: number | null | undefined, decimals: number): string {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return Number(value).toFixed(decimals)
}

/**
 * 客户提醒日期：统一转换为「今天 / 明天 / N天后 / 已过 N天」。
 * 仅用于客户经营中的提醒和到期展示，不替代审计时间。
 */
export function formatRelativeDay(value: string | null | undefined, now: Date = new Date()): string {
  if (!value) return '未安排'
  const normalized = value.includes('T') ? value : value.replace(/-/g, '/')
  const target = new Date(normalized)
  if (Number.isNaN(target.getTime())) return '时间待确认'
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  const days = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  if (days < 0) return `已过 ${Math.abs(days)} 天`
  if (days === 0) return '今天'
  if (days === 1) return '明天'
  return `${days} 天后`
}

/**
 * 跟进提醒专用：逾期、今天到期和未来几天使用不同动词。
 */
export function formatFollowDue(value: string | null | undefined, now: Date = new Date()): string {
  if (!value) return '未安排下次联系'
  const normalized = value.includes('T') ? value : value.replace(/-/g, '/')
  const target = new Date(normalized)
  if (Number.isNaN(target.getTime())) return '时间待确认'
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  const days = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  if (days < 0) return `已逾期 ${Math.abs(days)} 天`
  if (days === 0) return '今天到期'
  if (days === 1) return '明天联系'
  return `${days} 天后联系`
}

/** 日期时间：统一为「YYYY-MM-DD HH:mm」；缺值或非法值不伪装成 0。 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '暂不可确认'
  const normalized = value.includes('T') ? value : value.replace(/-/g, '/')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return '暂不可确认'
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * 本地时区的今天（YYYY-MM-DD）。
 * 不要用 `new Date().toISOString().slice(0, 10)`：它按 UTC 截断，东八区凌晨会得到前一天。
 */
export function todayLocalDate(now: Date = new Date()): string {
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}
