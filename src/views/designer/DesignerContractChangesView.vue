<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import MoneyText from '@/components/MoneyText.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StatusTag from '@/components/StatusTag.vue'
import ObjectHeroCard from '@/components/workbench/ObjectHeroCard.vue'
import DesignCatalogPicker from './components/DesignCatalogPicker.vue'
import { catalogApi } from '@/domains/catalog/api'
import type { CatalogItem } from '@/domains/catalog/model'
import { contractApi } from '@/domains/contract/api'
import type {
  Contract,
  ContractChange,
  ContractChangeItem,
  ContractChangeStatus,
  ContractChangeType,
  ContractLine
} from '@/domains/contract/model'
import type { ContractChangeSource } from '@/domains/contract/api'
import { CONTRACT_CHANGE_TYPE_LABELS } from '@/domains/contract/meta'
import { projectApi } from '@/domains/project/api'
import type { ProjectBrief } from '@/domains/project/model'
import { useSessionStore } from '@/stores/session'
import { formatDateTime, formatMoney, formatQuantity } from '@/core/format'
import { DESIGN_ITEM_TYPE_ORDER } from '@/domains/design/meta'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

/** 本页特有：符号 + 领域层中文标签（标签唯一来源 `@/domains/contract/meta`）。 */
const TYPE_SIGNS: Record<ContractChangeType, string> = {
  add: '＋',
  remove: '－',
  replace: '⇄',
  quantity: '－',
  price: '¥'
}
const TYPE_META: Record<ContractChangeType, { label: string; sign: string }> = Object.fromEntries(
  (Object.keys(CONTRACT_CHANGE_TYPE_LABELS) as ContractChangeType[])
    .map((key) => [key, { label: CONTRACT_CHANGE_TYPE_LABELS[key], sign: TYPE_SIGNS[key] }])
) as Record<ContractChangeType, { label: string; sign: string }>

type FilterKey = 'all' | ContractChangeStatus

interface SourceOption {
  key: string
  group: 'contract' | 'effective'
  sourceLineId?: string
  sourceChangeItemId?: string
  name: string
  detail: string
  unit: string
  quantity?: number
  amount?: number
}

interface DraftRow {
  key: string
  action: 'add' | 'reduce' | 'replace'
  reduceMode: 'partial' | 'full'
  sourceKey: string
  target: CatalogItem | null
  quantity?: number
  remark: string
}

const projectId = computed(() => String(route.params.projectId ?? ''))
const project = ref<ProjectBrief | null>(null)
const contract = ref<Contract | null>(null)
const changes = ref<ContractChange[]>([])
const contractLines = ref<ContractLine[]>([])
const selectedChangeId = ref('')
const activeFilter = ref<FilterKey>('all')
const loading = ref(false)
const error = ref('')
const actionError = ref('')
const saving = ref(false)

const createVisible = ref(false)
const createIntentHandled = ref(false)
const createForm = reactive({
  reason: ''
})
const draftRows = ref<DraftRow[]>([])
/** 可变更来源与当前有效剩余（服务端权威投影，DEC-055/BR-041）。 */
const rangeSources = ref<ContractChangeSource[]>([])
const rangeError = ref('')
/** 服务端试算：与提交同源；试算未通过不得提交。 */
const preview = ref<ContractChange | null>(null)
const previewLoading = ref(false)
const previewError = ref('')
let previewTimer: ReturnType<typeof setTimeout> | null = null
const catalogItems = ref<CatalogItem[]>([])
const catalogLoading = ref(false)
const catalogPickerVisible = ref(false)
const pickerRowKey = ref('')
const sourcePickerVisible = ref(false)
const sourcePickerRowKey = ref('')
const sourceKeyword = ref('')
let rowSequence = 0

const role = computed(() => session.role)
const canInitiate = computed(() => ['Designer', 'Boss', 'StoreManager', 'Pm'].includes(role.value ?? ''))
function isCreateRequested(): boolean {
  return String(route.query.create ?? '') === '1' || String(route.query.action ?? '') === 'create'
}
const canApprove = computed(() => ['Boss', 'Finance'].includes(role.value ?? ''))
const canCancel = computed(() => {
  const change = selectedChange.value
  if (!change || change.status !== 'pending') return false
  if (change.requestedBy?.empId && session.employee?.empId) return change.requestedBy.empId === session.employee.empId
  return ['Boss', 'StoreManager', 'TeamLeader'].includes(role.value ?? '')
})

const selectedChange = computed(() =>
  changes.value.find((change) => change.id === selectedChangeId.value) ?? changes.value[0] ?? null
)

const filteredChanges = computed(() =>
  changes.value.filter((change) => activeFilter.value === 'all' || change.status === activeFilter.value)
)

const pendingCount = computed(() => changes.value.filter((change) => change.status === 'pending').length)
const effectiveCount = computed(() => changes.value.filter((change) => change.status === 'customerConfirmed').length)
const totalChangeAmount = computed(() =>
  changes.value.filter((change) => change.status === 'customerConfirmed').reduce((sum, change) => sum + change.amount, 0)
)

const sourceOptions = computed<SourceOption[]>(() => {
  const result: SourceOption[] = contractLines.value.map((line) => ({
    key: `line:${line.id}`,
    group: 'contract',
    sourceLineId: line.id,
    name: line.name,
    detail: [line.spaceName, line.brand, line.spec].filter(Boolean).join(' · ') || '原合同行',
    unit: line.unit,
    quantity: line.quantity,
    amount: line.amount
  }))
  for (const change of changes.value) {
    if (change.status !== 'customerConfirmed') continue
    for (const item of change.items ?? []) {
      if (!item.targetCatalogItemId || !item.targetQuantity) continue
      result.push({
        key: `change:${item.id}`,
        group: 'effective',
        sourceChangeItemId: item.id,
        name: item.targetName || item.name || '已生效变更目标',
        detail: [change.no, item.targetBrand, item.targetSpec].filter(Boolean).join(' · '),
        unit: item.targetUnit || '',
        quantity: item.targetQuantity,
        amount: item.targetAmount
      })
    }
  }
  return result
})

const filteredSourceOptions = computed(() => {
  const query = sourceKeyword.value.trim().toLowerCase()
  if (!query) return sourceOptions.value
  return sourceOptions.value.filter((option) =>
    [option.name, option.detail, option.unit].some((value) => String(value ?? '').toLowerCase().includes(query))
  )
})

const sourcePickerAreas = computed(() => [
  { key: 'contract' as const, label: '原合同行' },
  { key: 'effective' as const, label: '已生效变更目标' }
])

const pickerAreas = computed(() => [{
  id: '',
  name: '全部报价项目',
  count: catalogItems.value.length,
  amount: 0,
  categories: []
}])

const selectedChangeItems = computed<ContractChangeItem[]>(() => selectedChange.value?.items ?? [])

const selectedProofImages = computed<string[]>(() =>
  [selectedChange.value?.signatureUrl, ...(selectedChange.value?.evidenceImages ?? [])].filter((item): item is string => Boolean(item))
)

// DEC-068：提交门禁只校验系统能校验的事（原因、明细），不再要求客户线下确认信息与签认证据。
// DEC-055/BR-041：金额与当前有效剩余由服务端计算；试算未通过不得提交（与前端口径无关）。
const createReady = computed(() => {
  if (!createForm.reason.trim()) return false
  if (!draftRows.value.length) return false
  if (!draftRows.value.every((row) => rowReady(row))) return false
  if (previewLoading.value || previewError.value || !preview.value) return false
  return Math.abs(Number(contract.value?.currentAmount ?? 0) + Number(preview.value?.amount ?? 0)) >= 0
})

