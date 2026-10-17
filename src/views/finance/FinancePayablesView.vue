<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import { useFinanceAccess } from '@/domains/finance/access'
import { PAYABLE_STATUS_META, PAYABLE_TYPE_META } from '@/domains/finance/meta'
import type { FinancePayableReport, Payable, PayableStatus, PayableType } from '@/domains/finance/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import FinancePayableDrawer from '@/components/finance/FinancePayableDrawer.vue'
import FinancePaymentDrawer from '@/components/finance/FinancePaymentDrawer.vue'
import { useFinanceScopeStore } from '@/stores/financeScope'

const scope = useFinanceScopeStore()

const props = withDefaults(defineProps<{ salaryMode?: boolean }>(), { salaryMode: false })
const route = useRoute()
const router = useRouter()
const { canWrite, readOnly } = useFinanceAccess()
const items = ref<Payable[]>([])
const report = ref<FinancePayableReport | null>(null)
const loading = ref(false)
const error = ref('')
const keyword = ref('')
const typeFilter = ref<PayableType | ''>(props.salaryMode ? 'salary' : '')
const statusFilter = ref<PayableStatus | ''>('')
const urgentOnly = ref(false)
const projectId = ref('')
const partnerId = ref('')
const page = ref(1)
const pageSize = 50
const total = ref(0)
const drawerVisible = ref(false)
const paymentVisible = ref(false)
const editing = ref<Payable | null>(null)
const paying = ref<Payable | null>(null)

const title = computed(() => props.salaryMode ? '工人工资' : '应付账款')
const subtitle = computed(() => props.salaryMode
  ? '工人工资应付与发放独立管理；员工工资/提成不在本批范围。'
  : '材料款、项目款、供应商款、费用和工人工资形成统一付款义务。')
const typeOptions = Object.entries(PAYABLE_TYPE_META).map(([value, meta]) => ({ value: value as PayableType, label: meta.label }))
const statusOptions = Object.entries(PAYABLE_STATUS_META).map(([value, meta]) => ({ value: value as PayableStatus, label: meta.label }))

onMounted(() => {
  projectId.value = String(route.query.projectId ?? '')
  partnerId.value = String(route.query.partnerId ?? '')
  if (props.salaryMode) typeFilter.value = 'salary'
  void load()
})

/**
 * 门店维度（DEC-067 / P1-a）：切换「全部门店 ↔ 单店」后按门店重新取数，
 * 全部门店时不传 `storeId`（绝不传状态值 '0'）。
 */
watch(() => scope.requestStoreId, () => { void load() })

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const params = {
      projectId: projectId.value || undefined,
      partnerId: partnerId.value || undefined,
      keyword: keyword.value.trim() || undefined,
      type: typeFilter.value || undefined,
      status: statusFilter.value || undefined,
      urgent: urgentOnly.value || undefined,
      storeId: scope.requestStoreId ?? undefined,
      current: page.value,
      size: pageSize
    }
    const [result, totals] = await Promise.all([
      financeApi.payables(params),
      financeApi.payableReport({
        projectId: params.projectId,
        partnerId: params.partnerId,
        keyword: params.keyword,
        type: params.type,
        status: params.status,
        urgent: params.urgent
      })
    ])
    items.value = result.list
    total.value = result.total
    report.value = totals
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '应付账款暂不可确认'
  } finally {
    loading.value = false
  }
}

function resetAndLoad(): void {
  page.value = 1
  void load()
}

function openCreate(): void {
  editing.value = null
  drawerVisible.value = true
}

function openEdit(value: unknown): void {
  if (!canWrite.value) return
  const item = value as Payable
  editing.value = item
  drawerVisible.value = true
}

function openPayment(value: unknown): void {
  const item = value as Payable
  paying.value = item
  paymentVisible.value = true
}

function typeMeta(value: unknown) {
  const item = value as Payable
  return PAYABLE_TYPE_META[item.type]
}

function statusMeta(value: unknown) {
  const item = value as Payable
  return PAYABLE_STATUS_META[item.status]
}


