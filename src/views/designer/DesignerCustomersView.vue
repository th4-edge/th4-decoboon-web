<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import StatusTag from '@/components/StatusTag.vue'
import FileUploadField from '@/components/form/FileUploadField.vue'
import CustomerFollowFormDrawer from '@/components/customer/CustomerFollowFormDrawer.vue'
import EmptyState from '@/components/EmptyState.vue'
import CustomerPropertyContext from '@/components/CustomerPropertyContext.vue'
import PropertyFormDrawer from '@/components/property/PropertyFormDrawer.vue'
import { crmApi, type CustomerPageQuery } from '@/domains/crm/api'
import type { Customer, CustomerFollow, CustomerStage } from '@/domains/crm/model'
import { propertyApi } from '@/domains/property/api'
import type { Measure, Property, PropertyStatus } from '@/domains/property/model'
import { designApi } from '@/domains/design/api'
import { instantiateTemplate, pageTemplates } from '@/domains/designtemplate/api'
import { SCOPE_LABELS, type DesignTemplate } from '@/domains/designtemplate/model'
import { portraitItemsOf } from '@/domains/crm/portrait'
import { workbenchApi } from '@/domains/workbench/api'
import type { DesignerDesignTask } from '@/domains/workbench/model'
import type { DesignScheme, DesignStatus, RequirementCategory, RequirementKind, RequirementPriority } from '@/domains/design/model'
import { REQUIREMENT_CATEGORY_OPTIONS, REQUIREMENT_PRIORITY_OPTIONS } from '@/domains/design/requirementOptions'
import type { UploadedFile } from '@/domains/file/model'
import { formatDateTime } from '@/core/format'
import type { StatusTone } from '@/core/tone'
import { useSessionStore } from '@/stores/session'

const props = defineProps<{ surface?: 'measure' }>()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const isMeasureSurface = computed(() => props.surface === 'measure')
const isStoreManager = computed(() => session.role === 'StoreManager')
const pageEyebrow = computed(() => isStoreManager.value ? '设计谈单 · 本店设计方案' : '设计谈单 · 待我设计')
const pageTitle = computed(() => isStoreManager.value ? '本店设计方案' : '待我设计')
const pageDescription = computed(() => isStoreManager.value
  ? '查看本店客户与房屋的设计方案：左侧按客户分组展示待设计房屋，选中客户和房屋后可查看方案、分项与报价推进状态。'
  : '先看今天该给哪套房屋做设计：左侧按客户分组展示已量房房屋，点击客户默认进入第一套房屋，也可直接切换具体房屋，再推进该房屋下的设计方案。')
const STAGE_META: Record<CustomerStage, { label: string; tone: StatusTone }> = {
  intention: { label: '待首联', tone: 'todo' },
  following: { label: '跟进中', tone: 'doing' },
  pendingMeasure: { label: '待量房', tone: 'info' },
  quote: { label: '方案报价', tone: 'pending' },
  sign: { label: '已签约', tone: 'done' },
  construction: { label: '施工中', tone: 'alert' },
  done: { label: '已完工', tone: 'dark' },
  lost: { label: '已流失', tone: 'closed' },
  dormant: { label: '已休眠', tone: 'muted' },
  unknown: { label: '待确认', tone: 'info' }
}

const DESIGN_STATUS_META: Record<DesignStatus, { label: string; tone: StatusTone }> = {
  draft: { label: '设计中', tone: 'doing' },
  ready: { label: '待谈单', tone: 'done' },
  presented: { label: '已讲解', tone: 'progress' },
  selected: { label: '已选中', tone: 'special' },
  archived: { label: '已归档', tone: 'muted' }
}

const STAGE_FILTERS: Array<{ value: CustomerStage | ''; label: string }> = [
  { value: '', label: '全部阶段' },
  { value: 'pendingMeasure', label: '待量房' },
  { value: 'quote', label: '方案报价' },
  { value: 'following', label: '跟进中' }
]

const DESIGN_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(DESIGN_STATUS_META).map(([key, meta]) => [key, meta.label])
)
const DESIGN_STATUS_TONES: Record<string, StatusTone> = Object.fromEntries(
  Object.entries(DESIGN_STATUS_META).map(([key, meta]) => [key, meta.tone])
)

const MEASURE_STATUS_META: Record<Measure['status'], { label: string; tone: StatusTone }> = {
  scheduled: { label: '待量房', tone: 'info' },
  completed: { label: '已量房', tone: 'done' },
  cancelled: { label: '已取消', tone: 'closed' }
}

const MEASURED_STAGE_META = { label: '已量房', tone: 'done' as StatusTone }

const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  pendingMeasure: '待量房',
  measuring: '量房中',
  measured: '已量房',
  designing: '设计中',
  quoted: '已报价',
  contracted: '已签约',
  serving: '施工中',
  completed: '已完工'
}

const PROPERTY_STATUS_TONES: Record<PropertyStatus, StatusTone> = {
  pendingMeasure: 'todo',
  measuring: 'doing',
  measured: 'done',
  designing: 'doing',
  quoted: 'pending',
  contracted: 'done',
  serving: 'alert',
  completed: 'dark'
}


const loading = ref(false)
const error = ref('')
const partialError = ref('')
const customers = ref<Customer[]>([])
const designTasks = ref<DesignerDesignTask[]>([])
const keyword = ref('')
const stageFilter = ref<CustomerStage | ''>(props.surface === 'measure' ? 'pendingMeasure' : '')
const selectedCustomerId = ref('')
const selectedCustomer = ref<Customer | null>(null)
const properties = ref<Property[]>([])
const selectedPropertyId = ref('')
const propertyFormVisible = ref(false)
const propertyFormEditing = ref<Property | null>(null)
const measures = ref<Measure[]>([])
const schemes = ref<DesignScheme[]>([])
const selectedSchemeId = ref('')
const selectedScheme = ref<DesignScheme | null>(null)
const follows = ref<CustomerFollow[]>([])
const busySchemeId = ref('')

const followVisible = ref(false)
const measureVisible = ref(false)
const measureResultVisible = ref(false)
const schemeVisible = ref(false)
const requirementVisible = ref(false)
const saving = ref(false)
const actionError = ref('')

const measureForm = reactive<{ measureAt: string }>({ measureAt: '' })

const measureResultForm = reactive<{
  measureTime: string
  originalStructure: string
  dimensions: string
  customerRequirements: string
  designerConclusion: string
}>({
  measureTime: '',
  originalStructure: '',
  dimensions: '',
  customerRequirements: '',
  designerConclusion: ''
})

const measureSiteFiles = ref<UploadedFile[]>([])
const measureStructureFiles = ref<UploadedFile[]>([])
const measureAttachmentFiles = ref<UploadedFile[]>([])

type SchemeCreateMode = 'template' | 'blank'

const schemeForm = reactive<{
  mode: SchemeCreateMode
  templateId: string
  templateVersionId: string
  templateName: string
  name: string
  style: string
  layout: string
  description: string
}>({
  mode: 'template',
  templateId: '',
  templateVersionId: '',
  templateName: '',
  name: '',
  style: '',
  layout: '',
  description: ''
})
const schemeFormRef = ref<FormInstance>()
const schemeTemplates = ref<DesignTemplate[]>([])
const schemeTemplateKeyword = ref('')
const schemeTemplateLoading = ref(false)
const schemeTemplateError = ref('')

const requirementForm = reactive<{
  kind: RequirementKind
  category: RequirementCategory
  priority: RequirementPriority
  title: string
  detail: string
  response: string
  spaceName: string
}>({
  kind: 'demand',
  category: 'function',
  priority: 'medium',
  title: '',
  detail: '',
  response: '',
  spaceName: ''
})

const selectedProperty = computed(() => properties.value.find((item) => item.id === selectedPropertyId.value) ?? null)

