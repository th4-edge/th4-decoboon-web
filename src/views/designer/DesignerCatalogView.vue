<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '@/components/EmptyState.vue'
import MoneyText from '@/components/MoneyText.vue'
import { formatMoney } from '@/core/format'
import { catalogApi } from '@/domains/catalog/api'
import { fileApi } from '@/domains/file/api'
import type { CatalogItem, CatalogTree } from '@/domains/catalog/model'
import { DESIGN_ITEM_TYPE_LABELS, DESIGN_ITEM_TYPE_ORDER, PRICING_MODE_LABELS } from '@/domains/design/meta'
import type { DesignItemType } from '@/domains/design/model'
import CatalogItemDetail from './components/CatalogItemDetail.vue'

const COMPACT_DETAIL_QUERY = '(max-width: 1399px)'
const PAGE_SIZE = 30

const route = useRoute()
const router = useRouter()

function queryString(key: string): string {
  const value = route.query[key]
  return typeof value === 'string' ? value : ''
}

function parseType(value: string): DesignItemType {
  return DESIGN_ITEM_TYPE_ORDER.includes(value as DesignItemType) ? value as DesignItemType : 'construction'
}

function positiveInt(value: string, fallback = 1): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

const activeType = ref<DesignItemType>(parseType(queryString('type')))
const filters = reactive({
  category: queryString('category'),
  brand: queryString('brand'),
  series: queryString('series'),
  spec: queryString('spec'),
  keyword: queryString('keyword')
})
const currentPage = ref(positiveInt(queryString('page')))
const items = ref<CatalogItem[]>([])
const tree = ref<CatalogTree | null>(null)
const selectedId = ref('')
const loading = ref(false)
const loadingTree = ref(false)
const itemsError = ref('')
const treeError = ref('')
const resultTotal = ref(0)
const resultPages = ref(1)
const compactDetail = ref(false)
const detailOpen = ref(false)
const detailImages = ref<string[]>([])
const detailImagesLoading = ref(false)
const detailImagesError = ref('')
const listRef = ref<HTMLElement | null>(null)
let itemsRequestSeq = 0
let treeRequestSeq = 0
let detailMedia: MediaQueryList | undefined
let detailImageRequestSeq = 0

const selectedItem = computed(() => items.value.find((item) => item.id === selectedId.value) ?? items.value[0] ?? null)
const categoryOptions = computed(() => tree.value?.categories ?? [])
const brandOptions = computed(() => {
  const category = filters.category
  if (!category || !tree.value) return []
  return uniqueSorted(tree.value.brands[category] ?? [])
})
const seriesOptions = computed(() => {
  const { category, brand } = filters
  if (!category || !brand || !tree.value) return []
  return uniqueSorted(tree.value.seriesByBrand[category]?.[brand] ?? [])
})
const specOptions = computed(() => {
  const { category, brand, series } = filters
  if (!category || !tree.value) return []
  if (brand && series) return uniqueSorted(tree.value.specsBySeries[category]?.[brand]?.[series] ?? [])
  if (brand) {
    const bySeries = tree.value.specsBySeries[category]?.[brand] ?? {}
    return uniqueSorted(Object.values(bySeries).flat())
  }
  return uniqueSorted(tree.value.specs[category] ?? [])
})
const activeTypeLabel = computed(() => DESIGN_ITEM_TYPE_LABELS[activeType.value])
const hasActiveFilters = computed(() =>
  Boolean(filters.category || filters.brand || filters.series || filters.spec || filters.keyword.trim())
)
const filterChips = computed(() => {
  const chips: Array<{ key: keyof typeof filters; label: string }> = []
  if (filters.category) chips.push({ key: 'category', label: `分类：${filters.category}` })
  if (filters.brand) chips.push({ key: 'brand', label: `品牌：${filters.brand}` })
  if (filters.series) chips.push({ key: 'series', label: `系列：${filters.series}` })
  if (filters.spec) chips.push({ key: 'spec', label: `规格：${filters.spec}` })
  if (filters.keyword.trim()) chips.push({ key: 'keyword', label: `关键词：${filters.keyword.trim()}` })
  return chips
})
const pageLabel = computed(() => {
  if (itemsError.value) return '结果暂不可确认'
  if (loading.value) return '正在读取报价项目库'
  return `第 ${currentPage.value} 页 · 共 ${resultTotal.value} 个项目`
})

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, 'zh-CN'))
}

