<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import type { EmployeeCommissionItem, EmployeeCommissionStatus } from '@/domains/finance/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import FinanceCommissionDrawer from '@/components/finance/FinanceCommissionDrawer.vue'
import FinanceEmployeePaymentDrawer from '@/components/finance/FinanceEmployeePaymentDrawer.vue'

const items = ref<EmployeeCommissionItem[]>([])
const loading = ref(false)
const error = ref('')
const total = ref(0)
const commissionVisible = ref(false)
const paymentVisible = ref(false)
const totalCommission = computed(() => items.value.reduce((sum, item) => sum + item.commissionAmount, 0))
const statusLabel: Record<EmployeeCommissionStatus, string> = {
  pendingAccrual: '待计提', accrued: '已计提', released: '待发放', inPayment: '发放中', paid: '已发放', closed: '已关闭', adjusted: '已冲减'
}
function saveCommission(): void { commissionVisible.value = false; void load(); ElMessage.success('提成已计提') }

onMounted(() => { void load() })
async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const result = await financeApi.employeeCommissions({ current: 1, size: 100 })
    items.value = result.list
    total.value = result.total
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '员工提成暂不可确认'
  } finally { loading.value = false }
}
function statusText(value: unknown): string { return statusLabel[(value as EmployeeCommissionItem).status] }
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles"><span class="finance-eyebrow">EMPLOYEE COMMISSION · 员工提成</span><h1>员工提成</h1><p>提成按主合同签约额手工计提，客户回款后按累计有效回款比例释放，发放后结清。</p></div>
      <div class="finance-actions"><el-button @click="paymentVisible = true">提成发放</el-button><el-button @click="load">刷新</el-button><el-button type="primary" @click="commissionVisible = true">计提提成</el-button></div>
    </header>
    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <section class="finance-kpis">
      <article class="finance-kpi"><span>提成记录</span><strong>{{ total }}</strong><small>当前企业可见提成明细</small></article>
      <article class="finance-kpi"><span>当前页提成金额</span><strong><MoneyText :value="totalCommission" size="lg" /></strong><small>正式汇总以服务端为准</small></article>
      <article class="finance-kpi"><span>计提规则</span><strong>签约计提</strong><small>只按主合同签约额计算</small></article>
      <article class="finance-kpi"><span>释放规则</span><strong>回款释放</strong><small>累计有效回款，退款自动冲减下期</small></article>
    </section>
    <PanelCard flush>
      <SkeletonBlock v-if="loading && !items.length" variant="table" :rows="6" />
      <EmptyState v-else-if="!loading && !items.length" title="暂无员工提成" description="合同签约后由财务手工计提提成。" />
      <el-table v-else :data="items" stripe>
        <el-table-column label="员工 / 项目" min-width="240"><template #default="{ row }"><div class="finance-table__main"><span class="finance-table__title">{{ row.employee.name }}</span><span class="finance-table__sub">{{ row.project?.name || '未关联项目' }}</span></div></template></el-table-column>
        <el-table-column label="签约额" width="140"><template #default="{ row }"><MoneyText :value="row.contractAmount" /></template></el-table-column>
        <el-table-column label="比例" width="90"><template #default="{ row }">{{ row.manualRate }}%</template></el-table-column>
        <el-table-column label="提成金额" width="140"><template #default="{ row }"><MoneyText :value="row.commissionAmount" /></template></el-table-column>
        <el-table-column label="已释放" width="140"><template #default="{ row }"><MoneyText :value="row.releasedAmount" /></template></el-table-column>
        <el-table-column label="已发放" width="140"><template #default="{ row }"><MoneyText :value="row.paidAmount" /></template></el-table-column>
        <el-table-column label="状态" width="110"><template #default="{ row }">{{ statusText(row) }}</template></el-table-column>
      </el-table>
    </PanelCard>
    <FinanceCommissionDrawer v-model:visible="commissionVisible" @saved="saveCommission" />
    <FinanceEmployeePaymentDrawer v-model:visible="paymentVisible" type="EmployeeCommission" @saved="load" />
  </div>
</template>
