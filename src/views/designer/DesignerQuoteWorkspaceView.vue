<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import QuoteHeader from '@/components/QuoteHeader.vue'
import QuoteSheetGrid from '@/components/QuoteSheetGrid.vue'
import QuoteDecisionPanel, { type QuoteSaveState } from '@/components/QuoteDecisionPanel.vue'
import QuoteFormulaBar from '@/components/QuoteFormulaBar.vue'
import QuoteVersionRail from '@/components/QuoteVersionRail.vue'
import { checkQuantityFormula } from '@/domains/trade/formula'
import MoneyText from '@/components/MoneyText.vue'
import EmptyState from '@/components/EmptyState.vue'
import {
  quoteInfo,
  saveQuoteLines,
  quoteDesignerPage,
  rebaseQuote,
  transitionQuote,
  deleteQuoteLine,
  exportQuoteWorkbook,
  importQuoteWorkbook,
  applyQuoteWorkbook,
  QUOTE_BATCH_MAX_LINES,
  type QuoteLineBatchItem,
  type QuoteWorkbookImportResult
} from '@/domains/trade/api'
import { buildQuotePdf, type DocumentArchive } from '@/domains/document/api'
import { QUOTE_STATUS_META } from '@/domains/trade/meta'
import { toSheetGroups, type CellRef, type DraftMap, type EditableField } from '@/domains/trade/quote-sheet'
import type { Quote, QuoteItem } from '@/domains/trade/model'
import { previewQuoteSummary } from '@/domains/trade/preview'
import { ProviderError } from '@/core/http'

/** 设计师报价工作区：真实 Provider、批量写入、编辑预览/正式金额分离、自动保存、版本轨道与双全屏。 */
const route = useRoute()
const session = useSessionStore()
const router = useRouter()
/** 客户接受的登记责任人按用户 2026-10-11 裁决为**设计师**；实际权限仍以服务端为准。 */
const canRegisterAcceptance = computed(() => ['Designer', 'Boss'].includes(session.role ?? ''))

const quote = ref<Quote | null>(null)
const loading = ref(false)
const loadError = ref('')
const selected = ref<CellRef | null>(null)
const selectedRowKeys = ref<string[]>([])
const selectionAnchor = ref('')
const collapsed = ref<string[]>([])
const draft = reactive<DraftMap>({})
const gridRef = ref<InstanceType<typeof QuoteSheetGrid> | null>(null)

const saving = ref(false)
const submitting = ref(false)
const accepting = ref(false)
const deleting = ref(false)
const batchDeleting = ref(false)
const diffVisible = ref(false)
const diffBaseId = ref('')
const diffBase = ref<Quote | null>(null)
const diffLoading = ref(false)
const diffError = ref('')
const importInput = ref<HTMLInputElement | null>(null)
const importVisible = ref(false)
const importLoading = ref(false)
const importApplying = ref(false)
const importResult = ref<QuoteWorkbookImportResult | null>(null)
const importFileName = ref('')
const importContentBase64 = ref('')
const importError = ref('')
const exportingExcel = ref(false)
const exportingPdf = ref(false)
const pdfVisible = ref(false)
const pdfRecord = ref<DocumentArchive | null>(null)
const pdfError = ref('')
const batchVisible = ref(false)
const batchField = ref<'materialPrice' | 'manualPrice'>('materialPrice')
const batchMode = ref<'set' | 'increasePercent' | 'decreasePercent' | 'increaseAmount' | 'decreaseAmount'>('set')
const batchValue = ref<number | null>(null)
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

type QuoteDiffKind = 'added' | 'removed' | 'changed'

interface QuoteDiffRow {
  kind: QuoteDiffKind
  itemId: string
  name: string
  baseAmount: number | null
  currentAmount: number | null
  delta: number | null
  note: string
}

