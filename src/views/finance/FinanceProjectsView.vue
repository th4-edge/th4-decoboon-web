<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import { PROJECT_STATUS_LABEL } from '@/domains/finance/meta'
import type { FinanceProjectReport, FinanceSummary } from '@/domains/finance/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import CostIncompleteValue from '@/components/CostIncompleteValue.vue'

type Filter = 'all' | 'risk' | 'settle'
const router = useRouter()
const items = ref<FinanceProjectReport[]>([])
const summary = ref<FinanceSummary | null>(null)
const loading = ref(false)
const error = ref('')
const filter = ref<Filter>('all')
const keyword = ref('')
const total = ref(0)

const filtered = computed(() => items.value.filter((item) => {
  const search = keyword.value.trim().toLowerCase()
  if (search && ![item.project.name, item.project.no, item.project.address].some((value) => String(value ?? '').toLowerCase().includes(search))) {
    return false
  }
  if (filter.value === 'risk') return item.overdueAmount > 0 || item.unpaidAmount > 0 || !item.costComplete
  if (filter.value === 'settle') return item.settlement?.status === 'draft' || item.settlement?.status === 'confirmed' || (!item.settlement && item.project.status === 'finished')
  return true
}))

onMounted(load)

function openProject(row: FinanceProjectReport): void {
  void router.push(`/finance/projects/${row.project.id}`)
}

function rowClassName({ row }: { row: FinanceProjectReport }): string {
  return row.overdueAmount > 0 || !row.costComplete ? 'finance-risk-row' : ''
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const [page, overview] = await Promise.all([
      financeApi.projectPage({ keyword: keyword.value.trim() || undefined, size: 100 }),
      financeApi.summary()
    ])
    items.value = page.list
    total.value = page.total
    summary.value = overview
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '项目账本暂不可确认'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">PROJECT LEDGER · 项目核算</span>
        <h1>项目账本</h1>
        <p>逐项目核对合同、回款、成本、应付与利润。成本不完整时只显示缺失提示，不用 0 制造伪利润。</p>
      </div>
      <div class="finance-actions">
        <el-button @click="load">刷新</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />

    <section class="finance-kpis">
      <article class="finance-kpi">
        <span>项目数量</span>
        <strong>{{ summary?.projectCount ?? '—' }}</strong>
        <small>{{ summary?.activeProjectCount ?? 0 }} 个在跑</small>
      </article>
      <article class="finance-kpi">
        <span>合同规模</span>
        <strong><MoneyText :value="summary?.contractAmount" size="lg" /></strong>
        <small>项目合同汇总</small>
      </article>
      <article class="finance-kpi">
        <span>累计回款</span>
        <strong><MoneyText :value="summary?.receivedAmount" size="lg" /></strong>
        <small>回款率 {{ summary?.collectionRate ?? 0 }}%</small>
      </article>
      <article class="finance-kpi">
        <span>成本完整性</span>
        <strong>{{ summary?.costComplete ? '完整' : '待补齐' }}</strong>
        <small v-if="summary?.costComplete">利润与毛利率可确认</small>
        <small v-else>{{ summary?.costIncompleteProjectCount ?? 0 }} 个项目成本未完整</small>
      </article>
    </section>

    <PanelCard flush>
      <div class="finance-toolbar">
        <el-input v-model="keyword" clearable placeholder="搜索项目 / 编号 / 地址" style="width: 260px" @keyup.enter="load" @clear="load" />
        <el-radio-group v-model="filter">
          <el-radio-button value="all">全部项目</el-radio-button>
          <el-radio-button value="risk">资金与成本风险</el-radio-button>
          <el-radio-button value="settle">待结算</el-radio-button>
        </el-radio-group>
        <span class="finance-toolbar__spacer" />
        <span class="finance-toolbar__result">共 {{ total }} 个项目</span>
      </div>

      <SkeletonBlock v-if="loading && !items.length" variant="table" :rows="6" />
      <EmptyState v-else-if="!loading && !items.length" title="暂无项目财务数据" description="合同与项目产生应收、应付和成本后，这里会形成项目账本。" action-text="刷新" @action="load" />
      <el-table v-else :data="filtered" stripe :row-class-name="rowClassName" @row-click="openProject">
        <el-table-column label="项目" min-width="240">
          <template #default="{ row }">
            <div class="finance-table__main">
              <span class="finance-table__title">{{ row.project.name }}</span>
              <span class="finance-table__sub">{{ row.project.no }} · {{ row.project.address || '地址未填' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <StatusTag :text="PROJECT_STATUS_LABEL[row.project.status] ?? row.project.status" :tone="row.project.status === 'settled' ? 'done' : row.project.status === 'finished' ? 'dark' : 'doing'" />
          </template>
        </el-table-column>
        <el-table-column label="合同金额" min-width="140" align="right">
          <template #default="{ row }"><MoneyText :value="row.contractAmount" /></template>
        </el-table-column>
        <el-table-column label="累计回款" min-width="140" align="right">
          <template #default="{ row }"><MoneyText :value="row.receivedAmount" /></template>
        </el-table-column>
        <el-table-column label="待收金额" min-width="140" align="right">
          <template #default="{ row }"><MoneyText :value="row.outstandingAmount" /></template>
        </el-table-column>
        <el-table-column label="应付/未付" min-width="160" align="right">
          <template #default="{ row }">
            <MoneyText :value="row.payableAmount" />
            <span class="finance-table__sub">未付 ¥{{ row.unpaidAmount.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="项目利润" min-width="150" align="right">
          <template #default="{ row }">
            <CostIncompleteValue v-if="!row.costComplete" :hint="`${row.costIncompleteCount} 项成本未完整`" />
            <MoneyText v-else :value="row.profitAmount" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="router.push(`/finance/projects/${row.project.id}`)">项目核算</el-button>
          </template>
        </el-table-column>
      </el-table>
    </PanelCard>
  </div>
</template>

<style scoped>
:deep(.finance-risk-row) {
  --el-table-tr-bg-color: var(--el-color-warning-light-9);
}
</style>
