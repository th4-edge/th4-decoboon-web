<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import MoneyText from '@/components/MoneyText.vue'
import NavIcon from '@/components/shell/NavIcon.vue'
import QuantityFormulaInput from '@/components/QuantityFormulaInput.vue'
import DesignCatalogPicker from './DesignCatalogPicker.vue'
import { designItemDraftCache, type DesignItemDraftRow } from './designItemDraftCache'
import { designApi } from '@/domains/design/api'
import type { DesignItem, DesignItemType, DesignScheme, PricingMode } from '@/domains/design/model'
import { DESIGN_ITEM_TYPE_LABELS, DESIGN_ITEM_TYPE_ORDER } from '@/domains/design/meta'
import { catalogApi } from '@/domains/catalog/api'
import type { CatalogItem } from '@/domains/catalog/model'
import { formatMoney } from '@/core/format'
import { parseSpreadsheetText } from '@/core/spreadsheet'

type RowStatus = 'saved' | 'new' | 'dirty' | 'saving' | 'error'
type ExcelRowStatus = 'matched' | 'unmatched' | 'invalid'

interface ExcelPreviewRow {
  line: number
  areaName: string
  spaceId: string
  catalogValue: string
  catalog?: CatalogItem
  quantity: number
  remark?: string
  status: ExcelRowStatus
  message?: string
}

interface Row {
  key: string
  status: RowStatus
  error?: string
  itemId?: string
  catalogItemId: string
  /** 空串=综合项目。 */
  spaceId: string
  type: DesignItemType
  category: string
  name: string
  brand?: string
  spec?: string
  unit: string
  quantity: number
  quantitySource: 'formula' | 'manual'
  materialPrice: number
  manualPrice: number
  fixedTotalPrice?: number
  pricingMode: PricingMode
  amount: number
  /** 全局顺序；按「区域 → 类型 → 组内自定义」重排后写回服务端。 */
  sort: number
  pendingMeasure?: boolean
  /** 历史中文公式等非专业变量公式：不参与重算、保留既有工程量，待修订（GAP-042）。 */
  formulaRevisionNeeded?: boolean
  remark?: string
}

const props = defineProps<{
  designId: string
  canWrite: boolean
  spaces?: Array<{ id: string; name: string }>
}>()

const emit = defineEmits<{ saved: [scheme: DesignScheme]; createSpace: []; editSpace: [spaceId: string] }>()

const loading = ref(false)
const saving = ref(false)
const scheme = ref<DesignScheme | null>(null)
const rows = ref<Row[]>([])
const deletedItemIds = ref<string[]>([])
const catalogItems = ref<CatalogItem[]>([])
const catalogLoading = ref(false)
const pickerVisible = ref(false)
const excelVisible = ref(false)
const excelText = ref('')
const spaceFilter = ref<'all' | string>('all')
const categoryFilter = ref<'all' | DesignItemType>('all')
const areaOpen = ref(true)
const fullscreen = ref(false)
const sheetRoot = ref<HTMLElement | null>(null)
const editingRowKey = ref('')
const selectedRowKey = ref('')
const sortMode = ref(false)
const draggingRowKey = ref('')
const dragOverRowKey = ref('')
const orderDirty = ref(false)
const actionError = ref('')
const draftStatus = ref<'synced' | 'dirty' | 'saving' | 'error'>('synced')
const lastSavedAt = ref('')
const AUTOSAVE_DELAY = 1200
let autosaveTimer: ReturnType<typeof setTimeout> | undefined
let autosaveBlocked = false
let autosaveErrorNotified = false

const spaces = computed(() => props.spaces ?? scheme.value?.spaces ?? [])
const catalogById = computed(() => new Map(catalogItems.value.map((item) => [item.id, item])))
const dirtyCount = computed(() => rows.value.filter((row) => row.status !== 'saved').length)
const totalAmount = computed(() => rows.value.reduce((sum, row) => sum + rowAmount(row), 0))
const pendingMeasureCount = computed(() => rows.value.filter((row) => row.pendingMeasure).length)
const revisionNeededCount = computed(() => rows.value.filter((row) => row.formulaRevisionNeeded).length)
const pendingCount = computed(() => dirtyCount.value + deletedItemIds.value.length + (orderDirty.value ? 1 : 0))
const draftLabel = computed(() => {
  if (saving.value) return '自动保存中…'
  if (orderDirty.value && !dirtyCount.value && !deletedItemIds.value.length) {
    return draftStatus.value === 'error' ? '顺序待重试' : '顺序待保存'
  }
  if (pendingCount.value) return draftStatus.value === 'error' ? `待重试 ${pendingCount.value} 项` : `待自动保存 ${pendingCount.value} 项`
  if (lastSavedAt.value) return `已自动保存 ${lastSavedAt.value}`
  return '已同步'
})

const definitions = computed(() => [
  { id: '', name: '综合项目' },
  ...spaces.value.map((space) => ({ id: space.id, name: space.name }))
])

const visibleBySpace = computed(() => {
  if (spaceFilter.value === 'all') return rows.value
  return rows.value.filter((row) => row.spaceId === spaceFilter.value)
})

/** 左侧区域/分类汇总：区域 → 类型，带数量与金额。 */
const areaTree = computed(() => definitions.value
  .map((area) => {
    const areaRows = rows.value.filter((row) => row.spaceId === area.id)
    return {
      ...area,
      count: areaRows.length,
      amount: areaRows.reduce((sum, row) => sum + rowAmount(row), 0),
      categories: DESIGN_ITEM_TYPE_ORDER
        .map((type) => {
          const typeRows = areaRows.filter((row) => row.type === type)
          return { type, label: DESIGN_ITEM_TYPE_LABELS[type], count: typeRows.length, amount: typeRows.reduce((sum, row) => sum + rowAmount(row), 0) }
        })
    }
  }))

const categoryTabs = computed(() => [
  { value: 'all' as const, label: '全部', count: visibleBySpace.value.length },
  ...DESIGN_ITEM_TYPE_ORDER
    .filter((type) => visibleBySpace.value.some((row) => row.type === type))
    .map((type) => ({ value: type, label: DESIGN_ITEM_TYPE_LABELS[type], count: visibleBySpace.value.filter((row) => row.type === type).length }))
])

const selectedArea = computed(() => (spaceFilter.value === 'all' ? undefined : definitions.value.find((area) => area.id === spaceFilter.value)))
const selectedAreaCategoryOptions = computed(() => DESIGN_ITEM_TYPE_ORDER.map((type) => {
  const typeRows = rows.value.filter((row) => row.spaceId === spaceFilter.value && row.type === type)
  return { type, label: DESIGN_ITEM_TYPE_LABELS[type], count: typeRows.length, amount: typeRows.reduce((sum, row) => sum + rowAmount(row), 0) }
}))

const excelPreview = computed<ExcelPreviewRow[]>(() => parseExcelRows(excelText.value))
const excelMatchedRows = computed(() => excelPreview.value.filter((row) => row.status === 'matched'))
const excelMatchedCount = computed(() => excelMatchedRows.value.length)

const groups = computed(() => {
  const result: Array<{ key: string; areaId: string; areaName: string; type: DesignItemType; label: string; rows: Row[]; count: number; amount: number }> = []
  for (const area of definitions.value) {
    if (spaceFilter.value !== 'all' && area.id !== spaceFilter.value) continue
    for (const type of DESIGN_ITEM_TYPE_ORDER) {
      if (categoryFilter.value !== 'all' && type !== categoryFilter.value) continue
      const groupRows = rows.value.filter((row) => row.spaceId === area.id && row.type === type)
      if (!groupRows.length) continue
      result.push({
        key: `${area.id || 'unassigned'}:${type}`,
        areaId: area.id,
        areaName: area.name,
        type,
        label: DESIGN_ITEM_TYPE_LABELS[type],
        rows: groupRows,
        count: groupRows.length,
        amount: groupRows.reduce((sum, row) => sum + rowAmount(row), 0)
      })
    }
  }
  return result
})

