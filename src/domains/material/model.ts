export type SelectionSaveStatus = 'draft' | 'pendingConfirm'

export interface MaterialSelectionItem {
  itemId: string
  projectId: string
  projectNo?: string
  projectName?: string
  propertyId: string
  propertyAddress?: string
  customerName?: string
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
  confirmerName?: string
  confirmedByName?: string
  confirmedAt?: string
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
