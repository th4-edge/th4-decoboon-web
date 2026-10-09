import { computed, ref } from 'vue'
import { workbenchApi } from '@/domains/workbench/api'
import type { BusinessWorkbenchChartSeries, DesignerBusinessWorkbenchReport } from '@/domains/workbench/model'
import type { WorkbenchMainlineStep } from '@/components/workbench/WorkbenchMainlineSteps.vue'
import type { StatusTone } from '@/core/tone'

const SUMMARY_META: Record<string, { label: string; hint: string; format: 'count' | 'money' }> = {
  designerInProgressCustomerCount: {
    label: '在途客户',
    hint: '量房、设计与报价阶段的当前客户量',
    format: 'count'
  },
  designerMonthQuoteAmount: {
    label: '本月报价金额',
    hint: '本月已提交并形成客户可见报价的金额',
    format: 'money'
  },
  designerMonthSignedAmount: {
    label: '本月签约金额',
    hint: '按签约日归月的新签合同金额',
    format: 'money'
  }
}

const PIPELINE_UNITS: Record<string, string> = {
  measure: '套',
  design: '套',
  quote: '份',
  contract: '份'
}

const WORK_LABELS: Record<string, string> = {
  designerMeasurePendingCount: '待我量房',
  designerDesignPendingCount: '待我设计',
  designerQuoteActionCount: '待我谈单',
  pendingQuoteDecisionCount: '待客户确认',
  designerContractHandoffCount: '合同交接',
  designerProjectActiveCount: '项目推进',
  designerMaterialSelectionPendingCount: '待我选材',
  designerContractChangePendingCount: '增减项',
  designerAcceptancePendingCount: '验收/整改'
}

const WORK_TONES: Record<string, StatusTone> = {
  designerMeasurePendingCount: 'info',
  designerDesignPendingCount: 'doing',
  designerQuoteActionCount: 'blocked',
  pendingQuoteDecisionCount: 'pending',
  designerContractHandoffCount: 'accent',
  designerProjectActiveCount: 'progress',
  designerMaterialSelectionPendingCount: 'special',
  designerContractChangePendingCount: 'alert',
  designerAcceptancePendingCount: 'done'
}

export function useDesignerPerformance() {
  const report = ref<DesignerBusinessWorkbenchReport | null>(null)
  const loading = ref(false)
  const error = ref('')

  const summaryItems = computed(() => {
    const metrics = report.value?.summary ?? []
    return Object.entries(SUMMARY_META).map(([key, meta]) => ({
      ...meta,
      metric: metrics.find((item) => item.key === key) ?? null
    }))
  })

  const pipelineSteps = computed<WorkbenchMainlineStep[]>(() => (report.value?.pipeline ?? []).map((stage) => ({
    key: stage.key,
    label: stage.label,
    count: stage.count,
    unit: PIPELINE_UNITS[stage.key] ?? '',
    status: stage.state === 'done' ? 'done' : stage.state === 'current' ? 'current' : 'upcoming',
    breakdown: [],
    route: stage.route,
    description: stage.description
  })))

  const trendChart = computed(() => report.value?.charts.find((chart) => chart.key === 'designer.businessTrend') ?? null)
  const trendSeries = computed<BusinessWorkbenchChartSeries[]>(() => trendChart.value?.series ?? [])
  const distributionSeries = computed<BusinessWorkbenchChartSeries[]>(() =>
    report.value?.charts.find((chart) => chart.key === 'designer.workDistribution')?.series ?? []
  )

  const ranking = computed(() => report.value?.performanceRanking ?? null)
  const focusStep = computed(() => pipelineSteps.value.find((step) => step.status === 'current') ?? null)
  const status = computed(() => report.value?.status || 'ready')
  const warnings = computed(() => report.value?.warnings ?? [])

  async function load(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      report.value = await workbenchApi.designerBusinessWorkbench()
    } catch (err) {
      report.value = null
      error.value = err instanceof Error ? err.message : '我的业绩暂不可确认'
    } finally {
      loading.value = false
    }
  }

  return {
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
    workLabels: WORK_LABELS,
    workTones: WORK_TONES,
    load
  }
}
