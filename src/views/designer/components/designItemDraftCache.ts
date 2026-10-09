import type { DesignItemType, PricingMode } from '@/domains/design/model'

/** 设计分项草稿行（含尚未落库的新增行）。 */
export interface DesignItemDraftRow {
  key: string
  itemId?: string
  catalogItemId: string
  /** 空串表示「综合项目」（不归属具体空间）；与后端 spaceId 为空语义一致。 */
  spaceId: string
  type: DesignItemType
  category: string
  name: string
  brand?: string
  spec?: string
  unit: string
  quantity: number
  quantitySource: 'formula' | 'manual'
  materialPrice: number
  manualPrice: number
  fixedTotalPrice?: number
  pricingMode: PricingMode
  amount: number
  pendingMeasure?: boolean
  remark?: string
  sort: number
}

export interface DesignItemDraft {
  rows: DesignItemDraftRow[]
  deletedItemIds: string[]
}

/**
 * 设计分项内存草稿缓存。
 *
 * <p>设计工作区切换页面/组件卸载会丢失未保存的编辑行；这里按 designId 保留草稿，
 * 返回时恢复，避免设计师在配置分项时静默丢行。</p>
 */
const drafts = new Map<string, DesignItemDraft>()

export const designItemDraftCache = {
  read(designId: string): DesignItemDraft | undefined {
    return drafts.get(designId)
  },
  write(designId: string, draft: DesignItemDraft): void {
    drafts.set(designId, draft)
  },
  clear(designId: string): void {
    drafts.delete(designId)
  }
}
