<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ProviderError } from '@/core/http'
import { formatCount } from '@/core/format'
import { bossApi } from '@/domains/boss/api'
import { financeApi } from '@/domains/finance/api'
import { riskApi } from '@/domains/risk/api'
import type { BossDashboardReport, BusinessAnalysisReport, DashboardMetric } from '@/domains/boss/model'
import type { FinanceSummary } from '@/domains/finance/model'
import type { EmployeeRole } from '@/domains/identity/model'
import type { RiskCenterReport, RiskItemView } from '@/domains/risk/model'
import { homeWorkbenchesOf } from '@/roles/workbenchHome'
import { useStoreScopeStore } from '@/stores/storeScope'
import EmptyState from '@/components/EmptyState.vue'
import MoneyText from '@/components/MoneyText.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StatusTag from '@/components/StatusTag.vue'
import WorkbenchEntryCard from '@/components/workbench/WorkbenchEntryCard.vue'

const scope = useStoreScopeStore()
const router = useRouter()

const PERSPECTIVES: Array<{ value: EmployeeRole; label: string }> = [
  { value: 'Boss', label: '负责人视角' },
  { value: 'StoreManager', label: '店长视角' },
  { value: 'Marketer', label: '业务员视角' },
  { value: 'Designer', label: '设计师视角' },
  { value: 'Pm', label: '项目经理视角' },
  { value: 'Finance', label: '财务视角' }
]

const perspective = ref<EmployeeRole>('Boss')
const isBossPerspective = computed(() => perspective.value === 'Boss')
const perspectiveLabel = computed(() => PERSPECTIVES.find((item) => item.value === perspective.value)?.label ?? '')
const perspectiveEntries = computed(() => homeWorkbenchesOf(perspective.value))

const dashboard = ref<BossDashboardReport | null>(null)
const analysis = ref<BusinessAnalysisReport | null>(null)
const risk = ref<RiskCenterReport | null>(null)
const finance = ref<FinanceSummary | null>(null)

const dashboardLoading = ref(false)
const analysisLoading = ref(false)
const riskLoading = ref(false)
const financeLoading = ref(false)
const dashboardError = ref('')
const analysisError = ref('')
const riskError = ref('')
const financeError = ref('')

