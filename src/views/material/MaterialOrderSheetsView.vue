<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ProviderError } from '@/core/http'
import { materialSheetApi, loadSheetEnums, listProjectMaterialPlans } from '@/domains/material/api'
import type {
  MaterialOrderSheet,
  MaterialSheetFieldConfig,
  MaterialSheetStatus,
  ProjectMaterialPlan
} from '@/domains/material/model'
import { useSessionStore } from '@/stores/session'
import { useStoreScopeStore } from '@/stores/storeScope'
import EmptyState from '@/components/EmptyState.vue'
import PanelCard from '@/components/PanelCard.vue'
import ProjectPicker from '@/components/picker/ProjectPicker.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StatusTag from '@/components/StatusTag.vue'
import type { StatusTone } from '@/core/tone'

type SheetTypeOption = { code: string; name: string; headerFields: MaterialSheetFieldConfig[]; lineFields: MaterialSheetFieldConfig[] }
type DraftLine = {
  materialPlanId: string
  name: string
  spaceName: string
  locationName: string
  brand: string
  model: string
  spec: string
  color: string
  size: string
  craft: string
  glass: string
  quantity: string
  unit: string
}
type SheetForm = {
  projectId: string
  sheetType: string
  manufacturerName: string
  groupChatAt: string
  measureAt: string
  deliverAt: string
  installAt: string
  remark: string
}

const router = useRouter()
const session = useSessionStore()
const scope = useStoreScopeStore()
const UNIT_LABEL: Record<string, string> = {
  Area: '㎡', Sheet: '片', Block: '块', Plate: '樘', Set: '套', Count: '个', Metre: '米', Item: '项', Pcs: '台', Place: '处',
  House: '户', Centimeter: 'cm', Step: '步', Root: '根', Hole: '扇', Stick: '支', Grid: '格'
}
const STATUS_META: Record<MaterialSheetStatus, { label: string; tone: StatusTone }> = {
  draft: { label: '填单中', tone: 'todo' },
  measuring: { label: '待测量', tone: 'pending' },
  measured: { label: '已测量', tone: 'pending' },
  submitted: { label: '待下单', tone: 'pending' },
  pricing: { label: '核价中', tone: 'pending' },
  ordered: { label: '已下单', tone: 'progress' },
  partiallyOrdered: { label: '部分下单', tone: 'progress' },
  partiallyArrived: { label: '部分到场', tone: 'progress' },
  arrived: { label: '已到场', tone: 'done' },
  settled: { label: '已结算', tone: 'done' },
  closed: { label: '已关闭', tone: 'done' },
  cancelled: { label: '已取消', tone: 'blocked' }
}
const PLAN_STATUS_LABEL: Record<string, string> = {
  planned: '待选材', readyToOrder: '可下单', requested: '已请购', approved: '已批准',
  partiallyOrdered: '部分下单', ordered: '已下单', partiallyArrived: '部分到场', arrived: '已到场',
  closed: '已关闭', cancelled: '已取消'
}

const role = computed(() => session.role ?? '')
const canMaintain = computed(() => ['Designer', 'Boss', 'StoreManager'].includes(role.value))
const canMeasure = computed(() => ['Pm', 'Designer', 'Boss', 'StoreManager'].includes(role.value))
const canCancel = computed(() => ['Designer', 'Boss', 'StoreManager', 'Finance'].includes(role.value))
const canOrderLink = computed(() => ['Finance', 'Boss', 'StoreManager'].includes(role.value))

const loading = ref(true)
const error = ref('')
const sheets = ref<MaterialOrderSheet[]>([])
const selected = ref<MaterialOrderSheet | null>(null)
const projectId = ref('')
const sheetType = ref('')
const sheetTypes = ref<SheetTypeOption[]>([])
const units = ref<Array<{ value: string; name: string }>>([])
const actionLoading = ref('')
const selectedId = ref('')
const measureVisible = ref(false)
const measureTarget = ref<MaterialOrderSheet | null>(null)
const measureSaving = ref(false)
const measureForm = reactive({ measureAt: '', deliverAt: '', installAt: '', signatures: '' })

