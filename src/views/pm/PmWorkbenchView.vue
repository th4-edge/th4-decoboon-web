<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import EmptyState from '@/components/EmptyState.vue'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import WorkbenchEntryCard from '@/components/workbench/WorkbenchEntryCard.vue'
import { projectApi } from '@/domains/project/api'
import { fileApi } from '@/domains/file/api'
import type { UploadedFile } from '@/domains/file/model'
import { ACCEPTANCE_STATUS_META } from '@/domains/acceptance/meta'
import type { AcceptanceBrief, ProjectBrief, ProjectStage, ProjectStatus, ProjectTask, SiteReport } from '@/domains/project/model'
import { workbenchesForRole } from '@/domains/workbench/navigation'

const route = useRoute()
const router = useRouter()
const projects = ref<ProjectBrief[]>([])
const selectedProject = ref<ProjectBrief | null>(null)
const stages = ref<ProjectStage[]>([])
const tasks = ref<ProjectTask[]>([])
const reports = ref<SiteReport[]>([])
const acceptances = ref<AcceptanceBrief[]>([])
const loading = ref(false)
const contextLoading = ref(false)
const error = ref('')
const partialError = ref('')
const actionError = ref('')
const savingTaskId = ref('')
const savingStage = ref(false)
const doneVisible = ref(false)
const doneTask = ref<ProjectTask | null>(null)
const doneFiles = ref<UploadedFile[]>([])
const doneInput = ref<HTMLInputElement | null>(null)
const uploadingDone = ref(false)
const doneError = ref('')

const pmWorkbenches = computed(() => workbenchesForRole('Pm').filter((entry) => entry.key !== 'more.search'))
const selectedProjectId = computed(() => String(route.query.projectId ?? ''))
const currentStage = computed(() => stages.value.find((stage) => stage.status === 'doing' || stage.status === 'accepting')
  ?? stages.value.find((stage) => stage.status !== 'done') ?? null)
const taskSummary = computed(() => ({
  total: tasks.value.length,
  doing: tasks.value.filter((task) => ['doing', 'Doing'].includes(String(task.status))).length,
  done: tasks.value.filter((task) => ['done', 'Done'].includes(String(task.status))).length
}))
const latestReport = computed(() => [...reports.value].sort((a, b) => String(b.reportAt ?? '').localeCompare(String(a.reportAt ?? '')))[0] ?? null)
const latestAcceptance = computed(() => [...acceptances.value].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))[0] ?? null)
const mainAction = computed(() => {
  switch (selectedProject.value?.status) {
    case 'preparing': return '准备开工资料'
    case 'ongoing': return '推进当前阶段/任务'
    case 'suspended': return '处理停工事项'
    case 'accepting': return '处理阶段验收'
    case 'finished': return '查看完工归档'
    case 'settled': return '查看已结算项目'
    default: return '选择项目'
  }
})

function statusLabel(status: ProjectStatus): string {
  return ({ preparing: '待开工', ongoing: '施工中', suspended: '已停工', accepting: '待验收', finished: '已完工', settled: '已结算' } as Record<ProjectStatus, string>)[status]
}
function statusTone(status: ProjectStatus) {
  return ({ preparing: 'info', ongoing: 'alert', suspended: 'blocked', accepting: 'pending', finished: 'done', settled: 'dark' } as const)[status]
}
function acceptanceStatusLabel(status: string): string {
  if (status === 'pending' || status === 'confirmed' || status === 'rejected') return ACCEPTANCE_STATUS_META[status].label
  return '暂不可确认'
}
function stageTone(status: string) {
  return status === 'done' ? 'done' : status === 'accepting' ? 'pending' : status === 'doing' ? 'doing' : 'todo'
}
function taskStatusLabel(status: string): string {
  return ({ Todo: '待开始', Doing: '进行中', Accepting: '待确认', Done: '已完成', Cancelled: '已取消', todo: '待开始', doing: '进行中', accepting: '待确认', done: '已完成', cancelled: '已取消' } as Record<string, string>)[status] ?? '暂不可确认'
}
function taskActionLabel(status: string): string {
  if (status === 'Todo' || status === 'todo') return '开始任务'
  if (status === 'Doing' || status === 'doing') return '提交验收'
  if (status === 'Accepting' || status === 'accepting') return '完成任务'
  if (status === 'Done' || status === 'done') return '重开任务'
  return '待后续动作'
}
function canAdvanceTask(status: string): boolean {
  return ['Todo', 'todo', 'Doing', 'doing', 'Accepting', 'accepting', 'Done', 'done'].includes(status)
}

