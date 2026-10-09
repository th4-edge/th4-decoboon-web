<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import EmptyState from '@/components/EmptyState.vue'
import DesignCatalogPicker from './DesignCatalogPicker.vue'
import DesignTemplateFormulaAssistant from './DesignTemplateFormulaAssistant.vue'
import { catalogApi } from '@/domains/catalog/api'
import type { CatalogItem } from '@/domains/catalog/model'
import { DESIGN_ITEM_TYPE_LABELS, DESIGN_ITEM_TYPE_ORDER } from '@/domains/design/meta'
import type { DesignItemType } from '@/domains/design/model'
import { batchSaveItems } from '@/domains/designtemplate/api'
import { clipboardRows, toNumber } from '@/core/spreadsheet'
import { designTemplateDraftCache, type DesignTemplateDraftRow } from './designTemplateDraftCache'
import {
  formulaErrorMessage,
  previewFixedQuantity,
  previewFormula,
  type FormulaPreview
} from '@/domains/designtemplate/formula-guide'
import type { TemplateItem, TemplateRoom } from '@/domains/designtemplate/model'

type RowStatus = 'saved' | 'new' | 'dirty' | 'saving' | 'error'

interface Row {
  key: string
  status: RowStatus
  error?: string
  itemId?: string
  catalogItemId: string
  /** 空串 = 全屋共享。 */
  roomKey: string
  type: DesignItemType
  category: string
  name: string
  unit: string
  quantityFormula: string
  defaultQuantity?: number
  remark?: string
  sortNo: number
}

const props = defineProps<{
  templateId: string
  versionId: string
  canWrite: boolean
  rooms: TemplateRoom[]
  items: TemplateItem[]
}>()

const emit = defineEmits<{
  saved: [items: TemplateItem[]]
  summary: [value: { total: number; ready: number; missing: number; error: number }]
}>()

const rows = ref<Row[]>([])
const deletedItemIds = ref<string[]>([])
const deletedRows = ref<Row[]>([])
const saving = ref(false)
const catalogItems = ref<CatalogItem[]>([])
const catalogLoaded = ref(false)
const catalogLoading = ref(false)
const pickerVisible = ref(false)
const spaceFilter = ref<'all' | string>('all')
const categoryFilter = ref<'all' | DesignItemType>('all')
const areaOpen = ref(true)
const fullscreen = ref(false)
const sheetRoot = ref<HTMLElement | null>(null)
const editingRowKey = ref('')
const assistantVisible = ref(false)
const assistantRowKey = ref('')
const actionError = ref('')
const lastSavedAt = ref('')
const AUTOSAVE_DELAY = 1200
let autosaveTimer: ReturnType<typeof setTimeout> | undefined

const definitions = computed(() => [
  { id: '', name: '全屋共享' },
  ...props.rooms.map((room) => ({ id: room.roomKey, name: room.name }))
])

const areaTree = computed(() => definitions.value.map((area) => {
  const areaRows = rows.value.filter((row) => row.roomKey === area.id)
  return {
    ...area,
    count: areaRows.length,
    categories: DESIGN_ITEM_TYPE_ORDER.map((type) => ({
      type,
      label: DESIGN_ITEM_TYPE_LABELS[type],
      count: areaRows.filter((row) => row.type === type).length
    }))
  }
}))

const categoryTabs = computed(() => [
  { value: 'all' as const, label: '全部', count: rows.value.filter((row) => spaceFilter.value === 'all' || row.roomKey === spaceFilter.value).length },
  ...DESIGN_ITEM_TYPE_ORDER
    .filter((type) => rows.value.some((row) => (spaceFilter.value === 'all' || row.roomKey === spaceFilter.value) && row.type === type))
    .map((type) => ({
      value: type,
      label: DESIGN_ITEM_TYPE_LABELS[type],
      count: rows.value.filter((row) => (spaceFilter.value === 'all' || row.roomKey === spaceFilter.value) && row.type === type).length
    }))
])

const groups = computed(() => {
  const result: Array<{ key: string; roomKey: string; roomName: string; type: DesignItemType; label: string; rows: Row[] }> = []
  for (const area of definitions.value) {
    if (spaceFilter.value !== 'all' && area.id !== spaceFilter.value) continue
    for (const type of DESIGN_ITEM_TYPE_ORDER) {
      if (categoryFilter.value !== 'all' && categoryFilter.value !== type) continue
      const groupRows = rows.value.filter((row) => row.roomKey === area.id && row.type === type)
      if (!groupRows.length) continue
      result.push({ key: `${area.id || 'shared'}:${type}`, roomKey: area.id, roomName: area.name, type, label: DESIGN_ITEM_TYPE_LABELS[type], rows: groupRows })
    }
  }
  return result
})