const formVisible = ref(false)
const formEditingId = ref('')
const formSaving = ref(false)
const formError = ref('')
const form = reactive<SheetForm>({
  projectId: '', sheetType: '', manufacturerName: '', groupChatAt: '', measureAt: '', deliverAt: '', installAt: '', remark: ''
})
const draftLines = ref<DraftLine[]>([])
const planLoading = ref(false)
const planError = ref('')
const projectPlans = ref<ProjectMaterialPlan[]>([])
const selectedType = computed(() => sheetTypes.value.find((item) => item.code === form.sheetType) ?? null)
const typeNames = computed(() => Object.fromEntries(sheetTypes.value.map((item) => [item.code, item.name])))
const availablePlans = computed(() => {
  const chosen = new Set(draftLines.value.map((line) => line.materialPlanId))
  return projectPlans.value.filter((plan) => !chosen.has(plan.id))
})
const editableStatuses: MaterialSheetStatus[] = ['draft', 'measuring', 'measured', 'submitted', 'pricing']
const submitStatuses: MaterialSheetStatus[] = ['draft', 'measuring', 'measured']
const maintenanceCount = computed(() => sheets.value.filter((sheet) => ['draft', 'measuring', 'measured'].includes(sheet.status)).length)
const orderCount = computed(() => sheets.value.filter((sheet) => ['submitted', 'pricing'].includes(sheet.status)).length)
const purchasingCount = computed(() => sheets.value.filter((sheet) => ['ordered', 'partiallyOrdered', 'partiallyArrived', 'arrived', 'settled', 'closed'].includes(sheet.status)).length)
const typeFields = computed(() => selectedType.value?.headerFields ?? [])
const measureField = computed(() => typeFields.value.find((field) => field.key === 'measureAt'))
const deliverField = computed(() => typeFields.value.find((field) => field.key === 'deliverAt'))
const installField = computed(() => typeFields.value.find((field) => field.key === 'installAt'))
const formReady = computed(() => !!form.projectId && !!form.sheetType && draftLines.value.length > 0)

function typeName(code: string): string { return typeNames.value[code] || code || '作业单' }
function statusMeta(status: MaterialSheetStatus) { return STATUS_META[status] ?? STATUS_META.draft }
function unitLabel(unit?: string): string { return (unit && UNIT_LABEL[unit]) || unit || '' }
function fieldVisible(field?: MaterialSheetFieldConfig): boolean { return field?.visible !== false }
function fieldRequired(field?: MaterialSheetFieldConfig): boolean { return field?.required === true }
function visiblePlan(plan: ProjectMaterialPlan): string {
  return [plan.brand, plan.spec, `${plan.quantity}${unitLabel(plan.unit)}`].filter(Boolean).join(' · ')
}
function statusAction(sheet: MaterialOrderSheet): string {
  if (['draft', 'measuring', 'measured'].includes(sheet.status)) {
    if (canMaintain.value) return '补齐现场信息后提交请购'
    if (canMeasure.value) return '确认测量和安装时间'
    return '等待设计/项目确认'
  }
  if (['submitted', 'pricing'].includes(sheet.status)) return canOrderLink.value ? '进入财务主材下单' : '等待财务下单'
  if (['ordered', 'partiallyOrdered'].includes(sheet.status)) return '等待供应商到场'
  if (['partiallyArrived', 'arrived'].includes(sheet.status)) return '查看材料到场与结算状态'
  return '当前单据只读'
}
function canEdit(sheet: MaterialOrderSheet): boolean { return canMaintain.value && editableStatuses.includes(sheet.status) }
function canSubmit(sheet: MaterialOrderSheet): boolean { return canMaintain.value && submitStatuses.includes(sheet.status) }
function canMeasureSheet(sheet: MaterialOrderSheet): boolean { return canMeasure.value && editableStatuses.includes(sheet.status) }
function canCancelSheet(sheet: MaterialOrderSheet): boolean {
  return canCancel.value && !['ordered', 'partiallyOrdered', 'partiallyArrived', 'arrived', 'settled', 'closed', 'cancelled'].includes(sheet.status)
}
function canOpenOrder(sheet: MaterialOrderSheet): boolean {
  return canOrderLink.value && ['submitted', 'pricing', 'partiallyOrdered'].includes(sheet.status)
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const [list, enums] = await Promise.all([
      materialSheetApi.list({ projectId: projectId.value || undefined, sheetType: sheetType.value || undefined, storeId: scope.requestStoreId ?? undefined }),
      loadSheetEnums()
    ])
    sheets.value = list
    sheetTypes.value = enums.sheetTypes
    units.value = enums.units
    const next = (selectedId.value && list.find((item) => item.id === selectedId.value)) || (selected.value && list.find((item) => item.id === selected.value?.id)) || list[0] || null
    selectSheet(next)
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '主材作业单暂不可确认'
    sheets.value = []
    selected.value = null
  } finally {
    loading.value = false
  }
}

function selectSheet(sheet: MaterialOrderSheet | null): void {
  selected.value = sheet
  selectedId.value = sheet?.id ?? ''
}

async function reloadSelected(id = selected.value?.id): Promise<void> {
  await load()
  if (id) {
    const current = sheets.value.find((sheet) => sheet.id === id)
    if (current) selectSheet(current)
  }
}

function openCreate(): void {
  formEditingId.value = ''
  form.projectId = projectId.value
  form.sheetType = sheetTypes.value[0]?.code ?? ''
  form.manufacturerName = ''
  form.groupChatAt = ''
  form.measureAt = ''
  form.deliverAt = ''
  form.installAt = ''
  form.remark = ''
  draftLines.value = []
  projectPlans.value = []
  planError.value = ''
  formError.value = ''
  formVisible.value = true
  if (form.projectId) void loadPlans(form.projectId)
}

