export interface DocumentArchive {
  documentId: string
  type: string
  audience: string
  businessNo: string
  templateVersion: number
  path: string
  sha256: string
  fileName: string
  contentType: string
  size: number
  generatedAt?: string
  status: string
  url: string
  urlExpiresAt?: string
}

export interface DocumentLayoutBlockInfo {
  key: string
  visible: boolean
  sort: number
}

export interface DocumentLayoutConfig {
  pageSize: 'A3' | 'A4' | 'A5'
  orientation: 'portrait' | 'landscape'
  marginMm: number
  blocks: DocumentLayoutBlockInfo[]
  signatures: string[]
  footer?: string
}

export interface DocumentTemplateInfo {
  templateId?: string
  type: string
  scope: string
  name: string
  version: number
  fieldConfig: Record<string, boolean>
  styleConfig: {
    primaryColor: string
    fontSize: number
    rowSpacing: number
  }
  presetCode?: string
  presetNote?: string
  publishedVersion?: number
  publishedAt?: string
  layoutConfig?: DocumentLayoutConfig
  designerConfig?: VoucherDesignerConfig
}

export interface DocumentTemplateVersionInfo {
  versionId: string
  version: number
  name: string
  presetCode?: string
  status: string
  publishedAt?: string
  createdAt?: string
}

export interface VoucherDesignerElement {
  id: string
  type: string
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
  zIndex?: number
  binding?: string
  fixedText?: string
  style?: Record<string, unknown>
  border?: Record<string, unknown>
}

export interface VoucherDesignerColumn {
  key: string
  label: string
  widthMm: number
  align?: string
}

export interface VoucherDesignerTable {
  id: string
  binding: string
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
  headerRepeat: boolean
  rowsPerPage: number
  rowHeightMm: number
  columns: VoucherDesignerColumn[]
}

export interface VoucherDesignerConfig {
  schemaVersion: number
  page: {
    widthMm: number
    heightMm: number
    orientation: 'portrait' | 'landscape'
    marginMm: number
    gridSizeMm: number
  }
  elements: VoucherDesignerElement[]
  tables: VoucherDesignerTable[]
  print: { scale: number; offsetXMm: number; offsetYMm: number }
}
