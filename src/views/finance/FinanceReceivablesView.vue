<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ProviderError } from '@/core/http'
import { formatDateTime } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import { useFinanceAccess } from '@/domains/finance/access'
import { RECEIVABLE_STATUS_META, RECEIVABLE_TYPE_META } from '@/domains/finance/meta'
import type { FinanceReceivableReport, Receivable, ReceivableStatus, ReceivableType } from '@/domains/finance/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import FinanceReceivableDrawer from '@/components/finance/FinanceReceivableDrawer.vue'
import FinanceCollectionDrawer from '@/components/finance/FinanceCollectionDrawer.vue'
import { useFinanceScopeStore } from '@/stores/financeScope'

const scope = useFinanceScopeStore()

const route = useRoute()
const router = useRouter()
const { canWrite, readOnly } = useFinanceAccess()
const items = ref<Receivable[]>([])
const report = ref<FinanceReceivableReport | null>(null)
const loading = ref(false)
const error = ref('')
const reportLoading = ref(false)
const reportError = ref('')
const keyword = ref('')
const typeFilter = ref<ReceivableType | ''>('')
const statusFilter = ref<ReceivableStatus | ''>('')
const projectId = ref('')
const page = ref(1)
const pageSize = 50
const total = ref(0)
const receivableDrawer = ref(false)
const collectionDrawer = ref(false)
const editing = ref<Receivable | null>(null)
const collecting = ref<Receivable | null>(null)

const typeOptions = Object.entries(RECEIVABLE_TYPE_META).map(([value, meta]) => ({ value: value as ReceivableType, label: meta.label }))
const statusOptions = Object.entries(RECEIVABLE_STATUS_META).map(([value, meta]) => ({ value: value as ReceivableStatus, label: meta.label }))

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
    const result = await financeApi.receivables({
      projectId: projectId.value || undefined,
      keyword: keyword.value.trim() || undefined,
      type: typeFilter.value || undefined,
      status: statusFilter.value || undefined,
      storeId: scope.requestStoreId ?? undefined,
      current: page.value,
      size: pageSize
    })
    items.value = result.list
    total.value = result.total
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '应收计划暂不可确认'
  } finally {
    loading.value = false
  }
}

async function loadReport(): Promise<void> {
  reportLoading.value = true
  reportError.value = ''
  try {
    report.value = await financeApi.receivableReport({
      projectId: projectId.value || undefined,
      keyword: keyword.value.trim() || undefined,
      type: typeFilter.value || undefined,
      status: statusFilter.value || undefined,
      storeId: scope.requestStoreId ?? undefined
    })
  } catch (loadError) {
    report.value = null
    reportError.value = loadError instanceof ProviderError ? loadError.message : '应收汇总暂不可确认'
  } finally {
    reportLoading.value = false
  }
}

function resetAndLoad(): void {
  page.value = 1
  void load()
}

function openCreate(): void {
  editing.value = null
  receivableDrawer.value = true
}

function openEdit(value: unknown): void {
  if (!canWrite.value) return
  const item = value as Receivable
  editing.value = item
  receivableDrawer.value = true
}

function collect(value: unknown): void {
  const item = value as Receivable
  collecting.value = item
  collectionDrawer.value = true
}

function progress(value: unknown): number {
  const item = value as Receivable
  return Math.min(100, Math.round(item.receivedAmount / Math.max(item.amount, 1) * 100))
}

function typeMeta(value: unknown) {
  const item = value as Receivable
  return RECEIVABLE_TYPE_META[item.type]
}

