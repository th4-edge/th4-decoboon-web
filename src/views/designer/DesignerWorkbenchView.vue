<script setup lang="ts">
import { onMounted } from 'vue'
import NavIcon from '@/components/shell/NavIcon.vue'
import BusinessWorkbenchCard from '@/components/workbench/BusinessWorkbenchCard.vue'
import WorkbenchMainlineSteps from '@/components/workbench/WorkbenchMainlineSteps.vue'
import WorkbenchMainlineFunnel from '@/components/workbench/WorkbenchMainlineFunnel.vue'
import WorkbenchTodayLine from '@/components/workbench/WorkbenchTodayLine.vue'
import WorkbenchState from '@/components/workbench/WorkbenchState.vue'
import { useDesignerWorkbench } from '@/composables/useDesignerWorkbench'
import { formatCount, formatDateTime, formatMoney } from '@/core/format'

const {
  report,
  loading,
  reportError,
  queueError,
  load,
  open,
  summaryItems,
  totalPending,
  mainlineSteps,
  currentStep,
  groupedCards,
  funnelStages,
  todayItems
} = useDesignerWorkbench()

onMounted(load)
</script>

<template>
  <div class="business-workbench">
    <div class="page-head">
      <div class="title-zone">
        <h1>业务工作台</h1>
        <div class="sub">先看工作总量、业务趋势与阶段分布，再进入对应场景工作台处理具体对象。</div>
      </div>
      <div class="meta">
        <span class="todo-pill">
          <span class="todo-num num">{{ report ? formatCount(totalPending) : '—' }}</span>项待处理
        </span>
        <span v-if="report" class="live-note"><span class="live-dot"></span>数据更新于 {{ formatDateTime(report.generatedAt) }}</span>
        <button class="refresh-btn" type="button" :class="{ spin: loading }" @click="load">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.3M21 3v6h-6" /></svg>
          刷新
        </button>
      </div>
    </div>

    <!-- 首屏加载：按真实版式给出骨架，避免布局跳动 -->
    <div v-if="!report && loading" class="wb-skeleton" aria-busy="true" aria-live="polite">
      <div class="wbs-row wbs-row--kpi">
        <span v-for="n in 3" :key="n" class="wbs-block wbs-block--kpi" />
      </div>
      <span class="wbs-block wbs-block--pipeline" />
      <div class="wbs-row wbs-row--cards">
        <span v-for="n in 3" :key="n" class="wbs-block wbs-block--card" />
      </div>
      <div class="wbs-row wbs-row--charts">
        <span class="wbs-block wbs-block--chart" />
        <span class="wbs-block wbs-block--chart" />
      </div>
      <span class="wbs-sr">业务工作台加载中</span>
    </div>

    <WorkbenchState
      v-else-if="!report && reportError"
      variant="error"
      title="业务工作台暂不可确认"
      :description="reportError"
      action-text="重新加载"
      min-height="320px"
      @action="load"
    />

    <WorkbenchState
      v-else-if="!report"
      title="暂无可展示的工作数据"
      description="当前账号在该数据范围内没有可统计的工作对象；完成客户、设计或报价录入后，这里会自动出现对应工作量。"
      action-text="刷新数据"
      min-height="320px"
      @action="load"
    />

    <template v-else>
      <section class="kpi-row" aria-label="当月概览">
        <article v-for="item in summaryItems" :key="item.key" class="kpi">
          <div class="kpi-top">
            <span class="k-label">{{ item.label }}</span>
            <span class="kpi-icon" aria-hidden="true"><NavIcon :name="item.icon" /></span>
          </div>
          <div class="kpi-value num">
            <span v-if="item.format === 'money'" class="cny">¥</span>
            <span>{{ item.format === 'money' ? formatMoney(item.metric?.value) : formatCount(item.metric?.value) }}</span>
          </div>
          <div class="kpi-foot">
            <span
              v-if="item.metric?.comparisonState === 'unavailable'"
              class="trend flat"
              :title="item.metric?.comparisonLabel"
            >暂无基期</span>
            <span
              v-else-if="item.metric?.changeRate !== null && item.metric?.changeRate !== undefined"
              class="trend"
              :class="item.metric.comparisonState"
              :title="item.metric?.comparisonLabel"
            >
              {{ item.metric.changeRate > 0 ? '↑' : item.metric.changeRate < 0 ? '↓' : '→' }}
              {{ Math.abs(item.metric.changeRate).toFixed(1) }}%
            </span>
            <span class="k-foot-text">{{ item.hint }}</span>
          </div>
        </article>
      </section>

      <WorkbenchMainlineSteps
        :steps="mainlineSteps"
        :main-action-label="currentStep ? `进入${currentStep.label}工作台` : '进入工作台'"
        :loading="loading"
        @open="open"
      />

      <section v-for="group in groupedCards" :key="group.key" class="zone">
        <div class="zone-head">
          <div>
            <div class="zone-title">{{ group.label }}</div>
            <div class="zone-desc">{{ group.description }}</div>
          </div>
        </div>
        <div class="workcards">
          <BusinessWorkbenchCard
            v-for="item in group.cards"
            :key="item.config.key"
            :config="item.config"
            :metric="item.metric"
            :loading="loading"
            @open="open"
          />
        </div>
      </section>

      <div class="charts">
        <section class="card chart-box">
          <div class="card-head">
            <div>
              <div class="card-title">方案报价主链 · 当前工作分布</div>
              <div class="card-desc">呈现当前各阶段真实存量，不使用未经裁决的转化率口径。</div>
            </div>
          </div>
          <div class="chart-canvas">
            <WorkbenchMainlineFunnel :stages="funnelStages" :loading="loading" :error="reportError" @open="open" @retry="load" />
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <div>
              <div class="card-title">今日主线 · 需要我推进</div>
              <div class="card-desc">独立 Today Queue 返回的最优先对象，点开即进入对应工作面。</div>
            </div>
          </div>
          <WorkbenchTodayLine :items="todayItems" :loading="loading" :error="queueError" @open="open" @retry="load" />
        </section>
      </div>

      <div class="foot-note">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8h.01M11 12h1v4h1" />
        </svg>
        数据来自服务端聚合；成本、利润和未授权动作按当前设计师权限隐藏。
      </div>
    </template>

  </div>
