<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import WorkbenchState from '@/components/workbench/WorkbenchState.vue'
import NavIcon from '@/components/shell/NavIcon.vue'
import MoneyText from '@/components/MoneyText.vue'
import PageHeader from '@/components/shell/PageHeader.vue'
import DesignSchemeContext from '@/components/DesignSchemeContext.vue'
import DesignItemSheet from './components/DesignItemSheet.vue'
import FileUploadField from '@/components/form/FileUploadField.vue'
import { designApi } from '@/domains/design/api'
import { measureRegionApi, propertyApi } from '@/domains/property/api'
import type { Measure, MeasureRegion, SpaceTypeName } from '@/domains/property/model'
import { createQuoteFromDesign, quoteDesignerPage } from '@/domains/trade/api'
import type { Quote } from '@/domains/trade/model'
import type { DesignScheme, DesignSpace, DesignStatus, SpaceType } from '@/domains/design/model'
import { fileApi } from '@/domains/file/api'
import type { UploadedFile } from '@/domains/file/model'
import { formatDateTime } from '@/core/format'
import type { StatusTone } from '@/core/tone'

const route = useRoute()
const router = useRouter()

const DESIGN_STATUS_META: Record<DesignStatus, { label: string; tone: StatusTone }> = {
  draft: { label: '设计中', tone: 'doing' },
  ready: { label: '待谈单', tone: 'done' },
  presented: { label: '已讲解', tone: 'progress' },
  selected: { label: '已选中', tone: 'special' },
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

const designId = computed(() => String(route.params.designId ?? ''))
const scheme = ref<DesignScheme | null>(null)
const loading = ref(false)
const error = ref('')
const actionError = ref('')
const saving = ref(false)
const linkedQuote = ref<Quote | null>(null)
const quoteLoading = ref(false)
const quoteCreating = ref(false)
const quoteLookupError = ref('')
const measures = ref<Measure[]>([])
const measureLoading = ref(false)
const measureError = ref('')

const coverFile = ref<UploadedFile | null>(null)
const cadFile = ref<UploadedFile | null>(null)
const originalPlanFile = ref<UploadedFile | null>(null)
const sitePhotoFiles = ref<UploadedFile[]>([])
const surveyPhotoFiles = ref<UploadedFile[]>([])
const originalPlanImageFiles = ref<UploadedFile[]>([])
const demolitionFile = ref<UploadedFile | null>(null)
const masonryFile = ref<UploadedFile | null>(null)
const optimizationFile = ref<UploadedFile | null>(null)

const spaceVisible = ref(false)

const spaceForm = reactive<{
  spaceId: string
  type: SpaceType
  name: string
  length: number | null
  width: number | null
  height: number | null
  /** 实测面积（㎡）：CAD 计算结果，工程量基数（DEC-062）。 */
  area: number | null
  /** 实测周长（m）：CAD 计算结果。 */
  perimeter: number | null
  remark: string
}>({
  spaceId: '',
  type: 'livingRoom',
  name: '',
  length: null,
  width: null,
  height: null,
  area: null,
  perimeter: null,
  remark: ''
})

const spaces = computed(() => scheme.value?.spaces ?? [])

/** 量房原始区域（DEC-066）：量房测的是房屋原始结构，量房完成后冻结；方案只继承作起点、不联动。 */
const REGION_TYPE_LABELS: Record<SpaceTypeName, string> = {
  bedroom: '卧室',
  kitchen: '厨房',
  livingRoom: '客厅',
  diningRoom: '餐厅',
  bathroom: '卫生间',
  balcony: '阳台'
}

const ORIGIN_META: Record<'measure' | 'override' | 'templateReference', { label: string; tone: StatusTone }> = {
  measure: { label: '继承量房原始区域', tone: 'done' },
  override: { label: '方案内录入（含结构改造）', tone: 'doing' },
  templateReference: { label: '模版参考值（待实测）', tone: 'pending' }
}

const measureRegions = ref<MeasureRegion[]>([])
const regionLoading = ref(false)
const regionError = ref('')
/** 原始区域来源量房单的时间标签（只读展示用）。 */
const measureRegionSource = ref('')

/** 正在编辑的空间（用于展示取值来源）。 */

const editingSpace = computed(() => spaces.value.find((item) => item.id === spaceForm.spaceId))
const editingSpaceOrigin = computed(() => editingSpace.value?.valueOrigin ?? null)

function regionText(value: number | null | undefined): string {
  return value === undefined || value === null ? '未录入' : String(value)
}

/** 量房信息是设计方案的输入；取最近一次量房记录。 */
const latestMeasure = computed<Measure | null>(() => {
  const list = [...measures.value]
  list.sort((a, b) => String(b.measureTime || b.completedAt || '').localeCompare(String(a.measureTime || a.completedAt || '')))
  return list[0] ?? null
})

const measureEvidenceCount = computed(() => {
  const measure = latestMeasure.value
  if (!measure) return 0
  return measure.sitePhotos.length + measure.structureImages.length + measure.attachments.length
})

const uploadedFileCount = computed(() => [
  coverFile.value,
  cadFile.value,
  originalPlanFile.value,
  demolitionFile.value,
  masonryFile.value,
  optimizationFile.value
].filter(Boolean).length
  + sitePhotoFiles.value.length
  + surveyPhotoFiles.value.length
  + originalPlanImageFiles.value.length)

function uploadedFromUrl(url: string | undefined, name: string): UploadedFile | null {
  if (!url) return null
  return { path: fileApi.storagePath(url) ?? url, url, name }
}

function syncSchemeFiles(current: DesignScheme): void {
  coverFile.value = uploadedFromUrl(current.coverUrl, '方案封面')
  cadFile.value = uploadedFromUrl(current.cadUrl, 'CAD 文件')
  originalPlanFile.value = uploadedFromUrl(current.originalPlanUrl, '原始户型图')
  sitePhotoFiles.value = current.sitePhotos.map((url, index) => uploadedFromUrl(url, `现场照片 ${index + 1}`)).filter((file): file is UploadedFile => Boolean(file))
  surveyPhotoFiles.value = current.surveyPhotos.map((url, index) => uploadedFromUrl(url, `勘测图 ${index + 1}`)).filter((file): file is UploadedFile => Boolean(file))
  originalPlanImageFiles.value = current.originalPlanImages.map((url, index) => uploadedFromUrl(url, `原始图纸 ${index + 1}`)).filter((file): file is UploadedFile => Boolean(file))
  demolitionFile.value = uploadedFromUrl(current.demolitionUrl, '拆除图')
  masonryFile.value = uploadedFromUrl(current.masonryUrl, '砌墙图')
  optimizationFile.value = uploadedFromUrl(current.optimizationUrl, '优化图')
}

async function saveSchemeFiles(): Promise<void> {
  const current = scheme.value
  if (!current) return
  saving.value = true
  actionError.value = ''
  try {
    scheme.value = await designApi.saveScheme({
      designId: current.id,
      name: current.name,
      style: current.style,
      layout: current.layout,
      description: current.description,
      coverUrl: coverFile.value?.path ?? '',
      cadUrl: cadFile.value?.path ?? '',
      originalPlanUrl: originalPlanFile.value?.path ?? '',
      sitePhotos: sitePhotoFiles.value.map((file) => file.path),
      surveyPhotos: surveyPhotoFiles.value.map((file) => file.path),
      originalPlanImages: originalPlanImageFiles.value.map((file) => file.path),
      demolitionUrl: demolitionFile.value?.path ?? '',
      masonryUrl: masonryFile.value?.path ?? '',
      optimizationUrl: optimizationFile.value?.path ?? ''
    })
    syncSchemeFiles(scheme.value)
    ElMessage.success('图纸与参考图已保存')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '图纸保存失败'
  } finally {
    saving.value = false
  }
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
    syncSchemeFiles(scheme.value)
    await Promise.allSettled([loadLinkedQuote(), loadMeasures(scheme.value.propertyId)])
  } catch (err) {
    error.value = err instanceof Error ? err.message : '设计方案暂不可确认'
  } finally {
    loading.value = false
  }
}

