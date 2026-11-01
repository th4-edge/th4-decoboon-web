<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StatusTag from '@/components/StatusTag.vue'
import ObjectHeroCard from '@/components/workbench/ObjectHeroCard.vue'
import { feedbackApi } from '@/domains/feedback/api'
import type { CustomerFeedback, FeedbackStatus } from '@/domains/feedback/model'
import { FEEDBACK_KIND_LABELS, FEEDBACK_TYPE_LABELS } from '@/domains/feedback/meta'
import { projectApi } from '@/domains/project/api'
import type { ProjectBrief } from '@/domains/project/model'
import { useSessionStore } from '@/stores/session'
import { formatDateTime, formatRelativeDay } from '@/core/format'

const router = useRouter()
const session = useSessionStore()

type ProjectFilter = 'all' | 'open' | 'complaint' | 'closed'
type FeedbackFilter = 'all' | FeedbackStatus

const projects = ref<ProjectBrief[]>([])
const feedback = ref<CustomerFeedback[]>([])
const selectedProjectId = ref('')
const selectedProject = ref<ProjectBrief | null>(null)
const selectedFeedback = ref<CustomerFeedback | null>(null)
const activeProjectFilter = ref<ProjectFilter>('all')
const activeFeedbackFilter = ref<FeedbackFilter>('all')
const projectKeyword = ref('')
const feedbackKeyword = ref('')
const loading = ref(false)
const error = ref('')
const detailVisible = ref(false)
const responseText = ref('')
const saving = ref(false)
const actionError = ref('')

const canHandle = computed(() => ['Designer', 'Pm', 'Boss', 'StoreManager'].includes(session.role ?? ''))

const projectFeedback = computed(() => selectedProjectId.value
  ? feedback.value.filter((item) => item.projectId === selectedProjectId.value)
  : [])

const openProjectFeedback = computed(() => projectFeedback.value.filter((item) => !['resolved', 'closed'].includes(item.status)))
const complaintProjectFeedback = computed(() => projectFeedback.value.filter((item) => item.kind === 'complaint'))
const pendingOwnerFeedback = computed(() => projectFeedback.value.filter((item) => item.status === 'resolved'))
const closedProjectFeedback = computed(() => projectFeedback.value.filter((item) => item.status === 'closed'))

const feedbackByProject = computed(() => {
  const map = new Map<string, CustomerFeedback[]>()
  for (const item of feedback.value) {
    map.set(item.projectId, [...(map.get(item.projectId) ?? []), item])
  }
  return map
})

const filteredProjects = computed(() => {
  const query = projectKeyword.value.trim().toLowerCase()
  return [...projects.value]
    .sort((left, right) => {
      const leftOpen = (feedbackByProject.value.get(left.id) ?? []).filter((item) => !['resolved', 'closed'].includes(item.status)).length
      const rightOpen = (feedbackByProject.value.get(right.id) ?? []).filter((item) => !['resolved', 'closed'].includes(item.status)).length
      return rightOpen - leftOpen || String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? ''))
    })
    .filter((project) => {
      const items = feedbackByProject.value.get(project.id) ?? []
      const open = items.filter((item) => !['resolved', 'closed'].includes(item.status)).length
      const complaints = items.some((item) => item.kind === 'complaint')
      const closed = items.length > 0 && open === 0
      const filterMatched = activeProjectFilter.value === 'all'
        || (activeProjectFilter.value === 'open' && open > 0)
        || (activeProjectFilter.value === 'complaint' && complaints)
        || (activeProjectFilter.value === 'closed' && closed)
      if (!filterMatched) return false
      if (!query) return true
      return [project.name, project.no, project.propertyName, project.community, project.managerName, project.designerName]
        .some((value) => String(value ?? '').toLowerCase().includes(query))
    })
})

const filteredFeedback = computed(() => {
  const query = feedbackKeyword.value.trim().toLowerCase()
  return projectFeedback.value
    .filter((item) => activeFeedbackFilter.value === 'all' || item.status === activeFeedbackFilter.value)
    .filter((item) => {
      if (!query) return true
      return [item.title, item.content, item.response, FEEDBACK_TYPE_LABELS[item.type], item.handlerName]
        .some((value) => String(value ?? '').toLowerCase().includes(query))
    })
    .sort((left, right) => {
      const rank = (item: CustomerFeedback) => item.status === 'submitted' ? 0 : item.kind === 'complaint' ? 1 : item.status === 'escalated' ? 2 : item.status === 'resolved' ? 3 : 4
      return rank(left) - rank(right) || String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? ''))
    })
})

