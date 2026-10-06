<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import type { Voucher, VoucherReport, VoucherStatus, VoucherType } from '@/domains/finance/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'

const route = useRoute()
const router = useRouter()
const items = ref<Voucher[]>([])
const report = ref<VoucherReport | null>(null)
const loading = ref(false)
const error = ref('')
const keyword = ref('')
const typeFilter = ref<VoucherType | ''>('')
const statusFilter = ref<VoucherStatus | ''>('active')
const projectId = ref('')
const dateRange = ref<[string, string] | null>(null)
const page = ref(1)
const pageSize = 50
const total = ref(0)

const filtered = computed(() => items.value)
const typeOptions: Array<{ label: string; value: VoucherType }> = [
  { label: '收款凭证', value: 'receipt' },
  { label: '付款凭证', value: 'payment' }
]
const statusOptions: Array<{ label: string; value: VoucherStatus }> = [
  { label: '有效', value: 'active' },
  { label: '已作废', value: 'voided' }
]

onMounted(() => {
  projectId.value = String(route.query.projectId ?? '')
  void load()
})

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const params = {
      projectId: projectId.value || undefined,
      keyword: keyword.value.trim() || undefined,
      type: typeFilter.value || undefined,
      status: statusFilter.value || undefined,
      startDate: dateRange.value?.[0],
      endDate: dateRange.value?.[1],
      current: page.value,
      size: pageSize
    }
    const [pageResult, summary] = await Promise.all([
      financeApi.vouchers(params),
      financeApi.voucherReport(params)
    ])
    items.value = pageResult.list
    total.value = pageResult.total
    report.value = summary
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '收付凭证暂不可确认'
  } finally {
    loading.value = false
  }
}

function resetAndLoad(): void {
  page.value = 1
  void load()
}

function openVoucher(value: unknown): void {
  const item = value as Voucher
  if (!item.url) {
    ElMessage.warning('凭证地址已过期，请刷新后重试')
    return
  }
  window.open(item.url, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">VOUCHER · 凭证据款</span>
        <h1>收付凭证</h1>
        <p>凭证是款项记录的打印载体，金额取来源记录，重复打印读取原凭证号；不等于法定会计凭证。</p>
      </div>
      <div class="finance-actions">
        <el-button @click="load">刷新</el-button>
        <el-button @click="router.push('/finance/voucher-templates')">凭证模板</el-button>
        <el-button type="primary" @click="router.push('/finance/ledger')">去资金台账出凭证</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />

    <section class="finance-kpis">
      <article class="finance-kpi">
        <span>凭证数量</span>
        <strong>{{ report?.count ?? 0 }}</strong>
        <small>当前筛选范围</small>
      </article>
      <article class="finance-kpi">
        <span>凭证金额</span>
        <strong><MoneyText :value="report?.totalAmount" size="lg" /></strong>
        <small>来源款项合计</small>
      </article>
      <article class="finance-kpi">
        <span>收款凭证</span>
        <strong><MoneyText :value="report?.receiptAmount" size="lg" /></strong>
        <small>客户收款归档</small>
      </article>
      <article class="finance-kpi">
        <span>付款凭证</span>
        <strong><MoneyText :value="report?.paymentAmount" size="lg" /></strong>
        <small>业务付款与工资归档</small>
      </article>
    </section>

    <PanelCard flush>
      <div class="finance-toolbar">
        <el-input v-model="keyword" clearable placeholder="搜索凭证号 / 对方 / 项目" style="width: 240px" @keyup.enter="resetAndLoad" @clear="resetAndLoad" />
        <el-select v-model="typeFilter" clearable placeholder="全部类型" style="width: 130px" @change="resetAndLoad">
          <el-option v-for="option in typeOptions" :key="option.value" :label="option.label" :value="option.value" />
        </el-select>
        <el-select v-model="statusFilter" clearable placeholder="全部状态" style="width: 130px" @change="resetAndLoad">
          <el-option v-for="option in statusOptions" :key="option.value" :label="option.label" :value="option.value" />
        </el-select>
        <el-date-picker v-model="dateRange" type="daterange" value-format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" style="width: 250px" @change="resetAndLoad" />
        <el-button @click="resetAndLoad">应用筛选</el-button>
        <span class="finance-toolbar__spacer" />
        <span class="finance-toolbar__result">共 {{ total }} 张</span>
      </div>

      <SkeletonBlock v-if="loading && !items.length" variant="table" :rows="6" />
      <EmptyState v-else-if="!loading && !items.length" title="暂无凭证" description="在资金台账选择有效款项记录并生成凭证后，会在这里归档。" action-text="去资金台账" @action="router.push('/finance/ledger')" />
      <el-table v-else :data="filtered" stripe @row-click="openVoucher">
        <el-table-column label="凭证" min-width="240">
          <template #default="{ row }">
            <div class="finance-table__main">
              <span class="finance-table__title">{{ row.voucherNo }}</span>
              <span class="finance-table__sub">{{ row.title }} · {{ row.project?.name || '企业通用' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="110">
          <template #default="{ row }">
            <StatusTag :text="row.type === 'receipt' ? '收款' : '付款'" :tone="row.type === 'receipt' ? 'done' : 'pending'" />
          </template>
        </el-table-column>
        <el-table-column prop="partyName" label="对方" min-width="150" show-overflow-tooltip />
        <el-table-column label="工人" width="120">
          <template #default="{ row }">{{ row.worker?.name || '—' }}</template>
        </el-table-column>
        <el-table-column prop="generatedAt" label="生成时间" min-width="170" show-overflow-tooltip />
        <el-table-column label="金额" width="150" align="right">
          <template #default="{ row }"><MoneyText :value="row.totalAmount" /></template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <StatusTag :text="row.status === 'active' ? '有效' : '已作废'" :tone="row.status === 'active' ? 'done' : 'muted'" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }"><el-button link type="primary" @click.stop="openVoucher(row)">查看 / 打印</el-button></template>
        </el-table-column>
      </el-table>
      <div v-if="total > pageSize" class="finance-pagination">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="load" />
      </div>
    </PanelCard>
  </div>
</template>