function openEdit(sheet: MaterialOrderSheet): void {
  formEditingId.value = sheet.id
  form.projectId = sheet.projectId ?? ''
  form.sheetType = sheet.sheetType
  form.manufacturerName = sheet.manufacturerName ?? ''
  form.groupChatAt = sheet.groupChatAt ?? ''
  form.measureAt = sheet.measureAt ?? ''
  form.deliverAt = sheet.deliverAt ?? ''
  form.installAt = sheet.installAt ?? ''
  form.remark = sheet.remark ?? ''
  draftLines.value = sheet.items.map((item) => ({
    materialPlanId: item.materialPlanId,
    name: item.materialName || '材料',
    spaceName: item.spaceName || '',
    locationName: item.locationName || '',
    brand: item.brand || '',
    model: item.model || '',
    spec: item.spec || '',
    color: item.color || '',
    size: item.size || '',
    craft: item.craft || '',
    glass: item.glass || '',
    quantity: String(item.quantity || ''),
    unit: item.unit || 'Item'
  }))
  projectPlans.value = []
  planError.value = ''
  formError.value = ''
  formVisible.value = true
  if (form.projectId) void loadPlans(form.projectId)
}

async function loadPlans(id: string): Promise<void> {
  if (!id) { projectPlans.value = []; return }
  planLoading.value = true
  planError.value = ''
  try {
    projectPlans.value = await listProjectMaterialPlans(id)
  } catch (planLoadError) {
    projectPlans.value = []
    planError.value = planLoadError instanceof ProviderError ? planLoadError.message : '项目材料计划暂不可确认'
  } finally {
    planLoading.value = false
  }
}

function onProjectChange(): void {
  draftLines.value = []
  projectPlans.value = []
  if (form.projectId) void loadPlans(form.projectId)
}

function addPlan(plan: ProjectMaterialPlan): void {
  draftLines.value.push({
    materialPlanId: plan.id,
    name: plan.name,
    spaceName: '',
    locationName: '',
    brand: plan.brand ?? '',
    model: plan.model ?? '',
    spec: plan.spec ?? '',
    color: '',
    size: '',
    craft: '',
    glass: '',
    quantity: String(plan.quantity || ''),
    unit: plan.unit || 'Item'
  })
}

function removeLine(index: number): void { draftLines.value.splice(index, 1) }

function validateForm(): string {
  if (!form.projectId) return '请选择项目'
  if (!form.sheetType) return '请选择作业单品类'
  if (!draftLines.value.length) return '请至少加入一条项目材料计划'
  if (fieldRequired(measureField.value) && canMeasure.value && !form.measureAt) return `请填写${measureField.value?.label || '测量时间'}`
  for (const line of draftLines.value) {
    if (!line.locationName.trim()) return `请填写「${line.name}」的安装位置`
    if (Number(line.quantity || 0) <= 0) return `「${line.name}」数量必须大于 0`
  }
  return ''
}

async function saveSheet(submitAfterSave: boolean): Promise<void> {
  if (formSaving.value) return
  const validation = validateForm()
  if (validation) { ElMessage.warning(validation); return }
  if (submitAfterSave && !canSubmitForStatus(formEditingId.value)) {
    ElMessage.warning('只有填单中、待测量或已测量的作业单可以提交请购')
    return
  }
  formSaving.value = true
  formError.value = ''
  try {
    const payloadItems = draftLines.value.map((line) => ({
      materialPlanId: line.materialPlanId,
      locationName: line.locationName.trim(),
      spaceName: line.spaceName.trim() || undefined,
      materialName: line.name,
      brand: line.brand.trim() || undefined,
      model: line.model.trim() || undefined,
      spec: line.spec.trim() || undefined,
      color: line.color.trim() || undefined,
      size: line.size.trim() || undefined,
      craft: line.craft.trim() || undefined,
      glass: line.glass.trim() || undefined,
      quantity: Number(line.quantity),
      unit: line.unit,
      standardIncluded: true
    }))
    let saved: MaterialOrderSheet
    if (formEditingId.value) {
      saved = await materialSheetApi.update({
        sheetId: formEditingId.value,
        manufacturerName: form.manufacturerName.trim() || undefined,
        groupChatAt: form.groupChatAt || undefined,
        deliverAt: form.deliverAt || undefined,
        installAt: form.installAt || undefined,
        remark: form.remark.trim() || undefined,
        items: payloadItems
      })
    } else {
      saved = await materialSheetApi.save({
        projectId: form.projectId,
        sheetType: form.sheetType,
        manufacturerName: form.manufacturerName.trim() || undefined,
        groupChatAt: form.groupChatAt || undefined,
        installAt: form.installAt || undefined,
        remark: form.remark.trim() || undefined,
        items: payloadItems
      })
    }
    if (form.measureAt || form.deliverAt || form.installAt) {
      saved = await materialSheetApi.measure({
        sheetId: saved.id,
        measureAt: form.measureAt || undefined,
        deliverAt: form.deliverAt || undefined,
        installAt: form.installAt || undefined
      })
    }
    if (submitAfterSave) {
      saved = await materialSheetApi.submit(saved.id)
      ElMessage.success('作业单已保存并提交请购')
    } else {
      ElMessage.success('作业单草稿已保存')
    }
    formVisible.value = false
    selectedId.value = saved.id
    await load()
  } catch (saveError) {
    formError.value = saveError instanceof ProviderError ? saveError.message : '作业单保存失败，暂不可确认'
  } finally {
    formSaving.value = false
  }
}