const assistantRow = computed(() => rows.value.find((row) => row.key === assistantRowKey.value))
const assistantRoom = computed(() => {
  const row = assistantRow.value
  if (!row || !row.roomKey) return undefined
  return props.rooms.find((room) => room.roomKey === row.roomKey)
})

function key(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function toRow(item: TemplateItem): Row {
  const catalog = item.catalogItem
  return {
    key: key(),
    status: 'saved',
    itemId: item.itemId,
    catalogItemId: catalog?.itemId ?? '',
    roomKey: item.roomKey ?? '',
    type: catalog?.type ?? 'construction',
    category: '',
    name: catalog?.name ?? '未命名分项',
    unit: catalog?.unit ?? '',
    quantityFormula: item.quantityFormula ?? '',
    defaultQuantity: item.defaultQuantity,
    remark: item.remark,
    sortNo: item.sortNo ?? 0
  }
}

function rebuild(): void {
  rows.value = props.items.map(toRow)
}

let lastVersionId = ''

// 只在切换到另一个模版版本时恢复/重建行；行内自动保存后不被父组件回写重置，
// 避免编辑公式时失去焦点（对齐设计工作区“不整页刷新”的交互要求）。
watch(() => props.versionId, (versionId) => {
  if (!versionId || versionId === lastVersionId) return
  lastVersionId = versionId
  restoreDraft()
}, { immediate: true })

function previewOf(row: Row): FormulaPreview {
  const formula = row.quantityFormula.trim()
  if (formula) {
    const room = row.roomKey ? props.rooms.find((entry) => entry.roomKey === row.roomKey) : undefined
    return previewFormula(formula, room, props.rooms, row.unit)
  }
  return previewFixedQuantity(row.defaultQuantity)
}

function previewText(row: Row): string {
  const preview = previewOf(row)
  if (preview.status === 'ready' || preview.status === 'fixed') return `${preview.value ?? '—'} ${row.unit}`.trim()
  if (preview.status === 'missing') return '待补尺寸'
  if (preview.status === 'empty') return '待填公式'
  return '公式异常'
}

function stateOf(row: Row): { label: string; tone: 'done' | 'doing' | 'warning' | 'danger' | 'muted' } {
  const preview = previewOf(row)
  if (row.status === 'error') return { label: '需处理', tone: 'danger' }
  if (preview.status === 'error') return { label: '公式异常', tone: 'danger' }
  if (preview.status === 'missing') return { label: '待补尺寸', tone: 'warning' }
  if (preview.status === 'empty') return { label: '待填公式', tone: 'warning' }
  if (row.status === 'saving') return { label: '保存中', tone: 'doing' }
  if (row.status === 'dirty' || row.status === 'new') return { label: '待保存', tone: 'doing' }
  return { label: '已保存', tone: 'done' }
}

function errorOf(row: Row): string {
  const preview = previewOf(row)
  if (preview.status === 'error') return formulaErrorMessage(preview.code, preview.message)
  return row.error ?? ''
}

function markDirty(row: Row): void {
  if (!props.canWrite) return
  if (row.status !== 'saving') row.status = row.itemId ? 'dirty' : 'new'
  row.error = undefined
  cacheDraft()
  scheduleAutosave()
}

function toDraftRow(row: Row): DesignTemplateDraftRow {
  return {
    key: row.key,
    itemId: row.itemId,
    catalogItemId: row.catalogItemId,
    roomKey: row.roomKey,
    type: row.type,
    name: row.name,
    unit: row.unit,
    quantityFormula: row.quantityFormula,
    defaultQuantity: row.defaultQuantity,
    remark: row.remark,
    sortNo: row.sortNo
  }
}

function draftToRow(draft: DesignTemplateDraftRow): Row {
  return {
    ...draft,
    category: '',
    status: draft.itemId ? 'dirty' : 'new'
  }
}

function cacheDraft(): void {
  if (!props.canWrite || !props.versionId) return
  const pending = rows.value.some((row) => row.status !== 'saved')
  if (!pending && !deletedItemIds.value.length) {
    designTemplateDraftCache.clear(props.versionId)
    return
  }
  designTemplateDraftCache.write(props.versionId, {
    rows: rows.value.map(toDraftRow),
    deletedItemIds: [...deletedItemIds.value],
    deletedRows: deletedRows.value.map(toDraftRow)
  })
}

function restoreDraft(): void {
  const draft = props.versionId ? designTemplateDraftCache.read(props.versionId) : undefined
  if (draft?.rows?.length) {
    rows.value = draft.rows.map(draftToRow)
    deletedItemIds.value = [...draft.deletedItemIds]
    deletedRows.value = (draft.deletedRows ?? []).map(draftToRow)
    scheduleAutosave()
    return
  }
  rebuild()
}

function currentRoomKey(): string {
  return spaceFilter.value === 'all' ? '' : spaceFilter.value
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
  const target = event.target as HTMLElement | null
  const pasted = clipboardRows(event)
  if (!pasted.length) return
  // 单格粘贴进输入框时保留浏览器默认行为；多行/多列按 Excel 表粘贴。
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && pasted.length === 1 && (pasted[0]?.length ?? 0) <= 1) {
    return
  }
  event.preventDefault()
  let added = 0
  let missed = 0
  for (const cells of pasted) {
    const values = cells.map((cell) => String(cell ?? '').trim())
    const [areaName = '', catalogValue = '', quantityValue = '', remark = ''] = values
    if (!catalogValue) continue
    const catalog = findCatalog(catalogValue)
    if (!catalog) {
      missed += 1
      continue
    }
    const roomKey = props.rooms.find((room) => room.name === areaName)?.roomKey ?? currentRoomKey()
    const formula = quantityValue.startsWith('=') ? quantityValue : ''
    const fixed = formula ? undefined : toNumber(quantityValue) || undefined
    rows.value.push({
      key: key(),
      status: 'new',
      catalogItemId: catalog.id,
      roomKey,
      type: catalog.type,
      category: catalog.category,
      name: catalog.name,
      unit: catalog.unit,
      quantityFormula: formula,
      defaultQuantity: fixed,
      remark: remark || undefined,
      sortNo: rows.value.length
    })
    added += 1
  }
  cacheDraft()
  scheduleAutosave()
  ElMessage.success(`已粘贴 ${added} 行${missed ? `，${missed} 行未匹配报价项目库已跳过` : ''}，请核对公式后自动保存`)
}

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
  const pending = rows.value.some((row) => row.status !== 'saved') || deletedItemIds.value.length > 0
  if (!pending) return
  event.preventDefault()
  event.returnValue = ''
}

