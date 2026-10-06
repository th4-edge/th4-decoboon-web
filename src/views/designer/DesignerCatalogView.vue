<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import MoneyText from '@/components/MoneyText.vue'
import StatusTag from '@/components/StatusTag.vue'
import { catalogApi } from '@/domains/catalog/api'
import type { CatalogItem, CatalogTree } from '@/domains/catalog/model'
import type { DesignItemType, PricingMode } from '@/domains/design/model'
import type { StatusTone } from '@/core/tone'

const TYPE_META: Record<DesignItemType, { label: string; tone: StatusTone }> = {
  construction: { label: '施工', tone: 'alert' },
  material: { label: '主材', tone: 'progress' },
  soft: { label: '软装', tone: 'special' },
  custom: { label: '全屋定制', tone: 'accent' },
  appliance: { label: '电器', tone: 'info' },
  general: { label: '综合', tone: 'todo' }
}

const PRICING_MODE_LABELS: Record<PricingMode, string> = {
  materialAndManual: '材料+人工',
  materialOnly: '仅材料',
  manualOnly: '仅人工',
  fixedTotal: '固定总价'
}

const activeType = ref<DesignItemType>('construction')
const items = ref<CatalogItem[]>([])
const tree = ref<CatalogTree | null>(null)
const selectedId = ref('')
const loading = ref(false)
const error = ref('')

const filters = reactive({
  category: '',
  brand: '',
  series: '',
  spec: '',
  keyword: ''
})

const selectedItem = computed(() => items.value.find((item) => item.id === selectedId.value) ?? items.value[0] ?? null)
const brandOptions = computed(() => Object.keys(tree.value?.brands ?? {}).sort((left, right) => left.localeCompare(right, 'zh-CN')))
const seriesOptions = computed(() => {
  const source = tree.value?.seriesByBrand ?? {}
  if (filters.brand) return source[filters.brand] ?? []
  return [...new Set(Object.values(source).flat())]
})
const specOptions = computed(() => {
  if (filters.series) return tree.value?.specsBySeries[filters.series] ?? []
  if (filters.brand) return tree.value?.specs[filters.brand] ?? []
  return [...new Set(Object.values(tree.value?.specs ?? {}).flat())]
})

const typeTabs = (Object.keys(TYPE_META) as DesignItemType[]).map((key) => ({ key, ...TYPE_META[key] }))

async function loadTree(): Promise<void> {
  try {
    tree.value = await catalogApi.catalogTree(activeType.value)
  } catch {
    tree.value = null
  }
}

async function loadItems(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    items.value = await catalogApi.pageCatalog({
      type: activeType.value,
      category: filters.category || undefined,
      brand: filters.brand || undefined,
      series: filters.series || undefined,
      spec: filters.spec || undefined,
      keyword: filters.keyword.trim() || undefined,
      size: 200
    })
    if (!items.value.some((item) => item.id === selectedId.value)) selectedId.value = items.value[0]?.id ?? ''
  } catch (err) {
    error.value = err instanceof Error ? err.message : '报价项目库暂不可确认'
  } finally {
    loading.value = false
  }
}

async function changeType(type: DesignItemType): Promise<void> {
  activeType.value = type
  filters.category = ''
  filters.brand = ''
  filters.series = ''
  filters.spec = ''
  filters.keyword = ''
  selectedId.value = ''
  await Promise.all([loadTree(), loadItems()])
}

async function resetFilters(): Promise<void> {
  filters.category = ''
  filters.brand = ''
  filters.series = ''
  filters.spec = ''
  filters.keyword = ''
  await loadItems()
}

function selectItem(item: CatalogItem): void {
  selectedId.value = item.id
}

function salesPrice(item: CatalogItem): number {
  if (item.pricingMode === 'fixedTotal') return item.fixedTotalPrice ?? item.materialPrice + item.manualPrice
  if (item.pricingMode === 'materialOnly') return item.materialPrice
  if (item.pricingMode === 'manualOnly') return item.manualPrice
  return item.materialPrice + item.manualPrice
}

onMounted(async () => {
  await Promise.all([loadTree(), loadItems()])
})
</script>