</template>

<style scoped lang="scss">
.business-workbench {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: $space-5;
  margin-bottom: $space-6;
}

.title-zone {
  min-width: 0;

  h1 {
    margin: 0;
    color: $text-primary;
    font-size: $font-display;
    font-weight: $font-weight-bold;
    letter-spacing: -.02em;
    line-height: 1.6;
  }
}

.sub {
  margin-top: 6px;
  color: $text-secondary;
  font-size: $font-body-sm;
  line-height: 1.6;
}

.meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: $space-3;
  color: $text-secondary;
  font-size: $font-caption;
}

.todo-pill {
  display: inline-flex;
  align-items: center;
  gap: $space-2;
  height: 28px;
  padding: 0 6px 0 12px;
  border-radius: $radius-pill;
  color: $surface-0;
  background: $brand-500;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
}

.todo-num {
  display: grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: rgba(255, 255, 255, .22);
  font-size: $font-micro;
  font-weight: $font-weight-bold;
}

.live-note {
  display: inline-flex;
  align-items: center;
}

.live-dot {
  width: 7px;
  height: 7px;
  margin-right: 8px;
  border-radius: 50%;
  background: $success-500;
  box-shadow: 0 0 0 4px $success-50;
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  color: $text-secondary;
  background: $surface-0;
  font: inherit;
  font-size: $font-caption;
  cursor: pointer;
  transition: color .18s, border-color .18s, background .18s;

  svg { width: 13px; height: 13px; }
  &:hover { color: $brand-600; border-color: $brand-300; background: $brand-50; }
  &.spin svg { animation: spin .7s linear infinite; }
}

@keyframes spin { to { transform: rotate(360deg); } }
.kpi-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $space-4;
  margin-bottom: $space-6;
}

.kpi {
  display: flex;
  flex-direction: column;
  gap: $space-3;
  padding: 20px 24px;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
  box-shadow: $shadow-card;
  transition: box-shadow .25s, transform .25s, border-color .25s;

  &:hover {
    border-color: $border-color;
    box-shadow: $shadow-elevated;
  }
}

