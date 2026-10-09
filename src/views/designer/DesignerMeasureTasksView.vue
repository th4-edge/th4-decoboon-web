<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StatusTag from '@/components/StatusTag.vue'
import WorkbenchState from '@/components/workbench/WorkbenchState.vue'
import CustomerPropertyContext from '@/components/CustomerPropertyContext.vue'
import CustomerHeroCard from '@/components/customer/CustomerHeroCard.vue'
import HeroFocusItem from '@/components/workbench/HeroFocusItem.vue'
import DateClockField from '@/components/form/DateClockField.vue'
import FileUploadField from '@/components/form/FileUploadField.vue'
import CustomerContextPanels from '@/components/customer/CustomerContextPanels.vue'
import WorkbenchQuickAction from '@/components/workbench/WorkbenchQuickAction.vue'
import PropertyFormDrawer from '@/components/property/PropertyFormDrawer.vue'
import RequirementFormDrawer from '@/components/design/RequirementFormDrawer.vue'
import { formatDateTime, formatRelativeDay } from '@/core/format'
import { notifyBlocked } from '@/core/blockedNotice'
import type { UploadedFile } from '@/domains/file/model'
import { crmApi } from '@/domains/crm/api'
import { DORMANT_REASONS, canManageDormantRole } from '@/domains/crm/dormant'
import { propertyStatusMeta } from '@/domains/property/statusMeta'
import type { Measure, Property } from '@/domains/property/model'
import type { Customer, CustomerFollow } from '@/domains/crm/model'
import { designApi } from '@/domains/design/api'
import type { DesignRequirement } from '@/domains/design/model'
import { propertyApi } from '@/domains/property/api'
import type { DesignerMeasureTask } from '@/domains/workbench/model'
import { workbenchApi } from '@/domains/workbench/api'
import { useSessionStore } from '@/stores/session'
import type { StatusTone } from '@/core/tone'

const router = useRouter()
const route = useRoute()
const session = useSessionStore()

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
const canManageDormant = computed(() => canManageDormantRole(session.role))
const dormantOpen = ref(false)
const dormantForm = reactive({ reasonCode: '', reasonText: '' })

const customer = ref<Customer | null>(null)
const follows = ref<CustomerFollow[]>([])
const requirements = ref<DesignRequirement[]>([])
const contextLoading = ref(false)
const contextError = ref('')
const requirementOpen = ref(false)

const propertyDrawerOpen = ref(false)
const propertyCustomerId = ref('')
const propertyCustomerName = ref('')
/** 维护房屋档案时传入当前房屋，抽屉进入 edit 模式（此前始终是新增模式，等于建了第二套房屋）。 */
const propertyEditing = ref<Property | null>(null)
/** 当前房屋最近一次量房记录（含已签名的照片/结构图/附件地址，用于预览）。 */
const measureEvidence = ref<Measure | null>(null)

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
const measureSiteFiles = ref<UploadedFile[]>([])
const measureStructureFiles = ref<UploadedFile[]>([])
const measureAttachmentFiles = ref<UploadedFile[]>([])

const schemeOpen = ref(false)
const schemeForm = reactive({ name: '', style: '', layout: '', description: '' })

const selectedTask = computed(() => tasks.value.find((item) => item.taskKey === selectedKey.value) ?? null)

/** Hero 用客户对象：优先服务端客户档案，缺失时退到任务里的客户名/电话（不伪装完整档案）。 */
const heroCustomer = computed<Partial<Customer> | null>(() => {
  if (customer.value) return customer.value
  const task = selectedTask.value
  if (!task) return null
  return { name: task.customerName ?? undefined, phone: task.telNo ?? undefined }
})


/** 左栏可见队列：入站筛选 + 关键词搜索（筛选/搜索变化时必须联动中栏与右栏）。 */
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

const filterCounts = computed<Record<QueueFilter, number>>(() => {
  const counts: Record<QueueFilter, number> = { all: tasks.value.length, overdue: 0, today: 0, scheduled: 0, notScheduled: 0, handoff: 0 }
  for (const task of tasks.value) {
    if (task.stateKey === 'overdue') counts.overdue += 1
    if (isToday(task.scheduledAt)) counts.today += 1
    if (task.stateKey === 'scheduled' || task.stateKey === 'overdue') counts.scheduled += 1
    if (['missing_property', 'not_scheduled', 'cancelled'].includes(task.stateKey)) counts.notScheduled += 1
    if (task.stateKey === 'completed_pending_handoff') counts.handoff += 1
  }
  return counts
})

/** 把当前对象锚点写回路由，保证刷新/返回/深链接可恢复（规范 §11）。 */
function syncQuery(): void {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(route.query)) {
    if (typeof value === 'string') query[key] = value
  }
  if (selectedKey.value) query.activeTaskKey = selectedKey.value
  else delete query.activeTaskKey
  const task = selectedTask.value
  if (task) {
    query.activeCustomerId = String(task.customerId)
    if (task.propertyId) query.activePropertyId = String(task.propertyId)
    else delete query.activePropertyId
  }
  void router.replace({ query })
}

/** 切换队列筛选/搜索时，中栏与右栏必须跟随新的可见队列（规范 §11.2）。 */
watch([filter, keyword], () => {
  const list = filteredTasks.value
  if (!list.length) {
    if (!selectedKey.value) return
    selectedKey.value = ''
    syncQuery()
    void loadCustomerContext(null)
    return
  }
  if (list.some((item) => item.taskKey === selectedKey.value)) return
  selectedKey.value = list[0]?.taskKey ?? ''
  actionError.value = ''
  syncQuery()
  void loadCustomerContext(selectedTask.value)
})