const riskItems = computed(() => risk.value?.items ?? [])
const focusProjects = computed(() => {
  const seen = new Set<string>()
  return riskItems.value.filter((item) => {
    const key = item.projectName || item.key
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 3)
})
const focusProjectKeys = computed(() => new Set(focusProjects.value.map((item) => item.key)))
const todayTasks = computed(() => {
  const remaining = riskItems.value.filter((item) => !focusProjectKeys.value.has(item.key))
  return (remaining.length ? remaining : riskItems.value).slice(0, 3)
})
const monthLabel = computed(() => {
  const raw = analysis.value?.month || dashboard.value?.month
  if (!raw) return '本月'
  const date = new Date(raw)
  return Number.isNaN(date.getTime())
    ? '本月'
    : new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' }).format(date)
})
const headerSummary = computed(() => {
  if (!risk.value && !dashboard.value) return '正在确认今天的经营事实。'
  const riskCount = risk.value?.totalCount ?? 0
  const activeCount = dashboard.value?.activeProjectCount.value ?? 0
  return `今天有 ${riskCount} 项风险待处理，${formatCount(activeCount)} 个在建项目。`
})
const primaryAction = computed(() => risk.value?.totalCount
  ? { label: '处理风险', to: '/workbench/risk' }
  : { label: '查看经营分析', to: '/workbench/overview' })
const financeStatus = computed(() => {
  if (!finance.value) return { text: '暂不可确认', tone: 'info' as const }
  if (!finance.value.openingBalanceCaptured) return { text: '期初待校准', tone: 'pending' as const }
  if (finance.value.overdueAmount > 0) return { text: '应收有风险', tone: 'pending' as const }
  return { text: '资金已校准', tone: 'done' as const }
})

let scopedRequest = 0

async function loadRisk(): Promise<void> {
  riskLoading.value = true
  riskError.value = ''
  try {
    risk.value = await riskApi.report()
  } catch (error) {
    risk.value = null
    riskError.value = error instanceof ProviderError ? error.message : '风险与待办暂不可确认'
  } finally {
    riskLoading.value = false
  }
}

async function loadScoped(): Promise<void> {
  if (!scope.resolved) return
  const request = ++scopedRequest
  const storeId = scope.requestStoreId ?? undefined
  dashboardLoading.value = true
  analysisLoading.value = true
  financeLoading.value = true
  dashboardError.value = ''
  analysisError.value = ''
  financeError.value = ''

  const [dashboardResult, analysisResult, financeResult] = await Promise.allSettled([
    bossApi.dashboard(storeId),
    bossApi.businessReport(storeId),
    financeApi.summary(storeId)
  ])
  if (request !== scopedRequest) return

  if (dashboardResult.status === 'fulfilled') dashboard.value = dashboardResult.value
  else {
    dashboard.value = null
    dashboardError.value = dashboardResult.reason instanceof ProviderError
      ? dashboardResult.reason.message
      : '经营结果暂不可确认'
  }
  dashboardLoading.value = false

  if (analysisResult.status === 'fulfilled') analysis.value = analysisResult.value
  else {
    analysis.value = null
    analysisError.value = analysisResult.reason instanceof ProviderError
      ? analysisResult.reason.message
      : '经营漏斗暂不可确认'
  }
  analysisLoading.value = false

  if (financeResult.status === 'fulfilled') finance.value = financeResult.value
  else {
    finance.value = null
    financeError.value = financeResult.reason instanceof ProviderError
      ? financeResult.reason.message
      : '资金健康度暂不可确认'
  }
  financeLoading.value = false
}

async function refreshAll(): Promise<void> {
  await Promise.all([loadScoped(), loadRisk()])
}

watch(
  [() => scope.resolved, () => scope.requestStoreId],
  ([ready]) => { if (ready) void loadScoped() },
  { immediate: true }
)

onMounted(() => { void loadRisk() })

watch(perspective, () => { if (perspective.value === 'Boss') void refreshAll() })

function open(path: string): void { void router.push(path) }
function openPrimary(): void { open(primaryAction.value.to) }

function projectInitial(item: RiskItemView): string {
  return Array.from(item.customerName || item.projectName || '项')[0] || '项'
}

function metricChange(metric: DashboardMetric): string {
  if (!metric.monthOverMonthComparable) return ''
  return signedPercent(metric.monthOverMonthRate)
}

function metricChangeTone(metric: DashboardMetric): 'up' | 'down' | 'muted' {
  if (!metric.monthOverMonthComparable) return 'muted'
  return metric.monthOverMonthRate >= 0 ? 'up' : 'down'
}

function metricNote(metric: DashboardMetric): string {
  if (!metric.complete) return '暂不可确认'
  if (metric.targetSet) return `目标达成 ${metric.achievementRate.toFixed(1)}%`
  return '未设置目标'
}

function signedPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function progressWidth(metric: DashboardMetric): string {
  if (!metric.targetSet) return '0%'
  return `${Math.max(0, Math.min(100, metric.achievementRate))}%`
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}
</script>

<template>
  <div class="boss-home">
    <header class="boss-home__head">
      <div class="boss-home__intro">
        <h1>经营总览</h1>
        <p class="boss-home__meta">{{ headerSummary }}</p>
      </div>
      <div class="boss-home__actions">
        <label class="view-select">
          <span>当前视角</span>
          <el-select v-model="perspective" size="default" aria-label="当前视角">
            <el-option v-for="item in PERSPECTIVES" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </label>
        <el-button v-if="isBossPerspective" type="primary" @click="openPrimary">{{ primaryAction.label }}</el-button>
      </div>
    </header>

    <template v-if="isBossPerspective">
      <section class="metric-grid" aria-label="本月经营指标">
        <SkeletonBlock v-if="dashboardLoading && !dashboard" variant="card" :rows="4" />
        <el-alert v-else-if="dashboardError" type="error" :closable="false" :title="dashboardError" show-icon>
          <template #default><el-button size="small" plain @click="loadScoped">重新加载</el-button></template>
        </el-alert>
        <div v-else-if="dashboard" class="metric-grid__items">
          <article class="metric-card">
            <div class="metric-card__label">
              <span>本月签约额</span>
              <em v-if="metricChange(dashboard.signedAmount)" :class="`metric-card__change metric-card__change--${metricChangeTone(dashboard.signedAmount)}`">
                {{ metricChange(dashboard.signedAmount) }}
              </em>
            </div>
            <MoneyText :value="dashboard.signedAmount.value" size="kpi" />
            <div v-if="dashboard.signedAmount.targetSet" class="metric-card__foot">
              <span>{{ metricNote(dashboard.signedAmount) }}</span>
              <i class="metric-card__bar"><b :style="{ width: progressWidth(dashboard.signedAmount) }" /></i>
            </div>
          </article>

          <article class="metric-card">
            <div class="metric-card__label">
              <span>本月回款额</span>
              <em v-if="metricChange(dashboard.receivedAmount)" :class="`metric-card__change metric-card__change--${metricChangeTone(dashboard.receivedAmount)}`">
                {{ metricChange(dashboard.receivedAmount) }}
              </em>
            </div>
            <MoneyText :value="dashboard.receivedAmount.value" size="kpi" />
            <div v-if="dashboard.receivedAmount.targetSet" class="metric-card__foot">
              <span>{{ metricNote(dashboard.receivedAmount) }}</span>
              <i class="metric-card__bar"><b :style="{ width: progressWidth(dashboard.receivedAmount) }" /></i>
            </div>
          </article>

          <article class="metric-card">
            <div class="metric-card__label">
              <span>项目毛利</span>
              <em v-if="!dashboard.grossProfit.complete" class="metric-card__change metric-card__change--warn">成本未完整</em>
            </div>
            <MoneyText :value="dashboard.grossProfit.value" size="kpi" />
          </article>

          <article class="metric-card">
            <div class="metric-card__label">
              <span>在建项目</span>
              <em v-if="metricChange(dashboard.activeProjectCount)" :class="`metric-card__change metric-card__change--${metricChangeTone(dashboard.activeProjectCount)}`">
                {{ metricChange(dashboard.activeProjectCount) }}
              </em>
            </div>
            <strong class="metric-card__count">{{ formatCount(dashboard.activeProjectCount.value ?? 0) }}<small>个</small></strong>
            <div v-if="dashboard.activeProjectCount.targetSet" class="metric-card__foot"><span>{{ metricNote(dashboard.activeProjectCount) }}</span></div>
          </article>
        </div>
      </section>

      <div class="content-grid">
        <section class="panel flow-panel" aria-labelledby="business-overview-title">
          <div class="panel-head">
            <div>
              <h2 id="business-overview-title">业务全景</h2>
            </div>
            <span class="period-chip">{{ monthLabel }}</span>
          </div>

          <SkeletonBlock v-if="analysisLoading && !analysis" variant="card" :rows="3" />
          <el-alert v-else-if="analysisError" type="error" :closable="false" :title="analysisError" show-icon>
            <template #default><el-button size="small" plain @click="loadScoped">重新加载</el-button></template>
          </el-alert>
          <template v-else-if="analysis">
            <EmptyState
              v-if="!analysis.funnel.length"
              title="本月暂无可展示的经营漏斗"
              description="线索、量房、报价或签约事实产生后，这里会显示各阶段数量。"
            />
            <div v-else class="funnel">
              <div v-for="(stage, index) in analysis.funnel" :key="stage.key" class="stage">
                <div class="stage__top">
                  <i :class="`stage__dot stage__dot--${index + 1}`" />
                  <b>{{ stage.label }}</b>
                </div>
                <strong>{{ formatCount(stage.count) }}<em>{{ stage.unit }}</em></strong>
              </div>
            </div>
          </template>

          <div class="project-head">
            <h3>重点推进</h3>
            <button type="button" @click="open('/workbench/risk')">查看全部</button>
          </div>

          <SkeletonBlock v-if="riskLoading && !risk" variant="table" :rows="3" />
          <el-alert v-else-if="riskError" type="error" :closable="false" :title="riskError" show-icon />
          <EmptyState
            v-else-if="risk && !risk.totalCount"
            title="当前没有需要重点推进的风险项目"
            description="逾期、停工、材料超领或变更异常出现后，这里会形成优先处理清单。"
          />
          <div v-else-if="focusProjects.length" class="project-list">
            <button
              v-for="item in focusProjects"
              :key="item.key"
              type="button"
              class="project-row"
              @click="open('/workbench/risk')"
            >
              <span class="project-avatar" aria-hidden="true">{{ projectInitial(item) }}</span>
              <span class="project-name">
                <b>{{ item.projectName || item.title }}</b>
                <small>{{ item.customerName || item.typeLabel }}</small>
              </span>
              <span class="project-amount">
                <small>涉及金额</small>
                <b><MoneyText :value="item.amount" size="sm" /></b>
              </span>
              <span class="project-state" :aria-label="`风险级别：${item.levelLabel}`"><i :class="`project-state__dot project-state__dot--${item.level.toLowerCase()}`" /></span>
              <span class="project-next">
                <small>{{ item.timeText || item.dueText || '待确认' }}</small>
                <b>{{ item.nextAction }}</b>
              </span>
              <span class="project-owner">{{ item.ownerName || item.disposerName || '未指派' }}</span>
              <span class="project-arrow" aria-hidden="true">›</span>
            </button>
          </div>
        </section>

        <aside class="right-column">
          <section class="panel tasks-panel" aria-labelledby="today-tasks-title">
            <div class="panel-head compact">
              <div>
                <h2 id="today-tasks-title">今日待办</h2>
              </div>
              <button type="button" class="round-link" @click="open('/workbench/risk')">全部</button>
            </div>

            <SkeletonBlock v-if="riskLoading && !risk" variant="text" :rows="4" />
            <el-alert v-else-if="riskError" type="error" :closable="false" :title="riskError" show-icon />
            <EmptyState
              v-else-if="risk && !risk.totalCount"
              title="今日没有风险待办"
              description="负责人可继续查看经营分析或进入其他业务工作面。"
            />
            <div v-else class="task-list">
              <button
                v-for="item in todayTasks"
                :key="item.key"
                type="button"
                class="task-row"
                @click="open('/workbench/risk')"
              >
                <span class="task-row__time">{{ item.timeText || item.dueText || '待确认' }}</span>
                <b>{{ item.title }}</b>
                <small>{{ item.projectName || item.message }}</small>
                <em class="task-row__level" :aria-label="`风险级别：${item.levelLabel}`"><i :class="`task-row__dot task-row__dot--${item.level.toLowerCase()}`" /></em>
              </button>
              <button type="button" class="all-tasks" @click="open('/workbench/risk')">查看全部待办 ›</button>
            </div>
          </section>

          <section class="panel finance-panel" aria-labelledby="finance-health-title">
            <div class="panel-head compact">
              <div>
                <h2 id="finance-health-title">资金健康度</h2>
              </div>
              <StatusTag :text="financeStatus.text" :tone="financeStatus.tone" />
            </div>

            <SkeletonBlock v-if="financeLoading && !finance" variant="text" :rows="4" />
            <el-alert v-else-if="financeError" type="error" :closable="false" :title="financeError" show-icon />
            <template v-else-if="finance">
              <div class="cash-total">
                <span>当前可用现金</span>
                <strong><MoneyText :value="finance.cashBalance" size="lg" /></strong>
              </div>
              <div class="cashflow">
                <span><i class="cashflow__in" />本月流入 <b><MoneyText :value="finance.monthIncome" size="sm" /></b></span>
                <span><i class="cashflow__out" />本月流出 <b><MoneyText :value="finance.monthExpense" size="sm" /></b></span>
              </div>
              <button type="button" class="risk-note" @click="open('/finance/receivables')">
                <span>{{ finance.overdueReceivables.length }}</span>
                <div>
                  <b>{{ finance.overdueReceivables.length ? '笔应收已逾期' : '暂无逾期应收' }}</b>
                  <small v-if="finance.overdueReceivables.length">涉及金额 <MoneyText :value="finance.overdueAmount" size="sm" /></small>
                  <small v-else>回款率 {{ formatPercent(finance.collectionRate) }}</small>
                </div>
                <em aria-hidden="true">›</em>
              </button>
            </template>
          </section>
        </aside>
      </div>
    </template>

    <section v-else class="panel perspective-panel" :aria-label="`${perspectiveLabel}工作面`">
      <header class="panel-head">
        <div>
          <h2>{{ perspectiveLabel }}</h2>
          <p>仅切换工作面，权限不变。</p>
        </div>
      </header>
      <div class="perspective-grid">
        <WorkbenchEntryCard v-for="entry in perspectiveEntries" :key="entry.key" :entry="entry" compact />
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.boss-home {
  display: flex;
  flex-direction: column;
  gap: $space-4;
}

.boss-home__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: $space-3;
  gap: $space-5;
}

