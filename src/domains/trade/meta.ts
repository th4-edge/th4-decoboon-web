import type { StatusTone } from '@/core/tone'
import type { QuoteMode, QuoteStatus } from './model'

/**
 * 报价状态标签口径。
 * 来源：App `src/subpackages/quote/pages/list.vue` 的 STATUS_META（设计师侧）。
 * 注意：App 的 Boss 视图对 Draft/Converted 用了不同色（紫/绿），属 App 内部差异，此处采用设计师侧口径。
 */
export const QUOTE_STATUS_META: Record<QuoteStatus, { label: string; tone: StatusTone }> = {
  draft: { label: '草稿', tone: 'todo' },
  submitted: { label: '待客户确认', tone: 'pending' },
  accepted: { label: '客户已接受', tone: 'done' },
  rejected: { label: '已驳回', tone: 'blocked' },
  superseded: { label: '已被替代', tone: 'muted' },
  converted: { label: '已转项目', tone: 'special' }
}

export const QUOTE_MODE_META: Record<QuoteMode, { label: string; tone: StatusTone }> = {
  package: { label: '套餐报价', tone: 'pending' },
  custom: { label: '自定义报价', tone: 'progress' },
  hybrid: { label: '混合报价', tone: 'special' }
}

/** 报价在工作台中是否可编辑：仅草稿。 */
export function isQuoteEditable(status: QuoteStatus | null): boolean {
  return status === 'draft'
}