async function advanceTask(task: ProjectTask): Promise<void> {
  if (['Accepting', 'accepting'].includes(task.status)) {
    openDoneDialog(task)
    return
  }
  const action = ['Todo', 'todo'].includes(task.status)
    ? 'start'
    : ['Done', 'done'].includes(task.status) ? 'reopen' : 'finish'
  savingTaskId.value = task.id
  actionError.value = ''
  try {
    await projectApi.updateTaskStatus(task.id, action)
    ElMessage.success(action === 'start' ? '任务已开始' : action === 'reopen' ? '任务已重开' : '任务已提交验收')
    await selectProject(selectedProjectId.value, false)
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '任务动作失败，请重新读取后重试'
  } finally {
    savingTaskId.value = ''
  }
}

function openDoneDialog(task: ProjectTask): void {
  doneTask.value = task
  doneFiles.value = []
  doneError.value = ''
  doneVisible.value = true
}

async function uploadDoneEvidence(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (!files.length) return
  uploadingDone.value = true
  doneError.value = ''
  try {
    for (const file of files) doneFiles.value.push(await fileApi.uploadFile('Task', file, { projectId: selectedProjectId.value }))
  } catch (err) {
    doneError.value = err instanceof Error ? err.message : '任务证据上传失败'
  } finally {
    uploadingDone.value = false
    input.value = ''
  }
}

function removeDoneEvidence(path: string): void {
  doneFiles.value = doneFiles.value.filter((file) => file.path !== path)
}

async function confirmDone(): Promise<void> {
  const task = doneTask.value
  if (!task || !doneFiles.value.length) {
    doneError.value = '任务完成前必须上传现场照片或视频'
    return
  }
  savingTaskId.value = task.id
  doneError.value = ''
  try {
    await projectApi.updateTaskStatus(task.id, 'done', doneFiles.value.map((file) => file.path))
    doneVisible.value = false
    ElMessage.success('任务已完成并留下现场证据')
    await selectProject(selectedProjectId.value, false)
  } catch (err) {
    doneError.value = err instanceof Error ? err.message : '任务完成失败，请重新读取后重试'
  } finally {
    savingTaskId.value = ''
  }
}

function goAcceptance(): void {
  if (selectedProjectId.value) void router.push(`/pm/projects/${selectedProjectId.value}/acceptance`)
}

async function openCurrentStage(): Promise<void> {
  if (!currentStage.value || currentStage.value.status !== 'todo') return
  savingStage.value = true
  actionError.value = ''
  try {
    await projectApi.openStage(currentStage.value.id)
    ElMessage.success('阶段已开工')
    await selectProject(selectedProjectId.value, false)
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '阶段开工失败，请重新读取后重试'
  } finally {
    savingStage.value = false
  }
}

