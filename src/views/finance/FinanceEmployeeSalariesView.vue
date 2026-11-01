<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import { useFinanceScopeStore } from '@/stores/financeScope'
import { usePayrollAccess } from '@/domains/finance/payrollAccess'
import { PAYROLL_ITEM_STATUS_META, payrollSheetStatusLabel, payrollSheetStatusTone } from '@/domains/finance/meta'
import type { EmployeePayrollItem, EmployeePayrollSheet } from '@/domains/finance/model'
import FinanceAttendanceDrawer from '@/components/finance/FinanceAttendanceDrawer.vue'
import FinanceEmployeePaymentDrawer from '@/components/finance/FinanceEmployeePaymentDrawer.vue'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StatusTag from '@/components/StatusTag.vue'

const sheets = ref<EmployeePayrollSheet[]>([])
const selected = ref<EmployeePayrollSheet | null>(null)
const items = ref<EmployeePayrollItem[]>([])
const loading = ref(false)
const loadingItems = ref(false)
const error = ref('')
const total = ref(0)
const page = ref(1)
const pageSize = 20
const period = ref(localMonth())
const attendanceVisible = ref(false)
const attendanceMonth = ref(localMonth())
const paymentVisible = ref(false)
const building = ref(false)
const confirming = ref(false)
const deleting = ref(false)
const submittingReview = ref(false)
const returningDraft = ref(false)
const router = useRouter()
const { canWrite: canPayrollWrite, canEditAttendance, canSubmitReview, canReturn, canConfirm, canDeleteDraft, canPay, readOnly: payrollReadOnly } = usePayrollAccess()

onMounted(() => { void load() })
const scope = useFinanceScopeStore()
// P1-a2：切换门店维度后重新取数（全部门店不传参，绝不传状态值 '0'）
watch(() => scope.requestStoreId, () => { page.value = 1; selected.value = null; items.value = []; void load() })
async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const result = await financeApi.employeePayrollSheets({ current: page.value, size: pageSize, storeId: scope.requestStoreId ?? undefined })
    sheets.value = result.list
    total.value = result.total
    await refreshSelected()
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '员工工资单暂不可确认'
  } finally { loading.value = false }
}
function changeSheetPage(): void {
  selected.value = null
  items.value = []
  void load()
}

async function openSheet(sheet: EmployeePayrollSheet): Promise<void> {
  selected.value = sheet
  items.value = []
  loadingItems.value = true
  error.value = ''
  try {
    const [detail, payrollItems] = await Promise.all([
      financeApi.employeePayrollSheetInfo(sheet.id),
      financeApi.employeePayrollItems(sheet.id, scope.requestStoreId ?? undefined)
    ])
    selected.value = detail
    items.value = payrollItems
  } catch (loadError) {
    closeSheet()
    error.value = loadError instanceof ProviderError ? loadError.message : '工资单详情暂不可确认'
  } finally {
    loadingItems.value = false
  }
}
function closeSheet(): void {
  selected.value = null
  items.value = []
}
async function buildSheet(): Promise<void> {
  if (!period.value) { ElMessage.warning('请选择工资月份'); return }
  building.value = true
  try { await financeApi.buildEmployeePayrollSheet(period.value); ElMessage.success('工资单草稿已生成'); await load() }
  catch (buildError) { ElMessage.error(buildError instanceof ProviderError ? buildError.message : '工资单生成失败') }
  finally { building.value = false }
}
async function submitReview(): Promise<void> {
  const current = selected.value
  if (!current || !canSubmitReview.value || current.status !== 'draft') return
  submittingReview.value = true
  try {
    await financeApi.submitEmployeePayrollSheetReview(current.id)
    ElMessage.success('工资单已提交复核，等待 BOSS 确认或退回')
    await load()
    items.value = await financeApi.employeePayrollItems(current.id, scope.requestStoreId ?? undefined)
  } catch (submitError) {
    ElMessage.error(submitError instanceof ProviderError ? submitError.message : '提交复核失败')
  } finally {
    submittingReview.value = false
  }
}