function compareQuoteItems(current: Quote, base: Quote): QuoteDiffRow[] {
  const remaining = [...base.items]
  const rows: QuoteDiffRow[] = []

  const businessKey = (item: QuoteItem): string => [
    item.catalogItem?.itemId ?? '',
    item.name,
    item.space?.name ?? '',
    item.spec ?? '',
    item.unit
  ].join('|').toLowerCase()

  const consumeMatch = (item: QuoteItem): QuoteItem | undefined => {
    let index = remaining.findIndex((candidate) => candidate.id === item.id)
    if (index < 0 && item.catalogItem?.itemId) {
      index = remaining.findIndex((candidate) => candidate.catalogItem?.itemId === item.catalogItem?.itemId)
    }
    if (index < 0) {
      const key = businessKey(item)
      index = remaining.findIndex((candidate) => businessKey(candidate) === key)
    }
    if (index < 0) return undefined
    return remaining.splice(index, 1)[0]
  }

  for (const item of current.items) {
    const before = consumeMatch(item)
    if (!before) {
      rows.push({ kind: 'added', itemId: item.id, name: item.name, baseAmount: null, currentAmount: item.amount, delta: item.amount, note: '新增分项' })
      continue
    }
    const fields: string[] = []
    if (Math.abs(before.quantity - item.quantity) > 0.0005) fields.push(`工程量 ${before.quantity}→${item.quantity}`)
    if (Math.abs(before.materialPrice - item.materialPrice) > 0.0005) fields.push(`材料价 ${before.materialPrice}→${item.materialPrice}`)
    if (Math.abs(before.manualPrice - item.manualPrice) > 0.0005) fields.push(`人工价 ${before.manualPrice}→${item.manualPrice}`)
    if (String(before.quantityFormula ?? '') !== String(item.quantityFormula ?? '')) fields.push('工程量公式变化')
    if (Math.abs(before.amount - item.amount) > 0.0005) fields.push('金额变化')
    if (fields.length > 0) {
      rows.push({ kind: 'changed', itemId: item.id, name: item.name, baseAmount: before.amount, currentAmount: item.amount, delta: item.amount - before.amount, note: fields.join('；') })
    }
  }

  for (const item of remaining) {
    rows.push({ kind: 'removed', itemId: item.id, name: item.name, baseAmount: item.amount, currentAmount: null, delta: -item.amount, note: '当前版本已移除' })
  }
  return rows
}
const diffRows = computed(() => (quote.value && diffBase.value ? compareQuoteItems(quote.value, diffBase.value) : []))
const diffSummary = computed(() => ({
  added: diffRows.value.filter((row) => row.kind === 'added').length,
  removed: diffRows.value.filter((row) => row.kind === 'removed').length,
  changed: diffRows.value.filter((row) => row.kind === 'changed').length
}))

const immersive = ref(false)
const browserFullscreen = ref(false)

const quoteId = computed(() => String(route.params.quoteId ?? route.query.quoteId ?? ''))
const groups = computed(() => (quote.value ? toSheetGroups(quote.value) : []))
const rowCount = computed(() => groups.value.reduce((sum, g) => sum + g.rows.length, 0))
const dirtyCount = computed(() => Object.keys(draft).length)
const editable = computed(() => quote.value?.status === 'draft')

const itemByKey = computed(() => {
  const map = new Map<string, QuoteItem>()
  quote.value?.items.forEach((item) => map.set(item.id, item))
  return map
})
const orderedRowKeys = computed(() => groups.value.flatMap((group) => group.rows.map((row) => row.key)))
const selectedRowCount = computed(() => selectedRowKeys.value.filter((key) => itemByKey.value.has(key)).length)
const quoteRowCount = computed(() => groups.value.reduce((sum, group) => sum + group.rows.length, 0))
const batchFieldLabel = computed(() => batchField.value === 'materialPrice' ? '材料价' : '人工价')
const batchPreviewText = computed(() => {
  const value = Number(batchValue.value)
  if (!Number.isFinite(value) || value <= 0) return '待填写改价数值'
  if (batchMode.value === 'set') return `${batchFieldLabel.value}统一设置为 ${value.toFixed(2)}`
  if (batchMode.value === 'increasePercent') return `${batchFieldLabel.value}统一上调 ${value}%`
  if (batchMode.value === 'decreasePercent') return `${batchFieldLabel.value}统一下调 ${value}%`
  if (batchMode.value === 'increaseAmount') return `${batchFieldLabel.value}统一增加 ¥${value.toFixed(2)}`
  return `${batchFieldLabel.value}统一减少 ¥${value.toFixed(2)}`
})

function clearRowSelection(): void {
  selectedRowKeys.value = []
  selectionAnchor.value = ''
}

function pruneRowSelection(): void {
  selectedRowKeys.value = selectedRowKeys.value.filter((key) => itemByKey.value.has(key))
  if (selectionAnchor.value && !itemByKey.value.has(selectionAnchor.value)) selectionAnchor.value = ''
}

function toggleRowSelection(rowKey: string, shiftKey: boolean): void {
  if (!editable.value) return
  const keys = orderedRowKeys.value
  if (!keys.includes(rowKey)) return
  const next = new Set(selectedRowKeys.value)
  if (shiftKey && selectionAnchor.value && keys.includes(selectionAnchor.value)) {
    const from = keys.indexOf(selectionAnchor.value)
    const to = keys.indexOf(rowKey)
    const start = Math.min(from, to)
    const end = Math.max(from, to)
    const shouldSelect = !next.has(rowKey)
    for (let index = start; index <= end; index += 1) {
      if (shouldSelect) next.add(keys[index])
      else next.delete(keys[index])
    }
  } else {
    if (next.has(rowKey)) next.delete(rowKey)
    else next.add(rowKey)
    selectionAnchor.value = rowKey
  }
  selectedRowKeys.value = keys.filter((key) => next.has(key))
}

