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
}>(), {
  loading: false,
  fullscreen: false,
  defaultSpaceId: ''
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  add: [payload: { spaceId: string; items: Array<{ catalogItemId: string; quantity: number }> }]
}>()

const keyword = ref('')
const activeArea = ref<string>(ALL_AREAS)
const typeFilter = ref<DesignItemType | ''>('')
const spaceId = ref('')
const selectedIds = ref<string[]>([])
const quantities = reactive<Record<string, number>>({})

const selectedSet = computed(() => new Set(selectedIds.value))
const totalCount = computed(() => props.areas.reduce((sum, area) => sum + area.count, 0))
const totalAmount = computed(() => props.areas.reduce((sum, area) => sum + area.amount, 0))

function normalizedKeyword(): string {
  // 后端按连续字符串匹配；去掉用户输入的空格，兼容「q g l g」这种首字母分隔输入。
  return keyword.value.trim().replace(/\s+/g, '')
}

// 关键词走后端检索：后端 catalog/item/page 的 keyword 命中 name/code/category/brand/series/spec
// 以及 nameInitials（拼音首字母），例如输入 gcglf 可命中「工程管理费」。
const searchResults = ref<CatalogItem[] | null>(null)
const searchError = ref('')
const searching = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | undefined
let searchSeq = 0

const filtered = computed(() => {
  const kw = normalizedKeyword()
  if (!kw) {
    return typeFilter.value ? props.catalogItems.filter((item) => item.type === typeFilter.value) : props.catalogItems
  }
  const source = searchResults.value ?? []
  return typeFilter.value ? source.filter((item) => item.type === typeFilter.value) : source
})

async function runSearch(): Promise<void> {
  const kw = normalizedKeyword()
  if (!kw) return
  const seq = ++searchSeq
  const types: DesignItemType[] = typeFilter.value ? [typeFilter.value] : DESIGN_ITEM_TYPE_ORDER
  try {
    const pages = await Promise.all(types.map((type) => catalogApi.pageCatalog({ type, keyword: kw, size: 100 })))
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

watch([keyword, typeFilter], () => {
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

watch(() => props.modelValue, (visible) => {
  if (!visible) return
  keyword.value = ''
  activeArea.value = props.defaultSpaceId || ALL_AREAS
  typeFilter.value = ''
  spaceId.value = props.defaultSpaceId || ''
  selectedIds.value = []
  searchResults.value = null
  searchError.value = ''
  searching.value = false
  searchSeq += 1
  for (const key of Object.keys(quantities)) delete quantities[key]
})

function selectArea(id: string): void {
  activeArea.value = id
  typeFilter.value = ''
  spaceId.value = id === ALL_AREAS ? '' : id
}

function selectCategory(areaId: string, type: DesignItemType): void {
  const sameCategory = activeArea.value === areaId && typeFilter.value === type
  activeArea.value = areaId
  typeFilter.value = sameCategory ? '' : type
  spaceId.value = areaId === ALL_AREAS ? '' : areaId
}

function isSelected(id: string): boolean {
  return selectedSet.value.has(id)
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
    title="选择报价分项"
    direction="rtl"
    size="960px"
    :append-to-body="!fullscreen"
    :destroy-on-close="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p class="pick__note">左侧按「区域 → 报价分类」定位（显示现有分项数与总额），右侧从企业报价项目库选择并填写工程量（0 表示赠送）。点击“添加到方案并继续”后弹窗不会关闭，可继续选择下一批分项。</p>
    <div class="pick__body">
      <aside class="pick__tree">
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
      </aside>

      <section class="pick__content">
        <div class="pick__search">
          <el-input v-model="keyword" clearable placeholder="搜索名称 / 编码 / 拼音首字母 / 品牌 / 规格 / 分类" />
          <span class="pick__crumb">
            {{ activeArea === ALL_AREAS ? '全部区域' : (areas.find((a) => a.id === activeArea)?.name || '综合项目') }}
            <template v-if="typeFilter"> / {{ DESIGN_ITEM_TYPE_LABELS[typeFilter] }}</template>
          </span>
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
            <span class="pick__check" :class="{ 'is-on': isSelected(item.id) }">{{ isSelected(item.id) ? '✓' : '' }}</span>
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
            :description="searchError || '可切换左侧区域/分类，或调整搜索关键词。'"
          />
        </div>
      </section>
    </div>

    <template #footer>
      <div class="pick__footer">
        <label class="pick__space">
          <span>归属区域</span>
          <el-select v-model="spaceId" placeholder="选择归属区域" style="width: 200px">
            <el-option v-for="area in areas" :key="area.id || 'unassigned'" :label="area.name" :value="area.id" />
          </el-select>
        </label>
        <span class="pick__count">本次已选 <b>{{ selectedCount }}</b> 项</span>
        <el-button @click="close">完成</el-button>
        <el-button type="primary" :disabled="!selectedCount" @click="addSelected">添加到方案并继续</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped lang="scss">
.pick__note { margin: 0 0 $space-3; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.pick__body { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: $space-3; height: calc(100vh - 220px); min-height: 360px; }
.pick__tree { min-height: 0; overflow-y: auto; padding: $space-2; background: $surface-50; border: 1px solid $border-color; border-radius: $radius-sm; }
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
.pick__check { display: grid; place-items: center; width: 20px; height: 20px; color: $surface-0; background: $surface-0; border: 1px solid $border-color; border-radius: $radius-xs; font-size: 12px; }
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
.pick__count { color: $text-secondary; font-size: $font-caption; }
.pick__count b { color: $brand-700; font-variant-numeric: tabular-nums; }
@media (max-width: 1024px) {
  .pick__body { grid-template-columns: 200px minmax(0, 1fr); }
}
</style>
