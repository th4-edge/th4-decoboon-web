export type PropertyStatus = 'pendingMeasure' | 'measuring' | 'measured' | 'designing' | 'quoted' | 'contracted' | 'serving' | 'completed'

export interface Property {
  id: string
  propertyNo: string
  customerId: string
  community?: string
  building?: string
  roomNo?: string
  address: string
  area: number
  layout?: string
  status: PropertyStatus
  latestMeasureAt?: string
  remark?: string
  createdAt?: string
}

/**
 * 量房原始区域（DEC-066 / DEC-007）：量房测的是**房屋原始结构**，布局与区域基本固定，
 * 因此原始区域挂在量房单下；量房结束后（量房单已完成）冻结，需要修正必须重新量房（复尺）。
 *
 * 新建方案/实例化时可**继承**原始区域作为结构起点，但**不联动**：装修设计会破坏结构
 * （砌墙隔出新卧室、砸墙打通客厅），设计后结构与原始结构不同是常态。
 */
export interface MeasureRegion {
  id: string
  roomKey?: string
  type: SpaceTypeName
  name: string
  /** 量房快照 开间/进深/层高（m）：只作记录，不用于推算面积与周长（DEC-062）。 */
  length?: number
  width?: number
  height?: number
  /** 原始结构实测面积（㎡）/ 实测周长（m）：未录入为 null。 */
  area: number | null
  perimeter: number | null
  /** measured=实测（可作工程量基数）；estimated=估算（仅提示复核）。 */
  areaSource?: 'measured' | 'estimated' | null
  measuredAt?: string
  sort: number
  remark?: string
}

export type SpaceTypeName = 'bedroom' | 'kitchen' | 'livingRoom' | 'diningRoom' | 'bathroom' | 'balcony'

export type MeasureStatus = 'scheduled' | 'completed' | 'cancelled'

export interface Measure {
  id: string
  propertyId: string
  measureTime?: string
  scheduledAt?: string
  completedAt?: string
  status: MeasureStatus
  originalStructure?: string
  dimensions?: string
  customerRequirements?: string
  designerConclusion?: string
  sitePhotos: string[]
  structureImages: string[]
  attachments: string[]
  createdAt?: string
}
