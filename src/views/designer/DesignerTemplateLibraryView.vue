<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSessionStore } from '@/stores/session'
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import NavIcon from '@/components/shell/NavIcon.vue'
import { buildTemplateVersion, copyTemplate, disableTemplate, pageTemplates, publishTemplate, saveTemplate } from '@/domains/designtemplate/api'
import { SCOPE_LABELS, STATUS_LABELS, type DesignTemplate, type TemplateScope, type TemplateStatus } from '@/domains/designtemplate/model'
import { formatDateTime } from '@/core/format'
import type { StatusTone } from '@/core/tone'

const router = useRouter()
const session = useSessionStore()
const loading = ref(false)
const saving = ref(false)
const createVisible = ref(false)
const error = ref('')
const templates = ref<DesignTemplate[]>([])
const total = ref(0)
const current = ref(1)
const size = ref(12)

const filters = reactive<{
  keyword: string
  scope?: TemplateScope
  status?: TemplateStatus
  houseType: string
  areaRange: string
  tag: string
}>({
  keyword: '',
  scope: undefined,
  status: undefined,
  houseType: '',
  areaRange: '',
  tag: ''
})

const AREA_RANGES = [
  { label: '全部面积', value: '', min: undefined as number | undefined, max: undefined as number | undefined },
  { label: '60㎡以下', value: '0-60', min: 0, max: 60 },
  { label: '60–80㎡', value: '60-80', min: 60, max: 80 },
  { label: '80–100㎡', value: '80-100', min: 80, max: 100 },
  { label: '100–150㎡', value: '100-150', min: 100, max: 150 },
  { label: '150㎡以上', value: '150-9999', min: 150, max: 9999 }
]

const form = reactive<{ name: string; houseType: string; areaMin?: number; areaMax?: number; tags?: string; scope: TemplateScope; remark?: string }>({
  name: '',
  houseType: '',
  scope: 'Personal'
})

let searchTimer: ReturnType<typeof setTimeout> | undefined

async function load(reset = false): Promise<void> {
  if (reset) current.value = 1
  loading.value = true
  error.value = ''
  try {
    const range = AREA_RANGES.find((item) => item.value === filters.areaRange)
    const page = await pageTemplates({
      current: current.value,
      size: size.value,
      scope: filters.scope,
      status: filters.status,
      keyword: filters.keyword || undefined,
      houseType: filters.houseType || undefined,
      areaMin: range?.min,
      areaMax: range?.max,
      tag: filters.tag || undefined
    })
    templates.value = page.content ?? []
    total.value = page.totalElements ?? 0
  } catch (err) {
    error.value = err instanceof Error ? err.message : '方案库加载失败，请重试'
    templates.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

watch(
  () => [filters.keyword, filters.houseType, filters.tag],
  () => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => { void load(true) }, 350)
  }
)

function onPageChange(page: number): void {
  current.value = page
  void load()
}

function hasDraft(row: DesignTemplate): boolean {
  return row.status === 'Published' && row.currentVersion?.status === 'Draft'
}

function statusText(row: DesignTemplate): string {
  if (hasDraft(row)) return '已发布 · 有草稿'
  if (row.currentVersion?.status === 'Draft') return '草稿'
  return row.status ? STATUS_LABELS[row.status] : '—'
}

function statusTone(row: DesignTemplate): StatusTone {
  if (hasDraft(row)) return 'progress'
  if (row.currentVersion?.status === 'Draft') return 'doing'
  if (row.status === 'Published') return 'done'
  if (row.status === 'Disabled') return 'muted'
  return 'doing'
}

function areaText(row: DesignTemplate): string {
  const min = row.currentVersion?.areaMin
  const max = row.currentVersion?.areaMax
  if (min === undefined && max === undefined) return '面积不限'
  if (min !== undefined && max !== undefined) return `适用 ${min}–${max}㎡`
  return min !== undefined ? `适用 ≥${min}㎡` : `适用 ≤${max}㎡`
}

function tagsOf(row: DesignTemplate): string[] {
  return (row.currentVersion?.tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 4)
}

