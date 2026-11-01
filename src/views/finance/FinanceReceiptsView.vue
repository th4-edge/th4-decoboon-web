<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ProviderError } from '@/core/http'
import { formatDateTime } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import { useFinanceAccess } from '@/domains/finance/access'
import { ACCOUNT_LABEL, RECEIPT_STATUS_META } from '@/domains/finance/meta'
import type { FinanceReceiptReport, Receipt } from '@/domains/finance/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StatusTag from '@/components/StatusTag.vue'
import FinanceCollectionDrawer from '@/components/finance/FinanceCollectionDrawer.vue'
import FinanceReceiptReversalDrawer from '@/components/finance/FinanceReceiptReversalDrawer.vue'
import { useFinanceScopeStore } from '@/stores/financeScope'

const scope = useFinanceScopeStore()

const route = useRoute()
const { canWrite, canCorrect, readOnly } = useFinanceAccess()
const items = ref<Receipt[]>([])
const loading = ref(false)
const error = ref('')
const report = ref<FinanceReceiptReport | null>(null)
const reportLoading = ref(false)
const reportError = ref('')
const keyword = ref('')
const projectId = ref('')
const page = ref(1)
const pageSize = 50
const total = ref(0)
const drawerVisible = ref(false)
const reversalVisible = ref(false)
const selectedReceipt = ref<Receipt | null>(null)

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
    const result = await financeApi.receipts({
      projectId: projectId.value || undefined,
      keyword: keyword.value.trim() || undefined,
      storeId: scope.requestStoreId ?? undefined,
      current: page.value,
      size: pageSize
    })
    items.value = result.list
    total.value = result.total
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '收款记录暂不可确认'
  } finally {
    loading.value = false
  }
}

async function loadReport(): Promise<void> {
  reportLoading.value = true
  reportError.value = ''
  try {
    report.value = await financeApi.receiptReport({
      projectId: projectId.value || undefined,
      keyword: keyword.value.trim() || undefined,
      storeId: scope.requestStoreId ?? undefined
    })
  } catch (loadError) {
    report.value = null
    reportError.value = loadError instanceof ProviderError ? loadError.message : '收款汇总暂不可确认'
  } finally {
    reportLoading.value = false
  }
}

function resetAndLoad(): void {
  page.value = 1
  void load()
}

function accountLabel(value: unknown): string {
  const item = value as Receipt
  return ACCOUNT_LABEL[item.account]
}

function receiptStatusLabel(value: unknown): string {
  return RECEIPT_STATUS_META[(value as Receipt).status].label
}

function receiptStatusTone(value: unknown) {
  return RECEIPT_STATUS_META[(value as Receipt).status].tone
}

function openReversal(value: unknown): void {
  const item = value as Receipt
  if (!canCorrect.value || item.status !== 'active') return
  selectedReceipt.value = item
  reversalVisible.value = true
}
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">回款核销</span>
        <h1>收款记录</h1>
        <p>每笔收款都保留来源应收、到账账户和经办人；如需凭证，可在资金台账选择该笔收款生成。</p>
      </div>
      <div class="finance-actions">
        <el-button @click="load">刷新</el-button>
        <el-button v-if="readOnly" plain disabled>本店财务只读</el-button>
        <el-button v-if="canWrite" type="primary" @click="drawerVisible = true">登记客户收款</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <el-alert v-if="reportError" type="warning" :closable="false" title="收款汇总暂不可确认" show-icon />

    <section class="finance-kpis">
      <article class="finance-kpi">
        <span>收款总额（含冲正）</span>
        <strong><MoneyText :value="report?.grossReceiptAmount" size="lg" /></strong>
        <small>{{ reportLoading ? '汇总加载中…' : '当前筛选条件下的全部匹配收款' }}</small>
      </article>
      <article class="finance-kpi">
        <span>有效收款</span>
        <strong><MoneyText :value="report?.receiptAmount" size="lg" /></strong>
        <small>已冲正金额不重复计入有效收款</small>
      </article>
      <article class="finance-kpi">
        <span>已冲正金额</span>
        <strong><MoneyText :value="report?.reversalAmount" size="lg" /></strong>
        <small>原始收款与冲正事实分别留痕</small>
      </article>
      <article class="finance-kpi">
        <span>收款笔数</span>
        <strong>{{ reportLoading ? '统计中…' : report ? report.receiptCount : '暂不可确认' }}</strong>
        <small>数据截止 {{ formatDateTime(report?.asOf) }}</small>
      </article>
    </section>

    <PanelCard flush>
      <div class="finance-toolbar">
        <el-input v-model="keyword" clearable placeholder="搜索付款方 / 项目 / 备注" style="width: 260px" @keyup.enter="resetAndLoad" @clear="resetAndLoad" />
        <el-button @click="resetAndLoad">应用筛选</el-button>
        <span class="finance-toolbar__spacer" />
        <span class="finance-toolbar__result">{{ reportError ? '笔数暂不可确认' : reportLoading ? '统计中…' : report ? `共 ${report.receiptCount} 笔` : '笔数暂不可确认' }}</span>
      </div>

      <SkeletonBlock v-if="loading && !items.length" variant="table" :rows="6" />
      <EmptyState v-else-if="!loading && !items.length" title="暂无收款记录" description="从应收节点登记收款后，这里会出现回款与核销记录。" :action-text="canWrite ? '登记客户收款' : ''" @action="drawerVisible = true" />
      <el-table v-else :data="items" stripe>
        <el-table-column label="收款项目" min-width="220">
          <template #default="{ row }">
            <div class="finance-table__main">
              <span class="finance-table__title">{{ row.project.name }}</span>
              <span class="finance-table__sub">{{ row.project.name || '项目待确认' }} · {{ row.payerName || '付款方未填' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="核销应收" min-width="180">
          <template #default="{ row }">{{ row.receivable?.name || '未关联应收节点' }}</template>
        </el-table-column>
        <el-table-column prop="receivedAt" label="到账日期" width="120" />
        <el-table-column label="收款账户" width="120">
          <template #default="{ row }">{{ accountLabel(row) }}</template>
        </el-table-column>
        <el-table-column label="经办人" width="110">
          <template #default="{ row }">{{ row.createdBy?.name || '—' }}</template>
        </el-table-column>
        <el-table-column label="收款金额" width="150" align="right">
          <template #default="{ row }"><MoneyText :value="row.amount" /></template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <StatusTag :text="receiptStatusLabel(row)" :tone="receiptStatusTone(row)" />
          </template>
        </el-table-column>
        <el-table-column v-if="canCorrect" label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'active'" link type="danger" @click="openReversal(row)">冲正</el-button>
            <span v-else class="finance-table__sub">已冲正</span>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
      </el-table>
      <div v-if="total > pageSize" class="finance-pagination">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="loadList" />
      </div>
    </PanelCard>

    <FinanceCollectionDrawer v-model:visible="drawerVisible" :project-id="projectId" @saved="load" />
    <FinanceReceiptReversalDrawer v-model:visible="reversalVisible" :receipt="selectedReceipt" @saved="load" />
  </div>
</template>