function key(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function round(value: number): number {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

/** 展示口径的本地估算；已落库行直接用服务端金额，正式金额以服务端汇算为准。 */
function rowMeta(row: Row): string {
  return [row.brand, row.spec, row.category].filter(Boolean).join(' · ') || '—'
}

function rowAmount(row: Row): number {
  if (row.status === 'saved') return round(row.amount)
  const material = Number(row.materialPrice || 0)
  const manual = Number(row.manualPrice || 0)
  if (row.pricingMode === 'fixedTotal') return round(Number(row.fixedTotalPrice ?? material + manual))
  const unit = row.pricingMode === 'materialOnly' ? material : row.pricingMode === 'manualOnly' ? manual : material + manual
  return round(Number(row.quantity || 0) * unit)
}

function toRow(item: DesignItem, fallbackSort = 0): Row {
  return {
    key: key(),
    status: 'saved',
    itemId: item.id,
    catalogItemId: item.catalogItemId ?? '',
    spaceId: item.spaceId ?? '',
    type: item.type,
    category: item.category,
    name: item.name,
    brand: item.brand,
    spec: item.spec,
    unit: item.unit,
    quantity: item.quantity,
    quantitySource: item.quantitySource,
    materialPrice: item.materialPrice,
    manualPrice: item.manualPrice,
    fixedTotalPrice: catalogById.value.get(item.catalogItemId ?? '')?.fixedTotalPrice,
    pricingMode: item.pricingMode,
    amount: item.amount,
    sort: Number.isFinite(item.sort) ? item.sort : fallbackSort,
    pendingMeasure: item.pendingMeasure,
    formulaRevisionNeeded: item.formulaRevisionNeeded,
    remark: item.remark
  }
}

function toDraftRow(row: Row): DesignItemDraftRow {
  return {
    key: row.key,
    itemId: row.itemId,
    catalogItemId: row.catalogItemId,
    spaceId: row.spaceId,
    type: row.type,
    category: row.category,
    name: row.name,
    brand: row.brand,
    spec: row.spec,
    unit: row.unit,
    quantity: row.quantity,
    quantitySource: row.quantitySource,
    materialPrice: row.materialPrice,
    manualPrice: row.manualPrice,
    fixedTotalPrice: row.fixedTotalPrice,
    pricingMode: row.pricingMode,
    amount: row.amount,
    pendingMeasure: row.pendingMeasure,
    remark: row.remark,
    sort: row.sort,
    dirty: row.status !== 'saved'
  }
}

function applyDetail(detail: DesignScheme): void {
  scheme.value = detail
  rows.value = (detail.items ?? []).map((item, index) => toRow(item, index))
  deletedItemIds.value = []
  editingRowKey.value = ''
  selectedRowKey.value = ''
  draggingRowKey.value = ''
  dragOverRowKey.value = ''
  orderDirty.value = false
}

/**
 * 保存成功后按 itemId 就地核对，保留已有行的 key 与编辑态，只更新服务端算出的字段；
 * 新增行按返回顺序补上 itemId。避免每次自动保存都重建整个表格导致的跳动/失焦。
 */
function reconcileItems(detail: DesignScheme): void {
  const serverItems = detail.items ?? []
  const byId = new Map(serverItems.map((item) => [item.id, item]))
  const consumed = new Set<string>()
  for (const row of rows.value) {
    if (!row.itemId) continue
    const item = byId.get(row.itemId)
    if (!item) continue
    consumed.add(item.id)
    row.status = 'saved'
    row.error = undefined
    row.quantity = item.quantity
    row.quantitySource = item.quantitySource
    row.amount = item.amount
    row.sort = item.sort
    row.pendingMeasure = item.pendingMeasure
    row.formulaRevisionNeeded = item.formulaRevisionNeeded
  }
  const unmatched = serverItems.filter((item) => !consumed.has(item.id))
  let cursor = 0
  for (const row of rows.value) {
    if (row.itemId) continue
    const item = unmatched[cursor]
    cursor += 1
    if (!item) continue
    row.itemId = item.id
    row.status = 'saved'
    row.error = undefined
    row.quantity = item.quantity
    row.quantitySource = item.quantitySource
    row.amount = item.amount
    row.sort = item.sort
  }
  scheme.value = detail
  deletedItemIds.value = []
}

async function loadCatalog(): Promise<void> {
  catalogLoading.value = true
  try {
    const result: CatalogItem[] = []
    for (const type of DESIGN_ITEM_TYPE_ORDER) {
      let current = 1
      // 后端把 size 上限压到 100：必须按 100 判断是否还有下一页，否则会把目录截断在 100 条。
      while (current <= 30) {
        const page = await catalogApi.pageCatalog({ type, current, size: 100 })
        result.push(...page)
        if (page.length < 100) break
        current += 1
      }
    }
    catalogItems.value = result
  } catch {
    catalogItems.value = []
  } finally {
    catalogLoading.value = false
  }
}

async function load(): Promise<void> {
  if (!props.designId) return
  loading.value = true
  actionError.value = ''
  try {
    const [detail] = await Promise.all([designApi.schemeInfo(props.designId), loadCatalog()])
    const cached = designItemDraftCache.read(props.designId)
    if (cached && (cached.orderDirty || cached.rows.some((row) => !row.itemId) || cached.deletedItemIds.length || cached.rows.some((row) => row.itemId))) {
      scheme.value = detail
      rows.value = cached.rows.map((row) => {
        const dirty = typeof row.dirty === 'boolean' ? row.dirty : !cached.orderDirty
        return {
          ...row,
          quantitySource: row.quantitySource ?? 'manual',
          key: row.key || key(),
          status: (dirty ? (row.itemId ? 'dirty' : 'new') : 'saved') as RowStatus,
          error: undefined
        }
      })
      deletedItemIds.value = [...cached.deletedItemIds]
      orderDirty.value = Boolean(cached.orderDirty)
      selectedRowKey.value = ''
      draftStatus.value = 'dirty'
    } else {
      applyDetail(detail)
    }
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '设计方案分项暂不可确认'
  } finally {
    loading.value = false
  }
  if (pendingCount.value) scheduleAutosave()
}

function cacheDraft(): void {
  if (!props.canWrite) return
  if (!pendingCount.value) {
    designItemDraftCache.clear(props.designId)
    return
  }
  designItemDraftCache.write(props.designId, {
    rows: rows.value.map(toDraftRow),
    deletedItemIds: [...deletedItemIds.value],
    orderDirty: orderDirty.value
  })
}

function markQuantityDirty(row: Row): void {
  row.quantitySource = 'manual'
  markDirty(row)
}

function markDirty(row: Row): void {
  autosaveBlocked = false
  row.status = row.itemId ? 'dirty' : 'new'
  row.error = undefined
  row.amount = rowAmount(row)
  draftStatus.value = 'dirty'
  actionError.value = ''
  cacheDraft()
}

function selectRow(row: Row): void {
  selectedRowKey.value = row.key
}

/** 从当前行直接打开报价项目选择器；新增项会插到该行之后（同区域同类型）。 */
function addAfter(row: Row): void {
  if (!props.canWrite) return
  selectedRowKey.value = row.key
  openPicker()
}

function startEdit(row: Row): void {
  if (!props.canWrite || sortMode.value || !row.catalogItemId) return
  selectedRowKey.value = row.key
  editingRowKey.value = row.key
}

function stopEdit(): void {
  editingRowKey.value = ''
}

function toggleSortMode(): void {
  sortMode.value = !sortMode.value
  editingRowKey.value = ''
  draggingRowKey.value = ''
  dragOverRowKey.value = ''
}

function openPicker(): void {
  if (!props.canWrite) return
  pickerVisible.value = true
}

/** 把 rows 重排为「区域 → 类型 → 组内当前顺序」，并写入连续 sort。 */
function canonicalizeRows(): void {
  const ordered: Row[] = []
  const seen = new Set<string>()
  for (const area of definitions.value) {
    for (const type of DESIGN_ITEM_TYPE_ORDER) {
      for (const row of rows.value) {
        if (row.spaceId !== area.id || row.type !== type || seen.has(row.key)) continue
        ordered.push(row)
        seen.add(row.key)
      }
    }
  }
  for (const row of rows.value) {
    if (!seen.has(row.key)) ordered.push(row)
  }
  rows.value = ordered
  rows.value.forEach((row, index) => { row.sort = index })
}

function markOrderDirty(): void {
  autosaveBlocked = false
  orderDirty.value = true
  draftStatus.value = 'dirty'
  actionError.value = ''
  cacheDraft()
}

function sameGroup(left: Row, right: Row): boolean {
  return left.spaceId === right.spaceId && left.type === right.type
}

function moveRowWithinGroup(source: Row, target: Row, position: 'before' | 'after'): void {
  if (!sameGroup(source, target) || source.key === target.key) return
  const sourceIndex = rows.value.indexOf(source)
  const targetIndex = rows.value.indexOf(target)
  if (sourceIndex < 0 || targetIndex < 0) return
  const next = [...rows.value]
  next.splice(sourceIndex, 1)
  const nextTargetIndex = next.indexOf(target)
  next.splice(position === 'before' ? nextTargetIndex : nextTargetIndex + 1, 0, source)
  rows.value = next
  canonicalizeRows()
  selectedRowKey.value = source.key
  markOrderDirty()
}

function moveRow(row: Row, direction: -1 | 1): void {
  if (!props.canWrite || !sortMode.value) return
  const group = groups.value.find((item) => item.areaId === row.spaceId && item.type === row.type)
  if (!group) return
  const index = group.rows.findIndex((item) => item.key === row.key)
  const neighbor = group.rows[index + direction]
  if (!neighbor) return
  moveRowWithinGroup(row, neighbor, direction < 0 ? 'before' : 'after')
}

function onDragStart(row: Row, event: DragEvent): void {
  if (!sortMode.value) return
  draggingRowKey.value = row.key
  selectedRowKey.value = row.key
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', row.key)
  }
}

function onDragOver(row: Row, event: DragEvent): void {
  if (!sortMode.value || !draggingRowKey.value) return
  const source = rows.value.find((item) => item.key === draggingRowKey.value)
  if (!source || !sameGroup(source, row)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragOverRowKey.value = row.key
}

function onDragLeave(row: Row): void {
  if (dragOverRowKey.value === row.key) dragOverRowKey.value = ''
}

function onDrop(row: Row): void {
  const source = rows.value.find((item) => item.key === draggingRowKey.value)
  if (source && source.key !== row.key && sameGroup(source, row)) {
    const sourceIndex = rows.value.indexOf(source)
    const targetIndex = rows.value.indexOf(row)
    moveRowWithinGroup(source, row, sourceIndex < targetIndex ? 'after' : 'before')
  }
  draggingRowKey.value = ''
  dragOverRowKey.value = ''
}

function onDragEnd(): void {
  draggingRowKey.value = ''
  dragOverRowKey.value = ''
}

function createCatalogRow(catalog: CatalogItem, spaceId: string, quantity: number, remark?: string): Row {
  return {
    key: key(),
    status: 'new',
    catalogItemId: catalog.id,
    spaceId,
    type: catalog.type,
    category: catalog.category,
    name: catalog.name,
    brand: catalog.brand,
    spec: catalog.spec,
    unit: catalog.unit,
    quantity,
    quantitySource: 'manual',
    materialPrice: catalog.materialPrice,
    manualPrice: catalog.manualPrice,
    fixedTotalPrice: catalog.fixedTotalPrice,
    pricingMode: catalog.pricingMode,
    amount: 0,
    sort: 0,
    remark
  }
}

/**
 * 新分项插到当前选中行之后；选中行不属于同一区域/类型时，退化为插到该组末尾。
 * 批量添加时把上一条新增行继续作为锚点，保持设计师的选择顺序。
 */
function insertRowAfterAnchor(row: Row, anchorKey: string): string {
  const anchor = rows.value.find((item) => item.key === anchorKey)
  if (anchor && sameGroup(anchor, row)) {
    rows.value.splice(rows.value.indexOf(anchor) + 1, 0, row)
    return row.key
  }
  const groupRows = rows.value.filter((item) => sameGroup(item, row))
  const last = groupRows[groupRows.length - 1]
  if (last) {
    rows.value.splice(rows.value.indexOf(last) + 1, 0, row)
  } else {
    rows.value.push(row)
  }
  return row.key
}

function addCatalogRows(payload: { spaceId: string; items: Array<{ catalogItemId: string; quantity: number; remark?: string }> }): number {
  let anchorKey = selectedRowKey.value
  let added = 0
  let lastRow: Row | null = null
  for (const entry of payload.items) {
    const catalog = catalogById.value.get(entry.catalogItemId)
    if (!catalog) continue
    const row = createCatalogRow(catalog, payload.spaceId, Number(entry.quantity ?? 1), entry.remark)
    anchorKey = insertRowAfterAnchor(row, anchorKey)
    lastRow = row
    added += 1
  }
  if (!added) return 0
  canonicalizeRows()
  if (lastRow) selectedRowKey.value = lastRow.key
  for (const row of rows.value) row.amount = rowAmount(row)
  autosaveBlocked = false
  markOrderDirty()
  return added
}

function onPickerAdd(payload: { spaceId: string; items: Array<{ catalogItemId: string; quantity: number }> }): void {
  addCatalogRows(payload)
}

function parseExcelRows(text: string): ExcelPreviewRow[] {
  const result: ExcelPreviewRow[] = []
  const rows = parseSpreadsheetText(text)
  rows.forEach((cells, index) => {
    const hasQuantityHeader = cells.some((cell) => /工程量|数量/.test(cell))
    const hasAreaOrProjectHeader = cells.some((cell) => /区域|项目/.test(cell))
    if (index === 0 && hasQuantityHeader && hasAreaOrProjectHeader) {
      return
    }
    const values = cells.map((cell) => cell.trim())
    if (!values.some(Boolean)) return

    let areaName = ''
    let catalogValue = ''
    let quantityText = ''
    let remark = ''
    if (values.length >= 3) {
      areaName = values[0] || ''
      catalogValue = values[1] || ''
      quantityText = values[2] || ''
      remark = values[3] || ''
    } else if (values.length === 2) {
      const first = values[0] || ''
      const second = values[1] || ''
      const firstIsArea = first === '综合项目' || spaces.value.some((space) => space.name === first)
      if (firstIsArea) {
        areaName = first
        catalogValue = second
      } else {
        catalogValue = first
        quantityText = second
      }
    } else {
      catalogValue = values[0] || ''
    }

    const normalizedArea = areaName.trim()
    const spaceId = !normalizedArea || normalizedArea === '综合项目'
      ? ''
      : (spaces.value.find((space) => space.name === normalizedArea)?.id ?? '')
    const catalog = catalogValue ? findCatalog(catalogValue) : undefined
    const numericText = quantityText.replace(/[¥￥,\s]/g, '')
    const quantity = numericText === '' ? 1 : Number(numericText)

    let status: ExcelRowStatus = 'matched'
    let message = ''
    if (!catalogValue) {
      status = 'invalid'
      message = '缺少项目名称/编码'
    } else if (!catalog) {
      status = 'unmatched'
      message = '未匹配报价项目库'
    } else if (normalizedArea && normalizedArea !== '综合项目' && !spaceId) {
      status = 'invalid'
      message = `区域「${normalizedArea}」不存在`
    } else if (!Number.isFinite(quantity) || quantity < 0) {
      status = 'invalid'
      message = '工程量需为数字且不能为负'
    }

    result.push({
      line: index + 1,
      areaName: normalizedArea || '综合项目',
      spaceId,
      catalogValue,
      catalog,
      quantity,
      remark: remark || undefined,
      status,
      message
    })
  })
  return result
}

function openExcelDialog(): void {
  if (!props.canWrite) return
  excelText.value = ''
  excelVisible.value = true
}

function downloadExcelTemplate(): void {
  const content = '\uFEFF区域,项目名称/编码,工程量,备注\n综合项目,拆除--开孔（燃气孔，空调孔）,2,示例备注\n'
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = '设计分项导入模板.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function excelQuantityText(row: ExcelPreviewRow): string {
  return Number.isFinite(row.quantity) ? String(row.quantity) : '—'
}

function applyExcelRows(): void {
  const entries = excelMatchedRows.value
  if (!entries.length) return
  let anchorKey = selectedRowKey.value
  let lastRow: Row | null = null
  let added = 0
  for (const entry of entries) {
    if (!entry.catalog) continue
    const row = createCatalogRow(entry.catalog, entry.spaceId, entry.quantity, entry.remark)
    anchorKey = insertRowAfterAnchor(row, anchorKey)
    lastRow = row
    added += 1
  }
  if (!added) return
  canonicalizeRows()
  if (lastRow) selectedRowKey.value = lastRow.key
  for (const row of rows.value) row.amount = rowAmount(row)
  autosaveBlocked = false
  markOrderDirty()
  excelVisible.value = false
  const skipped = excelPreview.value.length - added
  if (skipped) {
    ElMessage.warning(`已添加 ${added} 项，${skipped} 行未添加，请重新检查预览`)
  } else {
    ElMessage.success(`已添加 ${added} 项`)
  }
}

function deleteRow(row: Row): void {
  if (!props.canWrite) return
  autosaveBlocked = false
  if (row.itemId) deletedItemIds.value = [...deletedItemIds.value, row.itemId]
  rows.value = rows.value.filter((item) => item !== row)
  if (selectedRowKey.value === row.key) selectedRowKey.value = ''
  canonicalizeRows()
  markOrderDirty()
}

function selectArea(id: string): void {
  spaceFilter.value = id
  categoryFilter.value = 'all'
}

function selectCategory(category: 'all' | DesignItemType): void {
  categoryFilter.value = category
}

function selectAreaCategory(areaId: string, category: DesignItemType): void {
  spaceFilter.value = areaId
  categoryFilter.value = category
}

function currentSpaceId(): string {
  return spaceFilter.value === 'all' ? '' : spaceFilter.value
}

/** 打开选择器时优先继承当前选中行的区域，保证新增项能插到该行之后。 */
function pickerSpaceId(): string {
  const selected = rows.value.find((row) => row.key === selectedRowKey.value)
  return selected ? selected.spaceId : currentSpaceId()
}

function findCatalog(value: string): CatalogItem | undefined {
  const raw = value.trim()
  if (!raw) return undefined
  const normalized = raw.replace(/\s+/g, '').toLowerCase()
  return catalogItems.value.find((item) => item.code?.toLowerCase() === raw.toLowerCase())
    || catalogItems.value.find((item) => item.name.replace(/\s+/g, '').toLowerCase() === normalized)
    || catalogItems.value.find((item) => `${item.category}${item.name}${item.spec || ''}`.replace(/\s+/g, '').toLowerCase() === normalized)
    || catalogItems.value.find((item) => item.name.replace(/\s+/g, '').toLowerCase().includes(normalized))
}

function handlePaste(event: ClipboardEvent): void {
  if (!props.canWrite) return
  const text = event.clipboardData?.getData('text/plain') || ''
  if (!text.trim()) return
  event.preventDefault()
  excelText.value = text
  excelVisible.value = true
}

async function persistSheet(options: { auto?: boolean } = {}): Promise<boolean> {
  if (!props.canWrite || !props.designId || saving.value) return false
  if (orderDirty.value) canonicalizeRows()
  const orderWasDirty = orderDirty.value
  const pending = rows.value.filter((row) => row.status !== 'saved')
  const deletions = [...deletedItemIds.value]
  if (!pending.length && !deletions.length && !orderWasDirty) {
    draftStatus.value = 'synced'
    return true
  }
  const invalid = pending.find((row) => !row.catalogItemId || !Number.isFinite(row.quantity) || row.quantity < 0)
  if (invalid) {
    invalid.status = 'error'
    invalid.error = !invalid.catalogItemId ? '请选择企业报价项目' : '工程量不能为负数'
    draftStatus.value = 'error'
    if (!options.auto) {
      actionError.value = invalid.error
      ElMessage.error(invalid.error)
    }
    return false
  }
  if (autosaveTimer !== undefined) {
    clearTimeout(autosaveTimer)
    autosaveTimer = undefined
  }
  saving.value = true
  actionError.value = ''
  draftStatus.value = 'saving'
  try {
    // 脏行走整表原子保存；纯排序走独立 reorder，避免把历史停用项目库分项重新校验/覆盖。
    let returned: DesignScheme | null = null
    if (pending.length || deletions.length) {
      returned = await designApi.saveItems({
        designId: props.designId,
        deletedItemIds: deletions,
        items: pending.map((row) => ({
          itemId: row.itemId,
          spaceId: row.spaceId || undefined,
          catalogItemId: row.catalogItemId,
          quantity: row.quantity,
          quantitySource: row.quantitySource,
          remark: row.remark,
          sort: rows.value.indexOf(row)
        }))
      })
      const serverItems = returned.items ?? []
      if (serverItems.length !== rows.value.length) {
        draftStatus.value = 'error'
        const msg = `保存结果返回 ${serverItems.length} 项，本地 ${rows.value.length} 项，尚未确认全部保存，草稿已保留`
        actionError.value = msg
        cacheDraft()
        if (!options.auto) ElMessage.error(msg)
        return false
      }
      reconcileItems(returned)
    }
    if (orderWasDirty) {
      const itemIds = rows.value.map((row) => row.itemId).filter((id): id is string => Boolean(id))
      if (itemIds.length !== rows.value.length) {
        const msg = '部分分项尚未落库，顺序未保存；请先保存分项后再排序'
        draftStatus.value = 'error'
        actionError.value = msg
        cacheDraft()
        if (!options.auto) ElMessage.error(msg)
        return false
      }
      const reordered = await designApi.reorderItems({ designId: props.designId, itemIds })
      if ((reordered.items ?? []).length !== rows.value.length) {
        const msg = '保存结果的分项数量与本地不一致，顺序未确认保存'
        draftStatus.value = 'error'
        actionError.value = msg
        cacheDraft()
        if (!options.auto) ElMessage.error(msg)
        return false
      }
      reconcileItems(reordered)
      returned = reordered
    }
    if (!returned) {
      draftStatus.value = 'synced'
      return true
    }
    orderDirty.value = false
    designItemDraftCache.clear(props.designId)
    draftStatus.value = 'synced'
    lastSavedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    autosaveBlocked = false
    autosaveErrorNotified = false
    emit('saved', returned)
    if (!options.auto) {
      const label = orderWasDirty
        ? (pending.length || deletions.length ? `已保存 ${pending.length} 项（含顺序）` : '已保存设计分项顺序')
        : `已保存 ${pending.length} 项`
      ElMessage.success(`${label}${deletions.length ? `、删除 ${deletions.length} 项` : ''}`)
    }
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : '设计分项保存失败'
    for (const row of pending) {
      if (row.status !== 'saved') {
        row.status = 'error'
        row.error = message
      }
    }
    draftStatus.value = 'error'
    actionError.value = message
    autosaveBlocked = true
    cacheDraft()
    if (options.auto) {
      if (!autosaveErrorNotified) {
        autosaveErrorNotified = true
        ElMessage.error('自动保存失败，草稿已保留，可点“立即保存”重试')
      }
    } else {
      ElMessage.error(message)
    }
    return false
  } finally {
    saving.value = false
  }
}

async function saveAll(): Promise<boolean> {
  return persistSheet()
}

function scheduleAutosave(): void {
  if (!props.canWrite || !props.designId || saving.value || loading.value || autosaveBlocked) return
  cacheDraft()
  if (!pendingCount.value) return
  if (autosaveTimer !== undefined) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => {
    autosaveTimer = undefined
    void persistSheet({ auto: true })
  }, AUTOSAVE_DELAY)
}

watch(rows, () => scheduleAutosave(), { deep: true })
watch(deletedItemIds, () => scheduleAutosave(), { deep: true })

function toggleFullscreen(): void {
  const node = sheetRoot.value
  if (!node) return
  if (document.fullscreenElement) {
    void document.exitFullscreen()
  } else {
    void node.requestFullscreen?.().catch(() => {})
  }
}

function syncFullscreen(): void {
  fullscreen.value = Boolean(document.fullscreenElement)
}

function handleBeforeUnload(event: BeforeUnloadEvent): void {
  if (!pendingCount.value) return
  event.preventDefault()
  event.returnValue = ''
}

function saveHint(): string {
  if (!pendingCount.value) return '全部设计项已自动保存'
  if (orderDirty.value && !dirtyCount.value && !deletedItemIds.value.length) {
    return '有顺序调整待自动保存，也可点“立即保存”'
  }
  return `有 ${pendingCount.value} 项待自动保存，也可点“立即保存”`
}

onMounted(() => {
  document.addEventListener('fullscreenchange', syncFullscreen)
  window.addEventListener('beforeunload', handleBeforeUnload)
  void load()
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', syncFullscreen)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  if (autosaveTimer !== undefined) {
    clearTimeout(autosaveTimer)
    autosaveTimer = undefined
  }
  cacheDraft()
})
</script>

