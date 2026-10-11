<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import MoneyText from '@/components/MoneyText.vue'
import WorkbenchState from '@/components/workbench/WorkbenchState.vue'
import BusinessWorkbenchDistribution from '@/components/workbench/BusinessWorkbenchDistribution.vue'
import BusinessWorkbenchTrendChart from '@/components/workbench/BusinessWorkbenchTrendChart.vue'
import { formatCount, formatDateTime, formatMoney } from '@/core/format'
import { useDesignerPerformance } from '@/composables/useDesignerPerformance'

const router = useRouter()
const {
  report,
  loading,
  error,
  status,
  warnings,
  summaryItems,
  pipelineSteps,
  focusStep,
  ranking,
  trendSeries,
  distributionSeries,
  workLabels,
  workTones,
  load
} = useDesignerPerformance()

const generatedAt = computed(() => report.value ? formatDateTime(report.value.generatedAt) : '暂不可确认')
const monthLabel = computed(() => report.value?.month || '本月')
const hasReport = computed(() => Boolean(report.value))

function comparisonText(item: (typeof summaryItems.value)[number]): string {
  const metric = item.metric
  if (!metric || metric.comparisonState === 'unavailable' || metric.changeRate == null) {
    return metric?.comparisonLabel || '暂无基期'
  }
  const rate = Number(metric.changeRate)
  const prefix = rate > 0 ? '+' : ''
  return `${metric.comparisonLabel || '对比上期'} ${prefix}${rate.toFixed(2)}%`
}

function comparisonClass(item: (typeof summaryItems.value)[number]): string {
  const state = item.metric?.comparisonState
  if (state === 'up') return 'is-up'
  if (state === 'down') return 'is-down'
  if (state === 'flat') return 'is-flat'
  return 'is-unavailable'
}

function signedMoney(value: number | null | undefined): string {
  const amount = Number(value ?? 0)
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : ''
  return `${sign}¥${formatMoney(Math.abs(amount))}`
}

function open(route: string): void {
  if (route) void router.push(route)
}

onMounted(load)
</script>

