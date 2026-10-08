import { post } from '@/core/http'
import { normalizeBusinessStateView } from '@/domains/business-state/api'
import {
  normalizeQuoteMode,
  normalizeQuoteStatus,
  type Quote,
  type QuoteStatus,
  type QuoteGroupRaw,
  type QuoteItem,
  type QuoteSpace,
  type TradeEnum
} from './model'
import { UNIT_NAMES } from './model'

type RawRecord = Record<string, unknown>

/** 枚举取值：兼容字符串与 {key,value,name} 两种序列化。 */
function enumValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const record = raw as RawRecord
    return String(record.value ?? record.key ?? '')
  }
  return ''
}

function num(raw: unknown): number {
  const value = Number(raw ?? 0)
  return Number.isNaN(value) ? 0 : value
}

function str(raw: unknown): string {
  return raw === null || raw === undefined ? '' : String(raw)
}

function normalizeSpace(raw: unknown): QuoteSpace | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const record = raw as RawRecord
  return {
    spaceId: str(record.spaceId ?? record.id),
    name: str(record.name),
    type: record.type ? (record.type as TradeEnum) : undefined
  }
}

function normalizeItem(raw: RawRecord): QuoteItem {
  const unitValue = enumValue(raw.unit)
  return {
    id: str(raw.itemId ?? raw.id),
    name: str(raw.name),
    catalogItem: raw.catalogItem && typeof raw.catalogItem === 'object'
      ? {
          itemId: str((raw.catalogItem as RawRecord).itemId),
          name: (raw.catalogItem as RawRecord).name ? str((raw.catalogItem as RawRecord).name) : undefined,
          category: (raw.catalogItem as RawRecord).category ? str((raw.catalogItem as RawRecord).category) : undefined
        }
      : undefined,
    type: raw.type ? (raw.type as TradeEnum) : undefined,
    category: raw.category ? str(raw.category) : undefined,
    space: normalizeSpace(raw.space),
    brand: raw.brand ? str(raw.brand) : undefined,
    spec: raw.spec ? str(raw.spec) : undefined,
    unit: UNIT_NAMES[unitValue] ?? unitValue ?? '项',
    quantity: num(raw.quantity),
    quantityFormula: raw.quantityFormula ? str(raw.quantityFormula) : undefined,
    materialPrice: num(raw.materialPrice),
    manualPrice: num(raw.manualPrice),
    pricingMode: raw.pricingMode ? (raw.pricingMode as TradeEnum) : undefined,
    fixedTotalPrice: raw.fixedTotalPrice === undefined || raw.fixedTotalPrice === null ? undefined : num(raw.fixedTotalPrice),
    price: num(raw.price),
    amount: num(raw.amount),
    formula: raw.formula ? str(raw.formula) : undefined,
    craft: raw.craft ? str(raw.craft) : undefined,
    role: raw.role ? (raw.role as TradeEnum) : undefined,
    differenceType: raw.differenceType ? (raw.differenceType as TradeEnum) : undefined,
    differenceStatus: raw.differenceStatus ? (raw.differenceStatus as TradeEnum) : undefined,
    included: raw.included !== false,
    discountAmount: num(raw.discountAmount)
  }
}

function normalizeGroup(raw: RawRecord): QuoteGroupRaw {
  return {
    key: str(raw.key ?? raw.name),
    name: str(raw.name),
    quantity: num(raw.quantity),
    amount: num(raw.amount),
    items: Array.isArray(raw.items) ? (raw.items as RawRecord[]).map(normalizeItem) : []
  }
}

function normalizeGroups(raw: unknown): QuoteGroupRaw[] {
  return Array.isArray(raw) ? (raw as RawRecord[]).map(normalizeGroup) : []
}

export function normalizeQuote(raw: RawRecord): Quote {
  return {
    id: str(raw.quoteId ?? raw.id),
    no: str(raw.no),
    revision: raw.revision ? str(raw.revision) : undefined,
    customerId: raw.customer ? str((raw.customer as RawRecord).custId ?? (raw.customer as RawRecord).id) : undefined,
    customerName: raw.customer ? str((raw.customer as RawRecord).name) : undefined,
    propertyId: raw.property
      ? str((raw.property as RawRecord).propertyId ?? (raw.property as RawRecord).id)
      : undefined,
    propertyName: raw.property
      ? str((raw.property as RawRecord).community ?? (raw.property as RawRecord).address)
      : undefined,
    designId: raw.design ? str((raw.design as RawRecord).designId ?? (raw.design as RawRecord).id) || undefined : undefined,
    designName: raw.design ? str((raw.design as RawRecord).name) || undefined : undefined,
    title: raw.title ? str(raw.title) : undefined,
    version: num(raw.version) || 1,
    status: normalizeQuoteStatus(enumValue(raw.status)) ?? 'draft',
    mode: normalizeQuoteMode(enumValue(raw.mode)),
    area: num(raw.area),
    subtotal: num(raw.subtotal ?? raw.amount),
    amount: num(raw.amount),
    discount: raw.discount === undefined ? 1 : num(raw.discount),
    taxRate: num(raw.taxRate),
    taxAmount: num(raw.taxAmount),
    designFee: raw.designFee === undefined ? undefined : num(raw.designFee),
    managementFee: raw.managementFee === undefined ? undefined : num(raw.managementFee),
    items: Array.isArray(raw.items) ? (raw.items as RawRecord[]).map(normalizeItem) : [],
    businessStateView: normalizeBusinessStateView(raw.businessStateView),
    regionGroups: normalizeGroups(raw.regionGroups),
    constructionGroups: normalizeGroups(raw.constructionGroups),
    materialGroups: normalizeGroups(raw.materialGroups),
    otherGroups: normalizeGroups(raw.otherGroups),
    createdAt: raw.createTime ? str((raw.createTime as RawRecord)?.dateTime ?? raw.createTime) : undefined
  }
}