.boss-home__intro h1 {
  margin: 0;
  color: $text-primary;
  font-size: 25px;
  line-height: 1.25;
  letter-spacing: -.04em;
}

.boss-home__meta {
  margin: 7px 0 0;
  color: $text-secondary;
  font-size: $font-caption;
}

.boss-home__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

.view-select {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 37px;
  padding: 0 10px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-0;

  > span { color: $text-tertiary; font-size: $font-caption; white-space: nowrap; }
  :deep(.el-select) { width: 104px; }
}

.metric-grid {
  min-width: 0;
}

.metric-grid__items {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 13px;
}

.metric-card {
  min-width: 0;
  padding: 16px 17px 13px;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
}

.metric-card__label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;

  > span { color: $text-secondary; font-size: $font-caption; }
}

.metric-card__change {
  padding: 3px 5px;
  border-radius: $radius-xs;
  font-size: $font-caption;
  font-style: normal;
}

.metric-card__change--up { color: $success-500; background: $success-50; }
.metric-card__change--down { color: $danger-500; background: $danger-50; }
.metric-card__change--muted { color: $text-tertiary; background: $surface-100; }
.metric-card__change--warn { color: $warning-700; background: $warning-50; }

.metric-card :deep(.money--kpi),
.metric-card__count {
  display: block;
  margin-top: 9px;
  color: $text-primary;
  font-size: 21px;
  font-weight: $font-weight-semibold;
  line-height: 1.15;
  letter-spacing: -.04em;
  font-variant-numeric: tabular-nums;
}