const nextTask = computed(() => filteredTasks.value.find((task) => task.taskKey !== selectedKey.value) ?? null)
const currentQueueIndex = computed(() => filteredTasks.value.findIndex((task) => task.taskKey === selectedKey.value))

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

function taskTimeLabel(task: DesignerMeasureTask): string {
  if (task.completedAt) return `量房完成 ${formatDateTime(task.completedAt)}`
  if (task.scheduledAt) return `预约 ${formatRelativeDay(task.scheduledAt)}`
  return '未预约时间'
}

function measureScheduleLabel(task: DesignerMeasureTask): string {
  if (task.scheduleStateKey === 'scheduled' && task.scheduledAt) return formatRelativeDay(task.scheduledAt)
  if (task.scheduleStateName) return task.scheduleStateName
  if (task.scheduledAt) return formatRelativeDay(task.scheduledAt)
  if (task.completedAt) return '未预约（直接登记量房）'
  return '未预约'
}

function taskPropertyLocation(task: DesignerMeasureTask): string {
  const parts = [task.community, task.building, task.roomNo].filter(Boolean)
  return parts.length ? parts.join(' · ') : task.address || '房屋地址待完善'
}

/** 标题行的「房屋名」：优先小区名，退化到房屋标签。 */
function houseName(task: DesignerMeasureTask): string {
  return task.community || task.propertyLabel || '房屋待建立'
}

/** 标题行「房屋名」后的「明细」：楼栋 + 房号；缺失时退化到地址。 */
function houseDetailHint(task: DesignerMeasureTask): string {
  const parts = [task.building, task.roomNo].filter(Boolean)
  if (parts.length) return parts.join(' ')
  return task.address || ''
}

/** 左栏卡片状态标签必须显示「房屋状态」，不得用客户状态或任务流程状态代替。 */
function propertyStateMeta(task: DesignerMeasureTask) {
  return propertyStatusMeta(task.propertyStatus, task.propertyStatusName)
}

function taskPropertySummary(task: DesignerMeasureTask): string {
  const parts: string[] = []
  const location = taskPropertyLocation(task)
  if (location && location !== task.propertyLabel) parts.push(location)
  if (task.area) parts.push(`${task.area}㎡`)
  if (task.layout) parts.push(task.layout)
  return parts.length ? parts.join(' · ') : '地址、面积、户型待补充'
}

function selectTask(task: DesignerMeasureTask): void {
  selectedKey.value = task.taskKey
  actionError.value = ''
  syncQuery()
  void loadCustomerContext(task)
}

/** 读取该房屋最近一次量房记录，用于预约量房信息里的照片/结构图/附件预览。 */
async function loadMeasureEvidence(task: DesignerMeasureTask | null): Promise<void> {
  if (!task?.propertyId) {
    measureEvidence.value = null
    return
  }
  try {
    const list = await propertyApi.listMeasures(String(task.propertyId))
    const sorted = [...list].sort((a, b) => String(b.measureTime || b.completedAt || '').localeCompare(String(a.measureTime || a.completedAt || '')))
    measureEvidence.value = sorted[0] ?? null
  } catch {
    measureEvidence.value = null
  }
}

/** 读取中栏「客户信息」需要的客户事实、跟进与诉求（复用现有 Provider，不新开 API）。 */
async function loadCustomerContext(task: DesignerMeasureTask | null): Promise<void> {
  if (!task) {
    customer.value = null
    follows.value = []
    requirements.value = []
    contextError.value = ''
    return
  }
  contextLoading.value = true
  contextError.value = ''
  const customerId = String(task.customerId)
  const [customerResult, followResult, requirementResult] = await Promise.allSettled([
    crmApi.customerInfo(customerId),
    crmApi.customerFollows(customerId),
    designApi.listRequirements(customerId, task.propertyId ? String(task.propertyId) : undefined)
  ])
  void loadMeasureEvidence(task)
  customer.value = customerResult.status === 'fulfilled' ? customerResult.value : null
  follows.value = followResult.status === 'fulfilled' ? followResult.value : []
  requirements.value = requirementResult.status === 'fulfilled' ? requirementResult.value : []
  if (customerResult.status === 'rejected' || followResult.status === 'rejected' || requirementResult.status === 'rejected') {
    contextError.value = '部分数据暂不可确认（客户资料 / 跟进 / 诉求），可刷新重试'
  }
  contextLoading.value = false
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    tasks.value = await workbenchApi.designerMeasureTasks()
    const requestedCustomerId = String(route.query.activeCustomerId ?? '')
    const requestedPropertyId = String(route.query.activePropertyId ?? '')
    const requestedTask = tasks.value.find((item) => String(item.customerId) === requestedCustomerId
      && (!requestedPropertyId || String(item.propertyId) === requestedPropertyId))
      ?? tasks.value.find((item) => String(item.customerId) === requestedCustomerId)
    if (requestedTask) {
      selectedKey.value = requestedTask.taskKey
    } else if (!tasks.value.some((item) => item.taskKey === selectedKey.value)) {
      selectedKey.value = tasks.value[0]?.taskKey ?? ''
    }
  } catch (err) {
    tasks.value = []
    selectedKey.value = ''
    error.value = err instanceof Error ? err.message : '待量房任务暂不可确认'
  } finally {
    loading.value = false
    syncQuery()
    void loadCustomerContext(selectedTask.value)
  }
}

/** 拨打客户电话；仅做系统拨号，不产生业务事实。 */
function callCustomer(tel: string): void {
  window.location.href = `tel:${tel}`
}

function openCustomer360(task: DesignerMeasureTask): void {
  void router.push(`/designer/my-customers/${task.customerId}`)
}