function scheduleAutosave(): void {
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => { void persistDirty() }, AUTOSAVE_DELAY)
}

async function persistDirty(): Promise<void> {
  if (!props.canWrite || !props.versionId || saving.value) return
  const pending = rows.value.filter((row) => row.status === 'dirty' || row.status === 'new')
  const deletions = [...deletedItemIds.value]
  if (!pending.length && !deletions.length) return

  // 刚加入、还没写公式/固定数量的空行不提交，留在本地等设计师填写；
  // 已写内容但有公式错误的行会阻断整批，避免部分保存造成静默丢行。
  const emptyRows = pending.filter((row) => previewOf(row).status === 'empty')
  const attempted = pending.filter((row) => previewOf(row).status !== 'empty')
  const invalid = attempted.find((row) => previewOf(row).status === 'error')
  if (invalid) {
    const preview = previewOf(invalid)
    invalid.status = 'error'
    invalid.error = formulaErrorMessage(preview.code, preview.message)
    actionError.value = invalid.error ?? ''
    return
  }

  saving.value = true
  actionError.value = ''
  for (const row of attempted) row.status = 'saving'

  try {
    // 对齐设计工作区 `design/items/save`：新增/更新与删除一次提交，整批成功或整批回滚。
    const returned = await batchSaveItems({
      versionId: props.versionId,
      deletedItemIds: deletions.length ? deletions : undefined,
      items: attempted.map((row) => ({
        itemId: row.itemId,
        roomKey: row.roomKey || undefined,
        catalogItemId: row.catalogItemId,
        quantityFormula: row.quantityFormula.trim() || undefined,
        defaultQuantity: row.quantityFormula.trim() ? undefined : row.defaultQuantity,
        sortNo: row.sortNo,
        remark: row.remark
      }))
    })
    const expectedServerCount = rows.value.length - emptyRows.length
    if (returned.length !== expectedServerCount) {
      const message = `服务端读回 ${returned.length} 项，本地应有 ${expectedServerCount} 项，未确认全部保存，草稿已保留`
      actionError.value = message
      ElMessage.error(message)
      for (const row of attempted) {
        row.status = 'error'
        row.error = message
      }
      return
    }
    reconcile(returned, attempted)
    deletedItemIds.value = []
    deletedRows.value = []
    if (props.versionId) designTemplateDraftCache.clear(props.versionId)
    lastSavedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    emit('saved', rows.value.map(toTemplateItem))
  } catch (error) {
    const message = error instanceof Error ? error.message : '模版分项批量保存失败'
    actionError.value = message
    for (const row of attempted) {
      row.status = 'error'
      row.error = message
    }
    // 删除失败：恢复被移除的行，避免本地静默丢失。
    if (deletedRows.value.length) {
      rows.value.push(...deletedRows.value)
      deletedRows.value = []
      deletedItemIds.value = []
    }
  } finally {
    saving.value = false
  }
}

