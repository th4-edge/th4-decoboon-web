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
  /** measured=实测（可作工程量基数）；estimated=历史估算/模版参考（仅提示复核，不进金额）。 */
  areaSource?: 'measured' | 'estimated' | null
  /**
   * 区域取值来源（DEC-066）：
   * measure=继承量房原始区域（结构起点）；override=方案内录入/改造；templateReference=模版参考值（待实测确认，不进金额）。
   */
  valueOrigin?: 'measure' | 'override' | 'templateReference' | null
  /** 来源量房原始区域（仅来源标识，方案与量房原始区域不联动）。 */
  sourceMeasureRegionId?: string
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
  fixedTotalPrice?: number
  price: number
  amount: number
  /** 成本字段仅 BOSS、店长、财务响应中返回；undefined 表示当前角色无权查看。 */
  costPrice?: number | null
  cost?: number | null
  pricingMode: PricingMode
  /** 分项排序：按「区域 → 类型 → 组内自定义」计算后的全局顺序。 */
  sort: number
  /** 报价项目库计价说明快照，例如「(材料单价) × 工程量」。 */
  formula?: string
  /** 工程量自动计算公式，只允许 A/P/WP/CP 等专业变量。 */
  quantityFormula?: string
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
  ownerId?: string
  ownerName?: string
  storeId?: string
  storeName?: string
  version: number
  style?: string
  status: DesignStatus
  /** 服务端按业务锁定推导的当前员工可编辑结论；前端不得自行按方案状态复制门禁。 */
  editable: boolean
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
  /** 当前设计分项销售金额合计；由服务端计算。 */
  calculatedAmount: number
  /** 当前正式报价摘要；由服务端统一选择，前端不得自行推断。 */
  currentQuoteId?: string
  currentQuoteNo?: string
  currentQuoteVersion?: number
  currentQuoteStatus?: string
  currentQuoteStatusName?: string
  currentQuoteAmount?: number
  /** 列表主价格来源：正式报价 / 方案计算价 / 暂不可计算。 */
  priceSource: 'quote' | 'calculated' | 'unavailable'
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

export interface DesignReviewQuery {
  status?: DesignStatus
  ownerId?: string
  storeId?: string
  keyword?: string
  current?: number
  size?: number
}

export interface DesignReviewPageResult {
  items: DesignScheme[]
  total: number
  current: number
  size: number
  pages: number
}
