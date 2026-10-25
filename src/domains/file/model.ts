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
  | 'CustomerFollow'
  | 'Expense'

export interface UploadedFile {
  path: string
  url: string
  name?: string
  contentType?: string
  size?: number
}
