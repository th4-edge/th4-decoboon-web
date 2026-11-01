<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ProviderError } from '@/core/http'
import { formatDateTime } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import { useFinanceAccess } from '@/domains/finance/access'
import { ACCOUNT_LABEL, PAYABLE_TYPE_META } from '@/domains/finance/meta'
import type { FinancePaymentReport, Payment } from '@/domains/finance/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import FinancePaymentDrawer from '@/components/finance/FinancePaymentDrawer.vue'
import WorkerPicker from '@/components/picker/WorkerPicker.vue'
import { useFinanceScopeStore } from '@/stores/financeScope'

const scope = useFinanceScopeStore()

const route = useRoute()
const { canWrite, readOnly } = useFinanceAccess()
const items = ref<Payment[]>([])
const loading = ref(false)
const error = ref('')
const report = ref<FinancePaymentReport | null>(null)
const reportLoading = ref(false)
const reportError = ref('')
const keyword = ref('')
const projectId = ref('')
const page = ref(1)
const pageSize = 50
const total = ref(0)
const drawerVisible = ref(false)
const workerDialogVisible = ref(false)
const selectedWorkerId = ref('')
const backfillingPayment = ref<Payment | null>(null)
const backfillError = ref('')
const backfilling = ref(false)

onMounted(() => {
  projectId.value = String(route.query.projectId ?? '')
  void load()
})

/**
 * 门店维度（DEC-067 / P1-a）：切换「全部门店 ↔ 单店」后按门店重新取数，
 * 全部门店时不传 `storeId`（绝不传状态值 '0'）。
 */
watch(() => scope.requestStoreId, () => { page.value = 1; void load() })

async function load(): Promise<void> {
  await Promise.all([loadList(), loadReport()])
}

async function loadList(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const result = await financeApi.payments({
      projectId: projectId.value || undefined,
      keyword: keyword.value.trim() || undefined,
      storeId: scope.requestStoreId ?? undefined,
      current: page.value,
      size: pageSize
    })
    items.value = result.list
    total.value = result.total
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '付款记录暂不可确认'
  } finally {
    loading.value = false
  }
}

async function loadReport(): Promise<void> {
  reportLoading.value = true
  reportError.value = ''
  try {
    report.value = await financeApi.paymentReport({
      projectId: projectId.value || undefined,
      keyword: keyword.value.trim() || undefined,
      storeId: scope.requestStoreId ?? undefined
    })
  } catch (loadError) {
    report.value = null
    reportError.value = loadError instanceof ProviderError ? loadError.message : '付款汇总暂不可确认'
  } finally {
    reportLoading.value = false
  }
}

function resetAndLoad(): void {
  page.value = 1
  void load()
}

function isWorkerPending(value: unknown): boolean {
  const item = value as Payment
  return item.payable?.type === 'salary' && !item.worker
}

function payableTypeLabel(value: unknown): string {
  const item = value as Payment
  return item.payable ? PAYABLE_TYPE_META[item.payable.type].label : '—'
}

function accountLabel(value: unknown): string {
  const item = value as Payment
  return ACCOUNT_LABEL[item.account]
}

function openWorkerDialog(value: unknown): void {
  const item = value as Payment
  backfillingPayment.value = item
  selectedWorkerId.value = ''
  backfillError.value = ''
  workerDialogVisible.value = true
}

