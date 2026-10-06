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
}

export interface CatalogTree {
  type: DesignItemType
  categories: string[]
  brands: Record<string, string[]>
  specs: Record<string, string[]>
  seriesByBrand: Record<string, string[]>
  specsBySeries: Record<string, string[]>
  total: number
}