/** 读取房屋量房事实；缺失时按"暂不可确认/还没有量房记录"表达，不伪装完成。 */
/**
 * 读取最近一次量房的原始区域（只读）。
 *
 * <p>{@code DEC-066}：原始区域是量房期的原始结构事实，量房完成后冻结；
 * 设计方案只是**继承它作起点**，之后可在方案内改造，二者不联动。</p>
 */
async function loadMeasureRegions(): Promise<void> {
  regionLoading.value = true
  regionError.value = ''
  measureRegions.value = []
  measureRegionSource.value = ''
  try {
    // 原始结构以「最近一次**录入过原始区域**的已完成量房」为准：
    // 只看最近一次量房会在该次量房未录区域时误报「没有录入原始区域」（走查发现，2026-10-13）。
    const candidates = measures.value.filter((measure) => measure.status === 'completed').slice(0, 3)
    for (const measure of candidates) {
      const regions = await measureRegionApi.listMeasureRegions(measure.id)
      if (regions.length) {
        measureRegions.value = regions
        measureRegionSource.value = measure.measureTime ?? measure.completedAt ?? ''
        return
      }
    }
  } catch (err) {
    regionError.value = err instanceof Error ? err.message : '量房原始区域加载失败'
  } finally {
    regionLoading.value = false
  }
}

async function loadMeasures(propertyId?: string): Promise<void> {
  if (!propertyId) {
    measures.value = []
    measureError.value = ''
    await loadMeasureRegions()
    return
  }
  measureLoading.value = true
  measureError.value = ''
  try {
    measures.value = await propertyApi.listMeasures(propertyId)
  } catch (err) {
    measures.value = []
    measureError.value = err instanceof Error ? err.message : '量房信息暂不可确认'
  } finally {
    measureLoading.value = false
  }
  // 原始区域挂在量房单上（DEC-066）：取最近一次已录入原始区域的已完成量房作为对照基线
  await loadMeasureRegions()
}