async function confirmBackfill(): Promise<void> {
  if (!backfillingPayment.value || !selectedWorkerId.value) {
    backfillError.value = '请选择要补录的工人'
    return
  }
  backfilling.value = true
  backfillError.value = ''
  try {
    await financeApi.updatePaymentWorker(backfillingPayment.value.id, selectedWorkerId.value)
    ElMessage.success('工人已补录，已有工资凭证按原记录重打')
    workerDialogVisible.value = false
    await load()
  } catch (submitError) {
    backfillError.value = submitError instanceof ProviderError ? submitError.message : '补录失败，暂不可确认'
  } finally {
    backfilling.value = false
  }
}
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">付款核销</span>
        <h1>付款记录</h1>
        <p>核对每笔付款、账户、收款方和交易号；工人工资未关联工人时，可补录并沿用原凭证号重打。</p>
      </div>
      <div class="finance-actions">
        <el-button @click="load">刷新</el-button>
        <el-button v-if="readOnly" plain disabled>本店财务只读</el-button>
        <el-button v-if="canWrite" type="primary" @click="drawerVisible = true">安排业务付款</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <el-alert v-if="reportError" type="warning" :closable="false" title="付款汇总暂不可确认" show-icon />

    <section class="finance-kpis">
      <article class="finance-kpi">
        <span>付款总额</span>
        <strong><MoneyText :value="report?.paymentAmount" size="lg" /></strong>
        <small>{{ reportLoading ? '汇总加载中…' : '当前筛选条件下的全部匹配付款' }}</small>
      </article>
      <article class="finance-kpi">
        <span>付款笔数</span>
        <strong>{{ reportLoading ? '统计中…' : report ? report.paymentCount : '暂不可确认' }}</strong>
        <small>数据截止 {{ formatDateTime(report?.asOf) }}</small>
      </article>
      <article class="finance-kpi">
        <span>资金台账</span>
        <strong>已写入</strong>
        <small>付款核销后形成唯一资金记录</small>
      </article>
      <article class="finance-kpi">
        <span>工资凭证</span>
        <strong>可补录</strong>
        <small>工人工资付款可关联个人工人</small>
      </article>
    </section>

    <PanelCard flush>
      <div class="finance-toolbar">
        <el-input v-model="keyword" clearable placeholder="搜索收款方 / 项目 / 交易号" style="width: 260px" @keyup.enter="resetAndLoad" @clear="resetAndLoad" />
        <el-button @click="resetAndLoad">应用筛选</el-button>
        <span class="finance-toolbar__spacer" />
        <span class="finance-toolbar__result">{{ reportError ? '笔数暂不可确认' : reportLoading ? '统计中…' : report ? `共 ${report.paymentCount} 笔` : '笔数暂不可确认' }}</span>
      </div>

      <SkeletonBlock v-if="loading && !items.length" variant="table" :rows="6" />
      <EmptyState v-else-if="!loading && !items.length" title="暂无付款记录" description="从应付单安排付款后，这里会出现核销与资金流水。" :action-text="canWrite ? '安排业务付款' : ''" @action="drawerVisible = true" />
      <el-table v-else :data="items" stripe>
        <el-table-column label="付款事项" min-width="220">
          <template #default="{ row }">
            <div class="finance-table__main">
              <span class="finance-table__title">{{ row.payable?.name || '未关联应付单' }}</span>
              <span class="finance-table__sub">{{ row.project?.name || '企业通用费用' }} · {{ row.payeeName || '收款方未填' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="应付类型" width="110">
          <template #default="{ row }">
            {{ payableTypeLabel(row) }}
          </template>
        </el-table-column>
        <el-table-column prop="paidAt" label="付款日期" width="120" />
        <el-table-column label="付款账户" width="120">
          <template #default="{ row }">{{ accountLabel(row) }}</template>
        </el-table-column>
        <el-table-column label="工人" width="130">
          <template #default="{ row }">
            <span v-if="row.worker">{{ row.worker.name }}</span>
            <el-button v-else-if="isWorkerPending(row) && canWrite" link type="warning" @click="openWorkerDialog(row)">工人待补录</el-button>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="付款金额" width="150" align="right">
          <template #default="{ row }"><MoneyText :value="row.amount" /></template>
        </el-table-column>
        <el-table-column prop="transactionNo" label="交易号" min-width="150" show-overflow-tooltip />
      </el-table>
      <div v-if="total > pageSize" class="finance-pagination">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="loadList" />
      </div>
    </PanelCard>

    <FinancePaymentDrawer v-model:visible="drawerVisible" :project-id="projectId" @saved="load" />

    <el-dialog v-model="workerDialogVisible" title="补录发放工人" width="560px" destroy-on-close>
      <p class="finance-drawer__hint">只关联 Payment.worker，不修改金额、账户、日期、应付核销和台账；已有工资凭证按原凭证号重打。</p>
      <el-alert v-if="backfillError" type="error" :closable="false" :title="backfillError" show-icon />
      <WorkerPicker v-model="selectedWorkerId" />
      <template #footer>
        <el-button @click="workerDialogVisible = false">取消</el-button>
        <el-button v-if="canWrite" type="primary" :loading="backfilling" @click="confirmBackfill">确认补录</el-button>
      </template>
    </el-dialog>
  </div>
</template>
