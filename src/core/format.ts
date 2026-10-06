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

/** 日期时间：统一为「YYYY-MM-DD HH:mm」；缺值或非法值不伪装成 0。 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '暂不可确认'
  const date = new Date(value.replace(/-/g, '/'))
  if (Number.isNaN(date.getTime())) return '暂不可确认'
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
