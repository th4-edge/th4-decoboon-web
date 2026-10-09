<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import { useFinanceAccess } from '@/domains/finance/access'
import { ACCOUNT_LABEL, DIRECTION_META, LEDGER_PURPOSE_META } from '@/domains/finance/meta'
import type { FinanceLedgerReport, Ledger, LedgerDirection } from '@/domains/finance/model'
import { monthStart } from '@/domains/finance/format'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import FinanceLedgerDrawer from '@/components/finance/FinanceLedgerDrawer.vue'
import { notifyBlocked } from '@/core/blockedNotice'

const { canWrite, canCorrect, readOnly } = useFinanceAccess()
const items = ref<Ledger[]>([])
const report = ref<FinanceLedgerReport>({ count: 0, totalAmount: 0, incomeAmount: 0, expenseAmount: 0, netCashFlowAmount: 0 })
const loading = ref(false)
const error = ref('')
const keyword = ref('')
const direction = ref<LedgerDirection | ''>('')
const dateRange = ref<[string, string]>([monthStart(), new Date().toISOString().slice(0, 10)])
const page = ref(1)
const pageSize = 50
const total = ref(0)
const drawerVisible = ref(false)
const editing = ref<Ledger | null>(null)
const selectedIds = ref<string[]>([])
const voucherBusy = ref(false)

const selectedRows = computed(() => items.value.filter((item) => selectedIds.value.includes(item.id)))
const selectedTotal = computed(() => selectedRows.value.reduce((sum, item) => sum + item.amount, 0))

onMounted(load)

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const params = {
      keyword: keyword.value.trim() || undefined,
      direction: direction.value || undefined,
      startDate: dateRange.value?.[0] || undefined,
      endDate: dateRange.value?.[1] || undefined,
      current: page.value,
      size: pageSize
    }
    const [pageResult, summary] = await Promise.all([
      financeApi.ledgers(params),
      financeApi.ledgerReport(params)
    ])
    items.value = pageResult.list
    total.value = pageResult.total
    report.value = summary
    selectedIds.value = []
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '资金台账暂不可确认'
  } finally {
    loading.value = false
  }
}

function resetAndLoad(): void {
  page.value = 1
  void load()
}

function openCreate(): void {
  if (!canWrite.value) return
  editing.value = null
  drawerVisible.value = true
}

function openCorrect(value: unknown): void {
  const item = value as Ledger
  if (!canCorrect.value || item.source !== 'manual' || item.correctionGroupId) return
  editing.value = item
  drawerVisible.value = true
}

function onSelectionChange(rows: Ledger[]): void {
  selectedIds.value = rows.map((row) => row.id)
}

function directionMeta(value: unknown) {
  const item = value as Ledger
  return DIRECTION_META[item.direction]
}

function purposeLabel(value: unknown): string {
  const item = value as Ledger
  return item.purpose ? LEDGER_PURPOSE_META[item.purpose].label : '来源单据'
}

function accountLabel(value: unknown): string {
  const item = value as Ledger
  return ACCOUNT_LABEL[item.account]
}

async function buildVoucher(): Promise<void> {
  if (!canWrite.value) {
    ElMessage.warning('当前角色无凭证生成权限')
    return
  }
  if (!selectedIds.value.length) {
    notifyBlocked({
      title: '请先选择款项记录',
      message: '先在台账中勾选要生成凭证的款项记录，再生成凭证。'
    })
    return
  }
  voucherBusy.value = true
  try {
    const voucher = await financeApi.buildVoucher(selectedIds.value)
    if (!voucher.url) throw new Error('凭证地址为空')
    window.open(voucher.url, '_blank', 'noopener,noreferrer')
    ElMessage.success(`凭证 ${voucher.voucherNo} 已生成`)
    await load()
  } catch (buildError) {
    ElMessage.error(buildError instanceof ProviderError ? buildError.message : '凭证生成失败，暂不可确认')
  } finally {
    voucherBusy.value = false
  }
}

