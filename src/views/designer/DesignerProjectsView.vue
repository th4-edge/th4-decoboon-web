<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import WorkbenchState from '@/components/workbench/WorkbenchState.vue'
import NavIcon from '@/components/shell/NavIcon.vue'
import DesignerProjectActivity from '@/views/designer/components/DesignerProjectActivity.vue'
import DesignerProjectGuide from '@/views/designer/components/DesignerProjectGuide.vue'
import DesignerProjectHero from '@/views/designer/components/DesignerProjectHero.vue'
import DesignerProjectStageWork from '@/views/designer/components/DesignerProjectStageWork.vue'
import { formatDateTime } from '@/core/format'
import { ProviderError } from '@/core/http'
import { projectApi } from '@/domains/project/api'
import type { AcceptanceBrief, ProjectBrief, ProjectStage, ProjectStatus, ProjectTask, SiteReport } from '@/domains/project/model'

type ProjectFilter = 'all' | ProjectStatus
type LoadState = 'idle' | 'loading' | 'ready' | 'error'
type ContextKey = 'project' | 'stages' | 'tasks' | 'reports' | 'acceptances'

const router = useRouter()
const route = useRoute()

const FILTERS: Array<{ key: ProjectFilter; label: string }> = [
  { key: 'all', label: '全部项目' },
  { key: 'preparing', label: '待开工' },
  { key: 'ongoing', label: '施工中' },
  { key: 'accepting', label: '待验收' },
  { key: 'suspended', label: '已停工' },
  { key: 'finished', label: '已完工' },
  { key: 'settled', label: '已结算' }
]

const PAGE_SIZE = 30
const projects = ref<ProjectBrief[]>([])
const total = ref(0)
const currentPage = ref(1)
const hasMore = ref(false)
const loadingMore = ref(false)
const listMoreError = ref('')
const listState = ref<LoadState>('idle')
const listError = ref('')
const initialKeyword = queryString(route.query.keyword)
const initialStatus = queryString(route.query.status)
const keyword = ref(initialKeyword)
const statusFilter = ref<ProjectFilter>(isProjectStatus(initialStatus) ? initialStatus : 'all')

const selectedProjectId = ref('')
const selectedProject = ref<ProjectBrief | null>(null)
const selectedStageId = ref('')
const stages = ref<ProjectStage[]>([])
const tasks = ref<ProjectTask[]>([])
const reports = ref<SiteReport[]>([])
const acceptances = ref<AcceptanceBrief[]>([])
const contextState = reactive<Record<ContextKey, LoadState>>({
  project: 'idle',
  stages: 'idle',
  tasks: 'idle',
  reports: 'idle',
  acceptances: 'idle'
})

let listRequestId = 0
let contextRequestId = 0
let keywordTimer: ReturnType<typeof setTimeout> | undefined

const selectedStage = computed(() => stages.value.find((stage) => stage.id === selectedStageId.value) ?? null)
const isInitialLoading = computed(() => listState.value === 'loading' && !projects.value.length)
const listFailed = computed(() => listState.value === 'error' && !projects.value.length)
const hasActiveFilter = computed(() => statusFilter.value !== 'all' || Boolean(keyword.value.trim()))
const contextError = computed(() => {
  const labels: string[] = []
  if (contextState.project === 'error') labels.push('项目详情')
  if (contextState.stages === 'error') labels.push('施工阶段')
  if (contextState.tasks === 'error') labels.push('施工任务')
  if (contextState.reports === 'error') labels.push('现场动态')
  if (contextState.acceptances === 'error') labels.push('验收事实')
  return labels.length ? `部分数据暂不可确认：${labels.join('、')}。已成功读取的区块仍可查看。` : ''
})
const nextProject = computed(() => {
  if (!projects.value.length || !selectedProjectId.value) return null
  const index = projects.value.findIndex((project) => project.id === selectedProjectId.value)
  if (index < 0) return null
  return projects.value[index + 1] ?? projects.value[0] ?? null
})