function canSubmitForStatus(sheetId: string): boolean {
  if (!sheetId) return true
  const sheet = sheets.value.find((item) => item.id === sheetId)
  return !!sheet && submitStatuses.includes(sheet.status)
}

async function submitSheet(sheet: MaterialOrderSheet): Promise<void> {
  if (!canSubmit(sheet)) return
  actionLoading.value = `submit:${sheet.id}`
  try {
    if (sheet.status !== 'measured' && canMeasure.value && measureField.value?.required && !sheet.measureAt) {
      ElMessage.warning(`请先确认${measureField.value?.label || '测量时间'}`)
      return
    }
    await materialSheetApi.submit(sheet.id)
    ElMessage.success('已提交请购，等待财务下单')
    await reloadSelected(sheet.id)
  } catch (actionError) {
    ElMessage.error(actionError instanceof ProviderError ? actionError.message : '提交请购失败')
  } finally {
    actionLoading.value = ''
  }
}

function openMeasure(sheet: MaterialOrderSheet): void {
  if (!canMeasureSheet(sheet)) return
  measureTarget.value = sheet
  measureForm.measureAt = sheet.measureAt || ''
  measureForm.deliverAt = sheet.deliverAt || ''
  measureForm.installAt = sheet.installAt || ''
  measureForm.signatures = ''
  measureVisible.value = true
}

async function saveMeasure(): Promise<void> {
  const sheet = measureTarget.value
  if (!sheet || measureSaving.value) return
  if (fieldRequired(measureField.value) && !measureForm.measureAt) {
    ElMessage.warning(`请填写${measureField.value?.label || '测量时间'}`)
    return
  }
  measureSaving.value = true
  try {
    await materialSheetApi.measure({
      sheetId: sheet.id,
      measureAt: measureForm.measureAt || undefined,
      deliverAt: measureForm.deliverAt || undefined,
      installAt: measureForm.installAt || undefined,
      signatures: measureForm.signatures.trim() || undefined
    })
    ElMessage.success('测量与现场时间已保存')
    measureVisible.value = false
    await reloadSelected(sheet.id)
  } catch (measureError) {
    ElMessage.error(measureError instanceof ProviderError ? measureError.message : '测量信息保存失败')
  } finally {
    measureSaving.value = false
  }
}

async function cancelSheet(sheet: MaterialOrderSheet): Promise<void> {
  if (!canCancelSheet(sheet)) return
  try {
    const result = await ElMessageBox.prompt('取消后作业单保留历史，但不能再继续请购；已进入采购的作业单不能直接取消。', '取消作业单', {
      inputPlaceholder: '填写取消原因',
      inputValidator: (value) => !!String(value || '').trim() || '请填写取消原因',
      confirmButtonText: '确认取消',
      cancelButtonText: '返回'
    })
    actionLoading.value = `cancel:${sheet.id}`
    await materialSheetApi.cancel({ sheetId: sheet.id, reason: String(result.value).trim() })
    ElMessage.success('作业单已取消')
    await reloadSelected(sheet.id)
  } catch (cancelError) {
    if (cancelError === 'cancel' || cancelError === 'close') return
    ElMessage.error(cancelError instanceof ProviderError ? cancelError.message : '作业单取消失败')
  } finally {
    actionLoading.value = ''
  }
}

