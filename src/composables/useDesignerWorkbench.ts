import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { BusinessWorkbenchCardConfig } from '@/components/workbench/BusinessWorkbenchCard.vue'
import type { WorkbenchMainlineStep } from '@/components/workbench/WorkbenchMainlineSteps.vue'
import type { WorkbenchFunnelStage } from '@/components/workbench/WorkbenchMainlineFunnel.vue'
import type { WorkQueueItem } from '@/domains/workbench/model'
import { workbenchApi } from '@/domains/workbench/api'
import type { BusinessWorkbenchCardMetric, DesignerBusinessWorkbenchReport } from '@/domains/workbench/model'
import { useWorkbenchShellStore } from '@/stores/workbench'

interface WorkbenchGroup {
  key: string
  label: string
  description: string
}

const GROUPS: WorkbenchGroup[] = [
  { key: 'customer', label: '客户经营 · 待我处理', description: '量房、设计、报价与合同交接，沿方案报价主线推进。' },
  { key: 'project', label: '项目工地 · 在管推进', description: '在管项目各阶段的推进、选材、变更与验收。' }
]

const CARD_CONFIGS: BusinessWorkbenchCardConfig[] = [
  {
    key: 'designerMeasurePendingCount',
    label: '待我量房',
    description: '房屋待量房或量房中，需要安排与登记结果。',
    icon: 'measure',
    route: '/designer/customers?surface=measure',
    tone: 'info',
    unit: '套',
    breakdownLabels: { pendingMeasure: '待安排', measuring: '量房中' },
    actionText: '进入量房工作台',
    group: 'customer'
  },
  {
    key: 'designerDesignPendingCount',
    label: '待我设计',
    description: '已量房房屋中，方案尚未完成或待讲解。',
    icon: 'design',
    route: '/designer/design',
    tone: 'doing',
    unit: '套',
    breakdownLabels: { noScheme: '待创建方案', draft: '设计中', ready: '待谈单', presented: '已讲解' },
    actionText: '进入设计工作台',
    group: 'customer'
  },
  {
    key: 'designerQuoteActionCount',
    label: '待我报价',
    description: '草稿或客户驳回后需要继续调整的报价。',
    icon: 'quote',
    route: '/designer/quotes',
    tone: 'blocked',
    unit: '个',
    breakdownLabels: { draft: '草稿', rejected: '需调整' },
    actionText: '进入报价工作台',
    group: 'customer'
  },
  {
    key: 'pendingQuoteDecisionCount',
    label: '待客户确认',
    description: '报价已提交，等待客户决策并需要持续跟进。',
    icon: 'waiting',
    route: '/designer/quotes?status=submitted',
    tone: 'pending',
    unit: '个',
    breakdownLabels: { within3Days: '3天内', from3To6Days: '3–6天', sevenDaysOrMore: '7天及以上' },
    actionText: '进入报价确认队列',
    group: 'customer'
  },
  {
    key: 'designerContractHandoffCount',
    label: '合同交接',
    description: '待签约或已签约未生效的合同。',
    icon: 'contract',
    route: '/designer/contract',
    tone: 'accent',
    unit: '份',
    breakdownLabels: { pendingSign: '待签约', signed: '已签约未生效' },
    actionText: '进入合同交接',
    group: 'customer'
  },
  {
    key: 'designerProjectActiveCount',
    label: '项目推进',
    description: '本人作为设计负责人的在管项目。',
    icon: 'project',
    route: '/designer/projects',
    tone: 'progress',
    unit: '个',
    breakdownLabels: { preparing: '待开工', ongoing: '施工中', suspended: '已停工', accepting: '待验收' },
    actionText: '进入项目推进',
    group: 'project'
  },
  {
    key: 'designerMaterialSelectionPendingCount',
    label: '待我选材',
    description: '材料计划仍待选材或待客户确认的项目。',
    icon: 'material',
    route: '/designer/projects',
    tone: 'special',
    unit: '个',
    breakdownLabels: { plannedPlans: '待选材料', pendingConfirm: '待客户确认' },
    actionText: '进入选材工作台',
    group: 'project'
  },
  {
    key: 'designerContractChangePendingCount',
    label: '增减项',
    description: '有待审批或待客户确认增减项的项目。',
    icon: 'change',
    route: '/designer/projects',
    tone: 'alert',
    unit: '个',
    breakdownLabels: { pending: '待审批', approved: '待客户确认' },
    actionText: '进入增减项',
    group: 'project'
  },
  {
    key: 'designerAcceptancePendingCount',
    label: '验收/整改',
    description: '有阶段待验收或整改复验的项目。',
    icon: 'acceptance',
    route: '/designer/projects',
    tone: 'done',
    unit: '个',
    breakdownLabels: { pending: '待验收', rejected: '整改中', accepting: '待复验' },
    actionText: '进入验收/整改',
    group: 'project'
  },
  {
    key: 'designerProjectOverview',
    metricKey: 'designerProjectActiveCount',
    label: '工地全景',
    description: '在管项目的整体节奏与阶段分布。',
    icon: 'project',
    route: '/designer/projects',
    tone: 'dark',
    unit: '在管',
    breakdownLabels: { preparing: '待开工', ongoing: '施工中', suspended: '已停工', accepting: '待验收' },
    actionText: '查看工地看板',
    group: 'project',
    pendingExcluded: true
  }
]

const SUMMARY_CONFIG = [
  { key: 'designerInProgressCustomerCount', label: '在途客户', hint: '量房、设计与报价阶段客户', format: 'count' as const, icon: 'customer.followup' },
  { key: 'designerMonthQuoteAmount', label: '本月报价金额', hint: '本月已提交并形成客户可见报价', format: 'money' as const, icon: 'designer.quote' },
  { key: 'designerMonthSignedAmount', label: '本月签约金额', hint: '按签约日归月的新签合同', format: 'money' as const, icon: 'designer.contract' }
]

