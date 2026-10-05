<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import QuoteHeader from '@/components/QuoteHeader.vue'
import QuoteSheetGrid from '@/components/QuoteSheetGrid.vue'
import QuoteDecisionPanel, { type QuoteSaveState } from '@/components/QuoteDecisionPanel.vue'
import QuoteFormulaBar from '@/components/QuoteFormulaBar.vue'
import QuoteVersionRail from '@/components/QuoteVersionRail.vue'
import { checkQuantityFormula } from '@/domains/trade/formula'
import MoneyText from '@/components/MoneyText.vue'
import EmptyState from '@/components/EmptyState.vue'
import { quoteInfo, saveQuoteLines, quoteDesignerPage, rebaseQuote, QUOTE_BATCH_MAX_LINES, type QuoteLineBatchItem } from '@/domains/trade/api'
import { toSheetGroups, type CellRef, type DraftMap, type EditableField } from '@/domains/trade/quote-sheet'
import type { Quote, QuoteItem } from '@/domains/trade/model'
import { previewQuoteSummary } from '@/domains/trade/preview'
import { ProviderError } from '@/core/http'

/** dev-only：真实 Provider 的报价工作台（表头 + 批量写入 + 编辑预览/正式金额分离 + 自动保存 + 双全屏）。 */
const route = useRoute()
const router = useRouter()

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
const batchProgress = ref('')

const versions = ref<Quote[]>([])
const versionsLoading = ref(false)
const versionError = ref('')
const switching = ref(false)
const rebasing = ref(false)

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

/** 载入同一客户 + 同一房屋的历史版本（客户端按 property 过滤、按 version 倒序）。 */
async function loadVersions(): Promise<void> {
  const q = quote.value
  if (!q?.customerId || !q.propertyId) {
    versions.value = q ? [q] : []
    return
  }
  versionsLoading.value = true
  versionError.value = ''
  try {
    const list = await quoteDesignerPage({ customerId: q.customerId, size: 200 })
    versions.value = list
      .filter((item) => item.propertyId === q.propertyId)
      .sort((a, b) => b.version - a.version)
  } catch {
    versions.value = q ? [q] : []
    versionError.value = '历史版本暂不可确认，请稍后重试'
  } finally {
    versionsLoading.value = false
  }
}

/** 切换版本：有未保存修改必须先拦截，给出「保存后切换 / 取消」，不得静默丢弃。 */
async function switchVersion(targetId: string): Promise<void> {
  if (targetId === quoteId.value) return
  if (dirtyCount.value > 0) {
    try {
      await ElMessageBox.confirm(
        `当前有 ${dirtyCount.value} 行未保存修改，切换版本将丢失这些修改。`,
        '有未保存修改',
        { confirmButtonText: '保存后切换', cancelButtonText: '取消', distinguishCancelAndClose: true, type: 'warning' }
      )
    } catch {
      return
    }
    await runSave()
    if (dirtyCount.value > 0) {
      ElMessage.error('保存未成功，已取消切换')
      return
    }
  }
  switching.value = true
  try {
    await router.replace({ query: { ...route.query, quoteId: targetId } })
  } finally {
    switching.value = false
  }
}

/** 改版重报：由服务端基于 Rejected 版本生成新 Draft（Web 不自造版本号）。 */
async function rebaseFromRejected(): Promise<void> {
  if (!quote.value) return
  if (dirtyCount.value > 0) {
    ElMessage.warning('请先保存或放弃当前修改，再改版重报')
    return
  }
  rebasing.value = true
  try {
    const fresh = await rebaseQuote(quote.value.id)
    ElMessage.success(`已生成新版本 V${fresh.version}`)
    await router.replace({ query: { ...route.query, quoteId: fresh.id } })
  } catch (error) {
    ElMessage.error(error instanceof ProviderError ? error.message : '改版重报失败，暂不可确认')
  } finally {
    rebasing.value = false
  }
}

async function load(): Promise<void> {
  if (!quoteId.value) { loadError.value = '缺少 quoteId 查询参数'; return }
  loading.value = true
  loadError.value = ''
  try {
    quote.value = await quoteInfo(quoteId.value)
    await loadVersions()
  } catch (error) {
    loadError.value = error instanceof ProviderError ? `${error.message}（${error.code}）` : '暂不可确认'
    quote.value = null
  } finally {
    loading.value = false
  }
}

