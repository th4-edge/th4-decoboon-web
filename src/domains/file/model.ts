export type PrivateFileScope =
  | 'Report'
  | 'Acceptance'
  | 'ContractChange'
  | 'Design'
  | 'Talk'
  | 'Measure'
  | 'Task'
  | 'Feedback'
  | 'GoodsReceipt'
  | 'StockMovement'
  | 'Catalog'

export interface UploadedFile {
  path: string
  url: string
  name?: string
  contentType?: string
  size?: number
}
