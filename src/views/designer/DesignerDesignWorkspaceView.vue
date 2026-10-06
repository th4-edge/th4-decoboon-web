<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import MoneyText from '@/components/MoneyText.vue'
import { designApi } from '@/domains/design/api'
import type { DesignItem, DesignItemType, DesignScheme, DesignSpace, DesignStatus, PricingMode, SpaceType } from '@/domains/design/model'
import { catalogApi } from '@/domains/catalog/api'
import type { CatalogItem } from '@/domains/catalog/model'
import { formatDateTime } from '@/core/format'
import type { StatusTone } from '@/core/tone'

const route = useRoute()
const router = useRouter()

const DESIGN_STATUS_META: Record<DesignStatus, { label: string; tone: StatusTone }> = {
  draft: { label: '设计中', tone: 'doing' },
  ready: { label: '方案完成', tone: 'done' },
  presented: { label: '已讲解', tone: 'progress' },
  selected: { label: '客户已选', tone: 'special' },
  archived: { label: '已归档', tone: 'muted' }
}

const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
  bedroom: '卧室',
  kitchen: '厨房',
  livingRoom: '客厅',
  diningRoom: '餐厅',
  bathroom: '卫生间',
  balcony: '阳台'
}

const ITEM_TYPE_LABELS: Record<DesignItemType, string> = {
  general: '综合',
  construction: '施工',
  material: '主材',
  custom: '全屋定制',
  appliance: '电器',
  soft: '软装家具'
}

const PRICING_MODE_LABELS: Record<PricingMode, string> = {
  materialAndManual: '材料+人工',
  materialOnly: '仅材料',
  manualOnly: '仅人工',
  fixedTotal: '固定总价'
}

const designId = computed(() => String(route.params.designId ?? ''))
const scheme = ref<DesignScheme | null>(null)
const loading = ref(false)
const error = ref('')
const actionError = ref('')
const saving = ref(false)

const spaceVisible = ref(false)
const itemVisible = ref(false)
const catalogLoading = ref(false)
const catalogItems = ref<CatalogItem[]>([])

const spaceForm = reactive<{
  spaceId: string
  type: SpaceType
  name: string
  length: number | null
  width: number | null
  height: number | null
  remark: string
}>({
  spaceId: '',
  type: 'livingRoom',
  name: '',
  length: null,
  width: null,
  height: null,
  remark: ''
})

const itemForm = reactive<{
  itemId: string
  spaceId: string
  type: DesignItemType
  catalogItemId: string
  name: string
  category: string
  brand: string
  spec: string
  unit: string
  quantity: number
  materialPrice: number
  manualPrice: number
  pricingMode: PricingMode
  remark: string
}>({
  itemId: '',
  spaceId: '',
  type: 'construction',
  catalogItemId: '',
  name: '',
  category: '',
  brand: '',
  spec: '',
  unit: '㎡',
  quantity: 1,
  materialPrice: 0,
  manualPrice: 0,
  pricingMode: 'materialAndManual',
  remark: ''
})

const spaces = computed(() => scheme.value?.spaces ?? [])
const itemsBySpace = computed(() => {
  const map = new Map<string, DesignItem[]>()
  for (const item of scheme.value?.items ?? []) {
    const key = item.spaceId || '__none__'
    map.set(key, [...(map.get(key) ?? []), item])
  }
  return map
})

const totalAmount = computed(() => (scheme.value?.items ?? []).reduce((sum, item) => sum + item.amount, 0))

function itemsOfSpace(spaceId: string): DesignItem[] {
  return itemsBySpace.value.get(spaceId || '__none__') ?? []
}

function spaceName(spaceId?: string): string {
  if (!spaceId) return '未分区'
  return spaces.value.find((space) => space.id === spaceId)?.name || '未分区'
}