function salesPrice(item: CatalogItem): number | null {
  if (item.pricingMode === 'fixedTotal') return item.fixedTotalPrice ?? item.materialPrice + item.manualPrice
  if (item.pricingMode === 'materialOnly') return item.materialPrice
  if (item.pricingMode === 'manualOnly') return item.manualPrice
  return item.materialPrice + item.manualPrice
}

function listPriceHint(item: CatalogItem): string {
  if (item.pricingMode === 'fixedTotal') {
    return item.fixedTotalPrice === undefined
      ? `固定总价（历史兼容）¥${formatMoney(item.materialPrice + item.manualPrice)}`
      : `固定总价 ¥${formatMoney(item.fixedTotalPrice)}`
  }
  if (item.pricingMode === 'materialOnly') return `材料价 ¥${formatMoney(item.materialPrice)}`
  if (item.pricingMode === 'manualOnly') return `人工价 ¥${formatMoney(item.manualPrice)}`
  return `材料 ¥${formatMoney(item.materialPrice)} + 人工 ¥${formatMoney(item.manualPrice)}`
}

function itemContext(item: CatalogItem): string {
  return [item.category, item.brand, item.series, item.spec].filter(Boolean).join(' · ') || '分类与规格未维护'
}

function syncQuery(): void {
  const query: Record<string, string> = { type: activeType.value }
  if (filters.category) query.category = filters.category
  if (filters.brand) query.brand = filters.brand
  if (filters.series) query.series = filters.series
  if (filters.spec) query.spec = filters.spec
  if (filters.keyword.trim()) query.keyword = filters.keyword.trim()
  if (currentPage.value > 1) query.page = String(currentPage.value)
  void router.replace({ query })
}

function ensureFiltersBelongToTree(): void {
  if (!tree.value) return
  const validCategory = !filters.category || tree.value.categories.includes(filters.category)
  if (!validCategory) {
    filters.category = ''
    filters.brand = ''
    filters.series = ''
    filters.spec = ''
    return
  }
  if (filters.category) {
    if (filters.brand && !(tree.value.brands[filters.category] ?? []).includes(filters.brand)) {
      filters.brand = ''
      filters.series = ''
      filters.spec = ''
    }
    if (filters.brand && filters.series && !(tree.value.seriesByBrand[filters.category]?.[filters.brand] ?? []).includes(filters.series)) {
      filters.series = ''
      filters.spec = ''
    }
  }
}

async function loadTree(): Promise<void> {
  const seq = ++treeRequestSeq
  const type = activeType.value
  loadingTree.value = true
  treeError.value = ''
  try {
    const result = await catalogApi.catalogTree(type)
    if (seq !== treeRequestSeq || type !== activeType.value) return
    tree.value = result
    ensureFiltersBelongToTree()
    syncQuery()
  } catch (error) {
    if (seq !== treeRequestSeq || type !== activeType.value) return
    tree.value = null
    treeError.value = error instanceof Error ? error.message : '筛选条件暂不可确认，仍可使用关键词搜索'
  } finally {
    if (seq === treeRequestSeq) loadingTree.value = false
  }
}

async function loadItems(): Promise<void> {
  const seq = ++itemsRequestSeq
  loading.value = true
  itemsError.value = ''
  items.value = []
  selectedId.value = ''
  resultTotal.value = 0
  resultPages.value = 1
  try {
    const result = await catalogApi.pageCatalogResult({
      type: activeType.value,
      category: filters.category || undefined,
      brand: filters.brand || undefined,
      series: filters.series || undefined,
      spec: filters.spec || undefined,
      keyword: filters.keyword.trim() || undefined,
      current: currentPage.value,
      size: PAGE_SIZE
    })
    if (seq !== itemsRequestSeq) return
    items.value = result.items
    resultTotal.value = result.total
    resultPages.value = result.pages
    currentPage.value = result.current
    selectedId.value = result.items[0]?.id ?? ''
    syncQuery()
  } catch (error) {
    if (seq !== itemsRequestSeq) return
    items.value = []
    selectedId.value = ''
    itemsError.value = error instanceof Error ? error.message : '报价项目库暂不可确认，请恢复网络后重试'
  } finally {
    if (seq === itemsRequestSeq) loading.value = false
  }
}