function toggleAllRows(checked: boolean): void {
  if (!editable.value) return
  selectedRowKeys.value = checked ? [...orderedRowKeys.value] : []
  selectionAnchor.value = checked ? orderedRowKeys.value[0] ?? '' : ''
}

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
    clearRowSelection()
    await loadVersions()
  } catch (error) {
    loadError.value = error instanceof ProviderError ? `${error.message}（${error.code}）` : '暂不可确认'
    quote.value = null
  } finally {
    loading.value = false
  }
}

/**
 * 登记「客户已接受」（用户 2026-10-11 裁决：登记责任人为**设计师**）。
 * 口径：客户决策发生在小程序；设计师在 Web 登记结果，登记后进入合同交接。
 * 前端不自造状态机，只调用既有 `quote/update(Accepted)`，成功后回读服务端快照。
 */
async function registerCustomerAccepted(): Promise<void> {
  const current = quote.value
  if (!current || current.status !== 'submitted') return
  try {
    await ElMessageBox.confirm(
      '请确认客户已接受该报价。登记后报价进入「客户已接受」，下一步由企业负责人 / 店长在「待我签约」确认签约并发起合同。是否登记？',
      '登记客户已接受',
      { type: 'warning' }
    )
    accepting.value = true
    await transitionQuote(current.id, 'accepted')
    quote.value = await quoteInfo(current.id)
    await loadVersions()
    ElMessage.success('已登记客户接受，下一步由企业负责人 / 店长确认签约')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof ProviderError ? error.message : '登记失败，暂不可确认')
    }
  } finally {
    accepting.value = false
  }
}

/** 返回报价池；正式设计师壳层内不丢失工作台的筛选与上下文。 */
function goBack(): void {
  void router.push('/designer/quotes')
}

/** 草稿提交客户：必须无未保存修改，提交后重新读取服务端快照。 */
async function submitToCustomer(): Promise<void> {
  const current = quote.value
  if (!current || current.status !== 'draft') return
  gridRef.value?.commitPending()
  if (dirtyCount.value > 0) {
    ElMessage.warning('有未保存的修改，请先保存草稿再提交')
    return
  }
  try {
    await ElMessageBox.confirm(
      '提交后报价进入「待客户确认」，本页转为只读；客户驳回后才能改版重报。是否提交？',
      '提交客户确认',
      { type: 'warning' }
    )
    submitting.value = true
    await transitionQuote(current.id, 'submitted')
    quote.value = await quoteInfo(current.id)
    clearRowSelection()
    await loadVersions()
    ElMessage.success('报价已提交，等待客户决策')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof ProviderError ? error.message : '提交失败，暂不可确认')
    }
  } finally {
    submitting.value = false
  }
}

/** 删除报价行：只允许 Draft；删除后由服务端重算并重新读取。 */
async function deleteRow(rowKey: string): Promise<void> {
  const current = quote.value
  if (!current || current.status !== 'draft') return
  const item = itemByKey.value.get(rowKey)
  if (!item) return
  try {
    await ElMessageBox.confirm(`确定删除「${item.name}」？删除后由服务端重新计算报价。`, '删除报价行', { type: 'warning' })
    deleting.value = true
    await deleteQuoteLine(current.id, rowKey)
    delete draft[rowKey]
    quote.value = await quoteInfo(current.id)
    pruneRowSelection()
    await loadVersions()
    ElMessage.success('报价行已删除，金额已由服务端重算')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof ProviderError ? error.message : '删除失败，暂不可确认')
    }
  } finally {
    deleting.value = false
  }
}