function reconcile(returned: TemplateItem[], attempted: Row[]): void {
  const byId = new Map(returned.map((item) => [item.itemId, item]))
  const used = new Set<string>()
  for (const row of rows.value) {
    if (row.itemId && byId.has(row.itemId)) {
      applyServerItem(row, byId.get(row.itemId)!)
      used.add(row.itemId)
    }
  }
  const remaining = returned.filter((item) => !used.has(item.itemId))
  for (const row of rows.value) {
    if (row.itemId) continue
    const index = remaining.findIndex((item) => (item.catalogItem?.itemId ?? '') === row.catalogItemId && (item.roomKey ?? '') === row.roomKey)
    if (index >= 0) {
      applyServerItem(row, remaining[index]!)
      used.add(remaining[index]!.itemId)
      remaining.splice(index, 1)
    }
  }
  for (const row of attempted) {
    if (!row.itemId) {
      row.status = 'error'
      row.error = '服务端未回读该行，草稿已保留，请重试'
    }
  }
}

function applyServerItem(row: Row, item: TemplateItem): void {
  row.itemId = item.itemId
  row.roomKey = item.roomKey ?? ''
  row.quantityFormula = item.quantityFormula ?? ''
  row.defaultQuantity = item.defaultQuantity
  row.sortNo = item.sortNo ?? row.sortNo
  row.status = 'saved'
  row.error = undefined
}

function toTemplateItem(row: Row): TemplateItem {
  return {
    itemId: row.itemId ?? '',
    roomKey: row.roomKey || undefined,
    quantityFormula: row.quantityFormula.trim() || undefined,
    defaultQuantity: row.quantityFormula.trim() ? undefined : row.defaultQuantity,
    sortNo: row.sortNo,
    remark: row.remark,
    catalogItem: {
      itemId: row.catalogItemId,
      type: row.type,
      name: row.name,
      unit: row.unit,
      pricingMode: 'materialAndManual',
      materialPrice: 0,
      manualPrice: 0
    }
  }
}

async function removeRow(row: Row): Promise<void> {
  if (!props.canWrite) return
  if (row.itemId) {
    deletedItemIds.value = [...new Set([...deletedItemIds.value, row.itemId])]
    deletedRows.value.push(row)
  }
  rows.value = rows.value.filter((entry) => entry.key !== row.key)
  ElMessage.success(row.itemId ? '分项已标记删除，自动保存中' : '分项已移除')
  cacheDraft()
  scheduleAutosave()
}

function selectArea(areaId: string): void {
  spaceFilter.value = areaId
  categoryFilter.value = 'all'
}

function selectAreaCategory(areaId: string, type: DesignItemType): void {
  spaceFilter.value = areaId
  categoryFilter.value = type
}

function openPicker(): void {
  void loadCatalog()
  pickerVisible.value = true
}

async function loadCatalog(): Promise<void> {
  if (catalogLoaded.value || catalogLoading.value) return
  catalogLoading.value = true
  try {
    const result: CatalogItem[] = []
    for (const type of DESIGN_ITEM_TYPE_ORDER) {
      let current = 1
      // 后端把 size 上限压到 100：必须按 100 判断是否还有下一页，否则粘贴匹配会截断在 100 条。
      while (current <= 30) {
        const page = await catalogApi.pageCatalog({ type, current, size: 100 })
        result.push(...page)
        if (page.length < 100) break
        current += 1
      }
    }
    catalogItems.value = result
    catalogLoaded.value = true
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : '报价项目库加载失败'
  } finally {
    catalogLoading.value = false
  }
}

