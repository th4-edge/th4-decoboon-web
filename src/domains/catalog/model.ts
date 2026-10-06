import type { DesignItemType, PricingMode } from '@/domains/design/model'

export interface CatalogItem {
  id: string
  type: DesignItemType
  category: string
  name: string
  brand?: string
  spec?: string
  unit: string
  pricingMode: PricingMode
  materialPrice: number
  manualPrice: number
  costPrice: number
  formula?: string
  craft?: string
  criterion?: string
}