function outstandingText(value: unknown): string {
  const item = value as Payable
  return item.estimated ? '待结算' : `¥${item.outstandingAmount.toFixed(2)}`
}
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">{{ salaryMode ? 'WORKER SALARY · 工人工资' : 'PAYABLE · 应付账款' }}</span>
        <h1>{{ title }}</h1>
        <p>{{ subtitle }}</p>
      </div>
      <div class="finance-actions">
        <el-button @click="load">刷新</el-button>
        <el-button v-if="readOnly" plain disabled>本店财务只读</el-button>
        <el-button v-if="canWrite" type="primary" @click="openCreate">{{ salaryMode ? '新增工人工资' : '新增应付成本' }}</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />

    <section class="finance-kpis">
      <article class="finance-kpi">
        <span>应付总额</span>
        <strong><MoneyText :value="report?.totalAmount" size="lg" /></strong>
        <small>{{ report?.count ?? 0 }} 笔应付</small>
      </article>
      <article class="finance-kpi">
        <span>已付金额</span>
        <strong><MoneyText :value="report?.paidAmount" size="lg" /></strong>
        <small>付款核销结果</small>
      </article>
      <article class="finance-kpi">
        <span>待付金额</span>
        <strong><MoneyText :value="report?.outstandingAmount" size="lg" /></strong>
        <small>需要安排资金</small>
      </article>
      <article class="finance-kpi">
        <span>紧急金额</span>
        <strong><MoneyText :value="report?.urgentAmount" size="lg" /></strong>
        <small>已标记紧急付款</small>
      </article>
    </section>

    <PanelCard flush>
      <div class="finance-toolbar">
        <el-input v-model="keyword" clearable placeholder="搜索应付名称 / 收款方" style="width: 240px" @keyup.enter="resetAndLoad" @clear="resetAndLoad" />
        <el-select v-if="!salaryMode" v-model="typeFilter" clearable placeholder="全部类型" style="width: 140px" @change="resetAndLoad">
          <el-option v-for="option in typeOptions" :key="option.value" :label="option.label" :value="option.value" />
        </el-select>
        <el-select v-model="statusFilter" clearable placeholder="全部状态" style="width: 140px" @change="resetAndLoad">
          <el-option v-for="option in statusOptions" :key="option.value" :label="option.label" :value="option.value" />
        </el-select>
        <el-checkbox v-model="urgentOnly" @change="resetAndLoad">仅看紧急</el-checkbox>
        <el-button @click="resetAndLoad">应用筛选</el-button>
        <span class="finance-toolbar__spacer" />
        <span class="finance-toolbar__result">共 {{ total }} 笔</span>
      </div>

      <SkeletonBlock v-if="loading && !items.length" variant="table" :rows="6" />
      <EmptyState v-else-if="!loading && !items.length" :title="salaryMode ? '暂无工人工资应付' : '暂无应付账款'" :description="salaryMode ? '采购、项目或工资来源形成应付后，会在这里显示。' : '采购到货、项目费用或工资形成应付后，会在这里显示。'" :action-text="canWrite ? (salaryMode ? '新增工人工资' : '新增应付成本') : ''" @action="openCreate" />
      <el-table v-else :data="items" stripe @row-click="openEdit">
        <el-table-column label="应付事项" min-width="230">
          <template #default="{ row }">
            <div class="finance-table__main">
              <span class="finance-table__title">{{ row.name }}</span>
              <span class="finance-table__sub">{{ row.project?.name || '企业通用费用' }} · {{ row.sourceNo || '无来源单号' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="110">
          <template #default="{ row }">
            <StatusTag :text="typeMeta(row).label" :tone="typeMeta(row).tone" />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <StatusTag :text="statusMeta(row).label" :tone="statusMeta(row).tone" />
          </template>
        </el-table-column>
        <el-table-column prop="dueDate" label="到期日" width="120" />
        <el-table-column label="收款方" min-width="140">
          <template #default="{ row }">{{ row.payeeName || row.payeeEmployee?.name || '—' }}</template>
        </el-table-column>
        <el-table-column label="未付金额" width="150" align="right">
          <template #default="{ row }">{{ outstandingText(row) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <div class="finance-actions">
              <el-button v-if="canWrite" link type="primary" :disabled="row.estimated || !row.outstandingAmount" @click.stop="openPayment(row)">安排付款</el-button>
              <el-button link @click.stop="router.push(`/finance/projects/${row.project?.id ?? ''}`)" :disabled="!row.project?.id">项目账本</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="total > pageSize" class="finance-pagination">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="load" />
      </div>
    </PanelCard>

    <FinancePayableDrawer v-model:visible="drawerVisible" :item="editing" :project-id="projectId" :default-type="salaryMode ? 'salary' : 'material'" @saved="load" />
    <FinancePaymentDrawer v-model:visible="paymentVisible" :project-id="paying?.project?.id ?? projectId" :payable-id="paying?.id" @saved="load" />
  </div>
</template>
