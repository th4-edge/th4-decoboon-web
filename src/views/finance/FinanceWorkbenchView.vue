<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import { useFinanceAccess } from '@/domains/finance/access'
import type { FinanceSummary, Payable, Receivable } from '@/domains/finance/model'
import { PAYABLE_STATUS_META, PAYABLE_TYPE_META, RECEIVABLE_STATUS_META } from '@/domains/finance/meta'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import CostIncompleteValue from '@/components/CostIncompleteValue.vue'
import FinanceReceivableDrawer from '@/components/finance/FinanceReceivableDrawer.vue'
import FinanceCollectionDrawer from '@/components/finance/FinanceCollectionDrawer.vue'
import FinancePayableDrawer from '@/components/finance/FinancePayableDrawer.vue'
import FinancePaymentDrawer from '@/components/finance/FinancePaymentDrawer.vue'
import FinanceMetricGlossary from '@/components/finance/FinanceMetricGlossary.vue'

const router = useRouter()
const { canWrite, readOnly } = useFinanceAccess()
const summary = ref<FinanceSummary | null>(null)
const loading = ref(false)
const error = ref('')
const receivableVisible = ref(false)
const collectionVisible = ref(false)
const payableVisible = ref(false)
const paymentVisible = ref(false)

const metrics = computed(() => {
  if (!summary.value) return []
  return [
    { key: 'outstanding', label: '待收工程款', value: summary.value.outstandingAmount, hint: `逾期 ${formatCompact(summary.value.overdueAmount)} · 回款率 ${summary.value.collectionRate}%` },
    { key: 'receipt', label: '本月回款', value: summary.value.monthReceiptAmount, hint: `累计收款 ${formatCompact(summary.value.receiptAmount)}` },
    { key: 'payable', label: '待付账款', value: summary.value.unpaidAmount, hint: `其中工资 ${formatCompact(summary.value.salaryPayableAmount)}` },
    { key: 'cash', label: '本月现金流', value: summary.value.monthNetCashFlowAmount, hint: `资金收入 ${formatCompact(summary.value.monthIncome)} · 资金支出 ${formatCompact(summary.value.monthExpense)}` }
  ]
})

onMounted(load)

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    summary.value = await financeApi.summary()
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '财务工作台暂不可确认'
  } finally {
    loading.value = false
  }
}

function formatCompact(value: number): string {
  return `¥${value.toFixed(2)}`
}

function openProject(projectId?: string): void {
  if (projectId) void router.push(`/finance/projects/${projectId}`)
}

function collect(item: Receivable): void {
  selectedReceivable.value = item
  collectionVisible.value = true
}

function pay(item: Payable): void {
  selectedPayable.value = item
  paymentVisible.value = true
}