const selectedMeasure = computed(() => {
  const list = [...measures.value].sort((left, right) => String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')))
  return list[0] ?? null
})

const measureEvidenceCount = computed(() => {
  const measure = selectedMeasure.value
  if (!measure) return 0
  return measure.sitePhotos.length + measure.structureImages.length + measure.attachments.length
})

const requirements = computed(() => selectedScheme.value?.requirements ?? [])

/**
 * 列表状态优先使用服务端 Completed 量房事实：
 * 客户生命周期尚未推进到报价时，不能继续显示旧的「待量房」。
 */
function customerDisplayStage(customer: Customer): CustomerStage | 'measured' {
  if (customer.measured && ['intention', 'following', 'pendingMeasure'].includes(customer.stage)) return 'measured'
  return customer.stage
}

function customerStageMeta(customer: Customer): { label: string; tone: StatusTone } {
  const stage = customerDisplayStage(customer)
  return stage === 'measured' ? MEASURED_STAGE_META : STAGE_META[stage]
}

const DESIGN_TASK_STAGE: Record<string, CustomerStage> = {
  New: 'intention',
  Following: 'following',
  PendingMeasure: 'pendingMeasure',
  Quoted: 'quote',
  Signed: 'sign',
  Serving: 'construction',
  Finished: 'done',
  Lost: 'lost',
  Dormant: 'dormant'
}

const DESIGN_TASK_STATUS_TONE: Record<DesignerDesignTask['designStatus'], StatusTone> = {
  Pending: 'todo',
  Doing: 'doing',
  Done: 'done'
}

interface DesignCustomerGroup {
  customerId: string
  customerName: string
  telNo?: string
  stage: CustomerStage
  properties: DesignerDesignTask[]
}

function designTaskStage(task: DesignerDesignTask): CustomerStage {
  const mapped = task.customerStatus ? DESIGN_TASK_STAGE[task.customerStatus] : undefined
  if (mapped) return mapped
  const label = task.customerStatusName ?? ''
  if (label.includes('量房')) return 'pendingMeasure'
  if (label.includes('报价')) return 'quote'
  if (label.includes('跟进')) return 'following'
  if (label.includes('流失')) return 'lost'
  if (label.includes('休眠')) return 'dormant'
  return 'unknown'
}

function designTaskPropertyTitle(task: DesignerDesignTask): string {
  const community = task.community?.trim() || ''
  const address = task.address?.trim() || ''
  if (!community) return address || '房屋待完善'
  const detail = address.startsWith(community) ? address.slice(community.length).trim() : ''
  return detail ? `${community}「${detail}」` : community
}

function designTaskPropertyDetail(task: DesignerDesignTask): string {
  const title = designTaskPropertyTitle(task)
  const compactTitle = title.replace(/[「」\s]/g, '')
  const compactAddress = String(task.address ?? '').replace(/\s/g, '')
  const parts: string[] = []
  if (compactAddress && !compactTitle.includes(compactAddress)) parts.push(task.address ?? '')
  if (task.area) parts.push(`${task.area}㎡`)
  parts.push(task.schemeCount > 0 ? `${task.schemeCount} 套方案` : '暂无方案')
  if (task.stayDays > 0) parts.push(`停留 ${task.stayDays} 天`)
  return parts.filter(Boolean).join(' · ')
}

function firstDesignTask(group: DesignCustomerGroup): DesignerDesignTask | null {
  return group.properties[0] ?? null
}

const filteredDesignTasks = computed(() => {
  const needle = keyword.value.trim().toLowerCase()
  return designTasks.value.filter((task) => {
    if (!task.measureAt) return false
    if (stageFilter.value && designTaskStage(task) !== stageFilter.value) return false
    if (!needle) return true
    return [task.customerName, task.telNo, task.community, task.address]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle))
  })
})

/** 左侧展示分组只负责客户归组；队列成员仍是服务端返回的客户 + 房屋事实。 */
const designGroups = computed<DesignCustomerGroup[]>(() => {
  const groups = new Map<string, DesignCustomerGroup>()
  for (const task of filteredDesignTasks.value) {
    if (!task.customerId || !task.propertyId) continue
    let group = groups.get(task.customerId)
    if (!group) {
      group = {
        customerId: task.customerId,
        customerName: task.customerName || '客户待完善',
        telNo: task.telNo,
        stage: designTaskStage(task),
        properties: []
      }
      groups.set(task.customerId, group)
    }
    group.properties.push(task)
  }
  return [...groups.values()]
})

const designPropertyCount = computed(() => designGroups.value.reduce((total, group) => total + group.properties.length, 0))
const designCustomerCount = computed(() => designGroups.value.length)
const designTaskSchemeCount = computed(() => designGroups.value.reduce(
  (total, group) => total + group.properties.reduce((sum, task) => sum + task.schemeCount, 0),
  0
))

const filteredCustomers = computed(() => {
  const needle = keyword.value.trim().toLowerCase()
  return customers.value.filter((customer) => {
    if (stageFilter.value && customerDisplayStage(customer) !== stageFilter.value) return false
    if (!needle) return true
    return [customer.name, customer.phone, customer.community, customer.addr]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle))
  })
})

function propertyLabel(property: Property): string {
  const community = property.community?.trim() || ''
  const address = property.address?.trim() || ''
  const unit = [property.building, property.roomNo].filter(Boolean).join('').trim()
  const detail = address.startsWith(community) && community
    ? address.slice(community.length).trim()
    : unit
  if (community && detail) return `${community}「${detail}」`
  return community || address || '房屋待完善'
}

const selectedPropertyLabel = computed(() => selectedProperty.value
  ? propertyLabel(selectedProperty.value)
  : '房屋待选择')

function customerSubtitle(customer: Customer): string {
  return [customer.community, customer.addr].filter(Boolean).join(' · ') || '地址待补充'
}

const designStageLabel = computed(() => selectedScheme.value
  ? (DESIGN_STATUS_LABELS[selectedScheme.value.status] ?? selectedScheme.value.status)
  : '还没有方案')

/** 为什么现在处理：量房是设计的前置，缺方案/待谈单是主行动依据。 */
const designReason = computed(() => {
  const customer = selectedCustomer.value
  if (!customer) return '选择左侧客户后查看处理原因'
  if (!selectedProperty.value) return '先选择本次要设计的房屋，方案绑定具体房屋'
  if (!selectedScheme.value) return selectedMeasure.value ? '量房已完成，当前房屋还没有设计方案' : '当前房屋还没有量房记录与设计方案'
  if (selectedScheme.value.status === 'ready') return '方案已完成设计，等待与客户谈单'
  if (selectedScheme.value.status === 'presented') return '方案已讲解，等待客户选定'
  return '方案设计中，继续补充空间与设计项'
})

const nextStageLabel = computed(() => {
  const status = selectedScheme.value?.status
  if (!selectedScheme.value) return '设计工作区'
  if (status === 'draft') return '待谈单（在方案工作台推进）'
  if (status === 'ready') return '谈单 / 报价'
  if (status === 'presented') return '客户选定'
  return '合同交接'
})

const primaryDesignLabel = computed(() => selectedScheme.value ? '打开设计工作区' : '新建方案')

function primaryDesignAction(): void {
  if (selectedScheme.value) {
    void router.push(`/designer/design/${selectedScheme.value.id}`)
    return
  }
  if (!selectedProperty.value) {
    ElMessage.warning('请先选择本次要设计的房屋')
    return
  }
  openSchemeDialog()
}

function customerPortraitStyle(): string {
  return portraitItemsOf(selectedCustomer.value?.portrait).find((item) => item.key === 'style')?.value || ''
}

function defaultSchemeName(): string {
  const customerName = selectedCustomer.value?.name || '客户'
  const house = selectedProperty.value ? selectedPropertyLabel.value : '房屋'
  const value = `${customerName} · ${house} 设计方案`
  return value.length > 80 ? `${house} 设计方案` : value
}

function defaultSchemeDescription(): string {
  const house = selectedProperty.value ? selectedPropertyLabel.value : '当前房屋'
  const customerName = selectedCustomer.value?.name || '客户'
  return `围绕${customerName}的${house}创建，后续在方案工作台补充空间、尺寸和设计分项。`
}

function templateDisplayName(template: DesignTemplate): string {
  return template.currentVersion?.name || '方案模版待命名'
}

function templateAreaText(template: DesignTemplate): string {
  const version = template.currentVersion
  if (!version) return '面积待确认'
  if (version.areaMin && version.areaMax) return `${version.areaMin}–${version.areaMax}㎡`
  if (version.areaMin) return `${version.areaMin}㎡以上`
  if (version.areaMax) return `${version.areaMax}㎡以下`
  return '面积不限'
}

function normalizeMatchText(value: unknown): string {
  return String(value ?? '').replace(/\s/g, '').toLowerCase()
}

function templateMatchLabels(template: DesignTemplate): string[] {
  const property = selectedProperty.value
  const version = template.currentVersion
  if (!property || !version) return []
  const labels: string[] = []
  const layout = normalizeMatchText(property.layout)
  const houseType = normalizeMatchText(version.houseType)
  if (layout && houseType && (layout.includes(houseType) || houseType.includes(layout))) labels.push('户型匹配')
  const area = property.area
  if (area && ((version.areaMin && area >= version.areaMin) || !version.areaMin)
    && ((version.areaMax && area <= version.areaMax) || !version.areaMax)) {
    labels.push('面积匹配')
  }
  return labels
}

const filteredSchemeTemplates = computed(() => {
  const needle = schemeTemplateKeyword.value.trim().toLowerCase()
  return [...schemeTemplates.value]
    .filter((template) => {
      if (!needle) return true
      const version = template.currentVersion
      return [templateDisplayName(template), version?.houseType, version?.tags, template.remark]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    })
    .sort((left, right) => templateMatchLabels(right).length - templateMatchLabels(left).length
      || (right.usageCount ?? 0) - (left.usageCount ?? 0)
      || templateDisplayName(left).localeCompare(templateDisplayName(right), 'zh-CN'))
})

const selectedSchemeTemplate = computed(() => schemeTemplates.value.find(
  (template) => template.templateId === schemeForm.templateId
) ?? null)

const schemeRules = computed<FormRules>(() => ({
  name: [{ required: true, message: '请填写方案名称', trigger: 'blur' }],
  templateId: schemeForm.mode === 'template'
    ? [{ required: true, message: '请选择一个已发布的方案模版', trigger: 'change' }]
    : []
}))

