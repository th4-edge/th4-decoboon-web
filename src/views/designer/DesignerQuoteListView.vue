<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import MoneyText from '@/components/MoneyText.vue'
import EmptyState from '@/components/EmptyState.vue'
import { quoteDesignerPage } from '@/domains/trade/api'
import type { Quote, QuoteStatus } from '@/domains/trade/model'
import { formatDateTime } from '@/core/format'

type QuoteFilter = 'active' | 'waiting' | 'accepted' | 'history' | 'all'

const router = useRouter()
const quotes = ref<Quote[]>([])
const loading = ref(false)
const error = ref('')
const keyword = ref('')
const filter = ref<QuoteFilter>('active')
const manualQuoteId = ref('')

const filters: Array<{ key: QuoteFilter; label: string; match: (status: QuoteStatus) => boolean }> = [
  { key: 'active', label: '推进中', match: (status) => status === 'draft' || status === 'rejected' },
  { key: 'waiting', label: '待客户确认', match: (status) => status === 'submitted' },
  { key: 'accepted', label: '待交接 / 已转项目', match: (status) => status === 'accepted' || status === 'converted' },
  { key: 'history', label: '历史版本', match: (status) => status === 'superseded' },
  { key: 'all', label: '全部', match: () => true }
]

const counts = computed(() => Object.fromEntries(
  filters.map((item) => [item.key, quotes.value.filter((quote) => item.match(quote.status)).length])
) as Record<QuoteFilter, number>)

const filtered = computed(() => {
  const match = filters.find((item) => item.key === filter.value)?.match ?? (() => true)
  const needle = keyword.value.trim().toLowerCase()
  return quotes.value
    .filter((quote) => match(quote.status))
    .filter((quote) => {
      if (!needle) return true
      return [quote.customerName, quote.propertyName, quote.no, quote.title, quote.id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    })
    .sort((left, right) => {
      const statusRank: Record<QuoteStatus, number> = {
        rejected: 0, draft: 1, submitted: 2, accepted: 3, converted: 4, superseded: 5
      }
      const byStatus = statusRank[left.status] - statusRank[right.status]
      if (byStatus !== 0) return byStatus
      return String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? ''))
    })
})

function customerLine(quote: Quote): string {
  return quote.customerName || quote.title || '客户待完善'
}

function propertyLine(quote: Quote): string {
  return quote.propertyName || '房屋待完善'
}

function openQuote(id?: string): void {
  if (!id) return
  void router.push(`/designer/quotes/${id}`)
}

function openManualQuote(): void {
  const id = manualQuoteId.value.trim()
  if (id) openQuote(id)
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    quotes.value = await quoteDesignerPage({ size: 200 })
  } catch (err) {
    error.value = err instanceof Error ? err.message : '报价列表暂不可确认，请稍后重试'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="quote-list">
    <section class="quote-list__head">
      <div>
        <p class="quote-list__eyebrow">QUOTE POOL · 本人可见报价</p>
        <h2>报价工作台</h2>
        <p>列表只展示服务端返回的本人负责报价；进入工作区后可编辑草稿、查看版本、处理驳回与合同交接。</p>
      </div>
      <el-button type="primary" @click="load">刷新报价</el-button>
    </section>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />

    <section class="quote-list__toolbar">
      <div class="quote-list__filters" role="group" aria-label="报价筛选">
        <button
          v-for="item in filters"
          :key="item.key"
          type="button"
          :class="{ active: filter === item.key }"
          @click="filter = item.key"
        >
          {{ item.label }} <b>{{ counts[item.key] ?? 0 }}</b>
        </button>
      </div>
      <el-input v-model="keyword" clearable placeholder="搜索客户、房屋、报价编号" class="quote-list__search" />
    </section>

    <section class="quote-list__panel">
      <div v-if="loading" class="quote-list__loading">
        <el-skeleton :rows="6" animated />
      </div>

      <EmptyState
        v-else-if="!filtered.length"
        title="当前筛选下没有报价"
        description="报价数据来自服务端；没有真实报价时不会用假数据填充。"
        action-text="重新加载"
        @action="load"
      />

      <div v-else class="quote-list__table" role="table" aria-label="报价列表">
        <div class="quote-list__row quote-list__row--head" role="row">
          <span>客户 / 房屋</span>
          <span>报价编号</span>
          <span>版本</span>
          <span>状态</span>
          <span>金额</span>
          <span>创建时间</span>
          <span>下一步</span>
        </div>
        <button
          v-for="quote in filtered"
          :key="quote.id"
          type="button"
          class="quote-list__row"
          role="row"
          @click="openQuote(quote.id)"
        >
          <span class="quote-list__identity">
            <strong>{{ customerLine(quote) }}</strong>
            <small>{{ propertyLine(quote) }}</small>
          </span>
          <span class="quote-list__mono">{{ quote.no || quote.id }}</span>
          <span>V{{ quote.version }}</span>
          <span>
            <BusinessStateTag object-key="quote" :status-key="quote.status" />
          </span>
          <span><MoneyText :value="quote.amount" /></span>
          <span>{{ formatDateTime(quote.createdAt) }}</span>
          <span class="quote-list__action">{{ quote.businessStateView?.nextAction?.label || '待业务确认' }} →</span>
        </button>
      </div>
    </section>

    <section class="quote-list__manual">
      <div>
        <h3>直接打开报价工作区</h3>
        <p>如果列表 API 暂不可用，可输入真实报价 ID 直接进入工作区；该入口不会创建或伪造报价。</p>
      </div>
      <div class="quote-list__manual-form">
        <el-input v-model="manualQuoteId" placeholder="输入报价 ID" @keyup.enter="openManualQuote" />
        <el-button type="primary" plain :disabled="!manualQuoteId.trim()" @click="openManualQuote">打开</el-button>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.quote-list {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: $space-5;
}

.quote-list__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-5;

  h2 { margin: $space-1 0; font-size: $font-display; }
  p { margin: 0; max-width: 760px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
}

.quote-list__eyebrow {
  color: $brand-600 !important;
  font-size: $font-caption !important;
  font-weight: $font-weight-semibold;
  letter-spacing: .1em;
}

.quote-list__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-4;
}