<template>
  <section ref="sheetRoot" class="sheet" :class="{ 'is-fullscreen': fullscreen, 'is-sort-mode': sortMode }">
    <header class="sheet__head">
      <div>
        <span class="sheet__eyebrow">设计方案分项</span>
        <h3>按空间与类型查看和编辑设计分项</h3>
        <p>设计项只能从企业报价项目库选择，价格、规格、工艺和公式由项目库带入；编辑后自动保存草稿，正式金额自动计算，工程量 0 表示赠送。新增分项默认插到当前选中行之后（同区域同类型），也可进入“排序”调整本组顺序。</p>
      </div>
      <div class="sheet__summary">
        <div class="sheet__amount">
          <span>方案总金额</span>
          <MoneyText :value="totalAmount" size="kpi" />
          <small>设计项汇总 · 正式报价自动计算</small>
        </div>
        <div><span>分项</span><b>{{ rows.length }}</b></div>
        <div><span>草稿</span><b :class="{ 'is-error': draftStatus === 'error' }">{{ draftLabel }}</b></div>
        <div><span>待补尺寸</span><b :class="{ 'is-error': pendingMeasureCount > 0 }">{{ pendingMeasureCount }}</b></div>
        <div v-if="revisionNeededCount > 0"><span>公式待修订</span><b class="is-error">{{ revisionNeededCount }}</b></div>
      </div>
    </header>

    <el-alert v-if="actionError" type="error" :closable="false" :title="actionError" show-icon />

    <div class="sheet__toolbar">
      <div class="sheet__toolbar-amount">
        <span>方案总金额</span>
        <MoneyText :value="totalAmount" size="md" />
      </div>
      <el-button @click="areaOpen = !areaOpen"><NavIcon name="layers" />{{ areaOpen ? '隐藏分组' : '显示分组' }}</el-button>
      <el-button type="primary" :disabled="!canWrite" @click="openPicker"><NavIcon name="add" />新增分项</el-button>
      <el-tooltip :content="sortMode ? '退出排序模式' : '显示拖动行首手柄和上移/下移按钮'" placement="top">
        <el-button :type="sortMode ? 'warning' : 'default'" :disabled="!rows.length" @click="toggleSortMode"><NavIcon :name="sortMode ? 'check' : 'sort'" />{{ sortMode ? '完成调整' : '调整顺序' }}</el-button>
      </el-tooltip>
      <el-button :disabled="!canWrite || !pendingCount" :loading="saving" @click="saveAll"><NavIcon name="save" />立即保存</el-button>
      <el-button @click="toggleFullscreen"><NavIcon :name="fullscreen ? 'collapse' : 'fullscreen'" />{{ fullscreen ? '退出全屏' : '全屏' }}</el-button>
      <el-tooltip content="打开粘贴预览，先核对区域、项目和工程量，再添加" placement="top">
        <el-button :disabled="!canWrite" @click="openExcelDialog"><NavIcon name="upload" />Excel 粘贴</el-button>
      </el-tooltip>
      <span v-if="sortMode" class="sheet__sort-hint">拖动行首 ⋮⋮ 或使用 ↑↓ 调整本组顺序；跨组拖动不会改变区域/类型</span>
      <span v-else class="sheet__sort-hint">点「调整顺序」后，可拖动行首 ⋮⋮ 或使用 ↑↓ 调整本组顺序</span>
      <span class="sheet__status" :class="{ 'is-error': draftStatus === 'error' }">{{ saveHint() }}</span>
    </div>

    <div class="sheet__body" :class="{ 'is-area-hidden': !areaOpen }" @paste="handlePaste">
      <aside v-if="areaOpen" class="sheet__rail">
        <div class="rail__head">
          <div><span>区域 / 分类</span><small>区域尺寸参与工程量公式</small></div>
          <button v-if="canWrite" type="button" class="rail__add" @click="emit('createSpace')"><NavIcon name="add" />新增区域</button>
        </div>
        <nav class="rail__list">
          <button type="button" class="rail__all" :class="{ active: spaceFilter === 'all' && categoryFilter === 'all' }" @click="selectArea('all'); selectCategory('all')">
            <span>全部分组</span><b>{{ rows.length }}</b><small>¥{{ formatMoney(totalAmount) }}</small>
          </button>
          <section v-for="area in areaTree" :key="area.id || 'unassigned'" class="rail__area">
            <div class="rail__area-title">
              <button type="button" class="rail__area-head" :class="{ active: spaceFilter === area.id && categoryFilter === 'all' }" @click="selectArea(area.id)">
                <span>{{ area.name }}</span><b>{{ area.count }}</b><small>¥{{ formatMoney(area.amount) }}</small>
              </button>
              <button v-if="canWrite && area.id" type="button" class="rail__area-edit" title="编辑区域尺寸" @click="emit('editSpace', area.id)">编辑</button>
            </div>
            <div class="rail__cats">
              <button
                v-for="entry in area.categories"
                :key="entry.type"
                type="button"
                :class="{ active: spaceFilter === area.id && categoryFilter === entry.type }"
                @click="selectAreaCategory(area.id, entry.type)"
              >
                <span>{{ entry.label }}</span><small>{{ entry.count }} 项 · ¥{{ formatMoney(entry.amount) }}</small>
              </button>
            </div>
          </section>
        </nav>
      </aside>

      <main class="sheet__main">
        <section v-if="selectedArea && !groups.length && !loading" class="region-board">
          <header>
            <div><strong>{{ selectedArea.name }} · 报价项目类型</strong><small>先选择类型，再新增或选择报价项目</small></div>
            <el-button type="primary" :disabled="!canWrite" @click="openPicker">新增分项</el-button>
          </header>
          <div class="region-board__grid">
            <button
              v-for="type in selectedAreaCategoryOptions"
              :key="type.type"
              type="button"
              :class="{ active: categoryFilter === type.type }"
              @click="selectCategory(type.type)"
            >
              <span>{{ type.label }}</span><b>{{ type.count }} 项</b><small>¥{{ formatMoney(type.amount) }}</small>
            </button>
          </div>
        </section>

        <div v-if="rows.length" class="sheet__cats">
          <button v-for="tab in categoryTabs" :key="tab.value" type="button" :class="{ active: categoryFilter === tab.value }" @click="selectCategory(tab.value)">
            {{ tab.label }} <b>{{ tab.count }}</b>
          </button>
        </div>

        <EmptyState v-if="!loading && !rows.length" title="还没有设计项" description="从企业报价项目库选择施工、主材、软装等项目；支持一次多选，0 表示赠送。" action-text="新增分项" @action="openPicker" />

        <section v-for="group in groups" :key="group.key" class="group">
          <header class="group__head">
            <div><strong>{{ group.areaName }}</strong><span class="group__pill">{{ group.label }}</span><span>{{ group.count }} 项</span></div>
            <div class="group__head-right">
              <b>¥{{ formatMoney(group.amount) }}</b>
              <el-button v-if="canWrite" link size="small" @click.stop="toggleSortMode"><NavIcon name="sort" />{{ sortMode ? '完成调整' : '调整顺序' }}</el-button>
            </div>
          </header>
          <div
            class="group__table-scroll"
            role="region"
            tabindex="0"
            :aria-label="`${group.areaName}${group.label}分项表，可横向滚动`"
          >
            <div class="row row--head">
              <span>#</span><span>区域</span><span>报价项目</span><span>单位</span><span>工程量</span><span>材料价</span><span>人工价</span><span>金额</span><span>备注</span><span>操作</span>
            </div>
            <div
              v-for="(row, index) in group.rows"
              :key="row.key"
              class="row"
              :class="{
                'is-error': row.status === 'error',
                'is-editing': editingRowKey === row.key,
                'is-selected': selectedRowKey === row.key,
                'is-sort-mode': sortMode,
                'is-dragging': draggingRowKey === row.key,
                'is-drag-over': dragOverRowKey === row.key
              }"
              :data-grid-row="index"
              :draggable="sortMode"
              @click="sortMode ? selectRow(row) : startEdit(row)"
              @dragstart="onDragStart(row, $event)"
              @dragover="onDragOver(row, $event)"
              @dragleave="onDragLeave(row)"
              @drop.prevent="onDrop(row)"
              @dragend="onDragEnd"
            >
              <span class="cell num row__order" :title="sortMode ? '拖动调整本组顺序' : ''">
                <span v-if="sortMode" class="row__drag" aria-hidden="true">⋮⋮</span>
                {{ index + 1 }}
              </span>
              <span class="cell">{{ spaces.find((space) => space.id === row.spaceId)?.name || '综合项目' }}</span>
              <span class="cell cell--project">
                <strong>{{ row.name }}</strong>
                <small>{{ rowMeta(row) }}</small>
              </span>
              <span class="cell">{{ row.unit }}</span>
              <span class="cell" @click.stop>
                <QuantityFormulaInput
                  v-if="editingRowKey === row.key && row.catalogItemId"
                  v-model="row.quantity"
                  :precision="3"
                  :disabled="!canWrite || sortMode"
                  :data-grid-cell="true"
                  :data-grid-column="1"
                  :data-grid-row="index"
                  @change="markQuantityDirty(row)"
                  @keydown.enter="stopEdit"
                />
                <button
                  v-else
                  type="button"
                  class="cell__qty"
                  :class="{ 'is-pending': row.pendingMeasure }"
                  :title="row.pendingMeasure ? '待补尺寸：补尺寸后自动重算；不调整将按 0 赠送' : ''"
                  :disabled="!canWrite || sortMode"
                  @click.stop="startEdit(row)"
                >{{ row.pendingMeasure ? '待补' : row.quantity }}</button>
                <small v-if="row.pendingMeasure" class="cell__pending">不调整按 0 赠送</small>
                <small v-if="row.formulaRevisionNeeded" class="cell__revision" title="历史公式使用中文变量，无法按专业变量重算；工程量保留原值，重新选择报价项目库分项即可修正">公式待修订</small>
                <small v-else-if="row.quantitySource === 'manual'" class="cell__source">手工量</small>
              </span>
              <span class="cell num"><MoneyText :value="row.materialPrice" size="sm" /></span>
              <span class="cell num"><MoneyText :value="row.manualPrice" size="sm" /></span>
              <span class="cell num"><b>¥{{ formatMoney(rowAmount(row)) }}</b></span>
              <span class="cell">
                <el-input v-model="row.remark" size="small" :disabled="!canWrite || sortMode" placeholder="—" @click.stop @change="markDirty(row)" />
              </span>
              <span class="cell cell--actions" @click.stop>
                <template v-if="sortMode">
                  <el-button size="small" :disabled="index === 0" title="上移" aria-label="上移" @click="moveRow(row, -1)"><NavIcon name="arrow-up" /></el-button>
                  <el-button size="small" :disabled="index === group.rows.length - 1" title="下移" aria-label="下移" @click="moveRow(row, 1)"><NavIcon name="arrow-down" /></el-button>
                </template>
                <template v-else>
                  <el-tooltip content="在此后新增分项" placement="top">
                    <el-button size="small" type="primary" plain :disabled="!canWrite" title="在此后新增分项" aria-label="在此后新增分项" @click.stop="addAfter(row)"><NavIcon name="add" /></el-button>
                  </el-tooltip>
                  <el-button size="small" type="danger" plain :disabled="!canWrite" @click="deleteRow(row)"><NavIcon name="trash" />删除</el-button>
                </template>
              </span>
              <small v-if="row.error" class="row__error">{{ row.error }}</small>
            </div>
          </div>
        </section>

        <EmptyState v-if="!loading && rows.length && !groups.length && !selectedArea" title="当前分组没有设计项" description="切换左侧区域或上方类型，或点击“新增分项”。" />
      </main>
    </div>

    <DesignCatalogPicker
      v-model="pickerVisible"
      :catalog-items="catalogItems"
      :areas="areaTree"
      :loading="catalogLoading"
      :fullscreen="fullscreen"
      :default-space-id="pickerSpaceId()"
      @add="onPickerAdd"
    />

    <el-dialog v-model="excelVisible" title="从 Excel 粘贴分项" width="820px" :append-to-body="!fullscreen" :modal-append-to-body="!fullscreen" destroy-on-close>
      <div class="excel">
        <p class="excel__hint">
          按列粘贴：<b>区域、项目名称/编码、工程量、备注</b>。第一行表头可保留；区域留空表示综合项目，工程量留空按 1 处理。
          粘贴后先在下方预览中核对，只会添加“可添加”的行。
        </p>
        <pre class="excel__example">区域	项目名称/编码	工程量	备注