function statusMeta(value: unknown) {
  const item = value as Receivable
  return RECEIVABLE_STATUS_META[item.status]
}
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">RECEIVABLE · 合同应收</span>
        <h1>应收计划</h1>
        <p>按首期款、进度款、尾款和质保金跟踪；逾期优先，登记收款后由系统完成核销与台账写入。</p>
      </div>
      <div class="finance-actions">
        <el-button @click="resetAndLoad">刷新</el-button>
        <el-button v-if="readOnly" plain disabled>本店财务只读</el-button>
        <el-button v-if="canWrite" type="primary" @click="openCreate">新增应收节点</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <el-alert v-if="reportError" type="warning" :closable="false" title="应收汇总暂不可确认" show-icon />

    <section class="finance-kpis">
      <article class="finance-kpi">
        <span>应收总额</span>
        <strong><MoneyText :value="report?.totalAmount" size="lg" /></strong>
        <small>{{ reportLoading ? '汇总加载中…' : '当前筛选条件下的全部应收' }}</small>
      </article>
      <article class="finance-kpi">
        <span>累计已收</span>
        <strong><MoneyText :value="report?.receivedAmount" size="lg" /></strong>
        <small>收款核销结果</small>
      </article>
      <article class="finance-kpi">
        <span>待收金额</span>
        <strong><MoneyText :value="report?.outstandingAmount" size="lg" /></strong>
        <small>未结清应收</small>
      </article>
      <article class="finance-kpi">
        <span>逾期金额</span>
        <strong><MoneyText :value="report?.overdueAmount" size="lg" /></strong>
        <small>数据截止 {{ formatDateTime(report?.asOf) }}</small>
      </article>
    </section>

    <PanelCard flush>
      <div class="finance-toolbar">
        <el-input v-model="keyword" clearable placeholder="搜索节点 / 项目" style="width: 240px" @keyup.enter="resetAndLoad" @clear="resetAndLoad" />
        <el-select v-model="typeFilter" clearable placeholder="全部类型" style="width: 140px" @change="resetAndLoad">
          <el-option v-for="option in typeOptions" :key="option.value" :label="option.label" :value="option.value" />
        </el-select>
        <el-select v-model="statusFilter" clearable placeholder="全部状态" style="width: 140px" @change="resetAndLoad">
          <el-option v-for="option in statusOptions" :key="option.value" :label="option.label" :value="option.value" />
        </el-select>
        <el-button @click="resetAndLoad">应用筛选</el-button>
        <span class="finance-toolbar__spacer" />
        <span class="finance-toolbar__result">{{ reportError ? '笔数暂不可确认' : reportLoading ? '统计中…' : report ? `共 ${report.count} 条应收节点` : '笔数暂不可确认' }}</span>
      </div>

      <SkeletonBlock v-if="loading && !items.length" variant="table" :rows="6" />
      <EmptyState v-else-if="!loading && !items.length" title="暂无应收节点" description="从合同或项目资金计划新增应收后，这里会形成催收列表。" :action-text="canWrite ? '新增应收节点' : ''" @action="openCreate" />
      <el-table v-else :data="items" stripe @row-click="openEdit">
        <el-table-column label="应收节点" min-width="210">
          <template #default="{ row }">
            <div class="finance-table__main">
              <span class="finance-table__title">{{ row.name }}</span>
              <span class="finance-table__sub">{{ row.project.name }} · {{ row.project.no }}</span>
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
        <el-table-column label="回款进度" min-width="190">
          <template #default="{ row }">
            <div class="finance-table__sub">已收 ¥{{ row.receivedAmount.toFixed(2) }} / ¥{{ row.amount.toFixed(2) }} · {{ progress(row) }}%</div>
            <el-progress :percentage="progress(row)" :show-text="false" :stroke-width="7" />
          </template>
        </el-table-column>
        <el-table-column label="待收金额" width="140" align="right">
          <template #default="{ row }"><MoneyText :value="row.outstandingAmount" /></template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <div class="finance-actions">
              <el-button v-if="canWrite" link type="primary" @click.stop="collect(row)">登记收款</el-button>
              <el-button link @click.stop="router.push(`/finance/projects/${row.project.id}`)">项目账本</el-button>
            </div>
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

    <FinanceReceivableDrawer v-model:visible="receivableDrawer" :item="editing" :project-id="projectId" @saved="load" />
    <FinanceCollectionDrawer
      v-model:visible="collectionDrawer"
      :project-id="collecting?.project.id"
      :receivable-id="collecting?.id"
      @saved="load"
    />
  </div>
</template>