/** 合计：来自服务端试算（不做前端正式计算）。 */
const previewTotals = computed(() => {
  const items = preview.value?.items ?? []
  let increase = 0
  let decrease = 0
  items.forEach((item) => {
    const delta = Number(item.amountDelta ?? 0)
    if (delta > 0) increase += delta
    else decrease += delta
  })
  const net = Number(preview.value?.amount ?? 0)
  const before = Number(contract.value?.currentAmount ?? 0)
  const costIncomplete = items.some((item) => item.costDelta === undefined || item.costDelta === null)
  return { increase, decrease, net, before, after: before + net, costIncomplete, count: draftRows.value.length }
})

/** 可变更来源快照：按行取服务端投影（找不到时前端不臆造，交由服务端校验）。 */
function rangeOf(row: DraftRow): ContractChangeSource | undefined {
  if (!row.sourceKey) return undefined
  return rangeSources.value.find((item) =>
    row.sourceKey.startsWith('line:')
      ? item.sourceLineId === row.sourceKey.slice(5)
      : item.sourceChangeItemId === row.sourceKey.slice(7)
  )
}

function sourceRangeText(row: DraftRow): string {
  const snapshot = rangeOf(row)
  if (!snapshot) {
    return row.sourceKey ? '当前有效剩余以服务端为准' : '服务端提交时复核当前有效剩余与待审批占用'
  }
  const unit = snapshot.unit || ''
  const parts = [`当前有效剩余 ${formatQuantity(snapshot.effectiveRemainingQuantity)}${unit}`]
  if (snapshot.pendingReservedQuantity) parts.push(`待审批占用 ${formatQuantity(snapshot.pendingReservedQuantity)}${unit}`)
  parts.push(`可变更 ${formatQuantity(snapshot.availableQuantity)}${unit}`)
  return parts.join(' · ')
}

function sourceUnitOf(row: DraftRow): string {
  return rangeOf(row)?.unit || sourceOptions.value.find((option) => option.key === row.sourceKey)?.unit || '单位'
}

function rowBlockReason(row: DraftRow): string {
  const snapshot = rangeOf(row)
  if (snapshot?.confirmable === false) return snapshot.blockReason || '该来源当前有效剩余暂不可确认'
  if (row.action === 'reduce' && row.reduceMode === 'partial' && snapshot?.availableQuantity !== undefined) {
    if (Number(row.quantity ?? 0) > snapshot.availableQuantity) {
      return `超过可变更量 ${formatQuantity(snapshot.availableQuantity)}${snapshot.unit || ''}`
    }
  }
  return ''
}

/** 本条差额：服务端试算按行回填；未试算不做前端估算。 */
function rowDeltaText(index: number): string {
  const item = preview.value?.items?.[index]
  if (!item || item.amountDelta === undefined || item.amountDelta === null) return '待试算'
  const value = Number(item.amountDelta)
  return `${value > 0 ? '+' : ''}${formatMoney(value)}`
}

watch(projectId, async (id) => {
  if (!id) return
  await loadProject(id)
  if (isCreateRequested()) openCreate()
}, { immediate: true })

watch([() => route.query.create, () => route.query.action], () => {
  if (isCreateRequested() && project.value && contract.value) openCreate()
})

watch(selectedChangeId, (id) => {
  const query = { ...route.query }
  if (id) query.changeId = id
  else delete query.changeId
  void router.replace({ query })
})

watch(createVisible, (visible) => {
  if (visible || !isCreateRequested()) return
  const query = { ...route.query }
  delete query.create
  delete query.action
  void router.replace({ query })
})

// 明细任何变化都让上一次试算失效并重算：提交前拿到的必须是当前草稿的服务端结果。
watch(draftRows, () => { invalidatePreview() }, { deep: true })

async function loadProject(id: string): Promise<void> {
  if (!id) {
    project.value = null
    contract.value = null
    changes.value = []
    contractLines.value = []
    selectedChangeId.value = ''
    return
  }
  loading.value = true
  error.value = ''
  actionError.value = ''
  try {
    const [projectResult, contractResult] = await Promise.all([
      projectApi.projectInfo(id),
      contractApi.contractByProject(id)
    ])
    project.value = projectResult
    contract.value = contractResult
    if (contractResult) {
      const [changeResult, lineResult] = await Promise.all([
        contractApi.listContractChanges(id),
        contractApi.listContractLines(contractResult.id)
      ])
      changes.value = changeResult
      contractLines.value = lineResult
    } else {
      changes.value = []
      contractLines.value = []
    }
    if (!changes.value.some((change) => change.id === selectedChangeId.value)) {
      const routeChangeId = String(route.query.changeId ?? '')
      selectedChangeId.value = changes.value.find((change) => change.id === routeChangeId)?.id
        ?? changes.value[0]?.id
        ?? ''
    }
    consumeCreateIntent()
  } catch (err) {
    project.value = null
    contract.value = null
    changes.value = []
    contractLines.value = []
    error.value = err instanceof Error ? err.message : '增减项工作台暂不可确认'
  } finally {
    loading.value = false
  }
}

function consumeCreateIntent(): void {
  if (createIntentHandled.value || route.query.action !== 'create') return
  createIntentHandled.value = true
  const query = { ...route.query }
  delete query.action
  void router.replace({ query })
  openCreate()
}

function openCreate(): void {
  if (!contract.value || !project.value || !canInitiate.value) return
  createForm.reason = ''
  draftRows.value = [newRow('add')]
  actionError.value = ''
  invalidatePreview()
  createVisible.value = true
  void loadCatalog()
  void loadRange()
}

/** 可变更来源与当前有效剩余：只读拉取，失败不阻断录入（提交时服务端仍会复核）。 */
async function loadRange(): Promise<void> {
  if (!contract.value) return
  rangeError.value = ''
  try {
    const range = await contractApi.contractChangeRange({ contractId: contract.value.id })
    rangeSources.value = range.sources ?? []
  } catch (err) {
    rangeSources.value = []
    rangeError.value = err instanceof Error ? err.message : '当前有效剩余暂不可确认'
  }
}

function invalidatePreview(): void {
  preview.value = null
  previewError.value = ''
  schedulePreview()
}

function schedulePreview(): void {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(() => { void refreshPreview() }, 400)
}

/** 服务端试算：与 batch-save 同源（目标快照 / 当前有效剩余 / 差额），不落库。 */
async function refreshPreview(): Promise<void> {
  if (previewLoading.value) return
  if (!contract.value || !draftRows.value.length || !draftRows.value.every((row) => rowReady(row))) {
    preview.value = null
    previewError.value = ''
    return
  }
  previewLoading.value = true
  previewError.value = ''
  try {
    preview.value = await contractApi.previewContractChange({
      contractId: contract.value.id,
      type: rowActionType(draftRows.value[0]),
      items: draftRows.value.map((row) => {
        const source = sourceOptions.value.find((option) => option.key === row.sourceKey)
        const quantity = Number(row.quantity ?? 0)
        return {
          changeType: rowActionType(row),
          sourceLineId: source?.sourceLineId,
          sourceChangeItemId: source?.sourceChangeItemId,
          targetCatalogItemId: row.target?.id,
          targetQuantity: row.action === 'reduce' ? undefined : quantity || undefined,
          reduceQuantity: row.action === 'reduce' && row.reduceMode === 'partial' ? quantity : undefined
        }
      })
    })
  } catch (err) {
    preview.value = null
    previewError.value = err instanceof Error ? err.message : '暂不可确认，请检查变更明细'
  } finally {
    previewLoading.value = false
  }
}

function newRow(action: DraftRow['action']): DraftRow {
  rowSequence += 1
  return {
    key: `change-row-${Date.now()}-${rowSequence}`,
    action,
    reduceMode: 'partial',
    sourceKey: '',
    target: null,
    quantity: undefined,
    remark: ''
  }
}

function addDraftRow(action: DraftRow['action']): void {
  draftRows.value.push(newRow(action))
  invalidatePreview()
}

function removeDraftRow(key: string): void {
  draftRows.value = draftRows.value.filter((row) => row.key !== key)
  invalidatePreview()
}

