import type { DesignItemType, PricingMode } from '@/domains/design/model'

export interface CatalogItem {
  id: string
  type: DesignItemType
  code?: string
  category: string
  name: string
  brand?: string
  series?: string
  spec?: string
  unit: string
  pricingMode: PricingMode
  /** 销售侧材料价；设计师侧不含标准成本、采购价和供应商历史价。 */
  materialPrice: number
  /** 销售侧人工价。 */
  manualPrice: number
  /** 固定总价（仅 fixedTotal 计价方式使用）。 */
  fixedTotalPrice?: number
  /**
   * 标准成本：仅 BOSS、店长、财务响应中返回。
   * 字段缺失 = 当前角色无权查看；null = 成本待维护；0 = 明确零成本。
   */
  costPrice?: number | null
  formula?: string
  craft?: string
  criterion?: string
  description?: string
  /** Catalog 私有文件路径；展示前按业务对象签发短期预览 URL。 */
  images: string[]
  active: boolean
  sort: number
  revision: number
}

export interface CatalogMaintenanceInput {
  itemId?: string
  type: DesignItemType
  code?: string
  category: string
  brand?: string
  series?: string
  spec?: string
  name: string
  unit: string
  pricingMode: PricingMode
  materialPrice: number
  manualPrice: number
  fixedTotalPrice?: number
  costPrice?: number | null
  formula?: string
  craft?: string
  criterion?: string
  description?: string
  images?: string[]
  active: boolean
  sort: number
  revision: number
}

/** 后端 CatalogTree 的分面结构；各层级均以业务分类为第一维。 */
export interface CatalogTree {
  type: DesignItemType
  categories: string[]
  /** category -> brands */
  brands: Record<string, string[]>
  /** category -> specs */
  specs: Record<string, string[]>
  /** category -> brand -> series */
  seriesByBrand: Record<string, Record<string, string[]>>
  /** category -> brand -> series -> specs */
  specsBySeries: Record<string, Record<string, Record<string, string[]>>>
  total: number
}

export interface CatalogPageResult {
  items: CatalogItem[]
  total: number
  current: number
  size: number
  pages: number
}

export type CatalogRevisionType = 'Create' | 'Update' | 'Disable' | 'Enable' | 'Delete'

/** 不可变报价项目修订；成本敏感快照由服务端按角色裁剪。 */
export interface CatalogRevision {
  id: string
  revision: number
  changeType: CatalogRevisionType
  itemCode?: string
  snapshotJson?: string
  snapshotHash?: string
  changedBy?: { id: string; name: string }
  changedAt?: string
}
