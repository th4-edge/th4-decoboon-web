<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import QuoteHeader from '@/components/QuoteHeader.vue'
import QuoteSheetGrid from '@/components/QuoteSheetGrid.vue'
import QuoteDecisionPanel, { type QuoteSaveState } from '@/components/QuoteDecisionPanel.vue'
import MoneyText from '@/components/MoneyText.vue'
import EmptyState from '@/components/EmptyState.vue'
import { quoteInfo, saveQuoteLines, QUOTE_BATCH_MAX_LINES, type QuoteLineBatchItem } from '@/domains/trade/api'
import { toSheetGroups, type CellRef, type DraftMap, type EditableField } from '@/domains/trade/quote-sheet'
import type { Quote, QuoteItem } from '@/domains/trade/model'
import { previewQuoteSummary } from '@/domains/trade/preview'
import { ProviderError } from '@/core/http'

/** dev-only：真实 Provider 的报价工作台（表头 + 批量写入 + 编辑预览/正式金额分离 + 自动保存 + 双全屏）。 */
const route = useRoute()

const quote = ref<Quote | null>(null)
const loading = ref(false)
const loadError = ref('')
const selected = ref<CellRef | null>(null)
const collapsed = ref<string[]>([])
const draft = reactive<DraftMap>({})
const gridRef = ref<InstanceType<typeof QuoteSheetGrid> | null>(null)

const saving = ref(false)
const pendingSave = ref(false)
const lastSavedAt = ref('')
const saveError = ref('')
const validationErrors = ref<string[]>([])
/** 字段级错误：cellKey(`rowKey:field`) → 错误文案 */
const cellErrors = ref<Record<string, string>>({})
const invalidCells = computed(() => Object.keys(cellErrors.value))
const dirtySinceSave = ref(false)

const immersive = ref(false)
const browserFullscreen = ref(false)

const quoteId = computed(() => String(route.query.quoteId ?? ''))
const groups = computed(() => (quote.value ? toSheetGroups(quote.value) : []))
const rowCount = computed(() => groups.value.reduce((sum, g) => sum + g.rows.length, 0))
const dirtyCount = computed(() => Object.keys(draft).length)
const editable = computed(() => quote.value?.status === 'draft')

const itemByKey = computed(() => {
  const map = new Map<string, QuoteItem>()
  quote.value?.items.forEach((item) => map.set(item.id, item))
  return map
})

/** 编辑预览（仅核对用；正式金额永远以服务端为准）。 */
const preview = computed(() => {
  if (!quote.value || !dirtySinceSave.value) return null
  return previewQuoteSummary(groups.value, draft, quote.value.amount, quote.value.discount, quote.value.taxRate)
})

const saveState = computed<QuoteSaveState>(() => {
  if (saving.value) return 'saving'
  if (saveError.value) return 'error'
  if (dirtyCount.value > 0) return 'dirty'
  return lastSavedAt.value ? 'saved' : 'clean'
})

const canSave = computed(() => editable.value && dirtyCount.value > 0 && validationErrors.value.length === 0)

async function load(): Promise<void> {
  if (!quoteId.value) { loadError.value = '缺少 quoteId 查询参数'; return }
  loading.value = true
  loadError.value = ''
  try {
    quote.value = await quoteInfo(quoteId.value)
  } catch (error) {
    loadError.value = error instanceof ProviderError ? `${error.message}（${error.code}）` : '暂不可确认'
    quote.value = null
  } finally {
    loading.value = false
  }
}

function clearDraft(): void {
  Object.keys(draft).forEach((key) => { delete draft[key] })
  dirtySinceSave.value = false
}

function onCell(rowKey: string, field: EditableField, value: number | string | null): void {
  draft[rowKey] = { ...(draft[rowKey] ?? {}), [field]: value ?? (field === 'quantityFormula' ? '' : 0) }
  dirtySinceSave.value = true
  validateDraft()
  scheduleAutoSave()
}

function toggleGroup(groupKey: string): void {
  const idx = collapsed.value.indexOf(groupKey)
  if (idx >= 0) collapsed.value.splice(idx, 1)
  else collapsed.value.push(groupKey)
}

/**
 * 逐字段校验（非法值不参与自动保存，且在单元格上标记）。
 *
 * 0 价口径：Web 侧**阻止 0 与负数**。需要某一侧为 0 时应改用对应 PricingMethod
 * （如 MaterialOnly 的人工价天然为 0），而不是显式传 0。
 */
