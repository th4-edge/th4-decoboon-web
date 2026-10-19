<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ProviderError } from '@/core/http'
import { blueprintApi } from '@/domains/blueprint/api'
import type { MaterialHealthIssue, MaterialHealthReport } from '@/domains/blueprint/model'
import CostIncompleteValue from '@/components/CostIncompleteValue.vue'
import EmptyState from '@/components/EmptyState.vue'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StatusTag from '@/components/StatusTag.vue'

const props = defineProps<{ projectId: string }>()
const router = useRouter()
const loading = ref(false)
const error = ref('')
const report = ref<MaterialHealthReport | null>(null)

const metrics = computed(() => {
  const value = report.value
  if (!value) return []
  return [
    { label: '材料计划', value: value.totalItems, note: `${value.selectedItems} 条已选材` },
    { label: '待下单', value: value.readyToOrder + value.partiallyOrdered, note: value.partiallyOrdered ? `${value.partiallyOrdered} 条部分下单` : '含未进入采购行' },
    { label: '待到货', value: value.pendingArrival + value.partiallyArrived, note: value.partiallyArrived ? `${value.partiallyArrived} 条部分到场` : '按计划状态派生' },
    { label: '逾期未到场', value: value.delayed, note: value.delayed ? '要求到场日已过' : '未发现逾期行' }
  ]
})

const topRisk = computed(() => report.value?.rows?.[0] || null)
const riskAction = computed<{ label: string; path: string } | null>(() => {
  const value = report.value
  const row = topRisk.value
  if (!value || !row) return null
  if (row.selectionStatus !== 'Selected') return { label: '去选材', path: '/workbench/material-selection' }
  if (['Planned', 'ReadyToOrder', 'Requested', 'Approved', 'PartiallyOrdered'].includes(row.status || '')) {
    return { label: '去下单', path: '/finance/material-ordering' }
  }
  if (row.delayed || ['Ordered', 'PartiallyArrived'].includes(row.status || '')) {
    return { label: '查看采购进度', path: '/finance/material-ordering' }
  }
  if (!value.costComplete) return { label: '去结算', path: '/finance/material-settlement' }
  return null
})

const stageTone = computed<'done' | 'progress' | 'pending' | 'alert' | 'info'>(() => {
  switch (report.value?.stageKey) {
    case 'selection': return 'pending'
    case 'purchase-order': return 'progress'
    case 'receipt': return 'alert'
    case 'settlement': return report.value?.costComplete ? 'done' : 'pending'
    default: return 'info'
  }
})

function severityLabel(severity: string): string {
  if (severity === 'P0') return '高'
  if (severity === 'P1') return '中'
  return '低'
}

function severityTone(issue: MaterialHealthIssue): 'blocked' | 'alert' | 'pending' | 'info' {
  if (issue.severity === 'P0') return 'blocked'
  if (issue.severity === 'P1') return 'alert'
  if (issue.severity === 'P2') return 'pending'
  return 'info'
}

function go(path: string): void {
  void router.push(path)
}

async function load(): Promise<void> {
  if (!props.projectId) return
  loading.value = true
  error.value = ''
  try {
    report.value = await blueprintApi.check(props.projectId)
  } catch (e) {
    error.value = e instanceof ProviderError ? e.message : '材料业务体检暂不可确认'
    report.value = null
  } finally {
    loading.value = false
  }
}

watch(() => props.projectId, load)
onMounted(load)
</script>