function resetSchemeForm(): void {
  schemeTemplateKeyword.value = ''
  schemeTemplateError.value = ''
  Object.assign(schemeForm, {
    mode: 'template',
    templateId: '',
    templateVersionId: '',
    templateName: '',
    name: defaultSchemeName(),
    style: customerPortraitStyle(),
    layout: selectedProperty.value?.layout || '',
    description: defaultSchemeDescription()
  })
}

function applyTemplateDefaults(template: DesignTemplate): void {
  const version = template.currentVersion
  schemeForm.templateId = template.templateId
  schemeForm.templateVersionId = version?.versionId || ''
  schemeForm.templateName = templateDisplayName(template)
  schemeForm.name = defaultSchemeName()
  schemeForm.style = version?.tags || customerPortraitStyle()
  schemeForm.layout = selectedProperty.value?.layout || version?.houseType || ''
  schemeForm.description = `按「${templateDisplayName(template)}」模版创建，包含 ${template.roomCount ?? 0} 个区域、${template.itemCount ?? 0} 个设计项；可在方案工作台继续调整。`
}

function selectSchemeTemplate(template: DesignTemplate): void {
  if (!template.currentVersion || template.currentVersion.status !== 'Published') return
  schemeForm.mode = 'template'
  applyTemplateDefaults(template)
}

function handleSchemeModeChange(value: string | number | boolean | undefined): void {
  const mode: SchemeCreateMode = value === 'blank' ? 'blank' : 'template'
  if (mode === 'blank') {
    schemeForm.templateId = ''
    schemeForm.templateVersionId = ''
    schemeForm.templateName = ''
    schemeForm.name = defaultSchemeName()
    schemeForm.style = customerPortraitStyle()
    schemeForm.layout = selectedProperty.value?.layout || ''
    schemeForm.description = defaultSchemeDescription()
    return
  }
  const template = selectedSchemeTemplate.value ?? filteredSchemeTemplates.value[0]
  if (template) applyTemplateDefaults(template)
}

async function loadSchemeTemplates(): Promise<void> {
  schemeTemplateLoading.value = true
  schemeTemplateError.value = ''
  try {
    const page = await pageTemplates({ current: 1, size: 100, status: 'Published' })
    schemeTemplates.value = page.content
    if (!page.content.length) {
      schemeForm.mode = 'blank'
      handleSchemeModeChange('blank')
    }
  } catch (err) {
    schemeTemplates.value = []
    schemeTemplateError.value = err instanceof Error ? err.message : '方案模版暂不可确认'
  } finally {
    schemeTemplateLoading.value = false
  }
}

function openSchemeDialog(): void {
  if (!selectedProperty.value) {
    ElMessage.warning('请先选择本次要设计的房屋')
    return
  }
  resetSchemeForm()
  schemeVisible.value = true
  void loadSchemeTemplates()
}

const nextDesignTask = computed(() => {
  const list = designGroups.value.flatMap((group) => group.properties)
  const index = list.findIndex((item) => item.customerId === selectedCustomerId.value
    && item.propertyId === selectedPropertyId.value)
  if (index < 0) return list[0] ?? null
  return list[index + 1] ?? null
})


/** 把对象锚点写回路由：customerId + propertyId + schemeId（§4.8.4 与 §11）。 */
function syncQuery(): void {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(route.query)) {
    if (typeof value === 'string' && !['customerId', 'activePropertyId', 'propertyId', 'schemeId'].includes(key)) query[key] = value
  }
  if (selectedCustomerId.value) query.customerId = selectedCustomerId.value
  // 房屋锚点统一用 activePropertyId（与谈单 / 签约 / 静态入口一致）
  if (selectedPropertyId.value) query.activePropertyId = selectedPropertyId.value
  if (selectedSchemeId.value) query.schemeId = selectedSchemeId.value
  void router.replace({ query })
}

/** 从路由恢复对象锚点（深链接 / 刷新）。 */
function requestedId(key: 'customerId' | 'activePropertyId' | 'schemeId'): string {
  // 兼容历史 propertyId 写法
  if (key === 'activePropertyId') return String(route.query.activePropertyId ?? route.query.propertyId ?? '')
  return String(route.query[key] ?? '')
}

function selectCustomer(customer: Customer): void {
  selectedCustomerId.value = customer.id
  selectedPropertyId.value = ''
  measures.value = []
  selectedSchemeId.value = ''
  selectedScheme.value = null
  syncQuery()
  void loadCustomerWorkspace(customer.id)
}

function selectDesignTask(task: DesignerDesignTask): void {
  if (!task.customerId || !task.propertyId) return
  if (task.customerId === selectedCustomerId.value && task.propertyId === selectedPropertyId.value) return
  selectedCustomerId.value = task.customerId
  selectedPropertyId.value = task.propertyId
  selectedSchemeId.value = ''
  selectedScheme.value = null
  measures.value = []
  schemes.value = []
  syncQuery()
  void loadCustomerWorkspace(task.customerId, task.propertyId)
}

function selectFirstDesignTask(group: DesignCustomerGroup): void {
  const task = firstDesignTask(group)
  if (task) selectDesignTask(task)
}

function openCustomerDetail(customer: Customer): void {
  if (!customer?.id) return
  void router.push(`/designer/my-customers/${customer.id}`)
}

function openEditProperty(property: Property): void {
  propertyFormEditing.value = property
  propertyFormVisible.value = true
}

/** 新增/维护房屋后必须重新读取房屋列表，并用返回对象切到该房屋（禁止本地伪造）。 */
async function onPropertySaved(property: Property): Promise<void> {
  const customerId = selectedCustomer.value?.id
  if (customerId) await loadCustomerWorkspace(customerId, property.id)
}

function openSchemeWorkspace(scheme: DesignScheme): void {
  void router.push(`/designer/design/${scheme.id}`)
}

async function copySchemeCard(scheme: DesignScheme): Promise<void> {
  busySchemeId.value = scheme.id
  actionError.value = ''
  try {
    const copied = await designApi.copyScheme(scheme.id)
    await loadSchemes(selectedCustomerId.value, selectedPropertyId.value)
    selectedSchemeId.value = copied.id
    selectedScheme.value = copied
    syncQuery()
    await refreshDesignQueueData()
    ElMessage.success('方案已复制，点击卡片进入方案工作台继续设计')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '方案复制失败'
  } finally {
    busySchemeId.value = ''
  }
}

