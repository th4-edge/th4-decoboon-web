<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import DateClockField from '@/components/form/DateClockField.vue'
import FileUploadField from '@/components/form/FileUploadField.vue'
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
import { CONTRACT_CHANGE_TYPE_LABELS } from '@/domains/contract/meta'
import type { UploadedFile } from '@/domains/file/model'
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

const CONFIRM_METHODS = ['当面确认', '微信确认', '电话+书面', '其他']
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
  reason: '',
  customerConfirmedAt: '',
  customerConfirmedBy: '',
  confirmMethod: '当面确认'
})
const signatureFiles = ref<UploadedFile[]>([])
const evidenceFiles = ref<UploadedFile[]>([])
const draftRows = ref<DraftRow[]>([])
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

const createReady = computed(() => {
  if (!createForm.reason.trim() || !createForm.customerConfirmedAt || !createForm.customerConfirmedBy.trim()) return false
  if (!signatureFiles.value.length && !evidenceFiles.value.length) return false
  if (!draftRows.value.length) return false
  return draftRows.value.every((row) => rowReady(row))
})

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
  createForm.customerConfirmedAt = ''
  createForm.customerConfirmedBy = ''
  createForm.confirmMethod = '当面确认'
  signatureFiles.value = []
  evidenceFiles.value = []
  draftRows.value = [newRow('add')]
  actionError.value = ''
  createVisible.value = true
  void loadCatalog()
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
}

