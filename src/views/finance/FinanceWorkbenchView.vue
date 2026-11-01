<script setup lang="ts">
import WorkbenchIdentityCard from '@/components/workbench/WorkbenchIdentityCard.vue'
import { onMounted, ref, watch } from 'vue'
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
import { useFinanceScopeStore } from '@/stores/financeScope'

const scope = useFinanceScopeStore()

const router = useRouter()
const { canWrite, readOnly } = useFinanceAccess()
const summary = ref<FinanceSummary | null>(null)
const loading = ref(false)
const error = ref('')
const receivableVisible = ref(false)
const collectionVisible = ref(false)
const payableVisible = ref(false)
const paymentVisible = ref(false)

onMounted(load)

/**
 * 门店维度（DEC-067 / P1-a）：切换「全部门店 ↔ 单店」后按门店重新取数，
 * 全部门店时不传 `storeId`（绝不传状态值 '0'）。
 */
watch(() => scope.requestStoreId, () => { void load() })

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    summary.value = await financeApi.summary(scope.requestStoreId ?? undefined)
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
        <h1>财务工作台</h1>
      </div>
      <div class="finance-actions">
        <FinanceMetricGlossary />
        <el-button @click="load">刷新</el-button>
        <el-button v-if="readOnly" plain disabled>本店财务只读</el-button>
        <el-dropdown v-if="canWrite">
          <el-button type="primary">登记收付款</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="receivableVisible = true">新增其他应收</el-dropdown-item>
              <el-dropdown-item @click="collectionVisible = true">登记客户收款</el-dropdown-item>
              <el-dropdown-item divided @click="payableVisible = true">新增手工应付</el-dropdown-item>
              <el-dropdown-item @click="paymentVisible = true">安排业务付款</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <WorkbenchIdentityCard />

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default>
        <el-button size="small" plain @click="load">重新加载</el-button>
      </template>
    </el-alert>

    <section v-if="loading && !summary" class="finance-overview finance-overview--loading">
      <SkeletonBlock v-for="index in 4" :key="index" variant="card" :rows="3" />
    </section>

    <section v-else-if="summary" class="finance-overview" aria-label="财务经营摘要">
      <div class="finance-overview__lead">
        <span>当前账面现金余额</span>
        <strong><MoneyText :value="summary.cashBalance" size="kpi" /></strong>
        <small v-if="!summary.openingBalanceCaptured" class="finance-overview__notice">期初未承接，余额为过程参考</small>
      </div>
      <button class="finance-overview__item" type="button" @click="router.push('/finance/receivables')">
        <span>待收工程款</span>
        <strong><MoneyText :value="summary.outstandingAmount" size="lg" /></strong>
        <small>逾期 {{ formatCompact(summary.overdueAmount) }} · 临期 {{ summary.dueSoonReceivables.length }} 笔</small>
      </button>
      <button class="finance-overview__item" type="button" @click="router.push('/finance/payables')">
        <span>待付账款</span>
        <strong><MoneyText :value="summary.unpaidAmount" size="lg" /></strong>
        <small>紧急 {{ formatCompact(summary.urgentPayableAmount) }} · {{ summary.urgentPayables.length }} 笔</small>
      </button>
      <div class="finance-overview__item finance-overview__item--result">
        <span>项目经营结果</span>
        <strong>
          <template v-if="!summary.costComplete">
            <CostIncompleteValue :hint="`${summary.costIncompleteProjectCount} 个项目、${summary.costIncompleteItemCount} 项成本未完整`" />
          </template>
          <MoneyText v-else :value="summary.profitAmount" size="lg" />
        </strong>
        <small>{{ summary.costComplete ? '成本已完整' : `${summary.costIncompleteProjectCount} 个项目成本未完整` }}</small>
      </div>
    </section>

    <div class="finance-grid-2">
      <PanelCard title="逾期催收" flush>
        <template #extra>
          <el-button text type="primary" @click="router.push('/finance/receivables')">全部应收</el-button>
        </template>
        <SkeletonBlock v-if="loading && !summary" variant="table" :rows="5" />
        <EmptyState v-else-if="!summary" title="逾期催收暂不可确认" description="财务汇总读取失败，请重新加载。" />
        <EmptyState v-else-if="!summary.overdueReceivables.length" title="没有逾期应收" description="当前暂未获取逾期应收。" />
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

      <PanelCard title="优先付款" flush>
        <template #extra>
          <el-button text type="primary" @click="router.push('/finance/payables')">全部应付</el-button>
        </template>
        <SkeletonBlock v-if="loading && !summary" variant="table" :rows="5" />
        <EmptyState v-else-if="!summary" title="优先付款暂不可确认" description="财务汇总读取失败，请重新加载。" />
        <EmptyState v-else-if="!summary.urgentPayables.length" title="没有紧急应付" description="当前暂未获取紧急或逾期应付。" />
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

    <section v-if="summary" class="finance-month-summary" aria-label="本月资金摘要">
      <header>
        <h2>本月资金</h2>
        <span>本月收款 {{ summary.monthReceiptCount }} 笔 · 本月付款 {{ summary.monthPaymentCount }} 笔</span>
      </header>
      <div class="finance-month-summary__grid">
        <div><span>本月回款</span><strong><MoneyText :value="summary.monthReceiptAmount" /></strong></div>
        <div><span>资金收入</span><strong><MoneyText :value="summary.monthIncome" /></strong></div>
        <div><span>资金支出</span><strong><MoneyText :value="summary.monthExpense" /></strong></div>
        <div><span>现金流</span><strong><MoneyText :value="summary.monthNetCashFlowAmount" /></strong></div>
      </div>
    </section>

    <PanelCard title="最近资金台账" flush>
      <template #extra>
        <el-button text type="primary" @click="router.push('/finance/ledger')">进入资金台账</el-button>
      </template>
      <EmptyState v-if="!summary" title="最近资金台账暂不可确认" description="财务汇总读取失败，请重新加载。" />
      <EmptyState v-else-if="!summary.recentLedgers.length" title="暂无资金流水" description="登记收款、付款或手工记账后，台账会在这里出现。" />
      <el-table v-else :data="summary.recentLedgers.slice(0, 5)" stripe>
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
.finance-overview {
  display: grid;
  grid-template-columns: minmax(260px, 1.35fr) repeat(3, minmax(160px, 1fr));
  gap: $space-4;
  padding: $space-5;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: linear-gradient(125deg, $brand-50 0%, $surface-0 70%);
  box-shadow: $shadow-card;
}