综合项目	拆除--开孔（燃气孔，空调孔）	2
主卧	木工--窗帘盒	3.5	现场确认</pre>
        <el-input
          v-model="excelText"
          type="textarea"
          :rows="8"
          resize="vertical"
          placeholder="从 Excel 复制后粘贴到这里；支持 Tab 分隔或逗号分隔。"
        />
        <div class="excel__bar">
          <el-button @click="downloadExcelTemplate"><NavIcon name="download" />下载 CSV 模板</el-button>
          <span>已识别 <b>{{ excelPreview.length }}</b> 行，可添加 <b>{{ excelMatchedCount }}</b> 行<span v-if="catalogLoading"> · 报价项目库加载中，匹配结果会自动刷新</span></span>
        </div>
        <div v-if="excelPreview.length" class="excel__preview">
          <div class="excel__row excel__row--head">
            <span>行</span><span>区域</span><span>匹配项目</span><span>工程量</span><span>状态</span>
          </div>
          <div
            v-for="row in excelPreview"
            :key="row.line"
            class="excel__row"
            :class="`is-${row.status}`"
          >
            <span>{{ row.line }}</span>
            <span>{{ row.areaName }}</span>
            <span>{{ row.catalog?.name || row.catalogValue || '—' }}</span>
            <span>{{ excelQuantityText(row) }}</span>
            <span>{{ row.status === 'matched' ? '可添加' : (row.message || '未匹配') }}</span>
          </div>
        </div>
        <EmptyState
          v-else-if="excelText.trim()"
          title="没有识别到可用行"
          description="请检查是否按“区域、项目名称/编码、工程量、备注”四列粘贴；项目名称需能在企业报价项目库中匹配。"
        />
      </div>
      <template #footer>
        <el-button @click="excelVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!excelMatchedCount" @click="applyExcelRows"><NavIcon name="check" />添加 {{ excelMatchedCount }} 项</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped lang="scss">
