<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import StatusTag from '@/components/StatusTag.vue'
import WorkbenchState from '@/components/workbench/WorkbenchState.vue'
import CustomerPropertyContext from '@/components/CustomerPropertyContext.vue'
import PropertyFormDrawer from '@/components/property/PropertyFormDrawer.vue'
import { formatDateTime } from '@/core/format'
import { fileApi } from '@/domains/file/api'
import type { UploadedFile } from '@/domains/file/model'
import { designApi } from '@/domains/design/api'
import { propertyApi } from '@/domains/property/api'
import type { DesignerMeasureTask } from '@/domains/workbench/model'
import { workbenchApi } from '@/domains/workbench/api'
import type { StatusTone } from '@/core/tone'

const router = useRouter()

type QueueFilter = 'all' | 'overdue' | 'today' | 'scheduled' | 'notScheduled' | 'handoff'

const FILTERS: Array<{ key: QueueFilter; label: string }> = [
  { key: 'all', label: '全部任务' },
  { key: 'overdue', label: '逾期' },
  { key: 'today', label: '今天' },
  { key: 'scheduled', label: '已预约' },
  { key: 'notScheduled', label: '待预约' },
  { key: 'handoff', label: '待交设计' }
]

const STATE_META: Record<string, { tone: StatusTone; label: string }> = {
  missing_property: { tone: 'pending', label: '待建房屋' },
  not_scheduled: { tone: 'pending', label: '未预约量房' },
  scheduled: { tone: 'info', label: '已预约·待上门' },
  overdue: { tone: 'blocked', label: '预约逾期' },
  cancelled: { tone: 'pending', label: '已取消' },
  completed_pending_handoff: { tone: 'pending', label: '量房完成·待交设计' }
}

const RISK_META: Record<string, { tone: StatusTone; label: string }> = {
  normal: { tone: 'done', label: '正常' },
  warning: { tone: 'pending', label: '需关注' },
  high: { tone: 'blocked', label: '高风险' }
}

const tasks = ref<DesignerMeasureTask[]>([])
const loading = ref(false)
const error = ref('')
const keyword = ref('')
const filter = ref<QueueFilter>('all')
const selectedKey = ref('')
const actionError = ref('')
const saving = ref(false)

const propertyDrawerOpen = ref(false)
const propertyCustomerId = ref('')
const propertyCustomerName = ref('')

const scheduleOpen = ref(false)
const scheduleForm = reactive({ measureAt: '' })

const measureOpen = ref(false)
const measureForm = reactive({
  measureTime: '',
  originalStructure: '',
  dimensions: '',
  customerRequirements: '',
  designerConclusion: ''
})
const measureSiteInput = ref<HTMLInputElement | null>(null)
const measureStructureInput = ref<HTMLInputElement | null>(null)
const measureAttachmentInput = ref<HTMLInputElement | null>(null)
const measureSiteFiles = ref<UploadedFile[]>([])
const measureStructureFiles = ref<UploadedFile[]>([])
const measureAttachmentFiles = ref<UploadedFile[]>([])
const measureUploading = ref(false)

const schemeOpen = ref(false)
const schemeForm = reactive({ name: '', style: '', layout: '', description: '' })

const selectedTask = computed(() => tasks.value.find((item) => item.taskKey === selectedKey.value) ?? null)

const filteredTasks = computed(() => {
  const needle = keyword.value.trim().toLowerCase()
  return tasks.value.filter((task) => {
    const state = task.stateKey
    const matchesFilter = filter.value === 'all'
      || (filter.value === 'overdue' && state === 'overdue')
      || (filter.value === 'today' && isToday(task.scheduledAt))
      || (filter.value === 'scheduled' && (state === 'scheduled' || state === 'overdue'))
      || (filter.value === 'notScheduled' && ['missing_property', 'not_scheduled', 'cancelled'].includes(state))
      || (filter.value === 'handoff' && state === 'completed_pending_handoff')
    if (!matchesFilter) return false
    if (!needle) return true
    return [task.customerName, task.telNo, task.propertyLabel, task.community, task.address]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle))
  })
})

const nextTask = computed(() => filteredTasks.value.find((task) => task.taskKey !== selectedKey.value) ?? null)