.finance-overview--loading { background: $surface-0; }

.finance-overview__lead,
.finance-overview__item {
  min-width: 0;

  span,
  small {
    display: block;
    color: $text-secondary;
    font-size: $font-caption;
  }

  strong {
    display: block;
    margin: $space-2 0 $space-1;
    font-size: $font-title;
    font-variant-numeric: tabular-nums;
  }
}

.finance-overview__lead strong { font-size: $font-hero; line-height: 1; }
.finance-overview__notice { color: $warning-700 !important; line-height: 1.5; }

.finance-overview__item {
  padding: 0;
  border: 0;
  background: transparent;
  color: $text-primary;
  text-align: left;
}

button.finance-overview__item {
  cursor: pointer;
}

button.finance-overview__item:hover span { color: $brand-600; }

.finance-overview__item--result { cursor: default; }

.finance-month-summary {
  display: flex;
  align-items: center;
  gap: $space-5;
  padding: $space-3 $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
}

.finance-month-summary header { flex: 0 0 200px; }
.finance-month-summary h2 { margin: 0; font-size: $font-body-sm; }
.finance-month-summary header span { display: block; margin-top: $space-1; color: $text-secondary; font-size: $font-caption; }
.finance-month-summary__grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: $space-3; flex: 1; }
.finance-month-summary__grid div { min-width: 0; }
.finance-month-summary__grid span { display: block; color: $text-secondary; font-size: $font-caption; }
.finance-month-summary__grid strong { display: block; margin-top: $space-1; font-size: $font-body-sm; font-variant-numeric: tabular-nums; }

@media (max-width: 1280px) {
  .finance-overview { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .finance-overview__lead { grid-column: 1 / -1; }
  .finance-month-summary { align-items: flex-start; flex-direction: column; gap: $space-3; }
  .finance-month-summary header { flex: none; }
  .finance-month-summary__grid { width: 100%; }
}

@media (max-width: 900px) {
  .finance-overview { grid-template-columns: 1fr; }
  .finance-overview__lead { grid-column: auto; }
  .finance-month-summary__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
