<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import StatusTag from '@/components/StatusTag.vue'
import MoneyText from '@/components/MoneyText.vue'
import WorkbenchState from '@/components/workbench/WorkbenchState.vue'
import { formatDateTime } from '@/core/format'
import type { StatusTone } from '@/core/tone'
import { quoteHistoryPage } from '@/domains/trade/api'
import type { Quote, QuoteStatus } from '@/domains/trade/model'

const router = useRouter()
const PAGE_SIZE = 20
const FILTERS: Array<{ key: '' | QuoteStatus; label: string }> = [
  { key: '', label: '全部状态' },
  { key: 'draft', label: '草稿' },
  { key: 'submitted', label: '待客户确认' },
  { key: 'accepted', label: '客户已接受' },
  { key: 'rejected', label: '已驳回' },
  { key: 'superseded', label: '已被替代' },
  { key: 'converted', label: '已转项目' }
]
const STATUS_META: Record<QuoteStatus, { label: string; tone: StatusTone }> = {
  draft: { label: '草稿', tone: 'todo' },
  submitted: { label: '待客户确认', tone: 'pending' },
  accepted: { label: '客户已接受', tone: 'done' },
  rejected: { label: '已驳回', tone: 'blocked' },
  superseded: { label: '已被替代', tone: 'muted' },
  converted: { label: '已转项目', tone: 'dark' }
}

const quotes = ref<Quote[]>([])
const total = ref(0)
const current = ref(1)
const status = ref<'' | QuoteStatus>('')
const keyword = ref('')
const loading = ref(false)
const error = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined

const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const rangeText = computed(() => {
  if (!total.value) return '0 条'
  const start = (current.value - 1) * PAGE_SIZE + 1
  return `${start}–${Math.min(current.value * PAGE_SIZE, total.value)} / ${total.value} 条`
})

async function load(reset = false): Promise<void> {
  if (reset) current.value = 1
  loading.value = true
  error.value = ''
  try {
    const page = await quoteHistoryPage({
      current: current.value,
      size: PAGE_SIZE,
      status: status.value || undefined,
      keyword: keyword.value
    })
    quotes.value = page.list
    total.value = page.total
  } catch (err) {
    quotes.value = []
    total.value = 0
    error.value = err instanceof Error ? err.message : '报价历史暂不可确认'
  } finally {
    loading.value = false
  }
}

function openQuote(quote: Quote): void {
  void router.push(`/designer/quotes/${quote.id}`)
}

function openContract(quote: Quote): void {
  void router.push({ path: '/designer/contract', query: { quoteId: quote.id } })
}

function backToQueue(): void {
  void router.push('/designer/quotes')
}

function statusOf(quote: Quote) {
  return STATUS_META[quote.status] ?? { label: '状态待确认', tone: 'info' as StatusTone }
}

function pageTo(next: number): void {
  if (next < 1 || next > pages.value || next === current.value) return
  current.value = next
  void load()
}

watch(status, () => { void load(true) })
watch(keyword, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void load(true) }, 300)
})
onMounted(load)
</script>

<template>
  <div class="qh">
    <header class="qh__head">
      <div>
        <p class="qh__eyebrow">方案报价 · 报价历史</p>
        <h1>报价历史</h1>
        <p>查看全部报价版本与状态，包括草稿、待客户确认、已接受、已驳回、已被替代和已转项目。这里不是今日工作队列。</p>
      </div>
      <button type="button" @click="backToQueue">返回待我谈单</button>
    </header>

    <section class="qh__tools">
      <label>
        <span>搜索</span>
        <input v-model="keyword" type="search" placeholder="客户、报价编号或标题" />
      </label>
      <div class="qh__filters">
        <button v-for="item in FILTERS" :key="item.key || 'all'" type="button" :class="{ active: status === item.key }" @click="status = item.key">
          {{ item.label }}
        </button>
      </div>
    </section>

    <WorkbenchState
      v-if="error && !quotes.length"
      variant="error"
      title="报价历史暂不可确认"
      :description="error"
      action-text="重新加载"
      min-height="320px"
      @action="load(true)"
    />

    <div v-else class="qh__table-wrap">
      <header class="qh__table-head">
        <strong>报价版本</strong>
        <span>{{ rangeText }}</span>
      </header>
      <div v-if="loading && !quotes.length" class="qh__skeleton" aria-busy="true">
        <span v-for="n in 6" :key="n" />
      </div>
      <WorkbenchState
        v-else-if="!quotes.length"
        title="没有符合条件的报价"
        description="调整状态或搜索条件后重试；空结果不等于没有历史报价。"
        action-text="刷新"
        min-height="240px"
        @action="load(true)"
      />
      <div v-else class="qh__rows">
        <article v-for="quote in quotes" :key="quote.id" class="qh__row">
          <div class="qh__identity">
            <strong>{{ quote.customerName || '客户待完善' }}</strong>
            <small>{{ quote.propertyName || '房屋待补充' }} · {{ quote.no }} · V{{ quote.version }}</small>
          </div>
          <StatusTag :tone="statusOf(quote).tone" :text="statusOf(quote).label" :dot="false" />
          <div class="qh__amount"><MoneyText :value="quote.amount" size="sm" /></div>
          <div class="qh__time">{{ formatDateTime(quote.createdAt) }}</div>
          <div class="qh__actions">
            <button type="button" @click="openQuote(quote)">查看报价</button>
            <button v-if="quote.status === 'accepted' || quote.status === 'converted'" type="button" class="is-primary" @click="openContract(quote)">查看合同</button>
          </div>
        </article>
      </div>
      <footer class="qh__pager">
        <button type="button" :disabled="current <= 1 || loading" @click="pageTo(current - 1)">上一页</button>
        <span>{{ current }} / {{ pages }}</span>
        <button type="button" :disabled="current >= pages || loading" @click="pageTo(current + 1)">下一页</button>
      </footer>
    </div>
  </div>
