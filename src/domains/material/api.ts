import { post } from '@/core/http'
import type { MaterialSelectionItem, SelectionSaveStatus } from './model'

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
    customerName: str(raw.customerName) || undefined,
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
    confirmerName: str(raw.confirmerName) || undefined,
    confirmedByName: str(raw.confirmedByName) || undefined,
    confirmedAt: str(raw.confirmedAt) || undefined,
    orderStatus: enumValue(raw.orderStatus) || undefined,
    orderStatusName: str(raw.orderStatusName) || undefined,
    nextAction: str(raw.nextAction) || undefined
  }
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
  status?: SelectionSaveStatus
}

export async function saveSelection(input: SaveSelectionInput): Promise<MaterialSelectionItem> {
  const raw = await post<unknown>('material/selection/save', {
    ...input,
    status: input.status === 'pendingConfirm' ? 'PendingConfirm' : 'Draft'
  })
  return normalizeItem(recordOf(raw))
}

export async function confirmSelection(selectionId: string, confirmerName: string, confirmedAt?: string): Promise<MaterialSelectionItem> {
  const raw = await post<unknown>('material/selection/confirm', {
    selectionId,
    confirmerName: confirmerName.trim(),
    confirmedAt: confirmedAt || undefined
  })
  return normalizeItem(recordOf(raw))
}

export const materialApi = { listSelectionItems, saveSelection, confirmSelection }
