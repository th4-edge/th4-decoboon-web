/** 设计模版（方案库）领域模型：与后端 OBJ-005 / BR-040 字段一一对应。 */

export type TemplateScope = 'Personal' | 'Store' | 'Company'
export type TemplateStatus = 'Draft' | 'Published' | 'Disabled'

export interface TemplateVersion {
  versionId: string
  version: number
  status: TemplateStatus
  /** 内容快照：名称/房型/面积区间/标签都在版本上（已发布版本不可变）。 */
  name: string
  houseType: string
  areaMin?: number
  areaMax?: number
  tags?: string
  publishedAt?: string
}

export interface TemplateRoom {
  roomId?: string
  /** 模版内区域唯一键，公式锚点。 */
  roomKey: string
  name: string
  roomType: string
  sortNo: number
  length?: number
  width?: number
  height?: number
  doorWidthTotal?: number
  doorAreaTotal?: number
  windowAreaTotal?: number
  wallRise?: number
  count: number
  remark?: string
}

/** 分项自身不存名称/单位/价格——全部读 catalogItem（EV-160）。 */
export interface TemplateItem {
  itemId: string
  roomKey?: string
  quantityFormula?: string
  defaultQuantity?: number
  sortNo: number
  remark?: string
  catalogItem?: {
    itemId: string
    name: string
    unit: string
    pricingMode: string
    materialPrice: number
    manualPrice: number
    fixedTotalPrice?: number
  }
}

export interface DesignTemplate {
  templateId: string
  scope: TemplateScope
  status: TemplateStatus
  currentVersion?: TemplateVersion
  sourceTemplate?: { templateId: string }
  remark?: string
  rooms?: TemplateRoom[]
  items?: TemplateItem[]
}

export interface TemplatePage {
  content: DesignTemplate[]
  totalElements: number
}

export const SCOPE_LABELS: Record<TemplateScope, string> = {
  Personal: '个人',
  Store: '门店',
  Company: '企业'
}

export const STATUS_LABELS: Record<TemplateStatus, string> = {
  Draft: '草稿',
  Published: '已发布',
  Disabled: '已停用'
}