function queryString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function isProjectStatus(value: string): value is ProjectStatus {
  return FILTERS.some((item) => item.key === value && value !== 'all')
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ProviderError && (error.code === '403' || error.code === '401')) {
    return '当前账号不在这个项目的数据范围内，无法查看项目事实。'
  }
  return error instanceof Error ? error.message : fallback
}

function syncQuery(): void {
  const query: Record<string, string> = {}
  const managed = new Set(['activeProjectId', 'activeStageId', 'keyword', 'status'])
  for (const [key, value] of Object.entries(route.query)) {
    if (typeof value === 'string' && !managed.has(key)) query[key] = value
  }
  if (selectedProjectId.value) query.activeProjectId = selectedProjectId.value
  if (selectedStageId.value) query.activeStageId = selectedStageId.value
  if (keyword.value.trim()) query.keyword = keyword.value.trim()
  if (statusFilter.value !== 'all') query.status = statusFilter.value
  void router.replace({ query })
}

function clearProjectContext(): void {
  selectedProjectId.value = ''
  selectedProject.value = null
  selectedStageId.value = ''
  stages.value = []
  tasks.value = []
  reports.value = []
  acceptances.value = []
  for (const key of Object.keys(contextState) as ContextKey[]) contextState[key] = 'idle'
  syncQuery()
}

function pickCurrentStage(list: ProjectStage[], project: ProjectBrief | null): ProjectStage | null {
  const currentName = project?.currentStageName
  return list.find((stage) => stage.name === currentName)
    ?? list.find((stage) => stage.status === 'doing' || stage.status === 'accepting')
    ?? list.find((stage) => stage.status === 'todo')
    ?? list[0]
    ?? null
}

async function loadProjectContext(projectId: string): Promise<void> {
  const preservedStageId = queryString(route.query.activeStageId)
  const requestId = ++contextRequestId
  contextState.project = 'loading'
  contextState.stages = 'loading'
  contextState.tasks = 'loading'
  contextState.reports = 'loading'
  contextState.acceptances = 'loading'

  const [projectResult, stageResult, taskResult, reportResult, acceptanceResult] = await Promise.allSettled([
    projectApi.projectInfo(projectId),
    projectApi.listStages(projectId),
    projectApi.listTasks(projectId),
    projectApi.listReports(projectId),
    projectApi.listAcceptances(projectId)
  ])
  if (requestId !== contextRequestId || projectId !== selectedProjectId.value) return

  if (projectResult.status === 'fulfilled') {
    selectedProject.value = projectResult.value
    contextState.project = 'ready'
  } else {
    contextState.project = 'error'
  }

  stages.value = stageResult.status === 'fulfilled' ? stageResult.value : []
  contextState.stages = stageResult.status === 'fulfilled' ? 'ready' : 'error'

  tasks.value = taskResult.status === 'fulfilled' ? taskResult.value : []
  contextState.tasks = taskResult.status === 'fulfilled' ? 'ready' : 'error'

  reports.value = reportResult.status === 'fulfilled' ? reportResult.value : []
  contextState.reports = reportResult.status === 'fulfilled' ? 'ready' : 'error'

  acceptances.value = acceptanceResult.status === 'fulfilled' ? acceptanceResult.value : []
  contextState.acceptances = acceptanceResult.status === 'fulfilled' ? 'ready' : 'error'

  const requestedStage = stages.value.find((stage) => stage.id === preservedStageId)
  selectedStageId.value = requestedStage?.id ?? pickCurrentStage(stages.value, selectedProject.value)?.id ?? ''
  syncQuery()
}

function selectProject(project: ProjectBrief): void {
  if (!project.id) return
  if (project.id === selectedProjectId.value && selectedProject.value) {
    syncQuery()
    return
  }
  selectedProjectId.value = project.id
  selectedProject.value = project
  selectedStageId.value = ''
  stages.value = []
  tasks.value = []
  reports.value = []
  acceptances.value = []
  for (const key of Object.keys(contextState) as ContextKey[]) contextState[key] = 'loading'
  syncQuery()
  void loadProjectContext(project.id)
}