function removeDraftRow(key: string): void {
  draftRows.value = draftRows.value.filter((row) => row.key !== key)
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

function sourceUnit(key: string): string {
  return sourceOptions.value.find((option) => option.key === key)?.unit || '单位待确认'
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

function rowActionLabel(action: DraftRow['action']): string {
  if (action === 'add') return '新增分项'
  if (action === 'reduce') return '减项'
  return '替换'
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
  if (!project.value || !contract.value || !createReady.value) return
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
      items,
      customerConfirmedAt: createForm.customerConfirmedAt,
      customerConfirmedBy: createForm.customerConfirmedBy.trim(),
      customerConfirmMethod: createForm.confirmMethod,
      signatureUrl: signatureFiles.value[0]?.path,
      evidenceImages: evidenceFiles.value.map((file) => file.path)
    })
    createVisible.value = false
    selectedChangeId.value = created.id
    await loadProject(project.value.id)
    ElMessage.success('增减项已形成，等待 BOSS / 财务审批')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '增减项发起失败，请检查来源和客户确认信息'
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
        <span><b>02</b> 填写客户线下确认事实</span>
        <i>→</i>
        <span><b>03</b> 逐条加入变更明细</span>
        <i>→</i>
        <span><b>04</b> 提交 BOSS / 财务审批</span>
      </div>
    </section>

    <template v-else>
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
              <div><span>客户线下确认</span><b>{{ selectedChange.customerConfirmed ? `${selectedChange.customerConfirmedBy || '客户'} · ${selectedChange.customerConfirmMethod || '线下确认'}` : '待登记' }}</b></div>
              <div><span>确认时间</span><b>{{ formatLocalDateTime(selectedChange.customerConfirmedAt) }}</b></div>
              <div><span>审批时间</span><b>{{ formatLocalDateTime(selectedChange.approvedAt) }}</b></div>
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
              <header><h4>客户确认证据</h4><span>仅作现场确认留证，不代表客户自助确认</span></header>
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
                <div><strong>客户线下确认</strong><p>{{ selectedChange.customerConfirmed ? `${selectedChange.customerConfirmedBy || '客户'}已确认 · ${formatLocalDateTime(selectedChange.customerConfirmedAt)}` : '尚未确认' }}</p></div>
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

    <el-drawer v-model="createVisible" title="发起增减项" size="88%" :destroy-on-close="false">
      <div class="chg-create">
        <section class="chg-create__paper">
          <header class="chg-create__head">
            <div>
              <span>合同增减项单</span>
              <h3>{{ project?.name || '项目待确认' }} · {{ contract?.no || '合同待确认' }}</h3>
              <p>客户线下确认后形成一张变更单；多条明细一次提交、一次审批、一次履约联动。</p>
            </div>
            <StatusTag text="待提交" tone="pending" :dot="false" />
          </header>

          <div class="chg-create__context">
            <span>合同当前额 <MoneyText :value="contract?.currentAmount" /></span>
            <span>项目 <b>{{ project?.no || '编号待确认' }}</b></span>
            <span>发起人 <b>{{ session.displayName }}</b></span>
          </div>

          <section class="chg-create__section">
            <div class="chg-create__section-head"><div><h4>变更原因</h4><p>说明客户诉求和本次变更的业务背景。</p></div></div>
            <el-input v-model="createForm.reason" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="例如：客户现场确认将原卫生间墙砖替换为同品牌暖白规格，并增加阳台晾晒区。" />
          </section>

          <section class="chg-create__section">
            <div class="chg-create__section-head">
              <div><h4>变更明细</h4><p>逐条录入新增分项、减项或替换；金额与当前有效剩余由服务端计算。</p></div>
              <div class="chg-create__row-actions">
                <el-button size="small" @click="addDraftRow('add')">＋ 新增分项</el-button>
                <el-button size="small" @click="addDraftRow('reduce')">－ 减项</el-button>
                <el-button size="small" @click="addDraftRow('replace')">⇄ 替换</el-button>
              </div>
            </div>

            <div class="chg-create__rows">
              <article v-for="(row, index) in draftRows" :key="row.key" class="chg-create__row">
                <header>
                  <span>明细 {{ index + 1 }}</span>
                  <el-select v-model="row.action" size="small" style="width: 124px" @change="row.sourceKey = row.action === 'add' ? '' : row.sourceKey">
                    <el-option label="新增分项" value="add" />
                    <el-option label="减项" value="reduce" />
                    <el-option label="替换" value="replace" />
                  </el-select>
                  <el-button text type="danger" :disabled="draftRows.length === 1" @click="removeDraftRow(row.key)">删除</el-button>
                </header>

                <div v-if="row.action === 'reduce'" class="chg-create__mode">
                  <el-radio-group v-model="row.reduceMode" size="small">
                    <el-radio-button label="partial">部分减少</el-radio-button>
                    <el-radio-button label="full">整项取消</el-radio-button>
                  </el-radio-group>
                  <span>整项取消会关闭来源当前有效剩余，不删除原合同行。</span>
                </div>

                <el-form label-position="top" class="chg-create__form">
                  <el-form-item v-if="row.action !== 'add'" label="来源分项">
                    <button type="button" class="chg-create__target" @click="openSourcePicker(row)">
                      <span v-if="row.sourceKey">
                        <strong>{{ sourceSelectionLabel(row.sourceKey) }}</strong>
                        <small>{{ sourceOptions.find((item) => item.key === row.sourceKey)?.detail || '来源范围' }}</small>
                      </span>
                      <span v-else>
                        <strong>选择原合同行或已生效变更目标</strong>
                        <small>服务端提交时复核当前有效剩余和待审批占用</small>
                      </span>
                      <b>选择</b>
                    </button>
                    <small class="chg-create__hint">当前有效剩余和待审批占用以服务端为准，提交时会重新校验。</small>
                  </el-form-item>

                  <el-form-item v-if="row.action !== 'reduce'" label="目标分项">
                    <button type="button" class="chg-create__target" @click="openTargetPicker(row)">
                      <span v-if="row.target">
                        <strong>{{ row.target.name }}</strong>
                        <small>{{ [row.target.brand, row.target.spec, row.target.unit].filter(Boolean).join(' · ') }}</small>
                      </span>
                      <span v-else>
                        <strong>从报价项目库选择目标分项</strong>
                        <small>只可选当前企业启用项目，提交时冻结目标快照</small>
                      </span>
                      <b>选择</b>
                    </button>
                  </el-form-item>

                  <el-form-item v-if="row.action !== 'reduce' || row.reduceMode === 'partial'" :label="row.action === 'reduce' ? `本次减少量（${sourceUnit(row.sourceKey)}）` : `目标工程量（${row.target?.unit || '单位待确认'}）`">
                    <el-input-number v-model="row.quantity" :min="0" :precision="3" :step="1" controls-position="right" style="width: 100%" />
                  </el-form-item>

                  <el-form-item label="行备注">
                    <el-input v-model="row.remark" placeholder="可补充客户具体要求、现场条件或沟通说明" />
                  </el-form-item>
                </el-form>

                <div class="chg-create__row-foot">
                  <span>{{ rowActionLabel(row.action) }}</span>
                  <small v-if="row.action === 'reduce' && row.reduceMode === 'full'">整项取消</small>
                  <small v-else-if="row.action === 'reduce'">差额由服务端按当前有效单价计算</small>
                  <small v-else>目标金额与差额由服务端按报价项目库计价规则生成</small>
                </div>
              </article>
            </div>
          </section>

          <section class="chg-create__section">
            <div class="chg-create__section-head"><div><h4>客户线下确认事实</h4><p>创建变更单前必须记录确认时间、客户确认人、确认方式和证据。</p></div></div>
            <div class="chg-create__confirm-grid">
              <el-form-item label="确认时间">
                <DateClockField v-model="createForm.customerConfirmedAt" />
              </el-form-item>
              <el-form-item label="客户确认人">
                <el-input v-model="createForm.customerConfirmedBy" placeholder="填写客户姓名或现场确认人" />
              </el-form-item>
              <el-form-item label="确认方式">
                <el-select v-model="createForm.confirmMethod" style="width: 100%">
                  <el-option v-for="method in CONFIRM_METHODS" :key="method" :label="method" :value="method" />
                </el-select>
              </el-form-item>
            </div>
            <div class="chg-create__uploads">
              <FileUploadField
                v-model="signatureFiles"
                business-type="ContractChange"
                :project-id="project?.id"
                label="客户签名 / 签认单"
                hint="可上传照片或扫描件；与现场照片至少提供一项"
                accept="image/*,.pdf"
                :max="1"
                @error="actionError = $event"
              />
              <FileUploadField
                v-model="evidenceFiles"
                business-type="ContractChange"
                :project-id="project?.id"
                label="现场/书面证据"
                hint="保留能够说明客户线下确认事实的照片或文件"
                accept="image/*,.pdf"
                :max="9"
                @error="actionError = $event"
              />
            </div>
          </section>
        </section>

        <aside class="chg-create__preview">
          <span>本单结果预览</span>
          <h3>{{ draftRows.length }} 条变更明细</h3>
          <p>提交后进入待审批。服务端将重新校验来源当前有效剩余、目标报价项目库状态和客户确认事实。</p>
          <dl>
            <div><dt>变更类型</dt><dd>{{ draftRows.map((row) => rowActionLabel(row.action)).join(' / ') || '待录入' }}</dd></div>
            <div><dt>客户确认</dt><dd>{{ createForm.customerConfirmedBy || '待填写' }}</dd></div>
            <div><dt>确认证据</dt><dd>{{ signatureFiles.length + evidenceFiles.length }} 份</dd></div>
            <div><dt>预计结果</dt><dd>待审批</dd></div>
          </dl>
          <div class="chg-create__checklist">
            <span :class="{ 'is-ready': createForm.reason.trim() }">{{ createForm.reason.trim() ? '✓' : '○' }} 变更原因</span>
            <span :class="{ 'is-ready': draftRows.length && draftRows.every(rowReady) }">{{ draftRows.length && draftRows.every(rowReady) ? '✓' : '○' }} 变更明细</span>
            <span :class="{ 'is-ready': !!createForm.customerConfirmedAt && !!createForm.customerConfirmedBy.trim() }">{{ !!createForm.customerConfirmedAt && !!createForm.customerConfirmedBy.trim() ? '✓' : '○' }} 客户确认事实</span>
            <span :class="{ 'is-ready': !!(signatureFiles.length || evidenceFiles.length) }">{{ signatureFiles.length || evidenceFiles.length ? '✓' : '○' }} 签认证据</span>
          </div>
          <div v-if="actionError" class="chg-create__error">{{ actionError }}</div>
        </aside>
      </div>
      <template #footer>
        <div class="chg-create__footer">
          <span>金额差额由服务端计算；提交后不可在已生效单据上修改。</span>
          <div><el-button @click="createVisible = false">取消</el-button><el-button type="primary" :loading="saving" :disabled="!createReady" @click="submitChange">提交审批</el-button></div>
        </div>
      </template>
    </el-drawer>

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

.chg-create { display: grid; grid-template-columns: minmax(0, 1fr) 310px; gap: $space-4; }
.chg-create__paper { min-width: 0; }
.chg-create__head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; padding: $space-4; border: 1px solid $border-color; border-radius: $radius-md; background: linear-gradient(135deg, $brand-50, $surface-0 72%); }
.chg-create__head > div > span { color: $brand-600; font-size: $font-caption; font-weight: $font-weight-semibold; letter-spacing: .08em; }
.chg-create__head h3 { margin: 4px 0; font-size: $font-title; }
.chg-create__head p { margin: 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.chg-create__context { display: flex; flex-wrap: wrap; gap: $space-2; margin-top: $space-3; padding: $space-3; border-radius: $radius-sm; background: $surface-50; color: $text-secondary; font-size: $font-caption; }
.chg-create__context span { display: inline-flex; align-items: center; gap: 4px; padding-right: $space-3; border-right: 1px solid $border-color; }
.chg-create__context span:last-child { border-right: 0; }
.chg-create__context b { color: $text-primary; }
.chg-create__section { margin-top: $space-4; padding: $space-4; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; }
.chg-create__section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; margin-bottom: $space-3; }
.chg-create__section-head h4 { margin: 0; font-size: $font-body-sm; }
.chg-create__section-head p { margin: 4px 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.55; }
.chg-create__row-actions { display: flex; gap: $space-1; flex-wrap: wrap; }
.chg-create__rows { display: flex; flex-direction: column; gap: $space-2; }
.chg-create__row { padding: $space-3; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-50; }
.chg-create__row > header { display: flex; align-items: center; gap: $space-2; margin-bottom: $space-2; }
.chg-create__row > header > span { flex: 1; color: $text-secondary; font-size: $font-caption; font-weight: $font-weight-semibold; }
.chg-create__row > header .el-button { margin-left: auto; }
.chg-create__mode { display: flex; align-items: center; gap: $space-2; margin-bottom: $space-2; color: $text-secondary; font-size: $font-caption; }
.chg-create__mode > span { color: $text-tertiary; }
.chg-create__form :deep(.el-form-item) { margin-bottom: $space-2; }
.chg-create__hint { display: block; margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }
.chg-create__target { display: flex; align-items: center; justify-content: space-between; gap: $space-3; width: 100%; min-height: 58px; padding: $space-2 $space-3; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; text-align: left; cursor: pointer; }
.chg-create__target > span { min-width: 0; }
.chg-create__target strong, .chg-create__target small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chg-create__target strong { color: $text-primary; font-size: $font-body-sm; }
.chg-create__target small { margin-top: 3px; color: $text-secondary; font-size: $font-caption; }
.chg-create__target b { flex: 0 0 auto; color: $brand-600; font-size: $font-caption; }
.chg-create__confirm-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0 $space-3; }
.chg-create__uploads { display: grid; grid-template-columns: 1fr 1fr; gap: $space-3; margin-top: $space-2; }
.chg-create__preview { position: sticky; top: $space-4; align-self: start; padding: $space-4; border: 1px solid $border-color; border-radius: $radius-md; background: linear-gradient(180deg, $surface-50, $surface-0); }
.chg-create__preview > span { color: $brand-600; font-size: $font-caption; font-weight: $font-weight-semibold; letter-spacing: .08em; }
.chg-create__preview h3 { margin: 4px 0 6px; font-size: $font-title; }
.chg-create__preview p { margin: 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.65; }
.chg-create__preview dl { margin: $space-3 0; }
.chg-create__preview dl div { display: flex; justify-content: space-between; gap: $space-3; padding: $space-2 0; border-bottom: 1px solid $border-color; }
.chg-create__preview dt { color: $text-tertiary; font-size: $font-caption; }
.chg-create__preview dd { margin: 0; color: $text-primary; font-size: $font-caption; text-align: right; }
.chg-create__checklist { display: flex; flex-direction: column; gap: $space-2; }
.chg-create__checklist span { color: $text-tertiary; font-size: $font-caption; }
.chg-create__checklist span.is-ready { color: $success-500; }
.chg-create__error { margin-top: $space-3; padding: $space-2; border-radius: $radius-sm; background: $danger-50; color: $danger-500; font-size: $font-caption; line-height: 1.5; }
.chg-create__footer { display: flex; align-items: center; justify-content: space-between; gap: $space-3; width: 100%; }
.chg-create__footer > span { color: $text-secondary; font-size: $font-caption; }
.chg-create__footer > div { display: flex; gap: $space-2; }

