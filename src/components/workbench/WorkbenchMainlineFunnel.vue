<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ECharts } from 'echarts/core'
import WorkbenchState from './WorkbenchState.vue'
import { WORKBENCH_FUNNEL_COLORS } from '@/core/chartPalette'

export interface WorkbenchFunnelStage {
  key: string
  label: string
  value: number
  unit: string
  route?: string
}

const props = withDefaults(defineProps<{
  stages: WorkbenchFunnelStage[]
  loading?: boolean
  error?: string
}>(), { loading: false, error: '' })

const emit = defineEmits<{ open: [route: string]; retry: [] }>()
const host = ref<HTMLDivElement | null>(null)
const renderFailed = ref(false)
let chart: ECharts | null = null
let resizeObserver: ResizeObserver | null = null

async function ensureChart(): Promise<ECharts | null> {
  if (chart) return chart
  if (!host.value) return null
  const [core, charts, components, renderers] = await Promise.all([
    import('echarts/core'),
    import('echarts/charts'),
    import('echarts/components'),
    import('echarts/renderers')
  ])
  core.use([charts.FunnelChart, components.TooltipComponent, renderers.CanvasRenderer])
  chart = core.init(host.value)
  chart.on('click', openStage)
  return chart
}

async function render(): Promise<void> {
  if (!host.value || props.loading || props.error || !props.stages.length) return
  let instance: ECharts | null = null
  try {
    instance = await ensureChart()
  } catch {
    renderFailed.value = true
    return
  }
  if (!instance) return
  renderFailed.value = false

  const total = props.stages.reduce((sum, stage) => sum + Number(stage.value ?? 0), 0)

  instance.setOption({
    animationDuration: 480,
    tooltip: {
      trigger: 'item',
      backgroundColor: '#1A1A17',
      borderWidth: 0,
      padding: [10, 14],
      borderRadius: 10,
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: (params: { dataIndex: number }) => {
        const stage = props.stages[params.dataIndex]
        const share = total > 0 ? Math.round((Number(stage.value) / total) * 100) : 0
        return `<div style="font-weight:600;margin-bottom:3px">${stage.label}</div>` +
          `<div>当前 ${stage.value} ${stage.unit} · 占主链 ${share}%</div>`
      }
    },
    series: [{
      type: 'funnel',
      sort: 'none',
      gap: 6,
      minSize: '30%',
      maxSize: '100%',
      left: '10%',
      right: '12%',
      top: 16,
      bottom: 16,
      label: {
        show: true,
        position: 'inside',
        fontSize: 13,
        fontWeight: 600,
        color: '#fff',
        formatter: (params: { dataIndex: number }) => {
          const stage = props.stages[params.dataIndex]
          const share = total > 0 ? Math.round((Number(stage.value) / total) * 100) : 0
          return `${stage.label}  ${stage.value}${stage.unit}  ${share}%`
        }
      },
      labelLayout: { hideOverlap: true },
      itemStyle: {
        borderColor: '#fff',
        borderWidth: 2
      },
      emphasis: {
        label: { fontSize: 14 },
        itemStyle: { shadowBlur: 14, shadowColor: 'rgba(26,26,23,.2)' }
      },
      data: props.stages.map((stage, index) => ({
        name: stage.label,
        value: stage.value,
        itemStyle: { color: WORKBENCH_FUNNEL_COLORS[index % WORKBENCH_FUNNEL_COLORS.length] }
      }))
    }]
  }, true)
}

function openStage(params: { dataIndex: number }): void {
  const route = props.stages[params.dataIndex]?.route
  if (route) emit('open', route)
}

onMounted(async () => {
  await nextTick()
  await render()
  if (host.value) {
    resizeObserver = new ResizeObserver(() => chart?.resize())
    resizeObserver.observe(host.value)
  }
})

watch(() => [props.stages, props.loading, props.error], async () => {
  await nextTick()
  if (props.loading || props.error) {
    chart?.clear()
    return
  }
  await render()
}, { deep: true })

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  chart?.dispose()
  chart = null
})
</script>

<template>
  <section class="funnel" :aria-busy="loading">
    <div v-if="loading" class="funnel__skeleton" aria-hidden="true">
      <span v-for="n in 5" :key="n" class="funnel__skeleton-band" :style="{ width: `${100 - (n - 1) * 13}%` }" />
    </div>

    <WorkbenchState
      v-else-if="error"
      variant="error"
      title="当前工作分布暂不可确认"
      :description="error"
      action-text="重新加载"
      min-height="286px"
      @action="emit('retry')"
    />

    <WorkbenchState
      v-else-if="renderFailed"
      variant="error"
      title="图表组件未能加载"
      description="分布图依赖的图表组件没有成功载入，可先按上方工作卡进入对应工作台，稍后再试。"
      action-text="重新加载"
      min-height="286px"
      @action="emit('retry')"
    />

    <WorkbenchState
      v-else-if="!stages.length"
      title="暂无工作分布数据"
      description="当前没有进入方案报价主链的在途对象，产生在途客户后这里会显示各阶段存量。"
      min-height="286px"
    />

    <div v-else ref="host" class="funnel__canvas" role="img" aria-label="方案报价主链当前工作分布" />
  </section>
</template>

<style scoped lang="scss">
.funnel {
  min-height: 286px;
}

.funnel__canvas {
  width: 100%;
  height: 286px;
}

.funnel__skeleton {
  height: 286px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.funnel__skeleton-band {
  display: block;
  height: 34px;
  border-radius: $radius-sm;
  background: linear-gradient(90deg, $surface-100 25%, $surface-50 37%, $surface-100 63%);
  background-size: 400% 100%;
  animation: funnel-shimmer 1.4s ease infinite;
}

@keyframes funnel-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

@media (prefers-reduced-motion: reduce) {
  .funnel__skeleton-band { animation: none; }
}
</style>
