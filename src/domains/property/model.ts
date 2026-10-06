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
  createdAt?: string
}
