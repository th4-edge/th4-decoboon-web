export type DesignStatus = 'draft' | 'ready' | 'presented' | 'selected' | 'archived'
export type RequirementKind = 'demand' | 'reject'
export type RequirementCategory = 'function' | 'style' | 'material' | 'budget' | 'schedule' | 'quality' | 'other'
export type RequirementPriority = 'high' | 'medium' | 'low'
export type RequirementStatus = 'pending' | 'confirmed' | 'resolved'

export interface DesignRequirement {
  id: string
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

export interface DesignScheme {
  id: string
  no: string
  name: string
  propertyId?: string
  version: number
  style?: string
  status: DesignStatus
  area: number
  layout?: string
  description?: string
  spaceCount: number
  itemCount: number
  requirements: DesignRequirement[]
  createdAt?: string
  updatedAt?: string
}