function onCell(rowKey: string, field: EditableField, value: number | string | null): void {
  draft[rowKey] = { ...(draft[rowKey] ?? {}), [field]: value ?? (field === 'quantityFormula' ? '' : 0) }
  dirtySinceSave.value = true
  validateDraft()
  scheduleAutoSave()
}

/** 当前选中行及其所属区域（公式栏锚点）。 */
const selectedRow = computed(() => {
  const key = selected.value?.rowKey
  if (!key) return null
  for (const group of groups.value) {
    const row = group.rows.find((r) => r.key === key)
    if (row) return { row, groupName: group.name }
  }
  return null
})

/** 当前行在其区域内的行号（1 起）。 */
const selectedRowNo = computed(() => {
  const target = selectedRow.value
  if (!target) return 0
  const group = groups.value.find((g) => g.name === target.groupName)
  if (!group) return 0
  return group.rows.findIndex((r) => r.key === target.row.key) + 1
})

const selectedFormula = computed(() => {
  const target = selectedRow.value
  if (!target) return ''
  return String(draft[target.row.key]?.quantityFormula ?? target.row.quantityFormula ?? '')
})

/**
 * 公式结果**不由前端计算**：Q5 要求服务端权威重算。
 * 未保存的公式在公式栏显示"待服务端计算"，保存后展示服务端返回的结果快照。
 */
const formulaPreview = computed(() => {
  const target = selectedRow.value
  if (!target) return null
  // 无公式时，工程量是可直接展示的输入值
  if (!String(selectedFormula.value).trim()) {
    return draft[target.row.key]?.quantity ?? target.row.quantity
  }
  return null
})

/** 公式栏提交：写入草稿并按需触发自动保存。非法公式不提交。 */
function commitFormula(formula: string): void {
  const target = selectedRow.value
  if (!target) return
  if (!checkQuantityFormula(formula).ok) return
  draft[target.row.key] = { ...(draft[target.row.key] ?? {}), quantityFormula: formula }
  dirtySinceSave.value = true
  validateDraft()
  scheduleAutoSave()
}

