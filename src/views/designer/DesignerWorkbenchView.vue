<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import MoneyText from '@/components/MoneyText.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import { quoteDesignerPage } from '@/domains/trade/api'
import { QUOTE_STATUS_META } from '@/domains/trade/meta'
import type { Quote } from '@/domains/trade/model'
import { formatDateTime } from '@/core/format'

const router = useRouter()
const quotes = ref<Quote[]>([])
const loading = ref(false)
const error = ref('')

const buckets = computed(() => {
  const rows = quotes.value
  return {
    action: rows.filter((quote) => quote.status === 'rejected' || quote.status === 'draft'),
    waiting: rows.filter((quote) => quote.status === 'submitted'),
    handoff: rows.filter((quote) => quote.status === 'accepted'),
    converted: rows.filter((quote) => quote.status === 'converted')
  }
})

const stats = computed(() => [
  { label: '报价总数', value: quotes.value.length, hint: '本人可见报价' },
  { label: '待处理', value: buckets.value.action.length, hint: '草稿与驳回' },
  { label: '待客户确认', value: buckets.value.waiting.length, hint: '等待客户决策' },
  { label: '待合同交接', value: buckets.value.handoff.length, hint: '客户已接受' }
])

const queue = computed(() => {
  const rank: Record<string, number> = { rejected: 0, draft: 1, submitted: 2, accepted: 3, converted: 4, superseded: 5 }
  return [...quotes.value]
    .filter((quote) => quote.status !== 'superseded')
    .sort((left, right) => (rank[left.status] ?? 9) - (rank[right.status] ?? 9))
    .slice(0, 12)
})

function quoteTitle(quote: Quote): string {
  return quote.customerName || quote.title || quote.propertyName || '客户待完善'
}

function quoteSubtitle(quote: Quote): string {
  const property = quote.propertyName || '房屋待完善'
  return `${property} · ${quote.no || quote.id}`
}

function nextAction(quote: Quote): string {
  switch (quote.status) {
    case 'draft': return '继续编制报价'
    case 'rejected': return '按客户反馈调整'
    case 'submitted': return '跟进客户决策'
    case 'accepted': return '完成合同交接'
    case 'converted': return '进入项目协同'
    default: return '查看历史版本'
  }
}

function openQuote(quote: Quote): void {
  void router.push(`/designer/quotes/${quote.id}`)
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    quotes.value = await quoteDesignerPage({ size: 200 })
  } catch (err) {
    error.value = err instanceof Error ? err.message : '报价工作台暂不可确认，请稍后重试'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="designer-home">
    <section class="designer-hero">
      <div>
        <p class="designer-hero__eyebrow">TODAY · 设计经营主线</p>
        <h2>今天需要推进的报价</h2>
        <p>从本人负责的报价池直接进入工作区，完成量价调整、提交确认、驳回重报或合同交接。</p>
      </div>
      <el-button type="primary" @click="router.push('/designer/quotes')">打开完整报价工作台</el-button>
    </section>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default>
        <el-button size="small" plain @click="load">重新加载</el-button>
      </template>
    </el-alert>

    <section class="designer-stats" aria-label="报价统计">
      <article v-for="item in stats" :key="item.label" class="designer-stat">
        <span>{{ item.label }}</span>
        <strong>{{ loading ? '—' : item.value }}</strong>
        <small>{{ item.hint }}</small>
      </article>
    </section>

    <section class="designer-panel">
      <header class="designer-panel__head">
        <div>
          <h3>需要我处理</h3>
          <p>按已驳回、草稿、待客户确认的顺序排列，不展示其他设计师的私人客户。</p>
        </div>
        <span class="designer-panel__count">{{ queue.length }} 条</span>
      </header>

      <div v-if="loading" class="designer-loading">
        <el-skeleton :rows="5" animated />
      </div>

      <EmptyState
        v-else-if="!queue.length"
        title="今天没有需要处理的报价"
        description="报价数据来自服务端；没有数据时不会用 0 或假数据冒充完成。"
        action-text="刷新报价"
        @action="load"
      />

      <div v-else class="designer-queue">
        <button
          v-for="quote in queue"
          :key="quote.id"
          type="button"
          class="designer-queue__item"
          @click="openQuote(quote)"
        >
          <span class="designer-queue__index">{{ quote.version }}</span>
          <div class="designer-queue__main">
            <div class="designer-queue__title">
              <strong>{{ quoteTitle(quote) }}</strong>
              <StatusTag
                :tone="QUOTE_STATUS_META[quote.status].tone"
                :text="QUOTE_STATUS_META[quote.status].label"
              />
            </div>
            <span>{{ quoteSubtitle(quote) }}</span>
            <small>创建时间：{{ formatDateTime(quote.createdAt) }}</small>
          </div>
          <div class="designer-queue__side">
            <MoneyText :value="quote.amount" size="lg" />
            <b>{{ nextAction(quote) }}</b>
          </div>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.designer-home {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: $space-5;
}

.designer-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-5;
  padding: $space-5;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: linear-gradient(135deg, $brand-50 0%, $surface-0 72%);
  box-shadow: $shadow-card;

  h2 {
    margin: $space-1 0;
    font-size: $font-display;
  }

  p {
    margin: 0;
    max-width: 720px;
    color: $text-secondary;
    font-size: $font-body-sm;
    line-height: 1.7;
  }
}

.designer-hero__eyebrow {
  color: $brand-600 !important;
  font-size: $font-caption !important;
  font-weight: $font-weight-semibold;
  letter-spacing: .1em;
}

.designer-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: $space-4;
}

.designer-stat {
  display: flex;
  flex-direction: column;
  gap: $space-1;
  padding: $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  box-shadow: $shadow-card;

  span { color: $text-secondary; font-size: $font-body-sm; }
  strong { font-size: $font-display; font-variant-numeric: tabular-nums; }
  small { color: $text-tertiary; font-size: $font-caption; }
}

.designer-panel {
  overflow: hidden;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  box-shadow: $shadow-card;
}

.designer-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;
  padding: $space-4 $space-5;
  border-bottom: 1px solid $border-color;

  h3 { margin: 0 0 $space-1; font-size: $font-title; }
  p { margin: 0; color: $text-secondary; font-size: $font-body-sm; }
}

.designer-panel__count {
  padding: 4px 10px;
  border-radius: $radius-pill;
  background: $brand-50;
  color: $brand-700;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
}

.designer-queue {
  display: flex;
  flex-direction: column;
}

.designer-queue__item {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: $space-4;
  width: 100%;
  padding: $space-4 $space-5;
  border: 0;
  border-bottom: 1px solid $border-color;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background $transition-fast;

  &:last-child { border-bottom: 0; }
  &:hover { background: $brand-50; }
}

.designer-queue__index {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: $radius-sm;
  background: $surface-100;
  color: $brand-700;
  font-weight: $font-weight-bold;
}

.designer-queue__main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;

  > span,
  small { color: $text-secondary; font-size: $font-caption; }
  > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  small { color: $text-tertiary; }
}

.designer-queue__title {
  display: flex;
  align-items: center;
  gap: $space-2;
  min-width: 0;

  strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}

.designer-queue__side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: $space-2;

  b { color: $brand-700; font-size: $font-body-sm; }
}

.designer-loading { padding: $space-5; }

@media (max-width: 1024px) {
  .designer-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .designer-hero { align-items: flex-start; flex-direction: column; }
  .designer-queue__item { grid-template-columns: 36px minmax(0, 1fr); }
  .designer-queue__side { grid-column: 2; align-items: flex-start; }
}
</style>