async function returnToDraft(): Promise<void> {
  const current = selected.value
  if (!current || !canReturn.value || current.status !== 'pending') return
  let reason = ''
  try {
    const result = await ElMessageBox.prompt('退回后工资单恢复为草稿，可继续修正；请填写退回原因。', '退回复核工资单', {
      confirmButtonText: '确认退回',
      cancelButtonText: '取消',
      inputPlaceholder: '请输入退回原因',
      inputValidator: (value: string) => value.trim() ? true : '退回原因不能为空'
    })
    reason = result.value.trim()
  } catch {
    return
  }
  returningDraft.value = true
  try {
    await financeApi.returnEmployeePayrollSheetToDraft(current.id, reason)
    ElMessage.success('工资单已退回草稿')
    await load()
    items.value = await financeApi.employeePayrollItems(current.id, scope.requestStoreId ?? undefined)
  } catch (returnError) {
    ElMessage.error(returnError instanceof ProviderError ? returnError.message : '退回工资单失败')
  } finally {
    returningDraft.value = false
  }
}

async function confirmSheet(): Promise<void> {
  const current = selected.value
  if (!current || !canConfirm.value) return
  if (blockers.value.length) { ElMessage.warning(blockers.value[0].text); return }
  try {
    await ElMessageBox.confirm(
      `确认 ${current.period} 工资单？确认后系统将按实发工资生成员工应付并计入项目/企业成本；工资条在发放完成后才对员工可见。`,
      '确认工资单',
      { type: 'warning', confirmButtonText: '确认生成应付', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  confirming.value = true
  try {
    await financeApi.confirmEmployeePayrollSheet(current.id)
    ElMessage.success('工资单已确认：应付已生成，工资条待发放后可见')
    await load()
    items.value = await financeApi.employeePayrollItems(current.id, scope.requestStoreId ?? undefined)
  } catch (confirmError) {
    ElMessage.error(confirmError instanceof ProviderError ? confirmError.message : '工资单确认失败')
  } finally {
    confirming.value = false
  }
}

async function deleteDraft(): Promise<void> {
  const current = selected.value
  if (!current || !canDeleteDraft.value || current.status !== 'draft') return
  try {
    await ElMessageBox.confirm(
      `确认删除 ${current.period} 工资单草稿？删除后可以重新生成；已确认、已发放或已形成应付的工资单不可删除。`,
      '删除工资单草稿',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  deleting.value = true
  try {
    await financeApi.deleteEmployeePayrollSheet(current.id)
    ElMessage.success('工资单草稿已删除')
    closeSheet()
    await load()
  } catch (deleteError) {
    ElMessage.error(deleteError instanceof ProviderError ? deleteError.message : '工资单草稿删除失败')
  } finally {
    deleting.value = false
  }
}
function openAttendance(month: string): void {
  attendanceMonth.value = month || localMonth()
  attendanceVisible.value = true
}

function localMonth(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }

/**
 * 工资单确认的逐项前置校验（对齐 App `sheet-detail.vue` / DEC-046 / BR-038）。
 * 设计原则：**阻断不是终点，阻断必须带可执行的下一步**——财务点确认前就要知道「为什么不能确认、我该先做什么」，
 * 而不是提交后拿到一句报错。
 */
type BlockerAction = 'attendance' | 'rebuild' | 'items'
interface SheetBlocker { key: string; text: string; action?: BlockerAction; actionText?: string }

const blockers = computed<SheetBlocker[]>(() => {
  const sheet = selected.value
  if (!sheet) return []
  const list: SheetBlocker[] = []
  if (!items.value.length) {
    list.push({
      key: 'items',
      text: '该月没有工资项：请检查薪酬方案生效期，或重新生成工资单草稿',
      action: 'rebuild',
      actionText: '重新生成草稿'
    })
  }
  if (!sheet.attendanceComplete) {
    list.push({
      key: 'attendance',
      text: '考勤未确认：确认全部员工月度考勤后才能确认工资单',
      action: 'attendance',
      actionText: '去确认考勤'
    })
  }
  if (items.value.some((item) => item.netAmount < 0)) {
    list.push({
      key: 'negative',
      text: '存在实发为负的工资项：需人工处理后才能确认',
      action: 'items',
      actionText: '查看工资项明细'
    })
  }
  return list
})

/** 非阻断提示：独立结算的事项要明确说「互不影响」，避免财务误停整条发薪流程。 */
const nonBlockingNotices = computed<string[]>(() => {
  const sheet = selected.value
  if (!sheet) return []
  const list: string[] = []
  if (!sheet.commissionComplete) {
    list.push('本月存在未结清的提成；提成与工资独立结算、独立发放，不影响本次工资确认。')
  }
  return list
})

const confirmBlocked = computed(() => blockers.value.length > 0)

async function handleBlockerAction(action?: BlockerAction): Promise<void> {
  if (!action) return
  if (action === 'attendance') { openAttendance(selected.value?.period || period.value); return }
  if (action === 'items') return
  await rebuildSheet()
}

/** 按当前工资单所属周期重建草稿，并重新打开该周期工资单。 */
async function rebuildSheet(): Promise<void> {
  const sheet = selected.value
  if (!sheet) return
  building.value = true
  try {
    await financeApi.buildEmployeePayrollSheet(sheet.period)
    ElMessage.success(`${sheet.period} 工资单草稿已重新生成`)
    await load()
    const next = sheets.value.find((item) => item.period === sheet.period)
    if (next) await openSheet(next)
  } catch (buildError) {
    ElMessage.error(buildError instanceof ProviderError ? buildError.message : '工资单重新生成失败')
  } finally { building.value = false }
}

/** 动作后按 reloadScopes 回读：确认考勤等外部动作会改变工资单完整性标记，必须重新取工资单事实。 */
async function refreshSelected(): Promise<void> {
  const current = selected.value
  if (!current) return
  try {
    selected.value = await financeApi.employeePayrollSheetInfo(current.id)
  } catch {
    // 当前范围已不可见时不在列表快照上继续展示详情，避免用旧金额冒充最新事实。
    closeSheet()
  }
}
/** 状态口径统一取 `domains/finance/meta`（未登记显示「待确认」）。 */
function sheetStatusLabel(value: unknown): string { return payrollSheetStatusLabel(String((value as EmployeePayrollSheet).status || '')) }
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles"><span class="finance-eyebrow">员工工资</span><h1>员工工资</h1><p>具备薪酬权限的账号生成工资单并由企业负责人确认后形成员工实发应付；单人企业可由企业负责人依次完成生成、确认和发放，发放成功后工资条才可见。</p></div>
      <div class="finance-actions"><el-date-picker v-model="period" type="month" value-format="YYYY-MM" style="width:130px" /><el-button v-if="canPayrollWrite" @click="router.push('/finance/compensation-schemes')">薪酬方案</el-button><el-button v-if="canEditAttendance" @click="openAttendance(period)">月度考勤</el-button><el-button @click="load">刷新</el-button><el-button v-if="payrollReadOnly" plain disabled>本店财务只读</el-button><el-button v-if="canPayrollWrite" type="primary" :loading="building" @click="buildSheet">生成工资单</el-button></div>
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
      <div v-if="total > pageSize" class="finance-pagination">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="changeSheetPage" />
      </div>
    </PanelCard>
    <PanelCard v-if="selected" class="finance-employee-detail" :title="`${selected.period} 工资单`">
      <template #extra>
        <div class="finance-actions">
          <el-button v-if="canSubmitReview && selected.status === 'draft'" plain :loading="submittingReview" @click="submitReview">提交复核</el-button>
          <el-button v-if="canReturn && selected.status === 'pending'" :loading="returningDraft" @click="returnToDraft">退回草稿</el-button>
          <el-button v-if="canDeleteDraft && selected.status === 'draft'" type="danger" plain :loading="deleting" @click="deleteDraft">删除草稿</el-button>
          <el-tooltip v-if="confirmBlocked" content="存在未满足的确认前置，请先按清单处理" placement="top">
            <span>
              <el-button v-if="canConfirm && (selected.status === 'draft' || selected.status === 'pending')" type="primary" disabled>确认工资单</el-button>
            </span>
          </el-tooltip>
          <el-button v-else-if="canConfirm && (selected.status === 'draft' || selected.status === 'pending')" type="primary" :loading="confirming" @click="confirmSheet">确认工资单</el-button>
          <el-button v-if="canPay && selected && (selected.status === 'confirmed' || selected.status === 'partialPaid')" @click="paymentVisible = true">员工发放</el-button>
          <el-button text @click="closeSheet">收起</el-button>
        </div>
      </template>

      <el-alert v-if="selected.remark" :type="selected.remark.startsWith('退回原因：') ? 'warning' : 'info'" :closable="false" show-icon :title="selected.remark" class="finance-notice" />

      <div class="finance-sheet-summary">
        <div class="finance-sheet-summary__item">
          <span>应发合计</span>
          <MoneyText :value="selected.totalGrossAmount" />
        </div>
        <div class="finance-sheet-summary__item">
          <span>扣款合计</span>
          <MoneyText :value="selected.totalDeductionAmount" />
        </div>
        <div class="finance-sheet-summary__item finance-sheet-summary__item--strong">
          <span>实发合计</span>
          <MoneyText :value="selected.totalNetAmount" />
        </div>
        <div class="finance-sheet-summary__item">
          <span>工资单状态</span>
          <StatusTag :text="payrollSheetStatusLabel(selected.status)" :tone="payrollSheetStatusTone(selected.status)" />
        </div>
        <div class="finance-sheet-summary__item">
          <span>考勤</span>
          <strong>{{ selected.attendanceComplete ? '已完整' : '未完整' }}</strong>
        </div>
        <div class="finance-sheet-summary__item">
          <span>提成</span>
          <strong>{{ selected.commissionComplete ? '已结清' : '有未结清' }}</strong>
        </div>
        <div v-if="selected.confirmedBy" class="finance-sheet-summary__item finance-sheet-summary__item--span">
          <span>确认人 / 时间</span>
          <strong>{{ selected.confirmedBy.name }} · {{ selected.confirmedAt || '待返回确认时间' }}</strong>
        </div>
      </div>

      <div v-if="blockers.length" class="finance-blockers" role="alert">
        <p class="finance-blockers__title">还不能确认工资单，请先处理以下 {{ blockers.length }} 项</p>
        <ul class="finance-blockers__list">
          <li v-for="blocker in blockers" :key="blocker.key">
            <span>{{ blocker.text }}</span>
            <el-button v-if="blocker.action" size="small" type="primary" plain :loading="blocker.action === 'rebuild' && building" @click="handleBlockerAction(blocker.action)">{{ blocker.actionText }}</el-button>
          </li>
        </ul>
      </div>
      <el-alert v-for="notice in nonBlockingNotices" :key="notice" type="info" :closable="false" show-icon :title="notice" class="finance-notice" />
      <SkeletonBlock v-if="loadingItems" variant="table" :rows="4" />
      <EmptyState v-else-if="!items.length" title="暂无工资项" description="该月没有工资项：请检查薪酬方案生效期，或重新生成工资单草稿。" />
      <el-table v-else :data="items" stripe>
        <el-table-column label="员工 / 归属" min-width="220">
          <template #default="{ row }">
            <div class="finance-table__main">
              <span class="finance-table__title">{{ row.employee.name }}</span>
              <span class="finance-table__sub">{{ row.project?.name || '企业费用' }} · {{ row.attribution === 'project' ? '项目归属' : '企业归属' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="收入构成" min-width="235">
          <template #default="{ row }">
            <div class="finance-money-breakdown">
              <div><span>基本工资</span><MoneyText :value="row.baseSalaryAmount" /></div>
              <div><span>提成</span><MoneyText :value="row.commissionAmount" /></div>
              <div><span>奖金</span><MoneyText :value="row.bonusAmount" /></div>
              <div><span>补贴</span><MoneyText :value="row.allowanceAmount" /></div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="扣款构成" min-width="235">
          <template #default="{ row }">
            <div class="finance-money-breakdown">
              <div><span>考勤扣款</span><MoneyText :value="row.attendanceDeduction" /></div>
              <div><span>社保</span><MoneyText :value="row.socialInsuranceAmount" /></div>
              <div><span>个税</span><MoneyText :value="row.taxAmount" /></div>
              <div><span>其他扣款</span><MoneyText :value="row.otherDeduction" /></div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="应发" width="130"><template #default="{ row }"><MoneyText :value="row.grossAmount" /></template></el-table-column>
        <el-table-column label="扣款合计" width="130"><template #default="{ row }"><MoneyText :value="row.deductionAmount" /></template></el-table-column>
        <el-table-column label="实发" width="130"><template #default="{ row }"><MoneyText :value="row.netAmount" /></template></el-table-column>
        <el-table-column label="工资项状态" width="110">
          <template #default="{ row }">
            <StatusTag :text="PAYROLL_ITEM_STATUS_META[row.status]?.label || '待确认'" :tone="PAYROLL_ITEM_STATUS_META[row.status]?.tone || 'todo'" />
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="160"><template #default="{ row }">{{ row.remark || '—' }}</template></el-table-column>
      </el-table>
    </PanelCard>
    <FinanceAttendanceDrawer v-model:visible="attendanceVisible" :month="attendanceMonth" :store-id="scope.requestStoreId ?? undefined" @saved="load" />
    <FinanceEmployeePaymentDrawer
      v-model:visible="paymentVisible"
      type="EmployeeSalary"
      :sheet-id="selected?.id"
      :store-id="scope.requestStoreId ?? undefined"
      @saved="load"
    />
  </div>
</template>

<style scoped lang="scss">
.finance-sheet-summary {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: $space-3;
  margin-bottom: $space-4;
}
.finance-sheet-summary__item {
  display: flex;
  min-height: 74px;
  flex-direction: column;
  justify-content: space-between;
  gap: $space-2;
  padding: $space-3;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-50;
}
.finance-sheet-summary__item > span:first-child { color: $text-tertiary; font-size: $font-caption; }
.finance-sheet-summary__item strong { color: $text-primary; font-size: $font-body-sm; }
.finance-sheet-summary__item--strong { border-color: $brand-200; background: $brand-50; }
.finance-sheet-summary__item--span { grid-column: span 2; }
.finance-money-breakdown { display: flex; flex-direction: column; gap: 4px; }
.finance-money-breakdown > div { display: flex; align-items: center; justify-content: space-between; gap: $space-3; }
.finance-money-breakdown span { color: $text-tertiary; font-size: $font-caption; }
.finance-blockers {
  margin-bottom: $space-3;
  padding: $space-3 $space-4;
  border: 1px solid $warning-200;
  border-radius: $radius-md;
  background: $warning-50;
}
.finance-blockers__title { margin: 0 0 $space-2; color: $text-primary; font-size: $font-body-sm; font-weight: $font-weight-semibold; }
.finance-blockers__list { display: flex; flex-direction: column; gap: $space-2; margin: 0; padding: 0; list-style: none; }
.finance-blockers__list li { display: flex; align-items: center; justify-content: space-between; gap: $space-3; color: $text-secondary; font-size: $font-body-sm; }
.finance-notice { margin-bottom: $space-3; }
@media (max-width: 1280px) {
  .finance-sheet-summary { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 768px) {
  .finance-sheet-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .finance-sheet-summary__item--span { grid-column: span 2; }
}
</style>