/**
 * 读取报价详情。
 * 路由与 App 完全一致（`src/domains/trade/api.ts`）：设计师走 `quote/designer/info`。
 */
export async function quoteInfo(quoteId: string): Promise<Quote> {
  const raw = await post<RawRecord>('quote/designer/info', { quoteId })
  return normalizeQuote(raw)
}

/**
 * 报价工作表批量保存（Web 专用）。
 *
 * 依据业务冻结答复 `ANS-BIZ-20261002-002` Q4/Q5：
 * - 设计师在 Draft 报价中可编辑：工程量、工程量公式、销售侧材料单价、人工单价、
 *   行级优惠、FixedTotal 固定总价；
 * - 不可见/不可改：标准成本、采购执行价、利润；全局折扣/税率/最终签约价仅 Boss/店长/财务；
 * - **Web 的批量与公式能力走 Web 专用 `quote/lines/save`**，
 *   不得用 App 单行入口（`quote/line/save`）冒充四项可写——该入口只接受工程量，
 *   且会把材料价/人工价按项目库强制覆盖。
 *
 * 服务端约束（`QuoteWorkbookContext.update`）：
 * - 仅 Draft，且仅报价创建者（设计师）可调用；
 * - 单次最多 200 行；每行 itemId 必须属于该报价；
 * - 金额类字段仅在 **> 0** 时生效（零价被服务端阻断）；
 * - 提供 `quantityFormula` 时以公式求值结果为准；仅传 `quantity` 会清空原公式。
 */
export interface QuoteLineBatchItem {
  itemId: string
  quantity?: number
  quantityFormula?: string
  materialPrice?: number
  manualPrice?: number
  fixedTotalPrice?: number
  /**
   * 字段显式提供标记（ECD-014）。
   * 后端实体默认值（quantity=1 / materialPrice=0 / manualPrice=0）无法区分
   * 「未传」与「显式传默认值」，因此后端按这些标记判断是否为本次修改：
   * **未标记 = 保留原值**。只有真正要改的字段才置 true。
   */
  quantityProvided?: boolean
  materialPriceProvided?: boolean
  manualPriceProvided?: boolean
  fixedTotalPriceProvided?: boolean
}

export interface QuoteLineBatchInput {
  quoteId: string
  items: QuoteLineBatchItem[]
  /** 读取时的内容修订令牌；不一致服务端返回 409 */
  revisionToken?: string
}

/** 单次批量保存的最大行数（与服务端 MAX_LINES 对齐）。 */
export const QUOTE_BATCH_MAX_LINES = 200

/** 保存并返回**新的**内容修订令牌（用于分批链式提交）。 */
export async function saveQuoteLines(input: QuoteLineBatchInput): Promise<string | undefined> {
  const raw = await post<RawRecord>('quote/lines/save', input)
  return raw?.revision ? String(raw.revision) : undefined
}

/* ─────────────────────────────────────────────────────────────
   版本轨道：复用既有 quote/designer/page 与 quote/save(rebase)
   不新增版本实体、不另造版本状态机
   ───────────────────────────────────────────────────────────── */

export interface QuotePageQuery {
  customerId?: string
  current?: number
  size?: number
}

/** 分页结果兼容：数组 或 {content|list|records}。 */
function pageRows(raw: unknown): RawRecord[] {
  if (Array.isArray(raw)) return raw as RawRecord[]
  if (raw && typeof raw === 'object') {
    const record = raw as RawRecord
    for (const key of ['content', 'list', 'records']) {
      const value = record[key]
      if (Array.isArray(value)) return value as RawRecord[]
    }
  }
  return []
}

/**
 * 读取当前设计师的报价分页。
 * 用于版本轨道：按 customerId 取回后，客户端再按 propertyId 过滤、按 version 倒序
 * （与旧版 Web 的做法一致；投影已返回 property/version/status/createTime，无需后端改动）。
 */
export async function quoteDesignerPage(query: QuotePageQuery): Promise<Quote[]> {
  const raw = await post<unknown>('quote/designer/page', {
    current: query.current ?? 1,
    size: query.size ?? 200,
    customerId: query.customerId
  })
  return pageRows(raw).map(normalizeQuote)
}

