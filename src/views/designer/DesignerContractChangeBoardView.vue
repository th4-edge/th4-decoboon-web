<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import MoneyText from '@/components/MoneyText.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StatusTag from '@/components/StatusTag.vue'
import ObjectHeroCard from '@/components/workbench/ObjectHeroCard.vue'
import { contractApi } from '@/domains/contract/api'
import type { Contract, ContractChange, ContractChangeStatus } from '@/domains/contract/model'
import { CONTRACT_CHANGE_STATUS_LABELS, CONTRACT_CHANGE_TYPE_LABELS } from '@/domains/contract/meta'
import { projectApi } from '@/domains/project/api'
import type { ProjectBrief, ProjectStatus } from '@/domains/project/model'
import { formatDateTime } from '@/core/format'

const route = useRoute()
const router = useRouter()

const ACTIVE_STATUSES: ProjectStatus[] = ['preparing', 'ongoing', 'suspended', 'accepting']
const projects = ref<ProjectBrief[]>([])
const selectedProjectId = ref('')
const project = ref<ProjectBrief | null>(null)
const contract = ref<Contract | null>(null)
const changes = ref<ContractChange[]>([])
const activeProjectFilter = ref<'all' | ProjectStatus>('all')
const activeChangeFilter = ref<'all' | ContractChangeStatus>('all')
const projectKeyword = ref('')
const changeKeyword = ref('')
const loading = ref(false)
const error = ref('')
const detailLoading = ref(false)
const detailError = ref('')

const filteredProjects = computed(() => {
  const query = projectKeyword.value.trim().toLowerCase()
  return projects.value.filter((item) => {
    const statusMatched = activeProjectFilter.value === 'all' || item.status === activeProjectFilter.value
    if (!statusMatched) return false
    if (!query) return true
    return [item.name, item.no, item.propertyName, item.community, item.designerName]
      .some((value) => String(value ?? '').toLowerCase().includes(query))
  })
})

const filteredChanges = computed(() => {
  const query = changeKeyword.value.trim().toLowerCase()
  return changes.value.filter((change) => {
    const statusMatched = activeChangeFilter.value === 'all' || change.status === activeChangeFilter.value
    if (!statusMatched) return false
    if (!query) return true
    return [change.no, change.reason, change.requestedByName, change.conclusion]
      .some((value) => String(value ?? '').toLowerCase().includes(query))
  })
})

const pendingCount = computed(() => changes.value.filter((change) => change.status === 'pending').length)
const effectiveCount = computed(() => changes.value.filter((change) => change.status === 'customerConfirmed').length)
const rejectedCount = computed(() => changes.value.filter((change) => change.status === 'rejected').length)

watch(selectedProjectId, async (id) => {
  if (!id) {
    project.value = null
    contract.value = null
    changes.value = []
    return
  }
  const query = { ...route.query }
  query.projectId = id
  delete query.changeId
  void router.replace({ query })
  await loadProject(id)
})

onMounted(() => {
  void loadProjects()
})

async function loadProjects(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const page = await projectApi.pageProjects({ current: 1, size: 200, statuses: ACTIVE_STATUSES })
    projects.value = page.list
    const routeProjectId = String(route.query.projectId ?? '')
    const target = projects.value.find((item) => item.id === routeProjectId) ?? projects.value[0]
    selectedProjectId.value = target?.id ?? ''
  } catch (err) {
    error.value = err instanceof Error ? err.message : '项目交付项目暂不可确认'
  } finally {
    loading.value = false
  }
}

async function loadProject(id: string): Promise<void> {
  detailLoading.value = true
  detailError.value = ''
  try {
    const [projectInfo, contractInfo] = await Promise.all([
      projectApi.projectInfo(id),
      contractApi.contractByProject(id)
    ])
    project.value = projectInfo
    contract.value = contractInfo
    changes.value = contractInfo ? await contractApi.listContractChanges(id) : []
  } catch (err) {
    project.value = null
    contract.value = null
    changes.value = []
    detailError.value = err instanceof Error ? err.message : '项目增减项暂不可确认'
  } finally {
    detailLoading.value = false
  }
}

function openChange(change: ContractChange): void {
  if (!project.value) return
  void router.push(`/designer/projects/${project.value.id}/changes?changeId=${change.id}`)
}

function projectAddress(item: ProjectBrief): string {
  return [item.community, item.propertyName, item.address].filter(Boolean).join(' · ') || '房屋地址待补充'
}

function formatLocalDateTime(value?: string): string {
  return value ? formatDateTime(value.replace(' ', 'T')) : '暂不可确认'
}
</script>