function onPickCatalog(payload: { spaceId: string; items: Array<{ catalogItemId: string; quantity: number }> }): void {
  const spaceId = payload.spaceId && definitions.value.some((area) => area.id === payload.spaceId) ? payload.spaceId : ''
  let added = 0
  for (const picked of payload.items) {
    const catalog = catalogItems.value.find((item) => item.id === picked.catalogItemId)
    if (!catalog) continue
    rows.value.push({
      key: key(),
      status: 'new',
      catalogItemId: catalog.id,
      roomKey: spaceId,
      type: catalog.type,
      category: catalog.category,
      name: catalog.name,
      unit: catalog.unit,
      quantityFormula: '',
      defaultQuantity: undefined,
      sortNo: rows.value.length
    })
    added += 1
  }
  if (added) {
    ElMessage.success(`已加入 ${added} 个分项，请填写工程量公式或固定数量`)
    cacheDraft()
    scheduleAutosave()
  }
}

function openAssistant(row: Row): void {
  assistantRowKey.value = row.key
  assistantVisible.value = true
}

function onInsertFormula(text: string): void {
  const row = assistantRow.value
  if (!row) return
  row.quantityFormula = text
  markDirty(row)
}

const summary = computed(() => {
  let ready = 0
  let missing = 0
  let error = 0
  for (const row of rows.value) {
    const preview = previewOf(row)
    if (preview.status === 'ready' || preview.status === 'fixed') ready += 1
    else if (preview.status === 'error' || row.status === 'error') error += 1
    else missing += 1
  }
  return { total: rows.value.length, ready, missing, error }
})

watch(summary, (value) => emit('summary', value), { immediate: true, deep: true })

const pickerAreas = computed(() => definitions.value.map((area) => {
  const areaRows = rows.value.filter((row) => row.roomKey === area.id)
  return {
    id: area.id,
    name: area.name,
    count: areaRows.length,
    amount: 0,
    categories: DESIGN_ITEM_TYPE_ORDER.map((type) => ({
      type,
      label: DESIGN_ITEM_TYPE_LABELS[type],
      count: areaRows.filter((row) => row.type === type).length,
      amount: 0
    }))
  }
}))

const draftLabel = computed(() => {
  if (saving.value) return '自动保存中…'
  const pending = rows.value.filter((row) => row.status === 'dirty' || row.status === 'new' || row.status === 'saving').length + deletedItemIds.value.length
  if (pending) return `待自动保存 ${pending} 项`
  if (lastSavedAt.value) return `已自动保存 ${lastSavedAt.value}`
  return '已同步'
})

onMounted(() => {
  document.addEventListener('fullscreenchange', syncFullscreen)
  window.addEventListener('beforeunload', handleBeforeUnload)
  // Excel 粘贴需要按名称/编码匹配报价项目库，进入页面即预取；选择器打开时复用缓存。
  void loadCatalog()
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', syncFullscreen)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  cacheDraft()
  if (autosaveTimer) clearTimeout(autosaveTimer)
})
</script>