<template>
  <div class="dp">
    <header class="dp__head">
      <div>
        <p class="dp__eyebrow">经营与工具 · 我的业绩</p>
        <h1>我的业绩</h1>
        <p>只展示服务端聚合的本人经营与交付结果，不拉客户、报价、项目全量明细，也不展开未授权的项目经营敏感字段。</p>
      </div>
      <div class="dp__head-meta">
        <span>{{ report?.employeeName || '当前设计师' }} · {{ report?.dataScope || '仅本人' }}</span>
        <small>数据截止 {{ generatedAt }}</small>
        <button type="button" :disabled="loading" @click="load">{{ loading ? '更新中…' : '刷新业绩' }}</button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <el-alert v-for="warning in warnings" :key="warning.key" type="warning" :closable="false" :title="warning.message" show-icon />

    <section v-if="loading && !hasReport" class="dp__loading"><el-skeleton :rows="8" animated /></section>
    <WorkbenchState
      v-else-if="error && !hasReport"
      variant="error"
      title="我的业绩暂不可确认"
      :description="error"
      action-text="重新加载"
      min-height="360px"
      @action="load"
    />

    <template v-else-if="report">
      <section class="dp__hero">
        <div class="dp__hero-title">
          <span>{{ monthLabel }}经营结果</span>
          <strong>{{ report.employeeName }}</strong>
          <p>指标由服务端聚合，前端只做展示与格式化；无基期时明确显示“暂无基期”。</p>
          <el-tag v-if="status !== 'ready'" type="warning" effect="plain">数据部分可用</el-tag>
        </div>
        <div class="dp__summary">
          <article v-for="item in summaryItems" :key="item.metric?.key || item.label" class="jz-card dp__summary-card">
            <div class="dp__summary-label"><span>{{ item.label }}</span><small>{{ item.hint }}</small></div>
            <div class="dp__summary-value">
              <MoneyText v-if="item.format === 'money'" :value="item.metric?.value" size="kpi" />
              <template v-else>{{ formatCount(item.metric?.value ?? 0) }}</template>
            </div>
            <div class="dp__summary-foot" :class="comparisonClass(item)">
              <span>{{ comparisonText(item) }}</span>
              <small v-if="item.metric?.previousValue != null">上期 {{ item.format === 'money' ? `¥${Number(item.metric.previousValue).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : formatCount(item.metric.previousValue) }}</small>
            </div>
          </article>
        </div>
      </section>

      <section v-if="ranking" class="dp__insight">
        <article class="dp__ranking">
          <header>
            <div>
              <span class="dp__insight-eyebrow">{{ ranking.periodLabel }}设计师排名</span>
              <h3>{{ ranking.metricLabel }}</h3>
            </div>
            <div class="dp__rank-head">
              <span class="dp__rank-badge">第 {{ ranking.rank }} 名</span>
              <small v-if="!ranking.sampleSufficient">样本 &lt; 3，仅供参考</small>
            </div>
          </header>
          <div class="dp__rank-main">
            <strong><MoneyText :value="ranking.myValue" size="lg" /></strong>
            <small>共 {{ ranking.designerCount }} 位设计师参与统计</small>
          </div>
          <div class="dp__rank-line">
            <span>团队均值 <b><MoneyText :value="ranking.peerAverage" size="sm" /></b></span>
            <span :class="{ 'is-leading': ranking.gapToTop <= 0 }">{{ ranking.gapToTop <= 0 ? '当前领先' : `距第一 ${signedMoney(ranking.gapToTop)}` }}</span>
            <span :class="{ 'is-up': ranking.gapToAverage >= 0, 'is-down': ranking.gapToAverage < 0 }">较均值 {{ signedMoney(ranking.gapToAverage) }}</span>
          </div>
          <div class="dp__leaderboard">
            <div
              v-for="item in ranking.topDesigners.slice(0, 3)"
              :key="item.employeeId || item.employeeName"
              class="dp__leaderboard-row"
              :class="{ current: item.currentEmployee }"
            >
              <span>#{{ item.rank }}</span>
              <strong>{{ item.employeeName }}</strong>
              <small>{{ item.signedProjectCount }} 单</small>
              <MoneyText :value="item.value" size="sm" />
            </div>
          </div>
        </article>

        <article class="dp__focus">
          <span class="dp__insight-eyebrow">现在最值得推进</span>
          <template v-if="focusStep">
            <div class="dp__focus-rank">{{ focusStep.label }}</div>
            <strong>{{ focusStep.count }} {{ focusStep.unit }}待处理</strong>
            <p>{{ focusStep.description || '从当前主链进入对应工作台，优先处理排在最前面的对象。' }}</p>
            <button type="button" @click="open(focusStep.route)">进入处理</button>
          </template>
          <template v-else>
            <strong>当前主链没有待办</strong>
            <p>可以回顾趋势数据、复盘本月签约结构，或提前检查后续项目交付风险。</p>
          </template>
          <div class="dp__focus-note">
            <span>激励提示</span>
            <p v-if="ranking?.gapToTop && ranking.gapToTop > 0">距离第一名 {{ signedMoney(ranking.gapToTop) }}，先把当前待办推进到下一站。</p>
            <p v-else>本月签约额已处于团队领先位置，继续保持当前成交与交付节奏。</p>
          </div>
        </article>
      </section>

      <section class="dp__pipeline">
        <header>
          <div>
            <h3>方案报价主链</h3>
            <p>量房 → 设计 → 报价 → 合同，数量与当前节点来自服务端聚合。</p>
          </div>
          <button v-if="focusStep" type="button" @click="open(focusStep.route)">进入待我处理</button>
        </header>
        <div class="dp__pipeline-steps">
          <button
            v-for="(step, index) in pipelineSteps"
            :key="step.key"
            type="button"
            :class="[`is-${step.status}`, { current: step.status === 'current' }]"
            @click="open(step.route)"
          >
            <span>{{ index + 1 }}</span>
            <div>
              <strong>{{ step.label }}</strong>
              <small>{{ step.description }}</small>
            </div>
            <b>{{ step.count }} {{ step.unit }}</b>
          </button>
        </div>
      </section>

      <section class="dp__grid">
        <BusinessWorkbenchTrendChart
          :series="trendSeries"
          :start-date="report.trendStart"
          :end-date="report.trendEnd"
          :loading="loading"
        />
        <BusinessWorkbenchDistribution
          :series="distributionSeries"
          :labels="workLabels"
          :tones="workTones"
          :loading="loading"
        />
      </section>

    </template>
  </div>
</template>

<style scoped lang="scss">
.dp { display: flex; flex-direction: column; gap: $space-2; padding: $space-5; min-width: 0; }

.dp__loading { padding: $space-5; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }

.dp__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: $space-5;
  flex-wrap: wrap;

  h1 { margin: 0; color: $text-primary; font-size: $font-display; letter-spacing: -.02em; }
  p { max-width: 820px; margin: $space-2 0 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
}

.dp__eyebrow { color: $brand-600 !important; font-size: $font-caption !important; font-weight: $font-weight-semibold; letter-spacing: .09em; }
.dp__head-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; color: $text-secondary; font-size: $font-caption; }
.dp__head-meta small { color: $text-tertiary; }
.dp__head-meta button { min-height: 36px; padding: 0 14px; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; color: $brand-700; font: inherit; font-size: $font-caption; font-weight: $font-weight-semibold; cursor: pointer; }
.dp__head-meta button:hover { border-color: $brand-300; background: $brand-50; }
.dp__head-meta button:disabled { cursor: wait; opacity: .6; }

.dp__hero {
  display: grid;
  grid-template-columns: minmax(240px, .75fr) minmax(0, 1.8fr);
  gap: $space-4;
  padding: $space-5;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: linear-gradient(135deg, $brand-50 0%, $surface-0 68%);
  box-shadow: $shadow-card;
}

.dp__hero-title { display: flex; flex-direction: column; align-items: flex-start; gap: 5px; }
.dp__hero-title > span { color: $brand-700; font-size: $font-title; font-weight: $font-weight-bold; }
.dp__hero-title > strong { color: $text-primary; font-size: $font-h1; }
.dp__hero-title p { margin: 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.65; }

.dp__summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: $space-3; }
.dp__summary-card { display: flex; flex-direction: column; min-height: 126px; padding: $space-4; }
.dp__summary-label { display: flex; flex-direction: column; gap: 4px; }
.dp__summary-label span { color: $text-primary; font-size: $font-body; font-weight: $font-weight-semibold; }
.dp__summary-label small { color: $text-tertiary; font-size: $font-caption; line-height: 1.45; }
.dp__summary-value { margin-top: auto; padding-top: $space-3; color: $brand-700; font-size: $font-kpi; font-weight: $font-weight-bold; font-variant-numeric: tabular-nums; }
.dp__summary-foot { display: flex; align-items: center; justify-content: space-between; gap: $space-2; margin-top: $space-2; padding-top: $space-2; border-top: 1px solid $border-color; color: $text-tertiary; font-size: $font-caption; }
.dp__summary-foot small { color: $text-tertiary; }
.dp__summary-foot.is-up span { color: $success-500; }
.dp__summary-foot.is-down span { color: $danger-500; }
.dp__summary-foot.is-flat span { color: $text-secondary; }

.dp__pipeline { padding: $space-4; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; box-shadow: $shadow-card; }
.dp__pipeline > header { display: flex; align-items: center; justify-content: space-between; gap: $space-4; margin-bottom: $space-3; }
.dp__pipeline h3 { margin: 0; color: $text-primary; font-size: $font-title; }
.dp__pipeline p { margin: 3px 0 0; color: $text-secondary; font-size: $font-caption; }
.dp__pipeline > header button { min-height: 34px; padding: 0 12px; border: 0; border-radius: $radius-sm; background: $brand-500; color: $surface-0; font: inherit; font-size: $font-caption; font-weight: $font-weight-semibold; cursor: pointer; }
.dp__pipeline-steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: $space-2; }
.dp__pipeline-steps > button { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; align-items: center; gap: 8px; min-width: 0; min-height: 72px; padding: 10px; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-50; color: $text-secondary; text-align: left; cursor: pointer; }
.dp__pipeline-steps > button:hover { border-color: $brand-300; background: $brand-50; }
.dp__pipeline-steps > button.current { border-color: $brand-400; background: $brand-50; box-shadow: inset 0 0 0 1px $brand-200; }
.dp__pipeline-steps > button > span { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: $surface-100; color: $text-tertiary; font-size: $font-caption; font-weight: $font-weight-bold; }
.dp__pipeline-steps > button.current > span { background: $brand-500; color: $surface-0; }
.dp__pipeline-steps > button > div { min-width: 0; }
.dp__pipeline-steps strong,
.dp__pipeline-steps small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dp__pipeline-steps strong { color: $text-primary; font-size: $font-body-sm; }
.dp__pipeline-steps small { margin-top: 2px; color: $text-tertiary; font-size: $font-caption; }
.dp__pipeline-steps b { color: $brand-700; font-size: $font-body-sm; font-variant-numeric: tabular-nums; }

.dp__insight { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(300px, .65fr); gap: $space-4; }
.dp__ranking,
.dp__focus { min-width: 0; align-self: start; padding: 12px; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; box-shadow: $shadow-card; }
.dp__ranking header { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; }
.dp__insight-eyebrow { color: $brand-600; font-size: $font-caption; font-weight: $font-weight-semibold; letter-spacing: .08em; }
.dp__ranking h3 { margin: 2px 0 0; color: $text-primary; font-size: $font-body; }
.dp__rank-head { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.dp__rank-head small { color: $warning-700; font-size: $font-caption; }
.dp__rank-badge { padding: 4px 9px; border-radius: $radius-pill; background: $brand-50; color: $brand-700; font-size: $font-body-sm; font-weight: $font-weight-bold; }
.dp__rank-main { display: flex; align-items: baseline; gap: $space-3; margin-top: 6px; }
.dp__rank-main strong { color: $brand-700; font-size: $font-title; }
.dp__rank-main small { color: $text-tertiary; font-size: $font-caption; }
.dp__rank-line { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 14px; margin-top: 6px; color: $text-secondary; font-size: $font-caption; }
.dp__rank-line b { color: $brand-700; }
.dp__rank-line .is-leading,
.dp__rank-line .is-up { color: $success-500; }
.dp__rank-line .is-down { color: $danger-500; }
.dp__leaderboard { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.dp__leaderboard-row { display: inline-flex; align-items: center; gap: 5px; padding: 4px 7px; border-radius: $radius-sm; background: $surface-50; color: $text-secondary; font-size: $font-caption; }
.dp__leaderboard-row.current { border: 1px solid $brand-200; background: $brand-50; }
.dp__leaderboard-row strong { color: $text-primary; white-space: nowrap; }
.dp__leaderboard-row small { color: $text-tertiary; }
.dp__leaderboard-row :deep(.money) { font-size: $font-caption; }
.dp__focus { display: flex; flex-direction: column; justify-content: flex-start; background: linear-gradient(135deg, $warning-50, $surface-0 72%); }
.dp__focus-rank { width: fit-content; margin-top: 6px; padding: 4px 8px; border-radius: $radius-pill; background: $warning-50; color: $warning-700; font-size: $font-caption; font-weight: $font-weight-semibold; }
.dp__focus > strong { margin-top: 4px; color: $text-primary; font-size: $font-title; }
.dp__focus > p { margin: $space-2 0 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.6; }
.dp__focus > button { align-self: flex-start; min-height: 34px; margin-top: $space-2; padding: 0 14px; border: 0; border-radius: $radius-sm; background: $brand-600; color: $surface-0; font: inherit; font-size: $font-body-sm; font-weight: $font-weight-semibold; cursor: pointer; }
.dp__focus-note { margin-top: 6px; }
.dp__focus-note span { display: none; }
.dp__focus-note p { margin: 0; color: $text-secondary; font-size: $font-caption; line-height: 1.45; }

.dp__grid { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(320px, .85fr); gap: $space-4; align-items: start; }
.dp__grid :deep(.distribution__list) { max-height: 160px; overflow: auto; }

@media (max-width: 1280px) {
  .dp__hero, .dp__grid, .dp__insight { grid-template-columns: 1fr; }
  .dp__pipeline-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

@media (max-width: 1024px) {
  .dp__head, .dp__head-meta { align-items: flex-start; }
  .dp__summary, .dp__pipeline-steps { grid-template-columns: 1fr; }
  .dp__pipeline > header { align-items: flex-start; flex-direction: column; }
}
</style>
