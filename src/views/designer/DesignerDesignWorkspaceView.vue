<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import MoneyText from '@/components/MoneyText.vue'
import DesignItemSheet from './components/DesignItemSheet.vue'
import { designApi } from '@/domains/design/api'
import { createQuoteFromDesign, quoteDesignerPage } from '@/domains/trade/api'
import type { Quote } from '@/domains/trade/model'
import type { DesignItem, DesignScheme, DesignSpace, DesignStatus, SpaceType } from '@/domains/design/model'
import { fileApi } from '@/domains/file/api'
import type { UploadedFile } from '@/domains/file/model'
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

type SchemeFileTarget = 'cover' | 'cad' | 'originalPlan' | 'site' | 'survey' | 'originalPlanImage' | 'demolition' | 'masonry' | 'optimization'

const coverInput = ref<HTMLInputElement | null>(null)
const cadInput = ref<HTMLInputElement | null>(null)
const originalPlanInput = ref<HTMLInputElement | null>(null)
const sitePhotoInput = ref<HTMLInputElement | null>(null)
const surveyPhotoInput = ref<HTMLInputElement | null>(null)
const originalPlanImageInput = ref<HTMLInputElement | null>(null)
const demolitionInput = ref<HTMLInputElement | null>(null)
const masonryInput = ref<HTMLInputElement | null>(null)
const optimizationInput = ref<HTMLInputElement | null>(null)
const coverFile = ref<UploadedFile | null>(null)
const cadFile = ref<UploadedFile | null>(null)
const originalPlanFile = ref<UploadedFile | null>(null)
const sitePhotoFiles = ref<UploadedFile[]>([])
const surveyPhotoFiles = ref<UploadedFile[]>([])
const originalPlanImageFiles = ref<UploadedFile[]>([])
const demolitionFile = ref<UploadedFile | null>(null)
const masonryFile = ref<UploadedFile | null>(null)
const optimizationFile = ref<UploadedFile | null>(null)
const uploadingFiles = ref(false)

const spaceVisible = ref(false)

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

async function uploadSchemeFile(event: Event, target: SchemeFileTarget): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (!files.length) return
  uploadingFiles.value = true
  actionError.value = ''
  try {
    for (const file of files) {
      const uploaded = await fileApi.uploadFile('Design', file)
      if (target === 'cover') coverFile.value = uploaded
      if (target === 'cad') cadFile.value = uploaded
      if (target === 'originalPlan') originalPlanFile.value = uploaded
      if (target === 'demolition') demolitionFile.value = uploaded
      if (target === 'masonry') masonryFile.value = uploaded
      if (target === 'optimization') optimizationFile.value = uploaded
      if (target === 'site') sitePhotoFiles.value.push(uploaded)
      if (target === 'survey') surveyPhotoFiles.value.push(uploaded)
      if (target === 'originalPlanImage') originalPlanImageFiles.value.push(uploaded)
    }
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '文件上传失败'
  } finally {
    uploadingFiles.value = false
    input.value = ''
  }
}