function isToday(value?: string | null): boolean {
  if (!value) return false
  const date = new Date(value.replace(' ', 'T'))
  const now = new Date()
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
}

function stateMeta(task: DesignerMeasureTask) {
  return STATE_META[task.stateKey] ?? { tone: 'info' as StatusTone, label: task.stateLabel || '待业务确认' }
}

function riskMeta(task: DesignerMeasureTask) {
  return RISK_META[task.riskLevel] ?? { tone: 'info' as StatusTone, label: '待业务确认' }
}

function selectTask(task: DesignerMeasureTask): void {
  selectedKey.value = task.taskKey
  actionError.value = ''
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    tasks.value = await workbenchApi.designerMeasureTasks()
    if (!tasks.value.some((item) => item.taskKey === selectedKey.value)) {
      selectedKey.value = tasks.value[0]?.taskKey ?? ''
    }
  } catch (err) {
    tasks.value = []
    selectedKey.value = ''
    error.value = err instanceof Error ? err.message : '待量房任务暂不可确认'
  } finally {
    loading.value = false
  }
}

function openCustomer360(task: DesignerMeasureTask): void {
  void router.push(`/designer/my-customers/${task.customerId}`)
}

function openPropertyForm(task: DesignerMeasureTask): void {
  propertyCustomerId.value = String(task.customerId)
  propertyCustomerName.value = task.customerName || '当前客户'
  propertyDrawerOpen.value = true
}

async function onPropertySaved(): Promise<void> {
  propertyDrawerOpen.value = false
  await load()
}

function openScheduleDialog(task: DesignerMeasureTask): void {
  if (!task.propertyId) {
    actionError.value = task.blockReason || '当前任务缺少房屋锚点，不能安排量房'
    return
  }
  scheduleForm.measureAt = task.scheduledAt || ''
  scheduleOpen.value = true
}

function openMeasureDialog(task: DesignerMeasureTask): void {
  if (!task.propertyId) {
    actionError.value = task.blockReason || '当前任务缺少房屋锚点，不能登记量房'
    return
  }
  measureForm.measureTime = task.completedAt || task.scheduledAt || ''
  measureForm.originalStructure = ''
  measureForm.dimensions = ''
  measureForm.customerRequirements = ''
  measureForm.designerConclusion = ''
  measureSiteFiles.value = []
  measureStructureFiles.value = []
  measureAttachmentFiles.value = []
  measureOpen.value = true
}

function openSchemeDialog(task: DesignerMeasureTask): void {
  if (!task.propertyId) {
    actionError.value = task.blockReason || '当前任务缺少房屋锚点，不能新建方案'
    return
  }
  schemeForm.name = task.propertyLabel ? `${task.propertyLabel} 方案` : '设计方案'
  schemeForm.style = ''
  schemeForm.layout = task.layout || ''
  schemeForm.description = ''
  schemeOpen.value = true
}

function handleMainAction(task: DesignerMeasureTask): void {
  if (!task.allowed) {
    actionError.value = task.blockReason || '当前任务暂不可执行'
    return
  }
  switch (task.mainActionKey) {
    case 'create_property':
      openPropertyForm(task)
      return
    case 'schedule_measure':
    case 'reschedule_measure':
      openScheduleDialog(task)
      return
    case 'complete_measure':
      openMeasureDialog(task)
      return
    case 'create_scheme':
      openSchemeDialog(task)
      return
    default:
      actionError.value = '主行动未映射，暂不可执行'
  }
}

async function saveSchedule(): Promise<void> {
  const task = selectedTask.value
  if (!task?.propertyId || !scheduleForm.measureAt) return
  saving.value = true
  actionError.value = ''
  try {
    await propertyApi.saveMeasure({
      propertyId: String(task.propertyId),
      measureTime: scheduleForm.measureAt,
      status: 'scheduled'
    })
    scheduleOpen.value = false
    await load()
    ElMessage.success('量房已安排，任务已刷新')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '量房安排失败'
  } finally {
    saving.value = false
  }
}

function resetMeasureFiles(): void {
  measureSiteFiles.value = []
  measureStructureFiles.value = []
  measureAttachmentFiles.value = []
}

