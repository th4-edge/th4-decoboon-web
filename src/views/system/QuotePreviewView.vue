<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import MoneyText from '@/components/MoneyText.vue'
import QuoteSheetGrid from '@/components/QuoteSheetGrid.vue'
import EmptyState from '@/components/EmptyState.vue'
import { quoteInfo } from '@/domains/trade/api'
import { QUOTE_MODE_META, QUOTE_STATUS_META } from '@/domains/trade/meta'
import { toSheetGroups, type CellRef, type DraftMap, type EditableField } from '@/domains/trade/quote-sheet'
import type { Quote } from '@/domains/trade/model'
import { ProviderError } from '@/core/http'

/** dev-only：用真实 Provider 数据渲染报价表格，验证字段契约与金额口径。 */
const route = useRoute()
const quote = ref<Quote | null>(null)
const loading = ref(false)
const errorText = ref('')
const selected = ref<CellRef | null>(null)
const collapsed = ref<string[]>([])
const draft = reactive<DraftMap>({})

const quoteId = computed(() => String(route.query.quoteId ?? ''))

const groups = computed(() => (quote.value ? toSheetGroups(quote.value) : []))
const rowCount = computed(() => groups.value.reduce((sum, g) => sum + g.rows.length, 0))
const dirtyCount = computed(() => Object.keys(draft).length)

async function load(): Promise<void> {
  if (!quoteId.value) {
    errorText.value = '缺少 quoteId 查询参数'
    return
  }
  loading.value = true
  errorText.value = ''
  try {
    quote.value = await quoteInfo(quoteId.value)
  } catch (error) {
    errorText.value = error instanceof ProviderError ? `${error.message}（${error.code}）` : '暂不可确认'
    quote.value = null
  } finally {
    loading.value = false
  }
}

function onCell(rowKey: string, field: EditableField, value: number | string | null): void {
  draft[rowKey] = { ...(draft[rowKey] ?? {}), [field]: value ?? (field === 'quantityFormula' ? '' : 0) }
}

function toggleGroup(groupKey: string): void {
  const idx = collapsed.value.indexOf(groupKey)
  if (idx >= 0) collapsed.value.splice(idx, 1)
  else collapsed.value.push(groupKey)
}

onMounted(load)
</script>

<template>
  <div class="qp">
    <header class="qp__head">
      <div>
        <h1 class="qp__title">报价表格 · 真实数据预览（仅 dev）</h1>
        <p class="qp__desc">数据来自本地后端 `quote/designer/info`，仅用于字段契约与金额口径核对。</p>
      </div>
      <el-button @click="load">重新加载</el-button>
    </header>

    <el-alert v-if="errorText" type="error" :closable="false" :title="errorText" />

    <PanelCard v-if="quote" :title="`${quote.no} · ${quote.title || '报价单'}`" :description="`quoteId ${quote.id}`">
      <template #extra>
        <div class="qp__tags">
          <StatusTag :tone="QUOTE_STATUS_META[quote.status].tone" :text="QUOTE_STATUS_META[quote.status].label" />
          <StatusTag v-if="quote.mode" :tone="QUOTE_MODE_META[quote.mode].tone" :text="QUOTE_MODE_META[quote.mode].label" :dot="false" />
          <StatusTag tone="muted" :text="`V${quote.version}`" :dot="false" />
        </div>
      </template>

      <dl class="qp__facts">
        <div><dt>服务端总额</dt><dd><MoneyText :value="quote.amount" size="lg" /></dd></div>
        <div><dt>小计</dt><dd><MoneyText :value="quote.subtotal" /></dd></div>
        <div><dt>税额</dt><dd><MoneyText :value="quote.taxAmount" /></dd></div>
        <div><dt>优惠</dt><dd>{{ quote.discount === 1 ? '未设置' : `${((1 - quote.discount) * 100).toFixed(2)}%` }}</dd></div>
        <div><dt>面积</dt><dd>{{ quote.area }}㎡</dd></div>
        <div><dt>行数 / 区域</dt><dd>{{ rowCount }} 行 / {{ groups.length }} 区域</dd></div>
      </dl>

      <div class="qp__grid">
        <QuoteSheetGrid
          :groups="groups"
          :status="quote.status"
          :draft="draft"
          :selected="selected"
          :collapsed-groups="collapsed"
          @update:cell="onCell"
          @select:cell="selected = $event"
          @toggle:group="toggleGroup"
        />
      </div>

      <p class="qp__note">
        未保存改动：{{ dirtyCount }} 行 · 本页不提交保存，仅验证读取与编辑契约
      </p>
    </PanelCard>

    <EmptyState
      v-else-if="!loading && !errorText"
      title="没有可展示的报价"
      description="在地址栏加上 ?quoteId=<报价ID> 后在真实数据上验证。"
    />
  </div>
</template>

<style scoped lang="scss">
.qp {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: $space-5;
  min-height: 100vh;
  background: $bg-page;
}

.qp__head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-4; }
.qp__title { margin: 0; font-size: $font-h1; }
.qp__desc { margin: $space-1 0 0; font-size: $font-body-sm; color: $text-secondary; }

.qp__tags { display: inline-flex; align-items: center; gap: $space-2; }

.qp__facts {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: $space-3;
  margin: 0 0 $space-4;

  > div { display: flex; flex-direction: column; gap: 2px; }
  dt { font-size: $font-caption; color: $text-secondary; }
  dd { margin: 0; font-size: $font-body-sm; }
}

.qp__grid {
  height: calc(100vh - 420px);
  min-height: 320px;
  display: flex;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  overflow: hidden;
}

.qp__note { margin: $space-3 0 0; font-size: $font-caption; color: $text-secondary; }
</style>
