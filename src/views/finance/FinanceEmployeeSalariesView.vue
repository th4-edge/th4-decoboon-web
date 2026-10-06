<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import type { EmployeePayrollItem, EmployeePayrollSheet, EmployeePayrollSheetStatus } from '@/domains/finance/model'
import { useSessionStore } from '@/stores/session'
import FinanceCompensationDrawer from '@/components/finance/FinanceCompensationDrawer.vue'
import FinanceAttendanceDrawer from '@/components/finance/FinanceAttendanceDrawer.vue'
import FinanceEmployeePaymentDrawer from '@/components/finance/FinanceEmployeePaymentDrawer.vue'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'

const sheets = ref<EmployeePayrollSheet[]>([])
const selected = ref<EmployeePayrollSheet | null>(null)
const items = ref<EmployeePayrollItem[]>([])
const loading = ref(false)
const loadingItems = ref(false)
const error = ref('')
const total = ref(0)
const period = ref(localMonth())
const compensationVisible = ref(false)
const attendanceVisible = ref(false)
const paymentVisible = ref(false)
const building = ref(false)
const confirming = ref(false)
const session = useSessionStore()
const canConfirm = computed(() => session.role === 'Boss')
const statusLabel: Record<EmployeePayrollSheetStatus, string> = {
  draft: '草稿', pending: '待确认', confirmed: '已确认', partialPaid: '部分发放', paid: '已发放', closed: '已关闭', void: '已作废'
}

onMounted(() => { void load() })
async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const result = await financeApi.employeePayrollSheets({ current: 1, size: 100 })
    sheets.value = result.list
    total.value = result.total
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '员工工资单暂不可确认'
  } finally { loading.value = false }
}
async function openSheet(sheet: EmployeePayrollSheet): Promise<void> {
  selected.value = sheet
  loadingItems.value = true
  try { items.value = await financeApi.employeePayrollItems(sheet.id) }
  catch (loadError) { error.value = loadError instanceof ProviderError ? loadError.message : '工资项暂不可确认' }
  finally { loadingItems.value = false }
}
async function buildSheet(): Promise<void> {
  if (!period.value) { ElMessage.warning('请选择工资月份'); return }
  building.value = true
  try { await financeApi.buildEmployeePayrollSheet(period.value); ElMessage.success('工资单草稿已生成'); await load() }
  catch (buildError) { ElMessage.error(buildError instanceof ProviderError ? buildError.message : '工资单生成失败') }
  finally { building.value = false }
}
async function confirmSheet(): Promise<void> {
  if (!selected.value) return
  confirming.value = true
  try { await financeApi.confirmEmployeePayrollSheet(selected.value.id); ElMessage.success('工资单已确认，员工实发应付已生成'); await load(); await openSheet(selected.value) }
  catch (confirmError) { ElMessage.error(confirmError instanceof ProviderError ? confirmError.message : '工资单确认失败') }
  finally { confirming.value = false }
}
function localMonth(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }
function sheetStatusLabel(value: unknown): string { return statusLabel[(value as EmployeePayrollSheet).status] }
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles"><span class="finance-eyebrow">EMPLOYEE SALARY · 员工工资</span><h1>员工工资</h1><p>具备薪酬权限的账号生成工资单并由 BOSS 确认后形成员工实发应付；单人企业可由 BOSS 依次完成生成、确认和发放，发放成功后工资条才可见。</p></div>
      <div class="finance-actions"><el-date-picker v-model="period" type="month" value-format="YYYY-MM" style="width:130px" /><el-button @click="compensationVisible = true">薪酬方案</el-button><el-button @click="attendanceVisible = true">月度考勤</el-button><el-button @click="load">刷新</el-button><el-button type="primary" :loading="building" @click="buildSheet">生成工资单</el-button></div>
    </header>
    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <PanelCard flush>
      <SkeletonBlock v-if="loading && !sheets.length" variant="table" :rows="6" />
      <EmptyState v-else-if="!loading && !sheets.length" title="暂无员工工资单" description="先创建薪酬方案并确认考勤，再生成工资单。" />
      <el-table v-else :data="sheets" stripe highlight-current-row @row-click="openSheet">
        <el-table-column prop="period" label="工资周期" width="130" />
        <el-table-column label="状态" width="130"><template #default="{ row }"><el-tag>{{ sheetStatusLabel(row) }}</el-tag></template></el-table-column>
        <el-table-column label="应发" width="150"><template #default="{ row }"><MoneyText :value="row.totalGrossAmount" /></template></el-table-column>
        <el-table-column label="扣款" width="150"><template #default="{ row }"><MoneyText :value="row.totalDeductionAmount" /></template></el-table-column>
        <el-table-column label="实发" width="150"><template #default="{ row }"><MoneyText :value="row.totalNetAmount" /></template></el-table-column>
        <el-table-column label="完整性" min-width="220"><template #default="{ row }">考勤{{ row.attendanceComplete ? '已完整' : '未完整' }} · 提成{{ row.commissionComplete ? '已完整' : '未完整' }}</template></el-table-column>
      </el-table>
    </PanelCard>
    <PanelCard v-if="selected" class="finance-employee-detail" :title="`${selected.period} 工资项`">
      <template #extra><div class="finance-actions"><el-button v-if="canConfirm && (selected.status === 'draft' || selected.status === 'pending')" type="primary" :loading="confirming" @click="confirmSheet">确认工资单</el-button><el-button @click="paymentVisible = true">员工发放</el-button><el-button text @click="selected = null">收起</el-button></div></template>
      <SkeletonBlock v-if="loadingItems" variant="table" :rows="4" />
      <EmptyState v-else-if="!items.length" title="暂无工资项" description="工资单生成后，按员工和项目/企业归属展示。" />
      <el-table v-else :data="items" stripe>
        <el-table-column label="员工 / 归属" min-width="220"><template #default="{ row }"><div class="finance-table__main"><span class="finance-table__title">{{ row.employee.name }}</span><span class="finance-table__sub">{{ row.project?.name || '企业费用' }}</span></div></template></el-table-column>
        <el-table-column label="基本工资" width="140"><template #default="{ row }"><MoneyText :value="row.baseSalaryAmount" /></template></el-table-column>
        <el-table-column label="考勤扣款" width="140"><template #default="{ row }"><MoneyText :value="row.attendanceDeduction" /></template></el-table-column>
        <el-table-column label="提成" width="140"><template #default="{ row }"><MoneyText :value="row.commissionAmount" /></template></el-table-column>
        <el-table-column label="实发" width="140"><template #default="{ row }"><MoneyText :value="row.netAmount" /></template></el-table-column>
      </el-table>
    </PanelCard>
    <FinanceCompensationDrawer v-model:visible="compensationVisible" @saved="load" />
    <FinanceAttendanceDrawer v-model:visible="attendanceVisible" @saved="load" />
    <FinanceEmployeePaymentDrawer v-model:visible="paymentVisible" type="EmployeeSalary" @saved="load" />
  </div>
</template>
