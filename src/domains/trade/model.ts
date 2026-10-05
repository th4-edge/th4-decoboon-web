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

/* ─────────────────────────────────────────────────────────────
   报价领域模型（字段与 App `src/domains/trade/model.ts` 对齐）
   实测来源：本地 decoboon `quote/designer/info` 真实响应
   ───────────────────────────────────────────────────────────── */

/** Provider 枚举序列化形态。 */
export interface TradeEnum {
  key: string
  value?: string
  name: string
}

export interface QuoteSpace {
  spaceId: string
  name: string
  type?: TradeEnum
}

export interface QuoteComponent {
  type?: TradeEnum
  name?: string
  saleAmount: number
  formula?: string
  sort?: number
}

export interface QuoteItem {
  id: string
  name: string
  type?: TradeEnum
  category?: string
  space?: QuoteSpace
  brand?: string
  spec?: string
  unit: string
  quantity: number
  materialPrice: number
  manualPrice: number
  pricingMode?: TradeEnum
  price: number
  amount: number
  formula?: string
  craft?: string
  role?: TradeEnum
  differenceType?: TradeEnum
  differenceStatus?: TradeEnum
  included?: boolean
  discountAmount?: number
  components?: QuoteComponent[]
}

export interface QuoteGroupRaw {
  key: string
  name: string
  quantity?: number
  amount: number
  items: QuoteItem[]
}

export interface Quote {
  id: string
  no: string
  title?: string
  version: number
  status: QuoteStatus
  mode: QuoteMode | null
  area: number
  subtotal: number
  amount: number
  discount: number
  taxRate: number
  taxAmount: number
  designFee?: number
  managementFee?: number
  items: QuoteItem[]
  regionGroups: QuoteGroupRaw[]
  constructionGroups: QuoteGroupRaw[]
  materialGroups: QuoteGroupRaw[]
  otherGroups: QuoteGroupRaw[]
  createdAt?: string
}

/** 工程量单位：Provider 枚举值 → 中文。 */
export const UNIT_NAMES: Record<string, string> = {
  Area: '㎡', Count: '个', Item: '项', Place: '处', Set: '套', House: '户',
  Metre: 'm', Centimeter: 'cm', Step: '步', Plate: '樘', Block: '块', Root: '根',
  Hole: '扇', Pcs: '台', Stick: '支', Grid: '格', Sheet: '片'
}
