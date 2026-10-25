<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import MoneyText from '@/components/MoneyText.vue'
import StatusTag from '@/components/StatusTag.vue'
import WorkbenchState from '@/components/workbench/WorkbenchState.vue'
import { formatDateTime } from '@/core/format'
import type { ProjectFactNode, ProjectFactSourceGap, ProjectFactStage, ProjectFactTrace } from '@/domains/project/model'

const props = defineProps<{
  trace?: ProjectFactTrace | null
  error?: string
  focusAnchor?: string
  canOpen?: (node: ProjectFactNode) => boolean
}>()

const emit = defineEmits<{
  open: [node: ProjectFactNode]
  retry: []
}>()

interface StageMeta {
  key: ProjectFactStage
  label: string
}

interface FactNodeGroup {
  key: string
  primary: ProjectFactNode
  history: ProjectFactNode[]
}

interface FactStageGroup extends StageMeta {
  groups: FactNodeGroup[]
  gaps: ProjectFactSourceGap[]
  nodeCount: number
  currentCount: number
  isCurrent: boolean
  hasAttention: boolean
}

const STAGES: StageMeta[] = [
  { key: 'source', label: '来源' },
  { key: 'preSale', label: '售前' },
  { key: 'signing', label: '签约' },
  { key: 'fulfillment', label: '履约' },
  { key: 'change', label: '变更' },
  { key: 'acceptance', label: '验收' },
  { key: 'finance', label: '财务' },
  { key: 'afterSales', label: '售后' }
]

const SUMMARY_ONLY_FACT_TYPES = new Set(['MaterialPlan', 'Purchase', 'GoodsReceipt'])

const FACT_LABELS: Record<string, string> = {
  Customer: '客户',
  Property: '房屋',
  ProjectOrigin: '项目来源',
  Measure: '量房',
  Design: '设计方案',
  Quote: '报价',
  QuoteAcceptance: '报价接受',
  Contract: '合同',
  Project: '项目',
  ConstructionPlan: '施工计划',
  Stage: '施工阶段',
  Task: '施工任务',
  SiteReport: '现场日报',
  MaterialSelection: '主材选材',
  MaterialPlan: '材料计划',
  Purchase: '采购',
  GoodsReceipt: '到货',
  ContractChange: '合同变更',
  Acceptance: '阶段验收',
  Rectification: '整改',
  Reinspection: '复验',
  Receivable: '应收',
  Receipt: '收款',
  Payable: '应付',
  Payment: '付款',
  Cost: '项目成本',
  ProfitSettlement: '利润与结算',
  Delivery: '交付',
  Warranty: '质保/维保',
  Feedback: '意见投诉',
  Repurchase: '复购'
}

const expandedStages = ref<ProjectFactStage[]>([])
const expandedHistories = ref<string[]>([])

/** 服务端已按 U5 契约稳定排序，页面不得再次排序。 */
const serverNodes = computed(() => props.trace?.nodes ?? [])
const latestCurrentNode = computed(() => {
  const current = serverNodes.value.filter((node) => node.current)
  return current.length ? current[current.length - 1] : undefined
})

const stageGroups = computed<FactStageGroup[]>(() => STAGES.map((stage) => {
  const nodes = serverNodes.value.filter((node) => node.stage === stage.key)
  const groups = groupNodes(nodes)
  const gaps = (props.trace?.sourceGaps ?? []).filter((gap) => gap.stage === stage.key)
  return {
    ...stage,
    groups,
    gaps,
    nodeCount: nodes.length,
    currentCount: nodes.filter((node) => node.current).length,
    isCurrent: latestCurrentNode.value?.stage === stage.key,
    hasAttention: gaps.some((gap) => gap.required) || groups.some((group) => nodeNeedsAttention(group.primary))
  }
}))

const defaultExpandedStages = computed(() => stageGroups.value
  .filter((stage) => stage.isCurrent || stage.hasAttention)
  .map((stage) => stage.key))

watch([defaultExpandedStages, () => props.focusAnchor, () => props.trace], () => {
  const available = new Set(STAGES.map((stage) => stage.key))
  const retained = expandedStages.value.filter((key) => available.has(key))
  const next = new Set<ProjectFactStage>([...retained, ...defaultExpandedStages.value])

  const focus = props.focusAnchor
  if (focus) {
    const focused = serverNodes.value.find((node) => anchorId(node.nodeId) === focus)
    if (focused) {
      next.add(focused.stage)
      if (!focused.current) {
        const group = groupNodes(serverNodes.value.filter((node) => node.stage === focused.stage))
          .find((item) => item.key === focused.nodeKey)
        if (group?.primary.nodeId !== focused.nodeId) {
          expandedHistories.value = Array.from(new Set([...expandedHistories.value, focused.nodeKey]))
        }
      }
    }
  }
  expandedStages.value = Array.from(next)
}, { immediate: true })