async function openPropertyForm(task: DesignerMeasureTask): Promise<void> {
  propertyCustomerId.value = String(task.customerId)
  propertyCustomerName.value = task.customerName || '当前客户'
  propertyEditing.value = null
  if (task.propertyId) {
    try {
      propertyEditing.value = await propertyApi.getProperty(String(task.customerId), String(task.propertyId))
    } catch {
      propertyEditing.value = null
    }
    if (!propertyEditing.value) {
      actionError.value = '当前房屋档案暂不可确认，已切换为新增房屋；如需修改请刷新后重试'
    }
  }
  propertyDrawerOpen.value = true
}

async function onPropertySaved(): Promise<void> {
  propertyDrawerOpen.value = false
  await load()
}

function openDormantDrawer(): void {
  const task = selectedTask.value
  if (!task) return
  if (!canManageDormant.value) {
    actionError.value = '当前岗位不能设置休眠客户，请联系客户负责人、店长或企业负责人处理。'
    return
  }
  dormantForm.reasonCode = ''
  dormantForm.reasonText = ''
  dormantOpen.value = true
}

async function saveDormant(): Promise<void> {
  const task = selectedTask.value
  if (!task || !dormantForm.reasonCode) return
  if (dormantForm.reasonCode === 'Other' && !dormantForm.reasonText.trim()) {
    actionError.value = '选择“其他”时，请填写休眠原因说明。'
    return
  }
  saving.value = true
  actionError.value = ''
  try {
    await crmApi.setDormant(String(task.customerId), dormantForm.reasonCode, dormantForm.reasonText.trim() || undefined)
    dormantOpen.value = false
    await load()
    ElMessage.success('客户已设为休眠，量房任务队列已刷新')
  } catch (saveError) {
    actionError.value = saveError instanceof Error ? saveError.message : '休眠设置失败，请刷新客户状态后重试'
  } finally {
    saving.value = false
  }
}

/** 缺少房屋锚点时的阻断提示：给出「建立房屋」恢复路径（规范 §5.1）。 */
function blockMissingProperty(task: DesignerMeasureTask, actionLabel: string): void {
  const reason = task.blockReason || `当前任务还没有房屋档案，不能${actionLabel}`
  actionError.value = reason
  notifyBlocked({
    title: `还不能${actionLabel}`,
    message: `${reason}。量房、设计与报价都绑定具体房屋，先为「${task.customerName || '该客户'}」建立房屋档案，再回来${actionLabel}。`,
    actionText: '建立房屋',
    onAction: () => openPropertyForm(task)
  })
}

function openScheduleDialog(task: DesignerMeasureTask): void {
  if (!task.propertyId) {
    blockMissingProperty(task, '安排量房')
    return
  }
  scheduleForm.measureAt = task.scheduledAt || ''
  scheduleOpen.value = true
}

