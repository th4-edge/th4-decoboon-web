<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import EmptyState from '@/components/EmptyState.vue'
import FileUploadField from '@/components/form/FileUploadField.vue'
import ProjectFactPhasePanel from '@/components/project/ProjectFactPhasePanel.vue'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmployeePicker from '@/components/picker/EmployeePicker.vue'
import { formatDateTime } from '@/core/format'
import { projectApi, type TaskNodeKey } from '@/domains/project/api'
import type { ProjectBrief, ProjectFactNode, ProjectStage, ProjectTask, SiteReport } from '@/domains/project/model'
import type { UploadedFile } from '@/domains/file/model'
import { useSessionStore } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const projects = ref<ProjectBrief[]>([])
const selectedProjectId = ref(typeof route.query.projectId === 'string' ? route.query.projectId : '')
const selectedProject = ref<ProjectBrief | null>(null)
const stages = ref<ProjectStage[]>([])
const tasks = ref<ProjectTask[]>([])
const reports = ref<SiteReport[]>([])
const loading = ref(false)
const contextLoading = ref(false)
const error = ref('')
const actionError = ref('')
const factError = ref('')
const workspaceView = ref<WorkspaceView>(route.query.view === 'facts' ? 'facts' : 'execution')
const factAnchor = ref(typeof route.query.anchor === 'string' ? route.query.anchor : '')

type WorkspaceView = 'facts' | 'execution'

interface FactRouteTarget {
  name: string
  params?: Record<string, string>
  query?: Record<string, string>
}

const selectedTask = ref<ProjectTask | null>(null)
const taskLoading = ref(false)
const taskError = ref('')

const scheduleVisible = ref(false)
const scheduleSaving = ref(false)
const scheduleError = ref('')
const scheduleForm = reactive({
  taskId: '',
  stageId: '',
  plannedStart: '',
  plannedEnd: '',
  ownerId: '',
  priority: '',
  remark: ''
})

const nodeVisible = ref(false)
const nodeSaving = ref(false)
const nodeError = ref('')
const nodeTask = ref<ProjectTask | null>(null)
const nodeKey = ref<TaskNodeKey>('Start')
const nodeNote = ref('')
const nodeFiles = ref<UploadedFile[]>([])

const reportVisible = ref(false)
const reportSaving = ref(false)
const reportError = ref('')
const reportForm = reactive({
  stageId: '',
  taskId: '',
  title: '',
  content: '',
  visibleToCustomer: true
})
const reportFiles = ref<UploadedFile[]>([])

const canSchedule = computed(() => ['Boss', 'StoreManager', 'Designer', 'Pm'].includes(session.role ?? ''))
const canEvidence = computed(() => ['Boss', 'StoreManager', 'Pm'].includes(session.role ?? ''))
const canReport = canEvidence

const groupedTasks = computed(() => {
  const map = new Map<string, ProjectTask[]>()
  for (const task of tasks.value) {
    const rows = map.get(task.stageId) ?? []
    rows.push(task)
    map.set(task.stageId, rows)
  }
  for (const rows of map.values()) {
    rows.sort((left, right) => String(left.plannedStart ?? '').localeCompare(String(right.plannedStart ?? ''))
      || left.name.localeCompare(right.name, 'zh-CN'))
  }
  return map
})

const nodeState = computed(() => {
  const nodes = selectedTask.value?.nodes ?? []
  return {
    Start: nodes.find((node) => node.key === 'Start') ?? null,
    Conceal: nodes.find((node) => node.key === 'Conceal') ?? null,
    Finish: nodes.find((node) => node.key === 'Finish') ?? null
  }
})

const sortedReports = computed(() => [...reports.value]
  .sort((left, right) => String(right.reportAt ?? '').localeCompare(String(left.reportAt ?? ''))))

function projectStatusLabel(status: string): string {
  return ({ preparing: '待开工', ongoing: '施工中', suspended: '已停工', accepting: '待验收', finished: '已完工', settled: '已结算' } as Record<string, string>)[status] ?? '暂不可确认'
}

function projectStatusTone(status: string) {
  return ({ preparing: 'info', ongoing: 'alert', suspended: 'blocked', accepting: 'pending', finished: 'done', settled: 'dark' } as const)[status as 'preparing' | 'ongoing' | 'suspended' | 'accepting' | 'finished' | 'settled'] ?? 'info'
}