async function deleteSchemeCard(scheme: DesignScheme): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确认删除「${scheme.name || '方案待命名'}」？只有设计中且未生成报价或谈单记录的方案可以删除。`,
      '删除设计方案',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  busySchemeId.value = scheme.id
  actionError.value = ''
  try {
    await designApi.deleteScheme(scheme.id)
    await loadSchemes(selectedCustomerId.value, selectedPropertyId.value)
    await refreshDesignQueueData()
    ElMessage.success('方案已删除')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '方案删除失败'
  } finally {
    busySchemeId.value = ''
  }
}

function clearWorkspaceSelection(): void {
  selectedCustomerId.value = ''
  selectedCustomer.value = null
  properties.value = []
  selectedPropertyId.value = ''
  measures.value = []
  schemes.value = []
  selectedSchemeId.value = ''
  selectedScheme.value = null
  follows.value = []
}

async function refreshDesignQueueData(): Promise<void> {
  if (isMeasureSurface.value) return
  try {
    designTasks.value = await workbenchApi.designerDesignTasks()
  } catch {
    partialError.value = '待设计房屋数据暂不可确认'
  }
}

async function loadDesignTasks(): Promise<void> {
  designTasks.value = []
  designTasks.value = await workbenchApi.designerDesignTasks()
  const groups = designGroups.value
  const visibleTasks = groups.flatMap((group) => group.properties)
  const current = visibleTasks.find((task) => task.customerId === selectedCustomerId.value
    && task.propertyId === selectedPropertyId.value)
  const requestedCustomer = requestedId('customerId')
  const requestedProperty = requestedId('activePropertyId')
  const requestedGroup = requestedCustomer
    ? groups.find((group) => group.customerId === requestedCustomer)
    : undefined
  const requestedTask = requestedGroup
    ? requestedGroup.properties.find((task) => task.propertyId === requestedProperty)
      ?? requestedGroup.properties[0]
    : undefined
  const target = current ?? requestedTask ?? visibleTasks[0]
  if (target) {
    await loadCustomerWorkspace(target.customerId, target.propertyId)
  } else {
    clearWorkspaceSelection()
  }
}

async function loadCustomers(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    if (!isMeasureSurface.value) {
      await loadDesignTasks()
      return
    }
    const query: CustomerPageQuery = { keyword: keyword.value.trim() || undefined, stage: stageFilter.value || undefined, size: 200 }
    customers.value = await crmApi.pageCustomers(query)
    const visible = filteredCustomers.value
    const requestedCustomer = requestedId('customerId')
    const target = visible.find((item) => item.id === requestedCustomer) ?? visible[0]
    if (!selectedCustomerId.value && target) {
      await loadCustomerWorkspace(target.id)
    } else if (selectedCustomerId.value && !visible.some((item) => item.id === selectedCustomerId.value)) {
      clearWorkspaceSelection()
    }
  } catch (err) {
    if (!isMeasureSurface.value) clearWorkspaceSelection()
    error.value = err instanceof Error ? err.message : (isMeasureSurface.value ? '客户列表暂不可确认' : '待设计房屋暂不可确认')
  } finally {
    loading.value = false
  }
}

async function loadCustomerWorkspace(customerId: string, preferredPropertyId = ''): Promise<void> {
  selectedCustomerId.value = customerId
  selectedCustomer.value = null
  follows.value = []
  partialError.value = ''
  loading.value = true
  try {
    const [customerResult, propertyResult, followResult] = await Promise.allSettled([
      crmApi.customerInfo(customerId),
      propertyApi.listProperties(customerId),
      crmApi.customerFollows(customerId)
    ])
    if (customerResult.status === 'fulfilled') selectedCustomer.value = customerResult.value
    if (propertyResult.status === 'fulfilled') {
      properties.value = propertyResult.value
      const nextPropertyId = preferredPropertyId || selectedPropertyId.value || requestedId('activePropertyId')
      selectedPropertyId.value = properties.value.some((item) => item.id === nextPropertyId)
        ? nextPropertyId
        : (properties.value[0]?.id ?? '')
    } else {
      properties.value = []
      selectedPropertyId.value = ''
    }
    if (followResult.status === 'fulfilled') follows.value = followResult.value
    const rejected = [customerResult, propertyResult, followResult].filter((item) => item.status === 'rejected')
    if (rejected.length) partialError.value = '部分客户与设计数据加载失败，当前页面可能不完整，请刷新重试。'
    if (selectedPropertyId.value) {
      await Promise.all([
        loadMeasures(selectedPropertyId.value),
        loadSchemes(customerId, selectedPropertyId.value)
      ])
    } else {
      measures.value = []
      schemes.value = []
      selectedSchemeId.value = ''
      selectedScheme.value = null
    }
    syncQuery()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '客户与设计工作区暂不可确认'
  } finally {
    loading.value = false
  }
}

async function loadMeasures(propertyId: string): Promise<void> {
  try {
    measures.value = await propertyApi.listMeasures(propertyId)
  } catch {
    measures.value = []
    partialError.value = '量房数据暂不可确认'
  }
}

async function loadSchemes(customerId: string, propertyId = selectedPropertyId.value): Promise<void> {
  if (!customerId) return
  try {
    const all = await designApi.listSchemes(customerId)
    // 方案绑定「客户 + 房屋」：只保留当前房屋的方案，避免多房屋的方案混在一起
    schemes.value = propertyId ? all.filter((item) => String(item.propertyId ?? '') === String(propertyId)) : all
    const requestedScheme = requestedId('schemeId')
    const current = schemes.value.find((item) => item.id === requestedScheme)
      ?? schemes.value[0]
      ?? null
    selectedSchemeId.value = current?.id ?? ''
    selectedScheme.value = current
    if (current) await loadSchemeDetail(current.id)
  } catch {
    schemes.value = []
    selectedSchemeId.value = ''
    selectedScheme.value = null
  }
}

async function loadSchemeDetail(designId: string): Promise<void> {
  try {
    selectedScheme.value = await designApi.schemeInfo(designId)
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '设计方案详情暂不可确认'
  }
}

async function onFollowSaved(): Promise<void> {
  if (!selectedCustomer.value) return
  follows.value = await crmApi.customerFollows(selectedCustomer.value.id)
}

async function scheduleMeasure(): Promise<void> {
  if (!selectedCustomer.value || !selectedProperty.value || !measureForm.measureAt) return
  saving.value = true
  actionError.value = ''
  try {
    await crmApi.scheduleMeasure(selectedCustomer.value.id, selectedProperty.value.id, measureForm.measureAt)
    measureVisible.value = false
    measureForm.measureAt = ''
    await loadCustomerWorkspace(selectedCustomer.value.id)
    ElMessage.success('量房已安排')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '量房安排失败'
  } finally {
    saving.value = false
  }
}

function resetMeasureFiles(): void {
  measureSiteFiles.value = []
  measureStructureFiles.value = []
  measureAttachmentFiles.value = []
}

function openMeasureResult(): void {
  resetMeasureFiles()
  measureResultVisible.value = true
}

async function saveMeasureResult(): Promise<void> {
  if (!selectedProperty.value) return
  saving.value = true
  actionError.value = ''
  try {
    await propertyApi.saveMeasure({
      propertyId: selectedProperty.value.id,
      measureTime: measureResultForm.measureTime || undefined,
      status: 'completed',
      originalStructure: measureResultForm.originalStructure || undefined,
      dimensions: measureResultForm.dimensions || undefined,
      customerRequirements: measureResultForm.customerRequirements || undefined,
      designerConclusion: measureResultForm.designerConclusion || undefined,
      sitePhotos: measureSiteFiles.value.map((file) => file.path),
      structureImages: measureStructureFiles.value.map((file) => file.path),
      attachments: measureAttachmentFiles.value.map((file) => file.path)
    })
    measureResultVisible.value = false
    resetMeasureFiles()
    await loadMeasures(selectedProperty.value.id)
    ElMessage.success('量房结论已保存')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '量房结论保存失败'
  } finally {
    saving.value = false
  }
}

async function createScheme(): Promise<void> {
  if (!selectedCustomer.value || !selectedProperty.value) return
  try {
    await schemeFormRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  actionError.value = ''
  const customerId = selectedCustomer.value.id
  const propertyId = selectedProperty.value.id
  try {
    let scheme: DesignScheme
    if (schemeForm.mode === 'template') {
      const instantiated = await instantiateTemplate({
        templateId: schemeForm.templateId,
        versionId: schemeForm.templateVersionId || undefined,
        propertyId,
        name: schemeForm.name.trim()
      })
      await designApi.saveScheme({
        designId: instantiated.designId,
        customerId,
        propertyId,
        name: schemeForm.name.trim(),
        style: schemeForm.style.trim(),
        layout: schemeForm.layout.trim(),
        description: schemeForm.description.trim()
      })
      scheme = await designApi.schemeInfo(instantiated.designId)
    } else {
      scheme = await designApi.saveScheme({
        customerId,
        propertyId,
        name: schemeForm.name.trim(),
        style: schemeForm.style.trim(),
        layout: schemeForm.layout.trim(),
        description: schemeForm.description.trim()
      })
    }
    schemeVisible.value = false
    const allSchemes = await designApi.listSchemes(customerId)
    schemes.value = allSchemes.filter((item) => String(item.propertyId ?? '') === String(propertyId))
    selectedSchemeId.value = scheme.id
    selectedScheme.value = scheme
    syncQuery()
    await refreshDesignQueueData()
    ElMessage.success(schemeForm.mode === 'template' ? '方案已按模版创建，进入方案工作台继续设计' : '空白方案已创建，进入方案工作台继续设计')
    await router.push(`/designer/design/${scheme.id}`)
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '设计方案创建失败'
  } finally {
    saving.value = false
  }
}

async function saveRequirement(): Promise<void> {
  if (!selectedCustomer.value || !selectedScheme.value || !requirementForm.title.trim()) return
  saving.value = true
  actionError.value = ''
  try {
    await designApi.saveRequirement({
      customerId: selectedCustomer.value.id,
      propertyId: selectedProperty.value?.id,
      kind: requirementForm.kind,
      category: requirementForm.category,
      priority: requirementForm.priority,
      title: requirementForm.title.trim(),
      detail: requirementForm.detail || undefined,
      response: requirementForm.response || undefined,
      spaceName: requirementForm.spaceName || undefined
    })
    requirementVisible.value = false
    requirementForm.title = ''
    requirementForm.detail = ''
    requirementForm.response = ''
    requirementForm.spaceName = ''
    await loadSchemeDetail(selectedScheme.value.id)
    await refreshDesignQueueData()
    ElMessage.success('设计诉求已记录')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '设计诉求保存失败'
  } finally {
    saving.value = false
  }
}

watch(() => props.surface, (surface) => {
  stageFilter.value = surface === 'measure' ? 'pendingMeasure' : ''
  void loadCustomers()
})

onMounted(loadCustomers)
</script>

<template>
  <div class="cd">
    <header class="cd__head">
      <div>
        <p class="cd__eyebrow">{{ pageEyebrow }}</p>
        <h1>{{ pageTitle }}</h1>
        <p>{{ pageDescription }}</p>
      </div>
      <div class="cd__head-meta">
        <span><b>{{ designPropertyCount }}</b> 套待设计</span>
        <span>{{ designCustomerCount }} 位客户 · 方案 {{ designTaskSchemeCount }} 套</span>
        <button type="button" :class="{ 'is-loading': loading }" @click="loadCustomers">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.3M21 3v6h-6" /></svg>
          刷新
        </button>
      </div>
    </header>

    <section class="cd__tools" aria-label="待设计筛选">
      <label class="cd__search">
        <span>搜索</span>
        <input v-model="keyword" type="search" placeholder="客户、手机号、小区或地址" @keyup.enter="loadCustomers" />
      </label>
      <div class="cd__filters">
        <button
          v-for="item in STAGE_FILTERS"
          :key="item.value"
          type="button"
          :class="{ active: stageFilter === item.value }"
          @click="stageFilter = item.value; loadCustomers()"
        >{{ item.label }}</button>
      </div>
    </section>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <el-alert v-if="partialError" type="warning" :closable="false" :title="partialError" show-icon />
    <el-alert v-if="actionError" type="error" :closable="false" :title="actionError" show-icon />

    <div class="cd__layout">
      <aside class="cd__pool">
        <div class="cd__pool-head">
          <strong>{{ isMeasureSurface ? '待量房客户' : '待设计房屋' }}</strong>
          <small v-if="!isMeasureSurface">按客户分组，默认选中首套房屋</small>
          <span v-if="isMeasureSurface">{{ filteredCustomers.length }} 位</span>
          <span v-else>{{ designPropertyCount }} 套 · {{ designCustomerCount }} 位</span>
        </div>

        <template v-if="isMeasureSurface">
          <div v-if="loading && !customers.length" class="cd__loading"><el-skeleton :rows="6" animated /></div>
          <EmptyState v-else-if="!filteredCustomers.length" title="当前没有待量房客户" description="已量房客户会从队列移出；可刷新当前数据，或回到我的客户选择其他客户。" action-text="刷新" @action="loadCustomers" />
          <button
            v-for="customer in filteredCustomers"
            v-else
            :key="customer.id"
            type="button"
            class="cd__customer"
            :class="{ active: customer.id === selectedCustomerId }"
            @click="selectCustomer(customer)"
          >
            <span class="cd__customer-top">
              <strong>{{ customer.name || '客户待完善' }}</strong>
              <StatusTag :tone="customerStageMeta(customer).tone" :text="customerStageMeta(customer).label" />
            </span>
            <span>{{ customerSubtitle(customer) }}</span>
            <span class="cd__customer-foot">
              <small>{{ customer.phone || '电话待补充' }}</small>
              <b v-if="customer.grade">{{ customer.grade }} 级</b>
            </span>
          </button>
        </template>

        <template v-else>
          <div v-if="loading && !designTasks.length" class="cd__loading"><el-skeleton :rows="6" animated /></div>
          <EmptyState
            v-else-if="!designGroups.length"
            title="当前没有待设计房屋"
            description="待设计队列只接收已完成量房、尚未签约或终结的房屋；可按客户或房屋筛选，或刷新当前数据。"
            action-text="刷新"
            @action="loadCustomers"
          />
          <article
            v-for="group in designGroups"
            v-else
            :key="group.customerId"
            class="cd__customer-group"
            :class="{ active: group.customerId === selectedCustomerId }"
          >
            <button type="button" class="cd__customer-group-head" @click="selectFirstDesignTask(group)">
              <span class="cd__customer-top">
                <strong>{{ group.customerName }}</strong>
                <StatusTag :tone="STAGE_META[group.stage].tone" :text="STAGE_META[group.stage].label" />
              </span>
              <span class="cd__customer-foot">
                <small>{{ group.telNo || '电话待补充' }}</small>
                <b>{{ group.properties.length }} 套房屋</b>
              </span>
            </button>
            <div class="cd__property-list">
              <button
                v-for="task in group.properties"
                :key="task.propertyId"
                type="button"
                class="cd__property-task"
                :class="{ active: task.customerId === selectedCustomerId && task.propertyId === selectedPropertyId }"
                @click="selectDesignTask(task)"
              >
                <span class="cd__property-task-top">
                  <strong>{{ designTaskPropertyTitle(task) }}</strong>
                  <StatusTag :tone="DESIGN_TASK_STATUS_TONE[task.designStatus]" :text="task.designStatusName" :dot="false" />
                </span>
                <small>{{ designTaskPropertyDetail(task) }}</small>
                <span class="cd__property-task-foot">
                  <span>{{ task.measureAt ? `已量房 ${task.measureAt.slice(0, 10)}` : '量房待确认' }}</span>
                  <b>{{ task.hasRequirement ? '诉求已录' : '待录诉求' }}</b>
                </span>
              </button>
            </div>
          </article>
        </template>
      </aside>

      <main class="cd__workspace">
        <template v-if="selectedCustomer">
          <!-- 唯一 Hero：客户为基准形态；当前方案以「标题行追加」进入 -->
          <CustomerHeroCard
            :customer="selectedCustomer"
            portrait-title="客户画像"
            portrait-hint="设计前先对齐需求、预算与决策方式"
          >
            <template #title-prefix>
              <span class="cd__hero-object">{{ selectedPropertyLabel }}</span>
            </template>
            <template #title-extra>
              <template v-if="selectedScheme">
                <span class="cd__hero-sep">·</span>
                <span class="cd__hero-scheme">{{ selectedScheme.name || '方案待命名' }} V{{ selectedScheme.version }}</span>
                <StatusTag :tone="DESIGN_STATUS_META[selectedScheme.status].tone" :text="DESIGN_STATUS_META[selectedScheme.status].label" :dot="false" />
              </template>
            </template>
            <template #focus>
              <HeroFocusItem
                label="方案阶段"
                :value="selectedScheme ? DESIGN_STATUS_META[selectedScheme.status].label : '还没有方案'"
                :note="selectedScheme ? '设计中 → 待谈单 → 已讲解 → 已选中' : '先在当前房屋下新建方案'"
                :tone="selectedScheme ? DESIGN_STATUS_META[selectedScheme.status].tone : 'pending'"
              />
              <HeroFocusItem
                label="设计进度"
                :value="selectedScheme ? `${selectedScheme.spaceCount} 个空间 · ${selectedScheme.itemCount} 个设计项` : '暂无数据'"
                note="空间与设计项是方案与报价的基础"
                tone="info"
              />
              <HeroFocusItem
                label="量房输入"
                :value="selectedMeasure ? (formatDateTime(selectedMeasure.measureTime || selectedMeasure.createdAt) || '已登记') : '还没有量房记录'"
                :note="selectedMeasure ? '量房结论已作为设计输入' : '没有量房不得伪装方案完成'"
              />
            </template>
            <template #portrait-action>
              <button class="cd__text-button" type="button" @click="openCustomerDetail(selectedCustomer)">完整档案</button>
            </template>
          </CustomerHeroCard>

          <section class="cd__properties">
            <div class="cd__section-head">
              <div><h4>房屋</h4><p>当前设计只围绕左侧选中的这套房屋；量房信息已并入房屋卡片。</p></div>
              <div class="cd__section-actions">
                <el-button size="small" :disabled="!selectedProperty" @click="openMeasureResult">{{ selectedMeasure ? '更新量房结论' : '登记量房结论' }}</el-button>
                <el-button size="small" :disabled="!selectedProperty" @click="selectedProperty && openEditProperty(selectedProperty)">维护当前房屋</el-button>
              </div>
            </div>

            <div v-if="selectedProperty" class="cd__property-summary">
              <div class="cd__property-summary-main">
                <small>当前房屋</small>
                <b>{{ selectedPropertyLabel }}</b>
                <span>{{ selectedProperty.address || '地址待补充' }}</span>
              </div>
              <div><small>面积</small><b>{{ selectedProperty.area ? `${selectedProperty.area}㎡` : '待补充' }}</b></div>
              <div><small>户型</small><b>{{ selectedProperty.layout || '待补充' }}</b></div>
              <div><small>状态</small><StatusTag :tone="PROPERTY_STATUS_TONES[selectedProperty.status]" :text="PROPERTY_STATUS_LABELS[selectedProperty.status]" :dot="false" /></div>
            </div>
            <div v-else class="cd__inline-empty">请从左侧选择一套房屋后继续设计。</div>

            <div v-if="selectedMeasure" class="cd__property-measure">
              <div class="cd__property-measure-top">
                <div>
                  <small>量房输入</small>
                  <b>{{ formatDateTime(selectedMeasure.measureTime || selectedMeasure.createdAt) || '量房时间待确认' }}</b>
                </div>
                <StatusTag :tone="MEASURE_STATUS_META[selectedMeasure.status].tone" :text="MEASURE_STATUS_META[selectedMeasure.status].label" :dot="false" />
                <div><small>现场证据</small><b>{{ measureEvidenceCount }} 项</b></div>
              </div>
              <p class="cd__property-measure-conclusion">
                <strong>设计师结论</strong>
                <span>{{ selectedMeasure.designerConclusion || '量房结论待补充；推进方案前应补齐结构、尺寸和现场问题。' }}</span>
              </p>
              <details v-if="selectedMeasure.originalStructure || selectedMeasure.dimensions || selectedMeasure.customerRequirements" class="cd__property-measure-details">
                <summary>查看量房原始记录</summary>
                <dl>
                  <div><dt>原始结构</dt><dd>{{ selectedMeasure.originalStructure || '暂不可确认' }}</dd></div>
                  <div><dt>尺寸记录</dt><dd>{{ selectedMeasure.dimensions || '暂不可确认' }}</dd></div>
                  <div><dt>客户诉求</dt><dd>{{ selectedMeasure.customerRequirements || '暂不可确认' }}</dd></div>
                </dl>
              </details>
            </div>
            <div v-else class="cd__property-measure-empty">当前房屋还没有完成量房，量房完成并登记结论后才会成为设计输入。</div>
          </section>

          <section class="cd__schemes">
            <div class="cd__section-head">
              <div><h4>设计方案</h4><p>同一房屋可有多个方案；卡片只展示状态变迁，点击卡片进入方案工作台完成设计、推进和报价。</p></div>
              <el-button size="small" type="primary" :disabled="!selectedProperty" @click="openSchemeDialog">新建方案</el-button>
            </div>
            <div v-if="!schemes.length" class="cd__inline-empty">当前房屋还没有设计方案，可新建方案；已有方案可复制后再调整。</div>
            <DesignSchemeRail
              v-else
              :schemes="schemes"
              :selected-id="selectedSchemeId"
              :status-labels="DESIGN_STATUS_LABELS"
              :status-tones="DESIGN_STATUS_TONES"
              :busy-id="busySchemeId"
              @open="openSchemeWorkspace"
              @copy="copySchemeCard"
              @delete="deleteSchemeCard"
            />
          </section>

          <CustomerContextPanels
            :requirements="requirements"
            :follows="follows"
            emphasis="normal"
            :requirement-limit="2"
            :follow-limit="2"
            :can-record-follow="false"
            @record-requirement="requirementVisible = true"
          />



        </template>
        <EmptyState v-else title="请选择一位客户" description="客户列表来自系统，选中后才能查看房屋、量房和设计方案。" />
      </main>

      <aside class="cd__context">
        <template v-if="selectedCustomer">
          <section class="cd__guide-card cd__guide-card--primary">
            <div class="cd__guide-title-row">
              <div>
                <p class="cd__eyebrow">本次设计</p>
                <h3>{{ designStageLabel }}</h3>
              </div>
              <span class="cd__guide-order">{{ selectedScheme ? `V${selectedScheme.version}` : '—' }}</span>
            </div>
            <p class="cd__guide-reason">{{ designReason }}</p>
            <div class="cd__guide-inline"><span>下一步</span><b>{{ nextStageLabel }}</b></div>
            <button type="button" class="cd__primary" @click="primaryDesignAction">{{ primaryDesignLabel }}</button>
            <p class="cd__guide-note">方案完成并标记「待谈单」后，会出现在待我谈单队列，由设计师与客户谈单。</p>
            <div v-if="nextDesignTask" class="cd__next-inline">
              <span>下一套</span>
              <button type="button" @click="selectDesignTask(nextDesignTask)">查看下一项</button>
            </div>
          </section>

          <section class="cd__guide-card">
            <header class="cd__actions-head"><div><h4>其他可执行操作</h4><small>在当前页面完成，不需要再搜索同一位客户</small></div></header>
            <div class="cd__action-grid">
              <WorkbenchQuickAction tone="brand" title="写跟进" hint="记录本次沟通与下次联系" @click="followVisible = true">
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v14H4z" /><path d="M8 9h8M8 13h5" /></svg></template>
              </WorkbenchQuickAction>
              <WorkbenchQuickAction tone="measure" title="安排量房" :hint="selectedProperty ? '约定上门量房时间' : '先选择房屋'" :disabled="!selectedProperty" @click="measureVisible = true">
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.6 7-12a7 7 0 1 0-14 0c0 6.4 7 12 7 12Z" /><path d="M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" /></svg></template>
              </WorkbenchQuickAction>
              <WorkbenchQuickAction tone="requirement" title="客户诉求" hint="记录客户的诉求与排斥点" @click="requirementVisible = true">
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v14H4z" /><path d="M8 9h8M8 13h8M8 17h4" /></svg></template>
              </WorkbenchQuickAction>
              <WorkbenchQuickAction tone="outline" title="完整档案" hint="查看历史与低频资料" @click="openCustomerDetail(selectedCustomer)">
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h5M8 16h8" /></svg></template>
              </WorkbenchQuickAction>
            </div>
          </section>
        </template>

        <WorkbenchState
          v-else
          title="等待选择客户"
          description="左侧队列只收已量房、尚未签约的客户；选中后右侧显示当前阶段、主要动作与下一步。"
          min-height="300px"
        />
      </aside>
    </div>

    <CustomerFollowFormDrawer v-model="followVisible" :customer="selectedCustomer" :property="selectedProperty" @saved="onFollowSaved" />

    <el-dialog v-model="measureVisible" title="安排量房" width="480px" append-to-body>
      <CustomerPropertyContext :customer="selectedCustomer" :property="selectedProperty" />
      <el-form label-position="top">
        <el-form-item label="量房时间"><el-date-picker v-model="measureForm.measureAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" /></el-form-item>
      </el-form>
      <el-alert type="info" :closable="false" title="量房安排会写回客户主链，量房结论由设计师完成量房后登记。" show-icon />
      <template #footer><el-button @click="measureVisible = false">取消</el-button><el-button type="primary" :loading="saving" :disabled="!measureForm.measureAt" @click="scheduleMeasure">确认安排</el-button></template>
    </el-dialog>

    <el-dialog v-model="measureResultVisible" title="登记量房结论" width="680px" append-to-body>
      <CustomerPropertyContext :customer="selectedCustomer" :property="selectedProperty" />
      <el-form label-position="top" class="cd__dialog-grid">
        <el-form-item label="量房时间"><el-date-picker v-model="measureResultForm.measureTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" /></el-form-item>
        <el-form-item label="原始结构" class="cd__dialog-wide"><el-input v-model="measureResultForm.originalStructure" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="尺寸记录" class="cd__dialog-wide"><el-input v-model="measureResultForm.dimensions" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="客户诉求" class="cd__dialog-wide"><el-input v-model="measureResultForm.customerRequirements" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="设计师结论" class="cd__dialog-wide"><el-input v-model="measureResultForm.designerConclusion" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="现场照片" class="cd__dialog-wide">
          <FileUploadField
            v-model="measureSiteFiles"
            business-type="Measure"
            label="现场照片"
            hint="点击缩略图可放大预览"
            accept="image/*"
            :max="9"
            @error="actionError = $event"
          />
        </el-form-item>
        <el-form-item label="结构 / 图纸" class="cd__dialog-wide">
          <FileUploadField
            v-model="measureStructureFiles"
            business-type="Measure"
            label="结构 / 图纸"
            hint="图片可点击预览，PDF 新窗口打开"
            accept="image/*,.pdf"
            :max="9"
            @error="actionError = $event"
          />
        </el-form-item>
        <el-form-item label="其他附件" class="cd__dialog-wide">
          <FileUploadField
            v-model="measureAttachmentFiles"
            business-type="Measure"
            label="其他附件"
            hint="其他量房资料，单次最多 9 个"
            accept="*/*"
            :max="9"
            @error="actionError = $event"
          />
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="measureResultVisible = false">取消</el-button><el-button type="primary" :loading="saving" @click="saveMeasureResult">保存量房结论</el-button></template>
    </el-dialog>

    <el-drawer
      v-model="schemeVisible"
      title="新建设计方案"
      size="760px"
      direction="rtl"
      append-to-body
      :close-on-click-modal="false"
    >
      <div class="cd__scheme-form">
        <section class="cd__form-section">
          <header class="cd__form-section-head">
            <div><h4>业务上下文</h4><p>方案自动绑定当前客户与房屋，避免选错对象。</p></div>
          </header>
          <CustomerPropertyContext :customer="selectedCustomer" :property="selectedProperty" />
        </section>

        <el-form ref="schemeFormRef" :model="schemeForm" :rules="schemeRules" label-position="top">
          <section class="cd__form-section">
            <header class="cd__form-section-head">
              <div><h4>创建方式</h4><p>优先使用方案模版；没有合适模版时再创建空白方案。</p></div>
            </header>
            <el-form-item label="创建方式">
              <el-radio-group v-model="schemeForm.mode" @change="handleSchemeModeChange">
                <el-radio-button value="template">按方案模版创建</el-radio-button>
                <el-radio-button value="blank">创建空白方案</el-radio-button>
              </el-radio-group>
            </el-form-item>
          </section>

          <section v-if="schemeForm.mode === 'template'" class="cd__form-section">
            <header class="cd__form-section-head">
              <div><h4>方案模版</h4><p>只展示已发布且当前员工可见的模版；匹配当前房屋的模版优先排列。</p></div>
              <el-button text type="primary" @click="router.push('/designer/templates')">方案模版库</el-button>
            </header>
            <el-form-item prop="templateId" label="选择方案模版">
              <div class="cd__template-picker">
                <el-input v-model="schemeTemplateKeyword" clearable placeholder="搜索模版名称、房型或标签" />
                <el-alert v-if="schemeTemplateError" type="warning" :closable="false" show-icon :title="schemeTemplateError" />
                <div v-loading="schemeTemplateLoading" class="cd__template-list">
                  <el-empty v-if="!schemeTemplateLoading && !filteredSchemeTemplates.length" description="当前没有可用方案模版" :image-size="72">
                    <el-button @click="handleSchemeModeChange('blank')">改为创建空白方案</el-button>
                  </el-empty>
                  <button
                    v-for="template in filteredSchemeTemplates"
                    v-else
                    :key="template.templateId"
                    type="button"
                    class="cd__template-card"
                    :class="{ active: template.templateId === schemeForm.templateId }"
                    @click="selectSchemeTemplate(template)"
                  >
                    <span class="cd__template-card-head">
                      <strong>{{ templateDisplayName(template) }}</strong>
                      <StatusTag tone="info" :text="SCOPE_LABELS[template.scope]" :dot="false" />
                    </span>
                    <small>{{ template.currentVersion?.houseType || '房型不限' }} · {{ templateAreaText(template) }}</small>
                    <span v-if="template.currentVersion?.tags" class="cd__template-tags">{{ template.currentVersion.tags }}</span>
                    <span class="cd__template-meta">{{ template.roomCount ?? 0 }} 个区域 · {{ template.itemCount ?? 0 }} 个设计项 · 已使用 {{ template.usageCount ?? 0 }} 次</span>
                    <span v-if="templateMatchLabels(template).length" class="cd__template-match">{{ templateMatchLabels(template).join(' · ') }}</span>
                  </button>
                </div>
              </div>
            </el-form-item>
          </section>

          <section class="cd__form-section">
            <header class="cd__form-section-head">
              <div><h4>方案基础信息</h4><p>已按客户画像和房屋信息预填，可按本次设计目标调整。</p></div>
            </header>
            <el-form-item label="方案名称" prop="name">
              <el-input v-model="schemeForm.name" maxlength="80" show-word-limit />
            </el-form-item>
            <div class="cd__dialog-grid">
              <el-form-item label="风格">
                <el-input v-model="schemeForm.style" maxlength="40" placeholder="默认取客户画像风格或模版标签" />
              </el-form-item>
              <el-form-item label="户型">
                <el-input v-model="schemeForm.layout" maxlength="40" placeholder="默认取当前房屋户型" />
              </el-form-item>
              <el-form-item label="方案说明" class="cd__dialog-wide">
                <el-input v-model="schemeForm.description" type="textarea" :rows="4" maxlength="500" show-word-limit />
              </el-form-item>
            </div>
          </section>
        </el-form>
      </div>
      <template #footer>
        <div class="cd__drawer-footer">
          <el-button @click="schemeVisible = false">取消</el-button>
          <el-button type="primary" :loading="saving" :disabled="schemeForm.mode === 'template' && !schemeForm.templateId" @click="createScheme">
            {{ schemeForm.mode === 'template' ? '按模版创建并进入' : '创建空白方案并进入' }}
          </el-button>
        </div>
      </template>
    </el-drawer>

    <el-dialog v-model="requirementVisible" title="记录设计诉求" width="620px" append-to-body>
      <CustomerPropertyContext :customer="selectedCustomer" :property="selectedProperty" :scheme-name="selectedScheme?.name || ''" />
      <el-form label-position="top" class="cd__dialog-grid">
        <el-form-item label="诉求类型"><el-select v-model="requirementForm.kind" style="width: 100%"><el-option label="诉求" value="demand" /><el-option label="排斥点" value="reject" /></el-select></el-form-item>
        <el-form-item label="分类"><el-select v-model="requirementForm.category" style="width: 100%"><el-option v-for="item in REQUIREMENT_CATEGORY_OPTIONS" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item>
        <el-form-item label="优先级"><el-select v-model="requirementForm.priority" style="width: 100%"><el-option v-for="item in REQUIREMENT_PRIORITY_OPTIONS" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item>
        <el-form-item label="空间"><el-input v-model="requirementForm.spaceName" placeholder="如客厅 / 主卧，可留空" /></el-form-item>
        <el-form-item label="标题" class="cd__dialog-wide"><el-input v-model="requirementForm.title" maxlength="80" /></el-form-item>
        <el-form-item label="详细说明" class="cd__dialog-wide"><el-input v-model="requirementForm.detail" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="设计回应" class="cd__dialog-wide"><el-input v-model="requirementForm.response" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="requirementVisible = false">取消</el-button><el-button type="primary" :loading="saving" :disabled="!requirementForm.title.trim()" @click="saveRequirement">保存诉求</el-button></template>
    </el-dialog>
  </div>
    <PropertyFormDrawer
      v-model="propertyFormVisible"
      :customer-id="selectedCustomer?.id ?? ''"
      :customer-name="selectedCustomer?.name ?? ''"
      :property="propertyFormEditing"
      @saved="onPropertySaved"
    />

</template>

<style scoped lang="scss">
.cd {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: $space-5;
}

.cd__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-5;

  h2 { margin: $space-1 0; font-size: $font-display; }
  p { margin: 0; max-width: 760px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
}

.cd__eyebrow {
  color: $brand-600 !important;
  font-size: $font-caption !important;
  font-weight: $font-weight-semibold;
  letter-spacing: .1em;
}

.cd__head-meta { display: flex; align-items: center; flex-wrap: wrap; gap: $space-3; color: $text-secondary; font-size: $font-caption; }
.cd__head-meta b { color: $brand-700; font-size: $font-title; }
.cd__head-meta button { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; color: $text-secondary; font: inherit; cursor: pointer; }
.cd__head-meta button:hover { color: $brand-600; border-color: $brand-300; background: $brand-50; }
.cd__head-meta svg { width: 14px; height: 14px; }
.cd__head-meta .is-loading svg { animation: cd-spin .7s linear infinite; }
@keyframes cd-spin { to { transform: rotate(360deg); } }

.cd__tools { display: flex; align-items: flex-end; justify-content: space-between; gap: $space-3; padding: $space-3; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.cd__search { display: flex; flex-direction: column; gap: 6px; min-width: 260px; color: $text-secondary; font-size: $font-caption; }
.cd__search input { height: 36px; padding: 0 10px; border: 1px solid $border-color; border-radius: $radius-sm; color: $text-primary; background: $surface-0; font: inherit; }
.cd__filters { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.cd__filters button { padding: 7px 11px; border: 1px solid $border-color; border-radius: $radius-pill; background: $surface-0; color: $text-secondary; font: inherit; font-size: $font-caption; cursor: pointer; }
.cd__filters button.active { border-color: $brand-300; background: $brand-50; color: $brand-700; }

.cd__filters {
  display: flex;
  gap: $space-2;
  min-width: 520px;
}

.cd__layout {
  display: grid;
  grid-template-columns: 290px minmax(0, 1fr) 300px;
  gap: $space-4;
  align-items: start;
}

.cd__pool,
.cd__context {
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  box-shadow: $shadow-card;
}

.cd__pool,
.cd__context { position: sticky; top: $space-4; max-height: calc(100vh - #{$topbar-height} - #{$space-8}); overflow: auto; }

.cd__pool-head,
.cd__section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-3;
  padding: $space-4;
  border-bottom: 1px solid $border-color;

  h4 { margin: 0 0 $space-1; font-size: $font-title; }
  p { margin: 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
}

.cd__pool-head span {
  color: $text-tertiary;
  font-size: $font-caption;
}

.cd__customer {
  width: 100%;
  padding: $space-3 $space-4;
  border: 0;
  border-bottom: 1px solid $border-color;
  background: transparent;
  text-align: left;
  cursor: pointer;

  &:hover,
  &.active { background: $brand-50; }
  > span { display: block; margin-top: $space-1; color: $text-secondary; font-size: $font-caption; }
}

.cd__customer-top,
.cd__customer-foot {
  display: flex !important;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;
}

.cd__customer-top strong { color: $text-primary; font-size: $font-body; }
.cd__customer-foot b { color: $brand-700; }

.cd__customer-group {
  border-bottom: 1px solid $border-color;

  &.active { background: linear-gradient(135deg, $surface-0, $brand-50); }
}

.cd__customer-group-head {
  display: flex;
  flex-direction: column;
  gap: $space-1;
  width: 100%;
  padding: $space-3 $space-4;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;

  &:hover { background: $brand-50; }
}

.cd__property-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 $space-3 $space-3;
}

.cd__property-task {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
  padding: 10px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-0;
  color: $text-primary;
  text-align: left;
  cursor: pointer;

  &:hover,
  &.active { border-color: $brand-300; background: $brand-50; }
}

.cd__property-task-top,
.cd__property-task-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;
}

.cd__property-task-top strong { min-width: 0; overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
.cd__property-task small { color: $text-secondary; font-size: $font-caption; line-height: 1.5; }
.cd__property-task-foot { color: $text-tertiary; font-size: $font-caption; }
.cd__property-task-foot b { color: $brand-700; font-weight: $font-weight-medium; }

.cd__workspace { display: flex; flex-direction: column; gap: $space-4; min-width: 0; }

.cd__guide-card { display: flex; flex-direction: column; gap: $space-2; padding: $space-4; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.cd__guide-card--primary { border-color: $brand-200; background: linear-gradient(135deg, $surface-0, $brand-50); }
.cd__guide-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; }
.cd__guide-title-row h3 { margin: 4px 0 0; color: $text-primary; font-size: $font-body; }
.cd__guide-order { padding: 3px 8px; border-radius: $radius-pill; background: $surface-100; color: $text-tertiary; font-size: $font-caption; }
.cd__guide-reason { margin: 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
.cd__guide-inline { display: flex; align-items: center; gap: 6px; padding: 7px 9px; border-radius: $radius-sm; background: $surface-50; }
.cd__guide-inline span { color: $text-tertiary; font-size: $font-caption; }
.cd__guide-inline b { color: $brand-700; font-size: $font-body-sm; }
.cd__primary { display: inline-flex; align-items: center; justify-content: center; width: 100%; padding: 11px 16px; border: 0; border-radius: $radius-sm; background: $brand-600; color: $surface-0; font: inherit; font-weight: $font-weight-semibold; cursor: pointer; }
.cd__primary:hover { background: $brand-700; }
.cd__guide-note { margin: 0; color: $text-tertiary; font-size: $font-caption; line-height: 1.5; }
.cd__next-inline { display: flex; align-items: center; justify-content: space-between; gap: $space-2; padding-top: 9px; border-top: 1px solid $border-color; }
.cd__next-inline span { color: $text-tertiary; font-size: $font-caption; }
.cd__next-inline button { padding: 0; border: 0; background: transparent; color: $brand-700; font: inherit; font-size: $font-caption; font-weight: $font-weight-semibold; cursor: pointer; }
.cd__actions-head h4 { margin: 0; color: $text-primary; font-size: $font-body; }
.cd__actions-head small { display: block; margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }
.cd__action-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }

.cd__hero-object { color: $text-primary; font-size: $font-h1; font-weight: $font-weight-bold; letter-spacing: -.01em; }
.cd__hero-object-detail { color: $text-secondary; font-size: $font-h1; font-weight: $font-weight-semibold; }
.cd__hero-scheme { color: $text-secondary; font-size: $font-body-sm; font-weight: $font-weight-semibold; }
.cd__hero-sep { color: $text-tertiary; font-size: $font-body-sm; }
.cd__text-button { padding: 0; border: 0; background: transparent; color: $brand-600; font: inherit; font-size: $font-caption; font-weight: $font-weight-semibold; cursor: pointer; }
.cd__identity {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;
  padding: $space-5;
  border-bottom: 1px solid $border-color;
  background: linear-gradient(135deg, $brand-50 0%, $surface-0 72%);

  h3 { display: flex; align-items: center; gap: $space-2; margin: $space-1 0; font-size: $font-h1; }
  p { margin: 0; color: $text-secondary; font-size: $font-body-sm; }
}

.cd__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(110px, 1fr));
  gap: $space-2 $space-4;

  span { display: flex; flex-direction: column; gap: 2px; }
  small { color: $text-secondary; font-size: $font-caption; }
  b { font-size: $font-body-sm; }
}

.cd__properties,
.cd__schemes,
.cd__requirements {
  padding: $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
}

.cd__property-summary {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) repeat(3, minmax(100px, 1fr));
  gap: $space-3;
  padding: $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-50;
}

.cd__property-summary > div { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.cd__property-summary small { color: $text-tertiary; font-size: $font-caption; }
.cd__property-summary b { overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
.cd__property-summary-main span { overflow: hidden; color: $text-secondary; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; }

.cd__property-measure {
  display: flex;
  flex-direction: column;
  gap: $space-2;
  margin-top: $space-3;
  padding: $space-3;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-50;
}

.cd__property-measure-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(90px, auto);
  align-items: center;
  gap: $space-3;
}

.cd__property-measure-top > div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.cd__property-measure-top small,
.cd__property-measure-details dt { color: $text-tertiary; font-size: $font-caption; }
.cd__property-measure-top b { overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }

.cd__property-measure-conclusion {
  display: flex;
  gap: $space-2;
  margin: 0;
  color: $text-secondary;
  font-size: $font-caption;
  line-height: 1.65;
}

.cd__property-measure-conclusion strong { flex: 0 0 auto; color: $text-primary; font-weight: $font-weight-semibold; }

.cd__property-measure-details {
  border-top: 1px solid $border-color;
  padding-top: $space-2;

  summary { color: $brand-700; font-size: $font-caption; font-weight: $font-weight-semibold; cursor: pointer; }
  dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: $space-2 $space-4; margin: $space-2 0 0; }
  dt { color: $text-tertiary; font-size: $font-caption; }
  dd { margin: 2px 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.55; }
}

.cd__property-measure-empty {
  margin-top: $space-3;
  padding: 10px $space-3;
  border-radius: $radius-sm;
  background: $warning-50;
  color: $warning-700;
  font-size: $font-caption;
}

.cd__requirement-list {
  display: grid;
  gap: $space-3;
  padding: $space-4;

  article { padding: $space-3; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; }
  article > div { display: flex; align-items: center; justify-content: space-between; gap: $space-3; }
  p { margin: $space-2 0; color: $text-secondary; font-size: $font-body-sm; }
  small { color: $text-tertiary; font-size: $font-caption; }
}

.cd__context { padding: 0; }
.cd__next { padding: $space-4; border-bottom: 1px solid $border-color; }
.cd__next h4 { margin: $space-1 0; font-size: $font-title; }
.cd__next p { margin: 0 0 $space-3; color: $text-secondary; font-size: $font-caption; }
.cd__next .el-button { margin: 0 $space-2 $space-2 0; }

.cd__timeline ol { margin: 0; padding: $space-4; list-style: none; }
.cd__timeline li { padding-bottom: $space-3; border-bottom: 1px solid $border-color; margin-bottom: $space-3; }
.cd__timeline li:last-child { border-bottom: 0; }
.cd__timeline span,
.cd__timeline small { display: block; color: $text-tertiary; font-size: $font-caption; }
.cd__timeline strong { display: block; margin: $space-1 0; font-size: $font-body-sm; }
.cd__timeline p { margin: 0 0 $space-2; color: $text-secondary; font-size: $font-body-sm; line-height: 1.6; }

.cd__inline-empty,
.cd__loading { padding: $space-5; color: $text-secondary; font-size: $font-body-sm; }

@media (max-width: 1180px) {
  .cd__layout { grid-template-columns: 260px minmax(0, 1fr); }
  .cd__context { grid-column: 1 / -1; position: static; max-height: none; }
  .cd__property-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 1024px) {
  .cd__head,
  .cd__filters { flex-direction: column; align-items: stretch; min-width: 0; }
  .cd__layout { grid-template-columns: 1fr; }
  .cd__pool { position: static; max-height: none; }
  .cd__identity { flex-direction: column; }
}

.cd__evidence {
  margin-top: $space-4;
  padding-top: $space-3;
  border-top: 1px solid $border-color;

  strong { display: block; margin-bottom: $space-2; font-size: $font-body-sm; }
  div { display: flex; flex-wrap: wrap; gap: $space-2; }
  a { color: $brand-700; font-size: $font-caption; text-decoration: underline; }
}

.cd__upload {
  display: flex;
  flex-direction: column;
  gap: $space-2;
  width: 100%;
}

.cd__dialog-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-3;
}

.cd__scheme-form { display: flex; flex-direction: column; gap: $space-4; }
.cd__form-section { display: flex; flex-direction: column; gap: $space-3; padding: $space-4; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.cd__form-section .el-form-item:last-child { margin-bottom: 0; }
.cd__form-section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; }
.cd__form-section-head h4 { margin: 0; color: $text-primary; font-size: $font-body; }
.cd__form-section-head p { margin: 3px 0 0; color: $text-tertiary; font-size: $font-caption; line-height: 1.55; }

.cd__template-picker { display: flex; flex-direction: column; gap: $space-3; width: 100%; }
.cd__template-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-2; max-height: 330px; overflow-y: auto; padding-right: 2px; }
.cd__template-list .el-empty { grid-column: 1 / -1; padding: $space-4 0; }
.cd__template-card {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  padding: $space-3;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  color: $text-primary;
  text-align: left;
  cursor: pointer;

  &:hover { border-color: $brand-300; background: $brand-50; }
  &.active { border-color: $brand-500; background: $brand-50; box-shadow: inset 0 0 0 1px $brand-200; }
}
.cd__template-card-head { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.cd__template-card-head strong { overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
.cd__template-card > small,
.cd__template-meta { color: $text-tertiary; font-size: $font-caption; line-height: 1.5; }
.cd__template-tags { overflow: hidden; color: $text-secondary; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; }
.cd__template-meta { margin-top: 2px; }
.cd__template-match { align-self: flex-start; padding: 2px 7px; border-radius: $radius-pill; background: $success-50; color: $success-500; font-size: $font-caption; }

.cd__drawer-footer { display: flex; justify-content: flex-end; gap: $space-2; }

.cd__dialog-wide { grid-column: 1 / -1; }

@media (max-width: 720px) {
  .cd__dialog-grid { grid-template-columns: 1fr; }
  .cd__dialog-wide { grid-column: auto; }
  .cd__template-list { grid-template-columns: 1fr; }
  .cd__property-summary { grid-template-columns: 1fr; }
  .cd__property-measure-top,
  .cd__property-measure-details dl { grid-template-columns: 1fr; }
}

.cd__upload-list {
  display: flex;
  flex-direction: column;
  gap: $space-1;

  span { display: flex; align-items: center; justify-content: space-between; gap: $space-2; padding: $space-2; border-radius: $radius-xs; background: $surface-50; }
  a { color: $brand-700; font-size: $font-caption; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  button { border: 0; background: transparent; color: $danger-500; font-size: $font-caption; cursor: pointer; }
}

</style>
