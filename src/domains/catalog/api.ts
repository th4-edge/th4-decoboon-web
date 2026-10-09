import { post } from '@/core/http'
import type { DesignItemType, PricingMode } from '@/domains/design/model'
import type { CatalogItem, CatalogPageResult, CatalogTree } from './model'

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
    description: str(raw.description) || undefined,
    images: Array.isArray(raw.images) ? raw.images.map(str).filter(Boolean) : []
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

/** 把后端 Unit 枚举（可能是 {value/key/name} 对象）转成展示单位，如 Area → ㎡。 */
export function unitLabel(value: unknown): string {
  return UNIT_NAMES[enumValue(value)] ?? str(value)
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(str).filter(Boolean) : []
}

/** category -> values */
function stringListMap(value: unknown): Record<string, string[]> {
  const source = recordOf(value)
  const result: Record<string, string[]> = {}
  for (const [key, list] of Object.entries(source)) result[key] = stringList(list)
  return result
}

/** category -> brand -> values */
function nestedStringListMap(value: unknown): Record<string, Record<string, string[]>> {
  const source = recordOf(value)
  const result: Record<string, Record<string, string[]>> = {}
  for (const [key, nested] of Object.entries(source)) result[key] = stringListMap(nested)
  return result
}

/** category -> brand -> series -> values */
function deepStringListMap(value: unknown): Record<string, Record<string, Record<string, string[]>>> {
  const source = recordOf(value)
  const result: Record<string, Record<string, Record<string, string[]>>> = {}
  for (const [key, nested] of Object.entries(source)) result[key] = nestedStringListMap(nested)
  return result
}

function pageMeta(raw: unknown, query: CatalogQuery, count: number): Omit<CatalogPageResult, 'items'> {
  const record = recordOf(raw)
  const springNumber = record.number === undefined ? undefined : num(record.number)
  return {
    total: num(record.totalElements ?? record.total ?? count),
    current: Math.max(1, springNumber === undefined ? (query.current ?? 1) : springNumber + 1),
    size: Math.max(1, num(record.size ?? query.size ?? (count || 1))),
    pages: Math.max(1, num(record.totalPages ?? 1))
  }
}

export async function pageCatalogResult(query: CatalogQuery): Promise<CatalogPageResult> {
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
  const items = pageRows(raw).map(normalize)
  return { items, ...pageMeta(raw, query, items.length) }
}

export async function pageCatalog(query: CatalogQuery): Promise<CatalogItem[]> {
  return (await pageCatalogResult(query)).items
}

export async function catalogTree(type: DesignItemType): Promise<CatalogTree> {
  const raw = recordOf(await post<unknown>('catalog/item/tree', { type: TYPE_API[type] }))
  return {
    type: TYPE[enumValue(raw.type)] ?? type,
    categories: stringList(raw.categories),
    brands: stringListMap(raw.brands),
    specs: stringListMap(raw.specs),
    seriesByBrand: nestedStringListMap(raw.seriesByBrand),
    specsBySeries: deepStringListMap(raw.specsBySeries),
    total: num(raw.total)
  }
}

export const catalogApi = { pageCatalog, pageCatalogResult, catalogTree }
