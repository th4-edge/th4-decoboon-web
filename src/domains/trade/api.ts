import { post } from '@/core/http'
import {
  normalizeQuoteMode,
  normalizeQuoteStatus,
  type Quote,
  type QuoteGroupRaw,
  type QuoteItem,
  type QuoteSpace,
  type TradeEnum
} from './model'
import { UNIT_NAMES } from './model'

type RawRecord = Record<string, unknown>

/** 枚举取值：兼容字符串与 {key,value,name} 两种序列化。 */
function enumValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const record = raw as RawRecord
    return String(record.value ?? record.key ?? '')
  }
  return ''
}

function num(raw: unknown): number {
  const value = Number(raw ?? 0)
  return Number.isNaN(value) ? 0 : value
}

function str(raw: unknown): string {
  return raw === null || raw === undefined ? '' : String(raw)
}

function normalizeSpace(raw: unknown): QuoteSpace | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const record = raw as RawRecord
  return {
    spaceId: str(record.spaceId ?? record.id),
    name: str(record.name),
    type: record.type ? (record.type as TradeEnum) : undefined
  }
}

function normalizeItem(raw: RawRecord): QuoteItem {
  const unitValue = enumValue(raw.unit)
  return {
    id: str(raw.itemId ?? raw.id),
    name: str(raw.name),
    type: raw.type ? (raw.type as TradeEnum) : undefined,
    category: raw.category ? str(raw.category) : undefined,
    space: normalizeSpace(raw.space),
    brand: raw.brand ? str(raw.brand) : undefined,
    spec: raw.spec ? str(raw.spec) : undefined,
    unit: UNIT_NAMES[unitValue] ?? unitValue ?? '项',
    quantity: num(raw.quantity),
    materialPrice: num(raw.materialPrice),
    manualPrice: num(raw.manualPrice),
    pricingMode: raw.pricingMode ? (raw.pricingMode as TradeEnum) : undefined,
    price: num(raw.price),
    amount: num(raw.amount),
    formula: raw.formula ? str(raw.formula) : undefined,
    craft: raw.craft ? str(raw.craft) : undefined,
    role: raw.role ? (raw.role as TradeEnum) : undefined,
    differenceType: raw.differenceType ? (raw.differenceType as TradeEnum) : undefined,
    differenceStatus: raw.differenceStatus ? (raw.differenceStatus as TradeEnum) : undefined,
    included: raw.included !== false,
    discountAmount: num(raw.discountAmount)
  }
}

function normalizeGroup(raw: RawRecord): QuoteGroupRaw {
  return {
    key: str(raw.key ?? raw.name),
    name: str(raw.name),
    quantity: num(raw.quantity),
    amount: num(raw.amount),
    items: Array.isArray(raw.items) ? (raw.items as RawRecord[]).map(normalizeItem) : []
  }
}

function normalizeGroups(raw: unknown): QuoteGroupRaw[] {
  return Array.isArray(raw) ? (raw as RawRecord[]).map(normalizeGroup) : []
}

export function normalizeQuote(raw: RawRecord): Quote {
  return {
    id: str(raw.quoteId ?? raw.id),
    no: str(raw.no),
    title: raw.title ? str(raw.title) : undefined,
    version: num(raw.version) || 1,
    status: normalizeQuoteStatus(enumValue(raw.status)) ?? 'draft',
    mode: normalizeQuoteMode(enumValue(raw.mode)),
    area: num(raw.area),
    subtotal: num(raw.subtotal ?? raw.amount),
    amount: num(raw.amount),
    discount: raw.discount === undefined ? 1 : num(raw.discount),
    taxRate: num(raw.taxRate),
    taxAmount: num(raw.taxAmount),
    designFee: raw.designFee === undefined ? undefined : num(raw.designFee),
    managementFee: raw.managementFee === undefined ? undefined : num(raw.managementFee),
    items: Array.isArray(raw.items) ? (raw.items as RawRecord[]).map(normalizeItem) : [],
    regionGroups: normalizeGroups(raw.regionGroups),
    constructionGroups: normalizeGroups(raw.constructionGroups),
    materialGroups: normalizeGroups(raw.materialGroups),
    otherGroups: normalizeGroups(raw.otherGroups),
    createdAt: raw.createTime ? str((raw.createTime as RawRecord)?.dateTime ?? raw.createTime) : undefined
  }
}

/**
 * 读取报价详情。
 * 路由与 App 完全一致（`src/domains/trade/api.ts`）：设计师走 `quote/designer/info`。
 */
export async function quoteInfo(quoteId: string): Promise<Quote> {
  const raw = await post<RawRecord>('quote/designer/info', { quoteId })
  return normalizeQuote(raw)
}

export const tradeApi = { quoteInfo }