async function exportSheet(sheet: MaterialOrderSheet): Promise<void> {
  actionLoading.value = `export:${sheet.id}`
  try {
    const file = await materialSheetApi.exportFile(sheet.id)
    if (!file.contentBase64) throw new Error('导出文件为空')
    const binary = atob(file.contentBase64)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    const url = URL.createObjectURL(new Blob([bytes], { type: file.contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = file.fileName || '主材作业单.xlsx'
    anchor.click()
    URL.revokeObjectURL(url)
    ElMessage.success('作业单已导出')
  } catch (exportError) {
    ElMessage.error(exportError instanceof ProviderError ? exportError.message : '作业单导出失败')
  } finally {
    actionLoading.value = ''
  }
}

function openFinanceOrder(sheet: MaterialOrderSheet): void {
  if (!canOpenOrder(sheet)) return
  void router.push(`/finance/material-ordering?projectId=${encodeURIComponent(sheet.projectId || '')}`)
}

function openSelection(projectIdValue?: string): void {
  if (!projectIdValue) return
  void router.push(`/workbench/materials/${projectIdValue}`)
}

watch(() => scope.requestStoreId, () => { void load() })
watch([projectId, sheetType], () => { void load() })
onMounted(load)
</script>

<template>
  <div class="sheet-workbench">
    <header class="sheet-workbench__head">
      <div>
        <h1>主材作业单</h1>
        <p>按项目维护作业单、确认测量与提交请购；进入采购后材料和数量锁定，换材必须走增减项。</p>
      </div>
      <div class="sheet-workbench__actions">
        <el-button @click="load" :loading="loading">刷新</el-button>
        <el-button v-if="canMaintain" type="primary" @click="openCreate">新建作业单</el-button>
      </div>
    </header>

    <section class="sheet-workbench__filters" aria-label="作业单筛选">
      <ProjectPicker v-model="projectId" title="按项目筛选作业单" placeholder="全部项目" clearable />
      <el-select v-model="sheetType" clearable placeholder="全部品类" class="sheet-workbench__type">
        <el-option v-for="item in sheetTypes" :key="item.code" :label="item.name" :value="item.code" />
      </el-select>
      <span class="sheet-workbench__summary">
        <b>{{ maintenanceCount }}</b> 待维护
        <b>{{ orderCount }}</b> 待下单
        <b>{{ purchasingCount }}</b> 采购中
      </span>
    </section>

    <SkeletonBlock v-if="loading && !sheets.length" :rows="7" />
    <EmptyState v-else-if="error" title="主材作业单暂不可确认" :description="error">
      <el-button type="primary" plain @click="load">重新加载</el-button>
    </EmptyState>
    <div v-else class="sheet-workbench__grid">
      <PanelCard class="sheet-workbench__list" :title="`作业单 ${sheets.length} 张`" subtitle="按项目、品类和状态查看建单与采购进度">
        <EmptyState v-if="!sheets.length" title="当前没有主材作业单" description="选择项目后新建品类作业单；材料行只能来源于项目材料计划。" />
        <div v-else class="sheet-workbench__rows" role="list">
          <button
            v-for="sheet in sheets"
            :key="sheet.id"
            type="button"
            class="sheet-workbench__row"
            :class="{ 'sheet-workbench__row--active': selectedId === sheet.id }"
            @click="selectSheet(sheet)"
          >
            <div class="sheet-workbench__row-main">
              <strong>{{ typeName(sheet.sheetType) }}</strong>
              <span>{{ sheet.projectName || '项目待确认' }}</span>
              <small v-if="sheet.manufacturerName">厂家：{{ sheet.manufacturerName }} · {{ sheet.items.length }} 行</small>
              <small v-else>{{ sheet.items.length }} 行材料</small>
            </div>
            <div class="sheet-workbench__row-side">
              <StatusTag :text="statusMeta(sheet.status).label" :tone="statusMeta(sheet.status).tone" />
              <small>{{ statusAction(sheet) }}</small>
            </div>
          </button>
        </div>
      </PanelCard>

      <PanelCard v-if="selected" class="sheet-workbench__detail" :title="typeName(selected.sheetType)" :subtitle="selected.projectName || '项目待确认'">
        <div class="sheet-workbench__detail-head">
          <div class="sheet-workbench__detail-meta">
            <StatusTag :text="statusMeta(selected.status).label" :tone="statusMeta(selected.status).tone" />
            <span v-if="selected.priceState === 'unpriced'">采购价格待结算</span>
            <span v-else-if="selected.priceState === 'mixed'">部分采购已结算 · 成本待结算</span>
          </div>
          <div class="sheet-workbench__actions">
            <el-button v-if="canEdit(selected)" @click="openEdit(selected)">编辑</el-button>
            <el-button v-if="canMeasureSheet(selected)" @click="openMeasure(selected)">确认测量</el-button>
            <el-button v-if="canSubmit(selected)" type="primary" :loading="actionLoading === `submit:${selected.id}`" @click="submitSheet(selected)">提交请购</el-button>
            <el-button v-if="canOpenOrder(selected)" type="primary" plain @click="openFinanceOrder(selected)">去财务下单</el-button>
            <el-button @click="exportSheet(selected)" :loading="actionLoading === `export:${selected.id}`">导出</el-button>
            <el-button v-if="canCancelSheet(selected)" type="danger" plain :loading="actionLoading === `cancel:${selected.id}`" @click="cancelSheet(selected)">取消</el-button>
          </div>
        </div>

        <div class="sheet-workbench__facts">
          <div><span>测量时间</span><b>{{ selected.measureAt || '暂不可确认' }}</b></div>
          <div><span>配送时间</span><b>{{ selected.deliverAt || '暂不可确认' }}</b></div>
          <div><span>安装时间</span><b>{{ selected.installAt || '暂不可确认' }}</b></div>
          <div><span>下一步</span><b>{{ statusAction(selected) }}</b></div>
        </div>

        <section class="sheet-workbench__section">
          <div class="sheet-workbench__section-head">
            <div><h3>材料明细</h3><p>作业单行必须能追溯到项目材料计划。</p></div>
            <button v-if="selected.projectId" type="button" class="sheet-workbench__link" @click="openSelection(selected.projectId)">查看材料计划与选材</button>
          </div>
          <div class="sheet-workbench__table-wrap">
            <table class="sheet-workbench__table">
              <thead><tr><th>安装位置</th><th>材料</th><th>规格 / 花色</th><th>数量</th><th>采购进度</th></tr></thead>
              <tbody>
                <tr v-for="item in selected.items" :key="item.id">
                  <td>{{ item.locationName || item.spaceName || '未填安装位置' }}</td>
                  <td>{{ item.materialName || '材料名称暂不可确认' }}<small v-if="item.brand">{{ item.brand }}</small></td>
                  <td>{{ [item.spec, item.color, item.size].filter(Boolean).join(' · ') || '暂不可确认' }}</td>
                  <td>{{ item.quantity }} {{ unitLabel(item.unit) }}</td>
                  <td>{{ item.orderedQuantity ? `已下单 ${item.orderedQuantity}` : '未下单' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="selected.remark" class="sheet-workbench__section">
          <div class="sheet-workbench__section-head"><div><h3>作业单备注</h3><p>现场约定和交接说明，不替代采购价格或应付事实。</p></div></div>
          <p class="sheet-workbench__remark">{{ selected.remark }}</p>
        </section>
      </PanelCard>
      <PanelCard v-else class="sheet-workbench__detail">
        <EmptyState title="请选择一张作业单" description="左侧选择作业单后查看材料明细、测量信息和下一步动作。" />
      </PanelCard>
    </div>

    <el-dialog v-model="measureVisible" title="确认测量与现场时间" width="min(620px, 94vw)" destroy-on-close>
      <p class="sheet-measure__hint">{{ measureTarget?.projectName || '当前项目' }} · {{ measureTarget ? typeName(measureTarget.sheetType) : '作业单' }}</p>
      <div class="sheet-measure__grid">
        <label class="sheet-form-field">
          <span>{{ measureField?.label || '测量时间' }} <small v-if="fieldRequired(measureField)">必填</small></span>
          <el-date-picker v-model="measureForm.measureAt" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
        </label>
        <label v-if="fieldVisible(deliverField)" class="sheet-form-field">
          <span>{{ deliverField?.label || '配送时间' }}</span>
          <el-date-picker v-model="measureForm.deliverAt" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
        </label>
        <label v-if="fieldVisible(installField)" class="sheet-form-field">
          <span>{{ installField?.label || '安装时间' }}</span>
          <el-date-picker v-model="measureForm.installAt" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
        </label>
        <label class="sheet-form-field sheet-form-field--wide">
          <span>现场签字或确认说明</span>
          <el-input v-model="measureForm.signatures" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="可不填；用于记录现场确认说明" />
        </label>
      </div>
      <template #footer>
        <el-button @click="measureVisible = false">取消</el-button>
        <el-button type="primary" :loading="measureSaving" @click="saveMeasure">保存现场信息</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="formVisible" :title="formEditingId ? '编辑主材作业单' : '新建主材作业单'" width="min(1120px, 96vw)" destroy-on-close>
      <el-alert v-if="formError" type="error" :closable="false" :title="formError" show-icon class="sheet-workbench__alert" />
      <div class="sheet-form-grid">
        <label class="sheet-form-field sheet-form-field--wide">
          <span>项目</span>
          <ProjectPicker v-model="form.projectId" title="选择作业单所属项目" :disabled="!!formEditingId" @change="onProjectChange" />
        </label>
        <label class="sheet-form-field">
          <span>品类</span>
          <el-select v-model="form.sheetType" placeholder="选择品类">
            <el-option v-for="item in sheetTypes" :key="item.code" :label="item.name" :value="item.code" />
          </el-select>
        </label>
        <label class="sheet-form-field">
          <span>厂家 <small v-if="typeFields.some((field) => field.key === 'manufacturerName' && field.required)">必填</small></span>
          <el-input v-model="form.manufacturerName" placeholder="如：马可波罗瓷砖" />
        </label>
        <label class="sheet-form-field">
          <span>建群日期 <small v-if="typeFields.some((field) => field.key === 'groupChatAt' && field.required)">必填</small></span>
          <el-date-picker v-model="form.groupChatAt" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
        </label>
        <label v-if="fieldVisible(measureField)" class="sheet-form-field">
          <span>{{ measureField?.label || '测量时间' }} <small v-if="fieldRequired(measureField)">必填</small></span>
          <el-date-picker v-model="form.measureAt" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
        </label>
        <label v-if="fieldVisible(deliverField)" class="sheet-form-field">
          <span>{{ deliverField?.label || '配送时间' }} <small v-if="fieldRequired(deliverField)">必填</small></span>
          <el-date-picker v-model="form.deliverAt" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
        </label>
        <label v-if="fieldVisible(installField)" class="sheet-form-field">
          <span>{{ installField?.label || '安装时间' }} <small v-if="fieldRequired(installField)">必填</small></span>
          <el-date-picker v-model="form.installAt" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
        </label>
        <label class="sheet-form-field sheet-form-field--wide">
          <span>备注</span>
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit placeholder="现场约定、到货要求等" />
        </label>
      </div>

      <section class="sheet-form-section">
        <div class="sheet-form-section__head">
          <div><h3>作业单材料行</h3><p>只显示当前项目材料计划；尚未完成选材的材料暂不能加入作业单。</p></div>
          <span>{{ draftLines.length }} 行</span>
        </div>
        <div v-if="planLoading" class="sheet-form-plan-state">正在读取项目材料计划…</div>
        <el-alert v-else-if="planError" type="warning" :closable="false" :title="planError" show-icon />
        <EmptyState v-else-if="!availablePlans.length && !draftLines.length" title="当前项目没有可加入的材料计划" description="先完成合同材料计划和施工选材，再建立作业单。" />
        <div v-else class="sheet-form-plans">
          <button v-for="plan in availablePlans" :key="plan.id" type="button" class="sheet-form-plan" @click="addPlan(plan)">
            <span><strong>{{ plan.name }}</strong><small>{{ visiblePlan(plan) }}</small></span>
            <span class="sheet-form-plan__side">{{ PLAN_STATUS_LABEL[plan.status] || plan.status }} · 加入</span>
          </button>
        </div>
      </section>

      <section v-if="draftLines.length" class="sheet-form-section">
        <div class="sheet-form-section__head"><div><h3>已加入材料</h3><p>安装位置、型号、颜色、尺寸和数量是厂家作业单的实际内容。</p></div></div>
        <article v-for="(line, index) in draftLines" :key="line.materialPlanId" class="sheet-form-line">
          <header><strong>{{ line.name }}</strong><button type="button" @click="removeLine(index)">移除</button></header>
          <div class="sheet-form-line__grid">
            <label><span>安装位置</span><el-input v-model="line.locationName" placeholder="如：客厅地面" /></label>
            <label><span>空间</span><el-input v-model="line.spaceName" placeholder="如：客餐厅" /></label>
            <label><span>型号</span><el-input v-model="line.model" placeholder="型号" /></label>
            <label><span>颜色 / 花色</span><el-input v-model="line.color" placeholder="颜色或花色" /></label>
            <label><span>尺寸</span><el-input v-model="line.size" placeholder="如：800×800" /></label>
            <label><span>数量</span><el-input v-model="line.quantity" inputmode="decimal" placeholder="实际下单数量" /></label>
            <label><span>单位</span><span class="sheet-form-line__unit">{{ unitLabel(line.unit) }}</span></label>
          </div>
        </article>
      </section>

      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button :loading="formSaving" @click="saveSheet(false)">保存草稿</el-button>
        <el-button type="primary" :loading="formSaving" :disabled="!formReady" @click="saveSheet(true)">保存并提交请购</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.sheet-workbench { display: flex; flex-direction: column; gap: $space-4; padding: $space-5; }
.sheet-workbench__head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-4; }
.sheet-workbench__head h1 { margin: 0; font-size: $font-display; }
.sheet-workbench__head p { max-width: 760px; margin: $space-2 0 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.65; }
.sheet-workbench__actions { display: flex; flex-wrap: wrap; align-items: center; gap: $space-2; }
.sheet-workbench__filters { display: grid; grid-template-columns: minmax(260px, 1fr) 220px auto; align-items: end; gap: $space-3; padding: $space-4; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; }
.sheet-workbench__type { width: 220px; }
.sheet-workbench__summary { justify-self: end; color: $text-secondary; font-size: $font-body-sm; white-space: nowrap; }
.sheet-workbench__summary b { margin-left: $space-3; color: $text-primary; font-size: $font-h1; }
.sheet-workbench__summary b:first-child { margin-left: 0; }
.sheet-workbench__grid { display: grid; grid-template-columns: minmax(340px, .8fr) minmax(0, 1.2fr); gap: $space-4; align-items: start; }
.sheet-workbench__list, .sheet-workbench__detail { min-width: 0; }
.sheet-workbench__rows { display: flex; flex-direction: column; }
.sheet-workbench__row { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; width: 100%; padding: $space-3 $space-2; border: 0; border-bottom: 1px solid $border-color; background: transparent; color: $text-primary; text-align: left; cursor: pointer; }
.sheet-workbench__row:hover, .sheet-workbench__row--active { background: $brand-50; }
.sheet-workbench__row-main, .sheet-workbench__row-side { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.sheet-workbench__row-main strong { font-size: $font-body-sm; }
.sheet-workbench__row-main span, .sheet-workbench__row-main small, .sheet-workbench__row-side small { color: $text-secondary; font-size: $font-caption; }
.sheet-workbench__row-side { align-items: flex-end; flex: none; max-width: 160px; text-align: right; }
.sheet-workbench__detail-head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; padding-bottom: $space-3; border-bottom: 1px solid $border-color; }
.sheet-workbench__detail-meta { display: flex; flex-wrap: wrap; align-items: center; gap: $space-2; color: $text-secondary; font-size: $font-caption; }
.sheet-workbench__facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: $space-2; margin-top: $space-3; }
.sheet-workbench__facts div { padding: $space-3; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-50; }
.sheet-workbench__facts span, .sheet-workbench__facts b { display: block; }
.sheet-workbench__facts span { color: $text-tertiary; font-size: $font-caption; }
.sheet-workbench__facts b { margin-top: 4px; color: $text-primary; font-size: $font-body-sm; line-height: 1.45; }
.sheet-workbench__section { margin-top: $space-4; border: 1px solid $border-color; border-radius: $radius-sm; overflow: hidden; }
.sheet-workbench__section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; padding: $space-3 $space-4; border-bottom: 1px solid $border-color; }
.sheet-workbench__section-head h3 { margin: 0; font-size: $font-body-sm; }
.sheet-workbench__section-head p { margin: 4px 0 0; color: $text-tertiary; font-size: $font-caption; }
.sheet-workbench__link { padding: 0; border: 0; background: transparent; color: $brand-700; font-size: $font-caption; cursor: pointer; }
.sheet-workbench__table-wrap { overflow-x: auto; }
.sheet-workbench__table { width: 100%; border-collapse: collapse; font-size: $font-caption; }
.sheet-workbench__table th, .sheet-workbench__table td { padding: 10px 12px; border-bottom: 1px solid $border-color; text-align: left; vertical-align: top; }
.sheet-workbench__table th { background: $surface-50; color: $text-secondary; font-weight: $font-weight-semibold; }
.sheet-workbench__table td small { display: block; margin-top: 2px; color: $text-tertiary; }
.sheet-workbench__remark { margin: 0; padding: $space-4; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; white-space: pre-wrap; }
.sheet-workbench__alert { margin-bottom: $space-3; }
.sheet-form-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: $space-3; }
.sheet-form-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; color: $text-secondary; font-size: $font-caption; }
.sheet-form-field--wide { grid-column: 1 / -1; }
.sheet-form-field small { color: $text-tertiary; }
.sheet-form-field :deep(.el-date-editor), .sheet-form-field :deep(.el-select) { width: 100%; }
.sheet-form-section { margin-top: $space-4; padding-top: $space-4; border-top: 1px solid $border-color; }
.sheet-form-section__head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; margin-bottom: $space-3; }
.sheet-form-section__head h3 { margin: 0; font-size: $font-body; }
.sheet-form-section__head p { margin: 4px 0 0; color: $text-tertiary; font-size: $font-caption; }
.sheet-form-section__head > span { color: $text-secondary; font-size: $font-caption; }
.sheet-form-plan-state { padding: $space-4; color: $text-secondary; font-size: $font-body-sm; }
.sheet-form-plans { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-2; max-height: 260px; overflow: auto; }
.sheet-form-plan { display: flex; align-items: center; justify-content: space-between; gap: $space-3; padding: $space-3; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; text-align: left; cursor: pointer; }
.sheet-form-plan:hover { border-color: $brand-300; background: $brand-50; }
.sheet-form-plan span { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.sheet-form-plan strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sheet-form-plan small, .sheet-form-plan__side { color: $text-secondary; font-size: $font-caption; }
.sheet-form-plan__side { flex: none; color: $brand-700 !important; }
.sheet-form-line { margin-top: $space-3; padding: $space-3; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-50; }
.sheet-form-line header { display: flex; align-items: center; justify-content: space-between; gap: $space-3; margin-bottom: $space-3; }
.sheet-form-line header button { border: 0; background: transparent; color: $danger-500; font-size: $font-caption; cursor: pointer; }
.sheet-form-line__grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: $space-3; }
.sheet-form-line__grid label { display: flex; flex-direction: column; gap: 5px; color: $text-secondary; font-size: $font-caption; }
.sheet-form-line__unit { display: flex; align-items: center; min-height: 32px; padding: 0 $space-3; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; color: $text-primary; }
.sheet-measure__hint { margin: 0 0 $space-3; color: $text-secondary; font-size: $font-body-sm; }
.sheet-measure__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-3; }
@media (max-width: 1280px) { .sheet-workbench__grid { grid-template-columns: minmax(300px, .75fr) minmax(0, 1.25fr); } .sheet-form-line__grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 1024px) {
  .sheet-workbench { padding: $space-4; }
  .sheet-workbench__grid, .sheet-workbench__filters { grid-template-columns: 1fr; }
  .sheet-workbench__summary { justify-self: start; }
  .sheet-workbench__facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .sheet-workbench__detail-head { flex-direction: column; }
  .sheet-form-grid, .sheet-form-line__grid, .sheet-form-plans { grid-template-columns: 1fr; }
}
</style>