.quote-list__filters {
  display: flex;
  flex-wrap: wrap;
  gap: $space-2;

  button {
    display: inline-flex;
    align-items: center;
    gap: $space-2;
    min-height: 34px;
    padding: 0 $space-3;
    border: 1px solid $border-color;
    border-radius: $radius-pill;
    background: $surface-0;
    color: $text-secondary;
    cursor: pointer;

    b { color: $text-tertiary; font-size: $font-caption; }
  }

  button.active {
    border-color: $brand-300;
    background: $brand-50;
    color: $brand-700;
    font-weight: $font-weight-semibold;

    b { color: $brand-700; }
  }
}

.quote-list__search { max-width: 320px; }

.quote-list__panel {
  overflow: hidden;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  box-shadow: $shadow-card;
}

.quote-list__table { min-width: 1080px; }

.quote-list__row {
  display: grid;
  grid-template-columns: minmax(200px, 1.3fr) 150px 64px 130px 130px 150px 110px;
  align-items: center;
  gap: $space-3;
  width: 100%;
  min-height: 58px;
  padding: 0 $space-4;
  border: 0;
  border-bottom: 1px solid $border-color;
  background: transparent;
  color: $text-primary;
  text-align: left;
  font-size: $font-body-sm;
  cursor: pointer;

  &:last-child { border-bottom: 0; }
  &:not(.quote-list__row--head):hover { background: $brand-50; }
}

.quote-list__row--head {
  min-height: 44px;
  background: $surface-50;
  color: $text-secondary;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
  cursor: default;
}

.quote-list__identity {
  min-width: 0;

  strong,
  small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  small { margin-top: 3px; color: $text-secondary; font-size: $font-caption; }
}

.quote-list__mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: $font-caption;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quote-list__action {
  color: $brand-700;
  font-weight: $font-weight-semibold;
  text-align: right;
}

.quote-list__loading { padding: $space-5; }

.quote-list__manual {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-5;
  padding: $space-4 $space-5;
  border: 1px dashed $border-color;
  border-radius: $radius-md;
  background: $surface-50;

  h3 { margin: 0 0 $space-1; font-size: $font-body; }
  p { margin: 0; color: $text-secondary; font-size: $font-caption; }
}

.quote-list__manual-form {
  display: flex;
  gap: $space-2;
  width: min(420px, 100%);
}

@media (max-width: 1024px) {
  .quote-list__toolbar,
  .quote-list__head,
  .quote-list__manual { flex-direction: column; align-items: stretch; }
  .quote-list__search { max-width: none; }
  .quote-list__panel { overflow-x: auto; }
}
</style>
