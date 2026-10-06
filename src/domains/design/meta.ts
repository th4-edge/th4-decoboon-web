import type { DesignItemType, PricingMode, SpaceType } from './model'

/** 设计分项类型展示名（与 App 设计编辑器一致）。 */
export const DESIGN_ITEM_TYPE_LABELS: Record<DesignItemType, string> = {
  construction: '施工',
  material: '主材',
  custom: '全屋定制',
  appliance: '电器',
  soft: '软装家具',
  general: '综合'
}

/** 工作区分组顺序：施工 → 主材 → 定制 → 电器 → 软装 → 综合。 */
export const DESIGN_ITEM_TYPE_ORDER: DesignItemType[] = [
  'construction', 'material', 'custom', 'appliance', 'soft', 'general'
]

export const PRICING_MODE_LABELS: Record<PricingMode, string> = {
  materialAndManual: '材料+人工',
  materialOnly: '仅材料',
  manualOnly: '仅人工',
  fixedTotal: '固定总价'
}

export const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
  bedroom: '卧室',
  kitchen: '厨房',
  livingRoom: '客厅',
  diningRoom: '餐厅',
  bathroom: '卫生间',
  balcony: '阳台'
}
