import type { QuoteLineDraft, QuoteLineRow } from './quote-sheet'

/**
 * 报价编辑预览（仅用于即时核对）。
 *
 * ⚠️ 这不是正式金额。依据 `ANS-BIZ-20261002-002` Q5：
 * 前端实时预览 + 服务端权威重算；两者不一致时以服务端为准，并提示"计算已按系统规则更新"。
 *
 * 算法与后端 `QuoteCalcContext.amount` 保持一致（含 FixedTotal 不乘工程量）：
 *   MaterialAndManual → (材料价 + 人工价) × 工程量
 *   MaterialOnly      → 材料价 × 工程量
 *   ManualOnly        → 人工价 × 工程量
 *   FixedTotal        → 固定总价（不乘工程量）
 * 金额统一 2 位小数 HALF_UP。
 */
function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function previewLineAmount(row: QuoteLineRow, draft: QuoteLineDraft | undefined): number {
  const quantity = draft?.quantity ?? row.quantity
  const material = draft?.materialPrice ?? row.materialPrice
  const manual = draft?.manualPrice ?? row.manualPrice
  const fixed = draft?.fixedTotalPrice ?? row.fixedTotalPrice ?? 0
  const mode = row.pricingMode || 'MaterialAndManual'

  if (mode === 'FixedTotal') return money(fixed)
  if (mode === 'MaterialOnly') return money(material * quantity)
  if (mode === 'ManualOnly') return money(manual * quantity)
  return money((material + manual) * quantity)
}

export interface QuotePreviewSummary {
  /** 编辑预览后的区域小计（未含税） */
  subtotal: number
  /** 编辑预览后的含税总额（按报价折扣与税率） */
  amount: number
  /** 与已保存总额的差额（正数表示变高） */
  delta: number
}

export function previewQuoteSummary(
  groups: { rows: QuoteLineRow[] }[],
  draft: Record<string, QuoteLineDraft>,
  savedAmount: number,
  discount: number,
  taxRate: number
): QuotePreviewSummary {
  let subtotal = 0
  for (const group of groups) {
    for (const row of group.rows) {
      subtotal += previewLineAmount(row, draft[row.key])
    }
  }
  subtotal = money(subtotal)
  const amount = money(subtotal * (discount || 1) * (1 + (taxRate || 0)))
  return { subtotal, amount, delta: money(amount - savedAmount) }
}
