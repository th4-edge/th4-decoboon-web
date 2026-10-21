<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ProviderError } from '@/core/http'
import { formatDateTime } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import { useFinanceScopeStore } from '@/stores/financeScope'
import type { PartnerLedger, PartnerLedgerReport } from '@/domains/finance/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'

const router = useRouter()
const items = ref<PartnerLedger[]>([])
const report = ref<PartnerLedgerReport | null>(null)
const loading = ref(false)
const error = ref('')
const reportLoading = ref(false)
const reportError = ref('')
const overdueOnly = ref(false)
const keyword = ref('')
const page = ref(1)
const pageSize = 20
const total = ref(0)

onMounted(load)
const scope = useFinanceScopeStore()
// P1-a2：切换门店维度后重新取数（全部门店不传参，绝不传状态值 '0'）
watch(() => scope.requestStoreId, () => { page.value = 1; void load() })

function filters() {
  return {
    keyword: keyword.value.trim() || undefined,
    overdueOnly: overdueOnly.value || undefined,
    storeId: scope.requestStoreId ?? undefined
  }
}

async function load(): Promise<void> {
  await Promise.all([loadList(), loadReport()])
}

async function loadList(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const result = await financeApi.partnerLedgerPage({ ...filters(), current: page.value, size: pageSize })
    items.value = result.list
    total.value = result.total
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '供应商往来暂不可确认'
  } finally {
    loading.value = false
  }
}

async function loadReport(): Promise<void> {
  reportLoading.value = true
  reportError.value = ''
  try {
    report.value = await financeApi.partnerLedger(filters())
  } catch (loadError) {
    report.value = null
    reportError.value = loadError instanceof ProviderError ? loadError.message : '供应商往来汇总暂不可确认'
  } finally {
    reportLoading.value = false
  }
}

function resetAndLoad(): void {
  page.value = 1
  void load()
}

function terms(row: PartnerLedger): string {
  if (!row.partner?.settlementMode) return '账期未维护'
  const mode = row.partner.settlementMode
  return `${mode}${row.partner.settlementDays ? ` · ${row.partner.settlementDays} 天` : ''}`
}

function openPayables(row: PartnerLedger): void {
  const partnerId = row.partner?.id
  void router.push({ path: '/finance/payables', query: partnerId ? { partnerId } : undefined })
}
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">PARTNER · 供应商往来</span>
        <h1>供应商往来台账</h1>
        <p>按供应商聚合应付、已付、待付、逾期与最近到期日，帮助财务用一屏安排账期。</p>
      </div>
      <div class="finance-actions">
        <el-button @click="load">刷新</el-button>
        <el-button type="primary" @click="router.push('/finance/payables')">查看全部应付</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <el-alert v-if="reportError" type="warning" :closable="false" title="供应商往来汇总暂不可确认" show-icon />

    <section class="finance-kpis">
      <article class="finance-kpi">
        <span>往来供应商</span>
        <strong>{{ reportLoading ? '统计中…' : report ? report.partnerCount : '暂不可确认' }}</strong>
        <small>当前数据范围</small>
      </article>
      <article class="finance-kpi">
        <span>应付总额</span>
        <strong><MoneyText :value="report?.payableAmount" size="lg" /></strong>
        <small>供应商应付台账汇总</small>
      </article>
      <article class="finance-kpi">
        <span>待付金额</span>
        <strong><MoneyText :value="report?.outstandingAmount" size="lg" /></strong>
        <small>未结清应付</small>
      </article>
      <article class="finance-kpi">
        <span>逾期金额</span>
        <strong><MoneyText :value="report?.overdueAmount" size="lg" /></strong>
        <small>数据截止 {{ formatDateTime(report?.asOf) }}</small>
      </article>
    </section>

    <PanelCard flush>
      <div class="finance-toolbar">
        <el-input v-model="keyword" clearable placeholder="搜索供应商" style="width: 240px" @keyup.enter="resetAndLoad" @clear="resetAndLoad" />
        <el-checkbox v-model="overdueOnly" @change="resetAndLoad">仅看逾期</el-checkbox>
        <el-button @click="resetAndLoad">应用筛选</el-button>
        <span class="finance-toolbar__spacer" />
        <span class="finance-toolbar__result">{{ reportError ? '家数暂不可确认' : reportLoading ? '统计中…' : report ? `共 ${report.partnerCount} 家供应商` : '家数暂不可确认' }}</span>
      </div>

      <SkeletonBlock v-if="loading && !items.length" variant="table" :rows="6" />
      <EmptyState v-else-if="!loading && !items.length" title="暂无供应商往来" description="采购到货生成应付后，这里会按供应商归集待付与账期。" action-text="刷新往来" @action="load" />
      <el-table v-else :data="items" stripe @row-click="openPayables">
        <el-table-column label="供应商" min-width="220">
          <template #default="{ row }">
            <div class="finance-table__main">
              <span class="finance-table__title">{{ row.partner?.name || '未命名供应商' }}</span>
              <span class="finance-table__sub">{{ terms(row) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="应付金额" min-width="140" align="right">
          <template #default="{ row }"><MoneyText :value="row.payableAmount" /></template>
        </el-table-column>
        <el-table-column label="已付金额" min-width="140" align="right">
          <template #default="{ row }"><MoneyText :value="row.paidAmount" /></template>
        </el-table-column>
        <el-table-column label="待付金额" min-width="140" align="right">
          <template #default="{ row }"><MoneyText :value="row.outstanding" /></template>
        </el-table-column>
        <el-table-column label="逾期金额" min-width="140" align="right">
          <template #default="{ row }"><MoneyText :value="row.overdueAmount" /></template>
        </el-table-column>
        <el-table-column prop="pendingCount" label="未结清" width="90" align="center" />
        <el-table-column prop="nearestDueDate" label="最近到期" width="120" />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="openPayables(row)">应付明细</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="total > pageSize" class="finance-pagination">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="loadList" />
      </div>
    </PanelCard>
  </div>
</template>