function openCreate(): void {
  form.name = ''
  form.houseType = ''
  form.areaMin = undefined
  form.areaMax = undefined
  form.tags = ''
  form.scope = 'Personal'
  form.remark = ''
  createVisible.value = true
}

async function submitCreate(): Promise<void> {
  if (!form.name.trim() || !form.houseType.trim()) {
    ElMessage.warning('模版名称与房型为必填')
    return
  }
  saving.value = true
  try {
    const created = await saveTemplate({ ...form })
    createVisible.value = false
    ElMessage.success('模版已创建（草稿）')
    await router.push(`/designer/templates/${created.templateId}`)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '创建失败，请重试')
  } finally {
    saving.value = false
  }
}

function canMaintain(row: DesignTemplate): boolean {
  const isManager = session.role === 'Boss' || session.role === 'StoreManager'
  if (row.scope === 'Company' || row.scope === 'Store') return isManager
  return isManager || row.owner?.empId === session.employee?.empId
}

function editReason(row: DesignTemplate): string {
  if (row.status === 'Disabled') return '模版已停用，不可编辑；可复制后修改'
  if (!canMaintain(row)) return '仅企业负责人/店长或归属人可维护'
  return ''
}

function view(row: DesignTemplate): void {
  void router.push(`/designer/templates/${row.templateId}`)
}

async function openEditor(row: DesignTemplate): Promise<void> {
  if (row.status !== 'Published') {
    void router.push(`/designer/templates/${row.templateId}`)
    return
  }
  try {
    const draft = await buildTemplateVersion({ templateId: row.templateId })
    ElMessage.success(`已${draft.currentVersion?.version ? `创建新版本 V${draft.currentVersion.version}` : '打开草稿版本'}`)
    await router.push(`/designer/templates/${draft.templateId}`)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '新建版本失败，请重试')
  }
}

async function publish(row: DesignTemplate): Promise<void> {
  try {
    await publishTemplate(row.templateId)
    ElMessage.success('模版已发布')
    await load()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '发布失败，请检查区域与分项后重试')
  }
}

async function copy(row: DesignTemplate): Promise<void> {
  try {
    const cloned = await copyTemplate({ templateId: row.templateId })
    ElMessage.success('已复制为个人模版（草稿）')
    await router.push(`/designer/templates/${cloned.templateId}`)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '复制失败，请重试')
  }
}

async function disable(row: DesignTemplate): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `停用方案模版「${row.currentVersion?.name ?? row.templateId}」？停用后不可再实例化或编辑，历史报价不受影响；需要继续使用时请先复制。`,
      '停用模版',
      { confirmButtonText: '停用', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  try {
    await disableTemplate({ templateId: row.templateId })
    ElMessage.success('模版已停用')
    await load()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '停用失败，请重试')
  }
}

onMounted(() => { void load() })
onBeforeUnmount(() => { if (searchTimer) clearTimeout(searchTimer) })
</script>