function openTargetPicker(row: DraftRow): void {
  if (row.action === 'reduce') return
  pickerRowKey.value = row.key
  catalogPickerVisible.value = true
}

function openSourcePicker(row: DraftRow): void {
  sourcePickerRowKey.value = row.key
  sourceKeyword.value = ''
  sourcePickerVisible.value = true
}

function chooseSource(option: SourceOption): void {
  const row = draftRows.value.find((item) => item.key === sourcePickerRowKey.value)
  if (!row) return
  row.sourceKey = option.key
  sourcePickerVisible.value = false
}

function sourceQuantityLabel(option: SourceOption): string {
  const snapshot = rangeSources.value.find((item) =>
    option.sourceLineId ? item.sourceLineId === option.sourceLineId : item.sourceChangeItemId === option.sourceChangeItemId
  )
  if (snapshot) {
    const unit = snapshot.unit || ''
    const parts = [`当前有效剩余 ${formatQuantity(snapshot.effectiveRemainingQuantity)}${unit}`]
    if (snapshot.pendingReservedQuantity) parts.push(`待审批占用 ${formatQuantity(snapshot.pendingReservedQuantity)}${unit}`)
    parts.push(`可变更 ${formatQuantity(snapshot.availableQuantity)}${unit}`)
    return parts.join(' · ')
  }
  if (option.quantity === undefined) return '当前有效剩余以服务端为准'
  return `初始/快照量 ${formatQuantity(option.quantity)}${option.unit || ''}`
}

function onPickerAdd(payload: { spaceId: string; items: Array<{ catalogItemId: string; quantity: number }> }): void {
  const row = draftRows.value.find((item) => item.key === pickerRowKey.value)
  if (!row) return
  const chosen = payload.items
    .map((entry) => ({
      quantity: Number(entry.quantity ?? 1),
      target: catalogItems.value.find((item) => item.id === entry.catalogItemId)
    }))
    .filter((pair): pair is { quantity: number; target: CatalogItem } => Boolean(pair.target))
  if (!chosen.length) return
  if (row.action === 'replace') {
    row.target = chosen[0].target
    row.quantity = chosen[0].quantity
    catalogPickerVisible.value = false
    return
  }
  // 新增分项：第一个目标填入当前行，其余目标追加为新行。
  // 若像早期实现那样一律追加新行，被点开的行会一直空着，createReady 因该行未就绪而永远为 false，
  // 设计师看到「提交审批」始终禁用（现场即「一直保存不了增减项」）。
  const [first, ...rest] = chosen
  row.target = first.target
  row.quantity = first.quantity
  for (const pair of rest) {
    const draft = newRow('add')
    draft.target = pair.target
    draft.quantity = pair.quantity
    draftRows.value.push(draft)
  }
}

async function loadCatalog(): Promise<void> {
  if (catalogItems.value.length || catalogLoading.value) return
  catalogLoading.value = true
  try {
    const result: CatalogItem[] = []
    for (const type of DESIGN_ITEM_TYPE_ORDER) {
      let current = 1
      while (current <= 30) {
        const page = await catalogApi.pageCatalog({ type, current, size: 100 })
        result.push(...page)
        if (page.length < 100) break
        current += 1
      }
    }
    catalogItems.value = result
  } catch {
    catalogItems.value = []
  } finally {
    catalogLoading.value = false
  }
}

function sourceSelectionLabel(key: string): string {
  const option = sourceOptions.value.find((item) => item.key === key)
  if (!option) return '选择来源分项'
  return `${option.name} · ${sourceQuantityLabel(option)}`
}

function rowReady(row: DraftRow): boolean {
  const quantity = Number(row.quantity ?? 0)
  if (row.action === 'add') return !!row.target && Number.isFinite(quantity) && quantity > 0
  if (row.action === 'reduce') {
    if (!row.sourceKey) return false
    return row.reduceMode === 'full' || (Number.isFinite(quantity) && quantity > 0)
  }
  return !!row.sourceKey && !!row.target && Number.isFinite(quantity) && quantity > 0
}

function rowActionType(row: DraftRow): ContractChangeType {
  if (row.action === 'add') return 'add'
  if (row.action === 'replace') return 'replace'
  return row.reduceMode === 'full' ? 'remove' : 'quantity'
}

function itemTitle(item: ContractChangeItem): string {
  return item.targetName || item.name || '变更分项'
}

function itemDetail(item: ContractChangeItem): string {
  if (item.changeType === 'add') return `新增目标 · ${[item.targetBrand, item.targetSpec].filter(Boolean).join(' / ') || '目标快照已冻结'}`
  if (item.changeType === 'remove') return `整项取消 · ${item.oldQuantity ?? 0}${item.targetUnit || ''}`
  if (item.changeType === 'replace') return `替换目标 · ${[item.targetBrand, item.targetSpec].filter(Boolean).join(' / ') || '目标快照已冻结'}`
  return `部分减少 · 减少 ${item.reduceQuantity ?? Math.max(0, (item.oldQuantity || 0) - (item.newQuantity || 0))}`
}

async function submitChange(): Promise<void> {
  if (!project.value || !contract.value) return
  if (!draftRows.value.length || !draftRows.value.every((row) => rowReady(row))) {
    actionError.value = '请补全每条明细的来源、目标与工程量'
    return
  }
  if (previewLoading.value) { actionError.value = '服务端试算中，请稍候'; return }
  if (previewError.value || !preview.value) {
    actionError.value = previewError.value || '请先完成服务端试算'
    return
  }
  if (!createForm.reason.trim()) { actionError.value = '请填写变更原因'; return }
  if (Number(contract.value.currentAmount ?? 0) + Number(preview.value.amount ?? 0) < 0) {
    actionError.value = '变更后合同金额不能小于 0'
    return
  }
  saving.value = true
  actionError.value = ''
  try {
    const items = draftRows.value.map((row) => {
      const source = sourceOptions.value.find((option) => option.key === row.sourceKey)
      const quantity = Number(row.quantity ?? 0)
      return {
        name: row.target?.name || source?.name || '合同变更',
        itemType: row.target?.type,
        changeType: rowActionType(row),
        sourceLineId: source?.sourceLineId,
        sourceChangeItemId: source?.sourceChangeItemId,
        targetCatalogItemId: row.target?.id,
        targetQuantity: row.action === 'reduce' ? undefined : quantity || undefined,
        reduceQuantity: row.action === 'reduce' && row.reduceMode === 'partial' ? quantity : undefined,
        remark: row.remark || undefined
      }
    })
    const created = await contractApi.batchSaveContractChange({
      contractId: contract.value.id,
      reason: createForm.reason.trim(),
      type: items[0]?.changeType,
      items
    })
    createVisible.value = false
    selectedChangeId.value = created.id
    await loadProject(project.value.id)
    ElMessage.success('增减项已形成，等待 BOSS / 财务审批')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '增减项发起失败，请检查来源与目标分项'
  } finally {
    saving.value = false
  }
}

async function approveSelected(approved: boolean): Promise<void> {
  const change = selectedChange.value
  if (!change || !canApprove.value) return
  const result = await ElMessageBox.prompt(
    approved ? '审批通过后，合同、应收、任务、材料和成本将在同一事务内联动。' : '请填写驳回原因，设计师会看到该结论。',
    approved ? '确认审批通过' : '确认驳回变更单',
    {
      confirmButtonText: approved ? '确认通过' : '确认驳回',
      cancelButtonText: '取消',
      inputType: 'textarea',
      inputPlaceholder: approved ? '可填写审批说明' : '请填写驳回原因',
      inputValidator: (value) => approved || Boolean(value?.trim()) || '请填写驳回原因'
    }
  ).catch(() => null)
  if (!result) return
  saving.value = true
  try {
    await contractApi.approveContractChange(change.id, approved, result.value)
    await loadProject(project.value!.id)
    ElMessage.success(approved ? '变更单已审批通过并生效' : '变更单已驳回')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '审批操作失败'
  } finally {
    saving.value = false
  }
}

