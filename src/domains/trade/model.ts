/** 报价状态：前端小写，后端返回 PascalCase（与 App 归一化方式一致）。 */
export type QuoteStatus = 'draft' | 'submitted' | 'accepted' | 'rejected' | 'superseded' | 'converted'

export type QuoteMode = 'package' | 'custom' | 'hybrid'

const QUOTE_STATUS_MAP: Record<string, QuoteStatus> = {
  Draft: 'draft',
  Submitted: 'submitted',
  Accepted: 'accepted',
  Rejected: 'rejected',
  Superseded: 'superseded',
  Converted: 'converted'
}

const QUOTE_MODE_MAP: Record<string, QuoteMode> = {
  Package: 'package',
  Custom: 'custom',
  Hybrid: 'hybrid'
}

export function normalizeQuoteStatus(raw: unknown): QuoteStatus | null {
  if (typeof raw !== 'string') return null
  return QUOTE_STATUS_MAP[raw] ?? null
}

export function normalizeQuoteMode(raw: unknown): QuoteMode | null {
  if (typeof raw !== 'string') return null
  return QUOTE_MODE_MAP[raw] ?? null
}
