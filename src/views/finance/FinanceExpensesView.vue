<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ProviderError } from '@/core/http'
import { formatDateTime, formatMoney } from '@/core/format'
import { expenseApi } from '@/domains/expense/api'
import {
  EXPENSE_STATUS_META,
  expensePaymentModeMeta,
  expenseStatusMeta
} from '@/domains/expense/meta'
import type { Expense, ExpenseStatus } from '@/domains/expense/model'
import { useSessionStore } from '@/stores/session'
import { useFinanceScopeStore } from '@/stores/financeScope'
import PanelCard from '@/components/PanelCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StatusTag from '@/components/StatusTag.vue'
import ProjectPicker from '@/components/picker/ProjectPicker.vue'
import ExpenseFormDrawer from '@/components/expense/ExpenseFormDrawer.vue'
import ExpenseDetailDrawer from '@/components/expense/ExpenseDetailDrawer.vue'

const route = useRoute()
const session = useSessionStore()
const scope = useFinanceScopeStore()

const items = ref<Expense[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(false)
const error = ref('')
const keyword = ref('')
const statusFilter = ref<ExpenseStatus | ''>('')
const projectFilter = ref('')
const formVisible = ref(false)
const detailVisible = ref(false)
const editing = ref<Expense | null>(null)
const selected = ref<Expense | null>(null)

const statusOptions = Object.entries(EXPENSE_STATUS_META).map(([value, meta]) => ({
  value: value as ExpenseStatus,
  label: meta.label
}))
const isManager = computed(() => session.role === 'Boss' || session.role === 'StoreManager')
const pendingLabel = computed(() => isManager.value ? '待我审批' : session.role === 'Finance' ? '待我复核' : '已提交')
const canCreate = computed(() => Boolean(session.role && session.role !== 'TeamLeader'))

onMounted(() => {
  projectFilter.value = String(route.query.projectId ?? '')
  void loadList()
})

watch(() => scope.requestStoreId, () => {
  page.value = 1
  void loadList()
})

async function loadList(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const result = await expenseApi.page({
      current: page.value,
      size: pageSize,
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value || undefined,
      projectId: projectFilter.value || undefined,
      storeId: scope.requestStoreId ?? undefined
    })
    items.value = result.list
    total.value = result.total
  } catch (loadError) {
    items.value = []
    total.value = 0
    error.value = loadError instanceof ProviderError ? loadError.message : '费用与报销暂不可确认'
  } finally {
    loading.value = false
  }
}

function resetAndLoad(): void {
  page.value = 1
  void loadList()
}

function setPendingFilter(): void {
  statusFilter.value = statusFilter.value === 'Submitted' ? '' : 'Submitted'
  resetAndLoad()
}

function openCreate(): void {
  if (!canCreate.value) return
  editing.value = null
  formVisible.value = true
}

function openDetail(value: unknown): void {
  const item = value as Expense
  selected.value = item
  detailVisible.value = true
}

function openEdit(value: unknown): void {
  const item = value as Expense
  editing.value = item
  detailVisible.value = false
  formVisible.value = true
}

function onSaved(expense: Expense): void {
  selected.value = expense
  void loadList()
}

function onChanged(expense?: Expense): void {
  if (expense) selected.value = expense
  void loadList()
}

function statusMeta(value: unknown) {
  const item = value as Expense
  return expenseStatusMeta(item.status)
}

function paymentMeta(value: unknown) {
  const item = value as Expense
  return expensePaymentModeMeta(item.paymentMode)
}

function canAction(value: unknown, action: string): boolean {
  const item = value as Expense
  return Array.isArray(item.allowedActions) && item.allowedActions.includes(action)
}

function canEdit(value: unknown): boolean {
  return canAction(value, 'edit')
}

function canApprove(value: unknown): boolean {
  return canAction(value, 'approve')
}

function canReview(value: unknown): boolean {
  return canAction(value, 'return') && !canAction(value, 'approve')
}