<template>
  <PanelCard title="材料业务体检" description="先看最急材料，再看整体进度与成本。">
    <template #extra>
      <div class="mh__actions">
        <el-button size="small" :loading="loading" @click="load">刷新体检</el-button>
        <el-button size="small" @click="go('/business-blueprints')">查看材料说明</el-button>
      </div>
    </template>

    <SkeletonBlock v-if="loading && !report" variant="card" :rows="5" />

    <el-alert
      v-else-if="error"
      type="error"
      :closable="false"
      show-icon
      :title="error"
      description="材料业务暂不可确认。请稍后重试；此状态不代表项目材料已完成。"
    >
      <template #default>
        <el-button size="small" @click="load">重试</el-button>
      </template>
    </el-alert>

    <EmptyState
      v-else-if="report && !report.hasMaterialPlan"
      title="当前项目还没有可见材料计划"
      :description="`${report.stageSummary} 请先核对合同材料行或变更是否已生成材料计划。`"
      action-text="查看材料说明"
      @action="go('/business-blueprints')"
    />

    <template v-else-if="report">
      <div v-if="topRisk" class="mh__risk">
        <div class="mh__risk-head">
          <span class="mh__risk-kicker">最急材料</span>
          <StatusTag :tone="topRisk.delayed ? 'alert' : 'pending'" :text="topRisk.delayed ? '逾期' : '待处理'" />
        </div>
        <h3>{{ topRisk.materialName || '材料待确认' }} · {{ topRisk.spaceName || topRisk.category || '空间未填' }}</h3>
        <p class="mh__risk-reason">{{ topRisk.selectionStatusName || topRisk.statusName || '状态待确认' }} · {{ topRisk.nextAction || '下一步待确认' }}</p>
        <p class="mh__risk-owner">设计：{{ report.designerName || '未指派' }} · 项目：{{ report.managerName || '未指派' }}</p>
        <div class="mh__risk-actions">
          <el-button v-if="riskAction" type="primary" size="small" @click="go(riskAction.path)">{{ riskAction.label }}</el-button>
        </div>
      </div>

      <div class="mh__hero">
        <div class="mh__hero-copy">
          <div class="mh__hero-line">
            <StatusTag :tone="stageTone" :text="report.stageLabel" size="md" />
            <span class="mh__settlement">结算状态：{{ report.settlementStatus }}</span>
          </div>
          <h3>{{ report.stageSummary }}</h3>
          <p><strong>下一步：</strong>{{ report.nextAction }}</p>
        </div>
        <div class="mh__hero-actions">
          <el-button v-if="report.readyToOrder > 0 || report.partiallyOrdered > 0" type="primary" @click="go('/finance/material-ordering')">
            去主材下单
          </el-button>
          <el-button v-if="!report.costComplete" plain @click="go('/finance/material-settlement')">去主材结算</el-button>
        </div>
      </div>

      <div class="mh__metrics">
        <article v-for="item in metrics" :key="item.label" class="mh__metric">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <small>{{ item.note }}</small>
        </article>
        <article class="mh__metric mh__metric--cost">
          <span>成本完整性</span>
          <strong v-if="report.costComplete">完整</strong>
          <strong v-else class="mh__warning">未完整</strong>
          <small>{{ report.costIncompleteCount }} 项待补 · {{ report.costLabel }}</small>
        </article>
      </div>

      <div class="mh__grid">
        <section class="mh__section">
          <div class="mh__section-head">
            <h3>校核项</h3>
            <span>{{ report.issues.length }} 项</span>
          </div>
          <div v-if="report.issues.length" class="mh__issues">
            <article v-for="issue in report.issues" :key="issue.id" class="mh__issue">
              <div class="mh__issue-head">
                <strong>{{ issue.label }}</strong>
                <StatusTag :tone="severityTone(issue)" :text="`${severityLabel(issue.severity)} · ${issue.count} 项`" />
              </div>
              <p>{{ issue.evidence }}</p>
              <small>{{ issue.nextAction }}</small>
            </article>
          </div>
          <EmptyState v-else title="没有命中已登记校核项" description="不代表项目已验收；仍需核对材料数量、到场和结算金额。" />
        </section>

        <section class="mh__section">
          <div class="mh__section-head">
            <h3>成本与采购事实</h3>
            <span>{{ report.purchaseCount }} 张有效采购单</span>
          </div>
          <div class="mh__cost-grid">
            <div><span>采购应付</span><strong><MoneyText :value="report.materialCost" /></strong></div>
            <div><span>预计成本</span><strong><MoneyText :value="report.estimatedCost" /></strong></div>
            <div><span>实际成本</span><strong><MoneyText :value="report.actualCost" /></strong></div>
            <div>
              <span>项目利润</span>
              <strong>
                <CostIncompleteValue v-if="!report.costComplete" :hint="`${report.costIncompleteCount} 项成本未完整，利润不确认`" />
                <MoneyText v-else :value="report.profitAmount" />
              </strong>
            </div>
          </div>
          <p class="mh__hint">
            未定价采购：{{ report.unpricedPurchaseCount }} 张；缺少供应商：{{ report.missingSupplierCount }} 张。
            未定价不阻断履约，但成本不完整时不得展示伪利润。
          </p>
        </section>
      </div>

      <section class="mh__rows">
        <div class="mh__section-head">
          <h3>聚焦材料行</h3>
          <span>按逾期、未选材、待下单、待到货排序，最多 20 行</span>
        </div>
        <el-table :data="report.rows" show-header>
          <el-table-column label="材料 / 空间" min-width="220">
            <template #default="{ row }">
              <strong class="mh__material">{{ row.materialName || '材料待确认' }}</strong>
              <small>{{ row.spaceName || row.category || '空间未填' }}</small>
            </template>
          </el-table-column>
          <el-table-column label="计划 / 选材" min-width="180">
            <template #default="{ row }">
              <span>{{ row.statusName || '状态待确认' }}</span>
              <small class="mh__sub">{{ row.selectionStatusName || '未选材' }}</small>
            </template>
          </el-table-column>
          <el-table-column label="数量进度" min-width="160">
            <template #default="{ row }">
              <span>{{ row.orderedQuantity ?? 0 }} / {{ row.quantity ?? 0 }}</span>
              <small class="mh__sub">到场 {{ row.receivedQuantity ?? 0 }}</small>
            </template>
          </el-table-column>
          <el-table-column label="要求到场" width="130">
            <template #default="{ row }">
              <span :class="{ 'mh__warning': row.delayed }">{{ row.requiredAt || '未填' }}</span>
              <small v-if="row.delayed" class="mh__sub mh__warning">已逾期</small>
            </template>
          </el-table-column>
          <el-table-column label="采购 / 供应商" min-width="190">
            <template #default="{ row }">
              <span>{{ row.purchaseNo || '尚未采购' }}</span>
              <small class="mh__sub">{{ row.supplierName || '供应商待财务确认' }}</small>
            </template>
          </el-table-column>
          <el-table-column prop="nextAction" label="下一步" min-width="150" />
        </el-table>
        <EmptyState v-if="!report.rows.length" title="没有可展示的聚焦材料行" description="材料计划为空或已完成；请结合总览和结算状态核对。" />
      </section>
    </template>
  </PanelCard>