const PIPELINE_CARD_KEYS: Record<string, string> = {
  measure: 'designerMeasurePendingCount',
  design: 'designerDesignPendingCount',
  quote: 'designerQuoteActionCount',
  contract: 'designerContractHandoffCount'
}

const FUNNEL_META: Record<string, { label: string; unit: string; route: string }> = {
  inProgressCustomers: { label: '在途客户', unit: '位', route: '/designer/customers' },
  designPending: { label: '设计', unit: '套', route: '/designer/design' },
  quoteAction: { label: '报价', unit: '个', route: '/designer/quotes' },
  waitingConfirmation: { label: '待客户确认', unit: '个', route: '/designer/quotes?status=submitted' },
  contractHandoff: { label: '合同交接', unit: '份', route: '/designer/contract' }
}

export function useDesignerWorkbench() {
  const router = useRouter()
  const shellStore = useWorkbenchShellStore()
  const report = ref<DesignerBusinessWorkbenchReport | null>(null)
  const queue = ref<WorkQueueItem[]>([])
  const loading = ref(false)
  const reportError = ref('')
  const queueError = ref('')

  function metricKeyOf(config: BusinessWorkbenchCardConfig): string {
    return config.metricKey ?? config.key
  }

  function cardMetric(key: string): BusinessWorkbenchCardMetric | undefined {
    const config = CARD_CONFIGS.find((item) => item.key === key)
    const metricKey = config ? metricKeyOf(config) : key
    return report.value?.cards.find((metric) => metric.key === metricKey)
  }

  const summaryItems = computed(() => {
    const metrics = report.value?.summary ?? []
    return SUMMARY_CONFIG.map((item) => ({
      ...item,
      metric: metrics.find((metric) => metric.key === item.key)
    }))
  })

  const totalPending = computed(() => CARD_CONFIGS
    .filter((config) => !config.pendingExcluded)
    .reduce((sum, config) => sum + (cardMetric(config.key)?.count ?? 0), 0))

  const mainlineSteps = computed<WorkbenchMainlineStep[]>(() => {
    const pipeline = report.value?.pipeline ?? []
    return pipeline.map((stage) => {
      const cardKey = PIPELINE_CARD_KEYS[stage.key]
      const config = CARD_CONFIGS.find((item) => item.key === cardKey)
      const metric = cardKey ? cardMetric(cardKey) : undefined
      const breakdown = (metric?.breakdown ?? [])
        .filter((item) => item.count > 0)
        .map((item) => ({ key: item.key, label: config?.breakdownLabels[item.key] ?? item.key, count: item.count }))
      return {
        key: stage.key,
        label: stage.label,
        count: stage.count,
        unit: config?.unit ?? '',
        status: stage.state === 'done' ? 'done' as const : stage.state === 'current' ? 'current' as const : 'upcoming' as const,
        breakdown,
        route: stage.route
      }
    })
  })

  const currentStep = computed(() => mainlineSteps.value.find((step) => step.status === 'current'))

  const groupedCards = computed(() => GROUPS.map((group) => ({
    ...group,
    cards: CARD_CONFIGS.filter((config) => config.group === group.key).map((config) => ({
      config,
      metric: cardMetric(config.key)
    }))
  })))

  const funnelStages = computed<WorkbenchFunnelStage[]>(() => {
    const chart = report.value?.charts.find((item) => item.key === 'designer.conversionFunnel')
    return (chart?.series ?? []).map((series) => {
      const meta = FUNNEL_META[series.key] ?? { label: series.key, unit: '' }
      return {
        key: series.key,
        label: meta.label,
        value: Number(series.value ?? 0),
        unit: meta.unit,
        route: meta.route
      }
    })
  })

  function messageOf(reason: unknown): string {
    if (reason instanceof Error && reason.message) return reason.message
    return '业务工作台暂不可确认，请稍后重试'
  }

  async function load(): Promise<void> {
    loading.value = true
    reportError.value = ''
    queueError.value = ''

    const [reportResult, queueResult] = await Promise.allSettled([
      workbenchApi.designerBusinessWorkbench(),
      workbenchApi.designerWorkQueue()
    ])

    if (reportResult.status === 'fulfilled') {
      report.value = reportResult.value
      const pendingTotal = CARD_CONFIGS
        .filter((config) => !config.pendingExcluded)
        .reduce((sum, config) => sum + (cardMetric(config.key)?.count ?? 0), 0)
      const quoteAction = cardMetric('designerQuoteActionCount')?.count ?? 0
      const waiting = cardMetric('pendingQuoteDecisionCount')?.count ?? 0
      const contract = cardMetric('designerContractHandoffCount')?.count ?? 0
      const projects = cardMetric('designerProjectActiveCount')?.count ?? 0
      const customers = reportResult.value.summary
        .find((item) => item.key === 'designerInProgressCustomerCount')?.value ?? 0
      shellStore.setBadges({
        'today.mainline': pendingTotal,
        'customer.followup': customers,
        'designer.quote': quoteAction + waiting,
        'designer.contract': contract,
        'pm.project': projects
      })
    } else {
      reportError.value = messageOf(reportResult.reason)
    }

    if (queueResult.status === 'fulfilled') {
      queue.value = queueResult.value
    } else {
      queueError.value = messageOf(queueResult.reason)
    }

    loading.value = false
  }

  function open(route: string): void {
    if (route) void router.push(route)
  }

  return {
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
    todayItems: queue
  }
}