async function loadProjects(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    projects.value = await projectApi.listProjects()
    const requested = selectedProjectId.value
    if (requested) await selectProject(requested, false)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '项目队列暂不可确认，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function selectProject(projectId: string, updateRoute = true): Promise<void> {
  if (!projectId) return
  if (updateRoute) await router.replace({ path: '/pm/workbench', query: { ...route.query, projectId } })
  contextLoading.value = true
  partialError.value = ''
  try {
    const [projectResult, stageResult, taskResult, reportResult, acceptanceResult] = await Promise.allSettled([
      projectApi.projectInfo(projectId),
      projectApi.listStages(projectId),
      projectApi.listTasks(projectId),
      projectApi.listReports(projectId),
      projectApi.listAcceptances(projectId)
    ])
    selectedProject.value = projectResult.status === 'fulfilled' ? projectResult.value : projects.value.find((item) => item.id === projectId) ?? null
    stages.value = stageResult.status === 'fulfilled' ? stageResult.value : []
    tasks.value = taskResult.status === 'fulfilled' ? taskResult.value : []
    reports.value = reportResult.status === 'fulfilled' ? reportResult.value : []
    acceptances.value = acceptanceResult.status === 'fulfilled' ? acceptanceResult.value : []
    const rejected = [projectResult, stageResult, taskResult, reportResult, acceptanceResult].filter((item) => item.status === 'rejected').length
    if (rejected) partialError.value = `部分项目数据暂不可确认（${rejected}/5），请重试或联系管理员。`
  } catch (err) {
    partialError.value = err instanceof Error ? err.message : '项目事实暂不可确认'
  } finally {
    contextLoading.value = false
  }
}

onMounted(loadProjects)
</script>