watch(selectedProjectId, (id) => {
  selectedProject.value = projects.value.find((project) => project.id === id) ?? null
  selectedFeedback.value = null
})

onMounted(() => {
  void load()
})

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const [projectPage, feedbackList] = await Promise.all([
      projectApi.pageProjects({ current: 1, size: 200 }),
      feedbackApi.listProjectFeedback()
    ])
    projects.value = projectPage.list
    feedback.value = feedbackList
    const firstWithOpen = projects.value.find((project) =>
      feedbackList.some((item) => item.projectId === project.id && !['resolved', 'closed'].includes(item.status))
    )
    selectedProjectId.value = firstWithOpen?.id ?? projects.value[0]?.id ?? ''
  } catch (err) {
    projects.value = []
    feedback.value = []
    selectedProjectId.value = ''
    error.value = err instanceof Error ? err.message : '客户意见投诉暂不可确认'
  } finally {
    loading.value = false
  }
}

function projectAddress(project: ProjectBrief): string {
  return [project.community, project.propertyName, project.address].filter(Boolean).join(' · ') || '房屋地址待补充'
}

function openFeedback(item: CustomerFeedback): void {
  selectedFeedback.value = item
  responseText.value = item.response ?? ''
  actionError.value = ''
  detailVisible.value = true
}

function openProject(): void {
  if (selectedProject.value) void router.push(`/designer/projects?projectId=${selectedProject.value.id}`)
}

function projectOpenCount(projectId: string): number {
  return (feedbackByProject.value.get(projectId) ?? []).filter((item) => !['resolved', 'closed'].includes(item.status)).length
}

function projectTotalCount(projectId: string): number {
  return feedbackByProject.value.get(projectId)?.length ?? 0
}

function dueLabel(value?: string): string {
  if (!value) return '暂不可确认'
  return formatRelativeDay(value)
}

function isOverdue(item: CustomerFeedback): boolean {
  if (!item.dueAt || ['resolved', 'closed'].includes(item.status)) return false
  const due = new Date(item.dueAt.includes('T') ? item.dueAt : item.dueAt.replace(/-/g, '/'))
  return !Number.isNaN(due.getTime()) && due.getTime() < Date.now()
}

function satisfactionLabel(value?: number): string {
  return value ? `${value} / 5` : '未评价'
}