.sheet {
  display: flex;
  flex-direction: column;
  gap: $space-3;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  box-shadow: $shadow-card;
  overflow: visible;
}
.sheet.is-fullscreen { padding: $space-4; background: $surface-0; border-radius: 0; overflow: auto; }
.sheet__head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-4; padding: $space-4; border-bottom: 1px solid $border-color; }
.sheet__head h3 { margin: $space-1 0; font-size: $font-title; }
.sheet__head p { margin: 0; max-width: 760px; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.sheet__eyebrow { color: $brand-600; font-size: $font-caption; font-weight: $font-weight-semibold; letter-spacing: .08em; }
.sheet__summary { display: flex; flex-wrap: wrap; align-items: stretch; gap: $space-2; }
.sheet__summary > div { min-width: 96px; padding: $space-2 $space-3; text-align: right; background: $surface-50; border-radius: $radius-sm; }
.sheet__summary span { display: block; color: $text-secondary; font-size: $font-caption; }
.sheet__summary b { font-size: $font-body-sm; font-weight: $font-weight-semibold; }
.sheet__summary b.is-error { color: $danger-500; }
.sheet__summary .sheet__amount {
  min-width: 240px;
  padding: $space-3 $space-4;
  text-align: left;
  color: #fff;
  background: linear-gradient(135deg, $brand-700, $brand-500);
  border-radius: $radius-md;
  box-shadow: 0 8px 20px rgba(24, 83, 180, .18);
}
.sheet__summary .sheet__amount span { color: rgba(255, 255, 255, .78); font-size: $font-caption; letter-spacing: .04em; }
.sheet__summary .sheet__amount :deep(.money) { display: block; margin-top: 2px; color: #fff; font-size: $font-kpi; line-height: 1.1; letter-spacing: -.02em; }
.sheet__summary .sheet__amount small { display: block; margin-top: 3px; color: rgba(255, 255, 255, .72); font-size: $font-micro; }
.sheet__toolbar {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: $space-2;
  padding: 8px $space-4;
  background: rgba(255, 255, 255, .96);
  border-top: 1px solid $border-color;
  border-bottom: 1px solid $border-color;
  backdrop-filter: blur(8px);
}
.sheet__toolbar-amount { display: inline-flex; align-items: baseline; gap: 6px; padding-right: $space-3; border-right: 1px solid $border-color; }
.sheet__toolbar-amount span { color: $text-secondary; font-size: $font-caption; white-space: nowrap; }
.sheet__toolbar-amount :deep(.money) { color: $brand-700; font-size: $font-body; font-weight: $font-weight-semibold; }
.sheet__toolbar :deep(.el-button) { display: inline-flex; align-items: center; gap: 4px; }
.sheet__toolbar :deep(.nav-icon) { width: 14px; height: 14px; flex-basis: 14px; }
.sheet__hint { color: $text-secondary; font-size: $font-caption; text-decoration: underline dotted; cursor: help; }
.sheet__status { margin-left: auto; color: $text-secondary; font-size: $font-caption; }
.sheet__status.is-error { color: $danger-500; }
.sheet__sort-hint { color: $warning-700; font-size: $font-caption; }

.sheet__body { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: $space-3; padding: $space-3 $space-4 $space-4; }
.sheet__body.is-area-hidden { grid-template-columns: minmax(0, 1fr); }
.sheet__rail { padding: $space-3; background: $surface-50; border: 1px solid $border-color; border-radius: $radius-sm; }
.rail__head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: $space-2; color: $text-secondary; font-size: $font-caption; font-weight: $font-weight-semibold; }
.rail__head > div { display: flex; flex-direction: column; gap: 2px; }
.rail__head > button { display: inline-flex; align-items: center; gap: 3px; border: 0; background: transparent; color: $brand-600; font: inherit; font-size: $font-caption; cursor: pointer; }
.rail__head .nav-icon { width: 12px; height: 12px; flex-basis: 12px; }
.rail__head small { font-weight: $font-weight-regular; color: $text-tertiary; }
.rail__area-title { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 3px; }
.rail__area-edit { align-self: stretch; padding: 0 6px; border: 0; border-left: 1px solid $border-color; background: transparent; color: $text-tertiary; font: inherit; font-size: $font-micro; cursor: pointer; }
.rail__area-edit:hover { color: $brand-600; background: $brand-50; }
.rail__list { display: flex; flex-direction: column; gap: $space-2; }
.rail__all,
.rail__area-head,
.rail__cats button { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px $space-2; width: 100%; padding: $space-2; text-align: left; background: $surface-0; border: 1px solid $border-color; border-radius: $radius-xs; cursor: pointer; }
.rail__all span,
.rail__area-head span,
.rail__cats button span { min-width: 0; overflow: hidden; color: $ink-800; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; }
.rail__all b,
.rail__area-head b { color: $ink-950; font-size: $font-caption; font-variant-numeric: tabular-nums; }
.rail__all small,
.rail__area-head small { grid-column: 1 / -1; color: $text-tertiary; font-size: $font-caption; }
.rail__all.active,
.rail__area-head.active { color: $brand-700; background: $brand-50; border-color: $brand-500; }
.rail__cats { display: flex; flex-direction: column; gap: 2px; margin: 4px 0 0 $space-2; padding-left: $space-2; border-left: 2px solid $border-color; }
.rail__cats button.active { background: $brand-50; border-color: $brand-300; }
.rail__cats small { grid-column: 1 / -1; color: $text-tertiary; font-size: $font-caption; }

.sheet__main { display: flex; flex-direction: column; gap: $space-3; min-width: 0; }
.sheet__cats { display: flex; flex-wrap: wrap; gap: $space-1; }
.sheet__cats button { padding: 4px 10px; color: $text-secondary; background: $surface-50; border: 1px solid $border-color; border-radius: $radius-pill; font-size: $font-caption; cursor: pointer; }
.sheet__cats button.active { color: $brand-700; background: $brand-50; border-color: $brand-500; font-weight: $font-weight-semibold; }
.sheet__cats b { font-variant-numeric: tabular-nums; }

.region-board { overflow: hidden; background: $surface-0; border: 1px solid $border-color; border-radius: $radius-sm; }
.region-board header { display: flex; align-items: center; justify-content: space-between; gap: $space-3; padding: $space-3; background: $surface-50; border-bottom: 1px solid $border-color; }
.region-board header div { display: flex; flex-direction: column; }
.region-board header strong { font-size: $font-body-sm; }
.region-board header small { color: $text-secondary; font-size: $font-caption; }
.region-board__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: $space-2; padding: $space-3; }
.region-board__grid button { display: flex; flex-direction: column; gap: 3px; padding: $space-3; text-align: left; background: $surface-0; border: 1px solid $border-color; border-radius: $radius-sm; cursor: pointer; }
.region-board__grid button.active { border-color: $brand-500; background: $brand-50; }
.region-board__grid span { color: $ink-800; font-size: $font-body-sm; font-weight: $font-weight-semibold; }
.region-board__grid b { color: $text-secondary; font-size: $font-caption; font-weight: $font-weight-regular; }
.region-board__grid small { color: $text-tertiary; font-size: $font-caption; }