/** 多行删除：逐行调用 App 既有删除 Provider；失败行保留选择，不静默跳过。 */
async function deleteSelectedRows(): Promise<void> {
  const current = quote.value
  if (!current || current.status !== 'draft' || selectedRowKeys.value.length === 0) return
  const keys = orderedRowKeys.value.filter((key) => selectedRowKeys.value.includes(key))
  if (keys.length === 0) {
    clearRowSelection()
    return
  }
  const unsavedCount = keys.filter((key) => draft[key]).length
  const unsavedTip = unsavedCount > 0 ? `其中 ${unsavedCount} 行有未保存修改，删除后将一并丢弃。` : ''
  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${keys.length} 行？${unsavedTip}删除后由服务端重新计算报价。`,
      '批量删除报价行',
      { type: 'warning' }
    )
  } catch {
    return
  }

  batchDeleting.value = true
  const failed: string[] = []
  let deleted = 0
  try {
    for (const key of keys) {
      try {
        await deleteQuoteLine(current.id, key)
        delete draft[key]
        deleted += 1
      } catch {
        failed.push(key)
      }
    }
    quote.value = await quoteInfo(current.id)
    await loadVersions()
    selectedRowKeys.value = failed
    selectionAnchor.value = failed[0] ?? ''
    if (failed.length === 0) {
      ElMessage.success(`已删除 ${deleted} 行，金额已由服务端重算`)
    } else {
      ElMessage.warning(`已删除 ${deleted} 行，${failed.length} 行删除失败并保留选中，可重试`)
    }
  } catch (error) {
    ElMessage.error(error instanceof ProviderError ? error.message : '批量删除失败，暂不可确认')
  } finally {
    batchDeleting.value = false
    pruneRowSelection()
  }
}

/** 版本对比：当前版本 vs 选定历史版本，按行展示新增/删除/变化。 */
async function loadVersionDiff(baseId: string): Promise<void> {
  diffBaseId.value = baseId
  diffBase.value = null
  diffError.value = ''
  if (!baseId) return
  diffLoading.value = true
  try {
    diffBase.value = await quoteInfo(baseId)
  } catch (error) {
    diffError.value = error instanceof ProviderError ? error.message : '历史版本暂不可确认'
  } finally {
    diffLoading.value = false
  }
}

function openVersionDiff(): void {
  if (versions.value.length < 2) {
    ElMessage.info('当前没有可对比的历史版本')
    return
  }
  const sorted = [...versions.value].sort((left, right) => right.version - left.version)
  const currentIndex = sorted.findIndex((item) => item.id === quote.value?.id)
  const previous = currentIndex >= 0 ? sorted[currentIndex + 1] : sorted[1]
  diffVisible.value = true
  void loadVersionDiff(previous?.id ?? '')
}

function openVersionFromDiff(id: string): void {
  diffVisible.value = false
  void switchVersion(id)
}

function base64ToBlob(contentBase64: string, contentType: string): Blob {
  const binary = window.atob(contentBase64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: contentType })
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function openImport(): void {
  if (!editable.value) return
  importInput.value?.click()
}

async function handleImportFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !quote.value) return
  importError.value = ''
  importLoading.value = true
  try {
    const contentBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = String(reader.result ?? '')
        resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result)
      }
      reader.onerror = () => reject(reader.error ?? new Error('文件读取失败'))
      reader.readAsDataURL(file)
    })
    importFileName.value = file.name
    importContentBase64.value = contentBase64
    importResult.value = await importQuoteWorkbook(quote.value.id, file.name, contentBase64)
    importVisible.value = true
  } catch (error) {
    importError.value = error instanceof ProviderError ? error.message : 'Excel 解析失败，暂不可确认'
  } finally {
    importLoading.value = false
    if (input) input.value = ''
  }
}

async function confirmImport(): Promise<void> {
  const current = quote.value
  const result = importResult.value
  if (!current || !result || result.failed > 0) return
  importApplying.value = true
  importError.value = ''
  try {
    if (!importContentBase64.value) throw new Error('导入文件内容已失效，请重新选择')
    quote.value = await applyQuoteWorkbook(current.id, importFileName.value, importContentBase64.value, 'MERGE')
    clearRowSelection()
    importVisible.value = false
    importResult.value = null
    await loadVersions()
    ElMessage.success('Excel 已导入并由服务端重新计算')
  } catch (error) {
    importError.value = error instanceof ProviderError ? error.message : '导入落库失败，暂不可确认'
  } finally {
    importApplying.value = false
  }
}

async function exportExcel(): Promise<void> {
  if (!quote.value) return
  exportingExcel.value = true
  try {
    const file = await exportQuoteWorkbook(quote.value.id)
    if (!file.contentBase64) throw new Error('导出文件内容为空')
    downloadBlob(base64ToBlob(file.contentBase64, file.contentType), file.fileName)
    ElMessage.success('报价工作簿已导出')
  } catch (error) {
    ElMessage.error(error instanceof ProviderError ? error.message : 'Excel 导出失败，暂不可确认')
  } finally {
    exportingExcel.value = false
  }
}

async function exportPdf(): Promise<void> {
  if (!quote.value) return
  exportingPdf.value = true
  pdfError.value = ''
  try {
    pdfRecord.value = await buildQuotePdf(quote.value.id)
    if (!pdfRecord.value.url) throw new Error('打印稿访问地址为空')
    pdfVisible.value = true
  } catch (error) {
    pdfError.value = error instanceof ProviderError ? error.message : 'PDF 导出失败，暂不可确认'
  } finally {
    exportingPdf.value = false
  }
}

function openBatchPrice(): void {
  if (!editable.value) return
  batchField.value = 'materialPrice'
  batchMode.value = 'set'
  batchValue.value = null
  batchVisible.value = true
}

/** 表头批量改价：只写本地草稿，仍由用户确认后通过既有批量保存提交服务端。 */
function applyBatchPrice(): void {
  const amount = Number(batchValue.value)
  if (!Number.isFinite(amount) || amount <= 0) {
    ElMessage.warning('请输入大于 0 的数值')
    return
  }
  let changed = 0
  for (const group of groups.value) {
    for (const row of group.rows) {
      const current = Number(draft[row.key]?.[batchField.value] ?? row[batchField.value] ?? 0)
      let next = current
      if (batchMode.value === 'set') next = amount
      if (batchMode.value === 'increasePercent') next = current * (1 + amount / 100)
      if (batchMode.value === 'decreasePercent') next = current * (1 - amount / 100)
      if (batchMode.value === 'increaseAmount') next = current + amount
      if (batchMode.value === 'decreaseAmount') next = current - amount
      if (next <= 0) next = 0.01
      if (Math.abs(next - current) > 0.0005) {
        draft[row.key] = { ...(draft[row.key] ?? {}), [batchField.value]: Number(next.toFixed(2)) }
        changed += 1
      }
    }
  }
  dirtySinceSave.value = changed > 0
  validateDraft()
  if (changed > 0) scheduleAutoSave()
  batchVisible.value = false
  ElMessage.success(`已修改 ${changed} 行，保存后由服务端重算`)
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
    // 只标记真正被修改的字段；未标记的字段由服务端保留原值（ECD-014）
    if (patch.quantity !== undefined || patch.quantityFormula !== undefined) {
      const quantity = patch.quantity ?? item.quantity
      if (Number(quantity) > 0) {
        change.quantity = Number(quantity)
        change.quantityProvided = true
      }
    }
    const formula = patch.quantityFormula
    if (formula !== undefined) {
      const trimmed = String(formula).trim()
      if (trimmed) change.quantityFormula = trimmed
    }
    if (patch.materialPrice !== undefined) {
      change.materialPrice = Number(patch.materialPrice)
      change.materialPriceProvided = true
    }
    if (patch.manualPrice !== undefined) {
      change.manualPrice = Number(patch.manualPrice)
      change.manualPriceProvided = true
    }
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
  /** true = 因并发冲突（409）中止 */
  conflict: boolean
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
  let conflict = false

  // 链式修订：以读取时的令牌作为第 1 批基准，之后每批使用服务端返回的新令牌。
  // 禁止批间重新读取（那会吞并他人改动、绕过冲突检测）。
  let token = quote.value?.revision

  for (let i = 0; i < changes.length; i += BATCH_SIZE) {
    const slice = changes.slice(i, i + BATCH_SIZE)
    const index = Math.floor(i / BATCH_SIZE)
    try {
      const nextToken = await saveQuoteLines({ quoteId: quoteIdValue, items: slice, revisionToken: token })
      if (nextToken) token = nextToken
      batches.push({ index, size: slice.length, ok: true })
      succeededKeys.push(...slice.map((c) => c.itemId))
    } catch (error) {
      const code = error instanceof ProviderError ? error.code : ''
      const message = error instanceof ProviderError
        ? `${error.message}（${error.code}）`
        : error instanceof Error ? error.message : '暂不可确认'
      if (code === '409') conflict = true
      batches.push({ index, size: slice.length, ok: false, error: message })
      failedBatchIndex = index
      break // 任一后续批冲突 → 立即停止后续批
    }
  }
  return { batches, succeededKeys, failedBatchIndex, conflict }
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
    pruneRowSelection()

    const succeeded = changes.filter((c) => outcome.succeededKeys.includes(c.itemId))
    const notApplied = findNotApplied(succeeded, fresh)

    // 只清除成功批次对应的草稿；失败批及其后批次保留脏数据可重试
    for (const key of outcome.succeededKeys) delete draft[key]
    dirtySinceSave.value = Object.keys(draft).length > 0

    if (outcome.failedBatchIndex !== null) {
      const failed = outcome.batches.find((b) => !b.ok)
      const done = outcome.succeededKeys.length
      saveError.value = outcome.conflict
        ? `报价已被他人修改（第 ${(failed?.index ?? 0) + 1}/${totalBatches} 批冲突）。已成功保存 ${done} 行；其余 ${changes.length - done} 行保留为未保存，请重新读取后重试。`
        : `第 ${(failed?.index ?? 0) + 1}/${totalBatches} 批保存失败（${failed?.size ?? 0} 行）：${failed?.error ?? '暂不可确认'}。已成功 ${done} 行，其余保留为未保存，可重试。`
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
        :submitting="submitting"
        :can-save="canSave"
        :editable="editable"
        :immersive="immersive"
        :browser-fullscreen="browserFullscreen"
        @back="goBack"
        @save="runSave"
        @submit="submitToCustomer"
        @open-version-diff="openVersionDiff"
        @toggle-immersive="toggleImmersive"
        @toggle-browser-fullscreen="toggleBrowserFullscreen"
      />

      <div class="qw__outputs">
        <el-button :disabled="!editable" @click="openBatchPrice">批量改价</el-button>
        <el-button
          type="danger"
          plain
          :disabled="!editable || selectedRowCount === 0 || batchDeleting"
          :loading="batchDeleting"
          @click="deleteSelectedRows"
        >
          删除选中{{ selectedRowCount > 0 ? ` (${selectedRowCount})` : '' }}
        </el-button>
        <el-button :loading="exportingExcel" @click="exportExcel">导出 Excel</el-button>
        <el-button :disabled="!editable || importLoading" :loading="importLoading" @click="openImport">导入 Excel</el-button>
        <el-button :loading="exportingPdf" @click="exportPdf">导出 PDF</el-button>
        <el-button
          v-if="canRegisterAcceptance && quote.status === 'submitted'"
          type="primary"
          :loading="accepting"
          @click="registerCustomerAccepted"
        >登记客户已接受</el-button>
        <input ref="importInput" type="file" accept=".xlsx" hidden @change="handleImportFile" />
      </div>

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
            :selected-rows="selectedRowKeys"
            :collapsed-groups="collapsed"
            :invalid-cells="invalidCells"
            :loading="loading"
            @update:cell="onCell"
            @select:cell="selected = $event"
            @toggle:group="toggleGroup"
            @toggle:row="toggleRowSelection"
            @toggle:all="toggleAllRows"
            @delete:row="deleteRow"
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
          :quote-status="quote.status"
          @retry="runSave"
        />
      </div>

      <!-- 口径显式标注（用户 2026-10-11 裁决 ②）：库内分项按固定工程量、不参与区域重算，工程量保留原值。 -->
      <el-alert
        class="qw__formula-note"
        type="info"
        :closable="false"
        show-icon
        title="报价项目库分项口径：按固定工程量计入，不参与区域/全屋公式重算"
      >
        <p>企业在「报价项目库」维护的分项使用中文单价口径（如「(人工单价) × 工程量」），进入设计方案后<strong>保留原工程量、不参与区域实测重算</strong>；需要按专业变量（A/P/CP/WP）重算的分项，请在项目库改用专业变量公式后重新选择。</p>
      </el-alert>

      <footer class="qw__foot">
        <span>快捷键：Ctrl/Cmd + S 保存 · Enter 下一行 · Esc 还原该格{{ deleting ? ' · 正在删除报价行' : '' }}{{ batchDeleting ? ' · 正在批量删除报价行' : '' }}{{ batchProgress ? ` · ${batchProgress}` : '' }}</span>
        <span>当前报价总额 <MoneyText :value="quote.amount" /></span>
      </footer>
    </template>

    <EmptyState v-else-if="!loading && !loadError" title="没有可展示的报价"
      description="请从报价列表选择一份报价，或在开发预览中使用 ?quoteId=<报价ID>。" />


    <el-dialog v-model="diffVisible" title="版本对比" width="920px" append-to-body>
      <div class="qw__diff-toolbar">
        <el-select v-model="diffBaseId" placeholder="选择对比版本" style="width: 220px" @change="loadVersionDiff">
          <el-option
            v-for="item in [...versions].sort((left, right) => right.version - left.version)"
            :key="item.id"
            :label="`V${item.version} · ${QUOTE_STATUS_META[item.status].label} · ${item.no}`"
            :value="item.id"
            :disabled="item.id === quote?.id"
          />
        </el-select>
        <span v-if="diffBase" class="qw__diff-tip">
          当前 V{{ quote?.version }} 对比 V{{ diffBase.version }}：
          新增 {{ diffSummary.added }} · 删除 {{ diffSummary.removed }} · 变化 {{ diffSummary.changed }}
        </span>
      </div>

      <el-alert v-if="diffError" type="error" :closable="false" :title="diffError" show-icon />
      <el-skeleton v-else-if="diffLoading" :rows="6" animated />

      <div v-else-if="diffBase" class="qw__diff-table">
        <div class="qw__diff-head">
          <span>类型 / 项目</span>
          <span>原版本</span>
          <span>当前版本</span>
          <span>差额</span>
          <span>变化说明</span>
        </div>
        <div
          v-for="row in diffRows"
          :key="`${row.kind}-${row.itemId}`"
          class="qw__diff-row-data"
          :class="`qw__diff-row-data--${row.kind}`"
        >
          <span>
            <b>{{ row.kind === 'added' ? '新增' : row.kind === 'removed' ? '删除' : '变化' }}</b>
            {{ row.name }}
          </span>
          <MoneyText :value="row.baseAmount" />
          <MoneyText :value="row.currentAmount" />
          <MoneyText :value="row.delta" delta />
          <span class="qw__diff-note">{{ row.note }}</span>
        </div>
        <EmptyState v-if="!diffRows.length" title="两个版本没有行级差异" description="版本之间存在金额或行项变化时才会显示。" />
      </div>

      <div v-else class="qw__diff-empty">请选择一个历史版本进行对比。</div>

      <template #footer>
        <el-button v-if="diffBaseId" @click="openVersionFromDiff(diffBaseId)">打开对比版本</el-button>
        <el-button @click="diffVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="batchVisible" title="批量改价" width="min(620px, 96vw)" append-to-body>
      <div class="qw__batch-context">
        <div>
          <span>报价</span>
          <strong>{{ quote?.no || '报价待确认' }}</strong>
          <small>V{{ quote?.version || '—' }} · {{ quote?.customerName || '客户待补充' }} · {{ quote?.propertyName || '房屋待补充' }}</small>
        </div>
        <div>
          <span>作用范围</span>
          <strong>全部报价行</strong>
          <small>共 {{ quoteRowCount }} 行；只写本地草稿，不直接改服务端正式金额。</small>
        </div>
      </div>
      <el-form label-position="top" class="qw__batch-grid">
        <el-form-item label="改价字段">
          <el-select v-model="batchField" style="width: 100%">
            <el-option label="材料价" value="materialPrice" />
            <el-option label="人工价" value="manualPrice" />
          </el-select>
        </el-form-item>
        <el-form-item label="改价方式">
          <el-select v-model="batchMode" style="width: 100%">
            <el-option label="设置为" value="set" />
            <el-option label="按比例上调" value="increasePercent" />
            <el-option label="按比例下调" value="decreasePercent" />
            <el-option label="按金额上调" value="increaseAmount" />
            <el-option label="按金额下调" value="decreaseAmount" />
          </el-select>
        </el-form-item>
        <el-form-item :label="batchMode.includes('Percent') ? '比例（%）' : '金额（元）'">
          <el-input-number v-model="batchValue" :min="batchMode === 'set' ? 0.01 : 0" :precision="2" style="width: 100%" />
        </el-form-item>
      </el-form>
      <div class="qw__batch-preview">
        <span>结果预览</span>
        <strong>{{ batchPreviewText }}</strong>
        <small>批量修改只作用于当前报价草稿；保存后由服务端统一重算金额。</small>
      </div>
      <template #footer>
        <el-button @click="batchVisible = false">取消</el-button>
        <el-button type="primary" @click="applyBatchPrice">应用到全部报价行</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importVisible" title="Excel 导入预览" width="920px" append-to-body>
      <el-alert
        v-if="importError"
        type="error"
        :closable="false"
        :title="importError"
        show-icon
      />
      <div v-if="importResult" class="qw__import-summary">
        共 {{ importResult.total }} 行，可导入 {{ importResult.valid }} 行，错误 {{ importResult.failed }} 行。
        <b>错误行会阻止整个导入，不会静默跳过。</b>
      </div>
      <div v-if="importResult" class="qw__import-table">
        <div class="qw__import-head">
          <span>Excel 行</span>
          <span>项目</span>
          <span>工程量</span>
          <span>材料价</span>
          <span>人工价</span>
          <span>结果</span>
          <span>错误</span>
        </div>
        <div
          v-for="row in importResult.rows"
          :key="row.excelRow"
          class="qw__import-row"
          :class="{ 'qw__import-row--error': !row.importable }"
        >
          <span>{{ row.excelRow }}</span>
          <span>{{ row.name || row.region || '—' }}</span>
          <span>{{ row.quantity ?? '—' }}</span>
          <span>{{ row.materialPrice ?? '—' }}</span>
          <span>{{ row.manualPrice ?? '—' }}</span>
          <span>{{ row.importable ? '可导入' : '有错误' }}</span>
          <span>{{ row.errors?.join('；') || '—' }}</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="importVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="importApplying"
          :disabled="!importResult?.valid || (importResult?.failed || 0) > 0"
          @click="confirmImport"
        >
          确认导入可处理行
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="pdfVisible" title="报价 PDF" width="520px" append-to-body>
      <el-alert v-if="pdfError" type="error" :closable="false" :title="pdfError" show-icon />
      <p class="qw__pdf-note">已生成与 App 一致的客户版报价 PDF，包含销售价格，不包含成本和内部信息。</p>
      <a v-if="pdfRecord?.url" class="qw__pdf-link" :href="pdfRecord.url" target="_blank" rel="noopener">
        打开 / 下载报价 PDF
      </a>
      <p v-if="pdfRecord?.fileName" class="qw__pdf-file">{{ pdfRecord.fileName }}</p>
      <template #footer>
        <el-button @click="pdfVisible = false">关闭</el-button>
      </template>
    </el-dialog>

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

.qw__diff-toolbar {
  display: flex;
  align-items: center;
  gap: $space-3;
  margin-bottom: $space-3;
}

.qw__diff-tip {
  color: $text-secondary;
  font-size: $font-body-sm;
}

.qw__diff-table {
  overflow: hidden;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
}

.qw__diff-head,
.qw__diff-row-data {
  display: grid;
  grid-template-columns: minmax(180px, 1.2fr) 120px 120px 120px minmax(220px, 1.4fr);
  align-items: center;
  gap: $space-3;
  padding: $space-3 $space-4;
  border-bottom: 1px solid $border-color;
}

.qw__diff-head {
  background: $surface-50;
  color: $text-secondary;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
}

.qw__diff-row-data {
  font-size: $font-body-sm;

  &:last-child { border-bottom: 0; }
}

.qw__diff-row-data--added { background: $success-50; }
.qw__diff-row-data--removed { background: $danger-50; }
.qw__diff-row-data--changed { background: $warning-50; }

.qw__diff-row-data b {
  margin-right: $space-2;
  color: $brand-700;
}

.qw__diff-note {
  color: $text-secondary;
  font-size: $font-caption;
  line-height: 1.5;
}

.qw__diff-empty {
  padding: $space-6;
  color: $text-secondary;
  text-align: center;
}


.qw__outputs {
  display: flex;
  align-items: center;
  gap: $space-2;
  padding: 0 $space-1;
}

.qw__batch-context {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-3;
  margin-bottom: $space-4;
}

.qw__batch-context > div {
  min-width: 0;
  padding: $space-3 $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: linear-gradient(135deg, $brand-50 0%, $surface-0 78%);
}

.qw__batch-context span,
.qw__batch-context strong,
.qw__batch-context small { display: block; }
.qw__batch-context span { color: $text-tertiary; font-size: $font-caption; }
.qw__batch-context strong { margin-top: 3px; font-size: $font-body-sm; }
.qw__batch-context small { margin-top: 3px; color: $text-secondary; font-size: $font-caption; line-height: 1.5; }

.qw__batch-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-3;
}

.qw__batch-preview {
  padding: $space-3 $space-4;
  border: 1px solid $brand-100;
  border-radius: $radius-md;
  background: linear-gradient(160deg, $surface-0 0%, $brand-50 100%);

  span,
  strong,
  small { display: block; }
  span { color: $text-tertiary; font-size: $font-caption; letter-spacing: .08em; }
  strong { margin-top: $space-2; color: $brand-700; font-size: $font-card-title; }
  small { margin-top: $space-1; color: $text-secondary; font-size: $font-caption; line-height: 1.5; }
}

@media (max-width: 720px) {
  .qw__batch-context,
  .qw__batch-grid { grid-template-columns: 1fr; }
}

.qw__import-summary {
  margin-bottom: $space-3;
  padding: $space-3 $space-4;
  border-radius: $radius-sm;
  background: $surface-50;
  color: $text-secondary;
  font-size: $font-body-sm;

  b { color: $text-primary; }
}

.qw__import-table {
  overflow: hidden;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
}

.qw__import-head,
.qw__import-row {
  display: grid;
  grid-template-columns: 70px minmax(160px, 1.2fr) 90px 100px 100px 80px minmax(200px, 1.4fr);
  align-items: center;
  gap: $space-2;
  padding: $space-2 $space-3;
  border-bottom: 1px solid $border-color;
  font-size: $font-caption;
}

.qw__import-head {
  background: $surface-50;
  color: $text-secondary;
  font-weight: $font-weight-semibold;
}

.qw__import-row {
  color: $text-primary;

  &:last-child { border-bottom: 0; }
}

.qw__import-row--error {
  background: $danger-50;
  color: $danger-500;
}

.qw__pdf-note {
  margin: 0 0 $space-4;
  color: $text-secondary;
  font-size: $font-body-sm;
  line-height: 1.7;
}

.qw__pdf-link {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 0 $space-4;
  border-radius: $radius-sm;
  background: $brand-600;
  color: $surface-0;
  font-weight: $font-weight-semibold;
  text-decoration: none;
}

.qw__pdf-file {
  margin: $space-3 0 0;
  color: $text-secondary;
  font-size: $font-caption;
  word-break: break-all;
}

.qw__formula-note { margin-top: $space-3; }
</style>