/** 查询当前方案是否已有报价，决定下一步是“生成报价”还是“继续报价”。 */
async function loadLinkedQuote(): Promise<void> {
  const current = scheme.value
  if (!current || current.status === 'draft' || current.status === 'archived') {
    linkedQuote.value = null
    quoteLookupError.value = ''
    return
  }
  quoteLoading.value = true
  quoteLookupError.value = ''
  try {
    const quotes = await quoteDesignerPage({ designId: current.id, current: 1, size: 1 })
    linkedQuote.value = quotes[0] ?? null
  } catch {
    linkedQuote.value = null
    quoteLookupError.value = '报价状态暂不可确认'
  } finally {
    quoteLoading.value = false
  }
}

const quoteNextStep = computed(() => {
  const status = scheme.value?.status
  if (!status || !['ready', 'presented', 'selected'].includes(status)) return null
  if (quoteLookupError.value) {
    return {
      eyebrow: '下一步 · 报价',
      title: '报价状态暂不可确认',
      description: '当前无法判断该方案是否已有报价，请重新确认后再继续，避免重复生成报价草稿。',
      action: '重新确认报价'
    }
  }
  if (linkedQuote.value) {
    return {
      eyebrow: '下一步 · 报价',
      title: '继续推进客户报价',
      description: `方案「${scheme.value?.name || ''}」已有报价草稿或版本，进入报价工作区继续调整工程量、价格和提交状态。`,
      action: '打开报价工作区'
    }
  }
  return {
    eyebrow: '下一步 · 报价',
    title: '生成客户报价',
    description: `方案已具备 ${scheme.value?.itemCount ?? 0} 个设计分项，下一步将按当前分项生成报价草稿，金额自动计算。`,
    action: '生成报价草稿'
  }
})

const schemePrimaryLabel = computed(() => {
  const current = scheme.value
  if (!current || current.status === 'archived') return ''
  if (current.status === 'draft') return '完成设计，进入待谈单'
  if (current.status === 'presented') return '标记客户已选'
  if (current.status === 'ready' || current.status === 'selected') {
    return linkedQuote.value ? '继续报价' : '生成报价'
  }
  return ''
})

function runSchemePrimaryAction(): void {
  const current = scheme.value
  if (!current) return
  if (current.status === 'draft') {
    void advance('ready')
    return
  }
  if (current.status === 'presented') {
    void advance('selected')
    return
  }
  if (current.status === 'ready' || current.status === 'selected') {
    void openQuoteFlow()
  }
}

async function openQuoteFlow(): Promise<void> {
  const current = scheme.value
  if (!current) return
  if (quoteLookupError.value) {
    await loadLinkedQuote()
    if (quoteLookupError.value) {
      actionError.value = quoteLookupError.value
      return
    }
  }
  if (linkedQuote.value) {
    void router.push(`/designer/quotes/${linkedQuote.value.id}`)
    return
  }
  if (current.itemCount <= 0) {
    actionError.value = '请先配置施工或材料分项，再生成报价'
    return
  }
  try {
    await ElMessageBox.confirm(
      `将按「${current.name}」的 ${current.itemCount} 个设计分项生成报价草稿，金额和成本自动计算。是否继续？`,
      '生成客户报价',
      { type: 'success', confirmButtonText: '生成报价', cancelButtonText: '稍后处理' }
    )
  } catch {
    return
  }
  quoteCreating.value = true
  actionError.value = ''
  try {
    const quote = await createQuoteFromDesign({ designId: current.id })
    linkedQuote.value = quote
    ElMessage.success('报价草稿已生成，进入报价工作区')
    await router.push(`/designer/quotes/${quote.id}`)
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '报价草稿生成失败'
  } finally {
    quoteCreating.value = false
  }
}

/**
 * 设计分项自动保存后就地更新分项与统计：不重新拉取方案、不切骨架屏，
 * 避免每次新增/改量都让整个设计工作区“刷新重载”。
 */
function onItemsSaved(updated: DesignScheme): void {
  const current = scheme.value
  if (!current) {
    scheme.value = updated
    return
  }
  const spaces = updated.spaces ?? []
  const items = updated.items ?? []
  scheme.value = {
    ...current,
    spaces,
    items,
    spaceCount: spaces.length,
    itemCount: items.length,
    calculatedAmount: updated.calculatedAmount,
    priceSource: updated.priceSource,
    updatedAt: updated.updatedAt ?? current.updatedAt
  }
}

function openCreateSpace(): void {
  spaceForm.spaceId = ''
  spaceForm.type = 'livingRoom'
  spaceForm.name = ''
  spaceForm.length = null
  spaceForm.width = null
  spaceForm.height = null
  spaceForm.area = null
  spaceForm.perimeter = null
  spaceForm.remark = ''
  spaceVisible.value = true
}

function openEditSpaceById(spaceId: string): void {
  const space = spaces.value.find((item) => item.id === spaceId)
  if (space) openEditSpace(space)
}