.metric-card__count small {
  margin-left: 4px;
  color: $text-secondary;
  font-size: $font-caption;
  font-weight: $font-weight-regular;
  letter-spacing: normal;
}

.metric-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;
  min-height: 20px;
  margin-top: $space-2;
  color: $text-tertiary;
  font-size: $font-caption;
}

.metric-card__bar {
  width: 65px;
  height: 4px;
  overflow: hidden;
  border-radius: $radius-pill;
  background: $surface-100;

  b { display: block; height: 100%; border-radius: inherit; background: $brand-500; }
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 295px;
  gap: 14px;
  align-items: stretch;
}

.panel {
  min-width: 0;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
}

.flow-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 18px 18px 8px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;

  h2 { margin: 0; font-size: $font-body; }
  p { margin: 4px 0 0; color: $text-tertiary; font-size: $font-caption; }
}

.panel-head.compact h2 { font-size: $font-body-sm; }

.period-chip {
  padding: 3px 9px;
  border-radius: $radius-sm;
  color: $text-secondary;
  background: $surface-100;
  font-size: $font-caption;
}

.funnel {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 7px;
  padding: 17px 0 18px;
  border-bottom: 1px solid $border-color;
}

.stage {
  min-width: 0;
  padding: 11px;
  border-radius: $radius-sm;
  background: $surface-50;
}

