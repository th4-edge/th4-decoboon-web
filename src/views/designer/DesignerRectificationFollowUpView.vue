<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StatusTag from '@/components/StatusTag.vue'
import ObjectHeroCard from '@/components/workbench/ObjectHeroCard.vue'
import { acceptanceApi } from '@/domains/acceptance/api'
import type { RectifyItem, RectificationType } from '@/domains/acceptance/model'
import { projectApi } from '@/domains/project/api'
import type { ProjectBrief } from '@/domains/project/model'
import { formatRelativeDay } from '@/core/format'

type ProjectFilter = 'all' | 'overdue' | RectificationType
type ItemFilter = 'all' | 'overdue' | RectificationType

const route = useRoute()
const router = useRouter()

const items = ref<RectifyItem[]>([])
const selectedProjectId = ref('')
const project = ref<ProjectBrief | null>(null)
const activeProjectFilter = ref<ProjectFilter>('all')
const activeItemFilter = ref<ItemFilter>('all')
const projectKeyword = ref('')
const itemKeyword = ref('')
const loading = ref(false)
const detailLoading = ref(false)
const error = ref('')

const projectGroups = computed(() => {
  const map = new Map<string, RectifyItem[]>()
  for (const item of items.value) {
    map.set(item.projectId, [...(map.get(item.projectId) ?? []), item])
  }
  return [...map.entries()].map(([projectId, list]) => ({
    projectId,
    projectNo: list[0]?.projectNo,
    projectName: list[0]?.projectName || '项目待命名',
    items: list,
    overdueCount: list.filter((item) => item.overdueDays > 0).length,
    earliestDue: list
      .map((item) => item.rectificationDueDate)
      .filter((value): value is string => Boolean(value))
      .sort()[0]
  }))
})

const filteredProjects = computed(() => {
  const query = projectKeyword.value.trim().toLowerCase()
  return projectGroups.value
    .filter((group) => {
      const typeMatched = activeProjectFilter.value === 'all'
        || (activeProjectFilter.value === 'overdue' && group.overdueCount > 0)
        || group.items.some((item) => item.rectificationType === activeProjectFilter.value)
      if (!typeMatched) return false
      if (!query) return true
      return [group.projectName, ...group.items.flatMap((item) => [item.stageName, item.rectificationOwnerName, ...item.issues])]
        .some((value) => String(value ?? '').toLowerCase().includes(query))
    })
    .sort((left, right) => right.overdueCount - left.overdueCount || String(left.earliestDue ?? '9999').localeCompare(String(right.earliestDue ?? '9999')))
})

const selectedProjectItems = computed(() => items.value.filter((item) => item.projectId === selectedProjectId.value))

const filteredItems = computed(() => {
  const query = itemKeyword.value.trim().toLowerCase()
  return selectedProjectItems.value
    .filter((item) => activeItemFilter.value === 'all'
      || (activeItemFilter.value === 'overdue' && item.overdueDays > 0)
      || item.rectificationType === activeItemFilter.value)
    .filter((item) => {
      if (!query) return true
      return [item.stageName, item.conclusion, item.rectificationOwnerName, item.nextAction, ...item.issues]
        .some((value) => String(value ?? '').toLowerCase().includes(query))
    })
    .sort((left, right) => right.overdueDays - left.overdueDays || left.roundNo - right.roundNo)
})

const overdueCount = computed(() => selectedProjectItems.value.filter((item) => item.overdueDays > 0).length)
const constructionCount = computed(() => selectedProjectItems.value.filter((item) => item.rectificationType === 'construction').length)
const designCount = computed(() => selectedProjectItems.value.filter((item) => item.rectificationType === 'design').length)

watch(selectedProjectId, async (id) => {
  project.value = null
  if (!id) return
  detailLoading.value = true
  try {
    project.value = await projectApi.projectInfo(id)
  } catch {
    const group = projectGroups.value.find((item) => item.projectId === id)
    project.value = group ? {
      id: group.projectId,
      no: '',
      name: group.projectName,
      status: 'ongoing',
      progress: 0,
      area: 0,
      contractAmount: 0
    } : null
  } finally {
    detailLoading.value = false
  }
})