async function reloadFromFirstPage(): Promise<void> {
  currentPage.value = 1
  syncQuery()
  await loadItems()
}

async function changeType(type: DesignItemType): Promise<void> {
  if (type === activeType.value) return
  activeType.value = type
  filters.category = ''
  filters.brand = ''
  filters.series = ''
  filters.spec = ''
  filters.keyword = ''
  currentPage.value = 1
  syncQuery()
  await loadTree()
  await loadItems()
}

async function selectCategory(category: string): Promise<void> {
  filters.category = category
  filters.brand = ''
  filters.series = ''
  filters.spec = ''
  await reloadFromFirstPage()
}

async function changeBrand(): Promise<void> {
  filters.series = ''
  filters.spec = ''
  await reloadFromFirstPage()
}

async function changeSeries(): Promise<void> {
  filters.spec = ''
  await reloadFromFirstPage()
}

async function resetFilters(): Promise<void> {
  filters.category = ''
  filters.brand = ''
  filters.series = ''
  filters.spec = ''
  filters.keyword = ''
  await reloadFromFirstPage()
}

async function removeFilter(key: keyof typeof filters): Promise<void> {
  filters[key] = ''
  if (key === 'category') {
    filters.brand = ''
    filters.series = ''
    filters.spec = ''
  }
  if (key === 'brand') {
    filters.series = ''
    filters.spec = ''
  }
  if (key === 'series') filters.spec = ''
  await reloadFromFirstPage()
}

async function loadDetailImages(item: CatalogItem | null): Promise<void> {
  const seq = ++detailImageRequestSeq
  detailImages.value = []
  detailImagesError.value = ''
  if (!item || !item.images.length) {
    detailImagesLoading.value = false
    return
  }
  detailImagesLoading.value = true
  try {
    const urls = await fileApi.grantFiles('Catalog', item.id, item.images)
    if (seq !== detailImageRequestSeq) return
    detailImages.value = urls
  } catch {
    if (seq !== detailImageRequestSeq) return
    detailImagesError.value = '效果图片暂不可确认，请稍后重试'
  } finally {
    if (seq === detailImageRequestSeq) detailImagesLoading.value = false
  }
}

