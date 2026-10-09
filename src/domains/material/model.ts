export interface MaterialSelectionItem {
  itemId: string
  projectId: string
  projectNo?: string
  projectName?: string
  propertyId: string
  propertyAddress?: string
  designerName?: string
  contractId?: string
  contractNo?: string
  spaceName?: string
  category?: string
  materialName: string
  brand?: string
  spec?: string
  unit?: string
  quantity: number
  required: boolean
  selectionId?: string
  version?: number
  status?: string
  statusName?: string
  selectionText?: string
  selectionJson?: string
  attachments?: string[]
  orderStatus?: string
  orderStatusName?: string
  nextAction?: string
}

export interface SelectionSnapshot {
  color?: string
  spec?: string
  brand?: string
  process?: string
  remark?: string
}

/** 项目交付·主材选材队列项：当前员工数据范围内尚未完成逐项选材的在跑项目。 */
export interface SelectionBoardItem {
  projectId: string
  projectNo?: string
  projectName: string
  projectStatus?: string
  projectStatusName?: string
  propertyId: string
  propertyAddress?: string
  community?: string
  area?: number
  designerName?: string
  selectionId?: string
  selectionStatus?: string
  selectionStatusName: string
  totalItems: number
  selectedItems: number
  deliveredItems: number
  notSelectedItems: number
  orderedItems: number
  progress: number
  version?: number
  updatedAt?: number
  nextAction?: string
}