onMounted(() => {
  void load()
})

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    items.value = await acceptanceApi.listRectifyItems()
    const routeProjectId = String(route.query.projectId ?? '')
    const target = projectGroups.value.find((group) => group.projectId === routeProjectId) ?? projectGroups.value[0]
    selectedProjectId.value = target?.projectId ?? ''
  } catch (err) {
    items.value = []
    selectedProjectId.value = ''
    error.value = err instanceof Error ? err.message : '整改跟进清单暂不可确认'
  } finally {
    loading.value = false
  }
}

function openRectification(item: RectifyItem): void {
  void router.push(`/designer/projects/${item.projectId}/acceptance?stageId=${item.stageId}`)
}

function rectificationTypeLabel(item: RectifyItem): string {
  if (item.rectificationTypeName) return item.rectificationTypeName
  if (item.rectificationType === 'construction') return '施工整改'
  if (item.rectificationType === 'design') return '设计整改'
  return '整改类型待确认'
}

function dueLabel(item: RectifyItem): string {
  if (item.overdueDays > 0) return `已逾期 ${item.overdueDays} 天`
  return formatRelativeDay(item.rectificationDueDate)
}

function projectAddress(item: ProjectBrief): string {
  return [item.community, item.propertyName, item.address].filter(Boolean).join(' · ') || '房屋地址待补充'
}
</script>