function removeSchemeFile(target: SchemeFileTarget, path: string): void {
  if (target === 'cover' && coverFile.value?.path === path) coverFile.value = null
  if (target === 'cad' && cadFile.value?.path === path) cadFile.value = null
  if (target === 'originalPlan' && originalPlanFile.value?.path === path) originalPlanFile.value = null
  if (target === 'demolition' && demolitionFile.value?.path === path) demolitionFile.value = null
  if (target === 'masonry' && masonryFile.value?.path === path) masonryFile.value = null
  if (target === 'optimization' && optimizationFile.value?.path === path) optimizationFile.value = null
  if (target === 'site') sitePhotoFiles.value = sitePhotoFiles.value.filter((file) => file.path !== path)
  if (target === 'survey') surveyPhotoFiles.value = surveyPhotoFiles.value.filter((file) => file.path !== path)
  if (target === 'originalPlanImage') originalPlanImageFiles.value = originalPlanImageFiles.value.filter((file) => file.path !== path)
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
    await loadLinkedQuote()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '设计方案暂不可确认'
  } finally {
    loading.value = false
  }
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
    const quotes = await quoteDesignerPage({ size: 200 })
    linkedQuote.value = quotes.find((quote) => quote.designId === current.id) ?? null
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
      eyebrow: 'NEXT · QUOTE',
      title: '报价状态暂不可确认',
      description: '当前无法判断该方案是否已有报价，请重新确认后再继续，避免重复生成报价草稿。',
      action: '重新确认报价'
    }
  }
  if (linkedQuote.value) {
    return {
      eyebrow: 'NEXT · QUOTE',
      title: '继续推进客户报价',
      description: `方案「${scheme.value?.name || ''}」已有报价草稿或版本，进入报价工作区继续调整工程量、价格和提交状态。`,
      action: '打开报价工作区'
    }
  }
  return {
    eyebrow: 'NEXT · QUOTE',
    title: '生成客户报价',
    description: `方案已具备 ${scheme.value?.itemCount ?? 0} 个设计分项，下一步将按当前分项生成报价草稿快照，金额由服务端计算。`,
    action: '生成报价草稿'
  }
})

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
      `将按「${current.name}」的 ${current.itemCount} 个设计分项生成报价草稿，金额和成本由服务端计算。是否继续？`,
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
  scheme.value = { ...current, spaces, items, spaceCount: spaces.length, itemCount: items.length }
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