<template>
  <div class="cb">
    <header class="cb__head">
      <div>
        <p class="cb__eyebrow">项目交付 · 增减项</p>
        <h2>查看各项目已形成的增减项变更单</h2>
        <p>这里是项目交付的查看与推进入口；新增增减项请从“项目工地”对应项目发起。</p>
      </div>
      <el-button :loading="loading" @click="loadProjects">刷新项目</el-button>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />

    <div v-else class="cb__layout">
      <aside class="cb__queue">
        <div class="cb__queue-head">
          <div><strong>项目工地</strong><span>{{ filteredProjects.length }} / {{ projects.length }}</span></div>
          <el-input v-model="projectKeyword" clearable placeholder="项目、小区、门牌" />
        </div>
        <div class="cb__filters">
          <button type="button" :class="{ active: activeProjectFilter === 'all' }" @click="activeProjectFilter = 'all'">全部</button>
          <button type="button" :class="{ active: activeProjectFilter === 'preparing' }" @click="activeProjectFilter = 'preparing'">待开工</button>
          <button type="button" :class="{ active: activeProjectFilter === 'ongoing' }" @click="activeProjectFilter = 'ongoing'">施工中</button>
          <button type="button" :class="{ active: activeProjectFilter === 'accepting' }" @click="activeProjectFilter = 'accepting'">验收中</button>
        </div>
        <div class="cb__queue-list">
          <SkeletonBlock v-if="loading && !projects.length" variant="card" :rows="5" />
          <EmptyState v-else-if="!filteredProjects.length" title="当前没有项目" description="项目创建并进入履约后，才会在这里显示增减项入口。" />
          <button
            v-for="item in filteredProjects"
            v-else
            :key="item.id"
            type="button"
            class="cb-project"
            :class="{ 'cb-project--active': item.id === selectedProjectId }"
            @click="selectedProjectId = item.id"
          >
            <span class="cb-project__top">
              <BusinessStateTag object-key="project" :status-key="item.status" :dot="false" />
              <em>{{ item.no || '编号待确认' }}</em>
            </span>
            <strong>{{ item.name }}</strong>
            <small>{{ projectAddress(item) }}</small>
            <span class="cb-project__facts">
              <b>{{ item.currentStageName || '阶段待确认' }}</b>
              <b>{{ item.managerName || '项目经理待分配' }}</b>
            </span>
          </button>
        </div>
      </aside>

      <main class="cb__workspace">
        <SkeletonBlock v-if="detailLoading && !project" variant="card" :rows="7" />
        <EmptyState v-else-if="!project" title="选择一个项目" description="左侧项目工地只显示当前角色数据范围内的在跑项目。" />
        <template v-else>
          <ObjectHeroCard>
            <template #avatar>项</template>
            <template #title>
              <h2>{{ project.name }}</h2>
              <BusinessStateTag object-key="project" :status-key="project.status" />
            </template>
            <template #subtitle>{{ projectAddress(project) }} · {{ project.no || '编号待确认' }}</template>
            <template #chips>
              <StatusTag :text="`待审批 ${pendingCount}`" :tone="pendingCount ? 'pending' : 'todo'" :dot="false" />
              <StatusTag :text="`已生效 ${effectiveCount}`" :tone="effectiveCount ? 'done' : 'todo'" :dot="false" />
              <StatusTag v-if="rejectedCount" :text="`已驳回 ${rejectedCount}`" tone="blocked" :dot="false" />
            </template>
            <template #facts>
              <div><small>合同</small><b>{{ contract?.no || '暂不可确认' }}</b></div>
              <div><small>合同当前额</small><b><MoneyText :value="contract?.currentAmount" /></b></div>
              <div><small>当前阶段</small><b>{{ project.currentStageName || '阶段待确认' }}</b></div>
              <div><small>项目经理</small><b>{{ project.managerName || '待分配' }}</b></div>
            </template>
            <template #actions>
              <small class="cb__boundary-note">新增增减项请回到项目工地对应项目发起。</small>
            </template>
          </ObjectHeroCard>

          <el-alert v-if="detailError" type="warning" :closable="false" :title="detailError" show-icon />
          <section class="cb__changes">
            <header>
              <div>
                <h3>增减项变更单</h3>
                <p>点击变更单查看明细、审批状态、生效结果与履约影响。</p>
              </div>
              <el-input v-model="changeKeyword" clearable placeholder="单号、原因、发起人" />
            </header>
            <div class="cb__filters cb__filters--changes">
              <button type="button" :class="{ active: activeChangeFilter === 'all' }" @click="activeChangeFilter = 'all'">全部 {{ changes.length }}</button>
              <button type="button" :class="{ active: activeChangeFilter === 'pending' }" @click="activeChangeFilter = 'pending'">待审批 {{ pendingCount }}</button>
              <button type="button" :class="{ active: activeChangeFilter === 'customerConfirmed' }" @click="activeChangeFilter = 'customerConfirmed'">已生效 {{ effectiveCount }}</button>
              <button type="button" :class="{ active: activeChangeFilter === 'rejected' }" @click="activeChangeFilter = 'rejected'">已驳回 {{ rejectedCount }}</button>
            </div>
            <SkeletonBlock v-if="detailLoading" variant="table" :rows="4" />
            <EmptyState v-else-if="!filteredChanges.length" title="当前项目暂无增减项" description="增减项需要在项目工地中发起，形成后才会出现在这里。" />
            <div v-else class="cb-change-list">
              <button v-for="change in filteredChanges" :key="change.id" type="button" class="cb-change" @click="openChange(change)">
                <span class="cb-change__status"><BusinessStateTag object-key="contractChange" :status-key="change.status" :dot="false" /></span>
                <span class="cb-change__main">
                  <strong>{{ change.reason || '变更原因待补充' }}</strong>
                  <small>{{ change.no || '单号待确认' }} · {{ CONTRACT_CHANGE_TYPE_LABELS[change.type] || '变更' }} · {{ change.requestedByName || '发起人待确认' }}</small>
                </span>
                <span class="cb-change__amount"><MoneyText :value="change.amount" delta /><small>{{ CONTRACT_CHANGE_STATUS_LABELS[change.status] }}</small></span>
                <span class="cb-change__time">{{ formatLocalDateTime(change.createdAt) }}</span>
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

