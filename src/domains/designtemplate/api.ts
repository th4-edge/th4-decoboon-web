import { post } from '@/core/http'
import type { DesignTemplate, TemplateItem, TemplatePage, TemplateRoom, TemplateScope } from './model'

/** 设计模版（方案库）Provider 封装。 */

export interface TemplateQuery {
  current?: number
  size?: number
  scope?: TemplateScope
  status?: string
}

export function pageTemplates(query: TemplateQuery = {}): Promise<TemplatePage> {
  return post<TemplatePage>('design/template/page', query)
}

export function templateInfo(templateId: string, versionId?: string): Promise<DesignTemplate> {
  return post<DesignTemplate>('design/template/info', { templateId, versionId })
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

export function saveTemplate(payload: SaveTemplatePayload): Promise<DesignTemplate> {
  return post<DesignTemplate>('design/template/save', payload)
}

export function publishTemplate(templateId: string): Promise<DesignTemplate> {
  return post<DesignTemplate>('design/template/publish', { templateId })
}

/** 保存区域：只写草稿版本；尺寸可留空表示待量房。 */
export function saveRoom(payload: TemplateRoom & { versionId: string }): Promise<TemplateRoom> {
  return post<TemplateRoom>('design/template/room/save', payload)
}

/** 保存分项：只接收引用 + 公式 + 固定数量，不接收名称/单位/价格。 */
export function saveItem(payload: {
  versionId: string
  itemId?: string
  roomKey?: string
  catalogItemId: string
  quantityFormula?: string
  defaultQuantity?: number
  sortNo?: number
  remark?: string
}): Promise<TemplateItem> {
  return post<TemplateItem>('design/template/item/save', payload)
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