async function submitResponse(): Promise<void> {
  const item = selectedFeedback.value
  if (!item || !canHandle.value) return
  if (!responseText.value.trim()) {
    actionError.value = '请填写处理回复'
    return
  }
  saving.value = true
  actionError.value = ''
  try {
    const updated = await feedbackApi.resolveFeedback(item.id, responseText.value)
    await load()
    selectedFeedback.value = feedback.value.find((row) => row.id === updated.id) ?? updated
    ElMessage.success('处理回复已提交，等待业主确认关闭')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '处理回复提交失败'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="cf">
    <header class="cf__head">
      <div>
        <p class="cf__eyebrow">项目交付 · 客户意见投诉</p>
        <h2>查看并处理已有客户意见与投诉</h2>
        <p>业主在小程序提交意见或投诉，员工在这里查看项目上下文、响应诉求并形成处理记录；员工不能代业主关闭。</p>
      </div>
      <el-button :loading="loading" @click="load">刷新意见投诉</el-button>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />

    <div v-else class="cf__layout">
      <aside class="cf__queue">
        <div class="cf__queue-head">
          <div><strong>项目工地</strong><span>{{ filteredProjects.length }} / {{ projects.length }}</span></div>
          <el-input v-model="projectKeyword" clearable placeholder="项目、小区、门牌" />
        </div>
        <div class="cf__filters">
          <button type="button" :class="{ active: activeProjectFilter === 'all' }" @click="activeProjectFilter = 'all'">全部</button>
          <button type="button" :class="{ active: activeProjectFilter === 'open' }" @click="activeProjectFilter = 'open'">有未关闭</button>
          <button type="button" :class="{ active: activeProjectFilter === 'complaint' }" @click="activeProjectFilter = 'complaint'">有投诉</button>
          <button type="button" :class="{ active: activeProjectFilter === 'closed' }" @click="activeProjectFilter = 'closed'">已关闭</button>
        </div>
        <div class="cf__queue-list">
          <SkeletonBlock v-if="loading && !projects.length" variant="card" :rows="5" />
          <EmptyState v-else-if="!filteredProjects.length" title="当前没有项目" description="项目进入履约后，业主提交的意见和投诉会在对应项目下显示。" />
          <button
            v-for="project in filteredProjects"
            v-else
            :key="project.id"
            type="button"
            class="cf-project"
            :class="{ 'cf-project--active': project.id === selectedProjectId }"
            @click="selectedProjectId = project.id"
          >
            <span class="cf-project__top">
              <BusinessStateTag object-key="project" :status-key="project.status" :dot="false" />
              <em>{{ project.currentStageName || '项目进行中' }}</em>
            </span>
            <strong>{{ project.name }}</strong>
            <small>{{ projectAddress(project) }}</small>
            <span class="cf-project__facts">
              <b v-if="projectOpenCount(project.id)">未关闭 {{ projectOpenCount(project.id) }}</b>
              <b>{{ projectTotalCount(project.id) }} 条记录</b>
            </span>
          </button>
        </div>
      </aside>

      <main class="cf__workspace">
        <SkeletonBlock v-if="loading && !selectedProject" variant="card" :rows="7" />
        <EmptyState v-else-if="!selectedProject" title="选择一个项目" description="左侧项目工地显示当前数据范围内有项目记录的项目。" />
        <template v-else>
          <ObjectHeroCard>
            <template #avatar>意</template>
            <template #title>
              <h2>{{ selectedProject.name }}</h2>
              <BusinessStateTag object-key="project" :status-key="selectedProject.status" />
            </template>
            <template #subtitle>{{ projectAddress(selectedProject) }}</template>
            <template #chips>
              <StatusTag :text="`未关闭 ${openProjectFeedback.length}`" :tone="openProjectFeedback.length ? 'pending' : 'todo'" :dot="false" />
              <StatusTag v-if="complaintProjectFeedback.length" :text="`投诉 ${complaintProjectFeedback.length}`" tone="blocked" :dot="false" />
              <StatusTag :text="`已关闭 ${closedProjectFeedback.length}`" tone="done" :dot="false" />
            </template>
            <template #facts>
              <div><small>当前阶段</small><b>{{ selectedProject.currentStageName || '阶段待确认' }}</b></div>
              <div><small>项目经理</small><b>{{ selectedProject.managerName || '待分配' }}</b></div>
              <div><small>设计负责人</small><b>{{ selectedProject.designerName || '待分配' }}</b></div>
              <div><small>全部记录</small><b>{{ projectFeedback.length }}</b></div>
            </template>
            <template #actions>
              <div class="cf__hero-actions">
                <small>此页只查看和处理已有意见投诉；提交入口在业主小程序，关闭由业主本人确认。</small>
                <el-button plain @click="openProject">打开项目工地</el-button>
              </div>
            </template>
          </ObjectHeroCard>

          <section class="cf__panel">
            <header>
              <div><h3>意见与投诉记录</h3><p>投诉优先显示；点击记录查看现场说明、处理回复和业主关闭状态。</p></div>
              <el-input v-model="feedbackKeyword" clearable placeholder="标题、内容、处理人" />
            </header>
            <div class="cf__filters cf__filters--record">
              <button type="button" :class="{ active: activeFeedbackFilter === 'all' }" @click="activeFeedbackFilter = 'all'">全部 {{ projectFeedback.length }}</button>
              <button type="button" :class="{ active: activeFeedbackFilter === 'submitted' }" @click="activeFeedbackFilter = 'submitted'">待受理 {{ projectFeedback.filter((item) => item.status === 'submitted').length }}</button>
              <button type="button" :class="{ active: activeFeedbackFilter === 'processing' }" @click="activeFeedbackFilter = 'processing'">处理中 {{ projectFeedback.filter((item) => item.status === 'processing').length }}</button>
              <button type="button" :class="{ active: activeFeedbackFilter === 'escalated' }" @click="activeFeedbackFilter = 'escalated'">已升级 {{ projectFeedback.filter((item) => item.status === 'escalated').length }}</button>
              <button type="button" :class="{ active: activeFeedbackFilter === 'resolved' }" @click="activeFeedbackFilter = 'resolved'">已回复 {{ pendingOwnerFeedback.length }}</button>
              <button type="button" :class="{ active: activeFeedbackFilter === 'closed' }" @click="activeFeedbackFilter = 'closed'">已关闭 {{ closedProjectFeedback.length }}</button>
            </div>
            <SkeletonBlock v-if="loading" variant="table" :rows="4" />
            <EmptyState v-else-if="!filteredFeedback.length" title="当前项目暂无意见投诉" description="业主提交后会出现在这里，员工不能代业主创建或关闭。" />
            <div v-else class="cf-list">
              <button v-for="item in filteredFeedback" :key="item.id" type="button" class="cf-row" :class="{ 'cf-row--overdue': isOverdue(item) }" @click="openFeedback(item)">
                <span class="cf-row__kind"><StatusTag :text="FEEDBACK_KIND_LABELS[item.kind]" :tone="item.kind === 'complaint' ? 'blocked' : 'info'" :dot="false" /></span>
                <span class="cf-row__main">
                  <strong>{{ item.title || '意见投诉标题待补充' }}</strong>
                  <small>{{ FEEDBACK_TYPE_LABELS[item.type] }} · {{ item.content || '内容待补充' }}</small>
                </span>
                <span class="cf-row__status"><BusinessStateTag object-key="customerFeedback" :status-key="item.status" :dot="false" /></span>
                <span class="cf-row__due" :class="{ 'is-overdue': isOverdue(item) }">
                  <b>{{ dueLabel(item.dueAt) }}</b>
                  <small>{{ item.handlerName || '处理人待确认' }}</small>
                </span>
              </button>
            </div>
          </section>
        </template>
      </main>
    </div>

    <el-drawer v-model="detailVisible" title="客户意见投诉详情" size="760px">
      <template v-if="selectedFeedback">
        <div class="cf-detail">
          <header class="cf-detail__head">
            <div>
              <span>{{ FEEDBACK_KIND_LABELS[selectedFeedback.kind] }} · {{ FEEDBACK_TYPE_LABELS[selectedFeedback.type] }}</span>
              <h3>{{ selectedFeedback.title }}</h3>
              <p>{{ selectedFeedback.projectName || selectedProject?.name || '项目' }} · {{ selectedFeedback.propertyAddress || '房屋地址待补充' }}</p>
            </div>
            <BusinessStateTag object-key="customerFeedback" :status-key="selectedFeedback.status" />
          </header>

          <section class="cf-detail__facts">
            <div><small>提交时间</small><b>{{ formatDateTime(selectedFeedback.createdAt) }}</b></div>
            <div><small>处理人</small><b>{{ selectedFeedback.handlerName || '待确认' }}</b></div>
            <div><small>承诺解决</small><b :class="{ 'is-overdue': isOverdue(selectedFeedback) }">{{ dueLabel(selectedFeedback.dueAt) }}</b></div>
            <div><small>关联阶段</small><b>{{ selectedFeedback.stageName || '未关联阶段' }}</b></div>
          </section>

          <section class="cf-detail__section">
            <h4>客户说明</h4>
            <p class="cf-detail__content">{{ selectedFeedback.content || '内容待补充' }}</p>
            <div v-if="selectedFeedback.images.length" class="cf-detail__images">
              <el-image
                v-for="(image, index) in selectedFeedback.images"
                :key="image"
                :src="image"
                :preview-src-list="selectedFeedback.images"
                :initial-index="index"
                fit="cover"
                class="cf-detail__image"
              />
            </div>
          </section>

          <section v-if="selectedFeedback.response" class="cf-detail__section cf-detail__response">
            <h4>处理回复</h4>
            <p>{{ selectedFeedback.response }}</p>
            <small>{{ formatDateTime(selectedFeedback.respondedAt) }}</small>
          </section>

          <section v-if="selectedFeedback.status === 'closed'" class="cf-detail__section cf-detail__closed">
            <h4>业主已关闭</h4>
            <p>关闭时间：{{ formatDateTime(selectedFeedback.closedAt) }} · 满意度：{{ satisfactionLabel(selectedFeedback.satisfaction) }}</p>
          </section>

          <section v-if="canHandle && !['resolved', 'closed'].includes(selectedFeedback.status)" class="cf-detail__section">
            <h4>提交处理回复</h4>
            <p>说明已采取的措施、结果和后续安排；提交后状态变为“已回复”，由业主确认关闭。</p>
            <el-input v-model="responseText" type="textarea" :rows="5" maxlength="2048" show-word-limit placeholder="例如：已安排项目经理今天下午上门复核，并在完成后上传整改照片。" />
            <el-alert v-if="actionError" type="warning" :closable="false" :title="actionError" show-icon />
            <el-button type="primary" :loading="saving" :disabled="!responseText.trim()" @click="submitResponse">提交处理回复</el-button>
          </section>
          <section v-else-if="selectedFeedback.status === 'resolved'" class="cf-detail__section cf-detail__wait">
            <h4>等待业主确认关闭</h4>
            <p>员工已提交处理回复；业主确认问题解决后，由业主本人关闭，员工不能代关闭。</p>
          </section>
          <section v-else-if="!canHandle && !['closed'].includes(selectedFeedback.status)" class="cf-detail__section cf-detail__readonly">
            <h4>当前角色只读</h4>
            <p>财务角色可查看客户意见投诉事实和处理进度，不提交处理回复。</p>
          </section>
        </div>
      </template>
      <EmptyState v-else title="请选择一条意见投诉" description="左侧列表展示当前项目已有记录。" />
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/workbench-shell' as wb;

.cf { display: flex; flex-direction: column; gap: $space-4; padding: $space-5; }
.cf__head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-4; }
.cf__head h2 { margin: $space-1 0; font-size: $font-display; }
.cf__head p { margin: 0; max-width: 820px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
.cf__eyebrow { color: $brand-600 !important; font-size: $font-caption !important; font-weight: $font-weight-semibold; letter-spacing: .1em; }
.cf__layout { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: $space-4; align-items: start; }
.cf__queue { @include wb.workbench-queue; }
.cf__queue-list { @include wb.workbench-queue-scroll; }
.cf__queue-head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-2; padding: $space-3 $space-4; border-bottom: 1px solid $border-color; }
.cf__queue-head strong { display: block; font-size: $font-body-sm; }
.cf__queue-head span { display: block; margin-top: 2px; color: $text-tertiary; font-size: $font-caption; }
.cf__queue-head :deep(.el-input) { width: 150px; }
.cf__filters { display: flex; flex-wrap: wrap; gap: $space-1; padding: $space-2 $space-4; border-bottom: 1px solid $border-color; }
.cf__filters button { padding: 4px 7px; border: 1px solid $border-color; border-radius: $radius-pill; background: $surface-0; color: $text-secondary; font-size: $font-caption; cursor: pointer; }
.cf__filters button.active { border-color: $brand-300; background: $brand-50; color: $brand-700; font-weight: $font-weight-semibold; }
.cf-project { width: 100%; padding: $space-3 $space-4; border: 0; border-bottom: 1px solid $border-color; background: transparent; text-align: left; cursor: pointer; }
.cf-project:hover, .cf-project--active { background: $brand-50; }
.cf-project--active { box-shadow: inset 3px 0 0 $brand-500; }
.cf-project__top, .cf-project__facts { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.cf-project__top em { overflow: hidden; color: $text-tertiary; font-size: $font-caption; font-style: normal; text-overflow: ellipsis; white-space: nowrap; }
.cf-project > strong { display: block; margin-top: 6px; overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
.cf-project > small { display: block; margin-top: 3px; overflow: hidden; color: $text-secondary; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; }
.cf-project__facts { justify-content: flex-start; margin-top: 7px; color: $text-secondary; font-size: $font-caption; }
.cf-project__facts b + b { padding-left: $space-2; border-left: 1px solid $border-color; }
.cf__workspace { display: flex; flex-direction: column; gap: $space-4; min-width: 0; max-height: calc(100vh - 230px); overflow: auto; padding-right: 2px; }
.cf__hero-actions { display: flex; align-items: center; gap: $space-3; }
.cf__hero-actions small { color: $text-secondary; font-size: $font-caption; line-height: 1.5; }
.cf__panel { border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; box-shadow: $shadow-card; }
.cf__panel > header { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; padding: $space-4; border-bottom: 1px solid $border-color; }
.cf__panel h3 { margin: 0; font-size: $font-title; }
.cf__panel p { margin: 4px 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.55; }
.cf__panel > header :deep(.el-input) { width: 220px; }
.cf__filters--record { border-bottom: 1px solid $border-color; }
.cf-list { padding: 0 $space-4 $space-2; }
.cf-row { display: grid; grid-template-columns: 70px minmax(0, 1fr) 92px 140px; align-items: center; gap: $space-3; width: 100%; padding: $space-3; border: 0; border-bottom: 1px solid $border-color; background: transparent; text-align: left; cursor: pointer; }
.cf-row:hover { background: $brand-50; }
.cf-row--overdue { border-left: 3px solid $danger-500; }
.cf-row__kind { display: flex; justify-content: flex-start; }
.cf-row__main { min-width: 0; }
.cf-row__main strong, .cf-row__main small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cf-row__main strong { color: $text-primary; font-size: $font-body-sm; }
.cf-row__main small { margin-top: 3px; color: $text-secondary; font-size: $font-caption; }
.cf-row__status { display: flex; justify-content: flex-end; }
.cf-row__due { text-align: right; }
.cf-row__due b, .cf-row__due small { display: block; }
.cf-row__due b { color: $text-primary; font-size: $font-caption; }
.cf-row__due small { margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }
.cf-row__due.is-overdue b { color: $danger-500; }
.cf-detail { display: flex; flex-direction: column; gap: $space-4; }
.cf-detail__head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; padding: $space-4; border-radius: $radius-md; background: linear-gradient(135deg, $brand-50, $surface-0 72%); border: 1px solid $border-color; }
.cf-detail__head span { color: $brand-600; font-size: $font-caption; font-weight: $font-weight-semibold; }
.cf-detail__head h3 { margin: 4px 0; font-size: $font-h1; }
.cf-detail__head p { margin: 0; color: $text-secondary; font-size: $font-caption; }
.cf-detail__facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-2; }
.cf-detail__facts div { padding: $space-3; border-radius: $radius-sm; background: $surface-50; }
.cf-detail__facts small, .cf-detail__facts b { display: block; }
.cf-detail__facts small { color: $text-tertiary; font-size: $font-caption; }
.cf-detail__facts b { margin-top: 3px; color: $text-primary; font-size: $font-body-sm; }
.cf-detail__facts b.is-overdue { color: $danger-500; }
.cf-detail__section { padding: $space-4; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; }
.cf-detail__section h4 { margin: 0 0 $space-2; font-size: $font-body-sm; }
.cf-detail__section p { margin: 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; white-space: pre-wrap; }
.cf-detail__content { color: $text-primary !important; }
.cf-detail__images { display: flex; flex-wrap: wrap; gap: $space-2; margin-top: $space-3; }
.cf-detail__image { width: 96px; height: 96px; border: 1px solid $border-color; border-radius: $radius-sm; overflow: hidden; cursor: zoom-in; }
.cf-detail__response { border-color: $brand-200; background: $brand-50; }
.cf-detail__response small { display: block; margin-top: $space-2; color: $text-tertiary; font-size: $font-caption; }
.cf-detail__closed, .cf-detail__wait { background: $success-50; border-color: $success-500; }
.cf-detail__readonly { background: $surface-50; }
.cf-detail__section .el-input { margin-top: $space-2; }
.cf-detail__section .el-alert { margin-top: $space-2; }
.cf-detail__section .el-button { margin-top: $space-3; }

@media (max-width: 1024px) {
  .cf__head { flex-direction: column; }
  .cf__layout { grid-template-columns: 1fr; }
  .cf__queue { position: static; max-height: none; }
  .cf__queue-list { overflow: visible; }
  .cf__workspace { max-height: none; overflow: visible; }
  .cf-row { grid-template-columns: 64px minmax(0, 1fr); }
  .cf-row__status, .cf-row__due { grid-column: 2; text-align: left; justify-content: flex-start; }
  .cf__hero-actions { align-items: flex-start; flex-direction: column; }
}
</style>
