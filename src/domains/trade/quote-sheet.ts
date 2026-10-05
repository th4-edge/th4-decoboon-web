/**
 * 报价表格（QuoteSheetGrid）的数据契约。
 *
 * 设计要点（见 docs/product/designer/QUOTE-GRID-技术方案.md）：
 * - rowKey 必须用服务端稳定 ID，禁止用数组索引（折叠/排序/虚拟化都会让索引失效）
 * - draft 是稀疏 map：只存"改过的行"，未改的行自动跟随服务端最新值
 * - 金额、单价、税额一律服务端计算，本类型里只作为只读展示字段
 */

/** 可编辑字段：仅这四个允许前端改，其余由服务端算。 */
export const EDITABLE_FIELDS = ['quantity', 'quantityFormula', 'materialPrice', 'manualPrice'] as const
export type EditableField = (typeof EDITABLE_FIELDS)[number]

export interface QuoteLineRow {
  /** 稳定行键 = 报价行 itemId */
  key: string
  itemId: string
  /** 分类，如"木作工程" */
  category: string
  /** 项目名 */
  name: string
  /** 品牌 / 规格 */
  brandSpec: string
  unit: string
  /** 计价模式（Provider 枚举 value，如 MaterialAndManual / FixedTotal） */
  pricingMode: string
  // —— 只读：服务端权威计算 ——
  quantity: number
  /** 综合单价 */
  price: number
  /** 金额 */
  amount: number
  // —— 可编辑：进入草稿 ——
  quantityFormula: string
  materialPrice: number
  manualPrice: number
  /** 仅 FixedTotal 计价使用；其他模式为 null */
  fixedTotalPrice: number | null
}

export type QuoteLineDraft = Partial<
  Pick<QuoteLineRow, 'quantity' | 'quantityFormula' | 'materialPrice' | 'manualPrice' | 'fixedTotalPrice'>
>

/** rowKey → 改动字段。空对象 = 未修改。 */
export type DraftMap = Record<string, QuoteLineDraft>

export interface QuoteGroup {
  key: string
  /** 区域名，如"客厅" */
  name: string
  /** 分组小计（服务端给，前端不重算） */
  amount: number
  rows: QuoteLineRow[]
}

export interface CellRef {
  rowKey: string
  field: EditableField
}

export function isEditableField(value: string): value is EditableField {
  return (EDITABLE_FIELDS as readonly string[]).includes(value)
}

/** 取某行的有效值：草稿优先，否则用服务端值。 */
export function effectiveValue(
  row: QuoteLineRow,
  field: EditableField,
  draft: DraftMap
): number | string {
  const local = draft[row.key]?.[field]
  return local !== undefined ? local : row[field]
}

export function draftIsEmpty(draft: DraftMap): boolean {
  return Object.keys(draft).length === 0
}

/* ─────────────────────────────────────────────────────────────
   Quote（服务端模型） → QuoteSheetGrid（表格模型）的映射
   ───────────────────────────────────────────────────────────── */

import type { Quote, QuoteItem } from './model'

/** 品牌 / 规格合并为表格中的一列。 */
function brandSpecOf(item: QuoteItem): string {
  return [item.brand, item.spec].filter((v) => v && String(v).trim()).join(' · ')
}

/**
 * 单条报价行 → 表格行。
 * 注意：金额、单价、amount 全部来自服务端，不做任何前端计算。
 */
export function toSheetRow(item: QuoteItem): QuoteLineRow {
  return {
    key: item.id,
    itemId: item.id,
    category: item.category ?? '',
    name: item.name,
    brandSpec: brandSpecOf(item),
    unit: item.unit,
    pricingMode: item.pricingMode?.value ?? 'MaterialAndManual',
    quantity: item.quantity,
    price: item.price,
    amount: item.amount,
    quantityFormula: item.quantityFormula ?? '',
    materialPrice: item.materialPrice,
    manualPrice: item.manualPrice,
    fixedTotalPrice: item.fixedTotalPrice ?? null
  }
}

/**
 * 报价单 → 区域分组。
 * 优先使用服务端 `regionGroups`；缺失时按房屋空间名回退分组。
 */
export function toSheetGroups(quote: Quote): QuoteGroup[] {
  if (quote.regionGroups.length > 0) {
    return quote.regionGroups.map((group) => ({
      key: group.key || group.name,
      name: group.name,
      amount: group.amount,
      rows: group.items.map(toSheetRow)
    }))
  }

  const bucket = new Map<string, QuoteItem[]>()
  for (const item of quote.items) {
    const region = item.space?.name?.trim() || '综合项目'
    bucket.set(region, [...(bucket.get(region) ?? []), item])
  }
  return Array.from(bucket.entries()).map(([name, items]) => ({
    key: name,
    name,
    // 分组小计：直接累加服务端返回的行金额，不重算业务金额
    amount: items.reduce((sum, item) => sum + item.amount, 0),
    rows: items.map(toSheetRow)
  }))
}