.cb { display: flex; flex-direction: column; gap: $space-4; padding: $space-5; }
.cb__head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-4; }
.cb__head h2 { margin: $space-1 0; font-size: $font-display; }
.cb__head p { margin: 0; max-width: 820px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
.cb__eyebrow { color: $brand-600 !important; font-size: $font-caption !important; font-weight: $font-weight-semibold; letter-spacing: .1em; }
.cb__layout { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: $space-4; align-items: start; }
.cb__queue { @include wb.workbench-queue; }
.cb__queue-list { @include wb.workbench-queue-scroll; }
.cb__queue-head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-2; padding: $space-3 $space-4; border-bottom: 1px solid $border-color; }
.cb__queue-head strong { display: block; font-size: $font-body-sm; }
.cb__queue-head span { display: block; margin-top: 2px; color: $text-tertiary; font-size: $font-caption; }
.cb__queue-head :deep(.el-input) { width: 150px; }
.cb__filters { display: flex; flex-wrap: wrap; gap: $space-1; padding: $space-2 $space-4; border-bottom: 1px solid $border-color; }
.cb__filters button { padding: 4px 7px; border: 1px solid $border-color; border-radius: $radius-pill; background: $surface-0; color: $text-secondary; font-size: $font-caption; cursor: pointer; }
.cb__filters button.active { border-color: $brand-300; background: $brand-50; color: $brand-700; font-weight: $font-weight-semibold; }
.cb-project { width: 100%; padding: $space-3 $space-4; border: 0; border-bottom: 1px solid $border-color; background: transparent; text-align: left; cursor: pointer; }
.cb-project:hover, .cb-project--active { background: $brand-50; }
.cb-project--active { box-shadow: inset 3px 0 0 $brand-500; }
.cb-project__top, .cb-project__facts { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.cb-project__top em { overflow: hidden; color: $text-tertiary; font-size: $font-caption; font-style: normal; text-overflow: ellipsis; white-space: nowrap; }
.cb-project > strong { display: block; margin-top: 6px; overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
.cb-project > small { display: block; margin-top: 3px; overflow: hidden; color: $text-secondary; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; }
.cb-project__facts { justify-content: flex-start; margin-top: 7px; color: $text-secondary; font-size: $font-caption; }
.cb-project__facts b + b { padding-left: $space-2; border-left: 1px solid $border-color; }
.cb__workspace { display: flex; flex-direction: column; gap: $space-4; min-width: 0; max-height: calc(100vh - 230px); overflow: auto; padding-right: 2px; }
.cb__boundary-note { color: $text-secondary; font-size: $font-caption; }
.cb__changes { border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; box-shadow: $shadow-card; }
.cb__changes > header { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; padding: $space-4; border-bottom: 1px solid $border-color; }
.cb__changes h3 { margin: 0; font-size: $font-title; }
.cb__changes p { margin: 4px 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.55; }
.cb__changes > header :deep(.el-input) { width: 220px; }
.cb__filters--changes { border-bottom: 1px solid $border-color; }
.cb-change-list { padding: 0 $space-4 $space-2; }
.cb-change { display: grid; grid-template-columns: 92px minmax(0, 1fr) auto 128px; align-items: center; gap: $space-3; width: 100%; padding: $space-3 0; border: 0; border-bottom: 1px solid $border-color; background: transparent; text-align: left; cursor: pointer; }
.cb-change:hover { background: $brand-50; }
.cb-change:last-child { border-bottom: 0; }
.cb-change__main { min-width: 0; }
.cb-change__main strong, .cb-change__main small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cb-change__main strong { color: $text-primary; font-size: $font-body-sm; }
.cb-change__main small { margin-top: 3px; color: $text-secondary; font-size: $font-caption; }
.cb-change__amount { text-align: right; font-variant-numeric: tabular-nums; }
.cb-change__amount small { display: block; margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }
.cb-change__time { color: $text-tertiary; font-size: $font-caption; text-align: right; }

@media (max-width: 1024px) {
  .cb__head { flex-direction: column; }
  .cb__layout { grid-template-columns: 1fr; }
  .cb__queue { position: static; max-height: none; }
  .cb__queue-list { overflow: visible; }
  .cb__workspace { max-height: none; overflow: visible; }
  .cb-change { grid-template-columns: 88px minmax(0, 1fr); }
  .cb-change__amount, .cb-change__time { grid-column: 2; text-align: left; }
}
</style>