.group { overflow: hidden; border: 1px solid $border-color; border-radius: $radius-sm; }
.group__head { display: flex; align-items: center; justify-content: space-between; gap: $space-2; padding: $space-2 $space-3; background: $surface-50; border-bottom: 1px solid $border-color; }
.group__table-scroll {
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  scrollbar-gutter: stable;
}
.group__table-scroll:focus-visible { outline: 2px solid $brand-500; outline-offset: -2px; }
.group__table-scroll { scrollbar-width: none; }
.group__table-scroll::-webkit-scrollbar { display: none; height: 0; }
.group__head div { display: flex; align-items: baseline; gap: $space-2; }
.group__head strong { font-size: $font-body-sm; }
.group__head span { color: $text-secondary; font-size: $font-caption; }
.group__pill { padding: 1px 8px; color: $brand-700 !important; background: $brand-50; border-radius: $radius-pill; }
.group__head > b { color: $brand-700; font-variant-numeric: tabular-nums; }
.group__head-right { display: flex; align-items: center; gap: $space-2; }
.group__head-right b { color: $brand-700; font-variant-numeric: tabular-nums; }
.group__head-right :deep(.el-button) { display: inline-flex; align-items: center; gap: 3px; padding: 0; }
.group__head-right :deep(.nav-icon) { width: 12px; height: 12px; flex-basis: 12px; }