async function changePage(page: number): Promise<void> {
  currentPage.value = page
  syncQuery()
  await loadItems()
  await nextTick()
  listRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function retryTree(): Promise<void> {
  await loadTree()
  await loadItems()
}

function selectItem(item: CatalogItem): void {
  selectedId.value = item.id
  if (compactDetail.value) detailOpen.value = true
}

function handleDetailBreakpoint(event: MediaQueryListEvent): void {
  compactDetail.value = event.matches
  if (!event.matches) detailOpen.value = false
}

watch(selectedItem, (item) => {
  void loadDetailImages(item)
}, { immediate: true })

onMounted(async () => {
  detailMedia = window.matchMedia(COMPACT_DETAIL_QUERY)
  compactDetail.value = detailMedia.matches
  detailMedia.addEventListener('change', handleDetailBreakpoint)
  await loadTree()
  await loadItems()
})

onBeforeUnmount(() => {
  itemsRequestSeq += 1
  treeRequestSeq += 1
  detailImageRequestSeq += 1
  detailMedia?.removeEventListener('change', handleDetailBreakpoint)
})
</script>

<template>
  <div class="catalog">
    <header class="catalog__header">
      <div>
        <p class="catalog__eyebrow">设计师报价工具</p>
        <h2>报价项目库</h2>
        <p>按类型、分类和品牌规格快速定位报价分项，查看计价方式、工艺标准、验收标准和效果图片。</p>
      </div>
    </header>

    <div v-if="treeError" class="catalog__partial" role="status">
      <div>
        <strong>筛选条件暂不可确认</strong>
        <span>{{ treeError }}</span>
      </div>
      <el-button text @click="retryTree">重新加载筛选</el-button>
    </div>

    <section class="catalog__shell">
      <aside class="catalog__rail" aria-label="报价项目库导航">
        <section class="rail__section">
          <div class="rail__heading">
            <span>项目类型</span>
            <small>{{ activeTypeLabel }}</small>
          </div>
          <nav class="type-list">
            <button
              v-for="type in DESIGN_ITEM_TYPE_ORDER"
              :key="type"
              type="button"
              :class="{ active: activeType === type }"
              :aria-pressed="activeType === type"
              @click="changeType(type)"
            >
              {{ DESIGN_ITEM_TYPE_LABELS[type] }}
            </button>
          </nav>
        </section>

        <section class="rail__section rail__section--grow">
          <div class="rail__heading">
            <span>项目分类</span>
            <small>{{ categoryOptions.length ? `${categoryOptions.length} 类` : '待读取' }}</small>
          </div>
          <nav class="category-list" aria-label="项目分类">
            <button
              type="button"
              :class="{ active: !filters.category }"
              :aria-pressed="!filters.category"
              @click="selectCategory('')"
            >
              <span>全部分类</span>
              <small v-if="tree && activeType">{{ tree.total }} 项</small>
            </button>
            <button
              v-for="category in categoryOptions"
              :key="category"
              type="button"
              :class="{ active: filters.category === category }"
              :aria-pressed="filters.category === category"
              @click="selectCategory(category)"
            >
              <span>{{ category }}</span>
            </button>
          </nav>
          <p v-if="treeError" class="rail__error">分类导航暂不可确认</p>
        </section>

        <div class="rail__note">
          <strong>检索范围</strong>
          <p>先选项目类型和分类，再按品牌、系列、规格逐级缩小范围。</p>
        </div>
      </aside>

      <main class="catalog__results">
        <form class="catalog__search" role="search" @submit.prevent="reloadFromFirstPage">
          <label class="sr-only" for="catalog-keyword">搜索报价分项</label>
          <el-input
            id="catalog-keyword"
            v-model="filters.keyword"
            clearable
            placeholder="搜索名称、编码、品牌、规格或拼音首字母"
            @keyup.enter="reloadFromFirstPage"
            @clear="reloadFromFirstPage"
          />
          <el-button native-type="submit" type="primary" :loading="loading">搜索</el-button>
        </form>

        <div class="catalog__filters" aria-label="报价分项筛选">
          <el-select
            v-model="filters.brand"
            clearable
            filterable
            :disabled="!filters.category || loadingTree || !brandOptions.length"
            :placeholder="!filters.category ? '先选分类' : brandOptions.length ? '全部品牌' : '无品牌数据'"
            aria-label="品牌"
            @change="changeBrand"
          >
            <el-option v-for="brand in brandOptions" :key="brand" :label="brand" :value="brand" />
          </el-select>
          <el-select
            v-model="filters.series"
            clearable
            filterable
            :disabled="!filters.category || !filters.brand || loadingTree || !seriesOptions.length"
            :placeholder="!filters.brand ? '先选品牌' : seriesOptions.length ? '全部系列' : '无系列数据'"
            aria-label="系列"
            @change="changeSeries"
          >
            <el-option v-for="series in seriesOptions" :key="series" :label="series" :value="series" />
          </el-select>
          <el-select
            v-model="filters.spec"
            clearable
            filterable
            :disabled="!filters.category || loadingTree || !specOptions.length"
            :placeholder="!filters.category ? '先选分类' : specOptions.length ? '全部规格' : '无规格数据'"
            aria-label="规格"
            @change="reloadFromFirstPage"
          >
            <el-option v-for="spec in specOptions" :key="spec" :label="spec" :value="spec" />
          </el-select>
          <el-button :disabled="!hasActiveFilters && currentPage === 1" @click="resetFilters">重置筛选</el-button>
        </div>

        <div class="catalog__summary">
          <div>
            <template v-if="!itemsError && !loading">
              <strong>{{ resultTotal }}</strong>
              <span>个报价分项</span>
            </template>
            <span v-else>{{ pageLabel }}</span>
          </div>
          <p v-if="!itemsError">
            {{ activeTypeLabel }}
            <template v-if="filters.category"> · {{ filters.category }}</template>
            <template v-if="resultPages > 1"> · 第 {{ currentPage }} / {{ resultPages }} 页</template>
          </p>
          <ul v-if="filterChips.length" class="filter-chips" aria-label="已应用筛选">
            <li v-for="chip in filterChips" :key="chip.key">
              <span>{{ chip.label }}</span>
              <button type="button" @click="removeFilter(chip.key)">移除</button>
            </li>
          </ul>
        </div>

        <div ref="listRef" class="catalog__list-region">
          <EmptyState
            v-if="itemsError"
            title="报价项目库暂不可确认"
            :description="itemsError"
            action-text="重新加载"
            @action="loadItems"
          />
          <div v-else-if="loading" class="catalog__skeleton" aria-label="正在读取报价项目库">
            <el-skeleton :rows="8" animated />
          </div>
          <EmptyState
            v-else-if="!items.length"
            title="没有匹配的报价分项"
            description="当前类型和筛选条件下没有项目，可移除部分筛选或切换项目类型后重试。"
            action-text="重置筛选"
            @action="resetFilters"
          />
          <template v-else>
            <div class="catalog-list" role="table" aria-label="报价项目列表">
              <div class="catalog-row catalog-row--head" role="row">
                <span role="columnheader">报价分项</span>
                <span role="columnheader">单位</span>
                <span role="columnheader">销售单价</span>
                <span role="columnheader">计价方式</span>
              </div>
              <button
                v-for="item in items"
                :key="item.id"
                type="button"
                role="row"
                class="catalog-row"
                :class="{ active: selectedItem?.id === item.id }"
                :aria-selected="selectedItem?.id === item.id"
                @click="selectItem(item)"
              >
                <span class="catalog-row__item" role="cell">
                  <strong :title="item.name">{{ item.name }}</strong>
                  <small :title="itemContext(item)">{{ itemContext(item) }}</small>
                  <em>{{ item.code || '编码未维护' }}</em>
                </span>
                <span role="cell">{{ item.unit || '未维护' }}</span>
                <span class="catalog-row__price" role="cell">
                  <MoneyText :value="salesPrice(item)" />
                  <small :title="listPriceHint(item)">{{ listPriceHint(item) }}</small>
                </span>
                <span role="cell">{{ PRICING_MODE_LABELS[item.pricingMode] }}</span>
              </button>
            </div>
            <div class="catalog__pagination">
              <el-pagination
                background
                layout="prev, pager, next"
                :current-page="currentPage"
                :page-size="PAGE_SIZE"
                :total="resultTotal"
                @current-change="changePage"
              />
            </div>
          </template>
        </div>
      </main>

      <aside v-if="!compactDetail" class="catalog__detail" aria-live="polite">
        <CatalogItemDetail
        v-if="selectedItem"
        :item="selectedItem"
        :images="detailImages"
        :images-loading="detailImagesLoading"
        :images-error="detailImagesError"
      />
        <EmptyState v-else title="请选择报价分项" description="从列表选择后查看计价方式、工艺标准、验收标准和效果图片。" />
      </aside>
    </section>

    <el-drawer
      v-if="compactDetail"
      v-model="detailOpen"
      direction="rtl"
      size="440px"
      :with-header="false"
      class="catalog-drawer"
    >
      <div class="catalog-drawer__head">
        <strong>报价分项详情</strong>
        <button type="button" @click="detailOpen = false">关闭</button>
      </div>
      <CatalogItemDetail
        v-if="selectedItem"
        :item="selectedItem"
        :images="detailImages"
        :images-loading="detailImagesLoading"
        :images-error="detailImagesError"
      />
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.catalog {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: $space-5;
}

.catalog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-8;

  h2 {
    margin: $space-1 0 $space-2;
    color: $text-primary;
    font-size: $font-display;
  }

  > div:first-child > p:last-child {
    max-width: 720px;
    margin: 0;
    color: $text-secondary;
    font-size: $font-body-sm;
    line-height: 1.7;
  }
}

