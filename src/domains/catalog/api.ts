import { post } from '@/core/http'
import type { DesignItemType, PricingMode } from '@/domains/design/model'
import type { CatalogItem, CatalogTree } from './model'

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
    code: str(raw.code) || undefined,
    category: str(raw.category),
    name: str(raw.name),
    brand: str(raw.brand) || undefined,
    series: str(raw.series) || undefined,
    spec: str(raw.spec) || undefined,
    unit: UNIT_NAMES[enumValue(raw.unit)] ?? str(raw.unit),
    pricingMode: MODE[enumValue(raw.pricingMode)] ?? 'materialAndManual',
    materialPrice: num(raw.materialPrice),
    manualPrice: num(raw.manualPrice),
    fixedTotalPrice: raw.fixedTotalPrice === undefined || raw.fixedTotalPrice === null ? undefined : num(raw.fixedTotalPrice),
    formula: str(raw.formula) || undefined,
    craft: str(raw.craft) || undefined,
    criterion: str(raw.criterion) || undefined,
    description: str(raw.description) || undefined
  }
}

export interface CatalogQuery {
  type: DesignItemType
  category?: string
  brand?: string
  series?: string
  spec?: string
  keyword?: string
  current?: number
  size?: number
}

export async function pageCatalog(query: CatalogQuery): Promise<CatalogItem[]> {
  const raw = await post<unknown>('catalog/item/page', {
    type: TYPE_API[query.type],
    category: query.category,
    brand: query.brand,
    series: query.series,
    spec: query.spec,
    keyword: query.keyword?.trim() || undefined,
    current: query.current ?? 1,
    size: query.size ?? 50
  })
  return pageRows(raw).map(normalize)
}

export async function catalogTree(type: DesignItemType): Promise<CatalogTree> {
  const raw = recordOf(await post<unknown>('catalog/item/tree', { type: TYPE_API[type] }))
  const stringList = (value: unknown): string[] => Array.isArray(value) ? value.map(str).filter(Boolean) : []
  const recordList = (value: unknown): Record<string, string[]> => {
    const source = recordOf(value)
    const result: Record<string, string[]> = {}
    for (const [key, list] of Object.entries(source)) result[key] = stringList(list)
    return result
  }
  return {
    type: TYPE[enumValue(raw.type)] ?? type,
    categories: stringList(raw.categories),
    brands: recordList(raw.brands),
    specs: recordList(raw.specs),
    seriesByBrand: recordList(raw.seriesByBrand),
    specsBySeries: recordList(raw.specsBySeries),
    total: num(raw.total)
  }
}

export const catalogApi = { pageCatalog, catalogTree }