<template>
  <div class="pm-home">
    <section class="pm-hero">
      <div>
        <p>PM · PROJECT DELIVERY</p>
        <h2>项目履约主线</h2>
        <span>从本人负责或参与的项目进入当前工作面；任务与阶段写动作未冻结前只展示事实，不生成伪主行动。</span>
      </div>
      <StatusTag tone="info" :text="`${projects.length} 个项目`" />
    </section>

    <el-alert v-if="error" type="error" :closable="false" show-icon :title="error" />
    <el-alert v-if="partialError" type="warning" :closable="false" show-icon :title="partialError" />
    <el-alert v-if="actionError" type="error" :closable="false" show-icon :title="actionError" />

    <section class="pm-workbenches" aria-label="项目经理场景工作台">
      <h3>按场景进入</h3>
      <div class="pm-workbenches__grid">
        <WorkbenchEntryCard v-for="entry in pmWorkbenches" :key="entry.key" :entry="entry" role="Pm" compact />
      </div>
    </section>

    <div class="pm-layout">
      <PanelCard title="我的项目" description="只展示本人负责或参与项目；点击项目进入对象工作面。" flush>
        <el-skeleton v-if="loading" :rows="6" animated class="pm-loading" />
        <EmptyState v-else-if="!projects.length" title="当前没有可见项目" description="项目为空来自服务端事实，不显示虚构项目或默认第一条。" />
        <div v-else class="pm-project-list">
          <button
            v-for="project in projects"
            :key="project.id"
            type="button"
            :class="{ active: project.id === selectedProjectId }"
            @click="selectProject(project.id)"
          >
            <div class="pm-project-list__top">
              <strong>{{ project.name || '未命名项目' }}</strong>
              <StatusTag :tone="statusTone(project.status)" :text="statusLabel(project.status)" />
            </div>
            <span>{{ project.customerName || '客户待完善' }} · {{ project.community || project.propertyName || '地址待完善' }}</span>
            <small>{{ project.no || project.id }}</small>
          </button>
        </div>
      </PanelCard>

      <PanelCard title="当前项目" :description="selectedProject ? `${selectedProject.name} · ${selectedProject.no || selectedProject.id}` : '请选择项目查看当前阶段事实'">
        <EmptyState v-if="!selectedProject" title="请选择一个项目" description="项目上下文不会默认使用第一条，刷新后通过 projectId 恢复。" />
        <el-skeleton v-else-if="contextLoading" :rows="8" animated />
        <div v-else class="pm-context">
          <div class="pm-context__facts">
            <div><span>项目状态</span><StatusTag :tone="statusTone(selectedProject.status)" :text="statusLabel(selectedProject.status)" /></div>
            <div><span>当前阶段</span><strong>{{ currentStage?.name || '暂不可确认' }}</strong></div>
            <div><span>任务</span><strong>{{ taskSummary.done }}/{{ taskSummary.total }} 已完成</strong></div>
            <div><span>最近日报</span><strong>{{ latestReport?.reportAt || '暂无' }}</strong></div>
            <div><span>最近验收</span><strong>{{ latestAcceptance?.status || '暂无' }}</strong></div>
          </div>

          <section class="pm-main-action">
            <div>
              <small>当前唯一主行动</small>
              <strong>{{ mainAction }}</strong>
              <p>任务/阶段动作注册未冻结，当前只读；验收提交动作按 BR-008 已在后续批次接入。</p>
            </div>
            <el-button
              v-if="currentStage?.status === 'todo'"
              type="primary"
              :loading="savingStage"
              @click="openCurrentStage"
            >
              开启阶段
            </el-button>
            <el-button v-else type="primary" plain @click="goAcceptance">阶段验收</el-button>
            <el-button v-if="selectedProject" @click="goAcceptance">打开验收工作区</el-button>
          </section>

          <section class="pm-stage-list">
            <h4>阶段事实</h4>
            <EmptyState v-if="!stages.length" title="暂无阶段数据" description="该结果来自服务端，不写死固定施工阶段。" />
            <div v-for="stage in stages" :key="stage.id" class="pm-stage-row">
              <StatusTag :tone="stageTone(String(stage.status))" :text="String(stage.name || '未命名阶段')" />
              <span>{{ stage.plannedStart || stage.actualStart || '未排期' }} → {{ stage.plannedEnd || stage.actualEnd || '未排期' }}</span>
            </div>
          </section>

          <section class="pm-task-list">
            <h4>任务事实</h4>
            <EmptyState v-if="!tasks.length" title="暂无任务" description="任务为空来自服务端事实，不用空数组伪造阶段完成。" />
            <div v-for="task in tasks" :key="task.id" class="pm-task-row">
              <div>
                <strong>{{ task.name || '未命名任务' }}</strong>
                <span>{{ task.ownerName || '责任人待确认' }} · {{ task.progress }}%</span>
              </div>
              <StatusTag :tone="task.status === 'Done' || task.status === 'done' ? 'done' : task.status === 'Cancelled' || task.status === 'cancelled' ? 'closed' : task.status === 'Accepting' || task.status === 'accepting' ? 'pending' : 'doing'" :text="taskStatusLabel(task.status)" />
              <el-button
                size="small"
                :disabled="!canAdvanceTask(task.status)"
                :loading="savingTaskId === task.id"
                @click="advanceTask(task)"
              >
                {{ canAdvanceTask(task.status) ? taskActionLabel(task.status) : '待后续动作' }}
              </el-button>
            </div>
          </section>

          <section class="pm-evidence-list">
            <h4>最近证据</h4>
            <p v-if="latestReport">日报：{{ latestReport.content || '已登记现场事实' }}</p>
            <p v-if="latestAcceptance">验收：{{ latestAcceptance.stageId || '阶段验收' }} · {{ acceptanceStatusLabel(latestAcceptance.status) }}</p>
            <p v-if="!latestReport && !latestAcceptance">暂无现场日报或验收证据。</p>
          </section>
        </div>
      </PanelCard>
    </div>
    <el-dialog v-model="doneVisible" title="完成任务并上传证据" width="min(720px, 96vw)" append-to-body @closed="doneTask = null">
      <p class="pm-done__hint">任务验收前必须上传现场照片或视频；隐蔽任务需先完成节点留证。</p>
      <el-alert v-if="doneError" type="warning" :closable="false" :title="doneError" show-icon />
      <div class="pm-done__upload">
        <el-button :loading="uploadingDone" @click="doneInput?.click()">上传照片 / 视频</el-button>
        <input ref="doneInput" type="file" accept="image/*,video/*" multiple hidden @change="uploadDoneEvidence" />
        <div v-if="doneFiles.length" class="pm-done__files">
          <span v-for="file in doneFiles" :key="file.path">
            <a :href="file.url" target="_blank" rel="noopener">{{ file.name || '任务证据' }}</a>
            <button type="button" @click="removeDoneEvidence(file.path)">移除</button>
          </span>
        </div>
      </div>
      <template #footer>
        <el-button @click="doneVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingTaskId === doneTask?.id" :disabled="!doneFiles.length" @click="confirmDone">确认完成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.pm-home { display: flex; flex-direction: column; gap: $space-4; }