.catalog__eyebrow {
  margin: 0;
  color: $brand-600;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
  letter-spacing: .08em;
}


.catalog__partial {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-4;
  padding: $space-3 $space-4;
  border: 1px solid $warning-200;
  border-radius: $radius-md;
  background: $warning-50;

  strong,
  span {
    display: block;
  }

  strong {
    color: $warning-700;
    font-size: $font-body-sm;
  }

  span {
    margin-top: 2px;
    color: $text-secondary;
    font-size: $font-caption;
  }
}

.catalog__shell {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr) 320px;
  gap: $space-4;
  align-items: start;
  min-width: 0;
}

.catalog__rail,
.catalog__results,
.catalog__detail {
  min-width: 0;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  box-shadow: $shadow-card;
}

.catalog__rail,
.catalog__detail {
  position: sticky;
  top: calc(#{$topbar-height} + #{$space-4});
  max-height: calc(100vh - #{$topbar-height} - #{$space-8});
  overflow: auto;
}

.catalog__rail {
  display: flex;
  flex-direction: column;
  padding: $space-3;
}

.rail__section {
  padding: $space-2 0 $space-3;

  & + & {
    border-top: 1px solid $border-color;
  }
}

.rail__section--grow {
  min-height: 260px;
}

.rail__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;
  padding: 0 $space-2 $space-2;
  color: $text-primary;
  font-size: $font-body-sm;
  font-weight: $font-weight-semibold;

  small {
    color: $text-tertiary;
    font-size: $font-caption;
    font-weight: $font-weight-regular;
  }
}

.type-list,
.category-list {
  display: grid;
  gap: $space-1;
}

.type-list button,
.category-list button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;
  width: 100%;
  min-height: 38px;
  padding: 0 $space-3;
  border: 1px solid transparent;
  border-radius: $radius-sm;
  color: $text-secondary;
  background: transparent;
  font: inherit;
  font-size: $font-body-sm;
  text-align: left;
  cursor: pointer;
  transition: $transition-fast;

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    flex: 0 0 auto;
    color: $text-tertiary;
    font-size: $font-caption;
  }

  &:hover {
    background: $surface-50;
  }

  &.active {
    border-color: $brand-200;
    color: $brand-700;
    background: $brand-50;
    font-weight: $font-weight-semibold;
  }
}