.kpi-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;
}

.k-label {
  min-width: 0;
  overflow: hidden;
  color: $text-secondary;
  font-size: $font-caption;
  font-weight: $font-weight-medium;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kpi-icon {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  flex: 0 0 28px;
  border-radius: $radius-sm;
  color: $brand-600;
  background: $brand-50;

  svg { width: 15px; height: 15px; }
}

.kpi-value {
  color: $text-primary;
  font-size: $font-kpi;
  font-weight: $font-weight-bold;
  line-height: 1;
  letter-spacing: -.03em;
  font-variant-numeric: tabular-nums;
}

.kpi-value .cny {
  margin-right: 3px;
  color: $text-secondary;
  font-size: $font-title;
  font-weight: $font-weight-medium;
  vertical-align: 4px;
}

.kpi-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  color: $text-secondary;
  font-size: 11px;
}

.k-foot-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trend {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 8px;
  border-radius: $radius-pill;
  font-size: 11px;
  font-weight: $font-weight-semibold;
  font-variant-numeric: tabular-nums;

  &.up { color: $success-500; background: $success-50; }
  &.down { color: $danger-500; background: $danger-50; }
  &.flat { color: $text-secondary; background: $bg-page; }
}

.zone {
  display: flex;
  flex-direction: column;
}

.zone-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: $space-3;
  margin: $space-2 2px $space-3;
}

.zone-title {
  color: $text-primary;
  font-size: $font-title;
  font-weight: $font-weight-bold;
  letter-spacing: -.01em;
}

.zone-desc {
  margin-top: 2px;
  color: $text-secondary;
  font-size: $font-caption;
}

.workcards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $space-4;
  margin-bottom: $space-6;
}

.charts {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  gap: 18px;
  margin-bottom: $space-2;
  overflow: hidden;
}

.card {
  min-width: 0;
  padding: 22px 24px;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
  box-shadow: $shadow-card;
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: $space-2;
}

.card-title {
  color: $text-primary;
  font-size: $font-card-title;
  font-weight: $font-weight-bold;
  letter-spacing: -.01em;
}

.card-desc {
  margin-top: 2px;
  color: $text-secondary;
  font-size: $font-caption;
}

.chart-canvas {
  width: 100%;
  height: 286px;
  overflow: hidden;

  :deep(canvas) { max-width: 100%; }
}

.foot-note {
  display: flex;
  align-items: center;
  gap: $space-2;
  padding: 6px 2px 0;
  color: $text-tertiary;
  font-size: 11px;

  svg { width: 14px; height: 14px; flex-shrink: 0; }
}

.wb-skeleton {
  display: flex;
  flex-direction: column;
  gap: $space-6;
}

.wbs-row {
  display: grid;
  gap: $space-4;
}

.wbs-row--kpi,
.wbs-row--cards {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.wbs-row--charts {
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  gap: 18px;
}

.wbs-block {
  display: block;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
  box-shadow: $shadow-card;
  animation: wbs-pulse 1.5s ease-in-out infinite;
}

.wbs-block::after {
  content: '';
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(100deg, transparent 20%, rgba(235, 235, 230, .55) 42%, transparent 64%);
  background-size: 220% 100%;
  animation: wbs-shimmer 1.5s linear infinite;
}

.wbs-block--kpi { height: 137px; }
.wbs-block--pipeline { height: 226px; }
.wbs-block--card { height: 208px; }
.wbs-block--chart { height: 344px; }

.wbs-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

@keyframes wbs-shimmer {
  from { background-position: 140% 0; }
  to { background-position: -40% 0; }
}

@keyframes wbs-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .72; }
}

@media (max-width: 1240px) {
  .workcards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .charts { grid-template-columns: 1fr; }
}

@media (max-width: 1240px) {
  .wbs-row--charts { grid-template-columns: 1fr; }
  .wbs-row--kpi,
  .wbs-row--cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 720px) {
  .wbs-row--kpi,
  .wbs-row--cards { grid-template-columns: 1fr; }
  .kpi-row { grid-template-columns: 1fr; }
  .workcards { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .refresh-btn.spin svg,
  .wbs-block,
  .wbs-block::after { animation: none; }
}
</style>
