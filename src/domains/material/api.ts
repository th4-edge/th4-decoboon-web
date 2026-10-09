import { post } from '@/core/http'
import type { MaterialSelectionItem, SelectionBoardItem } from './model'

type RawRecord = Record<string, unknown>

const UNIT_NAMES: Record<string, string> = {
  Area: '㎡',
  Count: '个',
  Item: '项',
  Place: '处',
  Set: '套',
  House: '户',
  Metre: 'm',
  Centimeter: 'cm',
  Step: '步',
  Plate: '樘',
  Block: '块',
  Root: '根',
  Hole: '扇',
  Pcs: '台',
  Stick: '支',
  Grid: '格',
  Sheet: '片'
}

function str(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isNaN(parsed) ? 0 : parsed
}

function enumValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const record = raw as RawRecord
    return str(record.value ?? record.key ?? record.name)
  }
  return ''
}

function recordOf(raw: unknown): RawRecord {
  return raw && typeof raw === 'object' ? raw as RawRecord : {}
}

function pageRows(raw: unknown): RawRecord[] {
  if (Array.isArray(raw)) return raw as RawRecord[]
  const record = recordOf(raw)
  for (const key of ['content', 'list', 'records']) {
    if (Array.isArray(record[key])) return record[key] as RawRecord[]
  }
  return []
}

function normalizeItem(raw: RawRecord): MaterialSelectionItem {
  return {
    itemId: str(raw.itemId ?? raw.id),
    projectId: str(raw.projectId),
    projectNo: str(raw.projectNo) || undefined,
    projectName: str(raw.projectName) || undefined,
    propertyId: str(raw.propertyId),
    propertyAddress: str(raw.propertyAddress) || undefined,
    designerName: str(raw.designerName) || undefined,
    contractId: str(raw.contractId) || undefined,
    contractNo: str(raw.contractNo) || undefined,
    spaceName: str(raw.spaceName) || undefined,
    category: str(raw.category) || undefined,
    materialName: str(raw.materialName),
    brand: str(raw.brand) || undefined,
    spec: str(raw.spec) || undefined,
    unit: (UNIT_NAMES[enumValue(raw.unit)] ?? str(raw.unit)) || undefined,
    quantity: num(raw.quantity),
    required: raw.required !== false,
    selectionId: str(raw.selectionId) || undefined,
    version: raw.version === undefined ? undefined : num(raw.version),
    status: enumValue(raw.status) || undefined,
    statusName: str(raw.statusName) || undefined,
    selectionText: str(raw.selectionText) || undefined,
    selectionJson: str(raw.selectionJson) || undefined,
    attachments: Array.isArray(raw.attachments) ? raw.attachments.map((v) => str(v)).filter(Boolean) : [],
    orderStatus: enumValue(raw.orderStatus) || undefined,
    orderStatusName: str(raw.orderStatusName) || undefined,
    nextAction: str(raw.nextAction) || undefined
  }
}

function normalizeBoardItem(raw: RawRecord): SelectionBoardItem {
  return {
    projectId: str(raw.projectId),
    projectNo: str(raw.projectNo) || undefined,
    projectName: str(raw.projectName) || '项目待命名',
    projectStatus: enumValue(raw.projectStatus) || undefined,
    projectStatusName: str(raw.projectStatusName) || undefined,
    propertyId: str(raw.propertyId),
    propertyAddress: str(raw.propertyAddress) || undefined,
    community: str(raw.community) || undefined,
    area: raw.area === undefined || raw.area === null ? undefined : num(raw.area),
    designerName: str(raw.designerName) || undefined,
    selectionId: str(raw.selectionId) || undefined,
    selectionStatus: enumValue(raw.selectionStatus) || undefined,
    selectionStatusName: str(raw.selectionStatusName) || '未发起',
    totalItems: num(raw.totalItems),
    selectedItems: num(raw.selectedItems),
    deliveredItems: num(raw.deliveredItems),
    notSelectedItems: num(raw.notSelectedItems),
    orderedItems: num(raw.orderedItems),
    progress: num(raw.progress),
    version: raw.version === undefined || raw.version === null ? undefined : num(raw.version),
    updatedAt: raw.updatedAt === undefined || raw.updatedAt === null ? undefined : num(raw.updatedAt),
    nextAction: str(raw.nextAction) || undefined
  }
}

/**
 * 项目交付·主材选材队列。
 *
 * <p>只消费既有 Provider，不在前端逐项目拼装或绕过数据权限。</p>
 */
export async function listSelectionBoard(): Promise<SelectionBoardItem[]> {
  const raw = await post<unknown>('material/selection/board', {})
  return pageRows(raw).map(normalizeBoardItem)
}

export async function listSelectionItems(projectId: string): Promise<MaterialSelectionItem[]> {
  const raw = await post<unknown>('material/selection/item/page', { projectId })
  return pageRows(raw).map(normalizeItem)
}

export interface SaveSelectionInput {
  propertyId: string
  projectId: string
  contractId?: string
  contractLineId: string
  title?: string
  content: string
  selectionJson?: string
  /** 是否同时交付财务下单。 */
  deliver?: boolean
}

export async function saveSelection(input: SaveSelectionInput): Promise<MaterialSelectionItem> {
  const raw = await post<unknown>('material/selection/save', {
    ...input,
    deliver: input.deliver === true
  })
  return normalizeItem(recordOf(raw))
}

export const materialApi = { listSelectionBoard, listSelectionItems, saveSelection }