<template>
  <div class="cl">
    <header class="cl__head">
      <div>
        <p class="cl__eyebrow">CATALOG · SALES PRICE ONLY</p>
        <h2>报价项目库</h2>
        <p>设计师只读检索销售价构成、工艺标准和计价口径；不展示标准成本、采购执行价和供应商历史价，也没有维护入口。</p>
      </div>
      <el-button @click="resetFilters">重置筛选</el-button>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />

    <section class="cl__types" role="tablist" aria-label="报价项目类型">
      <button v-for="tab in typeTabs" :key="tab.key" type="button" role="tab" :aria-selected="activeType === tab.key" :class="{ active: activeType === tab.key }" @click="changeType(tab.key)">
        {{ tab.label }}
      </button>
    </section>

    <div class="cl__layout">
      <aside class="cl__filters">
        <div class="cl__panel-head"><strong>筛选</strong><span>{{ items.length }} 项</span></div>
        <el-form label-position="top">
          <el-form-item label="搜索">
            <el-input v-model="filters.keyword" clearable placeholder="名称、品牌、规格" @keyup.enter="loadItems" />
          </el-form-item>
          <el-form-item label="分类">
            <el-select v-model="filters.category" clearable placeholder="全部分类" style="width: 100%" @change="loadItems">
              <el-option v-for="category in tree?.categories ?? []" :key="category" :label="category" :value="category" />
            </el-select>
          </el-form-item>
          <el-form-item label="品牌">
            <el-select v-model="filters.brand" clearable placeholder="全部品牌" style="width: 100%" @change="() => { filters.series = ''; filters.spec = ''; loadItems() }">
              <el-option v-for="brand in brandOptions" :key="brand" :label="brand" :value="brand" />
            </el-select>
          </el-form-item>
          <el-form-item label="系列">
            <el-select v-model="filters.series" clearable placeholder="全部系列" style="width: 100%" @change="() => { filters.spec = ''; loadItems() }">
              <el-option v-for="series in seriesOptions" :key="series" :label="series" :value="series" />
            </el-select>
          </el-form-item>
          <el-form-item label="规格">
            <el-select v-model="filters.spec" clearable placeholder="全部规格" style="width: 100%" @change="loadItems">
              <el-option v-for="spec in specOptions" :key="spec" :label="spec" :value="spec" />
            </el-select>
          </el-form-item>
          <el-button type="primary" style="width: 100%" @click="loadItems">查询项目库</el-button>
        </el-form>
        <el-alert type="info" :closable="false" title="设计师侧只读：不维护项目库、不修改销售价和标准成本。" show-icon />
      </aside>

      <main class="cl__main">
        <div v-if="loading" class="cl__loading"><el-skeleton :rows="8" animated /></div>
        <EmptyState v-else-if="!items.length" title="当前条件下没有项目" description="调整类型、分类、品牌、规格或关键词后重试。" action-text="重置筛选" @action="resetFilters" />
        <div v-else class="cl__table">
          <div class="cl__row cl__row--head">
            <span>项目</span><span>分类</span><span>品牌 / 规格</span><span>单位</span><span>材料价</span><span>人工价</span><span>销售单价</span><span>计价模式</span>
          </div>
          <button v-for="item in items" :key="item.id" type="button" class="cl__row" :class="{ active: item.id === selectedItem?.id }" @click="selectItem(item)">
            <span><strong>{{ item.name }}</strong><small>{{ item.code || item.criterion || '—' }}</small></span>
            <span>{{ item.category || '—' }}</span>
            <span>{{ [item.brand, item.spec].filter(Boolean).join(' · ') || '—' }}</span>
            <span>{{ item.unit }}</span>
            <span><MoneyText :value="item.materialPrice" /></span>
            <span><MoneyText :value="item.manualPrice" /></span>
            <span><MoneyText :value="salesPrice(item)" /></span>
            <span>{{ PRICING_MODE_LABELS[item.pricingMode] }}</span>
          </button>
        </div>
      </main>

      <aside class="cl__detail">
        <template v-if="selectedItem">
          <div class="cl__panel-head"><strong>项目详情</strong><StatusTag :tone="TYPE_META[selectedItem.type].tone" :text="TYPE_META[selectedItem.type].label" /></div>
          <h3>{{ selectedItem.name }}</h3>
          <p class="cl__identity">{{ [selectedItem.brand, selectedItem.series, selectedItem.spec].filter(Boolean).join(' · ') || '品牌规格待补充' }}</p>
          <dl class="cl__facts">
            <div><dt>分类</dt><dd>{{ selectedItem.category || '—' }}</dd></div>
            <div><dt>单位</dt><dd>{{ selectedItem.unit }}</dd></div>
            <div><dt>计价模式</dt><dd>{{ PRICING_MODE_LABELS[selectedItem.pricingMode] }}</dd></div>
            <div><dt>销售单价</dt><dd><MoneyText :value="salesPrice(selectedItem)" size="lg" /></dd></div>
            <div><dt>材料价</dt><dd><MoneyText :value="selectedItem.materialPrice" /></dd></div>
            <div><dt>人工价</dt><dd><MoneyText :value="selectedItem.manualPrice" /></dd></div>
          </dl>
          <section class="cl__block"><h4>计价公式</h4><p>{{ selectedItem.formula || '暂未维护公式' }}</p></section>
          <section class="cl__block"><h4>工艺 / 标准</h4><p>{{ selectedItem.craft || '暂未维护工艺说明' }}</p><p>{{ selectedItem.criterion || '暂未维护验收标准' }}</p></section>
          <section class="cl__block"><h4>项目说明</h4><p>{{ selectedItem.description || '暂无补充说明' }}</p></section>
          <el-alert type="warning" :closable="false" title="当前页面不展示标准成本、采购执行价、供应商历史价和项目利润。" show-icon />
        </template>
        <EmptyState v-else title="请选择项目" description="从左侧项目列表选择后查看销售价构成和工艺标准。" />
      </aside>
    </div>
  </div>