function stageStatusLabel(status: string): string {
  return ({ todo: '待开始', doing: '进行中', accepting: '待验收', done: '已完成', cancelled: '已取消', notApplicable: '本项不涉及' } as Record<string, string>)[status] ?? '暂不可确认'
}

function taskStatusLabel(status: string): string {
  return ({ Todo: '待开始', Doing: '进行中', Accepting: '待确认', Done: '已完成', Cancelled: '已取消' } as Record<string, string>)[status] ?? '暂不可确认'
}

function dateText(value?: string): string {
  if (!value) return '待补充'
  const text = formatDateTime(value)
  return text === '暂不可确认' ? text : text.slice(0, 10)
}

function errorMessage(value: unknown, fallback: string): string {
  return value instanceof Error ? value.message : fallback
}

function taskNodeLabel(key: string): string {
  return ({ Start: '施工进行', Conceal: '隐蔽工程', Finish: '施工完成' } as Record<string, string>)[key] ?? key
}

function canConfirmNode(key: TaskNodeKey, task: ProjectTask | null): boolean {
  if (!task || !canEvidence.value) return false
  if (key === 'Start') return task.status === 'Todo' && !nodeState.value.Start
  if (key === 'Conceal') return task.conceal === true && task.status === 'Doing' && Boolean(nodeState.value.Start) && !nodeState.value.Conceal
  return (task.status === 'Doing' || task.status === 'Accepting')
    && Boolean(nodeState.value.Start)
    && (!task.conceal || Boolean(nodeState.value.Conceal))
    && !nodeState.value.Finish
}

function nodeHint(key: TaskNodeKey, task: ProjectTask | null): string {
  if (!task) return '请先选择任务'
  if (nodeState.value[key]) return `已于 ${dateText(nodeState.value[key]?.confirmedAt)} 完成`
  if (key === 'Conceal' && !task.conceal) return '本合同任务不涉及隐蔽节点'
  if (key === 'Conceal' && task.status === 'Todo') return '先完成施工进行节点'
  if (key === 'Finish' && task.conceal && !nodeState.value.Conceal) return '先完成隐蔽工程节点'
  return '照片或视频必填'
}

function routeIfAvailable(name: string, params?: Record<string, string>, query?: Record<string, string>): FactRouteTarget | null {
  return router.hasRoute(name) ? { name, params, query } : null
}