function openEditSpace(space: DesignSpace): void {
  spaceForm.spaceId = space.id
  spaceForm.type = space.type
  spaceForm.name = space.name
  spaceForm.length = space.length ?? null
  spaceForm.width = space.width ?? null
  spaceForm.height = space.height ?? null
  spaceForm.area = space.area ?? null
  spaceForm.perimeter = space.perimeter ?? null
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
      area: spaceForm.area ?? undefined,
      perimeter: spaceForm.perimeter ?? undefined,
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

function removeEditingSpace(): void {
  const space = spaces.value.find((item) => item.id === spaceForm.spaceId)
  if (space) void removeSpace(space)
}

async function removeSpace(space: DesignSpace): Promise<void> {
  if (!scheme.value) return
  try {
    await ElMessageBox.confirm(`确定删除空间「${space.name}」？如该空间仍有设计项，可能无法删除。`, '删除空间', { type: 'warning' })
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

async function advance(status: DesignStatus): Promise<void> {
  if (!scheme.value) return
  saving.value = true
  actionError.value = ''
  try {
    // XA-20261011-001：build 响应带 @Properties 白名单，只返回被推进的字段（无 spaces/items/itemCount），
    // 不能整体替换页面读模型，否则会出现「0 个设计分项 / ¥0 / 生成报价置灰」的假象。
    // 写成功后必须按读接口重新拉取完整投影（reloadScopes：design/scheme/info + 关联报价 + 量房事实）。
    await designApi.buildScheme(scheme.value.id, status)
    await loadScheme()
    ElMessage.success(`方案已推进为「${DESIGN_STATUS_META[status].label}」`)
    if (status === 'ready') {
      try {
        await ElMessageBox.confirm(
          '方案已完成。是否立即生成客户报价草稿，继续推进报价？',
          '下一步：生成报价',
          { type: 'success', confirmButtonText: linkedQuote.value ? '继续报价' : '生成报价', cancelButtonText: '稍后处理' }
        )
        await openQuoteFlow()
      } catch {
        // 用户选择稍后处理，保留当前方案页面和下一步行动区。
      }
    }
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
    <div class="dw__back-row">
      <el-button link @click="router.push('/designer/customers')"><NavIcon name="back" />返回客户与设计</el-button>
    </div>

    <PageHeader
      :title="scheme?.name || '设计方案'"
      :summary="scheme ? `${scheme.customerName || '客户待确认'} · ${scheme.propertyAddress || scheme.propertyName || '房屋待确认'} · V${scheme.version} · ${scheme.style || '风格待补充'} · ${scheme.area ? `${scheme.area}㎡` : '面积待补充'}` : '正在读取方案上下文。'"
    >
      <template #actions>
        <template v-if="scheme">
          <BusinessStateTag object-key="design" :status-key="scheme.status" />
          <el-button v-if="scheme.status === 'ready'" :loading="saving" @click="advance('presented')"><NavIcon name="send" />标记已讲解</el-button>
          <el-button v-if="scheme.status === 'presented'" :loading="quoteLoading || quoteCreating" @click="openQuoteFlow"><NavIcon name="designer.quote" />继续报价</el-button>
          <el-button
            v-if="schemePrimaryLabel"
            type="primary"
            :loading="saving || quoteLoading || quoteCreating"
            @click="runSchemePrimaryAction"
          ><NavIcon name="check" />{{ schemePrimaryLabel }}</el-button>
        </template>
      </template>
    </PageHeader>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <el-alert v-if="actionError" type="error" :closable="false" :title="actionError" show-icon />

    <div v-if="loading" class="dw__loading"><el-skeleton :rows="8" animated /></div>
    <template v-else-if="scheme">
      <section class="dw__summary" aria-label="当前方案判断">
        <div class="dw__summary-main">
          <span>当前判断</span>
          <h3>{{ quoteNextStep?.title || (scheme.status === 'draft' ? '继续完成设计方案' : '查看方案下一步') }}</h3>
          <p>{{ quoteNextStep?.description || '补齐空间与设计分项后再推进方案。' }}</p>
        </div>
        <dl class="dw__summary-facts">
          <div><dt>方案</dt><dd>V{{ scheme.version }} · {{ DESIGN_STATUS_META[scheme.status].label }}</dd></div>
          <div><dt>设计进度</dt><dd>{{ scheme.spaceCount }} 个空间 · {{ scheme.itemCount }} 个设计项</dd></div>
          <div><dt>设计项金额</dt><dd><MoneyText :value="scheme.priceSource === 'unavailable' ? null : scheme.calculatedAmount" /></dd></div>
        </dl>
      </section>

      <DesignItemSheet
        :design-id="scheme.id"
        :can-write="scheme.editable"
        :spaces="spaces"
        @saved="onItemsSaved"
        @create-space="openCreateSpace"
        @edit-space="openEditSpaceById"
      />
      <details class="dw__support">
        <summary class="dw__support-summary">
          <div>
            <strong>设计依据与资料</strong>
            <span>原始结构、量房结论、图纸和参考图</span>
          </div>
          <small>{{ measureRegions.length }} 个原始区域 · {{ measureEvidenceCount }} 项现场证据 · {{ uploadedFileCount }} 个文件</small>
        </summary>
        <div class="dw__support-body">
      <section class="dw__regions">
        <header class="dw__regions-head">
          <div>
            <strong>原始结构（量房实测）</strong>
            <small>
              量房测的是房屋原始结构，量房完成后冻结、不可再改；设计方案只是继承它作结构起点，
              之后可在方案内改造（改尺寸/新增/拆除），二者不联动
            </small>
          </div>
        </header>
        <el-alert v-if="regionError" type="warning" :closable="false" :title="regionError" show-icon />
        <el-skeleton v-if="regionLoading" :rows="2" animated />
        <template v-else>
          <div v-if="!measureRegions.length" class="dw__regions-empty">
            最近一次量房还没有录入原始区域（在「待我量房」的量房结论里录入，量房完成后即冻结）。
          </div>
          <template v-else>
            <p v-if="measureRegionSource" class="dw__regions-source">来自量房：{{ formatDateTime(measureRegionSource) }}</p>
            <div class="dw__regions-table">
              <div class="dw__regions-row dw__regions-row--head">
                <span>区域</span><span>类型</span><span>原始面积(㎡)</span><span>原始周长(m)</span><span>来源</span><span>录入时间</span>
              </div>
              <div v-for="region in measureRegions" :key="region.id" class="dw__regions-row">
                <strong>{{ region.name }}</strong>
                <span>{{ REGION_TYPE_LABELS[region.type] }}</span>
                <span>{{ regionText(region.area) }}</span>
                <span>{{ regionText(region.perimeter) }}</span>
                <span>{{ region.areaSource === 'measured' ? '实测' : region.areaSource === 'estimated' ? '估算（待复核）' : '未录入' }}</span>
                <span>{{ formatDateTime(region.measuredAt) || '—' }}</span>
              </div>
            </div>
          </template>
        </template>
      </section>

      <div class="dw__support-grid">
      <section class="dw__measure">
        <header class="dw__measure-head">
          <div><strong>量房信息</strong><small>量房结论是设计方案与报价的输入；没有量房记录时不得伪装为已量房</small></div>
          <el-button v-if="latestMeasure" size="small" plain @click="router.push('/designer/measure')"><NavIcon name="designer.measure" />回到量房工作台</el-button>
        </header>
        <WorkbenchState
          v-if="measureLoading"
          title="量房信息加载中"
          description="正在读取该房屋的量房记录。"
          min-height="130px"
        />
        <el-alert v-else-if="measureError" type="warning" :closable="false" :title="measureError" show-icon />
        <dl v-else-if="latestMeasure" class="dw__measure-list">
          <div><dt>量房时间</dt><dd>{{ formatDateTime(latestMeasure.measureTime) || '暂不可确认' }}</dd></div>
          <div><dt>原始结构</dt><dd>{{ latestMeasure.originalStructure || '未记录' }}</dd></div>
          <div><dt>尺寸记录</dt><dd>{{ latestMeasure.dimensions || '未记录' }}</dd></div>
          <div><dt>客户诉求</dt><dd>{{ latestMeasure.customerRequirements || '未记录' }}</dd></div>
          <div><dt>设计师结论</dt><dd>{{ latestMeasure.designerConclusion || '未记录' }}</dd></div>
          <div><dt>现场证据</dt><dd>{{ latestMeasure.sitePhotos.length }} 张现场照片 · {{ latestMeasure.structureImages.length }} 张结构图 · {{ latestMeasure.attachments.length }} 个附件（共 {{ measureEvidenceCount }} 项）</dd></div>
        </dl>
        <EmptyState
          v-else
          title="还没有量房记录"
          description="量房结论、尺寸与现场证据是设计方案和报价的输入，请先在「待我量房」完成量房。"
          action-text="去待我量房"
          @action="router.push('/designer/measure')"
        />
      </section>


      <details class="dw__files">
        <summary class="dw__section-head">
          <div><h3>图纸与参考图</h3><p>方案封面、CAD、原始户型、现场照片和设计图纸；展开后维护，默认收起避免挤占主工作面。</p></div>
          <span class="dw__file-count">{{ uploadedFileCount }} 个文件</span>
        </summary>
        <div class="dw__file-toolbar">
          <el-button type="primary" plain :loading="saving" :disabled="!scheme.editable" @click="saveSchemeFiles">保存图纸与参考图</el-button>
        </div>
        <div class="dw__file-grid">
          <article>
            <FileUploadField
              :model-value="coverFile ? [coverFile] : []"
              business-type="Design"
              label="方案封面"
              hint="用于方案列表与客户展示"
              accept="image/*"
              :multiple="false"
              :max="1"
              :disabled="!scheme.editable"
              @update:model-value="coverFile = $event[0] ?? null"
              @error="actionError = $event"
            />
          </article>
          <article>
            <FileUploadField
              :model-value="cadFile ? [cadFile] : []"
              business-type="Design"
              label="CAD 图纸"
              hint=".dwg / .dxf / .pdf；非图片文件新窗口打开"
              accept=".dwg,.dxf,.pdf"
              :multiple="false"
              :max="1"
              :disabled="!scheme.editable"
              @update:model-value="cadFile = $event[0] ?? null"
              @error="actionError = $event"
            />
            <FileUploadField
              :model-value="originalPlanFile ? [originalPlanFile] : []"
              business-type="Design"
              label="原始户型"
              hint="图片可点击预览，PDF 新窗口打开"
              accept="image/*,.pdf"
              :multiple="false"
              :max="1"
              :disabled="!scheme.editable"
              @update:model-value="originalPlanFile = $event[0] ?? null"
              @error="actionError = $event"
            />
          </article>
          <article>
            <FileUploadField
              v-model="sitePhotoFiles"
              business-type="Design"
              label="现场照片"
              hint="点击缩略图可放大预览"
              accept="image/*"
              :max="12"
              :disabled="!scheme.editable"
              @error="actionError = $event"
            />
          </article>
          <article>
            <FileUploadField
              v-model="surveyPhotoFiles"
              business-type="Design"
              label="勘测图"
              accept="image/*,.pdf"
              :max="12"
              :disabled="!scheme.editable"
              @error="actionError = $event"
            />
            <FileUploadField
              v-model="originalPlanImageFiles"
              business-type="Design"
              label="原始图纸"
              accept="image/*,.pdf"
              :max="12"
              :disabled="!scheme.editable"
              @error="actionError = $event"
            />
          </article>
          <article>
            <FileUploadField
              :model-value="demolitionFile ? [demolitionFile] : []"
              business-type="Design"
              label="拆除图"
              accept="image/*,.pdf"
              :multiple="false"
              :max="1"
              :disabled="!scheme.editable"
              @update:model-value="demolitionFile = $event[0] ?? null"
              @error="actionError = $event"
            />
            <FileUploadField
              :model-value="masonryFile ? [masonryFile] : []"
              business-type="Design"
              label="砌墙图"
              accept="image/*,.pdf"
              :multiple="false"
              :max="1"
              :disabled="!scheme.editable"
              @update:model-value="masonryFile = $event[0] ?? null"
              @error="actionError = $event"
            />
            <FileUploadField
              :model-value="optimizationFile ? [optimizationFile] : []"
              business-type="Design"
              label="优化图"
              accept="image/*,.pdf"
              :multiple="false"
              :max="1"
              :disabled="!scheme.editable"
              @update:model-value="optimizationFile = $event[0] ?? null"
              @error="actionError = $event"
            />
          </article>
        </div>
      </details>

      </div>
        </div>
      </details>


    </template>

    <el-dialog v-model="spaceVisible" :title="spaceForm.spaceId ? '编辑空间' : '新增空间'" width="min(720px, 96vw)" append-to-body>
      <DesignSchemeContext v-if="scheme" :scheme="scheme" compact />
      <el-form label-position="top" class="dw__dialog-grid">
        <el-form-item label="空间类型"><el-select v-model="spaceForm.type" style="width: 100%"><el-option v-for="(label, value) in SPACE_TYPE_LABELS" :key="value" :label="label" :value="value" /></el-select></el-form-item>
        <el-form-item label="空间名称"><el-input v-model="spaceForm.name" maxlength="40" /></el-form-item>
        <el-form-item label="取值来源">
          <BusinessStateTag
            v-if="editingSpaceOrigin"
            :text="ORIGIN_META[editingSpaceOrigin].label"
            :tone="ORIGIN_META[editingSpaceOrigin].tone"
          />
          <span v-else>未录入（按 CAD 实测录入后即参与工程量）</span>
        </el-form-item>
        <el-form-item label="量房记录 长（米）"><el-input-number v-model="spaceForm.length" :min="0" :precision="2" style="width: 100%" /></el-form-item>
        <el-form-item label="量房记录 宽（米）"><el-input-number v-model="spaceForm.width" :min="0" :precision="2" style="width: 100%" /></el-form-item>
        <el-form-item label="量房记录 层高（米）"><el-input-number v-model="spaceForm.height" :min="0" :precision="2" style="width: 100%" /></el-form-item>
        <el-form-item label="实测面积（㎡）"><el-input-number v-model="spaceForm.area" :min="0" :precision="2" style="width: 100%" /></el-form-item>
        <el-form-item label="实测周长（米）"><el-input-number v-model="spaceForm.perimeter" :min="0" :precision="2" style="width: 100%" /></el-form-item>
        <p class="dw__dialog-wide dw__hint">长/宽只记录现场粗测；面积与周长按实测量房和 CAD 计算结果录入，是分项工程量与报价的基数，不能用长宽推算。</p>
        <el-form-item label="备注" class="dw__dialog-wide"><el-input v-model="spaceForm.remark" type="textarea" :rows="3" maxlength="300" show-word-limit /></el-form-item>
      </el-form>
      <template #footer>
        <el-button v-if="spaceForm.spaceId" type="danger" plain :disabled="!scheme?.editable" @click="removeEditingSpace">删除空间</el-button>
        <el-button @click="spaceVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="!spaceForm.name.trim() || !(spaceForm.area && spaceForm.area > 0) || !(spaceForm.perimeter && spaceForm.perimeter > 0)" @click="saveSpace">保存空间</el-button>
      </template>
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
.dw :deep(.el-button) { display: inline-flex; align-items: center; gap: 4px; }
.dw :deep(.el-button .nav-icon) { width: 14px; height: 14px; flex-basis: 14px; }

.dw__next-step {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-5;
  padding: $space-4 $space-5;
  background: linear-gradient(135deg, $brand-50 0%, $surface-0 72%);
  border: 1px solid $brand-200;
  border-radius: $radius-md;
  box-shadow: $shadow-card;

  h3 { margin: 4px 0; font-size: $font-title; }
  p:not(.dw__eyebrow) { margin: 0; max-width: 760px; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
}

.dw__focus { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: $space-3; }
.dw__focus-item { min-width: 0; padding: 12px 13px; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; }
.dw__focus-item small { display: block; color: $text-tertiary; font-size: $font-caption; }
.dw__focus-item b { display: block; margin-top: 4px; overflow: hidden; color: $text-primary; font-size: $font-body; font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }
.dw__focus-item span { display: -webkit-box; overflow: hidden; margin-top: 3px; color: $text-secondary; font-size: $font-caption; line-height: 1.55; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.dw__focus-item--doing { border-color: $status-doing-border; background: $status-doing-soft; }
.dw__focus-item--doing b { color: $status-doing; }
.dw__focus-item--done { border-color: $status-done-border; background: $status-done-soft; }
.dw__focus-item--done b { color: $status-done; }
.dw__focus-item--progress { border-color: $status-progress-border; background: $status-progress-soft; }
.dw__focus-item--progress b { color: $status-progress; }
.dw__focus-item--special { border-color: $status-special-border; background: $status-special-soft; }
.dw__focus-item--special b { color: $status-special; }
.dw__focus-item--info { border-color: $status-info-border; background: $status-info-soft; }
.dw__focus-item--info b { color: $status-info; }
.dw__support-grid { display: grid; grid-template-columns: minmax(320px, .8fr) minmax(0, 1.2fr); gap: $space-4; align-items: start; }
.dw__measure { display: flex; flex-direction: column; gap: $space-3; padding: $space-4; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.dw__measure-head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; }
.dw__measure-head strong { color: $text-primary; font-size: $font-body; }
.dw__measure-head small { display: block; margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }
.dw__measure-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-3; margin: 0; }
.dw__measure-list div { min-width: 0; padding: 10px 12px; border-radius: $radius-md; background: $surface-50; }
.dw__measure-list dt { color: $text-tertiary; font-size: $font-caption; }
.dw__measure-list dd { margin: 4px 0 0; overflow: hidden; color: $text-primary; font-size: $font-body-sm; line-height: 1.6; text-overflow: ellipsis; }
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

.dw__dialog-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-3;
}

.dw__dialog-wide { grid-column: 1 / -1; }
.dw__hint { margin: -4px 0 0; color: $text-tertiary; font-size: $font-caption; line-height: 1.6; }

.dw__loading { padding: $space-5; }

@media (max-width: 1100px) {
  .dw__support-grid { grid-template-columns: 1fr; }
  .dw__support-grid .dw__file-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 1100px) {
  .dw__focus { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dw__measure-list { grid-template-columns: 1fr; }
}
@media (max-width: 1024px) {
  .dw__head { flex-direction: column; }
  .dw__actions { justify-content: flex-start; }
  .dw__stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dw__space-grid { grid-template-columns: 1fr; }
}

@media (max-width: 720px) {
  .dw__dialog-grid { grid-template-columns: 1fr; }
  .dw__dialog-wide { grid-column: auto; }
}

.dw__support-grid .dw__file-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }

.dw__space-manager { display: flex; flex-direction: column; gap: $space-3; }
.dw__space-manager-empty { padding: $space-5; border: 1px dashed $border-color; border-radius: $radius-md; color: $text-secondary; text-align: center; }
.dw__space-manager-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: $space-3;
  padding: $space-3;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;

  > div:first-child { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  strong { overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
  small,
  > span { color: $text-tertiary; font-size: $font-caption; }
  > div:last-child { display: flex; gap: 2px; }
}

.dw__files {
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  box-shadow: $shadow-card;
  overflow: hidden;
}

.dw__files > summary { list-style: none; cursor: pointer; }
.dw__files > summary::-webkit-details-marker { display: none; }
.dw__files > summary:hover { background: $surface-50; }
.dw__file-count { flex: 0 0 auto; color: $text-tertiary; font-size: $font-caption; }
.dw__file-toolbar { display: flex; justify-content: flex-end; padding: $space-3 $space-4 0; }

.dw__file-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $space-3;
  padding: $space-4;
}

.dw__file-grid article {
  display: flex;
  flex-direction: column;
  gap: $space-2;
  padding: $space-3;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-50;

  > strong { font-size: $font-body-sm; }
  > a { color: $brand-700; font-size: $font-caption; text-decoration: underline; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  > button { align-self: flex-start; border: 0; background: transparent; color: $danger-500; font-size: $font-caption; cursor: pointer; }
}

.dw__regions { display: flex; flex-direction: column; gap: $space-3; padding: $space-4; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.dw__regions-head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; }
.dw__regions-head strong { color: $text-primary; font-size: $font-body; }
.dw__regions-head small { display: block; margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }
.dw__regions-actions { display: flex; gap: $space-2; }
.dw__regions-table { display: flex; flex-direction: column; overflow-x: auto; }
.dw__regions-row { display: grid; grid-template-columns: 140px 80px 110px 110px 150px 150px; align-items: center; gap: $space-2; min-width: 900px; padding: 8px 0; border-bottom: 1px solid $border-color; font-size: $font-caption; }
.dw__regions-row:last-child { border-bottom: 0; }
.dw__regions-row--head { color: $text-tertiary; font-weight: 600; }
.dw__regions-row-actions { display: flex; gap: $space-1; }
.dw__regions-empty { padding: $space-4; color: $text-tertiary; font-size: $font-caption; }
.dw__regions-source { margin: 0; color: $text-tertiary; font-size: $font-caption; }

@media (max-width: 1280px) { .dw__file-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 1024px) { .dw__file-grid { grid-template-columns: 1fr; } }

</style>

<style scoped lang="scss">
/* Pending-Design-D3：工作区以设计分项为主工作面，支持资料后置 */
.dw {
  gap: $space-6;
  padding: 0;
}

.dw__back-row {
  min-height: $space-6;
  display: flex;
  align-items: center;
}

.dw__back-row :deep(.el-button) { min-height: $space-6; }

.dw__summary {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(420px, .9fr);
  gap: $space-5;
  padding: $space-5;
  border: 1px solid $border-color;
  border-left: $space-1 solid $brand-500;
  border-radius: $radius-lg;
  background: $surface-0;
}

.dw__summary-main {
  min-width: 0;

  > span {
    color: $brand-700;
    font-size: $font-caption;
    font-weight: $font-weight-semibold;
  }

  h3 {
    margin: $space-2 0;
    color: $text-primary;
    font-size: $font-title;
    font-weight: $font-weight-semibold;
    line-height: 1.4;
  }

  p {
    max-width: 760px;
    margin: 0;
    color: $text-secondary;
    font-size: $font-body-sm;
    line-height: 1.7;
  }
}

.dw__summary-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-self: stretch;
  margin: 0;

  > div {
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    padding: 0 $space-4;
    border-left: 1px solid $brand-100;
  }

  dt { color: $text-tertiary; font-size: $font-caption; }
  dd {
    margin: 0;
    overflow: hidden;
    color: $text-primary;
    font-size: $font-body-sm;
    font-weight: $font-weight-medium;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
}

.dw__support {
  overflow: hidden;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;

  > summary { list-style: none; cursor: pointer; }
  > summary::-webkit-details-marker { display: none; }
}

.dw__support-summary {
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-4;
  padding: $space-4 $space-5;

  div { min-width: 0; display: grid; gap: 3px; }
  strong { color: $text-primary; font-size: $font-body-sm; font-weight: $font-weight-semibold; }
  span,
  small { color: $text-tertiary; font-size: $font-caption; line-height: 1.5; }
  small { flex: none; }
}

.dw__support-body {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: 0 $space-5 $space-5;
  border-top: 1px solid $border-color;
}

.dw__support .dw__regions {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.dw__support .dw__support-grid {
  padding-top: $space-4;
  border-top: 1px solid $border-color;
}

.dw__support .dw__measure,
.dw__support .dw__files {
  border: 0;
  border-radius: $radius-md;
  background: $surface-50;
  box-shadow: none;
}

@media (max-width: 1180px) {
  .dw__summary { grid-template-columns: 1fr; }
  .dw__summary-facts { min-height: 64px; }
  .dw__summary-facts > div:first-child { padding-left: 0; border-left: 0; }
}

@media (max-width: 720px) {
  .dw__summary-facts { grid-template-columns: 1fr; }
  .dw__summary-facts > div { padding: $space-2 0; border-top: 1px solid $brand-100; border-left: 0; }
  .dw__summary-facts > div:first-child { border-top: 0; }
  .dw__support-summary { align-items: flex-start; flex-direction: column; padding: $space-4; }
  .dw__support-body { padding: 0 $space-4 $space-4; }
}

@media (prefers-reduced-motion: reduce) {
  .dw__support-summary { transition-duration: .01ms !important; }
}
</style>

<style scoped lang="scss">
.dw :deep(.sheet__head),
.dw :deep(.sheet__toolbar-amount) {
  display: none;
}

.dw :deep(.sheet) {
  border-color: $border-color;
  border-radius: $radius-lg;
  box-shadow: $shadow-card;
}

.dw :deep(.sheet__toolbar) {
  min-height: 56px;
  padding: $space-3 $space-4;
  background: $surface-0;
}

.dw :deep(.sheet__toolbar .el-button--primary) {
  border-color: $brand-200;
  color: $brand-700;
  background: $brand-50;
}

.dw :deep(.sheet__toolbar .el-button--primary:hover) {
  border-color: $brand-300;
  color: $brand-800;
  background: $brand-100;
}

.dw :deep(.page-header__actions .el-button--primary) {
  min-height: 36px;
  font-weight: $font-weight-semibold;
}

.dw :deep(.cell__qty),
.dw :deep(.sheet .el-button.is-link),
.dw :deep(.rail__add) {
  min-height: $space-6;
}
</style>
