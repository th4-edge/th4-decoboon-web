<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ProviderError } from '@/core/http'
import { formatDateTime } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import { EMPLOYEE_COMMISSION_STATUS_META } from '@/domains/finance/meta'
import { useFinanceScopeStore } from '@/stores/financeScope'
import { usePayrollAccess } from '@/domains/finance/payrollAccess'
import type { EmployeeCommissionItem, FinanceCommissionReport } from '@/domains/finance/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import FinanceCommissionDrawer from '@/components/finance/FinanceCommissionDrawer.vue'
import FinanceEmployeePaymentDrawer from '@/components/finance/FinanceEmployeePaymentDrawer.vue'

const { canWrite: canPayrollWrite, canPay, readOnly: payrollReadOnly } = usePayrollAccess()
const items = ref<EmployeeCommissionItem[]>([])
const loading = ref(false)
const error = ref('')
const report = ref<FinanceCommissionReport | null>(null)
const reportLoading = ref(false)
const reportError = ref('')
const page = ref(1)
const pageSize = 20
const total = ref(0)
const commissionVisible = ref(false)
const paymentVisible = ref(false)
function saveCommission(): void { commissionVisible.value = false; void load(); ElMessage.success('提成已计提') }

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
    const result = await financeApi.employeeCommissions({ current: page.value, size: pageSize, storeId: scope.requestStoreId ?? undefined })
    items.value = result.list
    total.value = result.total
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '员工提成暂不可确认'
  } finally { loading.value = false }
}

async function loadReport(): Promise<void> {
  reportLoading.value = true
  reportError.value = ''
  try {
    report.value = await financeApi.commissionReport({ storeId: scope.requestStoreId ?? undefined })
  } catch (loadError) {
    report.value = null
    reportError.value = loadError instanceof ProviderError ? loadError.message : '提成汇总暂不可确认'
  } finally { reportLoading.value = false }
}
function statusText(value: unknown): string {
  return EMPLOYEE_COMMISSION_STATUS_META[(value as EmployeeCommissionItem).status]?.label || '待确认'
}
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles"><span class="finance-eyebrow">员工提成</span><h1>员工提成</h1><p>提成按主合同签约额手工计提，客户回款后按累计有效回款比例释放，发放后结清。</p></div>
      <div class="finance-actions"><el-button v-if="canPay" @click="paymentVisible = true">提成发放</el-button><el-button @click="load">刷新</el-button><el-button v-if="payrollReadOnly" plain disabled>本店财务只读</el-button><el-button v-if="canPayrollWrite" type="primary" @click="commissionVisible = true">计提提成</el-button></div>
    </header>
    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <el-alert v-if="reportError" type="warning" :closable="false" title="提成汇总暂不可确认" show-icon />
    <section class="finance-kpis">
      <article class="finance-kpi"><span>提成记录</span><strong>{{ reportLoading ? '统计中…' : report ? report.count : '暂不可确认' }}</strong><small>当前数据范围内的全部提成</small></article>
      <article class="finance-kpi"><span>提成金额</span><strong><MoneyText :value="report?.commissionAmount" size="lg" /></strong><small>按主合同签约额计提</small></article>
      <article class="finance-kpi"><span>已释放</span><strong><MoneyText :value="report?.releasedAmount" size="lg" /></strong><small>按累计有效回款释放</small></article>
      <article class="finance-kpi"><span>已发放</span><strong><MoneyText :value="report?.paidAmount" size="lg" /></strong><small>数据截止 {{ formatDateTime(report?.asOf) }}</small></article>
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
      <div v-if="total > pageSize" class="finance-pagination">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="loadList" />
      </div>
    </PanelCard>
    <FinanceCommissionDrawer v-model:visible="commissionVisible" :store-id="scope.requestStoreId ?? undefined" @saved="saveCommission" />
    <FinanceEmployeePaymentDrawer
      v-model:visible="paymentVisible"
      type="EmployeeCommission"
      :store-id="scope.requestStoreId ?? undefined"
      @saved="load"
    />
  </div>
</template>