function nextActionLabel(value: unknown): string {
  const item = value as Expense
  if (canEdit(item)) return item.nextAction || (item.status === 'Returned' ? '补充后重新提交' : '继续填写')
  if (canApprove(item)) return '审批'
  if (canReview(item)) return '复核'
  if (canAction(item, 'withdraw')) return '查看并撤回'
  return '查看详情'
}

function attributionText(value: unknown): string {
  const item = value as Expense
  return item.project ? item.project.name : '企业费用'
}

function approvalText(value: unknown): string {
  const item = value as Expense
  if (item.nextAction) {
    if (item.status === 'Returned') return item.approvalNote || '退回原因暂不可确认'
    if (item.status === 'Rejected') return item.approvalNote || '已拒绝，原因暂不可确认'
    return item.nextAction
  }
  if (item.status === 'Returned') return item.approvalNote || '退回原因暂不可确认'
  if (item.status === 'Approved') return item.approvedBy?.name ? `${item.approvedBy.name} 已批准` : '已批准，审批人暂不可确认'
  if (item.status === 'Rejected') return item.approvalNote || '已拒绝，原因暂不可确认'
  if (item.status === 'Submitted') return isManager.value ? pendingLabel.value : '等待企业负责人或店长审批'
  if (item.status === 'Draft') return '尚未提交审批'
  if (item.status === 'Cancelled') return item.requester?.name ? `${item.requester.name} 已撤回` : '已撤回'
  return '历史费用状态'
}

function formatAmount(value: number): string {
  return `¥${formatMoney(value)}`
}

</script>

