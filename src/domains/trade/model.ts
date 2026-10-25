import type { BusinessStateView } from '@/domains/business-state/model'
/** 报价状态：前端小写，后端返回 PascalCase（与 App 归一化方式一致）。 */
export type QuoteStatus = 'draft' | 'submitted' | 'accepted' | 'rejected' | 'superseded' | 'converted'

export type QuoteMode = 'package' | 'custom' | 'hybrid'

const QUOTE_STATUS_MAP: Record<string, QuoteStatus> = {
  Draft: 'draft',
  Submitted: 'submitted',
  Accepted: 'accepted',
  Rejected: 'rejected',
  Superseded: 'superseded',
  Converted: 'converted'
}

const QUOTE_MODE_MAP: Record<string, QuoteMode> = {
  Package: 'package',
  Custom: 'custom',
  Hybrid: 'hybrid'
}

export function normalizeQuoteStatus(raw: unknown): QuoteStatus | null {
  if (typeof raw !== 'string') return null
  return QUOTE_STATUS_MAP[raw] ?? null
}

export function normalizeQuoteMode(raw: unknown): QuoteMode | null {
  if (typeof raw !== 'string') return null
  return QUOTE_MODE_MAP[raw] ?? null
}

/* ─────────────────────────────────────────────────────────────
   报价领域模型（字段与 App `src/domains/trade/model.ts` 对齐）
   实测来源：本地 decoboon `quote/designer/info` 真实响应
   ───────────────────────────────────────────────────────────── */

/** Provider 枚举序列化形态。 */
export interface TradeEnum {
  key: string
  value?: string
  name: string
}

export interface QuoteSpace {
  spaceId: string
  name: string
  type?: TradeEnum
}

export type QuoteViewMode = 'REGION' | 'TYPE'

export interface QuoteComponent {
  type?: TradeEnum
  name?: string
  saleAmount: number
  formula?: string
  sort?: number
}

/** 报价行引用的目录项（服务端返回关联对象的白名单投影）。 */
export interface QuoteItemCatalogRef {
  itemId: string
  name?: string
  category?: string
}

export interface QuoteItem {
  id: string
  /** 原始报价行 ID；TYPE 合并行没有 itemId，必须用 sourceLineIds 回溯。 */
  itemId?: string
  catalogItem?: QuoteItemCatalogRef
  name: string
  type?: TradeEnum
  category?: string
  space?: QuoteSpace
  brand?: string
  spec?: string
  unit: string
  quantity: number
  /** 工程量公式（服务端已返回；为空表示无公式） */
  quantityFormula?: string
  materialPrice: number
  manualPrice: number
  pricingMode?: TradeEnum
  fixedTotalPrice?: number
  price: number
  /** 金额；null/undefined 表示暂不可确认，禁止前端补 0。 */
  amount?: number | null
  formula?: string
  craft?: string
  role?: TradeEnum
  differenceType?: TradeEnum
  differenceStatus?: TradeEnum
  included?: boolean
  discountAmount?: number
  components?: QuoteComponent[]
  typeRowId?: string
  sourceLineIds?: string[]
  sourceRegionIds?: Array<string | null>
  sourceRegionNames?: string[]
  sourceCount?: number
}

export interface QuoteGroupRaw {
  key: string
  name: string
  groupMode?: QuoteViewMode
  type?: TradeEnum
  category?: string
  unit?: string
  quantity?: number
  amount?: number
  items: QuoteItem[]
}

export interface Quote {
  id: string
  no: string
  /** 内容修订令牌（并发冲突检测）；由服务端计算，Web 只透传 */
  revision?: string
  /** 版本轨道用：定位同一房屋的历史版本 */
  customerId?: string
  customerName?: string
  propertyId?: string
  propertyName?: string
  /** 来源设计方案；用于设计工作区判断“生成报价 / 继续报价” */
  designId?: string
  designName?: string
  title?: string
  version: number
  status: QuoteStatus
  mode: QuoteMode | null
  area: number
  subtotal: number
  amount: number
  discount: number
  taxRate: number
  taxAmount: number
  designFee?: number
  managementFee?: number
  /** 标准成本（仅 BOSS/店长/财务可见，BR-052）；缺失表示无成本权限或未返回 */
  cost?: number | null
  costComplete?: boolean
  items: QuoteItem[]
  businessStateView?: BusinessStateView
  /** undefined 表示服务端未返回分组，不等于没有分项。 */
  regionGroups?: QuoteGroupRaw[]
  typeGroups?: QuoteGroupRaw[]
  constructionGroups: QuoteGroupRaw[]
  materialGroups: QuoteGroupRaw[]
  otherGroups: QuoteGroupRaw[]
  createdAt?: string
  /** 报价创建者（设计师）摘要，财务按设计师分组用 */
  createdBy?: { empId?: string; name?: string }
}

/** 工程量单位：Provider 枚举值 → 中文。 */
export const UNIT_NAMES: Record<string, string> = {
  Area: '㎡', Count: '个', Item: '项', Place: '处', Set: '套', House: '户',
  Metre: 'm', Centimeter: 'cm', Step: '步', Plate: '樘', Block: '块', Root: '根',
  Hole: '扇', Pcs: '台', Stick: '支', Grid: '格', Sheet: '片'
}
