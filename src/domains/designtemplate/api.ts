import { post } from '@/core/http'
import type { DesignTemplate, TemplateItem, TemplatePage, TemplateRoom, TemplateScope } from './model'

/** 设计模版（方案库）Provider 封装。 */

export interface TemplateQuery {
  current?: number
  size?: number
  scope?: TemplateScope
  status?: string
}


/** 后端枚举以 {name,value,key} 对象返回，前端统一取字符串值（对齐 catalog/api 的 enumValue 约定）。 */
function enumValue(value: unknown): string {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return String(record.value ?? record.key ?? record.name ?? '')
  }
  return value == null ? '' : String(value)
}

function normalizeRoom(raw: any) {
  return { ...raw, roomType: enumValue(raw?.roomType) }
}

function normalizeItem(raw: any) {
  return {
    ...raw,
    catalogItem: raw?.catalogItem
      ? { ...raw.catalogItem, unit: enumValue(raw.catalogItem.unit), pricingMode: enumValue(raw.catalogItem.pricingMode) }
      : undefined
  }
}

function normalizeVersion(raw: any) {
  return raw ? { ...raw, status: enumValue(raw.status) } : undefined
}

function normalizeTemplate(raw: any): DesignTemplate {
  return {
    ...raw,
    scope: enumValue(raw?.scope) as DesignTemplate['scope'],
    status: enumValue(raw?.status) as DesignTemplate['status'],
    currentVersion: normalizeVersion(raw?.currentVersion),
    rooms: Array.isArray(raw?.rooms) ? raw.rooms.map(normalizeRoom) : undefined,
    items: Array.isArray(raw?.items) ? raw.items.map(normalizeItem) : undefined
  }
}

export async function pageTemplates(query: TemplateQuery = {}): Promise<TemplatePage> {
  const raw = await post<{ content?: unknown[]; totalElements?: number }>('design/template/page', query)
  return {
    content: (raw.content ?? []).map((item) => normalizeTemplate(item)),
    totalElements: raw.totalElements ?? 0
  }
}

export async function templateInfo(templateId: string, versionId?: string): Promise<DesignTemplate> {
  return normalizeTemplate(await post<unknown>('design/template/info', { templateId, versionId }))
}

export interface SaveTemplatePayload {
  name: string
  houseType: string
  areaMin?: number
  areaMax?: number
  tags?: string
  scope: TemplateScope
  remark?: string
}

export async function saveTemplate(payload: SaveTemplatePayload): Promise<DesignTemplate> {
  return normalizeTemplate(await post<unknown>('design/template/save', payload))
}

export async function publishTemplate(templateId: string): Promise<DesignTemplate> {
  return normalizeTemplate(await post<unknown>('design/template/publish', { templateId }))
}

/** 保存区域：只写草稿版本；尺寸可留空表示待量房。 */
export async function saveRoom(payload: TemplateRoom & { versionId: string }): Promise<TemplateRoom> {
  return normalizeRoom(await post<unknown>('design/template/room/save', payload)) as TemplateRoom
}

/** 保存分项：只接收引用 + 公式 + 固定数量，不接收名称/单位/价格。 */
export async function saveItem(payload: {
  versionId: string
  itemId?: string
  roomKey?: string
  catalogItemId: string
  quantityFormula?: string
  defaultQuantity?: number
  sortNo?: number
  remark?: string
}): Promise<TemplateItem> {
  return normalizeItem(await post<unknown>('design/template/item/save', payload)) as TemplateItem
}

/** 实例化到设计方案（幂等：同房屋同模版版本只生成一次）。 */
export function instantiateTemplate(payload: {
  templateId: string
  versionId?: string
  propertyId: string
  name?: string
}): Promise<{ designId: string; no: string; name: string }> {
  return post('design/template/instantiate', payload)
}