<template>
  <div class="finance-page expense-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">FINANCE · 费用执行</span>
        <h1>费用与报销</h1>
        <p>企业直付与员工报销共用一张费用事实：员工提交证据，企业负责人或店长审批，财务只做证据复核与退回补充。审批通过不等于已付款，本页不生成应付、付款、流水或凭证。</p>
      </div>
      <div class="finance-actions">
        <el-button @click="loadList">刷新</el-button>
        <el-button v-if="canCreate" type="primary" @click="openCreate">新建费用</el-button>
      </div>
    </header>

    <section class="expense-page__guide" aria-label="费用处理路径">
      <div>
        <span>01 提交</span>
        <strong>员工补齐分类、金额与证据</strong>
        <small>项目费用选项目；企业费用不关联项目。</small>
      </div>
      <div>
        <span>02 审批</span>
        <strong>{{ pendingLabel }}</strong>
        <small>财务不能业务审批；店长不能审批本人报销。</small>
      </div>
      <div>
        <span>03 财务复核</span>
        <strong>只看证据并退回补充</strong>
        <small>付款、凭证和利润接入不在 D1 范围。</small>
      </div>
    </section>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default>
        <el-button link type="primary" @click="loadList">重新读取</el-button>
      </template>
    </el-alert>

    <PanelCard flush>
      <div class="finance-toolbar expense-page__toolbar">
        <el-input
          v-model="keyword"
          clearable
          placeholder="搜索费用编号或说明"
          style="width: 250px"
          @keyup.enter="resetAndLoad"
          @clear="resetAndLoad"
        />
        <el-select v-model="statusFilter" clearable placeholder="全部状态" style="width: 150px" @change="resetAndLoad">
          <el-option v-for="option in statusOptions" :key="option.value" :label="option.label" :value="option.value" />
        </el-select>
        <div class="expense-page__project-filter">
          <ProjectPicker v-model="projectFilter" placeholder="全部项目/企业费用" clearable @change="resetAndLoad" />
        </div>
        <el-button
          :type="statusFilter === 'Submitted' ? 'primary' : 'default'"
          plain
          @click="setPendingFilter"
        >
          {{ pendingLabel }}
        </el-button>
        <span class="finance-toolbar__spacer" />
        <span class="finance-toolbar__result">
          {{ loading ? '读取中…' : error ? '费用数暂不可确认' : `共 ${total} 条` }}
        </span>
      </div>

      <SkeletonBlock v-if="loading && !items.length" variant="table" :rows="7" />
      <EmptyState
        v-else-if="!loading && !items.length && !error"
        title="当前筛选下没有费用"
        description="可从新建费用开始提交企业直付或员工报销；已提交与已批准的费用会保留在这里。"
        :action-text="canCreate ? '新建费用' : ''"
        @action="openCreate"
      />
      <el-table
        v-else
        v-loading="loading"
        :data="items"
        stripe
        row-key="id"
        class="expense-page__table"
        @row-click="openDetail"
      >
        <el-table-column label="费用单" min-width="245">
          <template #default="{ row }">
            <div class="finance-table__main">
              <span class="finance-table__title">{{ row.expenseNo || '费用编号暂不可确认' }}</span>
              <span class="finance-table__sub">{{ row.category?.name || '费用分类暂不可确认' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类型/归属" min-width="210">
          <template #default="{ row }">
            <StatusTag :text="paymentMeta(row).label" :tone="paymentMeta(row).tone" />
            <span class="finance-table__sub">{{ attributionText(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="归属员工" min-width="125">
          <template #default="{ row }">
            <span>{{ row.owner?.name || '暂不可确认' }}</span>
            <span v-if="row.requester?.id !== row.owner?.id" class="finance-table__sub">提交人 {{ row.requester?.name || '暂不可确认' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="金额" min-width="130" align="right">
          <template #default="{ row }">
            <span class="expense-page__amount">{{ formatAmount(row.amount) }}</span>
            <span class="finance-table__sub">{{ row.expenseDate || '日期暂不可确认' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="115">
          <template #default="{ row }">
            <StatusTag :text="statusMeta(row).label" :tone="statusMeta(row).tone" />
          </template>
        </el-table-column>
        <el-table-column label="审批/下一步" min-width="190">
          <template #default="{ row }">
            <span class="expense-page__approval">{{ approvalText(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="版本/更新" min-width="135">
          <template #default="{ row }">
            <span>第 {{ row.version || 0 }} 版</span>
            <span class="finance-table__sub">{{ formatDateTime(row.updatedAt || row.createdAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="118" fixed="right">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              @click.stop="canEdit(row) ? openEdit(row) : openDetail(row)"
            >
              {{ nextActionLabel(row) }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="total > pageSize" class="finance-pagination">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          @current-change="loadList"
        />
      </div>
    </PanelCard>

    <ExpenseFormDrawer
      v-model:visible="formVisible"
      :item="editing"
      @saved="onSaved"
    />
    <ExpenseDetailDrawer
      v-model:visible="detailVisible"
      :item="selected"
      @edit="openEdit"
      @changed="onChanged"
    />
  </div>
</template>

<style scoped lang="scss">
.expense-page__guide {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $space-3;
  padding: $space-3;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: linear-gradient(125deg, $brand-50 0%, $surface-0 72%);

  > div {
    min-width: 0;
    padding: $space-3 $space-4;
    border-left: 2px solid $brand-200;
  }

  span,
  strong,
  small { display: block; }
  span { color: $brand-600; font-size: $font-caption; font-weight: $font-weight-semibold; }
  strong { margin-top: 5px; color: $text-primary; font-size: $font-body-sm; }
  small { margin-top: 4px; color: $text-tertiary; font-size: $font-caption; line-height: 1.5; }
}

.expense-page__toolbar { flex-wrap: wrap; }
.expense-page__project-filter { width: 240px; }
.expense-page__amount { color: $text-primary; font-weight: $font-weight-semibold; font-variant-numeric: tabular-nums; white-space: nowrap; }
.expense-page__approval { display: block; color: $text-secondary; font-size: $font-caption; line-height: 1.45; }
.expense-page__table :deep(.el-table__row) { cursor: pointer; }

@media (max-width: 1100px) {
  .expense-page__guide { grid-template-columns: 1fr; }
  .expense-page__guide > div { border-left-width: 1px; }
}

@media (max-width: 760px) {
  .finance-page__head { flex-direction: column; }
  .finance-actions { justify-content: flex-start; }
  .expense-page__toolbar > * { width: 100% !important; }
  .expense-page__project-filter { width: 100%; }
}
</style>
