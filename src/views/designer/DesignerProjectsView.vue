<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import { projectApi } from '@/domains/project/api'
import type { AcceptanceBrief, ProjectBrief, ProjectStage, ProjectStatus, ProjectTask, SiteReport, StageStatus } from '@/domains/project/model'
import { formatDateTime } from '@/core/format'
import type { StatusTone } from '@/core/tone'

const router = useRouter()

const PROJECT_STATUS_META: Record<ProjectStatus, { label: string; tone: StatusTone }> = {
  preparing: { label: '待开工', tone: 'info' },
  ongoing: { label: '施工中', tone: 'alert' },
  suspended: { label: '已停工', tone: 'blocked' },
  accepting: { label: '待验收', tone: 'pending' },
  finished: { label: '已完工', tone: 'done' },
  settled: { label: '已结算', tone: 'dark' }
}

const STAGE_STATUS_META: Record<StageStatus, { label: string; tone: StatusTone }> = {
  todo: { label: '待开始', tone: 'todo' },
  doing: { label: '进行中', tone: 'doing' },
  accepting: { label: '待验收', tone: 'pending' },
  done: { label: '已完成', tone: 'done' },
  cancelled: { label: '已取消', tone: 'closed' }
}

const TASK_STATUS_LABELS: Record<string, string> = {
  Todo: '待开始',
  Doing: '进行中',
  Accepting: '待确认',
  Done: '已完成',
  Cancelled: '已取消',
  todo: '待开始',
  doing: '进行中',
  accepting: '待确认',
  done: '已完成',
  cancelled: '已取消'
}

const loading = ref(false)
const error = ref('')
const partialError = ref('')
const projects = ref<ProjectBrief[]>([])
const keyword = ref('')
const statusFilter = ref<ProjectStatus | ''>('')
const selectedProjectId = ref('')
const selectedProject = ref<ProjectBrief | null>(null)
const stages = ref<ProjectStage[]>([])
const tasks = ref<ProjectTask[]>([])
const reports = ref<SiteReport[]>([])
const acceptances = ref<AcceptanceBrief[]>([])
const contextLoading = ref(false)

const filteredProjects = computed(() => {
  const needle = keyword.value.trim().toLowerCase()
  return projects.value.filter((project) => {
    if (statusFilter.value && project.status !== statusFilter.value) return false
    if (!needle) return true
    return [project.name, project.no, project.customerName, project.propertyName, project.community, project.address]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle))
  })
})

const selectedStage = computed(() => {
  const current = stages.value.find((stage) => stage.status === 'doing' || stage.status === 'accepting')
  return current ?? stages.value.find((stage) => stage.status !== 'done') ?? stages.value[0] ?? null
})

const taskSummary = computed(() => ({
  total: tasks.value.length,
  doing: tasks.value.filter((task) => task.status === 'Doing' || task.status === 'doing').length,
  done: tasks.value.filter((task) => task.status === 'Done' || task.status === 'done').length
}))

