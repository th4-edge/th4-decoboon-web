<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import { ProviderError } from '@/core/http'
import { quoteFinancePage, quoteFinanceReport, type QuoteDesignerAggregate } from '@/domains/trade/api'
import { QUOTE_STATUS_META } from '@/domains/trade/meta'
import type { Quote } from '@/domains/trade/model'
import type { StatusTone } from '@/core/tone'

const router = useRouter()
const aggregates = ref<QuoteDesignerAggregate[]>([])
const quotes = ref<Quote[]>([])
const loading = ref(false)
const error = ref('')

const totalCount = computed(() => aggregates.value.reduce((sum, a) => sum + a.quoteCount, 0))
const totalAmount = computed(() => aggregates.value.reduce((sum, a) => sum + a.quoteAmount, 0))
const totalProfit = computed(() => aggregates.value.reduce((sum, a) => sum + a.profitAmount, 0))
const costIncompleteCount = computed(() => aggregates.value.reduce((sum, a) => sum + a.costIncompleteCount, 0))

const groups = computed(() => {
  const byDesigner = new Map<string, Quote[]>()
  for (const quote of quotes.value) {
    const key = quote.createdBy?.empId ?? ''
    if (!byDesigner.has(key)) byDesigner.set(key, [])
    byDesigner.get(key)!.push(quote)
  }
  return aggregates.value.map((agg) => ({
    agg,
    list: byDesigner.get(agg.designerId) ?? []
  }))
})

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const [agg, page] = await Promise.all([
      quoteFinanceReport(),
      quoteFinancePage({ current: 1, size: 200 })
    ])
    aggregates.value = agg
    quotes.value = page.list
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '报价暂不可确认'
    aggregates.value = []
    quotes.value = []
  } finally {
    loading.value = false
  }
}

function openQuote(quote: Quote): void {
  void router.push(`/finance/quotes/${quote.id}`)
}

function statusMeta(status: Quote['status']): { label: string; tone: StatusTone } {
  return QUOTE_STATUS_META[status] ?? { label: '状态待确认', tone: 'muted' }
}

onMounted(load)
</script>

<template>
  <div class="quotes">
    <header class="quotes__head">
      <div>
        <h1>报价</h1>
        <p>财务只读查看数据范围内的报价金额与成本，按设计师分组；点开复用统一报价视图（REGION / TYPE 双投影）。</p>
      </div>
    </header>

    <section class="kpis">
      <PanelCard>
        <div class="kpi"><div class="kpi__label">报价总数</div><div class="kpi__value">{{ totalCount }}</div></div>
      </PanelCard>
      <PanelCard>
        <div class="kpi"><div class="kpi__label">报价总额</div><div class="kpi__value"><MoneyText :value="totalAmount" /></div></div>
      </PanelCard>
      <PanelCard>
        <div class="kpi"><div class="kpi__label">预计毛利（成本完整部分）</div><div class="kpi__value"><MoneyText :value="totalProfit" /></div><div class="kpi__foot">{{ costIncompleteCount }} 份成本未完整</div></div>
      </PanelCard>
    </section>

    <EmptyState v-if="error" title="报价暂不可确认" :description="error" action-text="重新加载" @action="load" />
    <SkeletonBlock v-else-if="loading" variant="table" :rows="6" />

    <template v-else>
      <section v-for="group in groups" :key="group.agg.designerId" class="group">
        <PanelCard :title="group.agg.designerName">
          <template #extra>
            <div class="group__stats">
              <span>{{ group.agg.quoteCount }} 份报价</span>
              <span>总额 <MoneyText :value="group.agg.quoteAmount" /></span>
              <span>毛利 <MoneyText :value="group.agg.profitAmount" /></span>
              <span v-if="group.agg.costIncompleteCount > 0">{{ group.agg.costIncompleteCount }} 份成本未完整</span>
            </div>
          </template>
          <table class="grid">
            <thead>
              <tr>
                <th>客户 / 房屋</th>
                <th>报价号 · 版本</th>
                <th>状态</th>
                <th class="num">报价金额</th>
                <th class="num">标准成本</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="quote in group.list" :key="quote.id" @click="openQuote(quote)">
                <td>
                  <div class="cell-main">{{ quote.customerName || '客户待确认' }}</div>
                  <div class="cell-sub">{{ quote.propertyName || '房屋待确认' }}</div>
                </td>
                <td>{{ quote.no }}<div class="cell-sub">V{{ quote.version }}</div></td>
                <td><StatusTag :tone="statusMeta(quote.status).tone" :text="statusMeta(quote.status).label" /></td>
                <td class="num"><MoneyText :value="quote.amount" /></td>
                <td class="num"><MoneyText :value="quote.cost ?? null" /></td>
                <td class="go">查看统一视图 →</td>
              </tr>
              <tr v-if="group.list.length === 0">
                <td colspan="6" class="empty-cell">该设计师暂无报价</td>
              </tr>
            </tbody>
          </table>
        </PanelCard>
      </section>

      <EmptyState v-if="groups.length === 0" title="暂无报价" description="当前数据范围内没有报价记录。" />
    </template>
  </div>
</template>

<style scoped lang="scss">
.quotes { max-width: 1200px; margin: 0 auto; padding: 24px; }
.quotes__head { margin-bottom: 20px; }
.quotes__head h1 { font-size: 20px; font-weight: 700; }
.quotes__head p { font-size: 13px; color: var(--th4-text-secondary); margin-top: 4px; }
.kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 20px; }
.kpi { padding: 4px; }
.kpi__label { font-size: 12px; color: var(--th4-text-secondary); }
.kpi__value { font-size: 24px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
.kpi__foot { font-size: 12px; color: var(--th4-text-tertiary); margin-top: 4px; }
.group { margin-bottom: 16px; }
.group__stats { display: flex; gap: 16px; font-size: 12.5px; color: var(--th4-text-secondary); align-items: center; }
.grid { width: 100%; border-collapse: collapse; font-size: 13px; }
.grid th { text-align: left; font-weight: 500; font-size: 12px; color: var(--th4-text-secondary); padding: 10px 12px; border-bottom: 1px solid var(--th4-border-color); white-space: nowrap; }
.grid td { padding: 10px 12px; border-bottom: 1px solid var(--th4-border-color); vertical-align: middle; }
.grid tbody tr { cursor: pointer; }
.grid tbody tr:hover td { background: var(--th4-surface-50); }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.cell-main { font-weight: 600; }
.cell-sub { font-size: 12px; color: var(--th4-text-tertiary); }
.go { text-align: right; font-size: 13px; color: var(--th4-status-progress); font-weight: 500; white-space: nowrap; }
.empty-cell { text-align: center; color: var(--th4-text-tertiary); }
</style>
