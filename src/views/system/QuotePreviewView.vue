<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import MoneyText from '@/components/MoneyText.vue'
import QuoteSheetGrid from '@/components/QuoteSheetGrid.vue'
import EmptyState from '@/components/EmptyState.vue'
import { quoteInfo, saveQuoteLines, QUOTE_BATCH_MAX_LINES, type QuoteLineBatchItem } from '@/domains/trade/api'
import { QUOTE_MODE_META, QUOTE_STATUS_META } from '@/domains/trade/meta'
import { toSheetGroups, type CellRef, type DraftMap, type EditableField } from '@/domains/trade/quote-sheet'
import type { Quote, QuoteItem } from '@/domains/trade/model'
import { ProviderError } from '@/core/http'

/** dev-only：用真实 Provider 数据渲染报价表格，并验证 Web 专用批量写闭环。 */
const route = useRoute()
const quote = ref<Quote | null>(null)
const loading = ref(false)
const errorText = ref('')
const selected = ref<CellRef | null>(null)
const gridRef = ref<InstanceType<typeof QuoteSheetGrid> | null>(null)
const collapsed = ref<string[]>([])
const draft = reactive<DraftMap>({})

const saving = ref(false)
const saveError = ref('')
const lastSaved = ref('')

const quoteId = computed(() => String(route.query.quoteId ?? ''))
const groups = computed(() => (quote.value ? toSheetGroups(quote.value) : []))
const rowCount = computed(() => groups.value.reduce((sum, g) => sum + g.rows.length, 0))
const dirtyCount = computed(() => Object.keys(draft).length)
const savableKeys = computed(() => Object.keys(draft))

const itemByKey = computed(() => {
  const map = new Map<string, QuoteItem>()
  quote.value?.items.forEach((item) => map.set(item.id, item))
  return map
})

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

function clearDraft(): void {
  Object.keys(draft).forEach((key) => { delete draft[key] })
}

/** 字段级校验：返回 null 表示通过，否则返回阻断原因。 */
function buildChange(rowKey: string, patch: Record<string, unknown>, item: QuoteItem): { change?: QuoteLineBatchItem; error?: string } {
  const change: QuoteLineBatchItem = { itemId: rowKey }

  if (patch.quantity !== undefined) {
    const quantity = Number(patch.quantity)
    if (!(quantity > 0)) return { error: `「${item.name}」工程量必须大于零` }
    change.quantity = quantity
  }

  if (patch.quantityFormula !== undefined) {
    const formula = String(patch.quantityFormula).trim()
    if (formula.length > 512) return { error: `「${item.name}」工程量公式超过 512 字符` }
    if (formula) {
      change.quantityFormula = formula
    } else if (change.quantity === undefined) {
      // 清空公式：服务端要求同时给出有效工程量，否则沿用原值并清公式
      change.quantity = Number(item.quantity)
    }
  }

  const priceFields = [
    { key: 'materialPrice' as const, label: '材料价' },
    { key: 'manualPrice' as const, label: '人工价' }
  ]
  for (const { key, label } of priceFields) {
    const raw = patch[key]
    if (raw === undefined) continue
    const value = Number(raw)
    // 业务冻结：负金额与零单价必须被阻断（服务端同样只接受 > 0）
    if (!(value > 0)) return { error: `「${item.name}」${label}必须大于零（服务端不接受零价）` }
    change[key] = value
  }

  return { change }
}

/** 保存后回读：确认提交的字段确实生效，未生效不得报「已保存」。 */
function findNotApplied(changes: QuoteLineBatchItem[], fresh: Quote): string[] {
  const problems: string[] = []
  const byId = new Map(fresh.items.map((item) => [item.id, item]))
  const almost = (a: number, b: number) => Math.abs(a - b) < 0.0005
  for (const change of changes) {
    const item = byId.get(change.itemId)
    if (!item) { problems.push(`行 ${change.itemId} 保存后不存在`); continue }
    if (change.quantity !== undefined && !almost(item.quantity, change.quantity)) {
      problems.push(`「${item.name}」工程量未生效（期望 ${change.quantity}，实际 ${item.quantity}）`)
    }
    if (change.materialPrice !== undefined && !almost(item.materialPrice, change.materialPrice)) {
      problems.push(`「${item.name}」材料价未生效（期望 ${change.materialPrice}，实际 ${item.materialPrice}）`)
    }
    if (change.manualPrice !== undefined && !almost(item.manualPrice, change.manualPrice)) {
      problems.push(`「${item.name}」人工价未生效（期望 ${change.manualPrice}，实际 ${item.manualPrice}）`)
    }
  }
  return problems
}

async function saveDraft(): Promise<void> {
  if (!quote.value) return
  // 先把仍在编辑中的单元格缓冲落地到草稿，避免最后一次输入被漏掉
  gridRef.value?.commitPending()
  const targetQuoteId = quote.value.id
  const changes: QuoteLineBatchItem[] = []
  const errors: string[] = []

  for (const [rowKey, patch] of Object.entries(draft)) {
    const item = itemByKey.value.get(rowKey)
    if (!item) continue
    const { change, error } = buildChange(rowKey, patch as Record<string, unknown>, item)
    if (error) errors.push(error)
    else if (change) changes.push(change)
  }

  if (errors.length > 0) {
    saveError.value = `校验未通过，未提交保存：${errors.join('；')}`
    return
  }
  if (changes.length === 0) return
  if (changes.length > QUOTE_BATCH_MAX_LINES) {
    saveError.value = `单次最多保存 ${QUOTE_BATCH_MAX_LINES} 行，当前 ${changes.length} 行`
    return
  }

  saving.value = true
  saveError.value = ''
  lastSaved.value = ''
  try {
    await saveQuoteLines({ quoteId: targetQuoteId, items: changes })
    // 保存后必须重新读取服务端权威数据（Q5：正式金额以服务端为准）
    const fresh = await quoteInfo(targetQuoteId)
    quote.value = fresh

    const notApplied = findNotApplied(changes, fresh)
    if (notApplied.length > 0) {
      saveError.value = `服务端未接受以下改动，未标记为已保存：${notApplied.join('；')}`
      return
    }
    clearDraft()
    lastSaved.value = `已保存 ${changes.length} 行，金额由服务端重算`
    ElMessage.success(lastSaved.value)
  } catch (error) {
    saveError.value = error instanceof ProviderError
      ? `${error.message}（${error.code}）`
      : error instanceof Error ? error.message : '保存失败，暂不可确认'
  } finally {
    saving.value = false
  }
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
      <div class="qp__actions">
        <el-button :loading="saving" :disabled="savableKeys.length === 0" type="primary" @click="saveDraft">
          保存草稿（{{ savableKeys.length }} 行）
        </el-button>
        <el-button @click="load">重新加载</el-button>
      </div>
    </header>

    <el-alert v-if="errorText" type="error" :closable="false" :title="errorText" />
    <el-alert v-if="saveError" type="error" :closable="false" :title="saveError" />

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
          ref="gridRef"
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
        未保存改动：{{ dirtyCount }} 行（可保存 {{ savableKeys.length }} 行）{{ lastSaved ? ` · ${lastSaved}` : '' }}
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
.qp__actions { display: inline-flex; gap: $space-2; }
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