.source-picker__note { margin: 0 0 $space-3; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.source-picker__groups { display: flex; flex-direction: column; gap: $space-4; max-height: 52vh; margin-top: $space-3; overflow: auto; }
.source-picker__group h4 { margin: 0 0 $space-2; color: $text-secondary; font-size: $font-caption; }
.source-picker__row { display: flex; align-items: center; justify-content: space-between; gap: $space-4; width: 100%; padding: $space-3; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; text-align: left; cursor: pointer; }
.source-picker__row:hover { border-color: $brand-300; background: $brand-50; }
.source-picker__row > span:first-child { min-width: 0; }
.source-picker__row strong, .source-picker__row small { display: block; }
.source-picker__row strong { color: $text-primary; font-size: $font-body-sm; }
.source-picker__row small { margin-top: 3px; color: $text-secondary; font-size: $font-caption; }
.source-picker__facts { flex: 0 0 auto; text-align: right; }
.source-picker__facts b { color: $brand-700; font-size: $font-caption; }

@media (max-width: 1400px) and (min-width: 1025px) {
  .chg__main { max-height: 260px; }
  .chg__guide { max-height: 130px; overflow: auto; }
}

@media (max-width: 1400px) {
  .chg__layout { grid-template-columns: 300px minmax(0, 1fr); }
  .chg__guide { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: $space-2; }
  .chg-create { grid-template-columns: minmax(0, 1fr) 280px; }
}

@media (max-width: 1024px) {
  .chg__main { max-height: none; overflow: visible; padding-right: 0; }
  .chg__head { flex-direction: column; }
  .chg__head-actions { width: 100%; }
  .chg__layout { grid-template-columns: 1fr; }
  .chg__guide { grid-column: auto; grid-template-columns: 1fr 1fr; max-height: none; overflow: visible; }
  .chg-create { grid-template-columns: 1fr; }
  .chg-create__preview { position: static; }
  .chg-create__confirm-grid, .chg-create__uploads { grid-template-columns: 1fr; }
  .chg__facts { grid-template-columns: 1fr 1fr; }
}
</style>
