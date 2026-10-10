export type DesignStatus = 'draft' | 'ready' | 'presented' | 'selected' | 'archived'
export type SpaceType = 'bedroom' | 'kitchen' | 'livingRoom' | 'diningRoom' | 'bathroom' | 'balcony'
export type DesignItemType = 'general' | 'construction' | 'material' | 'custom' | 'appliance' | 'soft'
export type PricingMode = 'materialAndManual' | 'materialOnly' | 'manualOnly' | 'fixedTotal'
export type RequirementKind = 'demand' | 'reject'
export type RequirementCategory = 'function' | 'style' | 'material' | 'budget' | 'schedule' | 'quality' | 'other'
export type RequirementPriority = 'high' | 'medium' | 'low'
export type RequirementStatus = 'pending' | 'confirmed' | 'resolved'

export interface DesignRequirement {
  id: string
  customerId?: string
  customerName?: string
  customerCommunity?: string
  propertyId?: string
  propertyNo?: string
  propertyName?: string
  propertyAddress?: string
  kind: RequirementKind
  category: RequirementCategory
  priority: RequirementPriority
  status: RequirementStatus
  title: string
  detail?: string
  response?: string
  spaceName?: string
  confirmedAt?: string
}

export interface DesignSpace {
  id: string
  type: SpaceType
  name: string
  /** 量房快照：现场粗测长/宽/层高，只作记录与偏差参考，不是工程量依据（DEC-062）。 */
  length?: number
  width?: number
  height?: number
  /** 实测面积（㎡）：设计师实测量房后按 CAD 录入；未录入为 null（不是 0）。 */
  area: number | null
  /** 实测周长（m）：未录入为 null。 */
  perimeter: number | null
  /** measured=实测（可作工程量基数）；estimated=历史估算（仅提示复核）。 */
  areaSource?: 'measured' | 'estimated' | null
  sort: number
  remark?: string
}

export interface DesignItem {
  id: string
  spaceId?: string
  catalogItemId?: string
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
  price: number
  amount: number
  pricingMode: PricingMode
  /** 实例化时尺寸未填：quantity=0，待补尺寸；不调整则按 0 赠送。 */
  pendingMeasure?: boolean
  /** 历史中文公式等非专业变量公式：不参与重算，保留既有工程量，待设计师修订（GAP-042）。 */
  formulaRevisionNeeded?: boolean
  remark?: string
}

export interface DesignScheme {
  id: string
  no: string
  name: string
  customerId?: string
  customerName?: string
  propertyId?: string
  propertyNo?: string
  propertyName?: string
  propertyAddress?: string
  propertyArea?: number
  propertyLayout?: string
  propertyStatus?: string
  version: number
  style?: string
  status: DesignStatus
  area: number
  layout?: string
  description?: string
  coverUrl?: string
  cadUrl?: string
  originalPlanUrl?: string
  sitePhotos: string[]
  surveyPhotos: string[]
  originalPlanImages: string[]
  demolitionUrl?: string
  masonryUrl?: string
  optimizationUrl?: string
  spaceCount: number
  itemCount: number
  spaces: DesignSpace[]
  items: DesignItem[]
  requirements: DesignRequirement[]
  createdAt?: string
  updatedAt?: string
}

// ── 谈单（TalkPlan）──────────────────────────────────────────
export type TalkStatus = 'draft' | 'generated' | 'published' | 'archived'
export type TalkSectionType =
  | 'cover' | 'catalog' | 'community' | 'requirement' | 'sitePhoto' | 'survey' | 'surveyReport'
  | 'originalPlan' | 'problem' | 'demolition' | 'masonry' | 'optimization' | 'roomDesign'
  | 'softDecor' | 'material' | 'appliance' | 'investment' | 'saving' | 'end'

export interface TalkSection {
  id: string
  type: TalkSectionType | string
  title: string
  subtitle?: string
  content?: string
  images?: string[]
  sort: number
  visible: boolean
}

/** 谈单资料：绑定 方案 + 报价，产出谈单 PPT（coverUrl / outputUrl / sections）。 */
export interface TalkPlan {
  id: string
  no: string
  designId?: string
  quoteId?: string
  designName?: string
  quoteNo?: string
  title: string
  version: number
  status: TalkStatus
  coverUrl?: string
  outputUrl?: string
  description?: string
  builtAt?: string
  sections?: TalkSection[]
  createdAt?: string
}