<template>
  <section ref="sheetRoot" class="tmpl-sheet" :class="{ 'is-fullscreen': fullscreen }" @paste="handlePaste">
    <header class="tmpl-sheet__head">
      <div>
        <p class="tmpl-sheet__eyebrow">模版分项配置</p>
        <h3>区域骨架 + 分项公式</h3>
        <p>配置流程与「待我设计 → 设计工作区」一致：左侧按区域/分类定位，右侧写公式，自动保存。模版不展示材料价、人工价或任何金额；待补尺寸可保存和发布，生成正式报价前必须补齐。</p>
      </div>
      <div class="tmpl-sheet__summary">
        <span>已配置 <b>{{ summary.total }}</b> 项</span>
        <span class="is-ready">就绪 <b>{{ summary.ready }}</b></span>
        <span class="is-warning">待补 <b>{{ summary.missing }}</b></span>
        <span class="is-danger">异常 <b>{{ summary.error }}</b></span>
        <em>{{ draftLabel }}</em>
      </div>
    </header>

    <div class="tmpl-sheet__body" :class="{ 'is-area-hidden': !areaOpen }">
      <aside v-if="areaOpen" class="rail">
        <div class="rail__head">
          <span>区域 / 分类</span>
          <small>按分组定位</small>
        </div>
        <nav class="rail__list">
          <button type="button" class="rail__all" :class="{ active: spaceFilter === 'all' && categoryFilter === 'all' }" @click="selectArea('all')">
            <span>全部分组</span>
            <b>{{ rows.length }}</b>
          </button>
          <section v-for="area in areaTree" :key="area.id || 'shared'" class="rail__area">
            <button type="button" class="rail__area-head" :class="{ active: spaceFilter === area.id && categoryFilter === 'all' }" @click="selectArea(area.id)">
              <span>{{ area.name }}</span>
              <b>{{ area.count }}</b>
            </button>
            <div class="rail__cats">
              <button
                v-for="entry in area.categories"
                :key="entry.type"
                type="button"
                :class="{ active: spaceFilter === area.id && categoryFilter === entry.type }"
                @click="selectAreaCategory(area.id, entry.type)"
              >
                <span>{{ entry.label }}</span>
                <small>{{ entry.count }} 项</small>
              </button>
            </div>
          </section>
        </nav>
      </aside>

      <main class="main">
        <div class="main__toolbar">
          <div class="main__cats">
            <button v-for="tab in categoryTabs" :key="tab.value" type="button" :class="{ active: categoryFilter === tab.value }" @click="categoryFilter = tab.value">
              {{ tab.label }} <b>{{ tab.count }}</b>
            </button>
          </div>
          <div class="main__actions">
            <el-button size="small" @click="toggleFullscreen">{{ fullscreen ? '退出全屏' : '全屏' }}</el-button>
            <el-button size="small" @click="areaOpen = !areaOpen">{{ areaOpen ? '收起区域' : '展开区域' }}</el-button>
            <el-button type="primary" size="small" :disabled="!canWrite" @click="openPicker">新增分项</el-button>
          </div>
        </div>

        <div v-if="actionError" class="main__error">
          {{ actionError }} <el-button link type="primary" @click="openPicker(); actionError = ''">重试</el-button>
        </div>

        <EmptyState
          v-if="!rows.length"
          title="还没有模版分项"
          description="从报价项目库选择条目，再为每条填写专业变量公式或固定数量；配置方式与设计工作区的设计项一致。"
          action-text="新增分项"
          @action="openPicker"
        />

        <section v-for="group in groups" :key="group.key" class="group">
          <header class="group__head">
            <div>
              <strong>{{ group.roomName }}</strong>
              <span class="group__pill">{{ group.label }}</span>
              <span>{{ group.rows.length }} 项</span>
            </div>
            <small>模版不展示价格</small>
          </header>
          <div class="group__table-scroll" role="region" tabindex="0" :aria-label="`${group.roomName}${group.label}模版分项表，可横向滚动`">
            <div class="row row--head">
              <span>#</span><span>区域</span><span>报价项目</span><span>单位</span><span>工程量公式 / 固定数量</span><span>计算结果</span><span>状态</span><span>备注</span><span>操作</span>
            </div>
            <div
              v-for="(row, index) in group.rows"
              :key="row.key"
              class="row"
              :class="{ 'is-error': row.status === 'error' || previewOf(row).status === 'error', 'is-editing': editingRowKey === row.key }"
            >
              <span class="cell num">{{ index + 1 }}</span>
              <span class="cell">{{ row.roomKey ? row.roomKey : '全屋共享' }}</span>
              <span class="cell cell--project">
                <strong>{{ row.name }}</strong>
                <small>{{ row.category || DESIGN_ITEM_TYPE_LABELS[row.type] }}</small>
              </span>
              <span class="cell">{{ row.unit || '—' }}</span>
              <span class="cell cell--formula" @click.stop>
                <input
                  v-model="row.quantityFormula"
                  class="cell__formula"
                  :disabled="!canWrite"
                  placeholder="如 =A、=P-DW、=WP"
                  @focus="editingRowKey = row.key"
                  @input="markDirty(row)"
                />
                <input
                  v-if="!row.quantityFormula.trim()"
                  v-model.number="row.defaultQuantity"
                  class="cell__fixed"
                  type="number"
                  min="0"
                  step="0.001"
                  :disabled="!canWrite"
                  placeholder="或固定数量"
                  @focus="editingRowKey = row.key"
                  @input="markDirty(row)"
                />
                <button type="button" class="cell__help" title="打开公式助手" @click="openAssistant(row)">?</button>
              </span>
              <span class="cell cell--result">
                <b>{{ previewText(row) }}</b>
                <small v-if="previewOf(row).status === 'missing'">缺 {{ previewOf(row).missingVariables.join('、') || '尺寸' }}</small>
              </span>
              <span class="cell">
                <i class="state" :class="`state--${stateOf(row).tone}`">{{ stateOf(row).label }}</i>
              </span>
              <span class="cell">
                <input v-model="row.remark" class="cell__remark" :disabled="!canWrite" placeholder="备注（可选）" @input="markDirty(row)" />
              </span>
              <span class="cell cell--actions">
                <el-button v-if="canWrite" link type="danger" size="small" @click="removeRow(row)">删除</el-button>
              </span>
              <p v-if="errorOf(row)" class="row__error">{{ errorOf(row) }}</p>
            </div>
          </div>
        </section>

        <div v-if="rows.length && !groups.length" class="main__empty-filter">
          当前筛选下没有分项。 <el-button link type="primary" @click="selectArea('all')">查看全部分组</el-button>
        </div>
      </main>
    </div>

    <DesignCatalogPicker
      v-model="pickerVisible"
      :catalog-items="catalogItems"
      :areas="pickerAreas"
      :loading="catalogLoading"
      :fullscreen="fullscreen"
      :default-space-id="spaceFilter === 'all' ? '' : spaceFilter"
      @add="onPickCatalog"
    />

    <DesignTemplateFormulaAssistant
      v-if="assistantRow"
      v-model="assistantVisible"
      :item-name="assistantRow.name"
      :unit="assistantRow.unit"
      :formula="assistantRow.quantityFormula"
      :room="assistantRoom"
      :rooms="props.rooms"
      :item-type="assistantRow.type"
      :fullscreen="fullscreen"
      @insert="onInsertFormula"
    />
  </section>
