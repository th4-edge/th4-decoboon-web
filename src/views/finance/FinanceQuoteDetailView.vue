<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QuoteHeader from '@/components/QuoteHeader.vue'
import QuoteSheetGrid from '@/components/QuoteSheetGrid.vue'
import EmptyState from '@/components/EmptyState.vue'
import { ProviderError } from '@/core/http'
import { quoteInfoFinance } from '@/domains/trade/api'
import { toSheetGroups, type CellRef, type DraftMap } from '@/domains/trade/quote-sheet'
import type { Quote, QuoteViewMode } from '@/domains/trade/model'

const route = useRoute()
const router = useRouter()
const quote = ref<Quote | null>(null)
const viewMode = ref<QuoteViewMode>('REGION')
const loading = ref(false)
const error = ref('')
const draft: DraftMap = {}
const selected = ref<CellRef | null>(null)

const quoteId = computed(() => String(route.params.quoteId ?? ''))
const sheetGroups = computed(() => (quote.value ? toSheetGroups(quote.value, viewMode.value) : null))

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    quote.value = await quoteInfoFinance(quoteId.value)
  } catch (loadError) {
    quote.value = null
    error.value = loadError instanceof ProviderError ? loadError.message : '报价暂不可确认'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="detail">
    <header class="detail__head">
      <button class="back" @click="router.back()">← 返回报价</button>
    </header>

    <EmptyState v-if="error" title="报价暂不可确认" :description="error" action-text="重新加载" @action="load" />

    <template v-else-if="quote">
      <QuoteHeader
        :quote-no="quote.no"
        :version="quote.version"
        :status="quote.status"
        :customer-name="quote.title || '报价单'"
        :property-line="[quote.customerName, quote.propertyName].filter(Boolean).join(' · ') || '房屋待确认'"
        :saved-amount="quote.amount"
        save-state="saved"
        :can-save="false"
        :editable="false"
        :show-cost="true"
        @back="router.back()"
      />

      <div class="mode-tabs">
        <button :class="{ active: viewMode === 'REGION' }" @click="viewMode = 'REGION'">按区域</button>
        <button :class="{ active: viewMode === 'TYPE' }" @click="viewMode = 'TYPE'">按类型</button>
      </div>

      <QuoteSheetGrid
        v-if="sheetGroups"
        :groups="sheetGroups"
        :status="null"
        :draft="draft"
        :selected="selected"
        :loading="loading"
        :show-cost="true"
      />
      <EmptyState v-else-if="!loading" title="报价分组暂不可确认" description="请返回报价列表后重试，或联系财务负责人核对报价数据。" />
    </template>
  </div>
</template>

<style scoped lang="scss">
.detail { max-width: 1200px; margin: 0 auto; padding: 24px; }
.detail__head { margin-bottom: 16px; }
.back { border: none; background: transparent; color: var(--th4-status-progress); font-size: 13px; cursor: pointer; padding: 4px 0; }
.mode-tabs { display: inline-flex; gap: 8px; margin: 16px 0; }
.mode-tabs button { padding: 7px 16px; border-radius: 999px; border: 1px solid var(--th4-border-color); background: var(--th4-surface-0); font-size: 13px; color: var(--th4-text-secondary); cursor: pointer; }
.mode-tabs button.active { background: var(--th4-status-progress-soft); border-color: var(--th4-status-progress-border); color: var(--th4-status-progress); font-weight: 600; }
</style>