const selectedReceivable = ref<Receivable | null>(null)
const selectedPayable = ref<Payable | null>(null)
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">FINANCE · 项目经营与资金</span>
        <h1>财务工作台</h1>
        <p>第一眼先看<strong>账上还有多少钱</strong>（现金余额）。期初未承接时余额只作过程参考；正式状态、金额、核销、成本完整性与利润全部以服务端事实为准。</p>
      </div>
      <div class="finance-actions">
        <el-button @click="load">刷新事实</el-button>
        <el-button v-if="readOnly" plain disabled>本店财务只读</el-button>
        <el-dropdown v-if="canWrite">
          <el-button type="primary">登记资金事实</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="receivableVisible = true">新增应收节点</el-dropdown-item>
              <el-dropdown-item @click="collectionVisible = true">登记客户收款</el-dropdown-item>
              <el-dropdown-item divided @click="payableVisible = true">新增应付成本</el-dropdown-item>
              <el-dropdown-item @click="paymentVisible = true">安排业务付款</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default>
        <el-button size="small" plain @click="load">重新加载</el-button>
      </template>
    </el-alert>

    <section v-if="loading && !summary" class="finance-kpis">
      <SkeletonBlock v-for="index in 4" :key="index" variant="card" :rows="3" />
    </section>

    <section v-else-if="summary" class="finance-hero" aria-label="财务经营摘要">
      <div class="finance-hero__lead">
        <span>当前账面现金余额</span>
        <strong><MoneyText :value="summary.cashBalance" size="lg" /></strong>
        <small v-if="!summary.openingBalanceCaptured" class="finance-hero__notice">期初未承接，余额为过程参考</small>
        <small v-else>
          {{ summary.activeProjectCount }} / {{ summary.projectCount }} 个在跑项目 ·
          合同 {{ formatCompact(summary.contractAmount) }} · 实际成本 {{ formatCompact(summary.actualCost) }}
        </small>
      </div>
      <div v-for="metric in metrics" :key="metric.key" class="finance-metric">
        <span>{{ metric.label }}</span>
        <strong><MoneyText :value="metric.value" size="lg" /></strong>
        <small>{{ metric.hint }}</small>
      </div>
    </section>

    <section class="finance-kpis" aria-label="财务关键指标">
      <article class="finance-kpi">
        <span>应收与逾期</span>
        <strong>{{ summary?.urgentReceivables.length ?? '—' }}</strong>
        <small>待收 {{ formatCompact(summary?.outstandingAmount ?? 0) }}，逾期 {{ formatCompact(summary?.overdueAmount ?? 0) }} · 临期 {{ summary?.dueSoonReceivables.length ?? 0 }} 笔</small>
      </article>
      <article class="finance-kpi">
        <span>应付与到期</span>
        <strong>{{ summary?.urgentPayables.length ?? '—' }}</strong>
        <small>待付 {{ formatCompact(summary?.unpaidAmount ?? 0) }}，紧急 {{ formatCompact(summary?.urgentPayableAmount ?? 0) }}</small>
      </article>
      <article class="finance-kpi">
        <span>本月收付笔数</span>
        <strong>{{ (summary?.receiptCount ?? 0) + (summary?.paymentCount ?? 0) }}</strong>
        <small>收款 {{ summary?.receiptCount ?? 0 }} 笔 · 付款 {{ summary?.paymentCount ?? 0 }} 笔</small>
      </article>
      <article class="finance-kpi">
        <span>项目经营结果</span>
        <strong>
          <template v-if="summary && !summary.costComplete">
            <CostIncompleteValue :hint="`${summary.costIncompleteProjectCount} 个项目、${summary.costIncompleteItemCount} 项成本未完整`" />
          </template>
          <MoneyText v-else :value="summary?.profitAmount" size="lg" />
        </strong>
        <small>{{ summary?.costComplete ? `成本已完整 · 实际成本 ${formatCompact(summary?.actualCost ?? 0)}` : '成本未完整时利润不显示，禁止伪利润' }}</small>
      </article>
    </section>

    <section v-if="summary" class="finance-loop" aria-label="资金闭环">
      <header class="finance-loop__head">
        <h2>资金闭环</h2>
        <p>客户侧与供应商/员工侧各看一条：应收→已收、应付→已付。缺口取服务端同名指标（待收 / 待付），<strong>不在前端做减法</strong>。</p>
      </header>
      <div class="finance-loop__row">
        <span class="finance-loop__side">客户侧</span>
        <div class="finance-loop__node">
          <small>应收</small>
          <strong><MoneyText :value="summary.receivableAmount" /></strong>
        </div>
        <span class="finance-loop__link" aria-hidden="true">→</span>
        <div class="finance-loop__node finance-loop__node--gap">
          <small>待收（未收余额）</small>
          <strong><MoneyText :value="summary.outstandingAmount" /></strong>
        </div>
        <span class="finance-loop__link" aria-hidden="true">→</span>
        <div class="finance-loop__node finance-loop__node--done">
          <small>已收</small>
          <strong><MoneyText :value="summary.receivedAmount" /></strong>
        </div>
        <span class="finance-loop__rate">回款率 {{ summary.collectionRate }}%</span>
      </div>
      <div class="finance-loop__row">
        <span class="finance-loop__side">供应商 / 员工侧</span>
        <div class="finance-loop__node">
          <small>应付</small>
          <strong><MoneyText :value="summary.payableAmount" /></strong>
        </div>
        <span class="finance-loop__link" aria-hidden="true">→</span>
        <div class="finance-loop__node finance-loop__node--gap">
          <small>待付（未付余额）</small>
          <strong><MoneyText :value="summary.unpaidAmount" /></strong>
        </div>
        <span class="finance-loop__link" aria-hidden="true">→</span>
        <div class="finance-loop__node finance-loop__node--done">
          <small>已付</small>
          <strong><MoneyText :value="summary.paidAmount" /></strong>
        </div>
        <span class="finance-loop__rate">其中工资 {{ formatCompact(summary.salaryPayableAmount ?? 0) }}</span>
      </div>
    </section>

    <div class="finance-grid-2">
      <PanelCard title="逾期催收" description="逾期应收优先，直接登记收款并核销；临期应收单独提示。" flush>
        <template #extra>
          <el-button text type="primary" @click="router.push('/finance/receivables')">全部应收</el-button>
        </template>
        <SkeletonBlock v-if="loading && !summary" variant="table" :rows="5" />
        <EmptyState v-else-if="!summary?.overdueReceivables.length" title="没有逾期应收" description="服务端当前未返回逾期应收。" />
        <div v-else class="finance-list">
          <div v-for="item in summary.overdueReceivables" :key="item.id" class="finance-list__row">
            <button class="finance-list__main" type="button" @click="openProject(item.project.id)">
              <strong>{{ item.name }}</strong>
              <span>{{ item.project.name }} · {{ item.dueDate }} 到期</span>
            </button>
            <StatusTag :text="RECEIVABLE_STATUS_META[item.status].label" :tone="RECEIVABLE_STATUS_META[item.status].tone" />
            <MoneyText :value="item.outstandingAmount" />
            <el-button v-if="canWrite" size="small" type="primary" plain @click="collect(item)">登记收款</el-button>
          </div>
        </div>
        <template v-if="summary?.dueSoonReceivables.length">
          <p class="finance-section-label">临期应收（7 天内）</p>
          <div class="finance-list">
            <div v-for="item in summary.dueSoonReceivables" :key="item.id" class="finance-list__row">
              <button class="finance-list__main" type="button" @click="openProject(item.project.id)">
                <strong>{{ item.name }}</strong>
                <span>{{ item.project.name }} · {{ item.dueDate }} 到期</span>
              </button>
              <StatusTag :text="RECEIVABLE_STATUS_META[item.status].label" :tone="RECEIVABLE_STATUS_META[item.status].tone" />
              <MoneyText :value="item.outstandingAmount" />
              <el-button v-if="canWrite" size="small" type="primary" plain @click="collect(item)">登记收款</el-button>
            </div>
          </div>
        </template>
      </PanelCard>

      <PanelCard title="优先付款" description="紧急、逾期和临期应付优先，付款后自动核销并写台账。" flush>
        <template #extra>
          <el-button text type="primary" @click="router.push('/finance/payables')">全部应付</el-button>
        </template>
        <SkeletonBlock v-if="loading && !summary" variant="table" :rows="5" />
        <EmptyState v-else-if="!summary?.urgentPayables.length" title="没有紧急应付" description="服务端当前未返回紧急或逾期应付。" />
        <div v-else class="finance-list">
          <div v-for="item in summary.urgentPayables" :key="item.id" class="finance-list__row">
            <button class="finance-list__main" type="button" @click="openProject(item.project?.id)">
              <strong>{{ item.name }}</strong>
              <span>{{ PAYABLE_TYPE_META[item.type].label }} · {{ item.payeeName || '收款方未填' }} · {{ item.dueDate }}</span>
            </button>
            <StatusTag :text="PAYABLE_STATUS_META[item.status].label" :tone="PAYABLE_STATUS_META[item.status].tone" />
            <MoneyText :value="item.outstandingAmount" />
            <el-button v-if="canWrite" size="small" type="primary" plain :disabled="!item.outstandingAmount" @click="pay(item)">安排付款</el-button>
          </div>
        </div>
      </PanelCard>
    </div>

    <FinanceMetricGlossary />

    <PanelCard title="最近资金台账" description="收付款、手工记账和冲正记录统一留痕。" flush>
      <template #extra>
        <el-button text type="primary" @click="router.push('/finance/ledger')">进入资金台账</el-button>
      </template>
      <EmptyState v-if="!summary?.recentLedgers.length" title="暂无资金流水" description="登记收款、付款或手工记账后，台账会在这里出现。" />
      <el-table v-else :data="summary.recentLedgers" stripe>
        <el-table-column prop="occurredAt" label="发生日期" width="120" />
        <el-table-column label="方向" width="80">
          <template #default="{ row }">
            <StatusTag :tone="row.direction === 'income' ? 'done' : 'blocked'" :text="row.direction === 'income' ? '收入' : '支出'" />
          </template>
        </el-table-column>
        <el-table-column prop="summary" label="摘要" min-width="180" show-overflow-tooltip />
        <el-table-column label="项目" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.project?.name || '企业通用' }}</template>
        </el-table-column>
        <el-table-column prop="category" label="分类" min-width="120" />
        <el-table-column label="金额" width="150" align="right">
          <template #default="{ row }">
            <MoneyText :value="row.direction === 'income' ? row.amount : -row.amount" delta />
          </template>
        </el-table-column>
      </el-table>
    </PanelCard>

    <FinanceReceivableDrawer v-model:visible="receivableVisible" @saved="load" />
    <FinanceCollectionDrawer v-model:visible="collectionVisible" :receivable-id="selectedReceivable?.id" :project-id="selectedReceivable?.project.id" @saved="load" />
    <FinancePayableDrawer v-model:visible="payableVisible" @saved="load" />
    <FinancePaymentDrawer v-model:visible="paymentVisible" :payable-id="selectedPayable?.id" :project-id="selectedPayable?.project?.id" @saved="load" />
  </div>