async function cancelSelected(): Promise<void> {
  const change = selectedChange.value
  if (!change || !canCancel.value) return
  const confirmed = await ElMessageBox.confirm('撤回后变更单变为已取消，不产生金额、应收、任务或材料副作用。', '确认撤回', {
    confirmButtonText: '确认撤回',
    cancelButtonText: '取消'
  }).catch(() => false)
  if (!confirmed) return
  saving.value = true
  try {
    await contractApi.cancelContractChange(change.id)
    await loadProject(project.value!.id)
    ElMessage.success('变更单已撤回')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '撤回失败'
  } finally {
    saving.value = false
  }
}

function formatLocalDateTime(value?: string): string {
  return value ? formatDateTime(value.replace(' ', 'T')) : '暂不可确认'
}
</script>

<template>
  <div class="chg">
    <header class="chg__head">
      <div>
        <el-button link @click="router.push(`/workbench/contract-changes?projectId=${projectId}`)">← 返回增减项</el-button>
        <p class="chg__eyebrow">项目交付 · 增减项详情</p>
        <h2>{{ project?.name || '增减项工作区' }}</h2>
        <p>查看已形成的变更单、客户线下确认事实和审批进度；新增增减项请回到项目工地对应项目发起。</p>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <el-alert v-if="actionError" type="warning" :closable="false" :title="actionError" show-icon />

    <section v-if="!project" class="chg__state">
      <EmptyState
        title="请从项目工地进入增减项"
        description="增减项详情必须绑定项目和合同。请先在项目工地选择项目，再查看或发起变更单。"
      />
      <div class="chg__start-steps">
        <span><b>01</b> 选择项目</span>
        <i>→</i>
        <span><b>02</b> 逐条加入变更明细（新增分项 / 减项 / 替换）</span>
        <i>→</i>
        <span><b>03</b> 服务端试算通过后提交审批</span>
        <i>→</i>
        <span><b>04</b> 审批通过即生效并同频业主端</span>
      </div>
    </section>

    <template v-else-if="!createVisible">
      <ObjectHeroCard>
        <template #avatar>变</template>
        <template #title>
          <h2>{{ project.name }}</h2>
          <BusinessStateTag object-key="project" :status-key="project.status" />
        </template>
        <template #subtitle>
          {{ project.propertyName || project.community || '房屋待补充' }} · {{ project.no || '项目编号待确认' }}
        </template>
        <template #chips>
          <StatusTag :text="`待审批 ${pendingCount}`" :tone="pendingCount ? 'pending' : 'todo'" :dot="false" />
          <StatusTag :text="`已生效 ${effectiveCount}`" :tone="effectiveCount ? 'done' : 'todo'" :dot="false" />
          <StatusTag v-if="contract" :text="`合同当前额 ¥${formatMoney(contract.currentAmount)}`" tone="info" :dot="false" />
        </template>
        <template #focus>
          <div class="chg-focus">
            <span>项目合同当前额</span>
            <strong><MoneyText :value="contract?.currentAmount" /></strong>
            <small>已生效变更合计 <MoneyText :value="totalChangeAmount" delta /></small>
          </div>
          <div class="chg-focus">
            <span>当前需要处理</span>
            <strong>{{ selectedChange?.reason || (pendingCount ? '等待审批的变更单' : '暂无待处理变更') }}</strong>
            <small>{{ selectedChange?.no || '选择左侧变更单查看详情' }}</small>
          </div>
        </template>
        <template #facts>
          <div><small>待审批</small><b>{{ pendingCount }}</b></div>
          <div><small>已生效</small><b>{{ effectiveCount }}</b></div>
          <div><small>合同状态</small><b>{{ contract?.status || '暂不可确认' }}</b></div>
          <div><small>可变更来源</small><b>{{ sourceOptions.length }}</b></div>
        </template>
        <template #actions>
          <div class="chg__primary">
            <small>{{ contract ? '新增增减项入口在项目工地；本页用于查看已有变更单和审批结果。' : '项目尚未找到可变更合同，请联系合同负责人。' }}</small>
          </div>
        </template>
      </ObjectHeroCard>

      <div class="chg__layout">
        <aside class="chg__queue">
          <div class="chg__queue-head">
            <div><strong>本项目增减项</strong><span>{{ filteredChanges.length }} / {{ changes.length }}</span></div>
            <el-button text @click="loadProject(projectId)">刷新</el-button>
          </div>
          <div class="chg__filters">
            <button type="button" :class="{ active: activeFilter === 'all' }" @click="activeFilter = 'all'">全部</button>
            <button type="button" :class="{ active: activeFilter === 'pending' }" @click="activeFilter = 'pending'">待审批</button>
            <button type="button" :class="{ active: activeFilter === 'customerConfirmed' }" @click="activeFilter = 'customerConfirmed'">已生效</button>
            <button type="button" :class="{ active: activeFilter === 'rejected' }" @click="activeFilter = 'rejected'">已驳回</button>
            <button type="button" :class="{ active: activeFilter === 'cancelled' }" @click="activeFilter = 'cancelled'">已取消</button>
          </div>
          <div class="chg__queue-list">
            <SkeletonBlock v-if="loading && !changes.length" variant="card" :rows="5" />
            <EmptyState v-else-if="!filteredChanges.length" title="当前没有增减项" description="客户线下确认后，在这里形成第一张变更单。" />
            <button
              v-for="change in filteredChanges"
              v-else
              :key="change.id"
              type="button"
              class="chg-item"
              :class="{ 'chg-item--active': change.id === selectedChange?.id }"
              @click="selectedChangeId = change.id"
            >
              <span class="chg-item__top">
                <BusinessStateTag object-key="contractChange" :status-key="change.status" :dot="false" />
                <em>{{ change.no || '变更单号待确认' }}</em>
              </span>
              <strong>{{ change.reason || '变更原因待补充' }}</strong>
              <span class="chg-item__meta">{{ TYPE_META[change.type]?.label || '变更' }} · {{ change.requestedByName || '发起人待确认' }}</span>
              <span class="chg-item__amount"><MoneyText :value="change.amount" delta /></span>
              <small>{{ formatLocalDateTime(change.createdAt) }}</small>
            </button>
          </div>
        </aside>

        <main class="chg__main">
          <template v-if="selectedChange">
            <section class="chg__detail-head">
              <div>
                <span class="chg__object-label">CHANGE DOCUMENT</span>
                <h3>{{ selectedChange.no || '变更单' }}</h3>
                <p>{{ TYPE_META[selectedChange.type]?.label || '合同变更' }} · {{ selectedChange.reason || '原因待补充' }}</p>
              </div>
              <div class="chg__detail-status">
                <BusinessStateTag object-key="contractChange" :status-key="selectedChange.status" />
                <MoneyText :value="selectedChange.amount" delta size="lg" />
              </div>
            </section>

            <section class="chg__facts">
              <div><span>发起人</span><b>{{ selectedChange.requestedByName || '暂不可确认' }}</b></div>
              <div><span>审批人</span><b>{{ selectedChange.approvedByName || '待审批' }}</b></div>
              <div><span>审批结论</span><b>{{ selectedChange.conclusion || '暂无结论' }}</b></div>
              <div><span>发起时间</span><b>{{ formatLocalDateTime(selectedChange.createdAt) }}</b></div>
              <div><span>审批时间</span><b>{{ formatLocalDateTime(selectedChange.approvedAt) }}</b></div>
              <div><span>生效时间</span><b>{{ selectedChange.status === 'customerConfirmed' ? formatLocalDateTime(selectedChange.approvedAt) : '审批通过后生效' }}</b></div>
            </section>

            <section class="chg__items">
              <header><div><h4>变更明细</h4><p>原报价与原合同行不变，本单只承载增量、减量和替换结果。</p></div><span>{{ selectedChangeItems.length }} 条</span></header>
              <EmptyState v-if="!selectedChangeItems.length" title="明细暂不可确认" description="历史数据可能只保留汇总金额，请以服务端和合同档案为准。" />
              <article v-for="item in selectedChangeItems" :key="item.id" class="chg-item-line">
                <div>
                  <span>{{ TYPE_META[item.changeType]?.label || '变更' }}</span>
                  <strong>{{ itemTitle(item) }}</strong>
                  <small>{{ itemDetail(item) }}</small>
                </div>
                <div class="chg-item-line__money">
                  <MoneyText :value="item.amountDelta" delta />
                  <small v-if="item.targetQuantity !== undefined">目标量 {{ formatQuantity(item.targetQuantity) }}{{ item.targetUnit || '' }}</small>
                </div>
              </article>
            </section>

            <section v-if="selectedChange.evidenceImages?.length || selectedChange.signatureUrl" class="chg__proof">
              <header><h4>现场证据（历史单据留存）</h4><span>历史数据只读保留；新单据不再要求上传签认证据</span></header>
              <div class="chg__proof-grid">
                <el-image
                  v-if="selectedChange.signatureUrl"
                  :src="selectedChange.signatureUrl"
                  :preview-src-list="[selectedChange.signatureUrl, ...(selectedChange.evidenceImages || [])]"
                  fit="cover"
                  class="chg__proof-image"
                />
                <el-image
                  v-for="(image, index) in selectedChange.evidenceImages || []"
                  :key="image"
                  :src="image"
                  :preview-src-list="selectedProofImages"
                  :initial-index="index + (selectedChange.signatureUrl ? 1 : 0)"
                  fit="cover"
                  class="chg__proof-image"
                />
              </div>
            </section>

            <section class="chg__timeline">
              <h4>办理进度</h4>
              <div class="chg__timeline-row">
                <span class="chg__timeline-node" :class="{ 'is-done': true }">01</span>
                <div><strong>形成变更单（系统留痕）</strong><p>{{ selectedChange.requestedByName || '发起人' }} 发起 · {{ formatLocalDateTime(selectedChange.createdAt) }}</p></div>
              </div>
              <div class="chg__timeline-row">
                <span class="chg__timeline-node" :class="{ 'is-done': selectedChange.status !== 'pending' && selectedChange.status !== 'cancelled' }">02</span>
                <div><strong>企业内部审批</strong><p>{{ selectedChange.status === 'pending' ? '等待 BOSS / 财务审批' : selectedChange.conclusion || '审批已处理' }}</p></div>
              </div>
              <div class="chg__timeline-row">
                <span class="chg__timeline-node" :class="{ 'is-done': selectedChange.status === 'customerConfirmed' }">03</span>
                <div><strong>合同与履约联动</strong><p>{{ selectedChange.status === 'customerConfirmed' ? '已生效，合同 / 应收 / 任务 / 材料 / 成本已联动' : '审批通过后触发' }}</p></div>
              </div>
            </section>
          </template>
          <EmptyState v-else title="选择一张变更单" description="左侧队列展示本项目的待审批、已生效和历史变更单。" />
        </main>

        <aside class="chg__guide">
          <section>
            <h3>当前下一步</h3>
            <p v-if="selectedChange?.status === 'pending' && canApprove">审批通过后合同金额和履约对象会在同一事务内更新。</p>
            <p v-else-if="selectedChange?.status === 'pending'">变更单已提交，等待 BOSS / 财务审批。</p>
            <p v-else-if="selectedChange?.status === 'customerConfirmed'">变更已生效，客户可在小程序只读查看。</p>
            <p v-else>选择变更单查看当前处理状态。</p>
          </section>
          <section>
            <h3>可执行动作</h3>
            <div class="chg__guide-actions">
              <el-button v-if="selectedChange?.status === 'pending' && canCancel" plain :loading="saving" @click="cancelSelected">撤回变更单</el-button>
              <template v-if="selectedChange?.status === 'pending' && canApprove">
                <el-button type="primary" :loading="saving" @click="approveSelected(true)">审批通过</el-button>
                <el-button type="danger" plain :loading="saving" @click="approveSelected(false)">驳回</el-button>
              </template>
            </div>
          </section>
          <section>
            <h3>业务边界</h3>
            <ul>
              <li>客户线下确认是创建前置事实，不是审批后补签认。</li>
              <li>新增和替换目标来自启用报价项目库；新入口不提供调价。</li>
              <li>减项不得超过当前有效剩余，待审批占用会在服务端复核。</li>
              <li>原报价与原合同行永久不改；审批通过后才触发履约联动。</li>
              <li>成本、成本变化和利润不对设计师显示。</li>
            </ul>
          </section>
          <section>
            <h3>项目上下文</h3>
            <dl>
              <div><dt>合同</dt><dd>{{ contract?.no || '暂不可确认' }}</dd></div>
              <div><dt>合同当前额</dt><dd><MoneyText :value="contract?.currentAmount" /></dd></div>
              <div><dt>已生效变更</dt><dd>{{ effectiveCount }} 条</dd></div>
              <div><dt>可变更来源</dt><dd>{{ sourceOptions.length }} 项</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </template>

    <section v-else class="chg-doc">
      <header class="chg-doc__head">
        <div>
          <el-button link @click="createVisible = false">← 返回增减项</el-button>
          <h2>发起增减项 · 合同变更单</h2>
          <p>单据即表单：明细以表格逐条加入，金额与当前有效剩余由服务端计算；提交后即时同频业主端只读可见。</p>
        </div>
        <StatusTag text="待提交 · 草稿" tone="pending" :dot="false" />
      </header>

      <div class="chg-doc__grid">
        <div class="chg-doc__paper">
          <header class="chg-doc__meta">
            <h3>{{ project?.name || '项目待确认' }} · {{ contract?.no || '合同待确认' }}</h3>
            <div class="chg-doc__facts">
              <span>合同当前额 <b><MoneyText :value="contract?.currentAmount" /></b></span>
              <span>发起人 <b>{{ session.displayName }}</b></span>
              <span>可变更来源 <b>{{ rangeSources.length }} 项</b></span>
            </div>
          </header>

          <section class="chg-doc__section">
            <div class="chg-doc__section-head">
              <div>
                <h4>变更原因</h4>
                <p>一句话说清业主诉求与业务背景，审批人先看这里。</p>
              </div>
            </div>
            <el-input
              v-model="createForm.reason"
              type="textarea"
              :rows="2"
              maxlength="500"
              show-word-limit
              placeholder="例如：业主现场确认将原卫生间墙砖替换为同品牌暖白规格，并增加阳台晾晒区。"
            />
          </section>

          <section class="chg-doc__section">
            <div class="chg-doc__section-head">
              <div>
                <h4>变更明细 <span class="chg-doc__count">{{ draftRows.length }} 条</span></h4>
                <p>逐条加入新增分项 / 减项 / 替换；同一张单承载全部明细，冻结目标快照。</p>
              </div>
              <div class="chg-doc__actions">
                <el-button size="small" @click="addDraftRow('add')">＋ 新增分项</el-button>
                <el-button size="small" @click="addDraftRow('reduce')">－ 减项</el-button>
                <el-button size="small" @click="addDraftRow('replace')">⇄ 替换</el-button>
              </div>
            </div>

            <el-alert v-if="rangeError" type="warning" :closable="false" :title="rangeError" show-icon />

            <div class="chg-table__wrap">
              <table class="chg-table">
                <thead>
                  <tr>
                    <th class="chg-table__idx">#</th>
                    <th class="chg-table__action">动作</th>
                    <th>来源分项 / 当前有效剩余</th>
                    <th>目标分项（报价项目库）</th>
                    <th class="chg-table__qty">工程量</th>
                    <th class="chg-table__delta">本条差额</th>
                    <th class="chg-table__op"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, index) in draftRows" :key="row.key" :class="{ 'is-invalid': !rowReady(row) }">
                    <td class="chg-table__idx">{{ index + 1 }}</td>
                    <td>
                      <el-select
                        v-model="row.action"
                        size="small"
                        @change="row.sourceKey = row.action === 'add' ? '' : row.sourceKey; invalidatePreview()"
                      >
                        <el-option label="新增分项" value="add" />
                        <el-option label="减项" value="reduce" />
                        <el-option label="替换" value="replace" />
                      </el-select>
                      <el-radio-group
                        v-if="row.action === 'reduce'"
                        v-model="row.reduceMode"
                        size="small"
                        class="chg-table__mode"
                        @change="invalidatePreview()"
                      >
                        <el-radio-button label="partial">部分减少</el-radio-button>
                        <el-radio-button label="full">整项取消</el-radio-button>
                      </el-radio-group>
                    </td>

                    <td>
                      <div v-if="row.action === 'add'" class="chg-table__muted">— 新增分项无来源 —</div>
                      <button v-else type="button" class="chg-table__pick" @click="openSourcePicker(row)">
                        <template v-if="row.sourceKey">
                          <strong>{{ sourceSelectionLabel(row.sourceKey) }}</strong>
                          <small class="chg-table__stat">{{ sourceRangeText(row) }}</small>
                        </template>
                        <template v-else>
                          <strong>选择原合同行或已生效变更目标</strong>
                          <small>服务端提交时复核当前有效剩余与待审批占用</small>
                        </template>
                      </button>
                      <small v-if="rowBlockReason(row)" class="chg-table__block">{{ rowBlockReason(row) }}</small>
                    </td>

                    <td>
                      <div v-if="row.action === 'reduce'" class="chg-table__muted">— 减项无目标 —</div>
                      <button v-else type="button" class="chg-table__pick" @click="openTargetPicker(row)">
                        <template v-if="row.target">
                          <strong>{{ row.target.name }}</strong>
                          <small>{{ [row.target.brand, row.target.spec, row.target.unit].filter(Boolean).join(' · ') }}</small>
                        </template>
                        <template v-else>
                          <strong>从报价项目库选择目标分项</strong>
                          <small>只可选当前企业启用项目，提交时冻结目标快照</small>
                        </template>
                      </button>
                    </td>

                    <td>
                      <div v-if="row.action === 'reduce' && row.reduceMode === 'full'" class="chg-table__muted">
                        整项取消
                      </div>
                      <el-input
                        v-else
                        v-model="row.quantity"
                        size="small"
                        placeholder="0"
                        @input="invalidatePreview()"
                      >
                        <template #append>{{ row.action === 'reduce' ? sourceUnitOf(row) : (row.target?.unit || '单位') }}</template>
                      </el-input>
                    </td>

                    <td class="chg-table__delta">{{ rowDeltaText(index) }}</td>

                    <td class="chg-table__op">
                      <el-button text type="danger" :disabled="draftRows.length === 1" @click="removeDraftRow(row.key)">删除</el-button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="chg-doc__total">
              <div><small>增项合计</small><b class="is-up">+{{ formatMoney(previewTotals.increase) }}</b></div>
              <div><small>减项合计</small><b class="is-down">{{ formatMoney(previewTotals.decrease) }}</b></div>
              <div><small>明细条数</small><b>{{ previewTotals.count }} 条</b></div>
              <div class="chg-doc__total-hero">
                <small>本次变更 · 变更后合同额 {{ formatMoney(previewTotals.after) }}</small>
                <b>{{ preview ? `${previewTotals.net > 0 ? '+' : ''}${formatMoney(previewTotals.net)}` : '待试算' }}</b>
              </div>
            </div>
            <p v-if="previewTotals.costIncomplete" class="chg-doc__hint">成本未完整：该单利润与毛利率暂不可确认（不以 0 伪造）。</p>
          </section>

          <section class="chg-doc__section">
            <div class="chg-doc__section-head">
              <div>
                <h4>本单留痕与同频</h4>
                <p>系统只承载内部留痕与对外同频，不托管无法校验的线下「业主确认」事实。</p>
              </div>
            </div>
            <div class="chg-doc__trace">
              <div><small>发起人（系统留痕）</small><b>{{ session.displayName }}</b></div>
              <div><small>发起时间（系统留痕）</small><b>提交时自动记录</b></div>
              <div><small>代录留痕</small><b>内部记录人 ≠ 业主，分开记</b></div>
              <div><small>业主端</small><b class="is-ok">提交即同频 · 只读可见</b></div>
            </div>
          </section>
        </div>

        <aside class="chg-doc__rail">
          <h4>提交前检查</h4>
          <p class="chg-doc__rail-sub">只校验系统能校验的事：原因、明细、金额边界。</p>
          <div class="chg-doc__checks">
            <span :class="{ 'is-ready': createForm.reason.trim() }">{{ createForm.reason.trim() ? '✓' : '○' }} 变更原因</span>
            <span :class="{ 'is-ready': draftRows.length && draftRows.every(rowReady) }">{{ draftRows.length && draftRows.every(rowReady) ? '✓' : '○' }} 变更明细（{{ previewTotals.count }} 条）</span>
            <span :class="{ 'is-ready': !!preview && !previewError }">{{ preview && !previewError ? '✓' : '○' }} 服务端试算{{ previewLoading ? '（进行中…）' : '' }}</span>
            <span :class="{ 'is-ready': !!preview && previewTotals.after >= 0 }">{{ preview && previewTotals.after >= 0 ? '✓' : '○' }} 变更后合同额不为负（{{ preview ? formatMoney(previewTotals.after) : '待试算' }}）</span>
          </div>
          <div v-if="previewError" class="chg-doc__error">{{ previewError }}</div>
          <div v-if="actionError" class="chg-doc__error">{{ actionError }}</div>
          <p class="chg-doc__rail-hint">
            左侧表格逐条展示来源、目标、工程量与<b>本条差额</b>（服务端试算口径）；提交后进入待审批，
            BOSS / 财务审批通过即生效，并联动合同额、应收、任务、材料与成本。
          </p>
          <el-button type="primary" class="chg-doc__submit" :loading="saving" :disabled="!createReady" @click="submitChange">
            提交审批
          </el-button>
        </aside>
      </div>
    </section>

    <el-dialog v-model="sourcePickerVisible" title="选择来源分项" width="760px">
      <p class="source-picker__note">先展示可识别的原合同行和已生效变更目标；当前有效剩余、待审批占用和最终可变更量由服务端复核。</p>
      <el-input v-model="sourceKeyword" clearable placeholder="搜索分项、品牌、规格或变更单号" />
      <div class="source-picker__groups">
        <section
          v-for="group in sourcePickerAreas"
          v-show="filteredSourceOptions.some((item) => item.group === group.key)"
          :key="group.key"
          class="source-picker__group"
        >
          <h4>{{ group.label }}</h4>
          <button
            v-for="option in filteredSourceOptions.filter((item) => item.group === group.key)"
            :key="option.key"
            type="button"
            class="source-picker__row"
            @click="chooseSource(option)"
          >
            <span><strong>{{ option.name }}</strong><small>{{ option.detail }}</small></span>
            <span class="source-picker__facts"><b>{{ sourceQuantityLabel(option) }}</b><small v-if="option.amount !== undefined">¥{{ formatMoney(option.amount) }}</small></span>
          </button>
        </section>
        <EmptyState v-if="!filteredSourceOptions.length" title="没有匹配的来源分项" description="可以调整关键词，或返回检查合同主材行和已生效变更。" />
      </div>
      <template #footer><el-button @click="sourcePickerVisible = false">取消</el-button></template>
    </el-dialog>

    <DesignCatalogPicker
      v-model="catalogPickerVisible"
      :catalog-items="catalogItems"
      :areas="pickerAreas"
      :loading="catalogLoading"
      :show-space="false"
      title="选择变更目标分项"
      note="目标分项来自当前企业启用的报价项目库；选择只确定目标与工程量，正式金额、成本和差额由服务端快照计算。"
      add-label="加入变更单"
      @add="onPickerAdd"
    />
  </div>