async function uploadMeasureFiles(event: Event, target: 'site' | 'structure' | 'attachment'): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (!files.length) return
  measureUploading.value = true
  actionError.value = ''
  try {
    for (const file of files) {
      const uploaded = await fileApi.uploadFile('Measure', file)
      if (target === 'site') measureSiteFiles.value.push(uploaded)
      if (target === 'structure') measureStructureFiles.value.push(uploaded)
      if (target === 'attachment') measureAttachmentFiles.value.push(uploaded)
    }
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '文件上传失败'
  } finally {
    measureUploading.value = false
    input.value = ''
  }
}

function removeMeasureFile(target: 'site' | 'structure' | 'attachment', path: string): void {
  if (target === 'site') measureSiteFiles.value = measureSiteFiles.value.filter((file) => file.path !== path)
  if (target === 'structure') measureStructureFiles.value = measureStructureFiles.value.filter((file) => file.path !== path)
  if (target === 'attachment') measureAttachmentFiles.value = measureAttachmentFiles.value.filter((file) => file.path !== path)
}

async function saveMeasure(): Promise<void> {
  const task = selectedTask.value
  if (!task?.propertyId) return
  saving.value = true
  actionError.value = ''
  try {
    await propertyApi.saveMeasure({
      propertyId: String(task.propertyId),
      measureTime: measureForm.measureTime || undefined,
      status: 'completed',
      originalStructure: measureForm.originalStructure || undefined,
      dimensions: measureForm.dimensions || undefined,
      customerRequirements: measureForm.customerRequirements || undefined,
      designerConclusion: measureForm.designerConclusion || undefined,
      sitePhotos: measureSiteFiles.value.map((file) => file.path),
      structureImages: measureStructureFiles.value.map((file) => file.path),
      attachments: measureAttachmentFiles.value.map((file) => file.path)
    })
    measureOpen.value = false
    resetMeasureFiles()
    await load()
    ElMessage.success('量房结论已保存，任务已转为待交设计')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '量房结论保存失败'
  } finally {
    saving.value = false
  }
}