/**
 * 改版重报：由服务端基于既有 **Rejected** 报价生成新版本 Draft。
 * 服务端规则（QuoteCopyContext#rebase）：仅 Rejected 可重报；
 * 该房屋若已有客户确认报价或项目则拒绝；版本号由服务端生成，Web 不得自造。
 */
export async function rebaseQuote(sourceQuoteId: string): Promise<Quote> {
  const raw = await post<RawRecord>('quote/save', { sourceQuoteId })
  return normalizeQuote(raw)
}

export interface CreateQuoteFromDesignInput {
  designId: string
  /** 初始折扣；不传时由服务端按 1 处理。 */
  discount?: number
}

/** 方案完成后的主线动作：按设计方案分项生成报价草稿。 */
export async function createQuoteFromDesign(input: CreateQuoteFromDesignInput): Promise<Quote> {
  const raw = await post<RawRecord>('quote/save', {
    designId: input.designId,
    discount: input.discount ?? 1
  })
  return normalizeQuote(raw)
}

export const tradeApi = { quoteInfo, saveQuoteLines, quoteDesignerPage, rebaseQuote, createQuoteFromDesign, transitionQuote, deleteQuoteLine, exportQuoteWorkbook, importQuoteWorkbook, applyQuoteWorkbook }


/** 报价状态流转：仅调用 App 既有 `quote/update`，前端不自造状态机。 */
export async function transitionQuote(quoteId: string, status: QuoteStatus): Promise<Quote> {
  const statusMap: Record<QuoteStatus, string> = {
    draft: 'Draft',
    submitted: 'Submitted',
    accepted: 'Accepted',
    rejected: 'Rejected',
    superseded: 'Superseded',
    converted: 'Converted'
  }
  const raw = await post<RawRecord>('quote/update', { quoteId, status: statusMap[status] })
  return normalizeQuote(raw)
}

/** 删除报价行：使用 App 既有单行入口，删除后必须重新读取服务端报价。 */
export async function deleteQuoteLine(quoteId: string, itemId: string): Promise<boolean> {
  return post<boolean>('quote/line/delete', { quoteId, itemId })
}

/* ── 报价工作簿：Excel 导入 / 导出 / 确认落库（Provider 与 App/V2 一致） ── */

export interface QuoteWorkbookFile {
  fileName: string
  contentType: string
  contentBase64: string
  sha256?: string
}

export interface QuoteWorkbookImportRow {
  excelRow: number
  itemId: number | null
  region?: string
  name?: string
  quantity?: number | null
  quantityFormula?: string | null
  materialPrice?: number | null
  manualPrice?: number | null
  importable: boolean
  errors?: string[]
}

export interface QuoteWorkbookImportResult {
  total: number
  valid: number
  failed: number
  rows: QuoteWorkbookImportRow[]
}

/** 导出设计师报价工作簿（App 自有的 xlsx 格式）。 */
export async function exportQuoteWorkbook(quoteId: string, variant?: string): Promise<QuoteWorkbookFile> {
  const raw = await post<RawRecord>('quote/workbook/build', { quoteId, variant })
  return {
    fileName: str(raw.fileName) || `quote-${quoteId}.xlsx`,
    contentType: str(raw.contentType) || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    contentBase64: str(raw.contentBase64),
    sha256: raw.sha256 ? str(raw.sha256) : undefined
  }
}

/** 解析 Excel 导入预览；错误行由服务端返回，不在前端静默跳过。 */
export async function importQuoteWorkbook(
  quoteId: string,
  fileName: string,
  contentBase64: string
): Promise<QuoteWorkbookImportResult> {
  const raw = await post<RawRecord>('quote/workbook/import', { quoteId, fileName, contentBase64 })
  const rows = Array.isArray(raw.rows) ? raw.rows as RawRecord[] : []
  return {
    total: num(raw.total),
    valid: num(raw.valid),
    failed: num(raw.failed),
    rows: rows.map((row) => ({
      excelRow: num(row.excelRow),
      itemId: row.itemId === null || row.itemId === undefined ? null : num(row.itemId),
      region: row.region ? str(row.region) : undefined,
      name: row.name ? str(row.name) : undefined,
      quantity: row.quantity === null || row.quantity === undefined ? null : num(row.quantity),
      quantityFormula: row.quantityFormula ? str(row.quantityFormula) : null,
      materialPrice: row.materialPrice === null || row.materialPrice === undefined ? null : num(row.materialPrice),
      manualPrice: row.manualPrice === null || row.manualPrice === undefined ? null : num(row.manualPrice),
      importable: row.importable !== false,
      errors: Array.isArray(row.errors) ? row.errors.map(str) : []
    }))
  }
}

/** 确认导入并落库：服务端统一校验 Draft / 本人报价 / 区域 / 错误行并重算。 */
export async function applyQuoteWorkbook(
  quoteId: string,
  fileName: string,
  contentBase64: string,
  mode: 'MERGE' | 'OVERWRITE' = 'MERGE'
): Promise<Quote> {
  const raw = await post<RawRecord>('quote/workbook/apply', { quoteId, fileName, contentBase64, mode })
  return normalizeQuote(raw)
}