</template>


<style scoped lang="scss">
@use '@/styles/workbench-shell' as wb;

.chg { display: flex; flex-direction: column; gap: $space-4; padding: $space-5; }
.chg__head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-4; }
.chg__head h2 { margin: $space-1 0; font-size: $font-display; }
.chg__head p { margin: 0; max-width: 820px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
.chg__eyebrow { color: $brand-600 !important; font-size: $font-caption !important; font-weight: $font-weight-semibold; letter-spacing: .1em; }
.chg__head-actions { display: flex; flex-direction: column; align-items: stretch; gap: $space-2; min-width: 260px; }
.chg__head-actions :deep(.project-picker__field) { min-width: 260px; }
.chg__head-actions :deep(.project-picker__field--selected) { min-height: 66px; }
.chg__head-actions :deep(.project-picker__field--selected .project-picker__field-main) { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: 'top top' 'name actions'; }
.chg__head-actions :deep(.project-picker__field--selected .project-picker__field-facts),
.chg__head-actions :deep(.project-picker__field--selected > .project-picker__field-main > small) { display: none; }
.chg__head-actions :deep(.project-picker__field--selected .project-picker__field-actions) { grid-area: actions; }
.chg__state { border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; box-shadow: $shadow-card; }
.chg__start-steps { display: flex; align-items: center; justify-content: center; gap: $space-3; padding: 0 $space-5 $space-5; color: $text-tertiary; font-size: $font-caption; flex-wrap: wrap; }
.chg__start-steps span { display: inline-flex; align-items: center; gap: 5px; color: $text-secondary; }
.chg__start-steps b { color: $brand-600; }
.chg__start-steps i { color: $border-color; font-style: normal; }

.chg__layout { @include wb.workbench-layout(330px, 330px); }
.chg__queue { @include wb.workbench-queue; }
.chg__queue-list { @include wb.workbench-queue-scroll; }
.chg__main { @include wb.workbench-workspace; max-height: calc(100vh - var(--workbench-queue-top) - #{$space-4}); padding-right: 2px; overflow: auto; }
.chg__guide { @include wb.workbench-guide; }

.chg__queue-head { display: flex; align-items: center; justify-content: space-between; gap: $space-2; padding: $space-3 $space-4; border-bottom: 1px solid $border-color; }
.chg__queue-head strong { display: block; font-size: $font-body-sm; }
.chg__queue-head span { display: block; margin-top: 2px; color: $text-tertiary; font-size: $font-caption; }
.chg__filters { display: flex; flex-wrap: wrap; gap: $space-1; padding: $space-2 $space-4; border-bottom: 1px solid $border-color; }
.chg__filters button { padding: 4px 7px; border: 1px solid $border-color; border-radius: $radius-pill; background: $surface-0; color: $text-secondary; font-size: $font-caption; cursor: pointer; }
.chg__filters button.active { border-color: $brand-300; background: $brand-50; color: $brand-700; font-weight: $font-weight-semibold; }
.chg-item { width: 100%; padding: $space-3 $space-4; border: 0; border-bottom: 1px solid $border-color; background: transparent; text-align: left; cursor: pointer; }
.chg-item:hover, .chg-item--active { background: $brand-50; }
.chg-item--active { box-shadow: inset 3px 0 0 $brand-500; }
.chg-item__top { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.chg-item__top em { overflow: hidden; color: $text-tertiary; font-size: $font-caption; font-style: normal; text-overflow: ellipsis; white-space: nowrap; }
.chg-item > strong { display: block; margin-top: 6px; overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
.chg-item__meta { display: block; margin-top: 3px; color: $text-secondary; font-size: $font-caption; }
.chg-item__amount { display: block; margin-top: 7px; color: $brand-700; font-size: $font-body-sm; font-variant-numeric: tabular-nums; }
.chg-item > small { display: block; margin-top: 5px; color: $text-tertiary; font-size: $font-caption; }

.chg__detail-head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-4; padding: $space-5; border: 1px solid $border-color; border-radius: $radius-md; background: linear-gradient(135deg, $brand-50, $surface-0 72%); box-shadow: $shadow-card; }
.chg__object-label { color: $brand-600; font-size: $font-caption; font-weight: $font-weight-semibold; letter-spacing: .1em; }
.chg__detail-head h3 { margin: $space-1 0; font-size: $font-h1; }
.chg__detail-head p { margin: 0; color: $text-secondary; font-size: $font-body-sm; }
.chg__detail-status { display: flex; flex-direction: column; align-items: flex-end; gap: $space-2; }
.chg__facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: $space-2; padding: $space-4; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; box-shadow: $shadow-card; }
.chg__facts div { min-width: 0; padding: $space-2 $space-3; border-radius: $radius-sm; background: $surface-50; }
.chg__facts span { display: block; color: $text-tertiary; font-size: $font-caption; }
.chg__facts b { display: block; margin-top: 3px; overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
.chg__items, .chg__proof, .chg__timeline { padding: $space-4; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; box-shadow: $shadow-card; }
.chg__items > header, .chg__proof > header { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; padding-bottom: $space-3; border-bottom: 1px solid $border-color; }
.chg__items h4, .chg__proof h4, .chg__timeline h4 { margin: 0; font-size: $font-body-sm; }
.chg__items header p, .chg__proof header span { margin: 4px 0 0; color: $text-secondary; font-size: $font-caption; }
.chg__items header > span { color: $text-tertiary; font-size: $font-caption; }
.chg-item-line { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; padding: $space-3 0; border-bottom: 1px solid $border-color; }
.chg-item-line:last-child { border-bottom: 0; }
.chg-item-line span, .chg-item-line strong, .chg-item-line small { display: block; }
.chg-item-line > div:first-child > span { color: $brand-600; font-size: $font-caption; }
.chg-item-line strong { margin-top: 3px; font-size: $font-body-sm; }
.chg-item-line small { margin-top: 3px; color: $text-secondary; font-size: $font-caption; }
.chg-item-line__money { flex: 0 0 auto; text-align: right; font-variant-numeric: tabular-nums; }
.chg__proof-grid { display: flex; flex-wrap: wrap; gap: $space-2; padding-top: $space-3; }
.chg__proof-image { width: 92px; height: 92px; border: 1px solid $border-color; border-radius: $radius-sm; overflow: hidden; cursor: zoom-in; }
.chg__timeline { display: flex; flex-direction: column; gap: $space-3; }
.chg__timeline-row { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: $space-2; }
.chg__timeline-node { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: $surface-100; color: $text-tertiary; font-size: 10px; }
.chg__timeline-node.is-done { background: $brand-500; color: $surface-0; }
.chg__timeline-row strong { display: block; font-size: $font-body-sm; }
.chg__timeline-row p { margin: 3px 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.5; }

.chg__guide section { padding: $space-4; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; box-shadow: $shadow-card; }
.chg__guide h3 { margin: 0 0 $space-2; font-size: $font-body-sm; }
.chg__guide p { margin: 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.65; }
.chg__guide ul { margin: 0; padding: 0; list-style: none; }
.chg__guide li { position: relative; padding: 0 0 $space-2 12px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.6; }
.chg__guide li::before { position: absolute; top: 7px; left: 0; width: 5px; height: 5px; border-radius: 50%; background: $brand-400; content: ''; }
.chg__guide-actions { display: flex; flex-direction: column; gap: $space-2; }
.chg__guide dl { margin: 0; }
.chg__guide dl div { display: flex; justify-content: space-between; gap: $space-3; padding: $space-2 0; border-bottom: 1px solid $border-color; }
.chg__guide dl div:last-child { border-bottom: 0; }
.chg__guide dt { color: $text-tertiary; font-size: $font-caption; }
.chg__guide dd { margin: 0; color: $text-primary; font-size: $font-caption; text-align: right; }
.chg-focus { padding: $space-3; border: 1px solid rgba(255, 255, 255, .88); border-radius: $radius-sm; background: rgba(255, 255, 255, .72); }
.chg-focus span, .chg-focus strong, .chg-focus small { display: block; }
.chg-focus span { color: $text-tertiary; font-size: $font-caption; }
.chg-focus strong { margin-top: 3px; color: $text-primary; font-size: $font-body; }
.chg-focus small { margin-top: 4px; color: $text-secondary; font-size: $font-caption; }
.chg__primary { display: flex; align-items: center; gap: $space-3; }
.chg__primary small { color: $text-secondary; font-size: $font-caption; line-height: 1.5; }

/* ── 单据化录入页（对齐高保真原型 v2：表格行 = 明细、合计常驻、右栏只留提交前检查） ── */
.chg-doc { display: flex; flex-direction: column; gap: $space-4; }
.chg-doc__head { display: flex; align-items: flex-start; gap: $space-4; }
.chg-doc__head h2 { margin: $space-2 0 $space-1; font-size: $font-h1; }
.chg-doc__head p { margin: 0; max-width: 720px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
.chg-doc__head > .el-tag,
.chg-doc__head > *:last-child { margin-left: auto; }
.chg-doc__grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: $space-4; align-items: start; }
.chg-doc__paper { border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; overflow: hidden; }
.chg-doc__meta { padding: $space-4; border-bottom: 1px solid $border-color; background: linear-gradient(150deg, $surface-0, $brand-50); }
.chg-doc__meta h3 { margin: 0 0 $space-2; font-size: $font-card-title; }
.chg-doc__facts { display: flex; flex-wrap: wrap; gap: $space-2 $space-4; color: $text-secondary; font-size: $font-caption; }
.chg-doc__facts b { color: $ink-800; }
.chg-doc__section { padding: $space-4; border-bottom: 1px solid $border-color; }
.chg-doc__section:last-child { border-bottom: none; }
.chg-doc__section-head { display: flex; align-items: flex-start; gap: $space-4; margin-bottom: $space-3; }
.chg-doc__section-head h4 { margin: 0 0 $space-1; font-size: $font-body; display: flex; align-items: center; gap: $space-2; }
.chg-doc__section-head p { margin: 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.chg-doc__count { padding: 2px 8px; border-radius: $radius-pill; background: $brand-50; color: $brand-600; font-size: $font-caption; font-weight: $font-weight-semibold; }
.chg-doc__actions { display: flex; gap: $space-2; margin-left: auto; }
.chg-doc__total { display: flex; align-items: center; gap: $space-6; margin-top: $space-3; padding: $space-3 $space-4; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-50; }
.chg-doc__total small { display: block; color: $text-tertiary; font-size: $font-caption; }
.chg-doc__total b { font-variant-numeric: tabular-nums; font-size: $font-body; }
.chg-doc__total b.is-up { color: $danger-500; }
.chg-doc__total b.is-down { color: $success-500; }
.chg-doc__total-hero { margin-left: auto; text-align: right; }
.chg-doc__total-hero b { font-size: $font-title; color: $brand-600; }
.chg-doc__hint { margin: $space-2 0 0; color: $text-secondary; font-size: $font-caption; }
.chg-doc__trace { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: $space-3; }
.chg-doc__trace small { display: block; margin-bottom: $space-1; color: $text-tertiary; font-size: $font-caption; }
.chg-doc__trace b { font-size: $font-body-sm; font-weight: $font-weight-medium; }
.chg-doc__trace b.is-ok { color: $success-500; }
.chg-doc__rail { position: sticky; top: $space-4; padding: $space-4; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; }
.chg-doc__rail h4 { margin: 0 0 $space-1; font-size: $font-card-title; }
.chg-doc__rail-sub { margin: 0 0 $space-3; color: $text-secondary; font-size: $font-caption; }
.chg-doc__checks { display: flex; flex-direction: column; gap: $space-2; margin-bottom: $space-3; }
.chg-doc__checks span { color: $text-secondary; font-size: $font-body-sm; }
.chg-doc__checks span.is-ready { color: $ink-800; }
.chg-doc__rail-hint { margin: $space-3 0; padding-top: $space-3; border-top: 1px dashed $border-color; color: $text-tertiary; font-size: $font-caption; line-height: 1.7; }
.chg-doc__error { margin-bottom: $space-3; padding: $space-2 $space-3; border-radius: $radius-sm; background: $danger-50; color: $danger-500; font-size: $font-caption; line-height: 1.6; }
.chg-doc__submit { width: 100%; }

/* 明细表格：一行内同时看到来源、目标、工程量、本条差额，横向可比对 */
.chg-table__wrap { overflow-x: auto; border: 1px solid $border-color; border-radius: $radius-sm; }
.chg-table { width: 100%; min-width: 860px; border-collapse: separate; border-spacing: 0; font-size: $font-body-sm; }
.chg-table th { padding: $space-2 $space-3; background: $surface-50; border-bottom: 1px solid $border-color; color: $text-secondary; font-size: $font-caption; font-weight: $font-weight-semibold; text-align: left; white-space: nowrap; }
.chg-table td { padding: $space-3; border-bottom: 1px solid $border-color; vertical-align: top; }
.chg-table tr:last-child td { border-bottom: none; }
.chg-table tr.is-invalid td { background: #fffbfb; }
.chg-table__idx { width: 40px; color: $text-tertiary; font-variant-numeric: tabular-nums; }
.chg-table__action { width: 132px; }
.chg-table__qty { width: 150px; }
.chg-table__delta { width: 120px; text-align: right; font-weight: $font-weight-semibold; font-variant-numeric: tabular-nums; white-space: nowrap; }
.chg-table__op { width: 72px; text-align: right; }
.chg-table__mode { display: flex; margin-top: $space-2; }
.chg-table__pick { display: block; width: 100%; padding: $space-2 $space-3; border: 1px dashed $line-200; border-radius: $radius-sm; background: $surface-50; text-align: left; cursor: pointer; transition: $transition-fast; }
.chg-table__pick:hover { border-color: $brand-300; background: $brand-50; }
.chg-table__pick strong { display: block; color: $ink-800; font-size: $font-body-sm; font-weight: $font-weight-medium; }
.chg-table__pick small { display: block; margin-top: 2px; color: $text-tertiary; font-size: $font-caption; line-height: 1.5; }
.chg-table__stat { font-variant-numeric: tabular-nums; }
.chg-table__block { display: block; margin-top: $space-1; color: $warning-700; font-size: $font-caption; }
.chg-table__muted { padding-top: $space-3; color: $text-tertiary; font-size: $font-caption; }


@media (max-width: 1400px) {
  .chg__layout { grid-template-columns: 300px minmax(0, 1fr); }
  .chg__guide { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: $space-2; }
  .chg-doc__grid { grid-template-columns: minmax(0, 1fr) 260px; }
}

@media (max-width: 1024px) {
  .chg__main { max-height: none; overflow: visible; padding-right: 0; }
  .chg__head { flex-direction: column; }
  .chg__head-actions { width: 100%; }
  .chg__layout { grid-template-columns: 1fr; }
  .chg__guide { grid-column: auto; grid-template-columns: 1fr 1fr; max-height: none; overflow: visible; }
  .chg-doc__grid { grid-template-columns: 1fr; }
  .chg-doc__rail { position: static; }
  .chg-doc__trace { grid-template-columns: 1fr 1fr; }
  .chg__facts { grid-template-columns: 1fr 1fr; }
}
</style>