function selectStage(stageId: string): void {
  if (!stages.value.some((stage) => stage.id === stageId) || stageId === selectedStageId.value) return
  selectedStageId.value = stageId
  syncQuery()
}

function retryContext(): void {
  if (selectedProjectId.value) void loadProjectContext(selectedProjectId.value)
}

async function loadProjects(mode: 'initial' | 'filter' | 'refresh' = 'refresh'): Promise<void> {
  const requestId = ++listRequestId
  listState.value = 'loading'
  listError.value = ''
  listMoreError.value = ''
  try {
    const result = await projectApi.pageProjects({
      current: 1,
      size: PAGE_SIZE,
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value === 'all' ? undefined : statusFilter.value
    })
    if (requestId !== listRequestId) return

    projects.value = result.list
    total.value = result.total
    currentPage.value = 1
    hasMore.value = result.hasMore
    listState.value = 'ready'

    const requestedProjectId = mode === 'initial' ? queryString(route.query.activeProjectId) : selectedProjectId.value
    const requestedProject = projects.value.find((project) => project.id === requestedProjectId)

    if (requestedProject) {
      const shouldReload = mode === 'initial' || mode === 'refresh' || requestedProjectId !== selectedProjectId.value
      if (shouldReload) {
        selectedProjectId.value = requestedProject.id
        selectedProject.value = requestedProject
        void loadProjectContext(requestedProject.id)
      } else {
        selectedProject.value = requestedProject
      }
      syncQuery()
      return
    }

    if (mode === 'refresh' && requestedProjectId) {
      clearProjectContext()
      return
    }

    if (mode === 'initial') {
      clearProjectContext()
      return
    }

    if (projects.value.length) selectProject(projects.value[0])
    else clearProjectContext()
  } catch (error) {
    if (requestId !== listRequestId) return
    listState.value = 'error'
    listError.value = errorMessage(error, '项目工地暂不可确认')
  }
}

async function loadMore(): Promise<void> {
  if (!hasMore.value || loadingMore.value) return
  loadingMore.value = true
  listMoreError.value = ''
  const nextPage = currentPage.value + 1
  try {
    const result = await projectApi.pageProjects({
      current: nextPage,
      size: PAGE_SIZE,
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value === 'all' ? undefined : statusFilter.value
    })
    const known = new Set(projects.value.map((project) => project.id))
    projects.value = [...projects.value, ...result.list.filter((project) => !known.has(project.id))]
    total.value = result.total
    currentPage.value = nextPage
    hasMore.value = result.hasMore
  } catch (error) {
    listMoreError.value = errorMessage(error, '加载更多失败')
  } finally {
    loadingMore.value = false
  }
}

function projectReason(project: ProjectBrief): string {
  const blocked = project.businessStateView?.blockedReasons?.[0]
    ?? project.businessStateView?.nextAction?.blockedReasons?.[0]
  if (blocked) return blocked
  const nextAction = project.businessStateView?.nextAction
  if (nextAction?.label) return `${nextAction.label} · ${nextAction.ownerRole || project.businessStateView?.nextOwner || '责任人待确认'}`
  return `${project.currentStageName || '阶段待确认'} · 计划完工 ${dateText(project.planEndDate)}`
}

function progressPercent(project: ProjectBrief): number {
  return Math.max(0, Math.min(100, Number(project.progress) || 0))
}

function dateText(value?: string): string {
  if (!value) return '待补充'
  const formatted = formatDateTime(value)
  return formatted === '暂不可确认' ? formatted : formatted.slice(0, 10)
}

function openProjectWorkspace(kind: 'materials' | 'changes' | 'acceptance'): void {
  if (!selectedProject.value?.id) return
  void router.push(`/designer/projects/${selectedProject.value.id}/${kind}`)
}

function createProjectChange(): void {
  if (!selectedProject.value?.id) return
  void router.push({
    path: `/designer/projects/${selectedProject.value.id}/changes`,
    query: { projectId: selectedProject.value.id, action: 'create' }
  })
}

function selectNextProject(project: ProjectBrief): void {
  selectProject(project)
}