<template>
  <div class="rf">
    <header class="rf__head">
      <div>
        <p class="rf__eyebrow">项目交付 · 整改跟进</p>
        <h2>跟进业主驳回后的阶段整改与复验</h2>
        <p>整改复用同一阶段、同一张验收单和不限次数轮次；这里只查看整改中项目，提交整改说明和整改后照片请进入对应阶段验收工作区。</p>
      </div>
      <el-button :loading="loading" @click="load">刷新整改清单</el-button>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />

    <div v-else class="rf__layout">
      <aside class="rf__queue">
        <div class="rf__queue-head">
          <div><strong>整改中项目</strong><span>{{ filteredProjects.length }} / {{ projectGroups.length }}</span></div>
          <el-input v-model="projectKeyword" clearable placeholder="项目、阶段、问题" />
        </div>
        <div class="rf__filters">
          <button type="button" :class="{ active: activeProjectFilter === 'all' }" @click="activeProjectFilter = 'all'">全部</button>
          <button type="button" :class="{ active: activeProjectFilter === 'overdue' }" @click="activeProjectFilter = 'overdue'">已逾期</button>
          <button type="button" :class="{ active: activeProjectFilter === 'construction' }" @click="activeProjectFilter = 'construction'">施工整改</button>
          <button type="button" :class="{ active: activeProjectFilter === 'design' }" @click="activeProjectFilter = 'design'">设计整改</button>
        </div>
        <div class="rf__queue-list">
          <SkeletonBlock v-if="loading && !projectGroups.length" variant="card" :rows="5" />
          <EmptyState v-else-if="!filteredProjects.length" title="当前没有整改中的阶段" description="业主驳回阶段验收后，会在这里形成整改跟进项。" />
          <button
            v-for="group in filteredProjects"
            v-else
            :key="group.projectId"
            type="button"
            class="rf-project"
            :class="{ 'rf-project--active': group.projectId === selectedProjectId }"
            @click="selectedProjectId = group.projectId"
          >
            <span class="rf-project__top">
              <StatusTag :text="group.overdueCount ? `${group.overdueCount} 项逾期` : '整改中'" :tone="group.overdueCount ? 'blocked' : 'pending'" :dot="false" />
              <em>{{ group.projectName || '项目进行中' }}</em>
            </span>
            <strong>{{ group.projectName }}</strong>
            <small>{{ group.items.length }} 个阶段 · {{ group.overdueCount }} 项逾期</small>
            <span class="rf-project__due">最早截止：{{ formatRelativeDay(group.earliestDue) }}</span>
          </button>
        </div>
      </aside>

      <main class="rf__workspace">
        <SkeletonBlock v-if="detailLoading && !project" variant="card" :rows="7" />
        <EmptyState v-else-if="!selectedProjectId" title="请选择整改项目" description="左侧只显示当前数据范围内存在整改中阶段的项目。" />
        <template v-else>
          <ObjectHeroCard>
            <template #avatar>改</template>
            <template #title>
              <h2>{{ project?.name || '项目待确认' }}</h2>
              <BusinessStateTag v-if="project" object-key="project" :status-key="project.status" />
            </template>
            <template #subtitle>{{ project ? projectAddress(project) : '项目地址待确认' }}</template>
            <template #chips>
              <StatusTag :text="`整改阶段 ${selectedProjectItems.length}`" tone="pending" :dot="false" />
              <StatusTag v-if="overdueCount" :text="`逾期 ${overdueCount}`" tone="blocked" :dot="false" />
              <StatusTag :text="`轮次 ${selectedProjectItems.map((item) => item.roundNo).sort((a, b) => b - a)[0] || 0}`" tone="info" :dot="false" />
            </template>
            <template #facts>
              <div><small>整改阶段</small><b>{{ selectedProjectItems.length }}</b></div>
              <div><small>已逾期</small><b :class="{ 'is-overdue': overdueCount > 0 }">{{ overdueCount }}</b></div>
              <div><small>施工整改</small><b>{{ constructionCount }}</b></div>
              <div><small>设计整改</small><b>{{ designCount }}</b></div>
            </template>
            <template #actions>
              <small class="rf__boundary">整改只改变质量事实和阶段状态，不修改合同、成本、应收、应付、结算或利润；员工不能代替业主确认或驳回。</small>
            </template>
          </ObjectHeroCard>

          <section class="rf__panel">
            <header>
              <div><h3>整改中阶段</h3><p>点击进入阶段验收工作区，提交整改说明和整改后照片并发起复验。</p></div>
              <el-input v-model="itemKeyword" clearable placeholder="阶段、问题、责任人" />
            </header>
            <div class="rf__filters rf__filters--items">
              <button type="button" :class="{ active: activeItemFilter === 'all' }" @click="activeItemFilter = 'all'">全部 {{ selectedProjectItems.length }}</button>
              <button type="button" :class="{ active: activeItemFilter === 'overdue' }" @click="activeItemFilter = 'overdue'">已逾期 {{ overdueCount }}</button>
              <button type="button" :class="{ active: activeItemFilter === 'construction' }" @click="activeItemFilter = 'construction'">施工整改 {{ constructionCount }}</button>
              <button type="button" :class="{ active: activeItemFilter === 'design' }" @click="activeItemFilter = 'design'">设计整改 {{ designCount }}</button>
            </div>
            <EmptyState v-if="!filteredItems.length" title="当前筛选下没有整改阶段" description="可以切换筛选或进入对应项目验收工作区查看历史。" />
            <div v-else class="rf-list">
              <button v-for="item in filteredItems" :key="item.acceptanceId" type="button" class="rf-row" :class="{ 'rf-row--overdue': item.overdueDays > 0 }" @click="openRectification(item)">
                <span class="rf-row__stage">
                  <StatusTag text="整改中" tone="blocked" :dot="false" />
                  <small>第 {{ item.roundNo }} 轮</small>
                </span>
                <span class="rf-row__main">
                  <strong>{{ item.stageName || '阶段待确认' }}</strong>
                  <small>{{ rectificationTypeLabel(item) }} · {{ item.rectificationOwnerName || '整改责任人待确认' }}</small>
                  <em v-if="item.issues?.length">{{ item.issues.slice(0, 2).join('；') }}</em>
                  <em v-else>{{ item.conclusion || '整改问题待确认' }}</em>
                </span>
                <span class="rf-row__due" :class="{ 'is-overdue': item.overdueDays > 0 }">
                  <b>{{ dueLabel(item) }}</b>
                  <small>截止 {{ item.rectificationDueDate || '暂不可确认' }}</small>
                </span>
                <span class="rf-row__next">{{ item.nextAction || '进入阶段验收工作区提交整改证据' }}</span>
              </button>
            </div>
          </section>
        </template>
      </main>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/workbench-shell' as wb;

