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
 * 房屋区域实测档案（DEC-064 / OBJ-007）：区域实测面积/周长的唯一事实源。
 *
 * 同一房屋的区域实测值录一次，该房屋的多个设计方案实例化时按 roomKey → 「区域类型+名称」继承；
 * 未录入为 null（不是 0），参考值与历史估算值不得作为工程量基数。
 */
export interface PropertyRegion {
  id: string
  roomKey?: string
  type: SpaceTypeName
  name: string
  /** 量房快照 开间/进深/层高（m）：只作记录，不用于推算面积与周长（DEC-062）。 */
  length?: number
  width?: number
  height?: number
  /** 实测面积（㎡）/ 实测周长（m）：未录入为 null。 */
  area: number | null
  perimeter: number | null
  /** measured=实测（可作工程量基数）；estimated=估算（仅提示复核）。 */
  areaSource?: 'measured' | 'estimated' | null
  measuredAt?: string
  sort: number
  remark?: string
  /** 只读投影：本次保存联动重算的草稿方案数 / 需人工复核（显式同步）的方案数。 */
  linkedDesignCount?: number
  pendingDesignCount?: number
  /** 候选标记：来自历史方案汇聚的候选值（尚未建档，需人工确认）。 */
  fromCandidate?: boolean
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