const latestReport = computed(() => [...reports.value].sort((left, right) => String(right.reportAt ?? '').localeCompare(String(left.reportAt ?? '')))[0] ?? null)
const latestAcceptance = computed(() => [...acceptances.value].sort((left, right) => String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')))[0] ?? null)

function statusTone(status: ProjectStatus): StatusTone {
  return PROJECT_STATUS_META[status].tone
}

async function loadProjects(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    projects.value = await projectApi.listProjects({ keyword: keyword.value.trim() || undefined, status: statusFilter.value || undefined })
    if (!selectedProjectId.value && projects.value.length) selectedProjectId.value = projects.value[0].id
    if (selectedProjectId.value) await loadProjectContext(selectedProjectId.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '项目工地暂不可确认'
  } finally {
    loading.value = false
  }
}

async function loadProjectContext(projectId: string): Promise<void> {
  selectedProjectId.value = projectId
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
    if (projectResult.status === 'fulfilled') selectedProject.value = projectResult.value
    stages.value = stageResult.status === 'fulfilled' ? stageResult.value : []
    tasks.value = taskResult.status === 'fulfilled' ? taskResult.value : []
    reports.value = reportResult.status === 'fulfilled' ? reportResult.value : []
    acceptances.value = acceptanceResult.status === 'fulfilled' ? acceptanceResult.value : []
    const rejected = [projectResult, stageResult, taskResult, reportResult, acceptanceResult].filter((result) => result.status === 'rejected')
    if (rejected.length) partialError.value = '部分项目事实加载失败，当前页面可能不完整，请刷新重试。'
  } finally {
    contextLoading.value = false
  }
}

function selectProject(project: ProjectBrief): void {
  void loadProjectContext(project.id)
}

onMounted(loadProjects)
</script>

<template>
  <div class="pw">
    <header class="pw__head">
      <div>
        <p class="pw__eyebrow">PROJECT · SITE COLLABORATION</p>
        <h2>项目工地</h2>
        <p>设计师按项目参与关系查看施工阶段、任务进度、现场动态和验收事实；不展示项目成本和利润，也不越权推进 PM 动作。</p>
      </div>
      <div class="pw__filters">
        <el-input v-model="keyword" clearable placeholder="搜索项目、客户、小区" @keyup.enter="loadProjects" />
        <el-select v-model="statusFilter" clearable placeholder="全部状态" @change="loadProjects">
          <el-option v-for="(meta, value) in PROJECT_STATUS_META" :key="value" :label="meta.label" :value="value" />
        </el-select>
        <el-button type="primary" @click="loadProjects">刷新</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <el-alert v-if="partialError" type="warning" :closable="false" :title="partialError" show-icon />

    <div class="pw__layout">
      <aside class="pw__pool">
        <div class="pw__panel-head"><strong>我的项目</strong><span>{{ filteredProjects.length }} 个</span></div>
        <div v-if="loading && !projects.length" class="pw__loading"><el-skeleton :rows="6" animated /></div>
        <EmptyState v-else-if="!filteredProjects.length" title="当前没有参与项目" description="合同生效并立项后，设计师参与的项目会出现在这里。" />
        <button
          v-for="project in filteredProjects"
          v-else
          :key="project.id"
          type="button"
          class="pw__project"
          :class="{ active: project.id === selectedProjectId }"
          @click="selectProject(project)"
        >
          <span class="pw__project-top">
            <strong>{{ project.name || '项目待命名' }}</strong>
            <StatusTag :tone="statusTone(project.status)" :text="PROJECT_STATUS_META[project.status].label" />
          </span>
          <span>{{ project.customerName || '客户待补充' }} · {{ project.propertyName || project.community || '房屋待补充' }}</span>
          <span class="pw__project-foot">
            <small>{{ project.no }}</small>
            <b>{{ project.progress }}%</b>
          </span>
        </button>
      </aside>

      <main class="pw__main">
        <template v-if="selectedProject">
          <section class="pw__identity">
            <div>
              <p class="pw__eyebrow">PROJECT FACTS</p>
              <h3>{{ selectedProject.name || '项目待命名' }} <StatusTag :tone="statusTone(selectedProject.status)" :text="PROJECT_STATUS_META[selectedProject.status].label" /></h3>
              <p>{{ selectedProject.no }} · {{ selectedProject.customerName || '客户待补充' }} · {{ selectedProject.propertyName || selectedProject.community || '房屋待补充' }}</p>
            </div>
            <div class="pw__progress">
              <span>施工进度</span>
              <b>{{ selectedProject.progress }}%</b>
              <div class="pw__progress-bar"><i :style="{ width: `${selectedProject.progress}%` }" /></div>
            </div>
          </section>

          <section class="pw__stages">
            <div class="pw__section-head">
              <div><h4>施工阶段</h4><p>阶段顺序、权重和状态以服务端项目主链为准。</p></div>
              <span v-if="selectedStage">当前：{{ selectedStage.name }}</span>
            </div>
            <div v-if="!stages.length" class="pw__inline-empty">当前项目还没有阶段数据。</div>
            <div v-else class="pw__stage-track">
              <article v-for="stage in [...stages].sort((a, b) => a.sort - b.sort)" :key="stage.id" :class="{ done: stage.status === 'done', current: stage.id === selectedStage?.id }">
                <StatusTag :tone="STAGE_STATUS_META[stage.status].tone" :text="STAGE_STATUS_META[stage.status].label" />
                <strong>{{ stage.name }}</strong>
                <span>{{ stage.progress }}% · {{ stage.weight }}% 权重</span>
                <small>{{ stage.plannedStart ? `${formatDateTime(stage.plannedStart).slice(0, 10)} → ${formatDateTime(stage.plannedEnd).slice(0, 10)}` : '计划日期待补充' }}</small>
              </article>
            </div>
          </section>

          <section class="pw__tasks">
            <div class="pw__section-head">
              <div><h4>施工任务</h4><p>设计师只读查看 PM 推进的任务事实；不代替项目经理推进节点。</p></div>
              <span>{{ taskSummary.doing }} 进行中 · {{ taskSummary.done }} 已完成 / {{ taskSummary.total }}</span>
            </div>
            <div v-if="!tasks.length" class="pw__inline-empty">当前项目还没有任务数据。</div>
            <div v-else class="pw__task-table">
              <div class="pw__task-row pw__task-row--head"><span>任务</span><span>阶段</span><span>状态</span><span>进度</span><span>负责人</span><span>计划</span></div>
              <div v-for="task in tasks" :key="task.id" class="pw__task-row">
                <span><strong>{{ task.name }}</strong><small>{{ task.quantity }} {{ task.unit || '' }}</small></span>
                <span>{{ stages.find((stage) => stage.id === task.stageId)?.name || '阶段待确认' }}</span>
                <span>{{ TASK_STATUS_LABELS[task.status] || task.status }}</span>
                <span>{{ task.progress }}%</span>
                <span>{{ task.ownerName || '负责人待确认' }}</span>
                <span>{{ task.plannedStart ? formatDateTime(task.plannedStart).slice(0, 10) : '—' }}</span>
              </div>
            </div>
          </section>
        </template>
        <EmptyState v-else title="请选择一个项目" description="项目工地只展示本人参与的项目，不展示其他设计师或 PM 的项目。" />
      </main>

      <aside class="pw__context">
        <section class="pw__summary">
          <div class="pw__panel-head"><strong>现场动态</strong></div>
          <div v-if="latestReport" class="pw__report">
            <strong>{{ latestReport.title }}</strong>
            <p>{{ latestReport.content || '现场内容待补充' }}</p>
            <small>{{ formatDateTime(latestReport.reportAt) }} · {{ latestReport.authorName || '记录人待确认' }}</small>
          </div>
          <EmptyState v-else title="暂无现场动态" description="现场记录由 PM 留证，设计师只读查看。" />
        </section>

        <section class="pw__summary">
          <div class="pw__panel-head"><strong>验收事实</strong></div>
          <div v-if="latestAcceptance" class="pw__acceptance">
            <StatusTag :tone="latestAcceptance.status === 'Confirmed' ? 'done' : latestAcceptance.status === 'Rejected' ? 'blocked' : 'pending'" :text="latestAcceptance.status === 'Confirmed' ? '业主已确认' : latestAcceptance.status === 'Rejected' ? '业主驳回' : '待确认'" />
            <p>{{ latestAcceptance.content || '验收说明待补充' }}</p>
            <small v-if="latestAcceptance.issues.length">问题：{{ latestAcceptance.issues.join('；') }}</small>
            <small>{{ formatDateTime(latestAcceptance.confirmedAt || latestAcceptance.createdAt) }}</small>
          </div>
          <EmptyState v-else title="暂无验收记录" description="阶段验收由 PM 提交、业主本人确认；设计师不得代录。" />
        </section>

        <section class="pw__boundary">
          <div class="pw__panel-head"><strong>设计师边界</strong></div>
          <ul>
            <li>可查看参与项目的阶段、任务、现场和验收事实</li>
            <li>不推进 PM 的开工、节点和验收动作</li>
            <li>不查看项目成本、毛利和利润</li>
            <li>不代替业主确认验收</li>
          </ul>
          <el-button type="primary" @click="router.push(`/designer/projects/${selectedProject?.id}/materials`)" :disabled="!selectedProject">打开主材选材</el-button>
          <el-button plain @click="router.push('/designer/contract')">回到合同交接</el-button>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped lang="scss">
.pw {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: $space-5;
}

.pw__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;

  h2 { margin: $space-1 0; font-size: $font-display; }
  p { margin: 0; max-width: 780px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
}

.pw__eyebrow {
  color: $brand-600 !important;
  font-size: $font-caption !important;
  font-weight: $font-weight-semibold;
  letter-spacing: .1em;
}

.pw__filters { display: flex; gap: $space-2; min-width: 520px; }

.pw__layout {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 330px;
  gap: $space-4;
  align-items: start;
}

.pw__pool,
.pw__main,
.pw__context {
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  box-shadow: $shadow-card;
  overflow: hidden;
}

.pw__pool,
.pw__context { position: sticky; top: $space-4; max-height: calc(100vh - #{$topbar-height} - #{$space-8}); overflow: auto; }

.pw__panel-head,
.pw__section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-3;
  padding: $space-4;
  border-bottom: 1px solid $border-color;

  h4 { margin: 0 0 $space-1; font-size: $font-title; }
  p { margin: 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
}

.pw__panel-head span,
.pw__section-head > span { color: $text-tertiary; font-size: $font-caption; }

.pw__project {
  width: 100%;
  padding: $space-3 $space-4;
  border: 0;
  border-bottom: 1px solid $border-color;
  background: transparent;
  text-align: left;
  cursor: pointer;

  &:hover,
  &.active { background: $brand-50; }
  > span { display: block; margin-top: $space-1; color: $text-secondary; font-size: $font-caption; }
}

.pw__project-top,
.pw__project-foot {
  display: flex !important;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;
}

.pw__project-top strong { color: $text-primary; font-size: $font-body; }
.pw__project-foot b { color: $brand-700; }

.pw__identity {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;
  padding: $space-5;
  border-bottom: 1px solid $border-color;
  background: linear-gradient(135deg, $brand-50 0%, $surface-0 72%);

  h3 { display: flex; align-items: center; gap: $space-2; margin: $space-1 0; font-size: $font-h1; }
  p { margin: 0; color: $text-secondary; font-size: $font-body-sm; }
}

.pw__progress {
  min-width: 180px;
  text-align: right;

  span { color: $text-secondary; font-size: $font-caption; }
  b { display: block; margin: $space-1 0; font-size: $font-display; color: $brand-700; }
}

.pw__progress-bar {
  height: 8px;
  border-radius: $radius-pill;
  background: $surface-100;
  overflow: hidden;

  i { display: block; height: 100%; background: $brand-500; }
}

.pw__stage-track {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: $space-2;
  padding: $space-4;
}

.pw__stage-track article {
  display: flex;
  flex-direction: column;
  gap: $space-1;
  padding: $space-3;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-50;

  &.current { border-color: $brand-300; background: $brand-50; }
  &.done { opacity: .82; }
  strong { margin-top: $space-1; font-size: $font-body-sm; }
  span,
  small { color: $text-secondary; font-size: $font-caption; }
}

.pw__task-table { min-width: 900px; overflow-x: auto; }

.pw__task-row {
  display: grid;
  grid-template-columns: minmax(220px, 1.5fr) 150px 100px 80px 130px 120px;
  align-items: center;
  gap: $space-2;
  min-height: 54px;
  padding: 0 $space-4;
  border-bottom: 1px solid $border-color;
  font-size: $font-body-sm;

  strong,
  small { display: block; }
  small { margin-top: 3px; color: $text-secondary; font-size: $font-caption; }
  > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}

.pw__task-row--head {
  min-height: 42px;
  background: $surface-50;
  color: $text-secondary;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
}

.pw__summary { padding: $space-4; border-bottom: 1px solid $border-color; }
.pw__report strong,
.pw__acceptance strong { display: block; }
.pw__report p,
.pw__acceptance p { margin: $space-2 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.6; }
.pw__report small,
.pw__acceptance small { display: block; color: $text-tertiary; font-size: $font-caption; }

.pw__boundary ul { margin: 0 0 $space-3; padding: 0; list-style: none; }
.pw__boundary li { padding: $space-2 0; border-bottom: 1px solid $border-color; color: $text-secondary; font-size: $font-body-sm; }
.pw__boundary .el-button { width: 100%; }

.pw__inline-empty,
.pw__loading { padding: $space-5; color: $text-secondary; font-size: $font-body-sm; }

@media (max-width: 1280px) {
  .pw__layout { grid-template-columns: 260px minmax(0, 1fr); }
  .pw__context { grid-column: 1 / -1; position: static; max-height: none; }
  .pw__stage-track { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 1024px) {
  .pw__head,
  .pw__filters { flex-direction: column; align-items: stretch; min-width: 0; }
  .pw__layout { grid-template-columns: 1fr; }
  .pw__pool { position: static; max-height: none; }
  .pw__identity { flex-direction: column; }
  .pw__stage-track { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