function factAnchorId(nodeId: string): string {
  return `fact-anchor-${nodeId.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

function localFactAnchor(node: ProjectFactNode): string | null {
  if (node.factType === 'Stage') return `execution-stage-${node.objectId}`
  if (node.factType === 'Task') return `execution-task-${node.objectId}`
  if (node.factType === 'SiteReport') return 'execution-report'
  return null
}

function factRouteTarget(node: ProjectFactNode): FactRouteTarget | null {
  const projectId = selectedProjectId.value
  const customerId = selectedProject.value?.customerId
  const propertyId = selectedProject.value?.propertyId
  switch (node.factType) {
    case 'Customer':
      return routeIfAvailable('designer-customer-360', { customerId: node.objectId })
    case 'Property':
      return customerId
        ? routeIfAvailable('designer-customer-360', { customerId }, { propertyId: node.objectId })
        : null
    case 'Measure':
      return routeIfAvailable('designer-measure', undefined, { projectId, customerId: customerId ?? '', propertyId: propertyId ?? '' })
    case 'Design':
      return routeIfAvailable('designer-design-workspace', { designId: node.objectId })
    case 'Quote':
    case 'QuoteAcceptance':
      return routeIfAvailable('designer-quote-workspace', { quoteId: node.objectId })
    case 'Contract':
      return routeIfAvailable('designer-contract', undefined, { projectId, contractId: node.objectId })
    case 'MaterialSelection':
      return routeIfAvailable('workbench-material-selection', { projectId })
    case 'Purchase':
      return routeIfAvailable('finance-material-ordering', undefined, { projectId })
    case 'ContractChange':
      return routeIfAvailable('workbench-contract-changes', undefined, { projectId })
    case 'Acceptance':
    case 'Rectification':
    case 'Reinspection':
      return routeIfAvailable('pm-project-acceptance', { projectId })
    case 'Receivable':
    case 'Receipt':
    case 'Payable':
    case 'Payment':
    case 'Cost':
    case 'ProfitSettlement':
      return routeIfAvailable('finance-project', { projectId })
    case 'Feedback':
      return routeIfAvailable('workbench-customer-feedback', undefined, { projectId })
    default:
      return null
  }
}

function canOpenFactNode(node: ProjectFactNode): boolean {
  return Boolean(localFactAnchor(node) || factRouteTarget(node))
}

function scrollToAnchor(anchor: string): void {
  if (!anchor) return
  nextTick(() => {
    const target = document.getElementById(anchor)
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

async function syncWorkspaceRoute(): Promise<void> {
  if (!selectedProjectId.value) return
  const query: Record<string, string> = { projectId: selectedProjectId.value }
  if (workspaceView.value === 'facts') query.view = 'facts'
  if (factAnchor.value) query.anchor = factAnchor.value
  await router.replace({ path: '/workbench/project-execution', query })
}

async function switchWorkspaceView(view: WorkspaceView): Promise<void> {
  if (workspaceView.value === view) return
  workspaceView.value = view
  factAnchor.value = ''
  await syncWorkspaceRoute()
}

async function openFactNode(node: ProjectFactNode): Promise<void> {
  const localAnchor = localFactAnchor(node)
  if (localAnchor) {
    workspaceView.value = 'execution'
    factAnchor.value = localAnchor
    await syncWorkspaceRoute()
    scrollToAnchor(localAnchor)
    return
  }

  const target = factRouteTarget(node)
  if (!target) return
  const anchor = factAnchorId(node.nodeId)
  workspaceView.value = 'facts'
  factAnchor.value = anchor
  const returnQuery = { projectId: selectedProjectId.value, view: 'facts', anchor }
  const returnPath = router.resolve({ name: 'workbench-project-execution', query: returnQuery }).fullPath
  await router.replace({ name: 'workbench-project-execution', query: returnQuery })
  await router.push({
    name: target.name,
    params: target.params,
    query: { ...(target.query ?? {}), returnPath, returnAnchor: anchor }
  })
}

async function loadProjects(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    projects.value = await projectApi.listProjects()
    const requested = projects.value.find((project) => project.id === selectedProjectId.value)
    if (requested) await selectProject(requested.id, false)
  } catch (value) {
    error.value = errorMessage(value, '项目列表暂不可确认，请稍后重试')
  } finally {
    loading.value = false
  }
}

async function selectProject(projectId: string, updateRoute = true): Promise<void> {
  if (!projectId) return
  if (updateRoute) factAnchor.value = ''
  selectedProjectId.value = projectId
  if (updateRoute) await syncWorkspaceRoute()
  selectedTask.value = null
  taskError.value = ''
  actionError.value = ''
  factError.value = ''
  contextLoading.value = true
  try {
    const [project, stageRows, taskRows, reportRows] = await Promise.all([
      projectApi.projectInfo(projectId),
      projectApi.listStages(projectId),
      projectApi.listTasks(projectId),
      projectApi.listReports(projectId)
    ])
    selectedProject.value = project
    stages.value = stageRows.sort((left, right) => left.sort - right.sort)
    tasks.value = taskRows
    reports.value = reportRows
    factError.value = project.factTrace ? '' : '项目事实暂不可确认，请重新读取后再试。'
  } catch (value) {
    selectedProject.value = null
    stages.value = []
    tasks.value = []
    reports.value = []
    error.value = errorMessage(value, '项目履约上下文暂不可确认')
  } finally {
    contextLoading.value = false
    if (selectedProject.value && factAnchor.value) scrollToAnchor(factAnchor.value)
  }
}

async function reloadCurrentProject(): Promise<void> {
  if (selectedProjectId.value) await selectProject(selectedProjectId.value, false)
}

async function openTask(task: ProjectTask): Promise<void> {
  selectedTask.value = task
  taskLoading.value = true
  taskError.value = ''
  try {
    selectedTask.value = await projectApi.taskInfo(task.id)
  } catch (value) {
    taskError.value = errorMessage(value, '任务节点暂不可确认')
  } finally {
    taskLoading.value = false
  }
}

function openSchedule(task: ProjectTask): void {
  if (!canSchedule.value) return
  scheduleForm.taskId = task.id
  scheduleForm.stageId = task.stageId
  scheduleForm.plannedStart = task.plannedStart ?? ''
  scheduleForm.plannedEnd = task.plannedEnd ?? ''
  scheduleForm.ownerId = task.ownerId ?? ''
  scheduleForm.priority = task.priority ?? ''
  scheduleForm.remark = task.remark ?? ''
  scheduleError.value = ''
  scheduleVisible.value = true
}

async function saveSchedule(): Promise<void> {
  if (!selectedProjectId.value || !scheduleForm.taskId || !scheduleForm.stageId) {
    scheduleError.value = '任务、项目或阶段缺失，请重新读取后重试'
    return
  }
  if (scheduleForm.plannedStart && scheduleForm.plannedEnd && scheduleForm.plannedStart > scheduleForm.plannedEnd) {
    scheduleError.value = '计划开始日期不能晚于计划结束日期'
    return
  }
  scheduleSaving.value = true
  scheduleError.value = ''
  try {
    await projectApi.saveTaskSchedule({
      taskId: scheduleForm.taskId,
      projectId: selectedProjectId.value,
      stageId: scheduleForm.stageId,
      plannedStart: scheduleForm.plannedStart,
      plannedEnd: scheduleForm.plannedEnd,
      ownerId: scheduleForm.ownerId,
      priority: scheduleForm.priority,
      remark: scheduleForm.remark
    })
    scheduleVisible.value = false
    ElMessage.success('施工任务排期已更新')
    await reloadCurrentProject()
    const updated = tasks.value.find((task) => task.id === scheduleForm.taskId)
    if (updated) await openTask(updated)
  } catch (value) {
    scheduleError.value = errorMessage(value, '排期保存失败，请重新读取后重试')
  } finally {
    scheduleSaving.value = false
  }
}

async function prepareNode(task: ProjectTask, key: TaskNodeKey): Promise<void> {
  if (!canEvidence.value) return
  await openTask(task)
  nodeTask.value = selectedTask.value
  nodeKey.value = key
  nodeNote.value = ''
  nodeFiles.value = []
  nodeError.value = ''
  nodeVisible.value = true
}

async function submitNode(): Promise<void> {
  const task = nodeTask.value
  if (!task || !nodeFiles.value.length) {
    nodeError.value = '施工节点必须上传照片或视频'
    return
  }
  nodeSaving.value = true
  nodeError.value = ''
  try {
    await projectApi.confirmTaskNode({
      taskId: task.id,
      key: nodeKey.value,
      note: nodeNote.value,
      paths: nodeFiles.value.map((file) => file.path)
    })
    nodeVisible.value = false
    ElMessage.success(`${taskNodeLabel(nodeKey.value)}节点已留证`)
    await reloadCurrentProject()
    const updated = tasks.value.find((item) => item.id === task.id)
    if (updated) await openTask(updated)
  } catch (value) {
    nodeError.value = errorMessage(value, '节点留证失败，请重新读取后重试')
  } finally {
    nodeSaving.value = false
  }
}

function openReport(): void {
  if (!canReport.value) return
  reportForm.stageId = selectedTask.value?.stageId ?? stages.value.find((stage) => stage.status === 'doing')?.id ?? ''
  reportForm.taskId = selectedTask.value?.id ?? ''
  reportForm.title = ''
  reportForm.content = ''
  reportForm.visibleToCustomer = true
  reportFiles.value = []
  reportError.value = ''
  reportVisible.value = true
}

async function submitReport(): Promise<void> {
  if (!selectedProjectId.value || !reportForm.title.trim() || !reportForm.content.trim()) {
    reportError.value = '请填写日报标题和现场内容'
    return
  }
  reportSaving.value = true
  reportError.value = ''
  try {
    await projectApi.saveProjectReport({
      projectId: selectedProjectId.value,
      stageId: reportForm.stageId || undefined,
      taskId: reportForm.taskId || undefined,
      title: reportForm.title,
      content: reportForm.content,
      paths: reportFiles.value.map((file) => file.path),
      visibleToCustomer: reportForm.visibleToCustomer
    })
    reportVisible.value = false
    ElMessage.success('现场日报已发布')
    reports.value = await projectApi.listReports(selectedProjectId.value)
  } catch (value) {
    reportError.value = errorMessage(value, '日报发布失败，请重新读取后重试')
  } finally {
    reportSaving.value = false
  }
}

watch(
  () => [route.query.projectId, route.query.view, route.query.anchor] as const,
  ([projectId, view, anchor]) => {
    workspaceView.value = view === 'facts' ? 'facts' : 'execution'
    factAnchor.value = typeof anchor === 'string' ? anchor : ''
    if (typeof projectId === 'string' && projectId && projectId !== selectedProjectId.value) {
      void selectProject(projectId, false)
    } else if (factAnchor.value) {
      scrollToAnchor(factAnchor.value)
    }
  }
)

onMounted(async () => {
  await loadProjects()
})
</script>

<template>
  <div class="execution-page">
    <section class="execution-hero">
      <div>
        <p>项目施工履约</p>
        <h2>施工排期与现场留证</h2>
        <span>同一角色在 App/Web 使用同一套业务动作；任务由合同施工行生成，不能手工新增或删除，范围变化请发起增减项。</span>
      </div>
      <StatusTag tone="info" :text="`${projects.length} 个项目`" />
    </section>

    <el-alert v-if="error" type="error" :closable="false" show-icon :title="error" />
    <el-alert v-if="actionError" type="error" :closable="false" show-icon :title="actionError" />

    <div class="execution-layout">
      <PanelCard title="选择项目" description="只展示当前账号数据范围内的项目" flush>
        <el-skeleton v-if="loading" :rows="6" animated class="execution-loading" />
        <EmptyState v-else-if="!projects.length" title="当前没有可见项目" description="请确认项目负责人、项目成员和数据范围。" />
        <div v-else class="project-list">
          <button
            v-for="project in projects"
            :key="project.id"
            type="button"
            :class="{ active: project.id === selectedProjectId }"
            @click="selectProject(project.id)"
          >
            <span class="project-list__top">
              <strong>{{ project.name || '未命名项目' }}</strong>
              <StatusTag :tone="projectStatusTone(project.status)" :text="projectStatusLabel(project.status)" />
            </span>
            <span>{{ project.customerName || '客户待完善' }} · {{ project.community || project.propertyName || '地址待完善' }}</span>
            <small>{{ project.customerName || project.address || '项目信息待补充' }}</small>
          </button>
        </div>
      </PanelCard>

      <div class="execution-workspace">
        <PanelCard
          title="项目履约工作面"
          :description="selectedProject ? selectedProject.name : '请选择项目后查看施工阶段与任务'"
        >
          <EmptyState v-if="!selectedProject" title="尚未选择项目" description="刷新后通过 projectId 恢复当前项目。" />
          <el-skeleton v-else-if="contextLoading" :rows="10" animated />
          <div v-else class="workspace-stack">
            <section class="workspace-head">
              <div>
                <small>当前阶段</small>
                <strong>{{ stages.find((stage) => ['doing', 'accepting'].includes(stage.status))?.name || stages.find((stage) => stage.status === 'todo')?.name || '暂不可确认' }}</strong>
              </div>
              <div class="workspace-head__actions">
                <el-button v-if="canReport && workspaceView === 'execution'" type="primary" @click="openReport">发布现场日报</el-button>
                <el-button @click="reloadCurrentProject">刷新</el-button>
              </div>
            </section>

            <div class="workspace-view-switch" role="tablist" aria-label="项目视图">
              <button type="button" role="tab" :aria-selected="workspaceView === 'facts'" :class="{ active: workspaceView === 'facts' }" @click="switchWorkspaceView('facts')">PHASE 事实</button>
              <button type="button" role="tab" :aria-selected="workspaceView === 'execution'" :class="{ active: workspaceView === 'execution' }" @click="switchWorkspaceView('execution')">施工执行</button>
            </div>

            <ProjectFactPhasePanel
              v-if="workspaceView === 'facts'"
              :trace="selectedProject.factTrace"
              :error="factError"
              :focus-anchor="factAnchor"
              :can-open="canOpenFactNode"
              @open="openFactNode"
              @retry="reloadCurrentProject"
            />

            <template v-else>
            <EmptyState v-if="!stages.length" title="当前项目暂无施工阶段" description="合同生效并立项后会生成施工阶段。" />
            <section v-for="stage in stages" :id="`execution-stage-${stage.id}`" :key="stage.id" class="stage-block">
              <header>
                <div>
                  <strong>{{ stage.name }}</strong>
                  <small>{{ stageStatusLabel(stage.status) }} · {{ dateText(stage.plannedStart) }} → {{ dateText(stage.plannedEnd) }}</small>
                </div>
                <span>{{ stage.progress }}%</span>
              </header>
              <div v-if="!groupedTasks.get(stage.id)?.length" class="stage-empty">当前阶段暂无施工任务</div>
              <div v-else class="task-table">
                <div class="task-row task-row--head">
                  <span>施工任务</span><span>状态</span><span>负责人</span><span>计划</span><span>动作</span>
                </div>
                <div v-for="task in groupedTasks.get(stage.id)" :id="`execution-task-${task.id}`" :key="task.id" class="task-row">
                  <span class="task-name">
                    <strong>{{ task.name }}</strong>
                    <small>{{ task.quantity || '—' }} {{ task.unit || '' }} · {{ task.progress }}%</small>
                  </span>
                  <span><StatusTag tone="info" :text="taskStatusLabel(task.status)" /></span>
                  <span>{{ task.ownerName || '责任人待确认' }}</span>
                  <span>{{ dateText(task.plannedStart) }} → {{ dateText(task.plannedEnd) }}</span>
                  <span class="task-actions">
                    <el-button v-if="canSchedule" link type="primary" @click="openSchedule(task)">调整排期</el-button>
                    <el-button v-if="canEvidence" link type="primary" @click="openTask(task)">节点留证</el-button>
                  </span>
                </div>
              </div>
            </section>

            <section v-if="selectedTask" class="task-detail">
              <header>
                <div>
                  <small>任务节点</small>
                  <strong>{{ selectedTask.name }}</strong>
                </div>
                <span>{{ taskStatusLabel(selectedTask.status) }}</span>
              </header>
              <el-skeleton v-if="taskLoading" :rows="3" animated />
              <el-alert v-else-if="taskError" type="warning" :closable="false" :title="taskError" show-icon />
              <div v-else class="node-grid">
                <article v-for="key in (['Start', 'Conceal', 'Finish'] as TaskNodeKey[])" :key="key" class="node-card">
                  <div>
                    <strong>{{ taskNodeLabel(key) }}</strong>
                    <small>{{ nodeHint(key, selectedTask) }}</small>
                  </div>
                  <StatusTag :tone="nodeState[key] ? 'done' : canConfirmNode(key, selectedTask) ? 'pending' : 'info'" :text="nodeState[key] ? '已留证' : canConfirmNode(key, selectedTask) ? '可留证' : '待前置'" />
                  <el-button
                    v-if="canConfirmNode(key, selectedTask)"
                    size="small"
                    type="primary"
                    @click="prepareNode(selectedTask, key)"
                  >上传留证</el-button>
                </article>
              </div>
            </section>

            <section id="execution-report" class="report-block">
              <header>
                <div>
                  <small>现场动态</small>
                  <strong>最近日报</strong>
                </div>
                <el-button v-if="canReport" link type="primary" @click="openReport">发布日报</el-button>
              </header>
              <EmptyState v-if="!sortedReports.length" title="暂无现场日报" description="项目经理、企业负责人或店长可发布；空列表不代表尚未施工。" />
              <div v-else class="report-list">
                <article v-for="report in sortedReports.slice(0, 6)" :key="report.id">
                  <div>
                    <strong>{{ report.title }}</strong>
                    <small>{{ report.authorName || '记录人待确认' }} · {{ dateText(report.reportAt) }}</small>
                  </div>
                  <p>{{ report.content }}</p>
                </article>
              </div>
            </section>
            </template>
          </div>
        </PanelCard>
      </div>
    </div>

    <el-dialog v-model="scheduleVisible" title="调整施工排期" width="min(640px, 94vw)" append-to-body>
      <el-alert v-if="scheduleError" type="warning" :closable="false" :title="scheduleError" show-icon />
      <el-form label-position="top" class="dialog-form">
        <el-form-item label="所属阶段" required>
          <el-select v-model="scheduleForm.stageId" filterable>
            <el-option v-for="stage in stages" :key="stage.id" :label="`${stage.sort}. ${stage.name}`" :value="stage.id" />
          </el-select>
        </el-form-item>
        <div class="dialog-form__grid">
          <el-form-item label="计划开始">
            <el-date-picker v-model="scheduleForm.plannedStart" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
          </el-form-item>
          <el-form-item label="计划结束">
            <el-date-picker v-model="scheduleForm.plannedEnd" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
          </el-form-item>
        </div>
        <el-form-item label="任务责任人">
          <EmployeePicker
            v-model="scheduleForm.ownerId"
            source="directory"
            :roles="['Boss', 'StoreManager', 'Pm', 'Designer', 'Marketer']"
            title="选择任务责任人"
            placeholder="不改变时留空"
            clearable
          />
        </el-form-item>
        <div class="dialog-form__grid">
          <el-form-item label="优先级"><el-input v-model="scheduleForm.priority" maxlength="32" /></el-form-item>
          <el-form-item label="备注"><el-input v-model="scheduleForm.remark" maxlength="500" /></el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="scheduleVisible = false">取消</el-button>
        <el-button type="primary" :loading="scheduleSaving" @click="saveSchedule">保存排期</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="nodeVisible" :title="`${taskNodeLabel(nodeKey)} · 节点留证`" width="min(720px, 94vw)" append-to-body>
      <p class="dialog-hint">每个现场节点只能完成一次，请上传照片或视频；提交失败时刷新后重试。</p>
      <el-alert v-if="nodeError" type="warning" :closable="false" :title="nodeError" show-icon />
      <el-form label-position="top">
        <el-form-item label="现场说明">
          <el-input v-model="nodeNote" type="textarea" :rows="3" maxlength="512" show-word-limit placeholder="说明当前施工节点事实" />
        </el-form-item>
      </el-form>
      <FileUploadField
        v-model="nodeFiles"
        business-type="Task"
        :project-id="selectedProjectId"
        label="节点证据"
        hint="照片可预览，视频以文件形式打开"
        accept="image/*,video/*"
        :max="12"
        @error="nodeError = $event"
      />
      <template #footer>
        <el-button @click="nodeVisible = false">取消</el-button>
        <el-button type="primary" :loading="nodeSaving" :disabled="!nodeFiles.length" @click="submitNode">确认留证</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="reportVisible" title="发布现场日报" width="min(720px, 94vw)" append-to-body>
      <el-alert v-if="reportError" type="warning" :closable="false" :title="reportError" show-icon />
      <el-form label-position="top" class="dialog-form">
        <el-form-item label="日报标题" required>
          <el-input v-model="reportForm.title" maxlength="128" placeholder="例如：水电开槽完成，明日布管" />
        </el-form-item>
        <el-form-item label="现场内容" required>
          <el-input v-model="reportForm.content" type="textarea" :rows="4" maxlength="1024" show-word-limit placeholder="记录今天完成的工作、现场问题和下一步" />
        </el-form-item>
        <div class="dialog-form__grid">
          <el-form-item label="所属阶段">
            <el-select v-model="reportForm.stageId" clearable>
              <el-option v-for="stage in stages" :key="stage.id" :label="stage.name" :value="stage.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="关联任务">
            <el-select v-model="reportForm.taskId" clearable filterable>
              <el-option v-for="task in tasks" :key="task.id" :label="task.name" :value="task.id" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="业主可见">
          <el-switch v-model="reportForm.visibleToCustomer" active-text="业主可查看摘要" inactive-text="仅内部可见" />
        </el-form-item>
      </el-form>
      <FileUploadField
        v-model="reportFiles"
        business-type="Report"
        :project-id="selectedProjectId"
        label="现场照片或视频"
        accept="image/*,video/*"
        :max="12"
        @error="reportError = $event"
      />
      <template #footer>
        <el-button @click="reportVisible = false">取消</el-button>
        <el-button type="primary" :loading="reportSaving" @click="submitReport">发布日报</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.execution-page { display: flex; flex-direction: column; gap: $space-4; }
.execution-hero { display: flex; align-items: center; justify-content: space-between; gap: $space-4; padding: $space-5; border: 1px solid $border-color; border-radius: $radius-md; background: linear-gradient(135deg, $brand-50 0%, $surface-0 72%); p { margin: 0 0 $space-1; color: $brand-600; font-size: $font-caption; font-weight: $font-weight-semibold; letter-spacing: .08em; } h2 { margin: 0 0 $space-1; font-size: $font-display; } span { color: $text-secondary; font-size: $font-body-sm; } }
.execution-layout { display: grid; grid-template-columns: minmax(280px, 340px) minmax(0, 1fr); gap: $space-4; align-items: start; }
.execution-loading { padding: $space-4; }
.project-list { display: flex; flex-direction: column; }
.project-list button { display: flex; flex-direction: column; gap: 5px; padding: $space-4; border: 0; border-bottom: 1px solid $border-color; background: transparent; color: $text-secondary; text-align: left; cursor: pointer; &:hover, &.active { background: $brand-50; } &:last-child { border-bottom: 0; } > span:not(.project-list__top), small { overflow: hidden; color: $text-secondary; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; } small { color: $text-tertiary; } }
.project-list__top { display: flex; align-items: center; justify-content: space-between; gap: $space-2; strong { overflow: hidden; color: $text-primary; text-overflow: ellipsis; white-space: nowrap; } }
.execution-workspace { min-width: 0; }
.workspace-stack { display: flex; flex-direction: column; gap: $space-4; }
.workspace-head { display: flex; align-items: center; justify-content: space-between; gap: $space-4; padding: $space-4; border: 1px solid $brand-200; border-radius: $radius-md; background: $brand-50; small, strong { display: block; } small { color: $text-secondary; font-size: $font-caption; } strong { margin-top: $space-1; font-size: $font-card-title; } }
.workspace-head__actions { display: flex; gap: $space-2; }
.workspace-view-switch { display: flex; gap: 4px; width: fit-content; padding: 4px; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-50; }
.workspace-view-switch button { padding: 7px 12px; border: 0; border-radius: calc(#{$radius-sm} - 2px); background: transparent; color: $text-secondary; font: inherit; font-size: $font-body-sm; cursor: pointer; }
.workspace-view-switch button.active { background: $surface-0; color: $brand-700; box-shadow: $shadow-card; font-weight: $font-weight-semibold; }
.stage-block, .task-detail, .report-block { border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; overflow: hidden; }
.stage-block > header, .task-detail > header, .report-block > header { display: flex; align-items: center; justify-content: space-between; gap: $space-3; padding: $space-3 $space-4; border-bottom: 1px solid $border-color; background: $surface-50; small, strong { display: block; } small { margin-top: 3px; color: $text-tertiary; font-size: $font-caption; } > span { color: $brand-700; font-weight: $font-weight-semibold; } }
.task-table { min-width: 0; }
.task-row { display: grid; grid-template-columns: minmax(220px, 1.6fr) 100px 110px 170px minmax(150px, .8fr); align-items: center; gap: $space-2; min-height: 54px; padding: 0 $space-4; border-bottom: 1px solid $border-color; color: $text-secondary; font-size: $font-body-sm; }
.task-row:last-child { border-bottom: 0; }
.task-row--head { min-height: 38px; background: $surface-50; color: $text-tertiary; font-size: $font-caption; font-weight: $font-weight-semibold; }
.task-name strong, .task-name small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.task-name strong { color: $text-primary; }
.task-name small { color: $text-tertiary; font-size: $font-caption; }
.task-actions { display: flex; flex-wrap: wrap; gap: 2px; }
.stage-empty { padding: $space-4; color: $text-tertiary; font-size: $font-body-sm; }
.task-detail { padding-bottom: $space-4; }
.node-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: $space-3; padding: $space-4; }
.node-card { display: flex; flex-direction: column; gap: $space-3; padding: $space-3; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-50; strong, small { display: block; } small { margin-top: 4px; color: $text-tertiary; font-size: $font-caption; line-height: 1.5; } .el-button { align-self: flex-start; } }
.report-list { display: flex; flex-direction: column; }
.report-list article { padding: $space-3 $space-4; border-bottom: 1px solid $border-color; &:last-child { border-bottom: 0; } div { display: flex; align-items: center; justify-content: space-between; gap: $space-3; } small { color: $text-tertiary; font-size: $font-caption; } p { margin: $space-2 0 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.6; } }
.dialog-form { display: flex; flex-direction: column; gap: $space-2; margin-top: $space-3; }
.dialog-form__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-3; }
.dialog-hint { margin: 0 0 $space-3; color: $text-secondary; font-size: $font-body-sm; }
@media (max-width: 1280px) { .task-row { grid-template-columns: minmax(200px, 1.5fr) 90px 100px 150px minmax(130px, .8fr); } }
@media (max-width: 1024px) { .execution-layout { grid-template-columns: 1fr; } .task-row { grid-template-columns: minmax(200px, 1.4fr) 90px 100px minmax(140px, 1fr); } .task-row > :nth-child(4) { display: none; } .node-grid { grid-template-columns: 1fr; } }
@media (max-width: 680px) { .workspace-head, .workspace-head__actions { align-items: flex-start; flex-direction: column; } .dialog-form__grid { grid-template-columns: 1fr; } .task-table { overflow-x: auto; } .task-row { min-width: 620px; } .task-row > :nth-child(4) { display: block; } }
</style>