.stage__top {
  display: flex;
  align-items: center;
  gap: 6px;

  b { min-width: 0; overflow: hidden; color: $text-primary; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; }
}

.stage__dot {
  width: 6px;
  height: 6px;
  flex: 0 0 6px;
  border-radius: 2px;
}

.stage__dot--1 { background: #8b5cf6; }
.stage__dot--2 { background: #3b82f6; }
.stage__dot--3 { background: #06b6d4; }
.stage__dot--4 { background: #f59e0b; }
.stage__dot--5 { background: #10b981; }

.stage > strong {
  display: block;
  margin: 10px 0 2px;
  color: $text-primary;
  font-size: $font-body;
  font-variant-numeric: tabular-nums;

  em { margin-left: 2px; color: $text-secondary; font-size: $font-caption; font-style: normal; font-weight: $font-weight-regular; }
}

.project-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 2px 9px;

  h3 { margin: 0; font-size: $font-body-sm; }
  button { border: 0; color: $brand-600; background: transparent; font: inherit; font-size: $font-caption; cursor: pointer; }
}

.project-list { display: flex; flex: 1; flex-direction: column; }

.project-row {
  width: 100%;
  display: grid;
  grid-template-columns: 34px minmax(160px, 1.55fr) .68fr .62fr minmax(150px, 1fr) 80px 14px;
  gap: 10px;
  align-items: center;
  padding: 11px 4px;
  border: 0;
  border-top: 1px solid $border-color;
  background: $surface-0;
  color: $text-primary;
  text-align: left;
  cursor: pointer;

  &:hover { background: $surface-50; }
  &:focus-visible { outline: 2px solid $brand-500; outline-offset: 2px; }
}

.project-avatar {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: $radius-sm;
  color: $brand-700;
  background: $brand-50;
  font-size: $font-caption;
}

.project-name,
.project-amount,
.project-next {
  display: grid;
  min-width: 0;
  gap: 3px;

  b,
  small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  b { font-size: $font-caption; }
  small { color: $text-tertiary; font-size: $font-caption; }
}

.project-next b { font-size: $font-caption; font-weight: $font-weight-medium; }
.project-state { display: inline-flex; align-items: center; justify-content: center; min-width: 12px; }
.project-state__dot { width: 6px; height: 6px; border-radius: 50%; background: $warning-500; }
.project-state__dot--high { background: $danger-500; }
.project-state__dot--medium { background: $warning-500; }
.project-state__dot--low { background: $info-500; }
.project-owner { overflow: hidden; color: $text-secondary; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; }
.project-arrow { color: $text-tertiary; font-size: $font-title; }

.right-column {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.tasks-panel,
.finance-panel { padding: 17px; }

.round-link {
  padding: 0;
  border: 0;
  color: $brand-600;
  background: transparent;
  font: inherit;
  font-size: $font-caption;
  cursor: pointer;
}

.task-list { margin-top: $space-2; }

.task-row {
  position: relative;
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 3px $space-2;
  padding: 11px 0;
  border: 0;
  border-bottom: 1px solid $border-color;
  background: transparent;
  color: $text-primary;
  text-align: left;
  cursor: pointer;

  b { overflow: hidden; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; }
  small { overflow: hidden; color: $text-tertiary; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; }

  &:hover b { color: $brand-700; }
  &:focus-visible { outline: 2px solid $brand-500; outline-offset: 2px; }
}

.task-row__time { grid-column: 1; color: $text-tertiary; font-size: $font-caption; }
.task-row__level { grid-column: 2; grid-row: 1; display: inline-flex; align-items: center; justify-content: flex-end; font-style: normal; }
.task-row__dot { width: 6px; height: 6px; border-radius: 50%; background: $warning-500; }
.task-row__dot--high { background: $danger-500; }
.task-row__dot--medium { background: $warning-500; }
.task-row__dot--low { background: $info-500; }

.all-tasks {
  width: 100%;
  padding-top: 12px;
  border: 0;
  color: $brand-600;
  background: transparent;
  font: inherit;
  font-size: $font-caption;
  cursor: pointer;
}

.cash-total {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: $space-2;
  padding: 15px 1px 12px;

  span { color: $text-secondary; font-size: $font-caption; }
}

.cashflow {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-2;
  padding-bottom: 12px;
  border-bottom: 1px solid $border-color;

  span { display: grid; gap: 4px; color: $text-secondary; font-size: $font-caption; }
  b { color: $text-primary; font-size: $font-caption; font-weight: $font-weight-medium; }
  i { width: 6px; height: 6px; margin-right: 4px; border-radius: 50%; }
}

.cashflow__in { background: $success-500; }
.cashflow__out { background: $warning-500; }

.risk-note {
  width: 100%;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  margin-top: 10px;
  padding: 9px;
  border: 0;
  border-radius: $radius-sm;
  background: $warning-50;
  color: $text-primary;
  text-align: left;
  cursor: pointer;

  > span {
    width: 27px;
    height: 27px;
    display: grid;
    place-items: center;
    border-radius: $radius-sm;
    color: $warning-700;
    background: $surface-0;
    font-size: $font-caption;
    font-variant-numeric: tabular-nums;
  }

  div { min-width: 0; }
  b,
  small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  b { font-size: $font-caption; }
  small { margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }
  em { color: $text-tertiary; font-size: $font-title; font-style: normal; }
}

.perspective-panel { padding: $space-5; }
.perspective-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $space-3;
  margin-top: $space-4;
}

@media (max-width: 1120px) {
  .metric-grid__items { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .content-grid { grid-template-columns: 1fr; }
  .right-column { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .project-row { grid-template-columns: 34px minmax(150px, 1.55fr) .68fr .62fr minmax(140px, 1fr) 14px; }
  .project-owner { display: none; }
}

@media (max-width: 760px) {
  .boss-home__head { align-items: flex-start; flex-direction: column; }
  .boss-home__actions { width: 100%; justify-content: flex-start; }
  .metric-grid__items { display: flex; overflow-x: auto; padding-bottom: 4px; }
  .metric-card { min-width: 210px; }
  .content-grid { display: block; }
  .funnel { display: flex; overflow-x: auto; padding-bottom: 14px; }
  .stage { min-width: 112px; }
  .project-row { grid-template-columns: 34px minmax(0, 1fr) auto 14px; }
  .project-amount,
  .project-next,
  .project-owner { display: none; }
  .right-column { display: block; }
  .right-column .panel { margin-top: 13px; }
  .perspective-grid { grid-template-columns: 1fr; }
}
</style>