function clearFiltersOrRefresh(): void {
  if (!hasActiveFilter.value) {
    void loadProjects('refresh')
    return
  }
  keyword.value = ''
  statusFilter.value = 'all'
}

watch(statusFilter, () => {
  syncQuery()
  void loadProjects('filter')
})

watch(keyword, () => {
  if (keywordTimer) clearTimeout(keywordTimer)
  keywordTimer = setTimeout(() => {
    syncQuery()
    void loadProjects('filter')
  }, 300)
})

onMounted(() => {
  void loadProjects('initial')
})

onBeforeUnmount(() => {
  if (keywordTimer) clearTimeout(keywordTimer)
})
</script>

<template>
  <div class="pj">
    <header class="pj__head">
      <div>
        <p class="pj__eyebrow">项目交付 · 项目工地</p>
        <h1>项目工地</h1>
        <p>先选一个本人参与的项目，再核对当前阶段、施工任务、现场动态和验收事实；设计师只进入合法工作区，不代替项目经理推进施工节点。</p>
      </div>
      <div class="pj__head-meta">
        <span>{{ hasActiveFilter ? `${total} 个筛选结果` : `${total} 个参与项目` }}</span>
        <button type="button" :class="{ 'is-loading': listState === 'loading' }" @click="loadProjects('refresh')">
          <NavIcon name="refresh" />
          刷新
        </button>
      </div>
    </header>

    <section class="pj__tools" aria-label="项目筛选">
      <label class="pj__search">
        <span>搜索项目</span>
        <span class="pj__search-control">
          <NavIcon name="search" />
          <input v-model="keyword" type="search" placeholder="项目名称、编号、客户、小区或地址" />
        </span>
      </label>
      <div class="pj__filters">
        <button
          v-for="item in FILTERS"
          :key="item.key"
          type="button"
          :class="{ active: statusFilter === item.key }"
          @click="statusFilter = item.key"
        >
          {{ item.label }}
        </button>
      </div>
    </section>

    <el-alert v-if="listError && projects.length" type="error" :closable="false" :title="listError" show-icon />
    <el-alert v-if="listMoreError" type="warning" :closable="false" :title="listMoreError" show-icon />
    <el-alert v-if="contextError" type="warning" :closable="false" :title="contextError" show-icon />

    <div v-if="isInitialLoading" class="pj__skeleton" aria-busy="true">
      <span v-for="n in 8" :key="n" />
    </div>

    <WorkbenchState
      v-else-if="listFailed"
      variant="error"
      title="项目工地暂不可确认"
      :description="listError"
      action-text="重新加载"
      min-height="360px"
      @action="loadProjects('refresh')"
    />

    <div v-else class="pj__layout">
      <aside class="pj__queue">
        <header class="pj__queue-head">
          <div>
            <strong>我的项目</strong>
            <small>按服务端参与关系返回，不默认选中第一条</small>
          </div>
          <span>{{ total }}</span>
        </header>

        <WorkbenchState
          v-if="!projects.length"
          :title="hasActiveFilter ? '当前筛选没有项目' : '当前没有参与项目'"
          :description="hasActiveFilter ? '清除搜索或状态筛选后重试；筛选为空不代表没有项目。' : '合同生效并立项、且当前设计师参与的项目会出现在这里。'"
          :action-text="hasActiveFilter ? '清除筛选' : '刷新'"
          min-height="260px"
          @action="clearFiltersOrRefresh"
        />
        <div v-else class="pj__queue-list">
          <button
            v-for="project in projects"
            :key="project.id"
            type="button"
            class="pj__project"
            :class="{ active: project.id === selectedProjectId }"
            :aria-current="project.id === selectedProjectId ? 'true' : undefined"
            @click="selectProject(project)"
          >
            <span class="pj__project-top">
              <strong>{{ project.name || '项目待命名' }}</strong>
              <BusinessStateTag object-key="project" :server-value="project.businessStateView?.status || project.status" />
            </span>
            <span class="pj__project-anchor">{{ project.customerName || '客户待补充' }} · {{ project.propertyName || project.community || project.address || '房屋待补充' }}</span>
            <span class="pj__project-stage">
              <span>{{ project.currentStageName || '阶段待确认' }}</span>
              <b>{{ progressPercent(project) }}%</b>
            </span>
            <span class="pj__project-progress" aria-hidden="true"><i :style="{ width: `${progressPercent(project)}%` }" /></span>
            <span class="pj__project-reason">{{ projectReason(project) }}</span>
            <span class="pj__project-foot">
              <small>{{ project.no || '编号待补充' }}</small>
              <small>{{ project.planEndDate ? `计划完工 ${dateText(project.planEndDate)}` : '计划完工待排期' }}</small>
            </span>
          </button>

          <button v-if="hasMore" type="button" class="pj__more" :disabled="loadingMore" @click="loadMore">
            <NavIcon name="chevron-down" />
            {{ loadingMore ? '加载中…' : '加载更多项目' }}
          </button>
        </div>
      </aside>

      <main class="pj__workspace">
        <template v-if="selectedProjectId && selectedProject">
          <DesignerProjectHero :project="selectedProject" :stage="selectedStage" />
          <DesignerProjectStageWork
            :stages="stages"
            :tasks="tasks"
            :selected-stage-id="selectedStageId"
            :stage-state="contextState.stages"
            :task-state="contextState.tasks"
            @select-stage="selectStage"
            @retry="retryContext"
          />
          <DesignerProjectActivity
            :reports="reports"
            :acceptances="acceptances"
            :selected-stage-id="selectedStageId"
            :selected-stage-name="selectedStage?.name || selectedProject.currentStageName || ''"
            :report-state="contextState.reports"
            :acceptance-state="contextState.acceptances"
            @retry="retryContext"
          />
        </template>

        <WorkbenchState
          v-else-if="selectedProjectId"
          variant="error"
          title="项目详情暂不可确认"
          description="项目详情读取失败，阶段、任务、现场和验收上下文暂不能判断。"
          action-text="重新加载"
          min-height="360px"
          @action="retryContext"
        />

        <WorkbenchState
          v-else
          title="请先选择一个项目"
          description="项目工地不默认打开第一条；从左侧选择项目后，才会读取阶段、任务、现场和验收事实。"
          min-height="360px"
        />
      </main>

      <DesignerProjectGuide
        class="pj__guide"
        :project="selectedProject"
        :next-project="nextProject"
        @open-materials="openProjectWorkspace('materials')"
        @open-changes="openProjectWorkspace('changes')"
        @create-changes="createProjectChange"
        @open-acceptance="openProjectWorkspace('acceptance')"
        @open-contract="router.push('/designer/contract')"
        @select-next="selectNextProject"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/workbench-shell' as wb;