.row {
  --index-col: 32px;
  --area-col: 64px;
  --material-col: 72px;
  --manual-col: 72px;
  --amount-col: 92px;
  --action-col: 160px;
  --col-gap: 4px;
  display: grid;
  grid-template-columns:
    var(--index-col) var(--area-col) minmax(180px, 1.5fr)
    40px 76px
    var(--material-col) var(--manual-col) var(--amount-col)
    minmax(72px, 1fr) var(--action-col);
  align-items: center;
  gap: var(--col-gap);
  width: 100%;
  min-width: 920px;
  box-sizing: border-box;
  padding: $space-2 $space-3;
  border-bottom: 1px solid $border-color;
  font-size: $font-caption;
}
.row:last-child { border-bottom: 0; }
.row--head { position: relative; background: $surface-0; color: $text-secondary; font-weight: $font-weight-semibold; }
.row.is-editing { background: $brand-50; }
.row.is-error { background: $danger-50; }
.row.is-selected { outline: 2px solid $brand-300; outline-offset: -2px; background: $brand-50; }
.row.is-sort-mode { cursor: grab; }
.row.is-sort-mode:active { cursor: grabbing; }
.row.is-dragging { opacity: .45; }
.row.is-drag-over { box-shadow: inset 0 2px 0 $brand-500; }
.row__order { display: inline-flex; align-items: center; justify-content: flex-end; gap: 3px; }
.row__drag { color: $text-tertiary; font-size: 11px; line-height: 1; letter-spacing: -2px; }

