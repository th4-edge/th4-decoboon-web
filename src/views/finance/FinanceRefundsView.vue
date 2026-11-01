<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ProviderError } from '@/core/http'
import { formatDateTime } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import { useFinanceScopeStore } from '@/stores/financeScope'
import { useFinanceAccess } from '@/domains/finance/access'
import type { FinanceRefundReport, ReceiptRefund } from '@/domains/finance/model'
import { ACCOUNT_LABEL } from '@/domains/finance/meta'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import FinanceRefundDrawer from '@/components/finance/FinanceRefundDrawer.vue'

const { canWrite, readOnly } = useFinanceAccess()
const items = ref<ReceiptRefund[]>([])
const loading = ref(false)
const error = ref('')
const report = ref<FinanceRefundReport | null>(null)
const reportLoading = ref(false)
const reportError = ref('')
const page = ref(1)
const size = 50
const total = ref(0)
const drawerVisible = ref(false)

onMounted(() => { void load() })
const scope = useFinanceScopeStore()
// P1-a2：切换门店维度后重新取数（全部门店不传参，绝不传状态值 '0'）
watch(() => scope.requestStoreId, () => { page.value = 1; void load() })

async function load(): Promise<void> {
  await Promise.all([loadList(), loadReport()])
}

async function loadList(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const result = await financeApi.refunds({ current: page.value, size, storeId: scope.requestStoreId ?? undefined })
    items.value = result.list
    total.value = result.total
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '退款记录暂不可确认'
  } finally { loading.value = false }
}

async function loadReport(): Promise<void> {
  reportLoading.value = true
  reportError.value = ''
  try {
    report.value = await financeApi.refundReport({ storeId: scope.requestStoreId ?? undefined })
  } catch (loadError) {
    report.value = null
    reportError.value = loadError instanceof ProviderError ? loadError.message : '退款汇总暂不可确认'
  } finally { reportLoading.value = false }
}

function accountLabel(value: unknown): string { return ACCOUNT_LABEL[(value as ReceiptRefund).account] }
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles"><span class="finance-eyebrow">客户退款</span><h1>客户退款</h1><p>退款按原收款独立留痕，自动写资金台账并联动已发提成下期调整。</p></div>
      <div class="finance-actions"><el-button @click="load">刷新</el-button><el-button v-if="readOnly" plain disabled>本店财务只读</el-button><el-button v-if="canWrite" type="primary" @click="drawerVisible = true">登记退款</el-button></div>
    </header>
    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <el-alert v-if="reportError" type="warning" :closable="false" title="退款汇总暂不可确认" show-icon />
    <section class="finance-kpis">
      <article class="finance-kpi"><span>退款总额</span><strong><MoneyText :value="report?.totalAmount" size="lg" /></strong><small>{{ reportLoading ? '汇总加载中…' : '当前数据范围内的全部退款' }}</small></article>
      <article class="finance-kpi"><span>退款笔数</span><strong>{{ reportLoading ? '统计中…' : report ? report.count : '暂不可确认' }}</strong><small>数据截止 {{ formatDateTime(report?.asOf) }}</small></article>
      <article class="finance-kpi"><span>联动规则</span><strong>下期抵扣</strong><small>已发提成超额只进入下期负向调整</small></article>
      <article class="finance-kpi"><span>历史保护</span><strong>不反改</strong><small>原收款、原提成和已发工资保持不变</small></article>
    </section>
    <PanelCard flush>
      <SkeletonBlock v-if="loading && !items.length" variant="table" :rows="6" />
      <EmptyState v-else-if="!loading && !items.length" title="暂无退款记录" description="从收款记录选择原收款登记退款后，会在这里出现。" :action-text="canWrite ? '登记退款' : ''" @action="drawerVisible = true" />
      <el-table v-else :data="items" stripe>
        <el-table-column label="项目 / 原收款" min-width="240"><template #default="{ row }"><div class="finance-table__main"><span class="finance-table__title">{{ row.project.name }}</span><span class="finance-table__sub">{{ row.receipt.receivedAt }} · {{ row.receipt.payerName || row.customer?.name || '客户' }}</span></div></template></el-table-column>
        <el-table-column label="退款金额" width="160"><template #default="{ row }"><MoneyText :value="row.amount" /></template></el-table-column>
        <el-table-column label="原收款" width="160"><template #default="{ row }"><MoneyText :value="row.receipt.amount" /></template></el-table-column>
        <el-table-column label="账户" width="120"><template #default="{ row }">{{ accountLabel(row) }}</template></el-table-column>
        <el-table-column prop="refundAt" label="退款日期" width="130" />
        <el-table-column prop="reason" label="原因" min-width="180" show-overflow-tooltip />
      </el-table>
      <div v-if="total > size" class="finance-pagination">
        <el-pagination v-model:current-page="page" :page-size="size" :total="total" layout="prev, pager, next" @current-change="loadList" />
      </div>
    </PanelCard>
    <FinanceRefundDrawer v-model:visible="drawerVisible" @saved="load" />
  </div>
</template>
