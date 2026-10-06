import { post } from '@/core/http'
import type { DesignItemType, PricingMode } from '@/domains/design/model'
import type { CatalogItem } from './model'

type RawRecord = Record<string, unknown>

const TYPE: Record<string, DesignItemType> = {
  General: 'general',
  Construction: 'construction',
  Material: 'material',
  Custom: 'custom',
  Appliance: 'appliance',
  Soft: 'soft'
}

const TYPE_API: Record<DesignItemType, string> = {
  general: 'General',
  construction: 'Construction',
  material: 'Material',
  custom: 'Custom',
  appliance: 'Appliance',
  soft: 'Soft'
}

const MODE: Record<string, PricingMode> = {
  MaterialAndManual: 'materialAndManual',
  MaterialOnly: 'materialOnly',
  ManualOnly: 'manualOnly',
  FixedTotal: 'fixedTotal'
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

function normalize(raw: RawRecord): CatalogItem {
  return {
    id: str(raw.itemId ?? raw.id),
    type: TYPE[enumValue(raw.type)] ?? 'construction',
    category: str(raw.category),
    name: str(raw.name),
    brand: str(raw.brand) || undefined,
    spec: str(raw.spec) || undefined,
    unit: str(raw.unit),
    pricingMode: MODE[enumValue(raw.pricingMode)] ?? 'materialAndManual',
    materialPrice: num(raw.materialPrice),
    manualPrice: num(raw.manualPrice),
    costPrice: num(raw.costPrice),
    formula: str(raw.formula) || undefined,
    craft: str(raw.craft) || undefined,
    criterion: str(raw.criterion) || undefined
  }
}

export interface CatalogQuery {
  type: DesignItemType
  keyword?: string
  current?: number
  size?: number
}

export async function pageCatalog(query: CatalogQuery): Promise<CatalogItem[]> {
  const raw = await post<unknown>('catalog/item/page', {
    type: TYPE_API[query.type],
    keyword: query.keyword?.trim() || undefined,
    current: query.current ?? 1,
    size: query.size ?? 50
  })
  return pageRows(raw).map(normalize)
}

export const catalogApi = { pageCatalog }