function commitFormulaAndNext(formula: string): void {
  const target = selectedRow.value
  commitFormula(formula)
  if (target) gridRef.value?.focusNextRow(target.row.key, 'quantityFormula')
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

/**
 * 组装批量保存入参：按**表格显示顺序**（区域 → 行）遍历，保证分批顺序稳定可追踪。
 * 只有 Draft、且只提交有改动的行。
 */
function collectChanges(): QuoteLineBatchItem[] {
  const changes: QuoteLineBatchItem[] = []
  const orderedKeys = groups.value.flatMap((g) => g.rows.map((r) => r.key))
  for (const rowKey of orderedKeys) {
    const patch = draft[rowKey]
    if (!patch) continue
    const item = itemByKey.value.get(rowKey)
    if (!item) continue
    const change: QuoteLineBatchItem = { itemId: rowKey }
    // 工程量**必须始终携带**：后端 `QuoteLine.quantity` 实体默认值是 1，
    // 请求缺省时会被当作"显式 1"覆盖原工程量（已实测复现：只改材料价把工程量 30→1）。
    const quantity = patch.quantity ?? item.quantity
    if (Number(quantity) > 0) change.quantity = Number(quantity)
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

/** 单批最大行数，与服务端 MAX_LINES 对齐。 */
const BATCH_SIZE = QUOTE_BATCH_MAX_LINES

interface BatchOutcome {
  batches: { index: number; size: number; ok: boolean; error?: string }[]
  succeededKeys: string[]
  failedBatchIndex: number | null
}

/**
 * 按稳定顺序分批保存。
 *
 * ⚠️ 事务边界：服务端每次调用是一个独立事务，**跨批次不保证原子性**。
 * 因此逐批追踪结果——成功批保留、失败批及其后批次的行保持脏数据可重试，
 * 并在每批成功后重新读取服务端结果，绝不静默只保存前 N 行。
 */
async function saveInBatches(quoteIdValue: string, changes: QuoteLineBatchItem[]): Promise<BatchOutcome> {
  const batches: BatchOutcome['batches'] = []
  const succeededKeys: string[] = []
  let failedBatchIndex: number | null = null

  for (let i = 0; i < changes.length; i += BATCH_SIZE) {
    const slice = changes.slice(i, i + BATCH_SIZE)
    const index = Math.floor(i / BATCH_SIZE)
    try {
      await saveQuoteLines({ quoteId: quoteIdValue, items: slice })
      batches.push({ index, size: slice.length, ok: true })
      succeededKeys.push(...slice.map((c) => c.itemId))
    } catch (error) {
      const message = error instanceof ProviderError
        ? `${error.message}（${error.code}）`
        : error instanceof Error ? error.message : '暂不可确认'
      batches.push({ index, size: slice.length, ok: false, error: message })
      failedBatchIndex = index
      break
    }
  }
  return { batches, succeededKeys, failedBatchIndex }
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

  saving.value = true
  saveError.value = ''
  batchProgress.value = ''
  try {
    const outcome = await saveInBatches(quote.value.id, changes)
    const totalBatches = Math.ceil(changes.length / BATCH_SIZE)

    // 无论成败都重新读取服务端权威数据并覆盖前端
    const fresh = await quoteInfo(quote.value.id)
    quote.value = fresh

    const succeeded = changes.filter((c) => outcome.succeededKeys.includes(c.itemId))
    const notApplied = findNotApplied(succeeded, fresh)

    // 只清除成功批次对应的草稿；失败批及其后批次保留脏数据可重试
    for (const key of outcome.succeededKeys) delete draft[key]
    dirtySinceSave.value = Object.keys(draft).length > 0

    if (outcome.failedBatchIndex !== null) {
      const failed = outcome.batches.find((b) => !b.ok)
      saveError.value = `第 ${(failed?.index ?? 0) + 1}/${totalBatches} 批保存失败（${failed?.size ?? 0} 行）：${failed?.error ?? '暂不可确认'}。已成功 ${outcome.succeededKeys.length} 行，其余保留为未保存，可重试。`
      batchProgress.value = `已保存 ${outcome.batches.filter((b) => b.ok).length}/${totalBatches} 批`
      return
    }
    if (notApplied.length > 0) {
      saveError.value = `服务端未接受以下改动：${notApplied.join('；')}`
      return
    }

    const batchNote = totalBatches > 1 ? `（分 ${totalBatches} 批）` : ''
    lastSavedAt.value = `已保存 ${changes.length} 行${batchNote}并重算 · ${new Date().toLocaleTimeString('zh-CN')}`
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

// 版本切换只改变 query，组件会被复用 → 必须监听 quoteId 重新加载，
// 否则 URL 变了但页面仍是上一个版本的数据（已实测复现）。
watch(quoteId, async () => { await load() })

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

      <div class="qw__grid qw__grid--three">
        <QuoteVersionRail
          :current-id="quote.id"
          :versions="versions"
          :loading="versionsLoading"
          :error="versionError"
          :has-unsaved="dirtyCount > 0"
          :switching="switching || rebasing"
          @switch="switchVersion"
          @rebase="rebaseFromRejected"
        />

        <section class="qw__sheet qw__sheet--stack">
          <QuoteFormulaBar
            :region-name="selectedRow?.groupName"
            :row-no="selectedRowNo"
            :value="selectedFormula"
            :saved-quantity="selectedRow?.row.quantity ?? null"
            :saved-amount="selectedRow?.row.amount ?? null"
            :preview-quantity="formulaPreview"
            :disabled="!editable"
            :empty="!selectedRow"
            @commit="commitFormula"
            @next="commitFormulaAndNext"
          />
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
        <span>快捷键：Ctrl/Cmd + S 保存 · Enter 下一行 · Esc 还原该格{{ batchProgress ? ` · ${batchProgress}` : '' }}</span>
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
  gap: $space-3;
}

/* 三栏：版本轨道 | 报价表 | 报价决策（G1.5 冻结栅格 220 / 1fr / 292） */
.qw__grid--three { grid-template-columns: 220px minmax(0, 1fr) 292px; }

.qw__sheet--stack { flex-direction: column; }

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
@media (max-width: 1280px) {
  .qw__grid--three { grid-template-columns: 200px minmax(0, 1fr) 268px; }
}

@media (max-width: 1024px) {
  .qw__grid--three { grid-template-columns: minmax(0, 1fr); }
  .qw__grid--three > *:not(.qw__sheet) { max-height: 300px; }
  .qw__decision { max-height: 320px; }
}
</style>