.pm-hero { display: flex; align-items: center; justify-content: space-between; gap: $space-4; padding: $space-5; border: 1px solid $border-color; border-radius: $radius-md; background: linear-gradient(135deg, $brand-50 0%, $surface-0 72%); p { margin: 0 0 $space-1; color: $brand-600; font-size: $font-caption; font-weight: $font-weight-semibold; letter-spacing: .08em; } h2 { margin: 0 0 $space-1; font-size: $font-display; } span { color: $text-secondary; font-size: $font-body-sm; } }
.pm-workbenches { display: flex; flex-direction: column; gap: $space-3; h3 { margin: 0; font-size: $font-title; } }
.pm-workbenches__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: $space-3; }
.pm-layout { display: grid; grid-template-columns: minmax(280px, 360px) minmax(0, 1fr); gap: $space-4; align-items: start; }
.pm-loading { padding: $space-4; }
.pm-project-list { display: flex; flex-direction: column; }
.pm-project-list button { display: flex; flex-direction: column; gap: 4px; padding: $space-4; border: 0; border-bottom: 1px solid $border-color; background: transparent; text-align: left; cursor: pointer; &:hover, &.active { background: $brand-50; } &:last-child { border-bottom: 0; } span, small { color: $text-secondary; font-size: $font-caption; } small { color: $text-tertiary; } }
.pm-project-list__top { display: flex; align-items: center; justify-content: space-between; gap: $space-2; min-width: 0; strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } }
.pm-context { display: flex; flex-direction: column; gap: $space-4; }
.pm-context__facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: $space-3; div { display: flex; flex-direction: column; gap: $space-1; padding: $space-3; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-50; } span { color: $text-tertiary; font-size: $font-caption; } }
.pm-main-action { display: flex; align-items: center; justify-content: space-between; gap: $space-4; padding: $space-4; border: 1px solid $brand-200; border-radius: $radius-md; background: $brand-50; small, p { display: block; margin: 0; color: $text-secondary; font-size: $font-caption; } strong { display: block; margin: $space-1 0; font-size: $font-card-title; } }
.pm-stage-list, .pm-task-list, .pm-evidence-list { display: flex; flex-direction: column; gap: $space-2; h4 { margin: 0; font-size: $font-body; } }
.pm-stage-row, .pm-task-row { display: flex; align-items: center; justify-content: space-between; gap: $space-3; padding: $space-3; border: 1px solid $border-color; border-radius: $radius-sm; span { color: $text-secondary; font-size: $font-caption; } }
.pm-evidence-list p { margin: 0; color: $text-secondary; font-size: $font-body-sm; }
.pm-done__hint { margin: 0 0 $space-3; color: $text-secondary; font-size: $font-body-sm; }
.pm-done__upload { display: flex; flex-direction: column; gap: $space-2; }
.pm-done__files { display: flex; flex-direction: column; gap: $space-1; }
.pm-done__files span { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.pm-done__files a { color: $brand-700; font-size: $font-caption; text-decoration: underline; }
.pm-done__files button { border: 0; background: transparent; color: $danger-500; font-size: $font-caption; cursor: pointer; }
@media (max-width: 1280px) { .pm-workbenches__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .pm-context__facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 1024px) { .pm-layout { grid-template-columns: 1fr; } .pm-workbenches__grid { grid-template-columns: 1fr; } }
</style>