async function saveScheme(): Promise<void> {
  const task = selectedTask.value
  if (!task?.propertyId || !task.customerId || !schemeForm.name.trim()) return
  saving.value = true
  actionError.value = ''
  try {
    const scheme = await designApi.saveScheme({
      customerId: String(task.customerId),
      propertyId: String(task.propertyId),
      name: schemeForm.name.trim(),
      style: schemeForm.style || undefined,
      layout: schemeForm.layout || undefined,
      description: schemeForm.description || undefined
    })
    schemeOpen.value = false
    await router.push(`/designer/design/${scheme.id}`)
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '设计方案创建失败'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="mt">
    <header class="mt__head">
      <div>
        <p class="mt__eyebrow">MEASURE · TASK · PROPERTY</p>
        <h1>待我量房</h1>
        <p>把当前量房工作接住：先看任务队列，再确认客户与房屋，最后完成唯一主行动并交接到设计。</p>
      </div>
      <div class="mt__head-meta">
        <span>{{ filter === 'all' ? `${filteredTasks.length} 个当前任务` : `${filteredTasks.length} 个筛选结果` }}</span>
        <button type="button" :class="{ 'is-loading': loading }" @click="load">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.3M21 3v6h-6" /></svg>
          刷新
        </button>
      </div>
    </header>

    <section class="mt__tools" aria-label="量房任务筛选">
      <label class="mt__search">
        <span>搜索</span>
        <input v-model="keyword" type="search" placeholder="客户、手机号、小区或房屋" />
      </label>
      <div class="mt__filters">
        <button v-for="item in FILTERS" :key="item.key" type="button" :class="{ active: filter === item.key }" @click="filter = item.key">
          {{ item.label }}
        </button>
      </div>
    </section>

    <WorkbenchState
      v-if="error && !tasks.length"
      variant="error"
      title="待量房任务暂不可确认"
      :description="error"
      action-text="重新加载"
      min-height="300px"
      @action="load"
    />

    <div v-else-if="loading && !tasks.length" class="mt__skeleton" aria-busy="true">
      <span v-for="n in 6" :key="n" />
    </div>

    <div v-else class="mt__layout">
      <aside class="mt__queue">
        <header class="mt__queue-head">
          <div>
            <strong>量房任务</strong>
            <small>每个任务已经绑定客户与房屋</small>
          </div>
          <span>{{ filteredTasks.length }}</span>
        </header>
        <WorkbenchState
          v-if="!filteredTasks.length"
          title="当前没有符合条件的量房任务"
          description="切换筛选或清空搜索；真实没有任务时，不会用已量房客户填充队列。"
          action-text="刷新"
          min-height="220px"
          @action="load"
        />
        <div v-else class="mt__task-list">
          <button
            v-for="task in filteredTasks"
            :key="task.taskKey"
            type="button"
            class="mt__task"
            :class="{ active: task.taskKey === selectedKey }"
            @click="selectTask(task)"
          >
            <span class="mt__task-top">
              <strong>{{ task.customerName || '客户待完善' }}</strong>
              <StatusTag :tone="stateMeta(task).tone" :text="stateMeta(task).label" :dot="false" />
            </span>
            <span class="mt__task-place">{{ task.propertyLabel || '房屋待建立' }}</span>
            <span class="mt__task-meta">
              <small>{{ task.scheduledAt ? `预约 ${task.scheduledAt}` : '未预约时间' }}</small>
              <StatusTag :tone="riskMeta(task).tone" :text="riskMeta(task).label" :dot="false" />
            </span>
            <span class="mt__task-action">{{ task.mainActionLabel }}</span>
          </button>
        </div>
      </aside>

      <main class="mt__workspace">
        <template v-if="selectedTask">
          <section class="mt__identity">
            <div class="mt__identity-main">
              <p class="mt__eyebrow">CURRENT MEASURE TASK</p>
              <h2>{{ selectedTask.customerName || '客户待完善' }} · {{ selectedTask.propertyLabel || '房屋待建立' }}</h2>
              <p>
                {{ selectedTask.telNo || '电话待补充' }}
                · {{ selectedTask.address || selectedTask.community || '地址待补充' }}
              </p>
            </div>
            <div class="mt__identity-tags">
              <StatusTag :tone="stateMeta(selectedTask).tone" :text="stateMeta(selectedTask).label" :dot="false" />
              <StatusTag :tone="riskMeta(selectedTask).tone" :text="riskMeta(selectedTask).label" :dot="false" />
            </div>
          </section>

          <el-alert v-if="actionError" type="error" :closable="false" :title="actionError" show-icon />

          <section class="mt__why">
            <div>
              <p class="mt__section-label">为什么进入这里</p>
              <strong>{{ selectedTask.riskReason || '等待业务确认当前任务原因' }}</strong>
              <p>{{ selectedTask.nextActionLabel || selectedTask.mainActionLabel }}</p>
            </div>
            <div class="mt__why-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5" /></svg>
            </div>
          </section>

          <section class="mt__facts">
            <article><small>客户状态</small><b>{{ selectedTask.customerStatusName || '待确认' }}</b></article>
            <article><small>房屋状态</small><b>{{ selectedTask.propertyStatusName || '待确认' }}</b></article>
            <article><small>预约时间</small><b>{{ selectedTask.scheduledAt ? formatDateTime(selectedTask.scheduledAt) : '未预约' }}</b></article>
            <article><small>量房时间</small><b>{{ selectedTask.completedAt ? formatDateTime(selectedTask.completedAt) : '未完成' }}</b></article>
            <article><small>诉求事实</small><b>{{ selectedTask.requirementCount }} 条</b></article>
            <article><small>方案事实</small><b>{{ selectedTask.designCount }} 个</b></article>
          </section>

          <section class="mt__action-panel">
            <div class="mt__action-copy">
              <p class="mt__section-label">当前唯一主行动</p>
              <h3>{{ selectedTask.mainActionLabel || '待业务确认' }}</h3>
              <p v-if="selectedTask.blockReason">{{ selectedTask.blockReason }}</p>
              <p v-else>{{ selectedTask.completionHint || '完成后系统会重新读取任务事实。' }}</p>
            </div>
            <button
              type="button"
              class="mt__primary"
              :disabled="!selectedTask.allowed || saving"
              @click="handleMainAction(selectedTask)"
            >
              {{ selectedTask.mainActionLabel || '暂不可执行' }}
            </button>
          </section>

          <section class="mt__secondary-actions">
            <button type="button" @click="openCustomer360(selectedTask)">打开客户 360</button>
            <button v-if="nextTask" type="button" @click="selectTask(nextTask)">处理下一项</button>
          </section>

          <section v-if="selectedTask.propertyId" class="mt__evidence">
            <div>
              <p class="mt__section-label">现场准备</p>
              <p>量房记录、现场照片、结构图和附件会作为设计输入保留；当前任务不展示成本与利润。</p>
            </div>
            <dl>
              <div><dt>现场照片</dt><dd>{{ selectedTask.sitePhotoCount }} 张</dd></div>
              <div><dt>结构图</dt><dd>{{ selectedTask.structureImageCount }} 张</dd></div>
              <div><dt>附件</dt><dd>{{ selectedTask.attachmentCount }} 个</dd></div>
            </dl>
          </section>
        </template>

        <WorkbenchState
          v-else
          title="请选择一个量房任务"
          description="左侧任务已绑定客户与房屋；选择后再执行当前主行动。"
          min-height="300px"
        />
      </main>
    </div>

    <PropertyFormDrawer
      v-model="propertyDrawerOpen"
      :customer-id="propertyCustomerId"
      :customer-name="propertyCustomerName"
      @saved="onPropertySaved"
    />

    <el-dialog v-model="scheduleOpen" title="安排量房" width="500px" append-to-body>
      <CustomerPropertyContext :customer="selectedTask ? { name: selectedTask.customerName || '客户待确认' } : null" :property="selectedTask?.propertyLabel ? { community: selectedTask.propertyLabel } : null" />
      <el-form label-position="top">
        <el-form-item label="量房时间">
          <el-date-picker v-model="scheduleForm.measureAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
        </el-form-item>
      </el-form>
      <el-alert type="info" :closable="false" title="量房会写入房屋级事实，并成为设计、报价的前置依据。" show-icon />
      <template #footer>
        <el-button @click="scheduleOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="!scheduleForm.measureAt" @click="saveSchedule">确认安排</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="measureOpen" title="登记量房结论" width="720px" append-to-body>
      <CustomerPropertyContext :customer="selectedTask ? { name: selectedTask.customerName || '客户待确认' } : null" :property="selectedTask?.propertyLabel ? { community: selectedTask.propertyLabel } : null" />
      <el-form label-position="top" class="mt__form-grid">
        <el-form-item label="量房时间"><el-date-picker v-model="measureForm.measureTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" /></el-form-item>
        <el-form-item label="原始结构" class="mt__form-wide"><el-input v-model="measureForm.originalStructure" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="尺寸记录" class="mt__form-wide"><el-input v-model="measureForm.dimensions" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="客户诉求" class="mt__form-wide"><el-input v-model="measureForm.customerRequirements" type="textarea" :rows="3" placeholder="现场听到的需求、禁忌和偏好，先原样记录" /></el-form-item>
        <el-form-item label="设计师结论" class="mt__form-wide"><el-input v-model="measureForm.designerConclusion" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <div class="mt__uploads">
        <div>
          <el-button size="small" :loading="measureUploading" @click="measureSiteInput?.click()">上传现场照片</el-button>
          <input ref="measureSiteInput" type="file" accept="image/*" multiple hidden @change="uploadMeasureFiles($event, 'site')" />
          <span v-for="file in measureSiteFiles" :key="file.path">{{ file.name || '现场照片' }}<button type="button" @click="removeMeasureFile('site', file.path)">移除</button></span>
        </div>
        <div>
          <el-button size="small" :loading="measureUploading" @click="measureStructureInput?.click()">上传结构图</el-button>
          <input ref="measureStructureInput" type="file" accept="image/*,.pdf" multiple hidden @change="uploadMeasureFiles($event, 'structure')" />
          <span v-for="file in measureStructureFiles" :key="file.path">{{ file.name || '结构图' }}<button type="button" @click="removeMeasureFile('structure', file.path)">移除</button></span>
        </div>
        <div>
          <el-button size="small" :loading="measureUploading" @click="measureAttachmentInput?.click()">上传附件</el-button>
          <input ref="measureAttachmentInput" type="file" multiple hidden @change="uploadMeasureFiles($event, 'attachment')" />
          <span v-for="file in measureAttachmentFiles" :key="file.path">{{ file.name || '附件' }}<button type="button" @click="removeMeasureFile('attachment', file.path)">移除</button></span>
        </div>
      </div>
      <template #footer>
        <el-button @click="measureOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveMeasure">保存量房结论</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="schemeOpen" title="新建设计方案" width="620px" append-to-body>
      <CustomerPropertyContext :customer="selectedTask ? { name: selectedTask.customerName || '客户待确认' } : null" :property="selectedTask?.propertyLabel ? { community: selectedTask.propertyLabel } : null" />
      <el-form label-position="top" class="mt__form-grid">
        <el-form-item label="方案名称"><el-input v-model="schemeForm.name" maxlength="80" /></el-form-item>
        <el-form-item label="风格"><el-input v-model="schemeForm.style" maxlength="40" /></el-form-item>
        <el-form-item label="户型"><el-input v-model="schemeForm.layout" maxlength="40" /></el-form-item>
        <el-form-item label="方案说明" class="mt__form-wide"><el-input v-model="schemeForm.description" type="textarea" :rows="4" maxlength="500" show-word-limit /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="schemeOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="!schemeForm.name.trim()" @click="saveScheme">创建并进入设计</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.mt { display: flex; flex-direction: column; gap: $space-5; min-width: 0; }

.mt__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: $space-5;
  h1 { margin: 0; font-size: $font-display; letter-spacing: -.02em; }
  p { max-width: 820px; margin: $space-2 0 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
}

.mt__eyebrow,
.mt__section-label { color: $brand-600 !important; font-size: $font-caption !important; font-weight: $font-weight-semibold; letter-spacing: .09em; }
.mt__head-meta { display: flex; align-items: center; gap: $space-3; color: $text-secondary; font-size: $font-caption; }
.mt__head-meta button,
.mt__secondary-actions button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-0;
  color: $text-secondary;
  font: inherit;
  cursor: pointer;
}
.mt__head-meta button:hover,
.mt__secondary-actions button:hover { color: $brand-600; border-color: $brand-300; background: $brand-50; }
.mt__head-meta svg { width: 14px; height: 14px; }
.mt__head-meta .is-loading svg { animation: mt-spin .7s linear infinite; }
@keyframes mt-spin { to { transform: rotate(360deg); } }

.mt__tools {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: $space-4;
  padding: $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
}
.mt__search { display: flex; flex-direction: column; gap: 6px; min-width: 280px; color: $text-secondary; font-size: $font-caption; }
.mt__search input { height: 36px; padding: 0 10px; border: 1px solid $border-color; border-radius: $radius-sm; color: $text-primary; background: $surface-0; font: inherit; }
.mt__filters { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.mt__filters button { padding: 7px 11px; border: 1px solid $border-color; border-radius: $radius-pill; background: $surface-0; color: $text-secondary; font: inherit; font-size: $font-caption; cursor: pointer; }
.mt__filters button.active { border-color: $brand-300; background: $brand-50; color: $brand-700; }

.mt__layout { display: grid; grid-template-columns: minmax(300px, 360px) minmax(0, 1fr); gap: $space-4; align-items: start; min-width: 0; }
.mt__queue { overflow: hidden; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.mt__queue-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid $border-color; background: linear-gradient(135deg, $surface-50, $surface-0); }
.mt__queue-head div { display: flex; flex-direction: column; gap: 3px; }
.mt__queue-head strong { color: $text-primary; font-size: $font-body; }
.mt__queue-head small { color: $text-tertiary; font-size: $font-caption; }
.mt__queue-head > span { color: $brand-700; font-size: $font-title; font-weight: $font-weight-bold; }
.mt__task-list { display: flex; flex-direction: column; }
.mt__task {
  display: flex;
  flex-direction: column;
  gap: 7px;
  width: 100%;
  padding: 15px 16px;
  border: 0;
  border-bottom: 1px solid $border-color;
  background: $surface-0;
  text-align: left;
  cursor: pointer;
}
.mt__task:last-child { border-bottom: 0; }
.mt__task:hover { background: $surface-50; }
.mt__task.active { background: $brand-50; box-shadow: inset 3px 0 0 $brand-500; }
.mt__task-top,
.mt__task-meta { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.mt__task-top strong { min-width: 0; color: $text-primary; font-size: $font-body; }
.mt__task-place { overflow: hidden; color: $text-secondary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
.mt__task-meta small { color: $text-tertiary; font-size: $font-caption; }
.mt__task-action { color: $brand-700; font-size: $font-caption; font-weight: $font-weight-semibold; }

.mt__workspace { display: flex; flex-direction: column; gap: $space-4; min-width: 0; }
.mt__identity { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-4; padding: $space-5; border: 1px solid $border-color; border-radius: $radius-lg; background: linear-gradient(135deg, $brand-50, $surface-0 65%); }
.mt__identity h2 { margin: 5px 0 0; color: $text-primary; font-size: $font-title; }
.mt__identity p { margin: 6px 0 0; color: $text-secondary; font-size: $font-body-sm; }
.mt__identity-tags { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.mt__why { display: flex; align-items: center; justify-content: space-between; gap: $space-4; padding: 18px 20px; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.mt__why strong { display: block; margin-top: 5px; color: $text-primary; font-size: $font-body; }
.mt__why p { margin: 4px 0 0; color: $text-secondary; font-size: $font-body-sm; }
.mt__why-icon { display: grid; place-items: center; width: 42px; height: 42px; flex: 0 0 auto; border-radius: 50%; background: $brand-50; color: $brand-600; }
.mt__why-icon svg { width: 22px; height: 22px; }
.mt__facts { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: $space-3; }
.mt__facts article { min-width: 0; padding: 14px 15px; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; }
.mt__facts small { display: block; color: $text-tertiary; font-size: $font-caption; }
.mt__facts b { display: block; margin-top: 5px; overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
.mt__action-panel { display: flex; align-items: center; justify-content: space-between; gap: $space-5; padding: 22px; border: 1px solid $brand-200; border-radius: $radius-lg; background: linear-gradient(135deg, $surface-0, $brand-50); }
.mt__action-panel h3 { margin: 5px 0 0; color: $text-primary; font-size: $font-h1; }
.mt__action-panel p { margin: 6px 0 0; color: $text-secondary; font-size: $font-body-sm; }
.mt__primary { min-width: 140px; padding: 11px 18px; border: 0; border-radius: $radius-sm; background: $brand-600; color: $surface-0; font: inherit; font-weight: $font-weight-semibold; cursor: pointer; }
.mt__primary:hover { background: $brand-700; }
.mt__primary:disabled { background: $line-200; color: $text-tertiary; cursor: not-allowed; }
.mt__secondary-actions { display: flex; flex-wrap: wrap; gap: $space-2; }
.mt__evidence { display: flex; align-items: center; justify-content: space-between; gap: $space-4; padding: 18px 20px; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.mt__evidence p { margin: 5px 0 0; color: $text-secondary; font-size: $font-body-sm; }
.mt__evidence dl { display: flex; gap: $space-5; margin: 0; }
.mt__evidence dt { color: $text-tertiary; font-size: $font-caption; }
.mt__evidence dd { margin: 4px 0 0; color: $text-primary; font-size: $font-body-sm; font-weight: $font-weight-semibold; }

.mt__skeleton { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: $space-4; }
.mt__skeleton span { height: 170px; border-radius: $radius-md; background: linear-gradient(90deg, $surface-100 25%, $surface-50 37%, $surface-100 63%); background-size: 400% 100%; animation: mt-shimmer 1.4s ease infinite; }
@keyframes mt-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }

.mt__form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-3; }
.mt__form-wide { grid-column: 1 / -1; }
.mt__uploads { display: grid; gap: $space-2; margin-top: $space-3; }
.mt__uploads > div { display: flex; flex-wrap: wrap; align-items: center; gap: $space-2; }
.mt__uploads span { display: inline-flex; align-items: center; gap: 5px; color: $text-secondary; font-size: $font-caption; }
.mt__uploads button { border: 0; background: transparent; color: $danger-500; font: inherit; font-size: $font-caption; cursor: pointer; }

@media (max-width: 1280px) {
  .mt__layout { grid-template-columns: minmax(280px, 320px) minmax(0, 1fr); }
  .mt__facts { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 1024px) {
  .mt__tools,
  .mt__action-panel,
  .mt__evidence { align-items: stretch; flex-direction: column; }
  .mt__layout { grid-template-columns: 1fr; }
  .mt__queue { max-height: none; }
  .mt__facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mt__primary { width: 100%; }
}
</style>