.type-list button {
  justify-content: flex-start;
}

.category-list {
  max-height: 360px;
  overflow-y: auto;
}

.rail__error {
  margin: $space-2 $space-2 0;
  color: $warning-700;
  font-size: $font-caption;
  line-height: 1.6;
}

.rail__note {
  margin-top: auto;
  padding: $space-3;
  border-radius: $radius-sm;
  background: $surface-50;

  strong {
    display: block;
    color: $text-primary;
    font-size: $font-caption;
  }

  p {
    margin: $space-1 0 0;
    color: $text-secondary;
    font-size: $font-caption;
    line-height: 1.65;
  }
}

.catalog__results {
  overflow: hidden;
}

.catalog__search,
.catalog__filters {
  display: flex;
  gap: $space-2;
  padding: $space-3 $space-4;
}

.catalog__search {
  border-bottom: 1px solid $border-color;

  :deep(.el-input) {
    min-width: 0;
    flex: 1;
  }
}

.catalog__filters {
  flex-wrap: wrap;
  border-bottom: 1px solid $border-color;

  :deep(.el-select) {
    width: 150px;
  }
}

.catalog__summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: $space-2 $space-4;
  min-height: 54px;
  padding: $space-3 $space-4;
  border-bottom: 1px solid $border-color;
  background: $surface-50;

  > div:first-child {
    color: $text-secondary;
    font-size: $font-body-sm;

    strong {
      margin-right: 4px;
      color: $text-primary;
      font-size: $font-title;
      font-variant-numeric: tabular-nums;
    }
  }

  > p {
    margin: 0;
    color: $text-secondary;
    font-size: $font-caption;
  }
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: $space-2;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: inline-flex;
    align-items: center;
    gap: $space-2;
    min-height: 26px;
    padding: 0 4px 0 8px;
    border: 1px solid $border-color;
    border-radius: $radius-pill;
    color: $text-secondary;
    background: $surface-0;
    font-size: $font-caption;
  }

  button {
    min-height: 22px;
    padding: 0 5px;
    border: 0;
    border-radius: $radius-pill;
    color: $brand-700;
    background: transparent;
    font: inherit;
    cursor: pointer;

    &:hover {
      background: $brand-50;
    }
  }
}