async function removeLedger(value: unknown): Promise<void> {
  const item = value as Ledger
  if (!canCorrect.value || item.source !== 'manual') return
  let reason = ''
  try {
    const result = await ElMessageBox.prompt('删除会保留冲正留痕，请输入删除原因。', '删除手工流水', {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      inputPlaceholder: '删除原因',
      inputValidator: (value: string) => Boolean(value?.trim()) || '删除原因不能为空'
    })
    reason = result.value.trim()
  } catch {
    return
  }
  try {
    await financeApi.deleteLedger(item.id, reason)
    ElMessage.success('手工流水已删除并留痕')
    await load()
  } catch (removeError) {
    ElMessage.error(removeError instanceof ProviderError ? removeError.message : '删除失败，暂不可确认')
  }
}
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">LEDGER · 资金事实</span>
        <h1>资金台账</h1>
        <p>收付款、手工记账与冲正统一进入台账；桌面端支持多选同类流水批量生成凭证。</p>
      </div>
      <div class="finance-actions">
        <el-button @click="load">刷新</el-button>
        <el-button v-if="readOnly" plain disabled>本店财务只读</el-button>
        <el-button v-if="canWrite" @click="buildVoucher" :loading="voucherBusy" :disabled="!selectedIds.length">批量生成凭证</el-button>
        <el-button v-if="canWrite" type="primary" @click="openCreate">手工记账</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />

    <section class="finance-kpis">
      <article class="finance-kpi">
        <span>筛选流水</span>
        <strong>{{ report.count }}</strong>
        <small>收入 {{ report.incomeAmount.toFixed(2) }} · 支出 {{ report.expenseAmount.toFixed(2) }}</small>
      </article>
      <article class="finance-kpi">
        <span>净现金流</span>
        <strong><MoneyText :value="report.netCashFlowAmount" size="lg" /></strong>
        <small>同一筛选范围</small>
      </article>
      <article class="finance-kpi">
        <span>已选记录</span>
        <strong>{{ selectedIds.length }}</strong>
        <small>同组合并规则由服务端校验</small>
      </article>
      <article class="finance-kpi">
        <span>已选金额</span>
        <strong><MoneyText :value="selectedTotal" size="lg" /></strong>
        <small>凭证金额取来源款项，不二次计算</small>
      </article>
    </section>

    <PanelCard flush>
      <div class="finance-toolbar">
        <el-input v-model="keyword" clearable placeholder="搜索摘要 / 对方" style="width: 220px" @keyup.enter="resetAndLoad" @clear="resetAndLoad" />
        <el-select v-model="direction" clearable placeholder="全部方向" style="width: 130px" @change="resetAndLoad">
          <el-option label="收入" value="income" />
          <el-option label="支出" value="expense" />
        </el-select>
        <el-date-picker v-model="dateRange" type="daterange" value-format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" style="width: 260px" @change="resetAndLoad" />
        <el-button @click="resetAndLoad">应用筛选</el-button>
        <span class="finance-toolbar__spacer" />
        <span class="finance-toolbar__result">共 {{ total }} 条</span>
      </div>

      <SkeletonBlock v-if="loading && !items.length" variant="table" :rows="6" />
      <EmptyState v-else-if="!loading && !items.length" title="暂无资金流水" description="登记收款、付款或手工记账后，这里会形成资金事实。" :action-text="canWrite ? '手工记账' : ''" @action="openCreate" />
      <el-table v-else :data="items" stripe @selection-change="onSelectionChange">
        <el-table-column type="selection" width="48" />
        <el-table-column prop="occurredAt" label="发生日期" width="120" />
        <el-table-column label="方向" width="90">
          <template #default="{ row }">
            <StatusTag :text="directionMeta(row).label" :tone="directionMeta(row).tone" />
          </template>
        </el-table-column>
        <el-table-column label="摘要" min-width="210">
          <template #default="{ row }">
            <div class="finance-table__main">
              <span class="finance-table__title">{{ row.summary }}</span>
              <span class="finance-table__sub">{{ row.project?.name || '企业通用' }} · {{ row.category || '未分类' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="用途" width="130">
          <template #default="{ row }">{{ purposeLabel(row) }}</template>
        </el-table-column>
        <el-table-column label="账户" width="110">
          <template #default="{ row }">{{ accountLabel(row) }}</template>
        </el-table-column>
        <el-table-column prop="counterparty" label="对方" min-width="130" show-overflow-tooltip />
        <el-table-column label="金额" width="150" align="right">
          <template #default="{ row }">
            <MoneyText :value="row.direction === 'income' ? row.amount : -row.amount" delta />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button v-if="canCorrect && row.source === 'manual' && !row.correctionGroupId" link type="primary" @click.stop="openCorrect(row)">更正</el-button>
            <el-button v-if="canCorrect && row.source === 'manual'" link type="danger" @click.stop="removeLedger(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="total > pageSize" class="finance-pagination">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="load" />
      </div>
    </PanelCard>

    <FinanceLedgerDrawer v-model:visible="drawerVisible" :item="editing" @saved="load" />
  </div>
</template>
