<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import { useFinanceAccess } from '@/domains/finance/access'
import type { ReceiptRefund } from '@/domains/finance/model'
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
const page = ref(1)
const size = 50
const total = ref(0)
const drawerVisible = ref(false)
const totalAmount = computed(() => items.value.reduce((sum, item) => sum + item.amount, 0))

onMounted(() => { void load() })
async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const result = await financeApi.refunds({ current: page.value, size })
    items.value = result.list
    total.value = result.total
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '退款记录暂不可确认'
  } finally { loading.value = false }
}

function accountLabel(value: unknown): string { return ACCOUNT_LABEL[(value as ReceiptRefund).account] }
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles"><span class="finance-eyebrow">REFUND · 客户退款</span><h1>客户退款</h1><p>退款按原收款独立留痕，自动写资金台账并联动已发提成下期调整。</p></div>
      <div class="finance-actions"><el-button @click="load">刷新</el-button><el-button v-if="readOnly" plain disabled>本店财务只读</el-button><el-button v-if="canWrite" type="primary" @click="drawerVisible = true">登记退款</el-button></div>
    </header>
    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <section class="finance-kpis">
      <article class="finance-kpi"><span>当前列表退款</span><strong><MoneyText :value="totalAmount" size="lg" /></strong><small>当前页明细合计，正式汇总以服务端为准</small></article>
      <article class="finance-kpi"><span>退款笔数</span><strong>{{ total }}</strong><small>已登记并生效的退款记录</small></article>
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
    </PanelCard>
    <FinanceRefundDrawer v-model:visible="drawerVisible" @saved="load" />
  </div>
</template>
