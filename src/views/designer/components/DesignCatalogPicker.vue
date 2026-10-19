<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import { formatMoney } from '@/core/format'
import { DESIGN_ITEM_TYPE_LABELS, DESIGN_ITEM_TYPE_ORDER } from '@/domains/design/meta'
import { catalogApi } from '@/domains/catalog/api'
import type { DesignItemType } from '@/domains/design/model'
import type { CatalogItem } from '@/domains/catalog/model'

interface AreaSummary {
  id: string
  name: string
  count: number
  amount: number
  categories: Array<{ type: DesignItemType; label: string; count: number; amount: number }>
}

const ALL_AREAS = '__all__'

const props = withDefaults(defineProps<{
  modelValue: boolean
  catalogItems: CatalogItem[]
  /** 左侧分组：所有区域 → 报价分类，带现有分项的项数与总额。 */
  areas: AreaSummary[]
  loading?: boolean
  fullscreen?: boolean
  defaultSpaceId?: string
  title?: string
  note?: string
  addLabel?: string
  showSpace?: boolean
}>(), {
  loading: false,
  fullscreen: false,
  defaultSpaceId: '',
  title: '选择报价分项',
  note: '左侧可切换“按分项类型”或“按区域”。类型树按「分项类型 → 品牌 → 系列 → 规格」渐进定位企业报价项目库，右侧填写工程量（0 表示赠送）。多选时按点击顺序编号，添加到方案后也按该顺序落到当前选中行之后（同区域同类型）。',
  addLabel: '添加到方案并继续',
  showSpace: true
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  add: [payload: { spaceId: string; items: Array<{ catalogItemId: string; quantity: number }> }]
}>()

type TreeMode = 'catalog' | 'area'
type CatalogNodeLevel = 'type' | 'brand' | 'series' | 'spec'

interface CatalogFilterNode {
  key: string
  level: CatalogNodeLevel
  label: string
  count: number
  type: DesignItemType
  brand: string
  series: string
  spec: string
  children: CatalogFilterNode[]
}

interface VisibleCatalogNode extends CatalogFilterNode {
  depth: number
  expanded: boolean
  expandable: boolean
}

const keyword = ref('')
const treeMode = ref<TreeMode>('catalog')
const activeArea = ref<string>(ALL_AREAS)
const typeFilter = ref<DesignItemType | ''>('')
const brandFilter = ref('')
const seriesFilter = ref('')
const specFilter = ref('')
const expandedKeys = ref<string[]>([])
const spaceId = ref('')
const selectedIds = ref<string[]>([])
const quantities = reactive<Record<string, number>>({})

const selectedSet = computed(() => new Set(selectedIds.value))
/** 「不选区域」时该项的显示名（调用方不同：设计工作区=综合项目、方案模版=综合项目）。 */
const unassignedAreaName = computed(() => props.areas.find((area) => !area.id)?.name || '综合项目')

const totalCount = computed(() => props.areas.reduce((sum, area) => sum + area.count, 0))
const totalAmount = computed(() => props.areas.reduce((sum, area) => sum + area.amount, 0))

function normalizedKeyword(): string {
  // 后端按连续字符串匹配；去掉用户输入的空格，兼容「q g l g」这种首字母分隔输入。
  return keyword.value.trim().replace(/\s+/g, '')
}

function itemBrand(item: CatalogItem): string {
  return item.brand?.trim() || '未设品牌'
}

function itemSeries(item: CatalogItem): string {
  return item.series?.trim() || '未设系列'
}

function itemSpec(item: CatalogItem): string {
  return item.spec?.trim() || '未设规格'
}

function nodeKey(level: CatalogNodeLevel, type: DesignItemType, brand = '', series = '', spec = ''): string {
  return JSON.stringify([level, type, brand, series, spec])
}

function sortLabel(left: string, right: string): number {
  const leftUnset = left.startsWith('未设') ? 1 : 0
  const rightUnset = right.startsWith('未设') ? 1 : 0
  return leftUnset - rightUnset || left.localeCompare(right, 'zh-CN')
}

function groupItems(items: CatalogItem[], resolve: (item: CatalogItem) => string): Array<[string, CatalogItem[]]> {
  const groups = new Map<string, CatalogItem[]>()
  for (const item of items) {
    const label = resolve(item)
    groups.set(label, [...(groups.get(label) ?? []), item])
  }
  return [...groups.entries()].sort(([left], [right]) => sortLabel(left, right))
}

function buildSpecNodes(items: CatalogItem[], type: DesignItemType, brand: string, series: string): CatalogFilterNode[] {
  return groupItems(items, itemSpec).map(([spec, rows]) => ({
    key: nodeKey('spec', type, brand, series, spec),
    level: 'spec' as const,
    label: spec,
    count: rows.length,
    type,
    brand,
    series,
    spec,
    children: []
  }))
}

function buildSeriesNodes(items: CatalogItem[], type: DesignItemType, brand: string): CatalogFilterNode[] {
  const hasSeries = items.some((item) => Boolean(item.series?.trim()))
  if (!hasSeries) return buildSpecNodes(items, type, brand, '')
  return groupItems(items, itemSeries).map(([series, rows]) => ({
    key: nodeKey('series', type, brand, series),
    level: 'series' as const,
    label: series,
    count: rows.length,
    type,
    brand,
    series,
    spec: '',
    children: buildSpecNodes(rows, type, brand, series)
  }))
}

function buildBrandNodes(items: CatalogItem[], type: DesignItemType): CatalogFilterNode[] {
  return groupItems(items, itemBrand)
    .map(([brand, rows]) => ({
      key: nodeKey('brand', type, brand),
      level: 'brand' as const,
      label: brand,
      count: rows.length,
      type,
      brand,
      series: '',
      spec: '',
      children: buildSeriesNodes(rows, type, brand)
    }))
    // 无品牌且无规格时，“未设品牌”会与类型全选等价，不制造空节点。
    .filter((node) => node.brand !== '未设品牌' || node.children.length > 0)
}

/** 类型树的数据来自当前已加载的完整项目库，节点数量为项目库项目数。 */
const catalogTypeTree = computed<CatalogFilterNode[]>(() =>
  DESIGN_ITEM_TYPE_ORDER
    .map((type) => {
      const rows = props.catalogItems.filter((item) => item.type === type)
      return {
        key: nodeKey('type', type),
        level: 'type' as const,
        label: DESIGN_ITEM_TYPE_LABELS[type],
        count: rows.length,
        type,
        brand: '',
        series: '',
        spec: '',
        children: buildBrandNodes(rows, type)
      }
    })
    .filter((node) => node.count > 0)
)

function isExpanded(key: string): boolean {
  return expandedKeys.value.includes(key)
}

function toggleCatalogNode(node: CatalogFilterNode): void {
  if (!node.children.length) return
  expandedKeys.value = isExpanded(node.key)
    ? expandedKeys.value.filter((key) => key !== node.key)
    : [...expandedKeys.value, node.key]
}

const visibleCatalogNodes = computed<VisibleCatalogNode[]>(() => {
  const result: VisibleCatalogNode[] = []
  const visit = (nodes: CatalogFilterNode[], depth: number): void => {
    for (const node of nodes) {
      const expanded = isExpanded(node.key)
      result.push({ ...node, depth, expanded, expandable: node.children.length > 0 })
      if (expanded && node.children.length) visit(node.children, depth + 1)
    }
  }
  visit(catalogTypeTree.value, 0)
  return result
})

function isCatalogNodeActive(node: CatalogFilterNode): boolean {
  return typeFilter.value === node.type
    && brandFilter.value === node.brand
    && seriesFilter.value === node.series
    && specFilter.value === node.spec
}

function selectCatalogNode(node: CatalogFilterNode): void {
  treeMode.value = 'catalog'
  typeFilter.value = node.type
  brandFilter.value = node.brand
  seriesFilter.value = node.series
  specFilter.value = node.spec
  if (node.children.length && !isExpanded(node.key)) {
    expandedKeys.value = [...expandedKeys.value, node.key]
  }
}

function clearCatalogFilters(): void {
  treeMode.value = 'catalog'
  typeFilter.value = ''
  brandFilter.value = ''
  seriesFilter.value = ''
  specFilter.value = ''
}

function setTreeMode(mode: TreeMode): void {
  treeMode.value = mode
  activeArea.value = props.defaultSpaceId || ALL_AREAS
  typeFilter.value = ''
  brandFilter.value = ''
  seriesFilter.value = ''
  specFilter.value = ''
  spaceId.value = props.defaultSpaceId || ''
}

function backendFilter(value: string): string | undefined {
  return !value || value.startsWith('未设') ? undefined : value
}

function itemMatchesCatalogFilter(item: CatalogItem): boolean {
  if (typeFilter.value && item.type !== typeFilter.value) return false
  if (brandFilter.value && itemBrand(item) !== brandFilter.value) return false
  if (seriesFilter.value && itemSeries(item) !== seriesFilter.value) return false
  if (specFilter.value && itemSpec(item) !== specFilter.value) return false
  return true
}

// 关键词走后端检索：后端 catalog/item/page 的 keyword 命中 name/code/category/brand/series/spec
// 以及 nameInitials（拼音首字母），例如输入 gcglf 可命中「工程管理费」。
const searchResults = ref<CatalogItem[] | null>(null)
const searchError = ref('')
const searching = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | undefined
let searchSeq = 0

const filtered = computed(() => {
  const source = normalizedKeyword() ? (searchResults.value ?? []) : props.catalogItems
  return source.filter(itemMatchesCatalogFilter)
})

async function runSearch(): Promise<void> {
  const kw = normalizedKeyword()
  if (!kw) return
  const seq = ++searchSeq
  const types: DesignItemType[] = typeFilter.value ? [typeFilter.value] : DESIGN_ITEM_TYPE_ORDER
  try {
    const pages = await Promise.all(types.map((type) => catalogApi.pageCatalog({
      type,
      keyword: kw,
      brand: backendFilter(brandFilter.value),
      series: backendFilter(seriesFilter.value),
      spec: backendFilter(specFilter.value),
      size: 100
    })))
    if (seq !== searchSeq) return
    searchResults.value = pages.flat()
    searchError.value = ''
  } catch {
    if (seq !== searchSeq) return
    searchResults.value = []
    searchError.value = '报价项目库暂不可确认，请恢复网络后重试'
  } finally {
    if (seq === searchSeq) searching.value = false
  }
}

watch([keyword, typeFilter, brandFilter, seriesFilter, specFilter], () => {
  if (searchTimer !== undefined) clearTimeout(searchTimer)
  const kw = normalizedKeyword()
  if (!kw) {
    searchResults.value = null
    searchError.value = ''
    searching.value = false
    return
  }
  searching.value = true
  searchTimer = setTimeout(() => { void runSearch() }, 250)
})

onBeforeUnmount(() => {
  if (searchTimer !== undefined) clearTimeout(searchTimer)
})

const selectedCount = computed(() => selectedIds.value.length)

const filterPath = computed(() => {
  if (treeMode.value === 'catalog') {
    const parts: string[] = []
    if (typeFilter.value) parts.push(DESIGN_ITEM_TYPE_LABELS[typeFilter.value])
    if (brandFilter.value) parts.push(brandFilter.value)
    if (seriesFilter.value) parts.push(seriesFilter.value)
    if (specFilter.value) parts.push(specFilter.value)
    return parts.join(' / ') || '全部分项'
  }
  const areaName = activeArea.value === ALL_AREAS
    ? '全部区域'
    : (props.areas.find((area) => area.id === activeArea.value)?.name || '综合项目')
  return typeFilter.value ? `${areaName} / ${DESIGN_ITEM_TYPE_LABELS[typeFilter.value]}` : areaName
})

watch(() => props.modelValue, (visible) => {
  if (!visible) return
  keyword.value = ''
  treeMode.value = 'catalog'
  activeArea.value = props.defaultSpaceId || ALL_AREAS
  typeFilter.value = ''
  brandFilter.value = ''
  seriesFilter.value = ''
  specFilter.value = ''
  expandedKeys.value = []
  spaceId.value = props.defaultSpaceId || ''
  selectedIds.value = []
  searchResults.value = null
  searchError.value = ''
  searching.value = false
  searchSeq += 1
  for (const key of Object.keys(quantities)) delete quantities[key]
})

function selectArea(id: string): void {
  treeMode.value = 'area'
  activeArea.value = id
  typeFilter.value = ''
  brandFilter.value = ''
  seriesFilter.value = ''
  specFilter.value = ''
  spaceId.value = id === ALL_AREAS ? '' : id
}

function selectCategory(areaId: string, type: DesignItemType): void {
  const sameCategory = activeArea.value === areaId && typeFilter.value === type
  treeMode.value = 'area'
  activeArea.value = areaId
  typeFilter.value = sameCategory ? '' : type
  brandFilter.value = ''
  seriesFilter.value = ''
  specFilter.value = ''
  spaceId.value = areaId === ALL_AREAS ? '' : areaId
}

function isSelected(id: string): boolean {
  return selectedSet.value.has(id)
}

function selectedOrder(id: string): number {
  return selectedIds.value.indexOf(id) + 1
}

function toggle(item: CatalogItem): void {
  if (selectedSet.value.has(item.id)) {
    selectedIds.value = selectedIds.value.filter((id) => id !== item.id)
    delete quantities[item.id]
    return
  }
  selectedIds.value = [...selectedIds.value, item.id]
  quantities[item.id] = 1
}

function close(): void {
  emit('update:modelValue', false)
}

function selectedQuantity(id: string): number {
  const value = Number(quantities[id] ?? 1)
  if (!Number.isFinite(value) || value < 0) return 0
  return value
}

function resetSelection(): void {
  selectedIds.value = []
  for (const key of Object.keys(quantities)) delete quantities[key]
}

function addSelected(): void {
  const count = selectedIds.value.length
  if (!count) return
  emit('add', {
    spaceId: spaceId.value,
    items: selectedIds.value.map((id) => ({ catalogItemId: id, quantity: selectedQuantity(id) }))
  })
  resetSelection()
  ElMessage.success(`已添加 ${count} 个分项，弹窗保持打开，可继续选择`)
}

function catalogLine(item: CatalogItem): string {
  return [item.category, item.brand, item.series, item.spec].filter(Boolean).join(' · ') || '—'
}

function unitPrice(item: CatalogItem): string {
  if (item.pricingMode === 'fixedTotal') return `固定总价 ¥${formatMoney((item.materialPrice || 0) + (item.manualPrice || 0))}`
  const parts: string[] = []
  if (item.pricingMode !== 'manualOnly' && item.materialPrice) parts.push(`材料 ¥${formatMoney(item.materialPrice)}`)
  if (item.pricingMode !== 'materialOnly' && item.manualPrice) parts.push(`人工 ¥${formatMoney(item.manualPrice)}`)
  return parts.join(' + ') || '价格待维护'
}
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    :title="title"
    direction="rtl"
    size="960px"
    :append-to-body="!fullscreen"
    :destroy-on-close="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p class="pick__note">{{ note }}</p>
    <div class="pick__body">
      <aside class="pick__rail">
        <div class="pick__modes">
          <button type="button" :class="{ active: treeMode === 'catalog' }" @click="setTreeMode('catalog')">按分项类型</button>
          <button type="button" :class="{ active: treeMode === 'area' }" @click="setTreeMode('area')">按区域</button>
        </div>
        <div class="pick__tree">
          <template v-if="treeMode === 'catalog'">
            <button type="button" class="pick__all" :class="{ active: !typeFilter && !brandFilter && !seriesFilter && !specFilter }" @click="clearCatalogFilters">
              <span>全部分项</span><b>{{ catalogItems.length }}</b><small>按类型 / 品牌 / 规格定位</small>
            </button>
            <div class="pick__type-tree">
              <div
                v-for="node in visibleCatalogNodes"
                :key="node.key"
                class="pick__tree-node"
                :class="{ active: isCatalogNodeActive(node), 'is-parent-active': typeFilter === node.type && node.level === 'type' }"
                :style="{ '--tree-depth': node.depth }"
              >
                <button v-if="node.expandable" type="button" class="pick__tree-toggle" :aria-label="node.expanded ? `收起${node.label}` : `展开${node.label}`" @click.stop="toggleCatalogNode(node)">{{ node.expanded ? '−' : '+' }}</button>
                <span v-else class="pick__tree-spacer" aria-hidden="true"></span>
                <button type="button" class="pick__tree-label" @click="selectCatalogNode(node)">
                  <span>{{ node.label }}</span><small>{{ node.count }} 项</small>
                </button>
              </div>
            </div>
          </template>

          <template v-else>
            <button type="button" class="pick__all" :class="{ active: activeArea === ALL_AREAS && !typeFilter }" @click="selectArea(ALL_AREAS)">
              <span>全部区域</span><b>{{ totalCount }}</b><small>¥{{ formatMoney(totalAmount) }}</small>
            </button>
            <section v-for="area in areas" :key="area.id || 'unassigned'" class="pick__group">
              <button type="button" :class="{ active: activeArea === area.id && !typeFilter }" @click="selectArea(area.id)">
                <span>{{ area.name }}</span><b>{{ area.count }} 项</b><small>¥{{ formatMoney(area.amount) }}</small>
              </button>
              <div v-if="area.categories.length || activeArea === area.id" class="pick__cats">
                <button
                  v-for="cat in area.categories"
                  :key="cat.type"
                  type="button"
                  :class="{ active: activeArea === area.id && typeFilter === cat.type }"
                  @click="selectCategory(area.id, cat.type)"
                >
                  <span>{{ cat.label }}</span><small>{{ cat.count }} 项 · ¥{{ formatMoney(cat.amount) }}</small>
                </button>
                <p v-if="!area.categories.length" class="pick__empty-cat">暂无分项，右侧直接选项目新增</p>
              </div>
            </section>
          </template>
        </div>
      </aside>

      <section class="pick__content">
        <label v-if="showSpace" class="pick__space pick__space--top">
          <span class="pick__space-label">归属区域</span>
          <el-select v-model="spaceId" placeholder="选择归属区域" style="width: 220px">
            <el-option v-for="area in areas" :key="area.id || 'unassigned'" :label="area.name" :value="area.id" />
          </el-select>
          <small v-if="!spaceId && areas.length > 1" class="pick__area-hint">
            区域可选：不选则分项归入「{{ unassignedAreaName }}」；左侧已选中区域时新增会自动归入该区域。<b>不阻断添加</b>。
          </small>
        </label>
        <div class="pick__search">
          <el-input v-model="keyword" clearable placeholder="搜索名称 / 编码 / 拼音首字母 / 品牌 / 规格 / 分类" />
          <span class="pick__crumb">{{ filterPath }}</span>
        </div>
        <div v-loading="loading || searching" class="pick__list">
          <button
            v-for="item in filtered"
            :key="item.id"
            type="button"
            class="pick__row"
            :class="{ 'is-selected': isSelected(item.id) }"
            @click="toggle(item)"
          >
            <span class="pick__check" :class="{ 'is-on': isSelected(item.id) }">{{ isSelected(item.id) ? selectedOrder(item.id) : '' }}</span>
            <span class="pick__info">
              <strong>{{ item.name }}</strong>
              <small>{{ catalogLine(item) }}</small>
            </span>
            <span class="pick__price">
              <span>{{ unitPrice(item) }}</span>
              <small>单位 {{ item.unit }}</small>
            </span>
            <span v-if="isSelected(item.id)" class="pick__qty" @click.stop>
              <el-input-number v-model="quantities[item.id]" :min="0" :precision="3" :step="1" size="small" controls-position="right" />
              <small v-if="selectedQuantity(item.id) === 0">赠送</small>
            </span>
          </button>
          <EmptyState
            v-if="!filtered.length && !loading"
            :title="searchError ? '报价项目暂不可确认' : '没有匹配的报价项目'"
            :description="searchError || '可切换左侧类型树或区域，或调整搜索关键词。'"
          />
        </div>
      </section>
    </div>

    <template #footer>
      <div class="pick__footer">
        <span class="pick__count">本次已选 <b>{{ selectedCount }}</b> 项，按选择顺序添加</span>
        <el-button @click="close">完成</el-button>
        <el-button type="primary" :disabled="!selectedCount" @click="addSelected">{{ addLabel }}</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped lang="scss">
.pick__note { margin: 0 0 $space-3; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.pick__body { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: $space-3; height: calc(100vh - 220px); min-height: 360px; }
.pick__rail { display: flex; flex-direction: column; gap: $space-2; min-height: 0; }
.pick__modes { display: grid; grid-template-columns: 1fr 1fr; gap: $space-1; padding: 3px; background: $surface-100; border: 1px solid $border-color; border-radius: $radius-sm; }
.pick__modes button { padding: 6px $space-2; color: $text-secondary; background: transparent; border: 0; border-radius: $radius-xs; font-size: $font-caption; cursor: pointer; }
.pick__modes button.active { color: $brand-700; background: $surface-0; box-shadow: $shadow-card; font-weight: $font-weight-semibold; }
.pick__tree { min-height: 0; flex: 1; overflow-y: auto; padding: $space-2; background: $surface-50; border: 1px solid $border-color; border-radius: $radius-sm; }
.pick__type-tree { display: flex; flex-direction: column; gap: 2px; margin-top: $space-2; }
.pick__tree-node { display: grid; grid-template-columns: 18px minmax(0, 1fr); align-items: center; padding-left: calc(var(--tree-depth, 0) * 14px); border-radius: $radius-xs; }
.pick__tree-node.active { color: $brand-700; background: $brand-50; }
.pick__tree-node.is-parent-active .pick__tree-label { font-weight: $font-weight-semibold; }
.pick__tree-toggle,
.pick__tree-spacer { display: grid; place-items: center; width: 18px; height: 26px; }
.pick__tree-toggle { padding: 0; color: $text-tertiary; background: transparent; border: 0; font-size: $font-body-sm; cursor: pointer; }
.pick__tree-label { display: flex; align-items: center; justify-content: space-between; gap: $space-2; min-width: 0; padding: 5px 6px; color: $ink-800; text-align: left; background: transparent; border: 0; border-radius: $radius-xs; font-size: $font-caption; cursor: pointer; }
.pick__tree-label:hover { background: $surface-100; }
.pick__tree-label span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pick__tree-label small { flex: 0 0 auto; color: $text-tertiary; font-variant-numeric: tabular-nums; }
.pick__all,
.pick__group > button {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px $space-2;
  width: 100%;
  padding: $space-2 $space-3;
  color: $ink-800;
  text-align: left;
  background: $surface-0;
  border: 1px solid $border-color;
  border-radius: $radius-xs;
  font-size: $font-body-sm;
  cursor: pointer;
}
.pick__all span,
.pick__group > button span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pick__all b,
.pick__group > button b { color: $ink-950; font-size: $font-caption; font-variant-numeric: tabular-nums; }
.pick__all small,
.pick__group > button small { grid-column: 1 / -1; color: $text-tertiary; font-size: $font-caption; }
.pick__all.active,
.pick__group > button.active { color: $brand-700; background: $brand-50; border-color: $brand-500; }
.pick__group { margin-top: $space-2; }
.pick__cats { display: flex; flex-direction: column; gap: 2px; margin: 4px 0 0 $space-3; padding-left: $space-2; border-left: 2px solid $border-color; }
.pick__cats button { display: flex; align-items: baseline; justify-content: space-between; gap: $space-2; padding: 4px $space-2; color: $text-secondary; background: transparent; border: 0; border-radius: $radius-xs; font-size: $font-caption; text-align: left; cursor: pointer; }
.pick__cats button.active { color: $brand-700; background: $brand-50; font-weight: $font-weight-semibold; }
.pick__cats small { color: $text-tertiary; white-space: nowrap; font-variant-numeric: tabular-nums; }
.pick__empty-cat { margin: 2px 0 0; color: $text-tertiary; font-size: $font-caption; }
.pick__content { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.pick__search { display: flex; align-items: center; gap: $space-3; margin-bottom: $space-2; }
.pick__search .el-input { flex: 1; }
.pick__crumb { flex: 0 0 auto; color: $text-secondary; font-size: $font-caption; }
.pick__list { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: $space-1; padding-right: 4px; }
.pick__row { display: grid; grid-template-columns: 26px minmax(0, 1.6fr) minmax(170px, 1fr) 120px; align-items: center; gap: $space-2; padding: $space-2 $space-3; text-align: left; background: $surface-0; border: 1px solid $border-color; border-radius: $radius-sm; cursor: pointer; }
.pick__row:hover { border-color: $brand-300; background: $surface-50; }
.pick__row.is-selected { border-color: $brand-500; background: $brand-50; }
.pick__check { display: grid; place-items: center; width: 24px; height: 20px; color: $surface-0; background: $surface-0; border: 1px solid $border-color; border-radius: $radius-xs; font-size: 12px; font-variant-numeric: tabular-nums; }
.pick__check.is-on { background: $brand-600; border-color: $brand-600; }
.pick__info { display: flex; flex-direction: column; min-width: 0; }
.pick__info strong { overflow: hidden; color: $ink-950; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
.pick__info small { margin-top: 3px; overflow: hidden; color: $text-secondary; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; }
.pick__price { display: flex; flex-direction: column; gap: 3px; }
.pick__price span { color: $ink-800; font-size: $font-caption; font-variant-numeric: tabular-nums; }
.pick__price small { color: $text-tertiary; font-size: $font-caption; }
.pick__qty { display: flex; align-items: center; justify-content: flex-end; gap: $space-1; justify-self: end; }
.pick__qty small { color: $brand-700; font-size: $font-caption; white-space: nowrap; }
.pick__footer { display: flex; align-items: center; justify-content: flex-end; gap: $space-3; }
.pick__space { display: flex; align-items: center; gap: $space-2; margin-right: auto; color: $text-secondary; font-size: $font-caption; }
.pick__space--top { display: flex; align-items: center; gap: $space-2; margin-bottom: $space-2; padding: $space-2 $space-3; background: $surface-50; border: 1px solid $border-color; border-radius: $radius-sm; }
.pick__space-label { color: $ink-800; font-size: $font-body-sm; font-weight: $font-weight-semibold; }
.pick__area-hint { color: $text-secondary; font-size: $font-caption; line-height: 1.4; }
.pick__area-hint b { color: $brand-700; font-weight: $font-weight-semibold; }
.pick__count { color: $text-secondary; font-size: $font-caption; }
.pick__count b { color: $brand-700; font-variant-numeric: tabular-nums; }
@media (max-width: 1024px) {
  .pick__body { grid-template-columns: 220px minmax(0, 1fr); }
}
</style>