async function advance(status: DesignStatus): Promise<void> {
  if (!scheme.value) return
  saving.value = true
  actionError.value = ''
  try {
    scheme.value = await designApi.buildScheme(scheme.value.id, status)
    await loadLinkedQuote()
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

      <section v-if="quoteNextStep" class="dw__next-step">
        <div>
          <p class="dw__eyebrow">{{ quoteNextStep.eyebrow }}</p>
          <h3>{{ quoteNextStep.title }}</h3>
          <p>{{ quoteNextStep.description }}</p>
        </div>
        <el-button type="primary" :loading="quoteLoading || quoteCreating" @click="openQuoteFlow">{{ quoteNextStep.action }}</el-button>
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

      <section class="dw__files">
        <div class="dw__section-head">
          <div><h3>图纸与参考图</h3><p>上传方案封面、CAD、原始户型、现场照片和设计图纸；文件路径由服务端私有文件 Provider 签发。</p></div>
          <el-button type="primary" plain :loading="saving" :disabled="scheme.status !== 'draft'" @click="saveSchemeFiles">保存图纸与参考图</el-button>
        </div>
        <div class="dw__file-grid">
          <article>
            <strong>方案封面</strong>
            <el-button size="small" :loading="uploadingFiles" @click="coverInput?.click()">上传封面</el-button>
            <input ref="coverInput" type="file" accept="image/*" hidden @change="uploadSchemeFile($event, 'cover')" />
            <a v-if="coverFile" :href="coverFile.url" target="_blank" rel="noopener">{{ coverFile.name }}</a>
            <button v-if="coverFile" type="button" @click="removeSchemeFile('cover', coverFile.path)">移除</button>
          </article>
          <article>
            <strong>CAD / 原始户型</strong>
            <div class="dw__file-actions">
              <el-button size="small" :loading="uploadingFiles" @click="cadInput?.click()">上传 CAD</el-button>
              <el-button size="small" :loading="uploadingFiles" @click="originalPlanInput?.click()">上传原始户型</el-button>
            </div>
            <input ref="cadInput" type="file" accept=".dwg,.dxf,.pdf" hidden @change="uploadSchemeFile($event, 'cad')" />
            <input ref="originalPlanInput" type="file" accept="image/*,.pdf" hidden @change="uploadSchemeFile($event, 'originalPlan')" />
            <a v-if="cadFile" :href="cadFile.url" target="_blank" rel="noopener">{{ cadFile.name }}</a>
            <a v-if="originalPlanFile" :href="originalPlanFile.url" target="_blank" rel="noopener">{{ originalPlanFile.name }}</a>
          </article>
          <article>
            <strong>现场照片</strong>
            <el-button size="small" :loading="uploadingFiles" @click="sitePhotoInput?.click()">上传现场照片</el-button>
            <input ref="sitePhotoInput" type="file" accept="image/*" multiple hidden @change="uploadSchemeFile($event, 'site')" />
            <div class="dw__file-list"><span v-for="file in sitePhotoFiles" :key="file.path"><a :href="file.url" target="_blank" rel="noopener">{{ file.name }}</a><button type="button" @click="removeSchemeFile('site', file.path)">移除</button></span></div>
          </article>
          <article>
            <strong>勘测 / 原始图纸</strong>
            <div class="dw__file-actions">
              <el-button size="small" :loading="uploadingFiles" @click="surveyPhotoInput?.click()">上传勘测图</el-button>
              <el-button size="small" :loading="uploadingFiles" @click="originalPlanImageInput?.click()">上传原始图纸</el-button>
            </div>
            <input ref="surveyPhotoInput" type="file" accept="image/*,.pdf" multiple hidden @change="uploadSchemeFile($event, 'survey')" />
            <input ref="originalPlanImageInput" type="file" accept="image/*,.pdf" multiple hidden @change="uploadSchemeFile($event, 'originalPlanImage')" />
            <div class="dw__file-list"><span v-for="file in [...surveyPhotoFiles, ...originalPlanImageFiles]" :key="file.path"><a :href="file.url" target="_blank" rel="noopener">{{ file.name }}</a><button type="button" @click="removeSchemeFile(surveyPhotoFiles.some((item) => item.path === file.path) ? 'survey' : 'originalPlanImage', file.path)">移除</button></span></div>
          </article>
          <article>
            <strong>拆改 / 砌墙 / 优化图</strong>
            <div class="dw__file-actions">
              <el-button size="small" :loading="uploadingFiles" @click="demolitionInput?.click()">拆除图</el-button>
              <el-button size="small" :loading="uploadingFiles" @click="masonryInput?.click()">砌墙图</el-button>
              <el-button size="small" :loading="uploadingFiles" @click="optimizationInput?.click()">优化图</el-button>
            </div>
            <input ref="demolitionInput" type="file" accept="image/*,.pdf" hidden @change="uploadSchemeFile($event, 'demolition')" />
            <input ref="masonryInput" type="file" accept="image/*,.pdf" hidden @change="uploadSchemeFile($event, 'masonry')" />
            <input ref="optimizationInput" type="file" accept="image/*,.pdf" hidden @change="uploadSchemeFile($event, 'optimization')" />
            <a v-if="demolitionFile" :href="demolitionFile.url" target="_blank" rel="noopener">{{ demolitionFile.name }}</a>
            <a v-if="masonryFile" :href="masonryFile.url" target="_blank" rel="noopener">{{ masonryFile.name }}</a>
            <a v-if="optimizationFile" :href="optimizationFile.url" target="_blank" rel="noopener">{{ optimizationFile.name }}</a>
          </article>
        </div>
      </section>

      <DesignItemSheet
        :design-id="scheme.id"
        :can-write="scheme.status === 'draft'"
        :spaces="spaces"
        @saved="onItemsSaved"
      />
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

.dw__files {
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  box-shadow: $shadow-card;
  overflow: hidden;
}

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

.dw__file-actions { display: flex; flex-wrap: wrap; gap: $space-2; }

.dw__file-list {
  display: flex;
  flex-direction: column;
  gap: $space-1;

  span { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
  a { color: $brand-700; font-size: $font-caption; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  button { border: 0; background: transparent; color: $danger-500; font-size: $font-caption; cursor: pointer; }
}

@media (max-width: 1280px) { .dw__file-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 1024px) { .dw__file-grid { grid-template-columns: 1fr; } }

</style>