</template>

<style scoped lang="scss">
.cl {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: $space-5;
}

.cl__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;

  h2 { margin: $space-1 0; font-size: $font-display; }
  p { margin: 0; max-width: 780px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
}

.cl__eyebrow {
  color: $brand-600 !important;
  font-size: $font-caption !important;
  font-weight: $font-weight-semibold;
  letter-spacing: .1em;
}

.cl__types {
  display: flex;
  flex-wrap: wrap;
  gap: $space-2;

  button {
    min-height: 36px;
    padding: 0 $space-4;
    border: 1px solid $border-color;
    border-radius: $radius-pill;
    background: $surface-0;
    color: $text-secondary;
    cursor: pointer;

    &.active { border-color: $brand-300; background: $brand-50; color: $brand-700; font-weight: $font-weight-semibold; }
  }
}

.cl__layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) 320px;
  gap: $space-4;
  align-items: start;
}

.cl__filters,
.cl__main,
.cl__detail {
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  box-shadow: $shadow-card;
  overflow: hidden;
}

.cl__filters,
.cl__detail { position: sticky; top: $space-4; max-height: calc(100vh - #{$topbar-height} - #{$space-8}); overflow: auto; }

.cl__panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
  padding: $space-4;
  border-bottom: 1px solid $border-color;

  span { color: $text-tertiary; font-size: $font-caption; }
}

.cl__filters :deep(.el-form) { padding: $space-4; }
.cl__filters :deep(.el-form-item) { margin-bottom: $space-3; }
.cl__filters :deep(.el-alert) { margin: 0 $space-4 $space-4; }

.cl__table { min-width: 1060px; overflow-x: auto; }

.cl__row {
  display: grid;
  grid-template-columns: minmax(220px, 1.5fr) 110px minmax(170px, 1fr) 70px 110px 110px 120px 110px;
  align-items: center;
  gap: $space-2;
  width: 100%;
  min-height: 58px;
  padding: 0 $space-4;
  border: 0;
  border-bottom: 1px solid $border-color;
  background: transparent;
  color: $text-primary;
  text-align: left;
  font-size: $font-body-sm;
  cursor: pointer;

  &:hover,
  &.active { background: $brand-50; }
  > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  strong,
  small { display: block; }
  small { margin-top: 3px; color: $text-secondary; font-size: $font-caption; }
}

.cl__row--head {
  min-height: 42px;
  background: $surface-50;
  color: $text-secondary;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
  cursor: default;
  &:hover { background: $surface-50; }
}

.cl__detail { padding: 0 $space-4 $space-4; }
.cl__detail :deep(.el-alert) { margin-top: $space-4; }
.cl__detail h3 { margin: $space-4 0 $space-1; font-size: $font-h1; }
.cl__identity { margin: 0 0 $space-3; color: $text-secondary; font-size: $font-body-sm; }

.cl__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-2 $space-3;
  margin: 0 0 $space-4;

  div { padding: $space-2 0; border-bottom: 1px solid $border-color; }
  dt { color: $text-secondary; font-size: $font-caption; }
  dd { margin: 3px 0 0; font-size: $font-body-sm; }
}

.cl__block {
  padding: $space-3 0;
  border-top: 1px solid $border-color;

  h4 { margin: 0 0 $space-2; font-size: $font-body; }
  p { margin: 0 0 $space-2; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
}

.cl__loading { padding: $space-5; }

@media (max-width: 1280px) {
  .cl__layout { grid-template-columns: 240px minmax(0, 1fr); }
  .cl__detail { grid-column: 1 / -1; position: static; max-height: none; }
}

@media (max-width: 1024px) {
  .cl__head { flex-direction: column; }
  .cl__layout { grid-template-columns: 1fr; }
  .cl__filters { position: static; max-height: none; }
  .cl__main { overflow-x: auto; }
  .cl__facts { grid-template-columns: 1fr; }
}
</style>
