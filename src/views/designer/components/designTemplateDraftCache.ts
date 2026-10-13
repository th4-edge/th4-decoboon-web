import type { DesignItemType } from '@/domains/design/model'

/** 方案模版分项草稿行（含尚未落库的新增行）。 */
export interface DesignTemplateDraftRow {
  key: string
  itemId?: string
  catalogItemId: string
  /** 空串表示综合项目；其余为 roomKey。 */
  roomKey: string
  type: DesignItemType
  name: string
  unit: string
  quantityFormula: string
  defaultQuantity?: number
  remark?: string
  sortNo: number
}

export interface DesignTemplateDraft {
  rows: DesignTemplateDraftRow[]
  deletedItemIds: string[]
  /** 已标记删除但尚未落库的行；失败或离开时用于恢复。 */
  deletedRows?: DesignTemplateDraftRow[]
}

const drafts = new Map<string, DesignTemplateDraft>()

/** 方案模版分项内存草稿缓存：按 versionId 保存未自动保存的行与删除标记。 */
export const designTemplateDraftCache = {
  read(versionId: string): DesignTemplateDraft | undefined {
    return drafts.get(versionId)
  },
  write(versionId: string, draft: DesignTemplateDraft): void {
    drafts.set(versionId, draft)
  },
  clear(versionId: string): void {
    drafts.delete(versionId)
  }
}
