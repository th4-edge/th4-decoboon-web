<script setup lang="ts">
import { computed } from 'vue'
import { formatCount } from '@/core/format'
import type { BusinessWorkbenchChartSeries } from '@/domains/workbench/model'

const props = withDefaults(defineProps<{
  series: BusinessWorkbenchChartSeries[]
  startDate: string
  endDate: string
  loading?: boolean
}>(), { loading: false })

const WIDTH = 760
const HEIGHT = 260
const PADDING = { top: 18, right: 18, bottom: 34, left: 44 }
const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom

const LABELS: Record<string, string> = {
  designerMeasureCompletedDailyCount: '量房完成',
  designerQuoteSubmittedDailyCount: '报价提交',
  designerQuoteAcceptedDailyCount: '客户接受',
  designerContractEffectiveDailyCount: '合同生效'
}

const COLORS = [
  'var(--th4-status-info)',
  'var(--th4-status-doing)',
  'var(--th4-status-done)',
  'var(--th4-status-pending)'
]

interface PlotSeries {
  key: string
  label: string
  color: string
  points: string
  dots: Array<{ x: number; y: number; date: string; value: number; color: string }>
}

const dates = computed(() => {
  const start = parseDate(props.startDate)
  const end = parseDate(props.endDate)
  if (!start || !end || start > end) return []
  const result: string[] = []
  for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
    result.push(formatDate(current))
  }
  return result
})

const maxValue = computed(() => Math.max(1, ...props.series.flatMap((item) => (item.points ?? []).map((point) => point.value))))
const gridLines = computed(() => [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
  y: PADDING.top + PLOT_HEIGHT * ratio,
  value: maxValue.value * (1 - ratio)
})))

const plots = computed<PlotSeries[]>(() => {
  const currentDates = dates.value
  return props.series.map((series, seriesIndex) => {
    const pointMap = new Map((series.points ?? []).map((point) => [point.date, point.value]))
    const color = COLORS[seriesIndex % COLORS.length]
    const dots = currentDates.map((date, index) => ({
      x: x(index, currentDates.length),
      y: y(pointMap.get(date) ?? 0),
      date,
      value: pointMap.get(date) ?? 0,
      color
    }))
    return {
      key: series.key,
      label: LABELS[series.key] ?? series.key,
      color,
      points: dots.map((dot) => `${dot.x},${dot.y}`).join(' '),
      dots
    }
  })
})

function x(index: number, total: number): number {
  if (total <= 1) return PADDING.left + PLOT_WIDTH / 2
  return PADDING.left + (PLOT_WIDTH * index) / (total - 1)
}

function y(value: number): number {
  return PADDING.top + PLOT_HEIGHT * (1 - value / maxValue.value)
}

function parseDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function shortDate(value: string): string {
  const parts = value.split('-')
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : value
}
</script>

<template>
  <section class="trend-chart" :aria-busy="loading">
    <header class="trend-chart__head">
      <div>
        <h3>近 30 天业务趋势</h3>
        <p>按量房完成、报价提交、客户接受和合同生效的日期事实归集。</p>
      </div>
      <div class="trend-chart__legend">
        <span v-for="plot in plots" :key="plot.key">
          <i :style="{ backgroundColor: plot.color }" aria-hidden="true" />
          {{ plot.label }}
        </span>
      </div>
    </header>

    <div v-if="loading" class="trend-chart__loading">
      <el-skeleton :rows="4" animated />
    </div>

    <div v-else-if="!series.length || !dates.length" class="trend-chart__empty">
      暂无趋势数据
    </div>

    <div v-else class="trend-chart__canvas">
      <svg :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" role="img" aria-label="近 30 天业务趋势折线图">
        <line
          v-for="line in gridLines"
          :key="line.y"
          :x1="PADDING.left"
          :x2="WIDTH - PADDING.right"
          :y1="line.y"
          :y2="line.y"
          class="trend-chart__grid"
        />
        <text
          v-for="line in gridLines"
          :key="`${line.y}-label`"
          :x="PADDING.left - 10"
          :y="line.y + 4"
          text-anchor="end"
          class="trend-chart__axis"
        >
          {{ formatCount(Math.round(line.value)) }}
        </text>
        <polyline
          v-for="plot in plots"
          :key="plot.key"
          :points="plot.points"
          fill="none"
          :stroke="plot.color"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle
          v-for="dot in plots.flatMap((plot) => plot.dots)"
          :key="`${dot.date}-${dot.value}-${dot.x}`"
          :cx="dot.x"
          :cy="dot.y"
          r="2.4"
          class="trend-chart__dot"
          :stroke="dot.color"
        />
        <text
          :x="PADDING.left"
          :y="HEIGHT - 8"
          text-anchor="start"
          class="trend-chart__axis"
        >
          {{ shortDate(startDate) }}
        </text>
        <text
          :x="WIDTH - PADDING.right"
          :y="HEIGHT - 8"
          text-anchor="end"
          class="trend-chart__axis"
        >
          {{ shortDate(endDate) }}
        </text>
      </svg>
    </div>
  </section>
</template>

<style scoped lang="scss">
.trend-chart {
  min-width: 0;
  padding: $space-5;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
  box-shadow: $shadow-card;
}

.trend-chart__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;
  margin-bottom: $space-4;

  h3 { margin: 0 0 $space-1; font-size: $font-title; }
  p { margin: 0; color: $text-secondary; font-size: $font-body-sm; }
}

.trend-chart__legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: $space-2 $space-3;
  color: $text-secondary;
  font-size: $font-caption;

  span { display: inline-flex; align-items: center; gap: 5px; }
  i { width: 14px; height: 3px; border-radius: $radius-pill; }
}

.trend-chart__loading { min-height: 260px; }
.trend-chart__empty { min-height: 260px; display: grid; place-items: center; color: $text-tertiary; font-size: $font-body-sm; }
.trend-chart__canvas { overflow: hidden; }
.trend-chart__canvas svg { display: block; width: 100%; height: auto; min-height: 240px; }
.trend-chart__grid { stroke: $border-color; stroke-width: 1; stroke-dasharray: 4 5; }
.trend-chart__axis { fill: $text-tertiary; font-size: 11px; font-variant-numeric: tabular-nums; }
.trend-chart__dot { fill: $surface-0; stroke: $text-secondary; stroke-width: 1; }

@media (max-width: 1100px) {
  .trend-chart__head { flex-direction: column; }
  .trend-chart__legend { justify-content: flex-start; }
}
</style>