</template>

<style scoped lang="scss">
.mh__actions { display: flex; gap: $space-2; }
.mh__risk { padding: $space-4; border: 1px solid $warning-200; border-radius: $radius-md; background: $warning-50; }
.mh__risk-head { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.mh__risk-kicker { font-size: $font-caption; font-weight: 700; color: $warning-700; letter-spacing: 0.04em; }
.mh__risk h3 { margin: $space-2 0 0; font-size: $font-card-title; line-height: 1.45; }
.mh__risk-reason { margin: $space-2 0 0; font-size: $font-body-sm; line-height: 1.55; color: $text-secondary; }
.mh__risk-owner { margin: $space-2 0 0; font-size: $font-caption; color: $text-secondary; }
.mh__risk-actions { margin-top: $space-3; }
.mh__hero { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-4; padding: $space-4; border-radius: $radius-md; background: linear-gradient(135deg, $brand-50 0%, $surface-50 100%); }
.mh__hero-copy { min-width: 0; }
.mh__hero-line { display: flex; align-items: center; flex-wrap: wrap; gap: $space-2; }
.mh__settlement { color: $text-secondary; font-size: $font-caption; }
.mh__hero h3 { margin: $space-3 0 $space-2; font-size: $font-card-title; line-height: 1.55; }
.mh__hero p { margin: 0; color: $text-secondary; font-size: $font-body-sm; }
.mh__hero-actions { display: flex; gap: $space-2; flex-wrap: wrap; justify-content: flex-end; }
.mh__metrics { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: $space-3; margin-top: $space-3; }
.mh__metric { display: flex; flex-direction: column; gap: 2px; padding: $space-3; border: 1px solid $border-color; border-radius: $radius-sm; }
.mh__metric span, .mh__metric small { color: $text-secondary; font-size: $font-caption; }
.mh__metric strong { font-size: $font-title; font-variant-numeric: tabular-nums; }
.mh__metric--cost { background: $surface-50; }
.mh__grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: $space-4; margin-top: $space-4; }
.mh__section { min-width: 0; padding: $space-3; border: 1px solid $border-color; border-radius: $radius-sm; }
.mh__section-head { display: flex; align-items: baseline; justify-content: space-between; gap: $space-2; margin-bottom: $space-3; }
.mh__section-head h3 { margin: 0; font-size: $font-body-sm; }
.mh__section-head span { color: $text-tertiary; font-size: $font-caption; }
.mh__issues { display: flex; flex-direction: column; gap: $space-2; }
.mh__issue { padding: $space-3; border-radius: $radius-sm; background: $surface-50; }
.mh__issue-head { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.mh__issue p { margin: $space-2 0 4px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.6; }
.mh__issue small { color: $text-tertiary; font-size: $font-caption; }
.mh__cost-grid { display: grid; grid-template-columns: 1fr 1fr; gap: $space-2; }
.mh__cost-grid > div { display: flex; flex-direction: column; gap: 3px; padding: $space-3; border-radius: $radius-sm; background: $surface-50; }
.mh__cost-grid span { color: $text-secondary; font-size: $font-caption; }
.mh__hint { margin: $space-3 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.7; }
.mh__rows { margin-top: $space-4; }
.mh__material { display: block; font-size: $font-body-sm; }
.mh__sub { display: block; color: $text-tertiary; font-size: $font-caption; }
.mh__warning { color: $warning-700; font-weight: $font-weight-semibold; }

@media (max-width: 1280px) {
  .mh__metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 1024px) {
  .mh__hero { flex-direction: column; }
  .mh__hero-actions { justify-content: flex-start; }
  .mh__grid { grid-template-columns: 1fr; }
}

@media (max-width: 760px) {
  .mh__metrics, .mh__cost-grid { grid-template-columns: 1fr; }
}
</style>