.pj { display: flex; flex-direction: column; gap: $space-4; min-width: 0; }

.pj__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: $space-4;

  h1 { margin: 0; font-size: $font-display; letter-spacing: -.02em; }
  p { max-width: 860px; margin: $space-2 0 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
}

.pj__head .pj__eyebrow { color: $brand-600; font-size: $font-caption; font-weight: $font-weight-semibold; letter-spacing: .09em; }
.pj__head-meta { display: flex; align-items: center; gap: $space-3; color: $text-secondary; font-size: $font-caption; }
.pj__head-meta button {
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
.pj__head-meta button:hover { color: $brand-700; border-color: $brand-300; background: $brand-50; }
.pj__head-meta .is-loading :deep(svg) { animation: pj-spin .7s linear infinite; }
@keyframes pj-spin { to { transform: rotate(360deg); } }

.pj__tools {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: $space-4;
  padding: $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
}

.pj__search { display: flex; flex-direction: column; gap: 6px; min-width: 320px; color: $text-secondary; font-size: $font-caption; }
.pj__search-control { display: flex; align-items: center; gap: 7px; height: 38px; padding: 0 10px; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; }
.pj__search-control input { flex: 1; min-width: 0; height: 100%; border: 0; outline: 0; background: transparent; color: $text-primary; font: inherit; }
.pj__search-control input::placeholder { color: $text-tertiary; }
.pj__filters { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.pj__filters button { padding: 7px 11px; border: 1px solid $border-color; border-radius: $radius-pill; background: $surface-0; color: $text-secondary; font: inherit; font-size: $font-caption; cursor: pointer; }
.pj__filters button:hover { border-color: $brand-300; color: $brand-700; }
.pj__filters button.active { border-color: $brand-300; background: $brand-50; color: $brand-700; font-weight: $font-weight-semibold; }

.pj__skeleton { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-3; }
.pj__skeleton span { display: block; height: 88px; border-radius: $radius-lg; background: linear-gradient(90deg, $surface-100 25%, $surface-50 37%, $surface-100 63%); background-size: 400% 100%; animation: pj-shimmer 1.4s ease infinite; }
@keyframes pj-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

.pj__layout { @include wb.workbench-layout(330px); }
.pj__queue { @include wb.workbench-queue; }
.pj__queue-head { display: flex; align-items: center; justify-content: space-between; gap: $space-3; padding: 16px 18px; border-bottom: 1px solid $border-color; background: linear-gradient(135deg, $surface-50, $surface-0); }
.pj__queue-head div { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.pj__queue-head strong { color: $text-primary; font-size: $font-body; }
.pj__queue-head small { color: $text-tertiary; font-size: $font-caption; }
.pj__queue-head > span { color: $brand-700; font-size: $font-title; font-weight: $font-weight-bold; font-variant-numeric: tabular-nums; }
.pj__queue-list { display: flex; flex-direction: column; @include wb.workbench-queue-scroll; }

.pj__project {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  min-height: 160px;
  padding: 14px;
  border: 0;
  border-bottom: 1px solid $border-color;
  background: transparent;
  color: $text-secondary;
  text-align: left;
  cursor: pointer;
}
.pj__project > span { flex-shrink: 0; }
.pj__project:hover { background: $brand-50; }
.pj__project.active { background: linear-gradient(135deg, $brand-50, $surface-0 78%); box-shadow: inset 3px 0 0 $brand-500; }
.pj__project-top, .pj__project-stage, .pj__project-foot { display: flex; align-items: center; justify-content: space-between; gap: $space-2; min-width: 0; }
.pj__project-top strong { min-width: 0; overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
.pj__project-anchor { overflow: hidden; color: $text-secondary; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; }
.pj__project-stage { color: $text-primary; font-size: $font-caption; }
.pj__project-stage b { color: $brand-700; font-variant-numeric: tabular-nums; }
.pj__project-progress { display: block; flex: 0 0 6px; height: 6px; overflow: hidden; border-radius: $radius-pill; background: $surface-100; }
.pj__project-progress i { display: block; height: 100%; border-radius: inherit; background: $brand-500; }
.pj__project-reason { display: -webkit-box; overflow: hidden; color: $text-tertiary; font-size: $font-caption; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.pj__project-foot { color: $text-tertiary; font-size: $font-caption; }
.pj__project-foot small:last-child { text-align: right; }
.pj__more { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 42px; border: 0; border-bottom: 1px solid $border-color; background: $surface-50; color: $brand-700; font: inherit; font-size: $font-caption; cursor: pointer; }
.pj__more:hover { background: $brand-50; }
.pj__more:disabled { cursor: wait; opacity: .6; }

.pj__workspace { @include wb.workbench-workspace; }
.pj__guide { @include wb.workbench-guide; }

@media (min-width: 1401px) {
  .pj__guide {
    max-height: calc(100vh - var(--workbench-queue-top) - #{$space-4});
    overflow: auto;
  }
}

@media (max-width: 1024px) {
  .pj__tools { flex-direction: column; align-items: stretch; }
  .pj__search { min-width: 0; }
  .pj__filters { justify-content: flex-start; }
}

@media (max-width: 680px) {
  .pj__skeleton { grid-template-columns: 1fr; }
  .pj__head-meta { width: 100%; justify-content: space-between; }
}
</style>
