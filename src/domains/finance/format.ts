export function toInputDate(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function monthStart(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`
}

export function yearStart(date = new Date()): string {
  return `${date.getFullYear()}-01-01`
}

export function formatAmountPreview(value: string | number): string {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? `¥${amount.toFixed(2)}` : '待填写'
}
