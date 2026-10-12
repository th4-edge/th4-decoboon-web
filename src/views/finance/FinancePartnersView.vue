<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import { useFinanceScopeStore } from '@/stores/financeScope'
import type { PartnerLedger, PartnerLedgerReport } from '@/domains/finance/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'

const router = useRouter()
const report = ref<PartnerLedgerReport | null>(null)
const loading = ref(false)
const error = ref('')
const overdueOnly = ref(false)
const keyword = ref('')

const rows = computed(() => (report.value?.rows ?? []).filter((row) => {
  const search = keyword.value.trim().toLowerCase()
  if (!search) return true
  return String(row.partner?.name ?? '').toLowerCase().includes(search)
}))

onMounted(load)
const scope = useFinanceScopeStore()
// P1-a2：切换门店维度后重新取数（全部门店不传参，绝不传状态值 '0'）
watch(() => scope.requestStoreId, () => { void load() })

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    report.value = await financeApi.partnerLedger({ overdueOnly: overdueOnly.value || undefined, storeId: scope.requestStoreId ?? undefined })
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '供应商往来暂不可确认'
  } finally {
    loading.value = false
  }
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

    <section class="finance-kpis">
      <article class="finance-kpi">
        <span>往来供应商</span>
        <strong>{{ report?.partnerCount ?? '—' }}</strong>
        <small>当前企业数据范围</small>
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
        <small>需要优先安排付款</small>
      </article>
    </section>

    <PanelCard flush>
      <div class="finance-toolbar">
        <el-input v-model="keyword" clearable placeholder="搜索供应商" style="width: 240px" />
        <el-checkbox v-model="overdueOnly" @change="load">仅看逾期</el-checkbox>
        <span class="finance-toolbar__spacer" />
        <span class="finance-toolbar__result">共 {{ rows.length }} 家供应商</span>
      </div>

      <SkeletonBlock v-if="loading && !report" variant="table" :rows="6" />
      <EmptyState v-else-if="!loading && !rows.length" title="暂无供应商往来" description="采购到货生成应付后，这里会按供应商归集待付与账期。" action-text="刷新往来" @action="load" />
      <el-table v-else :data="rows" stripe @row-click="openPayables">
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
    </PanelCard>
  </div>
</template>