async function loadScheme(): Promise<void> {
  if (!designId.value) {
    error.value = '缺少 designId'
    return
  }
  loading.value = true
  error.value = ''
  try {
    scheme.value = await designApi.schemeInfo(designId.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '设计方案暂不可确认'
  } finally {
    loading.value = false
  }
}

function openCreateSpace(): void {
  spaceForm.spaceId = ''
  spaceForm.type = 'livingRoom'
  spaceForm.name = ''
  spaceForm.length = null
  spaceForm.width = null
  spaceForm.height = null
  spaceForm.remark = ''
  spaceVisible.value = true
}

function openEditSpace(space: DesignSpace): void {
  spaceForm.spaceId = space.id
  spaceForm.type = space.type
  spaceForm.name = space.name
  spaceForm.length = space.length ?? null
  spaceForm.width = space.width ?? null
  spaceForm.height = space.height ?? null
  spaceForm.remark = space.remark ?? ''
  spaceVisible.value = true
}

async function saveSpace(): Promise<void> {
  if (!scheme.value || !spaceForm.name.trim()) return
  saving.value = true
  actionError.value = ''
  try {
    await designApi.saveSpace({
      designId: scheme.value.id,
      spaceId: spaceForm.spaceId || undefined,
      type: spaceForm.type,
      name: spaceForm.name.trim(),
      length: spaceForm.length ?? undefined,
      width: spaceForm.width ?? undefined,
      height: spaceForm.height ?? undefined,
      remark: spaceForm.remark || undefined
    })
    spaceVisible.value = false
    await loadScheme()
    ElMessage.success('空间已保存')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '空间保存失败'
  } finally {
    saving.value = false
  }
}

async function removeSpace(space: DesignSpace): Promise<void> {
  if (!scheme.value) return
  try {
    await ElMessageBox.confirm(`确定删除空间「${space.name}」？空间下如果还有设计项，服务端可能拒绝删除。`, '删除空间', { type: 'warning' })
    saving.value = true
    await designApi.deleteSpace(space.id)
    await loadScheme()
    ElMessage.success('空间已删除')
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') actionError.value = err instanceof Error ? err.message : '空间删除失败'
  } finally {
    saving.value = false
  }
}

async function loadCatalog(): Promise<void> {
  catalogLoading.value = true
  try {
    catalogItems.value = await catalogApi.pageCatalog({ type: itemForm.type, keyword: itemForm.name, size: 80 })
  } catch {
    catalogItems.value = []
  } finally {
    catalogLoading.value = false
  }
}

function applyCatalogItem(catalogItemId: string): void {
  const item = catalogItems.value.find((candidate) => candidate.id === catalogItemId)
  if (!item) return
  itemForm.name = item.name
  itemForm.category = item.category
  itemForm.brand = item.brand ?? ''
  itemForm.spec = item.spec ?? ''
  itemForm.unit = item.unit
  itemForm.materialPrice = item.materialPrice
  itemForm.manualPrice = item.manualPrice
  itemForm.pricingMode = item.pricingMode
}

async function openCreateItem(space?: DesignSpace): Promise<void> {
  itemForm.itemId = ''
  itemForm.spaceId = space?.id ?? spaces.value[0]?.id ?? ''
  itemForm.type = 'construction'
  itemForm.catalogItemId = ''
  itemForm.name = ''
  itemForm.category = ''
  itemForm.brand = ''
  itemForm.spec = ''
  itemForm.unit = '㎡'
  itemForm.quantity = 1
  itemForm.materialPrice = 0
  itemForm.manualPrice = 0
  itemForm.pricingMode = 'materialAndManual'
  itemForm.remark = ''
  itemVisible.value = true
  await loadCatalog()
}

function openEditItem(item: DesignItem): void {
  itemForm.itemId = item.id
  itemForm.spaceId = item.spaceId ?? ''
  itemForm.type = item.type
  itemForm.catalogItemId = item.catalogItemId ?? ''
  itemForm.name = item.name
  itemForm.category = item.category
  itemForm.brand = item.brand ?? ''
  itemForm.spec = item.spec ?? ''
  itemForm.unit = item.unit
  itemForm.quantity = item.quantity
  itemForm.materialPrice = item.materialPrice
  itemForm.manualPrice = item.manualPrice
  itemForm.pricingMode = item.pricingMode
  itemForm.remark = item.remark ?? ''
  itemVisible.value = true
  void loadCatalog()
}

async function saveItem(): Promise<void> {
  if (!scheme.value || !itemForm.name.trim() || itemForm.quantity <= 0) return
  saving.value = true
  actionError.value = ''
  try {
    await designApi.saveItem({
      designId: scheme.value.id,
      itemId: itemForm.itemId || undefined,
      spaceId: itemForm.spaceId || undefined,
      catalogItemId: itemForm.catalogItemId || undefined,
      type: itemForm.type,
      category: itemForm.category || ITEM_TYPE_LABELS[itemForm.type],
      name: itemForm.name.trim(),
      brand: itemForm.brand || undefined,
      spec: itemForm.spec || undefined,
      unit: itemForm.unit,
      quantity: itemForm.quantity,
      materialPrice: itemForm.materialPrice,
      manualPrice: itemForm.manualPrice,
      pricingMode: itemForm.pricingMode,
      remark: itemForm.remark || undefined
    })
    itemVisible.value = false
    await loadScheme()
    ElMessage.success('设计项已保存')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '设计项保存失败'
  } finally {
    saving.value = false
  }
}

async function removeItem(item: DesignItem): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除设计项「${item.name}」？`, '删除设计项', { type: 'warning' })
    saving.value = true
    await designApi.deleteItem(item.id)
    await loadScheme()
    ElMessage.success('设计项已删除')
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') actionError.value = err instanceof Error ? err.message : '设计项删除失败'
  } finally {
    saving.value = false
  }
}

async function advance(status: DesignStatus): Promise<void> {
  if (!scheme.value) return
  saving.value = true
  actionError.value = ''
  try {
    scheme.value = await designApi.buildScheme(scheme.value.id, status)
    ElMessage.success(`方案已推进为「${DESIGN_STATUS_META[status].label}」`)
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '方案状态推进失败'
  } finally {
    saving.value = false
  }
}

onMounted(loadScheme)
</script>

<template>
  <div class="dw">
    <header class="dw__head">
      <div>
        <el-button link @click="router.push('/designer/customers')">← 返回客户与设计</el-button>
        <p class="dw__eyebrow">DESIGN WORKSPACE</p>
        <h2>{{ scheme?.name || '设计方案' }} <StatusTag v-if="scheme" :tone="DESIGN_STATUS_META[scheme.status].tone" :text="DESIGN_STATUS_META[scheme.status].label" /></h2>
        <p v-if="scheme">{{ scheme.no }} · V{{ scheme.version }} · {{ scheme.style || '风格待补充' }} · {{ scheme.area ? `${scheme.area}㎡` : '面积待补充' }}</p>
      </div>
      <div v-if="scheme" class="dw__actions">
        <el-button :loading="saving" :disabled="scheme.status !== 'draft'" @click="advance('ready')">标记方案完成</el-button>
        <el-button :loading="saving" :disabled="scheme.status !== 'ready'" @click="advance('presented')">标记已讲解</el-button>
        <el-button :loading="saving" :disabled="scheme.status !== 'presented'" @click="advance('selected')">标记客户已选</el-button>
        <el-button type="primary" :disabled="scheme.status !== 'draft'" @click="openCreateSpace">新增空间</el-button>
        <el-button type="primary" plain :disabled="scheme.status !== 'draft'" @click="openCreateItem()">新增设计项</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <el-alert v-if="actionError" type="error" :closable="false" :title="actionError" show-icon />

    <div v-if="loading" class="dw__loading"><el-skeleton :rows="8" animated /></div>
    <template v-else-if="scheme">
      <section class="dw__stats">
        <div><small>空间</small><b>{{ scheme.spaceCount }}</b></div>
        <div><small>设计项</small><b>{{ scheme.itemCount }}</b></div>
        <div><small>方案金额</small><MoneyText :value="totalAmount" size="lg" /></div>
        <div><small>最近更新</small><b>{{ formatDateTime(scheme.updatedAt) }}</b></div>
      </section>

      <section class="dw__spaces">
        <div class="dw__section-head">
          <div><h3>空间</h3><p>空间是设计项归属的容器；面积、尺寸和备注先于报价明细。</p></div>
        </div>
        <EmptyState v-if="!spaces.length" title="还没有空间" description="先新增客厅、卧室等空间，再把设计项挂到空间下。" action-text="新增空间" @action="openCreateSpace" />
        <div v-else class="dw__space-grid">
          <article v-for="space in spaces" :key="space.id" class="dw__space-card">
            <div class="dw__space-top">
              <strong>{{ space.name }}</strong>
              <StatusTag tone="info" :text="SPACE_TYPE_LABELS[space.type]" />
            </div>
            <dl>
              <div><dt>面积</dt><dd>{{ space.area ? `${space.area}㎡` : '暂不可确认' }}</dd></div>
              <div><dt>尺寸</dt><dd>{{ space.length && space.width ? `${space.length}×${space.width}×${space.height || 0}m` : '暂不可确认' }}</dd></div>
              <div><dt>设计项</dt><dd>{{ itemsOfSpace(space.id).length }} 项</dd></div>
            </dl>
            <p v-if="space.remark">{{ space.remark }}</p>
            <div class="dw__space-actions">
              <el-button size="small" :disabled="scheme.status !== 'draft'" @click="openEditSpace(space)">编辑</el-button>
              <el-button size="small" type="danger" plain :disabled="scheme.status !== 'draft'" @click="removeSpace(space)">删除</el-button>
            </div>
          </article>
        </div>
      </section>

      <section class="dw__items">
        <div class="dw__section-head">
          <div><h3>设计项</h3><p>设计项只做方案事实；正式报价金额由报价工作区服务端重算。</p></div>
          <el-button type="primary" plain :disabled="scheme.status !== 'draft'" @click="openCreateItem()">新增设计项</el-button>
        </div>
        <EmptyState v-if="!scheme.items.length" title="还没有设计项" description="从报价项目库选择施工、主材、软装等项目，或手工录入。" action-text="新增设计项" @action="openCreateItem()" />
        <div v-else class="dw__item-table">
          <div class="dw__item-row dw__item-row--head">
            <span>空间 / 类型</span><span>项目</span><span>品牌 / 规格</span><span>数量</span><span>材料价</span><span>人工价</span><span>金额</span><span>操作</span>
          </div>
          <div v-for="item in scheme.items" :key="item.id" class="dw__item-row">
            <span><b>{{ spaceName(item.spaceId) }}</b><small>{{ ITEM_TYPE_LABELS[item.type] }} · {{ item.category }}</small></span>
            <span><strong>{{ item.name }}</strong><small>{{ PRICING_MODE_LABELS[item.pricingMode] }}</small></span>
            <span>{{ [item.brand, item.spec].filter(Boolean).join(' · ') || '—' }}</span>
            <span>{{ item.quantity }} {{ item.unit }}</span>
            <span><MoneyText :value="item.materialPrice" /></span>
            <span><MoneyText :value="item.manualPrice" /></span>
            <span><MoneyText :value="item.amount" /></span>
            <span class="dw__item-actions">
              <el-button size="small" :disabled="scheme.status !== 'draft'" @click="openEditItem(item)">编辑</el-button>
              <el-button size="small" type="danger" plain :disabled="scheme.status !== 'draft'" @click="removeItem(item)">删除</el-button>
            </span>
          </div>
        </div>
      </section>
    </template>

    <el-dialog v-model="spaceVisible" :title="spaceForm.spaceId ? '编辑空间' : '新增空间'" width="560px" append-to-body>
      <el-form label-width="80px">
        <el-form-item label="空间类型"><el-select v-model="spaceForm.type" style="width: 100%"><el-option v-for="(label, value) in SPACE_TYPE_LABELS" :key="value" :label="label" :value="value" /></el-select></el-form-item>
        <el-form-item label="空间名称"><el-input v-model="spaceForm.name" maxlength="40" /></el-form-item>
        <el-form-item label="长 / 宽 / 高">
          <div class="dw__dimensions">
            <el-input-number v-model="spaceForm.length" :min="0" :precision="2" />
            <el-input-number v-model="spaceForm.width" :min="0" :precision="2" />
            <el-input-number v-model="spaceForm.height" :min="0" :precision="2" />
          </div>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="spaceForm.remark" type="textarea" :rows="2" maxlength="300" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="spaceVisible = false">取消</el-button><el-button type="primary" :loading="saving" :disabled="!spaceForm.name.trim()" @click="saveSpace">保存空间</el-button></template>
    </el-dialog>

    <el-dialog v-model="itemVisible" :title="itemForm.itemId ? '编辑设计项' : '新增设计项'" width="720px" append-to-body>
      <el-form label-width="96px">
        <el-form-item label="归属空间"><el-select v-model="itemForm.spaceId" clearable style="width: 100%"><el-option v-for="space in spaces" :key="space.id" :label="space.name" :value="space.id" /></el-select></el-form-item>
        <el-form-item label="项目类型"><el-select v-model="itemForm.type" style="width: 100%" @change="loadCatalog"><el-option v-for="(label, value) in ITEM_TYPE_LABELS" :key="value" :label="label" :value="value" /></el-select></el-form-item>
        <el-form-item label="项目库">
          <el-select v-model="itemForm.catalogItemId" filterable clearable :loading="catalogLoading" placeholder="搜索报价项目库，可选" style="width: 100%" @change="applyCatalogItem">
            <el-option v-for="catalog in catalogItems" :key="catalog.id" :label="`${catalog.name}${catalog.brand ? ` · ${catalog.brand}` : ''} · ${catalog.unit}`" :value="catalog.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="项目名称"><el-input v-model="itemForm.name" maxlength="80" /></el-form-item>
        <el-form-item label="分类"><el-input v-model="itemForm.category" maxlength="40" /></el-form-item>
        <el-form-item label="品牌 / 规格"><div class="dw__inline-fields"><el-input v-model="itemForm.brand" placeholder="品牌" /><el-input v-model="itemForm.spec" placeholder="规格" /></div></el-form-item>
        <el-form-item label="单位 / 数量"><div class="dw__inline-fields"><el-input v-model="itemForm.unit" placeholder="单位" /><el-input-number v-model="itemForm.quantity" :min="0.001" :precision="3" /></div></el-form-item>
        <el-form-item label="材料价 / 人工价"><div class="dw__inline-fields"><el-input-number v-model="itemForm.materialPrice" :min="0" :precision="2" /><el-input-number v-model="itemForm.manualPrice" :min="0" :precision="2" /></div></el-form-item>
        <el-form-item label="计价模式"><el-select v-model="itemForm.pricingMode" style="width: 100%"><el-option v-for="(label, value) in PRICING_MODE_LABELS" :key="value" :label="label" :value="value" /></el-select></el-form-item>
        <el-form-item label="备注"><el-input v-model="itemForm.remark" type="textarea" :rows="2" maxlength="300" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="itemVisible = false">取消</el-button><el-button type="primary" :loading="saving" :disabled="!itemForm.name.trim() || itemForm.quantity <= 0" @click="saveItem">保存设计项</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.dw {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: $space-5;
}

.dw__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;

  h2 { display: flex; align-items: center; gap: $space-2; margin: $space-1 0; font-size: $font-display; }
  p { margin: 0; color: $text-secondary; font-size: $font-body-sm; }
}

.dw__eyebrow {
  color: $brand-600 !important;
  font-size: $font-caption !important;
  font-weight: $font-weight-semibold;
  letter-spacing: .1em;
}

.dw__actions { display: flex; flex-wrap: wrap; gap: $space-2; justify-content: flex-end; }

.dw__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: $space-3;

  div { display: flex; flex-direction: column; gap: 3px; padding: $space-4; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; box-shadow: $shadow-card; }
  small { color: $text-secondary; font-size: $font-caption; }
  b { font-size: $font-title; }
}

.dw__spaces,
.dw__items {
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  box-shadow: $shadow-card;
  overflow: hidden;
}

.dw__section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;
  padding: $space-4;
  border-bottom: 1px solid $border-color;

  h3 { margin: 0 0 $space-1; font-size: $font-title; }
  p { margin: 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
}

.dw__space-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $space-3;
  padding: $space-4;
}

.dw__space-card {
  padding: $space-3;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-50;

  dl { display: grid; gap: $space-2; margin: $space-3 0; }
  dl div { display: flex; justify-content: space-between; gap: $space-3; }
  dt { color: $text-secondary; font-size: $font-caption; }
  dd { margin: 0; font-size: $font-body-sm; }
  > p { margin: 0 0 $space-3; color: $text-secondary; font-size: $font-caption; }
}

.dw__space-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;
}

.dw__space-actions { display: flex; gap: $space-2; }

.dw__item-table { min-width: 1040px; overflow-x: auto; }

.dw__item-row {
  display: grid;
  grid-template-columns: 170px minmax(180px, 1.4fr) minmax(140px, 1fr) 100px 110px 110px 120px 130px;
  align-items: center;
  gap: $space-2;
  min-height: 58px;
  padding: 0 $space-4;
  border-bottom: 1px solid $border-color;
  font-size: $font-body-sm;

  span { min-width: 0; }
  strong,
  small,
  b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  small { margin-top: 3px; color: $text-secondary; font-size: $font-caption; }
}

.dw__item-row--head {
  min-height: 42px;
  background: $surface-50;
  color: $text-secondary;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
}

.dw__item-actions { display: flex; gap: $space-1; }

.dw__dimensions,
.dw__inline-fields { display: flex; gap: $space-2; width: 100%; }

.dw__loading { padding: $space-5; }

@media (max-width: 1280px) {
  .dw__space-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 1024px) {
  .dw__head { flex-direction: column; }
  .dw__actions { justify-content: flex-start; }
  .dw__stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dw__space-grid { grid-template-columns: 1fr; }
}
</style>