/* 左侧固定：序号、区域、报价项目。区域一并固定，避免横向滚动时项目名称与区域脱节。 */
.row > :nth-child(1),
.row > :nth-child(2),
.row > :nth-child(3) {
  position: sticky;
  z-index: 4;
  background: $surface-0;
}
.row > :nth-child(1) { left: 0; }
.row > :nth-child(2) { left: calc(var(--index-col) + var(--col-gap)); }
.row > :nth-child(3) {
  left: calc(var(--index-col) + var(--area-col) + var(--col-gap) + var(--col-gap));
  box-shadow: 1px 0 0 $border-color;
}

/* 右侧固定：材料价、人工价、金额、操作。备注作为中间列横向滚动。 */
.row > :nth-child(6),
.row > :nth-child(7),
.row > :nth-child(8),
.row > :nth-child(10) {
  position: sticky;
  z-index: 4;
  background: $surface-0;
}
.row > :nth-child(6) {
  right: calc(var(--action-col) + var(--amount-col) + var(--manual-col) + var(--col-gap) + var(--col-gap) + var(--col-gap));
  box-shadow: -1px 0 0 $border-color;
}
.row > :nth-child(7) {
  right: calc(var(--action-col) + var(--amount-col) + var(--col-gap) + var(--col-gap));
}
.row > :nth-child(8) {
  right: calc(var(--action-col) + var(--col-gap));
}
.row > :nth-child(10) {
  right: 0;
  box-shadow: -1px 0 0 $border-color;
}
.row--head > :nth-child(1),
.row--head > :nth-child(2),
.row--head > :nth-child(3),
.row--head > :nth-child(6),
.row--head > :nth-child(7),
.row--head > :nth-child(8),
.row--head > :nth-child(10) { z-index: 6; background: $surface-0; }
.row.is-editing > :nth-child(1),
.row.is-editing > :nth-child(2),
.row.is-editing > :nth-child(3),
.row.is-editing > :nth-child(6),
.row.is-editing > :nth-child(7),
.row.is-editing > :nth-child(8),
.row.is-editing > :nth-child(10) { background: $brand-50; }
.row.is-error > :nth-child(1),
.row.is-error > :nth-child(2),
.row.is-error > :nth-child(3),
.row.is-error > :nth-child(6),
.row.is-error > :nth-child(7),
.row.is-error > :nth-child(8),
.row.is-error > :nth-child(10) { background: $danger-50; }
.row.is-selected > :nth-child(1),
.row.is-selected > :nth-child(2),
.row.is-selected > :nth-child(3),
.row.is-selected > :nth-child(6),
.row.is-selected > :nth-child(7),
.row.is-selected > :nth-child(8),
.row.is-selected > :nth-child(10) { background: $brand-50; }
.cell { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell.num { text-align: right; }
.cell--project { display: flex; flex-direction: column; gap: 2px; }
.cell--project strong { overflow: hidden; color: $ink-950; text-overflow: ellipsis; white-space: nowrap; }
.cell--project small { color: $text-secondary; }
.cell__link { align-self: flex-start; padding: 0; color: $brand-700; background: transparent; border: 0; font-size: $font-caption; text-decoration: underline; cursor: pointer; }
.cell__pick { padding: 4px 8px; color: $text-secondary; background: $surface-0; border: 1px dashed $border-color; border-radius: $radius-xs; font-size: $font-caption; cursor: pointer; }
.cell__qty { width: 100%; padding: 0 4px; color: $ink-800; text-align: right; background: transparent; border: 0; font-variant-numeric: tabular-nums; cursor: text; }
.cell__qty.is-pending { color: $warning-700; font-weight: $font-weight-semibold; }
.cell__pending { display: block; color: $warning-700; font-size: $font-micro; white-space: nowrap; }
.cell__revision { display: block; margin-top: 2px; color: $warning-700; font-size: $font-micro; white-space: nowrap; }
.cell__source { display: block; color: $text-tertiary; font-size: $font-micro; white-space: nowrap; }
.cell--actions { display: flex; justify-content: flex-end; gap: $space-1; }
.cell--actions :deep(.nav-icon) { width: 13px; height: 13px; flex-basis: 13px; }
.cell--actions :deep(.el-button) { display: inline-flex; align-items: center; gap: 2px; }
.row__error { grid-column: 1 / -1; color: $danger-500; }

.excel { display: flex; flex-direction: column; gap: $space-3; }
.excel__hint { margin: 0; color: $text-secondary; font-size: $font-caption; line-height: 1.7; }
.excel__hint b { color: $ink-950; }
.excel__example { margin: 0; padding: $space-3; overflow-x: auto; color: $text-secondary; background: $surface-50; border: 1px solid $border-color; border-radius: $radius-sm; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: $font-caption; line-height: 1.7; white-space: pre; }
.excel__bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: $space-2; color: $text-secondary; font-size: $font-caption; }
.excel__bar b { color: $ink-950; font-variant-numeric: tabular-nums; }
.excel__bar :deep(.nav-icon) { width: 14px; height: 14px; flex-basis: 14px; }
.excel__preview { max-height: 260px; overflow: auto; border: 1px solid $border-color; border-radius: $radius-sm; }
.excel__row { display: grid; grid-template-columns: 40px 90px minmax(0, 1fr) 72px minmax(120px, .8fr); gap: $space-2; align-items: center; padding: 6px $space-3; border-bottom: 1px solid $border-color; font-size: $font-caption; }
.excel__row:last-child { border-bottom: 0; }
.excel__row--head { position: sticky; top: 0; z-index: 1; color: $text-secondary; background: $surface-50; font-weight: $font-weight-semibold; }
.excel__row span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.excel__row.is-unmatched { background: $warning-50; }
.excel__row.is-invalid { background: $danger-50; }
.excel__row.is-unmatched span:last-child { color: $warning-700; }
.excel__row.is-invalid span:last-child { color: $danger-500; }
.excel__row.is-matched span:last-child { color: $success-500; }

@media (max-width: 1280px) {
  .sheet__body { grid-template-columns: 220px minmax(0, 1fr); }
  .row {
    --index-col: 28px;
    --area-col: 58px;
    --material-col: 66px;
    --manual-col: 66px;
    --amount-col: 84px;
    --action-col: 148px;
    --col-gap: 3px;
    grid-template-columns:
      var(--index-col) var(--area-col) minmax(160px, 1.5fr)
      36px 70px
      var(--material-col) var(--manual-col) var(--amount-col)
      minmax(60px, 1fr) var(--action-col);
    min-width: 860px;
  }
  .region-board__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 1024px) {
  .sheet__head { flex-direction: column; }
  .sheet__summary { width: 100%; }
  .sheet__body { grid-template-columns: minmax(0, 1fr); }
  .sheet__rail { display: none; }
}
</style>