.rf { display: flex; flex-direction: column; gap: $space-4; padding: $space-5; }
.rf__head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-4; }
.rf__head h2 { margin: $space-1 0; font-size: $font-display; }
.rf__head p { margin: 0; max-width: 860px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
.rf__eyebrow { color: $brand-600 !important; font-size: $font-caption !important; font-weight: $font-weight-semibold; letter-spacing: .1em; }
.rf__layout { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: $space-4; align-items: start; }
.rf__queue { @include wb.workbench-queue; }
.rf__queue-list { @include wb.workbench-queue-scroll; }
.rf__queue-head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-2; padding: $space-3 $space-4; border-bottom: 1px solid $border-color; }
.rf__queue-head strong { display: block; font-size: $font-body-sm; }
.rf__queue-head span { display: block; margin-top: 2px; color: $text-tertiary; font-size: $font-caption; }
.rf__queue-head :deep(.el-input) { width: 150px; }
.rf__filters { display: flex; flex-wrap: wrap; gap: $space-1; padding: $space-2 $space-4; border-bottom: 1px solid $border-color; }
.rf__filters button { padding: 4px 7px; border: 1px solid $border-color; border-radius: $radius-pill; background: $surface-0; color: $text-secondary; font-size: $font-caption; cursor: pointer; }
.rf__filters button.active { border-color: $brand-300; background: $brand-50; color: $brand-700; font-weight: $font-weight-semibold; }
.rf-project { width: 100%; padding: $space-3 $space-4; border: 0; border-bottom: 1px solid $border-color; background: transparent; text-align: left; cursor: pointer; }
.rf-project:hover, .rf-project--active { background: $brand-50; }
.rf-project--active { box-shadow: inset 3px 0 0 $brand-500; }
.rf-project__top { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.rf-project__top em { color: $text-tertiary; font-size: $font-caption; font-style: normal; }
.rf-project > strong { display: block; margin-top: 6px; overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
.rf-project > small { display: block; margin-top: 3px; color: $text-secondary; font-size: $font-caption; }
.rf-project__due { display: block; margin-top: 6px; color: $warning-700; font-size: $font-caption; }
.rf__workspace { display: flex; flex-direction: column; gap: $space-4; min-width: 0; max-height: calc(100vh - 230px); overflow: auto; padding-right: 2px; }
.rf__boundary { color: $text-secondary; font-size: $font-caption; line-height: 1.55; }
.rf__panel { border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; box-shadow: $shadow-card; }
.rf__panel > header { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; padding: $space-4; border-bottom: 1px solid $border-color; }
.rf__panel h3 { margin: 0; font-size: $font-title; }
.rf__panel p { margin: 4px 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.55; }
.rf__panel > header :deep(.el-input) { width: 220px; }
.rf__filters--items { border-bottom: 1px solid $border-color; }
.rf-list { padding: 0 $space-4 $space-2; }
.rf-row { display: grid; grid-template-columns: 88px minmax(0, 1fr) 150px; gap: $space-3; width: 100%; padding: $space-3 0; border: 0; border-bottom: 1px solid $border-color; background: transparent; text-align: left; cursor: pointer; }
.rf-row:hover { background: $brand-50; }
.rf-row:last-child { border-bottom: 0; }
.rf-row--overdue { border-left: 3px solid $danger-500; }
.rf-row__stage { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.rf-row__stage small { color: $text-tertiary; font-size: $font-caption; }
.rf-row__main { min-width: 0; }
.rf-row__main strong, .rf-row__main small, .rf-row__main em { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rf-row__main strong { color: $text-primary; font-size: $font-body-sm; }
.rf-row__main small { margin-top: 3px; color: $text-secondary; font-size: $font-caption; }
.rf-row__main em { margin-top: 5px; color: $text-secondary; font-size: $font-caption; font-style: normal; }
.rf-row__due { text-align: right; }
.rf-row__due b, .rf-row__due small { display: block; }
.rf-row__due b { color: $text-primary; font-size: $font-caption; }
.rf-row__due small { margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }
.rf-row__due.is-overdue b { color: $danger-500; }
.rf-row__next { grid-column: 2 / -1; padding-top: 4px; color: $brand-700; font-size: $font-caption; }

@media (max-width: 1024px) {
  .rf__head { flex-direction: column; }
  .rf__layout { grid-template-columns: 1fr; }
  .rf__queue { position: static; max-height: none; }
  .rf__queue-list { overflow: visible; }
  .rf__workspace { max-height: none; overflow: visible; }
  .rf-row { grid-template-columns: 74px minmax(0, 1fr); }
  .rf-row__due, .rf-row__next { grid-column: 2; text-align: left; }
}
</style>
