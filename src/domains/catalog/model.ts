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
  fixedTotalPrice?: number
  formula?: string
  craft?: string
  criterion?: string
  description?: string
  /** Catalog 私有文件路径；展示前按业务对象签发短期预览 URL。 */
  images: string[]
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