.catalog__list-region {
  min-height: 360px;
  scroll-margin-top: calc(#{$topbar-height} + #{$space-4});
}

.catalog__skeleton {
  padding: $space-5;
}

.catalog-list {
  min-width: 0;
  max-height: clamp(360px, calc(100vh - 360px), 680px);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.catalog-row {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) 44px 104px 88px;
  align-items: center;
  gap: $space-2;
  width: 100%;
  min-height: 68px;
  padding: $space-2 $space-3;
  border: 0;
  border-bottom: 1px solid $border-color;
  color: $text-primary;
  background: transparent;
  font: inherit;
  font-size: $font-body-sm;
  text-align: left;
}

button.catalog-row {
  cursor: pointer;
  transition: $transition-fast;

  &:hover {
    background: $surface-50;
  }

  &.active {
    background: $brand-50;
    box-shadow: inset 3px 0 0 $brand-500;
  }
}

.catalog-row--head {
  position: sticky;
  top: 0;
  z-index: 1;
  min-height: 40px;
  padding-top: $space-2;
  padding-bottom: $space-2;
  color: $text-secondary;
  background: $surface-0;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;

  span:nth-child(2) {
    text-align: center;
  }

  span:nth-child(3) {
    text-align: right;
  }

  span:nth-child(4) {
    text-align: right;
  }
}

.catalog-row__item {
  min-width: 0;

  strong,
  small,
  em {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: $text-primary;
    font-size: $font-body-sm;
    font-weight: $font-weight-medium;
  }

  small {
    margin-top: 4px;
    color: $text-secondary;
    font-size: $font-caption;
  }

  em {
    margin-top: 3px;
    color: $text-tertiary;
    font-size: $font-micro;
    font-style: normal;
    font-variant-numeric: tabular-nums;
  }
}

.catalog-row > span:nth-child(2) {
  color: $text-secondary;
  text-align: center;
}

.catalog-row__price {
  min-width: 0;
  text-align: right;

  small {
    display: block;
    margin-top: 4px;
    overflow: hidden;
    color: $text-secondary;
    font-size: $font-micro;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.catalog-row > span:last-child {
  color: $text-secondary;
  text-align: right;
  font-size: $font-caption;
}

.catalog__pagination {
  display: flex;
  justify-content: flex-end;
  padding: $space-3 $space-4;
}

.catalog-drawer__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-4;
  min-height: 56px;
  padding: 0 $space-4;
  border-bottom: 1px solid $border-color;

  strong {
    color: $text-primary;
    font-size: $font-card-title;
  }

  button {
    min-height: 32px;
    padding: 0 $space-3;
    border: 1px solid $border-color;
    border-radius: $radius-sm;
    color: $text-secondary;
    background: $surface-0;
    font: inherit;
    font-size: $font-body-sm;
    cursor: pointer;
  }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 1399px) {
  .catalog__shell {
    grid-template-columns: 180px minmax(0, 1fr);
  }
}

@media (max-width: 1024px) {
  .catalog {
    padding: $space-4;
  }

  .catalog__header {
    flex-direction: column;
    gap: $space-4;
  }


  .catalog__filters :deep(.el-select) {
    width: calc(50% - #{$space-1});
  }
}

@media (max-width: 900px) {
  .catalog__shell {
    grid-template-columns: minmax(0, 1fr);
  }

  .catalog__rail {
    position: static;
    max-height: none;
  }

  .type-list,
  .category-list {
    display: flex;
    gap: $space-2;
    max-height: none;
    overflow-x: auto;
  }

  .type-list button,
  .category-list button {
    width: auto;
    flex: 0 0 auto;
  }

  .rail__note {
    display: none;
  }
}

@media (max-width: 720px) {
  .catalog__search,
  .catalog__filters {
    flex-wrap: wrap;
  }

  .catalog__search :deep(.el-input),
  .catalog__search :deep(.el-button),
  .catalog__filters :deep(.el-select),
  .catalog__filters :deep(.el-button) {
    width: 100%;
  }

  .catalog-row {
    grid-template-columns: minmax(0, 1fr) 76px;
  }

  .catalog-row > span:nth-child(2),
  .catalog-row--head span:nth-child(2),
  .catalog-row--head span:nth-child(4) {
    display: none;
  }

  .catalog-row > span:last-child {
    display: none;
  }
}
</style>