<template>
  <section class="template-library">
    <header class="template-library__head">
      <div>
        <h1>我的方案库</h1>
        <p>沉淀常用房型的区域骨架、报价分项与工程量公式；新建设计时一键起稿。模版与价格无关，分项价格取自报价项目库。</p>
      </div>
      <el-button type="primary" @click="openCreate">
        <NavIcon name="add" />
        新建模版
      </el-button>
    </header>

    <div class="template-library__filters">
      <el-input
        v-model="filters.keyword"
        class="filter-search"
        placeholder="搜索模版名称 / 房型 / 标签"
        clearable
        @keyup.enter="load(true)"
      >
        <template #prefix>⌕</template>
      </el-input>
      <el-select v-model="filters.scope" placeholder="归属" clearable @change="load(true)">
        <el-option label="我的" value="Personal" />
        <el-option label="本门店" value="Store" />
        <el-option label="本企业" value="Company" />
      </el-select>
      <el-select v-model="filters.status" placeholder="状态" clearable @change="load(true)">
        <el-option label="草稿" value="Draft" />
        <el-option label="已发布" value="Published" />
        <el-option label="已停用" value="Disabled" />
      </el-select>
      <el-input v-model="filters.houseType" placeholder="房型，如 3室2厅" clearable @keyup.enter="load(true)" />
      <el-select v-model="filters.areaRange" placeholder="面积区间" clearable @change="load(true)">
        <el-option v-for="range in AREA_RANGES" :key="range.value" :label="range.label" :value="range.value" />
      </el-select>
      <el-input v-model="filters.tag" placeholder="风格 / 用途，如 现代简约" clearable @keyup.enter="load(true)" />
    </div>

    <div v-if="error" class="template-library__error">
      {{ error }}
      <el-button link type="primary" @click="load()">重试</el-button>
    </div>

    <div v-if="loading" class="template-library__grid">
      <div v-for="index in 6" :key="index" class="template-skeleton">
        <el-skeleton :rows="4" animated />
      </div>
    </div>

    <EmptyState
      v-else-if="!templates.length"
      title="还没有方案模版"
      description="从「新建模版」沉淀第一个常用房型；也可以先按房型、面积或风格调整筛选条件。"
      action-text="新建模版"
      @action="openCreate"
    />

    <div v-else class="template-library__grid">
      <article v-for="row in templates" :key="row.templateId" class="template-card">
        <header class="template-card__head">
          <div>
            <h3>{{ row.currentVersion?.name ?? '未命名草稿' }}</h3>
            <p>{{ row.currentVersion?.houseType ?? '—' }}</p>
          </div>
          <BusinessStateTag :text="statusText(row)" :tone="statusTone(row)" />
        </header>

        <ul class="template-card__meta">
          <li>{{ row.roomCount ?? 0 }} 个区域</li>
          <li>{{ row.itemCount ?? 0 }} 个分项</li>
          <li>{{ areaText(row) }}</li>
          <li>{{ SCOPE_LABELS[row.scope] }}</li>
        </ul>

        <div v-if="tagsOf(row).length || row.sourceTemplate" class="template-card__tags">
          <span v-if="row.sourceTemplate" class="is-source">副本</span>
          <span v-for="tag in tagsOf(row)" :key="tag">{{ tag }}</span>
        </div>

        <footer class="template-card__foot">
          <span>使用 {{ row.usageCount ?? 0 }} 次</span>
          <span>更新 {{ row.updateTime ? formatDateTime(row.updateTime) : '—' }}</span>
        </footer>

        <div class="template-card__actions">
          <el-button size="small" @click="view(row)">
            <NavIcon name="edit" />
            查看
          </el-button>
          <el-button
            v-if="row.status !== 'Disabled'"
            size="small"
            type="primary"
            :disabled="!canMaintain(row)"
            :title="editReason(row)"
            @click="openEditor(row)"
          >
            <NavIcon name="edit" />
            {{ row.status === 'Draft' ? '继续编辑' : hasDraft(row) ? '继续编辑草稿' : '编辑（新建版本）' }}
          </el-button>
          <el-button v-if="row.status === 'Draft'" size="small" :disabled="!canMaintain(row)" :title="editReason(row)" @click="publish(row)">
            <NavIcon name="publish" />
            发布
          </el-button>
          <el-button size="small" @click="copy(row)">
            <NavIcon name="copy" />
            复制
          </el-button>
          <el-button v-if="row.status !== 'Disabled'" size="small" type="danger" plain :disabled="!canMaintain(row)" :title="editReason(row)" @click="disable(row)">
            <NavIcon name="trash" />
            停用
          </el-button>
          <span v-if="row.status === 'Disabled'" class="template-card__disabled">已停用</span>
        </div>
      </article>
    </div>

    <el-pagination
      v-if="total > size"
      class="template-library__pager"
      background
      layout="prev, pager, next"
      :total="total"
      :current-page="current"
      :page-size="size"
      @current-change="onPageChange"
    />

    <el-dialog v-model="createVisible" title="新建方案模版" width="520px">
      <el-form label-width="110px">
        <el-form-item label="模版名称" required>
          <el-input v-model="form.name" maxlength="64" placeholder="如：三室两厅一厨一卫 · 标准" />
        </el-form-item>
        <el-form-item label="房型" required>
          <el-input v-model="form.houseType" maxlength="64" placeholder="如：3室2厅1厨1卫" />
        </el-form-item>
        <el-form-item label="适用面积">
          <div class="template-library__range">
            <el-input-number v-model="form.areaMin" :min="0" :precision="2" controls-position="right" />
            <span>–</span>
            <el-input-number v-model="form.areaMax" :min="0" :precision="2" controls-position="right" />
            <span>㎡（套内）</span>
          </div>
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="form.tags" maxlength="256" placeholder="如：现代简约,全屋整装" />
        </el-form-item>
        <el-form-item label="归属范围">
          <el-select v-model="form.scope" style="width: 100%">
            <el-option label="个人（仅本人可用）" value="Personal" />
            <el-option label="门店（门店内共享）" value="Store" />
            <el-option label="企业（企业内共享）" value="Company" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="512" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitCreate">
          <NavIcon name="add" />
          创建并编辑
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped lang="scss">
.template-library { display: flex; flex-direction: column; gap: $space-4; padding: $space-5; }
.template-library__head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-4; }
.template-library__head h1 { margin: 0 0 $space-1; font-size: $font-h1; }
.template-library__head p { margin: 0; max-width: 760px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.6; }
.template-library__filters { display: grid; grid-template-columns: minmax(240px, 1.6fr) repeat(5, minmax(120px, 1fr)); gap: $space-2; }
.template-library__filters :deep(.el-input), .template-library__filters :deep(.el-select) { width: 100%; }
.filter-search { min-width: 220px; }
.template-library__error { padding: $space-2 $space-3; color: $danger-500; background: $danger-50; border: 1px solid $danger-200; border-radius: $radius-sm; font-size: $font-caption; }
.template-library__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: $space-3; }
.template-skeleton { padding: $space-4; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; }
.template-card { display: flex; flex-direction: column; gap: $space-3; padding: $space-4; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; box-shadow: $shadow-card; }
.template-card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-2; }
.template-card__head h3 { margin: 0 0 $space-1; overflow: hidden; font-size: $font-card-title; text-overflow: ellipsis; white-space: nowrap; }
.template-card__head p { margin: 0; color: $text-secondary; font-size: $font-caption; }
.template-card__meta { display: flex; flex-wrap: wrap; gap: $space-1 $space-3; margin: 0; padding: 0; color: $text-secondary; font-size: $font-caption; list-style: none; }
.template-card__meta li { position: relative; }
.template-card__meta li + li::before { margin-right: $space-3; color: $text-tertiary; content: '·'; }
.template-card__tags { display: flex; flex-wrap: wrap; gap: $space-1; }
.template-card__tags span { padding: 1px 8px; color: $brand-700; background: $brand-50; border-radius: $radius-pill; font-size: $font-caption; }
.template-card__tags span.is-source { color: $purple-500; background: $purple-50; }
.template-card__foot { display: flex; align-items: center; justify-content: space-between; gap: $space-2; padding-top: $space-2; border-top: 1px dashed $border-color; color: $text-tertiary; font-size: $font-caption; }
.template-card__actions { display: flex; flex-wrap: wrap; gap: $space-1; }
.template-card__disabled { align-self: center; color: $text-tertiary; font-size: $font-caption; }
.template-library__pager { justify-content: flex-end; }
.template-library__range { display: flex; align-items: center; gap: $space-2; }

@media (max-width: 1440px) {
  .template-library__filters { grid-template-columns: minmax(220px, 1.4fr) repeat(3, minmax(120px, 1fr)); }
}
@media (max-width: 1280px) {
  .template-library__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .template-library__filters { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 1024px) {
  .template-library { padding: $space-3; }
  .template-library__head { flex-direction: column; }
  .template-library__grid { grid-template-columns: minmax(0, 1fr); }
  .template-library__filters { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