function openMeasureDialog(task: DesignerMeasureTask): void {
  if (!task.propertyId) {
    blockMissingProperty(task, '登记量房结论')
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
    blockMissingProperty(task, '新建设计方案')
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
    notifyBlocked({
      title: '当前任务暂不可执行',
      message: `${task.blockReason || '服务端未放行这个动作。'}。可先补全客户与房屋信息，或联系客户负责人处理后再回到本任务。`,
      actionText: task.propertyId ? undefined : '建立房屋',
      onAction: task.propertyId ? undefined : () => openPropertyForm(task)
    })
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
        <p class="mt__eyebrow">设计报价 · 待我量房</p>
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
        <input v-model="keyword" type="search" placeholder="房屋、小区、楼栋、客户或手机号" />
      </label>
      <div class="mt__filters">
        <button v-for="item in FILTERS" :key="item.key" type="button" :class="{ active: filter === item.key }" @click="filter = item.key">
          {{ item.label }}
          <small>{{ filterCounts[item.key] }}</small>
        </button>
      </div>
    </section>

    <el-alert v-if="actionError" type="error" :closable="false" :title="actionError" show-icon />

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
            <strong>待量房房屋</strong>
            <small>以房屋为主线，客户信息作为归属线索</small>
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
              <span class="mt__task-property-title">
                <strong>{{ task.propertyLabel || '房屋待建立' }}</strong>
              </span>
              <StatusTag :tone="propertyStateMeta(task).tone" :text="propertyStateMeta(task).label" :dot="false" />
            </span>
            <span class="mt__task-customer">
              <span><small>客户</small><strong>{{ task.customerName || '客户待完善' }}</strong></span>
              <small>{{ task.telNo || '电话待补充' }}</small>
            </span>
            <span class="mt__task-property-meta">{{ taskPropertySummary(task) }}</span>
            <span class="mt__task-reason">{{ task.riskReason || taskTimeLabel(task) }}</span>
            <span class="mt__task-meta">
              <small>{{ taskTimeLabel(task) }}</small>
              <StatusTag :tone="riskMeta(task).tone" :text="riskMeta(task).label" :dot="false" />
            </span>
          </button>
        </div>
      </aside>

      <main class="mt__workspace">
        <template v-if="selectedTask">
          <!-- ① 唯一 Hero：以客户为主体形态，本页追加「本次房屋」一行 -->
          <CustomerHeroCard
            :customer="heroCustomer"
            portrait-title="客户画像"
            portrait-hint="量房前先看清客户是谁、要什么、忌讳什么"
          >
            <template #title-prefix>
              <span class="mt__hero-house">{{ houseName(selectedTask) }}</span>
              <span v-if="houseDetailHint(selectedTask)" class="mt__hero-house-detail">「{{ houseDetailHint(selectedTask) }}」</span>
            </template>
            <template #title-extra>
              <span class="mt__hero-sep">·</span>
              <StatusTag :tone="propertyStateMeta(selectedTask).tone" :text="propertyStateMeta(selectedTask).label" :dot="false" />
            </template>
            <!-- L1 按页面传入：本页最高关注的三项 -->
            <template #focus>
              <HeroFocusItem
                label="预约情况"
                :value="measureScheduleLabel(selectedTask)"
                :note="selectedTask.riskReason || '等待业务确认当前任务原因'"
                :tone="stateMeta(selectedTask).tone"
              />
              <HeroFocusItem
                label="量房时间"
                :value="selectedTask.completedAt ? formatDateTime(selectedTask.completedAt) : selectedTask.scheduledAt ? formatDateTime(selectedTask.scheduledAt) : '未安排'"
                :note="selectedTask.completedAt ? '量房已完成，等待交设计' : selectedTask.scheduledAt ? '按预约时间上门' : '尚未约定上门时间'"
                tone="info"
              />
              <HeroFocusItem
                label="现场准备"
                :value="`${selectedTask.sitePhotoCount} 张照片 · ${selectedTask.structureImageCount} 张结构图`"
                :note="`附件 ${selectedTask.attachmentCount} 个，作为设计输入保留`"
              />
            </template>
            <template #portrait-action>
              <button class="mt__text-button" type="button" @click="openCustomer360(selectedTask)">完整档案</button>
            </template>
          </CustomerHeroCard>

          <!-- ② 本页业务信息块：按关注度依次排列（预约量房 → 房屋 → 诉求 → 跟进） -->
          <section class="mt__stage-block">
            <header class="mt__stage-head">
              <div><strong>预约量房信息</strong><small>本页主行动的依据；数值来自服务端量房任务投影</small></div>
              <button v-if="selectedTask.propertyId" type="button" class="mt__text-button" @click="openScheduleDialog(selectedTask)">
                {{ selectedTask.scheduledAt ? '调整预约时间' : '预约量房' }}
              </button>
            </header>
            <dl class="mt__stage-grid">
              <div><dt>任务状态</dt><dd>{{ stateMeta(selectedTask).label }}</dd></div>
              <div><dt>预约时间</dt><dd>{{ selectedTask.scheduledAt ? formatDateTime(selectedTask.scheduledAt) : '未预约' }}</dd></div>
              <div><dt>量房时间</dt><dd>{{ selectedTask.completedAt ? formatDateTime(selectedTask.completedAt) : '未完成' }}</dd></div>
              <div><dt>现场照片</dt><dd>{{ selectedTask.sitePhotoCount }} 张</dd></div>
              <div><dt>结构图</dt><dd>{{ selectedTask.structureImageCount }} 张</dd></div>
              <div><dt>附件</dt><dd>{{ selectedTask.attachmentCount }} 个</dd></div>
              <div><dt>诉求事实</dt><dd>{{ selectedTask.requirementCount }} 条</dd></div>
              <div><dt>方案事实</dt><dd>{{ selectedTask.designCount }} 个</dd></div>
            </dl>

            <div v-if="measureEvidence" class="mt__evidence">
              <div v-if="measureEvidence.sitePhotos.length" class="mt__evidence-group">
                <small>现场照片（点击预览）</small>
                <div class="mt__evidence-thumbs">
                  <el-image
                    v-for="(src, index) in measureEvidence.sitePhotos"
                    :key="`site-${index}`"
                    :src="src"
                    :preview-src-list="measureEvidence.sitePhotos"
                    :initial-index="index"
                    fit="cover"
                    preview-teleported
                    class="mt__evidence-thumb"
                  />
                </div>
              </div>
              <div v-if="measureEvidence.structureImages.length" class="mt__evidence-group">
                <small>结构图（点击预览）</small>
                <div class="mt__evidence-thumbs">
                  <el-image
                    v-for="(src, index) in measureEvidence.structureImages"
                    :key="`structure-${index}`"
                    :src="src"
                    :preview-src-list="measureEvidence.structureImages"
                    :initial-index="index"
                    fit="cover"
                    preview-teleported
                    class="mt__evidence-thumb"
                  />
                </div>
              </div>
              <div v-if="measureEvidence.attachments.length" class="mt__evidence-group">
                <small>附件</small>
                <div class="mt__evidence-files">
                  <a v-for="(file, index) in measureEvidence.attachments" :key="`att-${index}`" :href="file" target="_blank" rel="noopener">
                    附件 {{ index + 1 }}
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section class="mt__stage-block">
            <header class="mt__stage-head">
              <div><strong>房屋信息</strong><small>本次量房对象；量房、设计与报价都绑定这套房屋</small></div>
              <button type="button" class="mt__text-button" @click="openPropertyForm(selectedTask)">维护房屋档案</button>
            </header>
            <dl class="mt__stage-grid">
              <div><dt>房屋状态</dt><dd>{{ propertyStateMeta(selectedTask).label }}</dd></div>
              <div><dt>面积 / 户型</dt><dd>{{ selectedTask.area ? `${selectedTask.area}㎡` : '待补充' }} / {{ selectedTask.layout || '待补充' }}</dd></div>
              <div><dt>小区</dt><dd>{{ selectedTask.community || '待补充' }}</dd></div>
              <div><dt>楼栋 / 房号</dt><dd>{{ [selectedTask.building, selectedTask.roomNo].filter(Boolean).join(' / ') || '待补充' }}</dd></div>
              <div class="mt__stage-wide"><dt>详细地址</dt><dd>{{ selectedTask.address || '待补充' }}</dd></div>
            </dl>
          </section>

          <CustomerContextPanels
            :requirements="requirements"
            :follows="follows"
            :can-record-requirement="true"
            :can-record-follow="false"
            @record-requirement="requirementOpen = true"
          />

        </template>

        <WorkbenchState
          v-else
          title="请选择一个量房任务"
          description="左侧任务已绑定客户与房屋；选择后再执行当前主行动。"
          min-height="300px"
        />
      </main>

      <aside class="mt__guide">
        <template v-if="selectedTask">
          <section class="mt__guide-card mt__guide-card--primary">
            <div class="mt__guide-title-row">
              <div>
                <p class="mt__eyebrow">本次量房</p>
                <h3>{{ stateMeta(selectedTask).label }}</h3>
              </div>
              <span class="mt__guide-order">{{ currentQueueIndex >= 0 ? `${currentQueueIndex + 1}/${filteredTasks.length}` : '已完成' }}</span>
            </div>
            <p class="mt__guide-reason">{{ selectedTask.riskReason || '等待业务确认当前任务原因' }}</p>
            <div class="mt__guide-inline"><span>下一接棒</span><b>{{ selectedTask.nextActionLabel || selectedTask.mainActionLabel || '待业务确认' }}</b></div>
            <button
              type="button"
              class="mt__primary"
              :class="{ 'is-blocked': !selectedTask.allowed }"
              :disabled="saving"
              @click="handleMainAction(selectedTask)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V8l7-5 7 5v13" /><path d="M9 15l2 2 4-4" /></svg>
              {{ selectedTask.mainActionLabel || '暂不可执行' }}
            </button>
            <p class="mt__guide-note">{{ selectedTask.blockReason || selectedTask.completionHint || '完成后系统会重新读取任务事实。' }}</p>
            <div v-if="nextTask" class="mt__next-inline">
              <span>下一项</span>
              <button type="button" @click="selectTask(nextTask)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                查看下一项
              </button>
            </div>
          </section>

          <section class="mt__guide-card mt__guide-card--actions">
            <header class="mt__actions-head"><div><h4>客户操作</h4><small>在当前页面完成，不需要再搜索客户</small></div></header>
            <div class="mt__action-grid">
              <WorkbenchQuickAction
                tone="brand"
                title="打电话"
                :hint="selectedTask.telNo ? '立即联系客户' : '电话待补充'"
                :disabled="!selectedTask.telNo"
                @click="selectedTask.telNo && callCustomer(selectedTask.telNo)"
              >
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.8 2Z" /></svg></template>
              </WorkbenchQuickAction>
              <WorkbenchQuickAction tone="requirement" title="客户诉求" hint="记录客户的诉求与排斥点" @click="requirementOpen = true">
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v14H4z" /><path d="M8 9h8M8 13h8M8 17h4" /></svg></template>
              </WorkbenchQuickAction>
              <WorkbenchQuickAction tone="outline" title="完整档案" hint="查看历史与低频资料" @click="openCustomer360(selectedTask)">
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h5M8 16h8" /></svg></template>
              </WorkbenchQuickAction>
              <WorkbenchQuickAction tone="measure" title="维护房屋档案" hint="补全地址、面积或户型" @click="openPropertyForm(selectedTask)">
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V8l7-5 7 5v13" /><path d="M12 11.5v6M9 14.5h6" /></svg></template>
              </WorkbenchQuickAction>
              <WorkbenchQuickAction v-if="canManageDormant" tone="warn" title="暂不跟进" hint="设为休眠客户" @click="openDormantDrawer">
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z" /></svg></template>
              </WorkbenchQuickAction>
            </div>
          </section>
        </template>

        <WorkbenchState
          v-else
          title="等待选择量房任务"
          description="右侧会显示服务端风险原因、唯一主行动、完成回读和下一接棒。"
          min-height="280px"
        />
      </aside>
    </div>

    <RequirementFormDrawer
      v-model="requirementOpen"
      :customer-id="selectedTask ? String(selectedTask.customerId) : ''"
      :customer-name="selectedTask?.customerName || ''"
      :property-id="selectedTask?.propertyId ? String(selectedTask.propertyId) : ''"
      :property-name="selectedTask?.propertyLabel || ''"
      @saved="loadCustomerContext(selectedTask)"
    />

    <PropertyFormDrawer
      v-model="propertyDrawerOpen"
      :customer-id="propertyCustomerId"
      :customer-name="propertyCustomerName"
      :property="propertyEditing"
      @saved="onPropertySaved"
    />

    <el-drawer v-model="dormantOpen" title="设为休眠客户" size="520px" direction="rtl" append-to-body>
      <CustomerPropertyContext :customer="selectedTask ? { name: selectedTask.customerName || '客户待确认' } : null" :property="selectedTask?.propertyLabel ? { community: selectedTask.propertyLabel } : null" />
      <p class="mt__section-label">休眠设置</p>
      <p class="mt__drawer-hint">客户暂时不需要继续跟进时使用。休眠后不会再出现在待量房和跟进提醒里，后续可以恢复。</p>
      <el-form label-position="top">
        <el-form-item label="休眠原因" required>
          <el-select v-model="dormantForm.reasonCode" placeholder="请选择休眠原因" style="width: 100%">
            <el-option v-for="item in DORMANT_REASONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="dormantForm.reasonCode === 'Other'" label="补充说明" required>
          <el-input v-model="dormantForm.reasonText" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="请说明暂不跟进的原因" />
        </el-form-item>
      </el-form>
      <el-alert type="warning" :closable="false" title="如果客户存在未结束合同、状态不允许或数据范围越权，服务端会拒绝休眠并返回原因。" show-icon />
      <template #footer>
        <el-button @click="dormantOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="!dormantForm.reasonCode || (dormantForm.reasonCode === 'Other' && !dormantForm.reasonText.trim())" @click="saveDormant">确认设为休眠</el-button>
      </template>
    </el-drawer>

    <el-drawer v-model="scheduleOpen" :title="selectedTask?.scheduledAt ? '调整预约时间' : '安排量房'" size="520px" direction="rtl" append-to-body>
      <CustomerPropertyContext :customer="selectedTask ? { name: selectedTask.customerName || '客户待确认' } : null" :property="selectedTask?.propertyLabel ? { community: selectedTask.propertyLabel } : null" />
      <p class="mt__section-label">{{ selectedTask?.scheduledAt ? '调整预约' : '量房安排' }}</p>
      <p class="mt__drawer-hint">确认上门时间；量房会写入房屋级事实，并成为设计、报价的前置依据。</p>
      <el-form label-position="top">
        <el-form-item label="量房时间">
          <DateClockField v-model="scheduleForm.measureAt" date-placeholder="上门日期" time-placeholder="上门时间" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="scheduleOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="!scheduleForm.measureAt" @click="saveSchedule">确认安排</el-button>
      </template>
    </el-drawer>

    <el-drawer v-model="measureOpen" title="登记量房结论" size="680px" direction="rtl" append-to-body>
      <CustomerPropertyContext :customer="selectedTask ? { name: selectedTask.customerName || '客户待确认' } : null" :property="selectedTask?.propertyLabel ? { community: selectedTask.propertyLabel } : null" />
      <p class="mt__section-label">量房结论</p>
      <p class="mt__drawer-hint">现场事实先原样记录，保存后会回读房屋、客户派生标签和设计可用性。</p>
      <el-form label-position="top" class="mt__form-grid">
        <el-form-item label="量房时间" class="mt__form-wide"><DateClockField v-model="measureForm.measureTime" date-placeholder="量房日期" time-placeholder="量房时间" /></el-form-item>
        <el-form-item label="原始结构" class="mt__form-wide"><el-input v-model="measureForm.originalStructure" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="尺寸记录" class="mt__form-wide"><el-input v-model="measureForm.dimensions" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="客户诉求" class="mt__form-wide"><el-input v-model="measureForm.customerRequirements" type="textarea" :rows="3" placeholder="现场听到的需求、禁忌和偏好，先原样记录" /></el-form-item>
        <el-form-item label="设计师结论" class="mt__form-wide"><el-input v-model="measureForm.designerConclusion" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <div class="mt__uploads">
        <FileUploadField
          v-model="measureSiteFiles"
          business-type="Measure"
          label="现场照片"
          hint="现场实拍；点击缩略图可放大预览"
          accept="image/*"
          :max="9"
          @error="actionError = $event"
        />
        <FileUploadField
          v-model="measureStructureFiles"
          business-type="Measure"
          label="结构图"
          hint="结构图/户型图；图片可点击预览，PDF 新窗口打开"
          accept="image/*,.pdf"
          :max="9"
          @error="actionError = $event"
        />
        <FileUploadField
          v-model="measureAttachmentFiles"
          business-type="Measure"
          label="附件"
          hint="其他量房资料，单次最多 9 个"
          accept="*/*"
          :max="9"
          @error="actionError = $event"
        />
      </div>
      <template #footer>
        <el-button @click="measureOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveMeasure">保存量房结论</el-button>
      </template>
    </el-drawer>

    <el-drawer v-model="schemeOpen" title="新建设计方案" size="620px" direction="rtl" append-to-body>
      <CustomerPropertyContext :customer="selectedTask ? { name: selectedTask.customerName || '客户待确认' } : null" :property="selectedTask?.propertyLabel ? { community: selectedTask.propertyLabel } : null" />
      <p class="mt__section-label">方案信息</p>
      <p class="mt__drawer-hint">方案绑定当前客户与房屋，创建后直接进入设计工作区。</p>
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
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/workbench-shell' as wb;
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
.mt__drawer-hint { margin: 6px 0 14px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
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
.mt__filters small { color: $text-tertiary; font-variant-numeric: tabular-nums; }

.mt__layout { @include wb.workbench-layout(327px); }
.mt__queue { @include wb.workbench-queue; }
.mt__queue-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid $border-color; background: linear-gradient(135deg, $surface-50, $surface-0); }
.mt__queue-head div { display: flex; flex-direction: column; gap: 3px; }
.mt__queue-head strong { color: $text-primary; font-size: $font-body; }
.mt__queue-head small { color: $text-tertiary; font-size: $font-caption; }
.mt__queue-head > span { color: $brand-700; font-size: $font-title; font-weight: $font-weight-bold; }
.mt__task-list { display: flex; flex-direction: column; @include wb.workbench-queue-scroll; }
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
.mt__task-top { align-items: flex-start; }
.mt__task-property-title { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.mt__task-property-title strong { overflow: hidden; color: $text-primary; font-size: $font-body; text-overflow: ellipsis; white-space: nowrap; }
.mt__task-property-title small { overflow: hidden; color: $text-secondary; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; }
.mt__task-property-meta { color: $text-secondary; font-size: $font-caption; }
.mt__task-reason { overflow: hidden; color: $brand-700; font-size: $font-caption; font-weight: $font-weight-semibold; text-overflow: ellipsis; white-space: nowrap; }
.mt__task-customer { display: flex; align-items: center; justify-content: space-between; gap: $space-2; padding-top: 7px; border-top: 1px dashed $border-color; }
.mt__task-customer > span { display: flex; align-items: baseline; gap: 5px; min-width: 0; }
.mt__task-customer small { flex: 0 0 auto; color: $text-tertiary; font-size: $font-caption; }
.mt__task-customer strong { overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
.mt__task-meta small { color: $text-tertiary; font-size: $font-caption; }

.mt__workspace { @include wb.workbench-workspace; }
.mt__guide { @include wb.workbench-guide; }
.mt__guide-card { padding: 14px; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.mt__guide-card--primary { border-color: $brand-200; background: linear-gradient(135deg, $surface-0, $brand-50); }
.mt__guide-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; }
.mt__guide-title-row h3 { margin: 4px 0 0; color: $text-primary; font-size: $font-body; }
.mt__guide-order { padding: 3px 8px; border-radius: $radius-pill; background: $surface-100; color: $text-tertiary; font-size: $font-caption; }
.mt__guide-reason { display: -webkit-box; overflow: hidden; margin: 10px 0 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.mt__guide-inline { display: flex; align-items: center; gap: 6px; margin-top: 8px; padding: 7px 9px; border-radius: $radius-sm; background: $surface-50; }
.mt__guide-inline span { color: $text-tertiary; font-size: $font-caption; }
.mt__guide-inline b { color: $brand-700; font-size: $font-body-sm; }
.mt__guide-card h4 { margin: 0 0 8px; color: $text-primary; font-size: $font-body; }
.mt__guide-card p { margin: 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
.mt__guide-note { margin: 8px 0 0 !important; color: $text-tertiary !important; font-size: $font-caption !important; line-height: 1.5 !important; }
.mt__next-inline { display: flex; align-items: center; justify-content: space-between; gap: $space-2; margin-top: 10px; padding-top: 9px; border-top: 1px solid $border-color; }
.mt__next-inline span { color: $text-tertiary; font-size: $font-caption; }
.mt__next-inline button { display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: transparent; color: $brand-700; font: inherit; font-size: $font-caption; font-weight: $font-weight-semibold; cursor: pointer; }
.mt__hero-card { padding: 12px; border: 1px solid $border-color; border-radius: $radius-lg; background: linear-gradient(135deg, $brand-50, $surface-0 70%); }
.mt__hero-top { display: flex; align-items: flex-start; gap: $space-3; }
.mt__hero-avatar { width: 46px; height: 46px; flex: 0 0 auto; display: grid; place-items: center; border-radius: $radius-md; background: $brand-600; color: $surface-0; }
.mt__hero-avatar svg { width: 24px; height: 24px; }
.mt__hero-ident { flex: 1; min-width: 0; }
.mt__hero-name-row { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; }
.mt__hero-name-row h2 { margin: 0; color: $text-primary; font-size: $font-title; }
.mt__hero-contact { margin: 5px 0 0; color: $text-secondary; font-size: $font-body-sm; }
.mt__hero-layer--focus { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-top: 10px; }
.mt__hero-layer--background { margin-top: 10px; }
.mt__focus-item { min-width: 0; padding: 8px 10px; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; }
.mt__focus-item small { display: block; color: $text-tertiary; font-size: $font-caption; }
.mt__focus-item b { display: block; margin-top: 2px; overflow: hidden; color: $text-primary; font-size: $font-body-sm; font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }
.mt__focus-item span { display: -webkit-box; overflow: hidden; margin-top: 2px; color: $text-secondary; font-size: $font-caption; line-height: 1.5; -webkit-box-orient: vertical; -webkit-line-clamp: 1; }
.mt__focus-item--blocked { border-color: $status-blocked-border; background: $status-blocked-soft; }
.mt__focus-item--blocked b { color: $status-blocked; }
.mt__focus-item--pending { border-color: $status-pending-border; background: $status-pending-soft; }
.mt__focus-item--pending b { color: $status-pending; }
.mt__focus-item--info { border-color: $status-info-border; background: $status-info-soft; }
.mt__focus-item--info b { color: $status-info; }
.mt__facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.mt__facts article { min-width: 0; padding: 7px 9px; border-radius: $radius-sm; background: rgba(255, 255, 255, .72); }
.mt__facts small { display: block; color: $text-tertiary; font-size: $font-caption; }
.mt__facts b { display: block; margin-top: 3px; overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
.mt__primary { display: inline-flex; align-items: center; justify-content: center; gap: 6px; width: 100%; min-width: 140px; margin-top: 10px; padding: 11px 18px; border: 0; border-radius: $radius-sm; background: $brand-600; color: $surface-0; font: inherit; font-weight: $font-weight-semibold; cursor: pointer; }
.mt__primary svg { width: 16px; height: 16px; }
.mt__primary.is-blocked { background: $warning-500; }
.mt__primary.is-blocked:hover { background: $warning-700; }
.mt__primary:hover { background: $brand-700; }
.mt__primary:disabled { background: $line-200; color: $text-tertiary; cursor: not-allowed; }
.mt__secondary-actions { display: flex; flex-wrap: wrap; gap: $space-2; margin-top: 10px; }
.mt__secondary-actions button svg,
.mt__next-inline button svg { width: 14px; height: 14px; }
.mt__secondary-actions button.mt__action-warn { color: $warning-700; border-color: $warning-200; background: $warning-50; }
.mt__secondary-actions button.mt__action-warn:hover { border-color: $warning-500; background: #fff7e8; }
.mt__evidence { display: flex; align-items: center; justify-content: space-between; gap: $space-4; padding: 18px 20px; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.mt__evidence p { margin: 5px 0 0; color: $text-secondary; font-size: $font-body-sm; }
.mt__evidence dl { display: flex; gap: $space-5; margin: 0; }
.mt__evidence dt { color: $text-tertiary; font-size: $font-caption; }
.mt__evidence dd { margin: 4px 0 0; color: $text-primary; font-size: $font-body-sm; font-weight: $font-weight-semibold; }

.mt__evidence { display: flex; flex-direction: column; gap: $space-3; padding-top: $space-3; border-top: 1px solid $border-color; }
.mt__evidence-group { display: flex; flex-direction: column; gap: 6px; }
.mt__evidence-group small { color: $text-tertiary; font-size: $font-caption; }
.mt__evidence-thumbs { display: flex; flex-wrap: wrap; gap: 6px; }
.mt__evidence-thumb { width: 72px; height: 72px; border-radius: $radius-sm; overflow: hidden; cursor: zoom-in; }
.mt__evidence-files { display: flex; flex-wrap: wrap; gap: $space-2; }
.mt__evidence-files a { padding: 5px 9px; border: 1px solid $border-color; border-radius: $radius-sm; color: $brand-600; font-size: $font-caption; text-decoration: none; }
.mt__evidence-files a:hover { border-color: $brand-300; background: $brand-50; }
.mt__stage-block { display: flex; flex-direction: column; gap: $space-3; padding: $space-4; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.mt__stage-head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; }
.mt__stage-head strong { color: $text-primary; font-size: $font-body; }
.mt__stage-head small { display: block; margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }
.mt__stage-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: $space-3; margin: 0; }
.mt__stage-grid > div { min-width: 0; padding: 10px 12px; border-radius: $radius-md; background: $surface-50; }
.mt__stage-grid dt { color: $text-tertiary; font-size: $font-caption; }
.mt__stage-grid dd { margin: 4px 0 0; overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; }
.mt__stage-wide { grid-column: 1 / -1; }
.mt__stage-inner { min-width: 0; }
.mt__customer-block { display: flex; flex-direction: column; gap: $space-3; }
.mt__hero-sep { color: $text-tertiary; font-size: $font-body-sm; }
/* 对象优先：房屋名与明细($font-h1=20px) 大于 客户名($font-title=18px) */
.mt__hero-house { color: $text-primary; font-size: $font-h1; font-weight: $font-weight-bold; letter-spacing: -.01em; }
.mt__hero-house-detail { color: $text-secondary; font-size: $font-h1; font-weight: $font-weight-semibold; }
.mt__text-button { padding: 0; border: 0; background: transparent; color: $brand-600; font: inherit; font-size: $font-caption; font-weight: $font-weight-semibold; cursor: pointer; }
.mt__actions-head { margin-bottom: 8px; }
.mt__actions-head h4 { margin: 0; color: $text-primary; font-size: $font-body; }
.mt__actions-head small { display: block; margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }
.mt__action-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.mt__customer { display: flex; flex-direction: column; gap: $space-3; padding: $space-4; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.mt__customer-head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; }
.mt__customer-head strong { color: $text-primary; font-size: $font-body; }
.mt__customer-head small { display: block; margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }
.mt__customer-head button,
.mt__customer-action { display: inline-flex; align-items: center; gap: 5px; flex: 0 0 auto; padding: 6px 10px; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; color: $brand-600; font: inherit; font-size: $font-caption; cursor: pointer; }
.mt__customer-head button:hover,
.mt__customer-action:hover { border-color: $brand-300; background: $brand-50; }
.mt__customer-head button svg,
.mt__customer-action svg { width: 13px; height: 13px; flex: 0 0 auto; }
.mt__customer-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-3; }
.mt__customer-col { display: flex; flex-direction: column; gap: $space-2; min-width: 0; padding: 12px 13px; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-50; }
.mt__customer-col h4 { margin: 0; color: $text-primary; font-size: $font-body-sm; }
.mt__customer-col dl { display: grid; gap: 5px; margin: 0; }
.mt__customer-col dl div { display: flex; align-items: baseline; justify-content: space-between; gap: $space-2; }
.mt__customer-col dt { flex: 0 0 auto; color: $text-tertiary; font-size: $font-caption; }
.mt__customer-col dd { margin: 0; overflow: hidden; color: $text-primary; font-size: $font-caption; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
.mt__portrait-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.mt__portrait-chips > span { display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; border-radius: $radius-pill; background: $surface-0; color: $text-secondary; font-size: $font-caption; }
.mt__portrait-chips small { color: $text-tertiary; }
.mt__customer-empty { margin: 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.mt__follows,
.mt__requirements { display: flex; flex-direction: column; gap: $space-2; }
.mt__follow,
.mt__requirement { display: flex; flex-direction: column; gap: 3px; padding: 8px 10px; border-radius: $radius-sm; background: $surface-0; }
.mt__follow small { color: $text-tertiary; font-size: $font-caption; }
.mt__follow p,
.mt__requirement p { margin: 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.mt__follow em { color: $brand-700; font-size: $font-caption; font-style: normal; }
.mt__requirement > div { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.mt__requirement strong { overflow: hidden; color: $text-primary; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; }
.mt__requirement small { color: $text-tertiary; font-size: $font-caption; }
.mt__customer-action { align-self: flex-start; margin-top: 2px; }
.mt__skeleton { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: $space-4; }
.mt__skeleton span { height: 170px; border-radius: $radius-md; background: linear-gradient(90deg, $surface-100 25%, $surface-50 37%, $surface-100 63%); background-size: 400% 100%; animation: mt-shimmer 1.4s ease infinite; }
@keyframes mt-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }

.mt__form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-3; }
.mt__form-wide { grid-column: 1 / -1; }
.mt__uploads { display: flex; flex-direction: column; gap: $space-4; margin-top: $space-3; }

@media (max-width: 1280px) {
  .mt__hero-layer--focus { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mt__facts { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 1024px) {
  .mt__tools,
  .mt__evidence { align-items: stretch; flex-direction: column; }
  .mt__hero-layer--focus { grid-template-columns: 1fr; }
  .mt__facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mt__customer-grid { grid-template-columns: 1fr; }
  .mt__stage-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mt__primary { width: 100%; }
}
</style>
