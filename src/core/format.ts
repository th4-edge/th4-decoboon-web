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