</template>

<style scoped lang="scss">
.tmpl-sheet { display: flex; flex-direction: column; gap: $space-3; }
.tmpl-sheet.is-fullscreen { padding: $space-4; background: $surface-0; overflow: auto; }
.tmpl-sheet__head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-4; padding: $space-4; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; box-shadow: $shadow-card; }
.tmpl-sheet__head h3 { margin: $space-1 0; font-size: $font-title; }
.tmpl-sheet__head p { margin: 0; max-width: 760px; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.tmpl-sheet__eyebrow { color: $brand-600; font-size: $font-caption; font-weight: $font-weight-semibold; letter-spacing: .08em; }
.tmpl-sheet__summary { display: flex; flex-wrap: wrap; align-items: center; gap: $space-2; color: $text-secondary; font-size: $font-caption; }
.tmpl-sheet__summary b { color: $ink-950; font-variant-numeric: tabular-nums; }
.tmpl-sheet__summary .is-ready b { color: $success-500; }
.tmpl-sheet__summary .is-warning b { color: $warning-700; }
.tmpl-sheet__summary .is-danger b { color: $danger-500; }
.tmpl-sheet__summary em { color: $text-tertiary; font-style: normal; }
.tmpl-sheet__body { display: grid; grid-template-columns: 244px minmax(0, 1fr); gap: $space-3; align-items: start; }
.tmpl-sheet__body.is-area-hidden { grid-template-columns: minmax(0, 1fr); }
.rail { overflow: hidden; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; }
.rail__head { display: flex; align-items: baseline; justify-content: space-between; padding: $space-3; background: $surface-50; border-bottom: 1px solid $border-color; }
.rail__head span { font-size: $font-body-sm; font-weight: $font-weight-semibold; }
.rail__head small { color: $text-tertiary; font-size: $font-caption; }
.rail__list { max-height: 680px; overflow-y: auto; padding: $space-2; }
.rail__all, .rail__area-head, .rail__cats button { display: flex; align-items: center; justify-content: space-between; gap: $space-2; width: 100%; padding: 6px $space-2; text-align: left; background: transparent; border: 0; border-radius: $radius-xs; cursor: pointer; }
.rail__all span, .rail__area-head span, .rail__cats span { color: $ink-800; font-size: $font-caption; }
.rail__all b, .rail__area-head b { color: $text-secondary; font-size: $font-caption; font-variant-numeric: tabular-nums; }
.rail__all.active, .rail__area-head.active, .rail__cats button.active { background: $brand-50; }
.rail__all.active span, .rail__area-head.active span, .rail__cats button.active span { color: $brand-700; font-weight: $font-weight-semibold; }
.rail__area { margin-top: $space-1; }
.rail__cats { padding-left: $space-3; }
.rail__cats small { color: $text-tertiary; font-size: $font-caption; }
.main { display: flex; flex-direction: column; gap: $space-3; min-width: 0; }
.main__toolbar { display: flex; align-items: center; justify-content: space-between; gap: $space-3; }
.main__cats { display: flex; flex-wrap: wrap; gap: $space-1; }
.main__cats button { padding: 4px 10px; color: $text-secondary; background: $surface-50; border: 1px solid $border-color; border-radius: $radius-pill; font-size: $font-caption; cursor: pointer; }
.main__cats button.active { color: $brand-700; background: $brand-50; border-color: $brand-500; font-weight: $font-weight-semibold; }
.main__actions { display: flex; gap: $space-2; }
.main__error { padding: $space-2 $space-3; color: $danger-500; background: $danger-50; border: 1px solid $danger-200; border-radius: $radius-sm; font-size: $font-caption; }
.main__empty-filter { padding: $space-6; color: $text-secondary; text-align: center; font-size: $font-caption; }
.group { overflow: hidden; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; }
.group__head { display: flex; align-items: center; justify-content: space-between; gap: $space-2; padding: $space-2 $space-3; background: $surface-50; border-bottom: 1px solid $border-color; }
.group__head div { display: flex; align-items: baseline; gap: $space-2; }
.group__head strong { font-size: $font-body-sm; }
.group__head span { color: $text-secondary; font-size: $font-caption; }
.group__head small { color: $text-tertiary; font-size: $font-caption; }
.group__pill { padding: 1px 8px; color: $brand-700 !important; background: $brand-50; border-radius: $radius-pill; }
.group__table-scroll { max-width: 100%; overflow-x: auto; overflow-y: hidden; overscroll-behavior-x: contain; scrollbar-gutter: stable; }
.group__table-scroll:focus-visible { outline: 2px solid $brand-500; outline-offset: -2px; }
.row { display: grid; grid-template-columns: 36px 92px minmax(170px, 1.4fr) 52px minmax(220px, 1.6fr) 110px 88px minmax(110px, .9fr) 72px; align-items: center; gap: $space-2; width: 100%; min-width: 1080px; box-sizing: border-box; padding: $space-2 $space-3; border-bottom: 1px solid $border-color; font-size: $font-caption; }
.row:last-child { border-bottom: 0; }
.row--head { background: $surface-0; color: $text-secondary; font-weight: $font-weight-semibold; }
.row.is-editing { background: $brand-50; }
.row.is-error { background: $danger-50; }
.cell { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell.num { text-align: right; }
.cell--project { display: flex; flex-direction: column; gap: 2px; }
.cell--project strong { overflow: hidden; color: $ink-950; text-overflow: ellipsis; white-space: nowrap; }
.cell--project small { color: $text-secondary; }
.cell--formula { display: flex; align-items: center; gap: $space-1; overflow: visible; }
.cell__formula, .cell__fixed, .cell__remark { min-width: 0; padding: 4px 6px; color: $ink-800; background: $surface-0; border: 1px solid $border-color; border-radius: $radius-xs; font-size: $font-caption; }
.cell__formula { flex: 1; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.cell__fixed { width: 96px; }
.cell__remark { width: 100%; }
.cell__help { flex: 0 0 auto; width: 24px; height: 24px; color: $brand-700; background: $brand-50; border: 1px solid $brand-200; border-radius: $radius-pill; font-weight: $font-weight-semibold; cursor: pointer; }
.cell--result { display: flex; flex-direction: column; gap: 2px; }
.cell--result b { color: $ink-950; font-variant-numeric: tabular-nums; }
.cell--result small { color: $warning-700; }
.cell--actions { display: flex; justify-content: flex-end; }
.state { display: inline-flex; align-items: center; padding: 1px 7px; border-radius: $radius-pill; font-size: $font-caption; font-style: normal; }
.state--done { color: $success-500; background: $success-50; }
.state--doing { color: $status-progress; background: $status-progress-soft; }
.state--warning { color: $warning-700; background: $warning-50; }
.state--danger { color: $danger-500; background: $danger-50; }
.state--muted { color: $text-secondary; background: $surface-50; }
.row__error { grid-column: 1 / -1; margin: 0; color: $danger-500; font-size: $font-caption; }
@media (max-width: 1280px) {
  .tmpl-sheet__body { grid-template-columns: 220px minmax(0, 1fr); }
  .row { grid-template-columns: 32px 84px minmax(150px, 1.3fr) 48px minmax(190px, 1.5fr) 100px 82px minmax(100px, .8fr) 68px; min-width: 1020px; }
}
@media (max-width: 1024px) {
  .tmpl-sheet__head { flex-direction: column; }
  .tmpl-sheet__body { grid-template-columns: minmax(0, 1fr); }
  .rail { max-height: 240px; }
  .rail__list { max-height: 180px; }
}
</style>
