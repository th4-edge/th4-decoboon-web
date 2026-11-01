import { post } from '@/core/http'
import type { DesignTemplate, TemplateItem, TemplatePage, TemplateRoom, TemplateScope } from './model'
import type { DesignItemType } from '@/domains/design/model'
import { unitLabel } from '@/domains/catalog/api'

/** 设计模版（方案库）Provider 封装。 */

export interface TemplateQuery {
  current?: number
  size?: number
  scope?: TemplateScope
  status?: string
  keyword?: string
  houseType?: string
  areaMin?: number
  areaMax?: number
  tag?: string
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

const ITEM_TYPE: Record<string, DesignItemType> = {
  General: 'general',
  Construction: 'construction',
  Material: 'material',
  Custom: 'custom',
  Appliance: 'appliance',
  Soft: 'soft'
}

function normalizeItem(raw: any) {
  return {
    ...raw,
    catalogItem: raw?.catalogItem
      ? {
          ...raw.catalogItem,
          type: ITEM_TYPE[enumValue(raw.catalogItem.type)] ?? 'construction',
          unit: unitLabel(raw.catalogItem.unit),
          pricingMode: enumValue(raw.catalogItem.pricingMode)
        }
      : undefined
  }
}

function dateTimeText(value: unknown): string {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return String(record.dateTime ?? record.value ?? record.time ?? '')
  }
  return value == null ? '' : String(value)
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
    updateTime: dateTimeText(raw?.updateTime),
    rooms: Array.isArray(raw?.rooms) ? raw.rooms.map(normalizeRoom) : undefined,
    items: Array.isArray(raw?.items) ? raw.items.map(normalizeItem) : undefined
  }
}

export async function pageTemplates(query: TemplateQuery = {}): Promise<TemplatePage> {
  const raw = await post<{ content?: unknown[]; totalElements?: number }>('design/template/page', {
    current: query.current ?? 1,
    size: query.size ?? 20,
    scope: query.scope,
    status: query.status,
    keyword: query.keyword?.trim() || undefined,
    houseType: query.houseType?.trim() || undefined,
    areaMin: query.areaMin,
    areaMax: query.areaMax,
    tag: query.tag?.trim() || undefined
  })
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

export interface BatchSaveTemplateItemPayload {
  itemId?: string
  roomKey?: string
  catalogItemId: string
  quantityFormula?: string
  defaultQuantity?: number
  sortNo?: number
  remark?: string
}

/** 批量保存草稿版本的全部待写行与删除行：整批成功或整批回滚（对齐设计工作区）。 */
export async function batchSaveItems(payload: {
  versionId: string
  deletedItemIds?: string[]
  items: BatchSaveTemplateItemPayload[]
}): Promise<TemplateItem[]> {
  const raw = await post<unknown>('design/template/items/batchsave', {
    versionId: payload.versionId,
    deletedItemIds: payload.deletedItemIds ?? [],
    items: payload.items.map((item) => ({
      itemId: item.itemId,
      roomKey: item.roomKey,
      catalogItem: { itemId: item.catalogItemId },
      quantityFormula: item.quantityFormula,
      defaultQuantity: item.defaultQuantity,
      sortNo: item.sortNo,
      remark: item.remark
    }))
  })
  return normalizeTemplate(raw).items ?? []
}

/** 复制可见模版为当前员工的个人级草稿。 */
export async function copyTemplate(payload: { templateId: string; versionId?: string }): Promise<DesignTemplate> {
  return normalizeTemplate(await post<unknown>('design/template/copy', payload))
}

/** 停用模版；历史报价不受影响。 */
export async function disableTemplate(payload: { templateId: string }): Promise<DesignTemplate> {
  return normalizeTemplate(await post<unknown>('design/template/disable', payload))
}

/** 已发布模版新建草稿版本；已有草稿时幂等返回该草稿。 */
export async function buildTemplateVersion(payload: { templateId: string; versionId?: string }): Promise<DesignTemplate> {
  return normalizeTemplate(await post<unknown>('design/template/version/build', payload))
}

/** 删除草稿版本区域；被分项引用时服务端阻断。 */
export async function deleteRoom(payload: { roomId: string }): Promise<TemplateRoom> {
  return normalizeRoom(await post<unknown>('design/template/room/delete', payload)) as TemplateRoom
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