</template>

<style scoped lang="scss">
.qh { display: flex; flex-direction: column; gap: $space-4; padding: $space-5; min-width: 0; }
.qh__head { display: flex; align-items: flex-end; justify-content: space-between; gap: $space-4; }
.qh__head h1 { margin: 0; color: $text-primary; font-size: $font-display; }
.qh__head p { max-width: 800px; margin: $space-2 0 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
.qh__eyebrow { margin: 0 0 6px !important; color: $brand-600 !important; font-size: $font-caption !important; font-weight: $font-weight-semibold; letter-spacing: .08em; }
.qh__head > button, .qh__pager button, .qh__actions button { padding: 8px 12px; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; color: $text-secondary; font: inherit; cursor: pointer; }
.qh__head > button:hover, .qh__pager button:hover, .qh__actions button:hover { border-color: $brand-300; color: $brand-700; }
.qh__actions .is-primary { border-color: $brand-500; background: $brand-500; color: $surface-0; }
.qh__tools { display: flex; align-items: end; justify-content: space-between; gap: $space-4; padding: $space-4; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.qh__tools label { display: flex; flex-direction: column; gap: 6px; min-width: 300px; color: $text-secondary; font-size: $font-caption; }
.qh__tools input { height: 36px; padding: 0 10px; border: 1px solid $border-color; border-radius: $radius-sm; color: $text-primary; background: $surface-0; font: inherit; }
.qh__filters { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.qh__filters button { padding: 7px 11px; border: 1px solid $border-color; border-radius: $radius-pill; background: $surface-0; color: $text-secondary; font: inherit; font-size: $font-caption; cursor: pointer; }
.qh__filters button.active { border-color: $brand-300; background: $brand-50; color: $brand-700; }
.qh__table-wrap { border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; overflow: hidden; }
.qh__table-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid $border-color; background: linear-gradient(135deg, $surface-50, $surface-0); }
.qh__table-head strong { color: $text-primary; font-size: $font-body; }
.qh__table-head span { color: $text-tertiary; font-size: $font-caption; }
.qh__rows { display: flex; flex-direction: column; }
.qh__row { display: grid; grid-template-columns: minmax(0, 1.7fr) 110px 130px 150px minmax(180px, auto); align-items: center; gap: $space-3; padding: 14px 16px; border-bottom: 1px solid $border-color; }
.qh__row:last-child { border-bottom: 0; }
.qh__identity { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.qh__identity strong, .qh__identity small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qh__identity strong { color: $text-primary; font-size: $font-body-sm; }
.qh__identity small, .qh__time { color: $text-tertiary; font-size: $font-caption; }
.qh__amount { text-align: right; }
.qh__actions { display: flex; justify-content: flex-end; gap: 6px; }
.qh__pager { display: flex; align-items: center; justify-content: center; gap: $space-3; padding: $space-4; border-top: 1px solid $border-color; color: $text-secondary; font-size: $font-caption; }
.qh__pager button:disabled { opacity: .45; cursor: not-allowed; }
.qh__skeleton { display: grid; gap: $space-2; padding: $space-4; }
.qh__skeleton span { height: 54px; border-radius: $radius-md; background: linear-gradient(90deg, $surface-100 25%, $surface-50 37%, $surface-100 63%); background-size: 400% 100%; animation: qh-shimmer 1.4s ease infinite; }
@keyframes qh-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
@media (max-width: 980px) { .qh__row { grid-template-columns: minmax(0, 1fr) 110px 120px; } .qh__time { display: none; } .qh__actions { grid-column: 1 / -1; justify-content: flex-start; } }
@media (max-width: 700px) { .qh { padding: $space-3; } .qh__head, .qh__tools { align-items: stretch; flex-direction: column; } .qh__tools label { min-width: 0; } .qh__filters { justify-content: flex-start; } .qh__row { grid-template-columns: 1fr auto; } .qh__amount { text-align: left; } .qh__actions { grid-column: 1 / -1; } }
</style>
