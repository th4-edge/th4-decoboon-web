<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import MoneyText from '@/components/MoneyText.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import { ProviderError } from '@/core/http'
import { quoteFinancePage, quoteFinanceSummary, type QuoteFinanceSummary } from '@/domains/trade/api'
import { QUOTE_STATUS_META } from '@/domains/trade/meta'
import type { Quote } from '@/domains/trade/model'
import type { StatusTone } from '@/core/tone'

const router = useRouter()
const summary = ref<QuoteFinanceSummary | null>(null)
const quotes = ref<Quote[]>([])
const loading = ref(false)
const error = ref('')
const reportError = ref('')
const currentPage = ref(1)
const pageSize = 20
const pageTotal = ref(0)

const totalCount = computed(() => reportError.value ? null : summary.value?.quoteCount ?? null)
const totalAmount = computed(() => reportError.value ? null : summary.value?.quoteAmount ?? null)
const totalProfit = computed(() => reportError.value ? null : summary.value?.profitAmount ?? null)
const costIncompleteCount = computed(() => reportError.value ? null : summary.value?.costIncompleteCount ?? null)

async function load(page = 1): Promise<void> {
  loading.value = true
  error.value = ''
  reportError.value = ''
  try {
    const [reportResult, pageResult] = await Promise.allSettled([
      quoteFinanceSummary(),
      quoteFinancePage({ current: page, size: pageSize })
    ])
    if (reportResult.status === 'fulfilled') {
      summary.value = reportResult.value
    } else {
      summary.value = null
      reportError.value = reportResult.reason instanceof ProviderError ? reportResult.reason.message : '报价汇总暂不可确认'
    }
    if (pageResult.status === 'rejected') {
      throw pageResult.reason
    }
    quotes.value = pageResult.value.list
    pageTotal.value = pageResult.value.total
    currentPage.value = pageResult.value.current
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '报价记录暂不可确认'
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

onMounted(() => void load(1))
</script>

<template>
  <div class="quotes">
    <header class="quotes__head">
      <div>
        <h1>报价</h1>
        <p>查看当前数据范围内的报价、标准成本和成本完整性；点开报价可核对明细与版本。</p>
      </div>
    </header>

    <section class="kpis">
      <div class="kpi"><div class="kpi__label">报价总数</div><div class="kpi__value"><template v-if="totalCount !== null">{{ totalCount }}<small> 份</small></template><template v-else>—</template></div><div class="kpi__foot">当前数据范围</div></div>
      <div class="kpi"><div class="kpi__label">报价总额</div><div class="kpi__value"><MoneyText :value="totalAmount ?? undefined" /></div><div class="kpi__foot">按当前数据范围汇总</div></div>
      <div class="kpi"><div class="kpi__label">成本未完整</div><div class="kpi__value"><template v-if="costIncompleteCount !== null">{{ costIncompleteCount }}<small> 份</small></template><template v-else>—</template></div><div class="kpi__foot">成本未完整时不计算利润</div></div>
      <div class="kpi kpi--accent"><div class="kpi__label">预计毛利（成本完整部分）</div><div class="kpi__value"><MoneyText :value="totalProfit ?? undefined" /></div><div class="kpi__foot">仅汇总成本完整的报价</div></div>
    </section>

    <div v-if="reportError" class="report-warning">报价汇总暂不可确认：{{ reportError }}</div>

    <EmptyState v-if="error" title="报价暂不可确认" :description="error" action-text="重新加载" @action="load" />
    <SkeletonBlock v-else-if="loading" variant="table" :rows="6" />

    <template v-else>
      <section class="quote-table-wrap">
        <div class="quote-table__head">
          <div><strong>报价记录</strong><span>第 {{ currentPage }} 页 · 共 {{ pageTotal }} 份</span></div>
          <span>金额与成本来自当前财务数据范围</span>
        </div>
        <div v-if="quotes.length" class="rows">
          <div class="row row--header">
            <span>客户 / 房屋</span><span>报价</span><span>设计师</span><span>状态</span><span>报价金额</span><span>标准成本</span><span>成本状态</span><span></span>
          </div>
          <div v-for="quote in quotes" :key="quote.id" class="row row--data" @click="openQuote(quote)">
            <div class="cust"><div class="cust__name">{{ quote.customerName || '客户待确认' }}</div><div class="cust__house">{{ quote.propertyName || '房屋待确认' }}</div></div>
            <div class="qno">{{ quote.title || '报价记录' }}<div class="qno__v">V{{ quote.version }}</div></div>
            <div class="designer">{{ quote.createdBy?.name || '设计师待确认' }}</div>
            <div><StatusTag :tone="statusMeta(quote.status).tone" :text="statusMeta(quote.status).label" /></div>
            <div class="amt"><MoneyText :value="quote.amount" /></div>
            <div class="amt"><MoneyText :value="quote.cost ?? null" /></div>
            <div class="cost-state" :class="{ 'cost-state--incomplete': !quote.costComplete }">{{ quote.costComplete ? '完整' : '未完整' }}</div>
            <div class="go">查看明细</div>
          </div>
        </div>
        <EmptyState v-else title="暂无报价" description="当前数据范围内没有报价记录。" />
        <div v-if="pageTotal > pageSize" class="pager">
          <el-pagination background layout="prev, pager, next" :current-page="currentPage" :page-size="pageSize" :total="pageTotal" @current-change="load" />
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
.quotes { max-width: 1200px; margin: 0 auto; padding: 24px; }
.quotes__head { margin-bottom: 20px; }
.quotes__head h1 { font-size: $font-h1; font-weight: $font-weight-bold; }
.quotes__head p { font-size: $font-body-sm; color: $text-secondary; margin-top: 4px; max-width: 720px; }

.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
.kpi { background: $surface-0; border: 1px solid $border-color; border-radius: $radius-md; padding: 16px 18px; box-shadow: $shadow-card; }
.kpi__label { font-size: 12.5px; color: $text-secondary; }
.kpi__value { font-size: $font-kpi; font-weight: $font-weight-bold; letter-spacing: -.5px; margin-top: 6px; font-variant-numeric: tabular-nums; }
.kpi__value small { font-size: 15px; font-weight: $font-weight-semibold; color: $text-secondary; }
.kpi__foot { font-size: $font-caption; color: $text-tertiary; margin-top: 4px; }
.kpi--accent { background: linear-gradient(135deg, $brand-600, $brand-500); border: none; }
.kpi--accent .kpi__label, .kpi--accent .kpi__foot { color: rgba(255, 255, 255, .75); }
.kpi--accent .kpi__value { color: $surface-0; }
.kpi--accent .kpi__value small { color: rgba(255, 255, 255, .7); }

.report-warning { margin: -4px 0 16px; padding: 10px 14px; border: 1px solid $warning-200; border-radius: $radius-sm; background: $warning-50; color: $warning-700; font-size: $font-body-sm; }
.quote-table-wrap { overflow: hidden; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; box-shadow: $shadow-card; }
.quote-table__head { display: flex; align-items: center; justify-content: space-between; gap: $space-4; padding: 14px 18px; border-bottom: 1px solid $border-color; }
.quote-table__head strong { display: block; color: $text-primary; font-size: $font-card-title; }
.quote-table__head span { color: $text-tertiary; font-size: $font-caption; }
.rows { width: 100%; }
.row { display: grid; grid-template-columns: minmax(180px, 1.4fr) 150px minmax(100px, .7fr) 90px 120px 120px 80px 76px; gap: 14px; align-items: center; padding: 12px 18px; border-bottom: 1px solid $surface-100; }
.row--header { padding-top: 10px; padding-bottom: 10px; color: $text-tertiary; background: $surface-50; font-size: $font-caption; }
.row--data { cursor: pointer; }
.row--data:hover { background: $brand-50; }
.row:last-child { border-bottom: none; }
.cust__name { font-size: $font-body; font-weight: $font-weight-semibold; }
.cust__house { font-size: $font-caption; color: $text-tertiary; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qno { font-size: $font-body-sm; font-weight: $font-weight-medium; }
.qno__v { font-size: $font-caption; color: $text-tertiary; }
.designer { color: $text-secondary; font-size: $font-body-sm; }
.amt { text-align: right; font-variant-numeric: tabular-nums; }
.cost-state { color: $success-500; font-size: $font-caption; font-weight: $font-weight-semibold; }
.cost-state--incomplete { color: $warning-700; }
.go { text-align: right; font-size: $font-body-sm; color: $brand-600; font-weight: $font-weight-medium; white-space: nowrap; }
.pager { display: flex; justify-content: flex-end; padding: 14px 18px; border-top: 1px solid $border-color; }
@media (max-width: 1100px) {
  .kpis { grid-template-columns: repeat(2, 1fr); }
  .quote-table-wrap { overflow-x: auto; }
  .rows { min-width: 980px; }
}
</style>