</template>

<style scoped lang="scss">
.finance-list__main {
  padding: 0;
  color: $text-primary;
  background: transparent;
  border: 0;
  text-align: left;
  cursor: pointer;
}
</style>

<style scoped lang="scss">
.finance-hero__notice { color: $warning-700; }
</style>

<style scoped lang="scss">
.finance-loop { display: flex; flex-direction: column; gap: $space-3; padding: $space-4; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.finance-loop__head h2 { margin: 0; font-size: $font-card-title; }
.finance-loop__head p { margin: $space-1 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.7; }
.finance-loop__row { display: flex; align-items: center; gap: $space-3; flex-wrap: wrap; padding: $space-3 0; border-top: 1px solid $border-color; }
.finance-loop__side { min-width: 108px; color: $text-tertiary; font-size: $font-caption; font-weight: $font-weight-semibold; }
.finance-loop__node { display: flex; flex-direction: column; gap: 2px; min-width: 150px; padding: $space-2 $space-3; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-50; }
.finance-loop__node small { color: $text-tertiary; font-size: $font-caption; }
.finance-loop__node--gap { border-color: $warning-200; background: $warning-50; }
.finance-loop__node--done { border-color: $success-500; background: $surface-0; }
.finance-loop__link { color: $text-tertiary; font-size: $font-body; }
.finance-loop__rate { margin-left: auto; color: $text-secondary; font-size: $font-caption; }
</style>