function validateDraft(): void {
  const errors = new Set<string>()
  const cells: Record<string, string> = {}

  const mark = (rowKey: string, field: string, ok: boolean, message: string): void => {
    if (ok) return
    cells[`${rowKey}:${field}`] = message
    errors.add(message)
  }

  for (const [rowKey, patch] of Object.entries(draft)) {
    const item = itemByKey.value.get(rowKey)
    if (!item) continue
    if (patch.quantity !== undefined) {
      mark(rowKey, 'quantity', Number(patch.quantity) > 0, `「${item.name}」工程量必须大于 0（不能为 0 或负数）`)
    }
    if (patch.quantityFormula !== undefined) {
      mark(rowKey, 'quantityFormula', String(patch.quantityFormula).trim().length <= 512,
        `「${item.name}」工程量公式超过 512 字符`)
    }
    if (patch.materialPrice !== undefined) {
      mark(rowKey, 'materialPrice', Number(patch.materialPrice) > 0,
        `「${item.name}」材料价必须大于 0（需要为 0 请改用对应计价模式，不要显式传 0）`)
    }
    if (patch.manualPrice !== undefined) {
      mark(rowKey, 'manualPrice', Number(patch.manualPrice) > 0,
        `「${item.name}」人工价必须大于 0（需要为 0 请改用对应计价模式，不要显式传 0）`)
    }
  }

  cellErrors.value = cells
  validationErrors.value = [...errors]
}

/** 组装批量保存入参；只有 Draft、且只提交有改动的行。 */
function collectChanges(): QuoteLineBatchItem[] {
  const changes: QuoteLineBatchItem[] = []
  for (const [rowKey, patch] of Object.entries(draft)) {
    const item = itemByKey.value.get(rowKey)
    if (!item) continue
    const change: QuoteLineBatchItem = { itemId: rowKey }
    if (patch.quantity !== undefined && Number(patch.quantity) > 0) change.quantity = Number(patch.quantity)
    const formula = patch.quantityFormula
    if (formula !== undefined) {
      const trimmed = String(formula).trim()
      if (trimmed) change.quantityFormula = trimmed
    }
    if (patch.materialPrice !== undefined && Number(patch.materialPrice) > 0) change.materialPrice = Number(patch.materialPrice)
    if (patch.manualPrice !== undefined && Number(patch.manualPrice) > 0) change.manualPrice = Number(patch.manualPrice)
    changes.push(change)
  }
  return changes
}

/** 保存后回读校验：字段未生效不得报成功。 */
function findNotApplied(changes: QuoteLineBatchItem[], fresh: Quote): string[] {
  const problems: string[] = []
  const byId = new Map(fresh.items.map((item) => [item.id, item]))
  const almost = (a: number, b: number) => Math.abs(a - b) < 0.0005
  for (const change of changes) {
    const item = byId.get(change.itemId)
    if (!item) { problems.push(`行 ${change.itemId} 保存后不存在`); continue }
    if (change.quantity !== undefined && !almost(item.quantity, change.quantity)) {
      problems.push(`「${item.name}」工程量未生效`)
    }
    if (change.materialPrice !== undefined && !almost(item.materialPrice, change.materialPrice)) {
      problems.push(`「${item.name}」材料价未生效`)
    }
    if (change.manualPrice !== undefined && !almost(item.manualPrice, change.manualPrice)) {
      problems.push(`「${item.name}」人工价未生效`)
    }
  }
  return problems
}

let autoSaveTimer: number | undefined
const AUTO_SAVE_DELAY_MS = 1200

function scheduleAutoSave(): void {
  if (!editable.value) return
  if (validationErrors.value.length > 0) return
  if (autoSaveTimer) window.clearTimeout(autoSaveTimer)
  autoSaveTimer = window.setTimeout(() => { void runSave() }, AUTO_SAVE_DELAY_MS)
}

async function runSave(): Promise<void> {
  if (!quote.value || !editable.value) return
  gridRef.value?.commitPending()
  validateDraft()
  if (validationErrors.value.length > 0) return
  if (dirtyCount.value === 0) return
  if (saving.value) { pendingSave.value = true; return }

  const changes = collectChanges()
  if (changes.length === 0) return
  if (changes.length > QUOTE_BATCH_MAX_LINES) {
    saveError.value = `单次最多保存 ${QUOTE_BATCH_MAX_LINES} 行，当前 ${changes.length} 行`
    return
  }

  saving.value = true
  saveError.value = ''
  try {
    await saveQuoteLines({ quoteId: quote.value.id, items: changes })
    // 保存后重新读取服务端权威数据并覆盖前端
    const fresh = await quoteInfo(quote.value.id)
    quote.value = fresh
    const notApplied = findNotApplied(changes, fresh)
    if (notApplied.length > 0) {
      saveError.value = `服务端未接受以下改动：${notApplied.join('；')}`
      return
    }
    clearDraft()
    lastSavedAt.value = `已保存 ${changes.length} 行并重算 · ${new Date().toLocaleTimeString('zh-CN')}`
  } catch (error) {
    saveError.value = error instanceof ProviderError
      ? `${error.message}（${error.code}）`
      : error instanceof Error ? error.message : '保存失败，暂不可确认'
    // 失败保留编辑内容，等待重试
  } finally {
    saving.value = false
    if (pendingSave.value) {
      pendingSave.value = false
      scheduleAutoSave()
    }
  }
}

/* ── 全屏 ── */
function toggleImmersive(): void { immersive.value = !immersive.value }