function groupNodes(nodes: ProjectFactNode[]): FactNodeGroup[] {
  const map = new Map<string, ProjectFactNode[]>()
  for (const node of nodes) {
    map.set(node.nodeKey, [...(map.get(node.nodeKey) ?? []), node])
  }
  return Array.from(map.entries()).map(([key, grouped]) => {
    const primary = grouped.find((node) => node.current) ?? grouped[0]
    return {
      key,
      primary,
      history: grouped.filter((node) => node.nodeId !== primary.nodeId)
    }
  })
}

function anchorId(nodeId: string): string {
  return `fact-anchor-${nodeId.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

function isStageExpanded(stage: ProjectFactStage): boolean {
  return expandedStages.value.includes(stage)
}

function toggleStage(stage: ProjectFactStage): void {
  expandedStages.value = isStageExpanded(stage)
    ? expandedStages.value.filter((item) => item !== stage)
    : [...expandedStages.value, stage]
}

function isHistoryExpanded(key: string): boolean {
  return expandedHistories.value.includes(key)
}

function toggleHistory(key: string): void {
  expandedHistories.value = isHistoryExpanded(key)
    ? expandedHistories.value.filter((item) => item !== key)
    : [...expandedHistories.value, key]
}

function nodeNeedsAttention(node: ProjectFactNode): boolean {
  return Boolean(node.uncertainty) || node.costComplete === false
}

function stageSummary(stage: FactStageGroup): string {
  if (!stage.nodeCount && !stage.gaps.length) return '未开始'
  const parts = [`当前 ${stage.currentCount}`, `历史/失效 ${stage.nodeCount - stage.currentCount}`]
  if (stage.gaps.length) parts.push(`缺口 ${stage.gaps.length}`)
  return parts.join(' · ')
}

function stageTone(stage: FactStageGroup): 'alert' | 'pending' | 'done' | 'info' {
  if (stage.hasAttention) return 'alert'
  if (stage.isCurrent) return 'pending'
  return stage.nodeCount ? 'done' : 'info'
}

function stageTag(stage: FactStageGroup): string {
  if (stage.hasAttention) return '需关注'
  if (stage.isCurrent) return '当前'
  return stage.nodeCount ? '已有事实' : '未开始'
}

function nodeTagText(node: ProjectFactNode): string {
  if (!node.current) return '历史/失效'
  if (node.costComplete === false) return '成本未完整'
  if (node.uncertainty) return '暂不可确认'
  return node.statusName || ''
}

function nodeTone(node: ProjectFactNode): 'alert' | 'dark' | 'info' | 'done' {
  if (!node.current) return 'dark'
  if (node.costComplete === false || node.uncertainty) return 'alert'
  return node.statusName ? 'info' : 'done'
}

function factLabel(node: ProjectFactNode): string {
  return FACT_LABELS[node.factType] || node.factTypeName || node.factType || '项目事实'
}

function nodeTime(node: ProjectFactNode): string {
  if (node.businessTime) return formatDateTime(node.businessTime)
  if (node.recordedAt) return `业务时间暂不可确认 · 记录 ${formatDateTime(node.recordedAt)}`
  return '业务时间暂不可确认'
}

function canOpenNode(node: ProjectFactNode): boolean {
  return props.canOpen ? props.canOpen(node) : Boolean(node.navigationPath)
}

function isSummaryOnly(node: ProjectFactNode): boolean {
  return SUMMARY_ONLY_FACT_TYPES.has(node.factType) && !canOpenNode(node)
}

function openNode(node: ProjectFactNode): void {
  if (!canOpenNode(node)) return
  emit('open', node)
}
</script>

<template>
  <div class="pfact">
    <header class="pfact__head">
      <div>
        <h3>项目事实链 · PHASE</h3>
        <p>按阶段查看当前事实、来源缺口和历史版本；金额与进度均来自业务记录。</p>
      </div>
      <StatusTag tone="info" text="PHASE" />
    </header>

    <WorkbenchState
      v-if="!trace"
      variant="error"
      title="项目事实暂不可确认"
      :description="error || '请重新读取项目事实；系统不会用空列表表示没有事实。'"
      action-text="重新读取"
      @action="emit('retry')"
    />

    <template v-else>
      <div class="pfact__meta">
        <span>{{ trace.projectName || trace.projectNo || trace.projectId }}</span>
        <span v-if="trace.asOf">读取于 {{ formatDateTime(trace.asOf) }}</span>
        <span>{{ serverNodes.length }} 个事实节点</span>
        <span v-if="trace.sourceGaps.length">{{ trace.sourceGaps.length }} 个来源缺口</span>
      </div>

      <section
        v-for="stage in stageGroups"
        :key="stage.key"
        class="pfact-stage"
        :class="{ 'is-current': stage.isCurrent, 'has-attention': stage.hasAttention }"
      >
        <button type="button" class="pfact-stage__head" @click="toggleStage(stage.key)">
          <span class="pfact-stage__index">{{ String(STAGES.findIndex((item) => item.key === stage.key) + 1).padStart(2, '0') }}</span>
          <span class="pfact-stage__title">
            <strong>{{ stage.label }}</strong>
            <small>{{ stageSummary(stage) }}</small>
          </span>
          <StatusTag :tone="stageTone(stage)" :text="stageTag(stage)" />
          <span class="pfact-stage__toggle">{{ isStageExpanded(stage.key) ? '收起' : '展开' }}</span>
        </button>

        <div v-if="isStageExpanded(stage.key)" class="pfact-stage__body">
          <div v-if="stage.groups.length" class="pfact-grid">
            <article
              v-for="group in stage.groups"
              :id="anchorId(group.primary.nodeId)"
              :key="group.key"
              class="pfact-card"
              :class="{ 'is-history-primary': !group.primary.current, 'needs-attention': nodeNeedsAttention(group.primary) }"
            >
              <header class="pfact-card__head">
                <div>
                  <span class="pfact-card__type">{{ factLabel(group.primary) }}<template v-if="group.primary.version"> · V{{ group.primary.version }}</template></span>
                  <h4>{{ group.primary.title || factLabel(group.primary) }}</h4>
                </div>
                <StatusTag v-if="nodeTagText(group.primary)" :tone="nodeTone(group.primary)" :text="nodeTagText(group.primary)" />
              </header>

              <p v-if="group.primary.summary" class="pfact-card__summary">{{ group.primary.summary }}</p>
              <p class="pfact-card__time">{{ nodeTime(group.primary) }}<template v-if="group.primary.actorName"> · {{ group.primary.actorName }}</template><template v-if="group.primary.sourceLabel"> · {{ group.primary.sourceLabel }}</template></p>

              <div v-if="group.primary.amount != null || group.primary.quantity != null || group.primary.progress != null" class="pfact-card__metrics">
                <span v-if="group.primary.amount != null"><small>金额</small><MoneyText :value="group.primary.amount" size="sm" /></span>
                <span v-if="group.primary.quantity != null"><small>数量</small><strong>{{ group.primary.quantity }}</strong></span>
                <span v-if="group.primary.progress != null"><small>进度</small><strong>{{ group.primary.progress }}%</strong></span>
              </div>

              <div v-if="group.primary.profitAmount != null || group.primary.grossMargin != null" class="pfact-card__profit">
                <span v-if="group.primary.profitAmount != null"><small>结算利润</small><MoneyText :value="group.primary.profitAmount" size="sm" /></span>
                <span v-if="group.primary.grossMargin != null"><small>毛利率</small><strong>{{ group.primary.grossMargin }}%</strong></span>
              </div>

              <p v-if="group.primary.uncertainty" class="pfact-card__notice">{{ group.primary.uncertainty }}</p>

              <div v-if="group.history.length" class="pfact-history">
                <button type="button" class="pfact-history__toggle" @click="toggleHistory(group.key)">
                  历史版本 {{ group.history.length }}
                  <span>{{ isHistoryExpanded(group.key) ? '收起' : '展开' }}</span>
                </button>
                <div v-if="isHistoryExpanded(group.key)" class="pfact-history__list">
                  <div v-for="history in group.history" :id="anchorId(history.nodeId)" :key="history.nodeId" class="pfact-history__item">
                    <strong>{{ history.title || factLabel(history) }}</strong>
                    <small>{{ nodeTime(history) }} · {{ history.uncertainty || '历史/失效事实' }}</small>
                    <p v-if="history.summary">{{ history.summary }}</p>
                    <button v-if="canOpenNode(history)" type="button" @click="openNode(history)">查看历史来源</button>
                  </div>
                </div>
              </div>

              <button v-if="canOpenNode(group.primary)" type="button" class="pfact-card__open" @click="openNode(group.primary)">
                查看来源
              </button>
              <p v-else-if="isSummaryOnly(group.primary)" class="pfact-card__source-note">暂无 Web 来源入口，请按摘要核对</p>
            </article>
          </div>

          <div v-for="gap in stage.gaps" :key="gap.nodeKey" class="pfact-gap">
            <div>
              <strong>{{ gap.label }}</strong>
              <StatusTag :tone="gap.required ? 'alert' : 'info'" :text="gap.required ? '必须补齐' : '可选'" />
            </div>
            <p>{{ gap.reason }}</p>
          </div>

          <p v-if="!stage.groups.length && !stage.gaps.length" class="pfact-stage__empty">本阶段尚未发生正式事实</p>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
.pfact { display: flex; flex-direction: column; gap: $space-3; }
.pfact__head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; }
.pfact__head h3 { margin: 0; color: $text-primary; font-size: $font-card-title; }
.pfact__head p { margin: $space-1 0 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.65; }
.pfact__meta { display: flex; flex-wrap: wrap; gap: $space-2 $space-4; padding: $space-2 $space-3; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-50; color: $text-tertiary; font-size: $font-caption; }
.pfact-stage { border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; overflow: hidden; }
.pfact-stage.is-current { border-color: $brand-300; }
.pfact-stage.has-attention { border-color: $warning-200; }
.pfact-stage__head { width: 100%; display: flex; align-items: center; gap: $space-3; padding: $space-3 $space-4; border: 0; background: $surface-50; color: $text-primary; text-align: left; cursor: pointer; }
.pfact-stage__index { width: 30px; color: $brand-600; font-size: $font-caption; font-weight: $font-weight-bold; font-variant-numeric: tabular-nums; }
.pfact-stage__title { flex: 1; min-width: 0; }
.pfact-stage__title strong, .pfact-stage__title small { display: block; }
.pfact-stage__title strong { font-size: $font-body; }
.pfact-stage__title small { margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }
.pfact-stage__toggle { color: $brand-600; font-size: $font-caption; }
.pfact-stage__body { padding: $space-3; border-top: 1px solid $border-color; }
.pfact-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-3; }
.pfact-card { display: flex; flex-direction: column; gap: $space-2; min-width: 0; padding: $space-3; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; scroll-margin-top: 96px; }
.pfact-card.is-history-primary { background: $surface-50; }
.pfact-card.needs-attention { border-color: $warning-200; }
.pfact-card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-2; }
.pfact-card__head h4 { margin: 3px 0 0; color: $text-primary; font-size: $font-body-sm; word-break: break-word; }
.pfact-card__type { color: $text-tertiary; font-size: $font-caption; }
.pfact-card__summary { margin: 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.65; word-break: break-word; }
.pfact-card__time { margin: 0; color: $text-tertiary; font-size: $font-caption; line-height: 1.5; }
.pfact-card__metrics, .pfact-card__profit { display: flex; flex-wrap: wrap; gap: $space-2 $space-4; padding-top: $space-2; border-top: 1px solid $border-color; }
.pfact-card__metrics span, .pfact-card__profit span { display: flex; flex-direction: column; gap: 2px; }
.pfact-card__metrics small, .pfact-card__profit small { color: $text-tertiary; font-size: $font-caption; }
.pfact-card__metrics strong, .pfact-card__profit strong { color: $text-primary; font-size: $font-body-sm; }
.pfact-card__notice { margin: 0; padding: $space-2; border-radius: $radius-sm; background: $warning-50; color: $warning-700; font-size: $font-caption; line-height: 1.55; }
.pfact-card__source-note { margin: 0; color: $text-tertiary; font-size: $font-caption; }
.pfact-card__open, .pfact-history__toggle, .pfact-history__item button { align-self: flex-start; padding: 0; border: 0; background: transparent; color: $brand-600; font: inherit; font-size: $font-caption; font-weight: $font-weight-semibold; cursor: pointer; }
.pfact-history { padding-top: $space-2; border-top: 1px solid $border-color; }
.pfact-history__toggle { display: flex; justify-content: space-between; width: 100%; color: $text-secondary; }
.pfact-history__toggle span { color: $brand-600; }
.pfact-history__list { display: flex; flex-direction: column; gap: $space-2; margin-top: $space-2; }
.pfact-history__item { padding: $space-2; border-radius: $radius-sm; background: $surface-100; scroll-margin-top: 96px; }
.pfact-history__item strong, .pfact-history__item small { display: block; }
.pfact-history__item small { margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }
.pfact-history__item p { margin: $space-1 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.55; }
.pfact-history__item button { margin-top: $space-1; }
.pfact-gap { display: flex; flex-direction: column; gap: $space-1; margin-top: $space-3; padding: $space-3; border-radius: $radius-sm; background: $warning-50; }
.pfact-gap > div { display: flex; align-items: center; gap: $space-2; }
.pfact-gap strong { color: $warning-700; font-size: $font-body-sm; }
.pfact-gap p { margin: 0; color: $text-secondary; font-size: $font-caption; line-height: 1.55; }
.pfact-stage__empty { margin: $space-2 0 0; color: $text-tertiary; font-size: $font-caption; }
@media (max-width: 1100px) { .pfact-grid { grid-template-columns: 1fr; } }
@media (max-width: 720px) { .pfact__head { flex-direction: column; } .pfact-stage__toggle { display: none; } }
</style>