async function toggleBrowserFullscreen(): Promise<void> {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen()
    else await document.exitFullscreen()
  } catch {
    saveError.value = '当前浏览器不允许全屏，请使用工作区全屏'
  }
  browserFullscreen.value = Boolean(document.fullscreenElement)
}

function onFullscreenChange(): void { browserFullscreen.value = Boolean(document.fullscreenElement) }

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && immersive.value && !document.fullscreenElement) immersive.value = false
}

/* ── 离开提醒 ── */
function onBeforeUnload(event: BeforeUnloadEvent): void {
  if (dirtyCount.value > 0) { event.preventDefault(); event.returnValue = '' }
}

onBeforeRouteLeave(() => {
  if (dirtyCount.value === 0) return true
  return window.confirm(`还有 ${dirtyCount.value} 行未保存，确定离开吗？`)
})

onMounted(async () => {
  await load()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('beforeunload', onBeforeUnload)
  document.addEventListener('fullscreenchange', onFullscreenChange)
})

onBeforeUnmount(() => {
  if (autoSaveTimer) window.clearTimeout(autoSaveTimer)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('beforeunload', onBeforeUnload)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
})
</script>

<template>
  <div class="qw" :class="{ 'qw--immersive': immersive }">
    <el-alert v-if="loadError" type="error" :closable="false" :title="loadError" />
    <el-alert v-if="validationErrors.length" type="warning" :closable="false" title="存在非法值，已暂停自动保存"
      :description="validationErrors.join('；')" />

    <template v-if="quote">
      <QuoteHeader
        class="qw__head"
        :quote-no="quote.no"
        :version="quote.version"
        :status="quote.status"
        :customer-name="quote.title || '报价单'"
        :property-line="`${rowCount} 行 · 折扣 ${quote.discount === 1 ? '未设置' : ((1 - quote.discount) * 100).toFixed(2) + '%'}`"
        :saved-amount="quote.amount"
        :save-state="saveState"
        :dirty-count="dirtyCount"
        :saving="saving"
        :can-save="canSave"
        :editable="editable"
        :immersive="immersive"
        :browser-fullscreen="browserFullscreen"
        @save="runSave"
        @toggle-immersive="toggleImmersive"
        @toggle-browser-fullscreen="toggleBrowserFullscreen"
      />

      <div class="qw__grid">
        <section class="qw__sheet">
          <QuoteSheetGrid
            ref="gridRef"
            :groups="groups"
            :status="quote.status"
            :draft="draft"
            :selected="selected"
            :collapsed-groups="collapsed"
            :invalid-cells="invalidCells"
            :loading="loading"
            @update:cell="onCell"
            @select:cell="selected = $event"
            @toggle:group="toggleGroup"
            @save="runSave"
          />
        </section>

        <QuoteDecisionPanel
          class="qw__decision"
          :saved-amount="quote.amount"
          :saved-subtotal="quote.subtotal"
          :preview="preview"
          :discount="quote.discount"
          :tax-rate="quote.taxRate"
          :save-state="saveState"
          :error-message="saveError"
          :last-saved-at="lastSavedAt"
          :dirty-count="dirtyCount"
          @retry="runSave"
        />
      </div>

      <footer class="qw__foot">
        <span>快捷键：Ctrl/Cmd + S 保存 · Enter 下一行 · Esc 还原该格</span>
        <span>当前报价总额 <MoneyText :value="quote.amount" /></span>
      </footer>
    </template>

    <EmptyState v-else-if="!loading && !loadError" title="没有可展示的报价"
      description="在地址栏加上 ?quoteId=<报价ID> 后在真实数据上验证。" />
  </div>
</template>

<style scoped lang="scss">
.qw {
  display: flex;
  flex-direction: column;
  gap: $space-3;
  padding: $space-4;
  /* 固定视口高度，让表格在内部滚动，而不是把整页撑长 */
  height: 100vh;
  overflow: hidden;
  background: $bg-page;
}

/* 工作区全屏：占满视口并隐藏页面滚动，表格获得最大高度 */
.qw--immersive {
  position: fixed;
  inset: 0;
  z-index: 100;
  padding: 0;
  overflow: hidden;
}

.qw__head { flex: 0 0 auto; }

.qw__grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 292px;
  gap: $space-3;
}

.qw__sheet {
  display: flex;
  min-width: 0;
  min-height: 0;
  background: $surface-0;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  box-shadow: $shadow-card;
  overflow: hidden;
}

.qw__decision { min-height: 0; }

.qw__foot {
  display: flex;
  justify-content: space-between;
  gap: $space-3;
  font-size: $font-caption;
  color: $text-secondary;
}

/* 1024：窄桌面降级，决策面板变为下方整宽，保住表格编辑能力 */
@media (max-width: 1024px) {
  .qw__grid { grid-template-columns: minmax(0, 1fr); }
  .qw__decision { max-height: 320px; }
}
</style>
