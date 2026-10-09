<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StatusTag from '@/components/StatusTag.vue'
import WorkbenchState from '@/components/workbench/WorkbenchState.vue'
import PropertyFormDrawer from '@/components/property/PropertyFormDrawer.vue'
import CustomerPropertyContext from '@/components/CustomerPropertyContext.vue'
import RequirementFormDrawer from '@/components/design/RequirementFormDrawer.vue'
import CustomerHeroCard from '@/components/customer/CustomerHeroCard.vue'
import CustomerContextPanels from '@/components/customer/CustomerContextPanels.vue'
import HeroFocusItem from '@/components/workbench/HeroFocusItem.vue'
import WorkbenchQuickAction from '@/components/workbench/WorkbenchQuickAction.vue'
import { formatDateTime, formatFollowDue, formatRelativeDay } from '@/core/format'
import { notifyBlocked } from '@/core/blockedNotice'
import type { StatusTone } from '@/core/tone'
import { crmApi } from '@/domains/crm/api'
import { DORMANT_REASONS, canManageDormantRole } from '@/domains/crm/dormant'
import { designApi } from '@/domains/design/api'
import type { DesignRequirement } from '@/domains/design/model'
import { CUSTOMER_SOURCE_OPTIONS, PORTRAIT_CONCERN_OPTIONS, PORTRAIT_LABELS, PORTRAIT_OPTIONS, optionLabel } from '@/domains/crm/options'
import type { Customer, CustomerFollow, CustomerStage, FollowWay, MyCustomerOverview } from '@/domains/crm/model'
import { propertyApi } from '@/domains/property/api'
import type { Property, PropertyStatus } from '@/domains/property/model'
import { useSessionStore } from '@/stores/session'

type QueueFilter = 'all' | 'overdue' | 'today' | 'soon' | 'unplanned'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const QUEUE_FILTERS: Array<{ key: QueueFilter; label: string }> = [
  { key: 'all', label: '全部待办' },
  { key: 'overdue', label: '已逾期' },
  { key: 'today', label: '今日跟进' },
  { key: 'soon', label: '3 天内' },
  { key: 'unplanned', label: '未安排' }
]

const FOLLOW_ELIGIBLE_STAGES: CustomerStage[] = ['intention', 'following']

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
  unknown: { label: '待业务确认', tone: 'info' }
}

const RISK_META: Record<NonNullable<Customer['riskLevel']>, { label: string; tone: StatusTone }> = {
  Normal: { label: '正常', tone: 'done' },
  Attention: { label: '需关注', tone: 'pending' },
  High: { label: '高风险', tone: 'blocked' }
}

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

const FOLLOW_WAY_LABELS: Record<FollowWay, string> = {
  phone: '电话',
  visit: '到店',
  wechat: '微信',
  video: '视频',
  other: '其他'
}


const PORTRAIT_HINTS: Record<string, string> = {
  decisionRole: '谁最终拍板',
  purpose: '装修的真实目的',
  houseCondition: '毛坯、旧房还是精装',
  startWindow: '计划什么时候开工',
  style: '客户喜欢的风格',
  eco: '环保和健康要求',
  household: '常住人口结构',
  payment: '付款方式偏好',
  competitor: '是否在对比其他公司'
}

const PORTRAIT_SECTIONS = [
  { title: '需求与计划', keys: ['purpose', 'houseCondition', 'startWindow', 'decisionRole'] },
  { title: '偏好与预算', keys: ['style', 'eco', 'household', 'payment'] },
  { title: '决策参考', keys: ['competitor'] }
]


const overview = ref<MyCustomerOverview | null>(null)
const customers = ref<Customer[]>([])
const properties = ref<Property[]>([])
const follows = ref<CustomerFollow[]>([])
const requirements = ref<DesignRequirement[]>([])
const requirementOpen = ref(false)
const loading = ref(false)
const contextLoading = ref(false)
const error = ref('')
const contextError = ref('')
const keyword = ref('')
const filter = ref<QueueFilter>('all')
const selectedCustomerId = ref(String(route.query.activeCustomerId ?? ''))
const selectedPropertyId = ref(String(route.query.activePropertyId ?? ''))
const actionError = ref('')
const saving = ref(false)

const followOpen = ref(false)
const followForm = reactive<{ way: FollowWay; content: string; nextFollowAt: string }>({
  way: 'phone',
  content: '',
  nextFollowAt: ''
})

const propertyDrawerOpen = ref(false)
const editingProperty = ref<Property | null>(null)
const deletingPropertyId = ref('')
const wechatOpen = ref(false)
const wechatNo = ref('')
const dormantOpen = ref(false)
const dormantForm = reactive({ reasonCode: '', reasonText: '' })
const portraitOpen = ref(false)
const portraitForm = reactive<Record<string, string>>({})
const portraitConcerns = ref<string[]>([])
const customerEditOpen = ref(false)
const measureAppointmentOpen = ref(false)
const measureAppointmentForm = reactive({
  propertyId: '',
  measureAt: '',
  creatingProperty: false,
  community: '',
  building: '',
  roomNo: '',
  address: '',
  area: undefined as number | undefined,
  layout: ''
})
const profileForm = reactive({
  name: '',
  phone: '',
  gender: 'M',
  source: '',
  community: '',
  addr: '',
  area: undefined as number | undefined,
  budget: undefined as number | undefined,
  remark: ''
})

const selectedCustomer = computed(() =>
  customers.value.find((item) => item.id === selectedCustomerId.value) ?? null
)
const selectedProperty = computed(() =>
  properties.value.find((item) => item.id === selectedPropertyId.value) ?? null
)
const canManageDormant = computed(() => canManageDormantRole(session.role))
const followReminderTone = computed<'danger' | 'pending' | 'info'>(() => {
  const text = formatRelativeDay(selectedCustomer.value?.nextFollowAt)
  if (text.startsWith('已过')) return 'danger'
  if (text === '今天' || text === '明天') return 'pending'
  return 'info'
})
const followReminderHint = computed(() => {
  const value = selectedCustomer.value?.nextFollowAt
  if (!value) return '建议本次沟通后约定下一次联系时间'
  const text = formatRelativeDay(value)
  if (text.startsWith('已过')) return '建议优先联系，避免客户流失'
  if (text === '今天') return '按约定完成本次联系'
  return `提前准备沟通内容，${text}联系客户`
})
const isDormantCustomer = computed(() => selectedCustomer.value?.stage === 'dormant')
const canSetDormant = computed(() => Boolean(
  selectedCustomer.value
  && canManageDormant.value
  && !['sign', 'construction', 'done', 'lost', 'dormant'].includes(selectedCustomer.value.stage)
))

function portraitText(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return String(record.name ?? record.label ?? record.value ?? record.key ?? '')
  }
  return String(value)
}

function portraitValue(key: string, value: unknown): string {
  const options = key === 'concerns' ? PORTRAIT_CONCERN_OPTIONS : PORTRAIT_OPTIONS[key] || []
  if (Array.isArray(value)) {
    return value.map((item) => optionLabel(options, portraitText(item))).filter((item) => item && item !== '—').join('、')
  }
  return optionLabel(options, portraitText(value))
}




const portraitItems = computed(() => {
  const source = selectedCustomer.value?.portrait as Record<string, unknown> | null | undefined
  if (!source) return []
  const fields = Object.entries(PORTRAIT_LABELS).map(([key, label]) => ({
    label,
    value: portraitValue(key, source[key])
  }))
  fields.push({ label: '关注点', value: portraitValue('concerns', source.concerns) })
  return fields.filter((item) => item.value && item.value !== '—')
})

const portraitFilledCount = computed(() => portraitItems.value.length)

/** 取某天的零点时间戳，用于按"天"比较到期。 */
function dayStart(value?: string | Date | null): number | null {
  if (!value) return null
  const date = value instanceof Date
    ? new Date(value)
    : new Date(String(value).includes('T') ? String(value) : String(value).replace(/-/g, '/'))
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** 入站分桶：逾期 / 今日 / 3 天内 / 未安排；不在待跟进阶段返回 null。 */
function followBucket(customer: Customer): Exclude<QueueFilter, 'all'> | null {
  if (!FOLLOW_ELIGIBLE_STAGES.includes(customer.stage)) return null
  const target = dayStart(customer.nextFollowAt)
  const today = dayStart(new Date())
  if (target === null || today === null) return 'unplanned'
  const diffDays = Math.round((target - today) / 86_400_000)
  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays <= 3) return 'soon'
  return 'unplanned'
}

/** 当前角色与入站阶段内的待跟进对象。 */
const queueSource = computed(() => customers.value.filter((customer) => followBucket(customer) !== null))

const filterCounts = computed<Record<QueueFilter, number>>(() => {
  const counts: Record<QueueFilter, number> = { all: queueSource.value.length, overdue: 0, today: 0, soon: 0, unplanned: 0 }
  for (const customer of queueSource.value) {
    const bucket = followBucket(customer)
    if (bucket) counts[bucket] += 1
  }
  return counts
})

const queueCustomers = computed(() => {
  const needle = keyword.value.trim().toLowerCase()
  const bucketRank: Record<Exclude<QueueFilter, 'all'>, number> = { overdue: 0, today: 1, soon: 2, unplanned: 3 }
  return queueSource.value
    .filter((customer) => {
      if (filter.value !== 'all' && followBucket(customer) !== filter.value) return false
      if (!needle) return true
      return [customer.name, customer.phone, customer.community, customer.addr]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    })
    .sort((left, right) => {
      const leftBucket = followBucket(left)
      const rightBucket = followBucket(right)
      const rankDiff = (leftBucket ? bucketRank[leftBucket] : 9) - (rightBucket ? bucketRank[rightBucket] : 9)
      if (rankDiff) return rankDiff
      return String(left.nextFollowAt || '').localeCompare(String(right.nextFollowAt || ''))
        || String(left.id).localeCompare(String(right.id))
    })
})

const currentQueueIndex = computed(() => queueSource.value.findIndex((item) => item.id === selectedCustomerId.value))
const nextQueueCustomer = computed(() => {
  if (!queueCustomers.value.length) return null
  const currentIndex = queueCustomers.value.findIndex((item) => item.id === selectedCustomerId.value)
  if (currentIndex < 0) return queueCustomers.value[0]
  return queueCustomers.value[currentIndex + 1] ?? null
})

const overviewMetrics = computed(() => overview.value?.metrics ?? [])
function metricValue(key: string): number {
  return overviewMetrics.value.find((item) => item.key === key)?.value ?? 0
}

const currentWhy = computed(() => {
  const customer = selectedCustomer.value
  if (!customer) return '选择左侧客户后查看处理原因'
  return customer.riskReason || customer.nextAction || '按约定时间联系客户，记录沟通结果并安排下一次跟进'
})

// L1 当前阶段关注层：最近一次沟通结论（阶段重点字段待 T06 冻结后改由服务端 stageFocus 驱动）
const latestFollow = computed(() => follows.value[0] ?? null)

function queueBucketLabel(customer: Customer | null): string {
  if (!customer) return '待选择客户'
  const bucket = followBucket(customer)
  if (bucket === 'overdue') return '逾期跟进'
  if (bucket === 'today') return '今日跟进'
  if (bucket === 'soon') return '3 天内跟进'
  if (bucket === 'unplanned') return '未安排下次跟进'
  return '当前不在待跟进队列'
}

function propertyTitle(property: Property): string {
  return [property.community, property.building, property.roomNo].filter(Boolean).join(' ') || property.address || '房屋地址待补充'
}

function propertySubtitle(property: Property): string {
  return [property.address, property.area ? `${property.area}㎡` : '', property.layout || '']
    .filter(Boolean)
    .join(' · ')
}

function customerPropertySummary(customer: Customer): string {
  return [customer.community || '房屋待补充', customer.area ? `${customer.area}㎡` : ''].filter(Boolean).join(' · ')
}

function openCustomer360(customer: Customer): void {
  void router.push(`/designer/my-customers/${customer.id}`)
}

function callCustomer(customer: Customer): void {
  if (!customer.phone) {
    actionError.value = '客户电话待补充，当前不能拨号'
    return
  }
  window.location.href = `tel:${customer.phone}`
}

function syncQuery(): void {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(route.query)) {
    if (typeof value === 'string') query[key] = value
  }
  if (selectedCustomerId.value) query.activeCustomerId = selectedCustomerId.value
  else delete query.activeCustomerId
  if (selectedPropertyId.value) query.activePropertyId = selectedPropertyId.value
  else delete query.activePropertyId
  void router.replace({ query })
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const report = await crmApi.myCustomerOverview({ sort: 'due', current: 1, size: 100 })
    overview.value = report
    customers.value = report.customers
    const selectedInQueue = Boolean(selectedCustomerId.value)
      && queueSource.value.some((item) => item.id === selectedCustomerId.value)
    if (!selectedInQueue) {
      selectedCustomerId.value = queueSource.value[0]?.id ?? ''
      selectedPropertyId.value = ''
    }
    await loadCustomerContext()
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : '待我跟进数据暂不可确认'
  } finally {
    loading.value = false
  }
}

async function loadCustomerContext(): Promise<void> {
  const customer = selectedCustomer.value
  if (!customer) {
    properties.value = []
    follows.value = []
    requirements.value = []
    syncQuery()
    return
  }
  contextLoading.value = true
  contextError.value = ''
  try {
    const [propertyResult, followResult, requirementResult] = await Promise.allSettled([
      propertyApi.listProperties(customer.id),
      crmApi.customerFollows(customer.id),
      designApi.listRequirements(customer.id)
    ])
    if (propertyResult.status === 'fulfilled') {
      properties.value = propertyResult.value
      if (selectedPropertyId.value && !propertyResult.value.some((item) => item.id === selectedPropertyId.value)) {
        selectedPropertyId.value = ''
      }
    } else {
      properties.value = []
    }
    if (followResult.status === 'fulfilled') {
      follows.value = followResult.value
    } else {
      follows.value = []
    }
    if (requirementResult.status === 'fulfilled') {
      requirements.value = requirementResult.value
    } else {
      requirements.value = []
    }
    if (propertyResult.status === 'rejected' || followResult.status === 'rejected' || requirementResult.status === 'rejected') {
      contextError.value = '部分数据暂不可确认（客户资料 / 房屋 / 沟通 / 诉求），请刷新重试'
    }
  } finally {
    contextLoading.value = false
    syncQuery()
  }
}

/** 切换队列筛选/搜索时，中栏与右栏必须跟随新的可见队列（规范 §4/§11）。 */
watch([filter, keyword], () => {
  const list = queueCustomers.value
  if (!list.length) {
    if (!selectedCustomerId.value) return
    selectedCustomerId.value = ''
    selectedPropertyId.value = ''
    void loadCustomerContext()
    return
  }
  if (list.some((item) => item.id === selectedCustomerId.value)) return
  selectedCustomerId.value = list[0]?.id ?? ''
  selectedPropertyId.value = ''
  void loadCustomerContext()
})

async function selectCustomer(customer: Customer): Promise<void> {
  selectedCustomerId.value = customer.id
  selectedPropertyId.value = ''
  actionError.value = ''
  syncQuery()
  await loadCustomerContext()
}

function selectProperty(property: Property): void {
  selectedPropertyId.value = property.id
  actionError.value = ''
  syncQuery()
}

function openFollowDialog(): void {
  const customer = selectedCustomer.value
  if (!customer) return
  followForm.way = 'phone'
  followForm.content = ''
  followForm.nextFollowAt = ''
  followOpen.value = true
}

async function saveFollow(): Promise<void> {
  const customer = selectedCustomer.value
  if (!customer || !followForm.content.trim()) return
  saving.value = true
  actionError.value = ''
  try {
    await crmApi.saveFollow({
      customerId: customer.id,
      way: followForm.way,
      content: followForm.content.trim(),
      nextFollowAt: followForm.nextFollowAt || undefined
    })
    followOpen.value = false
    await load()
    ElMessage.success('跟进已保存，客户资料和下次联系时间已更新')
  } catch (saveError) {
    actionError.value = saveError instanceof Error ? saveError.message : '跟进保存失败，请保留输入后重试'
  } finally {
    saving.value = false
  }
}

function openPropertyDrawer(property?: Property): void {
  if (!selectedCustomer.value) return
  editingProperty.value = property ?? null
  propertyDrawerOpen.value = true
}

async function deleteProperty(property: Property): Promise<void> {
  const customer = selectedCustomer.value
  if (!customer || deletingPropertyId.value) return
  try {
    await ElMessageBox.confirm(`确定删除房屋「${propertyTitle(property)}」？如果已经有关联量房、诉求、方案、报价或项目，系统会拒绝删除。`, '删除房屋', { type: 'warning', confirmButtonText: '确认删除' })
  } catch {
    return
  }
  deletingPropertyId.value = property.id
  actionError.value = ''
  try {
    await propertyApi.deleteProperty(property.id)
    if (selectedPropertyId.value === property.id) selectedPropertyId.value = ''
    await loadCustomerContext()
    ElMessage.success('房屋已删除')
  } catch (deleteError) {
    actionError.value = deleteError instanceof Error ? deleteError.message : '房屋删除失败，请稍后重试'
  } finally {
    deletingPropertyId.value = ''
  }
}

async function onPropertySaved(property: Property): Promise<void> {
  selectedPropertyId.value = property.id
  await loadCustomerContext()
  syncQuery()
  ElMessage.success('房屋档案已建立，已切换为当前房屋')
}

function selectNextQueueCustomer(): void {
  if (nextQueueCustomer.value) void selectCustomer(nextQueueCustomer.value)
}

function resetPortraitForm(): void {
  const source = selectedCustomer.value?.portrait as Record<string, unknown> | null | undefined
  for (const key of Object.keys(PORTRAIT_LABELS)) {
    portraitForm[key] = source ? portraitText(source[key]) : ''
  }
  portraitConcerns.value = Array.isArray(source?.concerns) ? source!.concerns.map((item) => portraitText(item)).filter(Boolean) : []
}

function openPortraitDialog(): void {
  if (!selectedCustomer.value) return
  resetPortraitForm()
  portraitOpen.value = true
}

function portraitFormValue(key: string): string | undefined {
  const value = portraitForm[key]
  return typeof value === 'string' && value ? value : undefined
}

async function savePortrait(): Promise<void> {
  const customer = selectedCustomer.value
  if (!customer) return
  saving.value = true
  actionError.value = ''
  try {
    await crmApi.savePortrait({
      customerId: customer.id,
      decisionRole: portraitFormValue('decisionRole'),
      purpose: portraitFormValue('purpose'),
      houseCondition: portraitFormValue('houseCondition'),
      startWindow: portraitFormValue('startWindow'),
      style: portraitFormValue('style'),
      eco: portraitFormValue('eco'),
      household: portraitFormValue('household'),
      payment: portraitFormValue('payment'),
      competitor: portraitFormValue('competitor'),
      concerns: portraitConcerns.value
    })
    portraitOpen.value = false
    await load()
    ElMessage.success('客户画像已保存，后续沟通建议会更准确')
  } catch (saveError) {
    actionError.value = saveError instanceof Error ? saveError.message : '客户画像保存失败，请稍后重试'
  } finally {
    saving.value = false
  }
}

function openMeasureAppointment(): void {
  const customer = selectedCustomer.value
  if (!customer) return
  if (customer.stage === 'intention') {
    actionError.value = '请先完成首次跟进（首联），再为客户预约量房。'
    notifyBlocked({
      title: '还不能预约量房',
      message: `「${customer.name || '该客户'}」还没有完成首次跟进（首联）。预约量房前需要先建立联系：记录一次跟进后，客户阶段进入「跟进中」，就可以预约量房了。`,
      actionText: '去写跟进',
      onAction: () => openFollowDialog()
    })
    return
  }
  measureAppointmentForm.propertyId = selectedPropertyId.value || ''
  measureAppointmentForm.measureAt = ''
  measureAppointmentForm.creatingProperty = !properties.value.length
  measureAppointmentForm.community = ''
  measureAppointmentForm.building = ''
  measureAppointmentForm.roomNo = ''
  measureAppointmentForm.address = ''
  measureAppointmentForm.area = undefined
  measureAppointmentForm.layout = ''
  actionError.value = ''
  measureAppointmentOpen.value = true
}

function toggleMeasurePropertyCreate(): void {
  measureAppointmentForm.creatingProperty = !measureAppointmentForm.creatingProperty
  if (measureAppointmentForm.creatingProperty) measureAppointmentForm.propertyId = ''
}

async function saveMeasureAppointment(): Promise<void> {
  const customer = selectedCustomer.value
  if (!customer || !measureAppointmentForm.measureAt) return
  const creatingProperty = measureAppointmentForm.creatingProperty || !properties.value.length
  if (creatingProperty && !measureAppointmentForm.address.trim()) {
    actionError.value = '请填写量房房屋的详细地址。'
    return
  }
  if (!creatingProperty && !measureAppointmentForm.propertyId) {
    actionError.value = '请选择本次要量房的房屋。'
    return
  }
  saving.value = true
  actionError.value = ''
  try {
    let propertyId = measureAppointmentForm.propertyId
    if (creatingProperty) {
      const created = await propertyApi.saveProperty({
        customerId: customer.id,
        community: measureAppointmentForm.community.trim() || undefined,
        building: measureAppointmentForm.building.trim() || undefined,
        roomNo: measureAppointmentForm.roomNo.trim() || undefined,
        address: measureAppointmentForm.address.trim(),
        area: measureAppointmentForm.area,
        layout: measureAppointmentForm.layout.trim() || undefined
      })
      propertyId = created.id
      selectedPropertyId.value = propertyId
    }
    await crmApi.scheduleMeasure(customer.id, propertyId, measureAppointmentForm.measureAt)
    measureAppointmentOpen.value = false
    await loadCustomerContext()
    await load()
    ElMessage.success('量房已预约，正在进入待我量房工作台')
    const query = new URLSearchParams({ activeCustomerId: customer.id, activePropertyId: propertyId })
    void router.push(`/designer/measure?${query.toString()}`)
  } catch (saveError) {
    const message = saveError instanceof Error ? saveError.message : '预约量房失败，请保留输入后重试'
    actionError.value = message
    if (/首次跟进|首联/.test(message)) {
      measureAppointmentOpen.value = false
      notifyBlocked({
        title: '还不能预约量房',
        message: `服务端拒绝了这次预约：${message} 先记录一次跟进、客户阶段进入「跟进中」后即可预约量房。`,
        actionText: '去写跟进',
        onAction: () => openFollowDialog()
      })
    }
  } finally {
    saving.value = false
  }
}

function openCustomerEditDialog(): void {
  const customer = selectedCustomer.value
  if (!customer) return
  profileForm.name = customer.name || ''
  profileForm.phone = customer.phone || ''
  profileForm.gender = customer.gender || 'M'
  profileForm.source = customer.source || ''
  profileForm.community = customer.community || ''
  profileForm.addr = customer.addr || ''
  profileForm.area = customer.area
  profileForm.budget = customer.budget
  profileForm.remark = customer.remark || ''
  customerEditOpen.value = true
}

async function saveCustomerEdit(): Promise<void> {
  const customer = selectedCustomer.value
  if (!customer) return
  if (!profileForm.name.trim()) {
    actionError.value = '请填写客户姓名。'
    return
  }
  if (!/^1\d{10}$/.test(profileForm.phone)) {
    actionError.value = '请填写正确的 11 位手机号。'
    return
  }
  saving.value = true
  actionError.value = ''
  try {
    await crmApi.updateCustomer({
      customerId: customer.id,
      name: profileForm.name.trim(),
      telNo: profileForm.phone,
      gender: profileForm.gender,
      source: profileForm.source || undefined,
      community: profileForm.community.trim() || undefined,
      addr: profileForm.addr.trim() || undefined,
      area: profileForm.area,
      budget: profileForm.budget,
      remark: profileForm.remark.trim() || undefined
    })
    customerEditOpen.value = false
    await load()
    ElMessage.success('客户资料已更新')
  } catch (saveError) {
    actionError.value = saveError instanceof Error ? saveError.message : '客户资料保存失败，请稍后重试'
  } finally {
    saving.value = false
  }
}

function openWechatDialog(): void {
  if (!selectedCustomer.value) return
  wechatNo.value = selectedCustomer.value.wechatNo || ''
  wechatOpen.value = true
}

async function saveWechat(): Promise<void> {
  const customer = selectedCustomer.value
  if (!customer) return
  saving.value = true
  actionError.value = ''
  try {
    await crmApi.recordWechat(customer.id, wechatNo.value.trim() || undefined)
    wechatOpen.value = false
    await load()
    ElMessage.success(customer.wechatAdded ? '微信信息已更新' : '已记录客户微信')
  } catch (saveError) {
    actionError.value = saveError instanceof Error ? saveError.message : '微信记录保存失败，请稍后重试'
  } finally {
    saving.value = false
  }
}

async function recordVisit(): Promise<void> {
  const customer = selectedCustomer.value
  if (!customer) return
  saving.value = true
  actionError.value = ''
  try {
    await crmApi.recordVisit(customer.id)
    await load()
    ElMessage.success('已记录本次到店')
  } catch (saveError) {
    actionError.value = saveError instanceof Error ? saveError.message : '到店记录保存失败，请稍后重试'
  } finally {
    saving.value = false
  }
}

function openDormantDialog(): void {
  const customer = selectedCustomer.value
  if (!customer) return
  if (!canManageDormant.value) {
    actionError.value = '当前岗位不能设置休眠客户，请联系客户负责人、店长或企业负责人处理。'
    return
  }
  dormantForm.reasonCode = ''
  dormantForm.reasonText = ''
  dormantOpen.value = true
}

async function saveDormant(): Promise<void> {
  const customer = selectedCustomer.value
  if (!customer || !dormantForm.reasonCode) return
  if (dormantForm.reasonCode === 'Other' && !dormantForm.reasonText.trim()) {
    actionError.value = '选择“其他”时，请填写休眠原因说明。'
    return
  }
  saving.value = true
  actionError.value = ''
  try {
    await crmApi.setDormant(customer.id, dormantForm.reasonCode, dormantForm.reasonText.trim() || undefined)
    dormantOpen.value = false
    await load()
    ElMessage.success('客户已设为休眠，后续不会再出现在待跟进队列')
  } catch (saveError) {
    actionError.value = saveError instanceof Error ? saveError.message : '休眠设置失败，请刷新客户状态后重试'
  } finally {
    saving.value = false
  }
}

async function resumeCustomer(): Promise<void> {
  const customer = selectedCustomer.value
  if (!customer) return
  saving.value = true
  actionError.value = ''
  try {
    await crmApi.resumeDormant(customer.id)
    await load()
    ElMessage.success('客户已恢复，可按新的跟进节奏继续推进')
  } catch (saveError) {
    actionError.value = saveError instanceof Error ? saveError.message : '恢复跟进失败，请刷新后重试'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="fu">
    <header class="fu__head">
      <div>
        <p class="fu__eyebrow">客户经营 · 待我跟进</p>
        <h1>待我跟进</h1>
        <p>集中处理今天该联系的客户。先看客户是谁、住在哪里、沟通到什么程度，再记录本次跟进和下次联系时间。</p>
      </div>
      <div class="fu__head-meta">
        <span><b>{{ filterCounts.all }}</b> 位待跟进</span>
        <span>逾期 {{ metricValue('designerClockOverdueCount') }} · 今日 {{ metricValue('designerClockTodayCount') }} · 3 天内 {{ metricValue('designerClockSoonCount') }}</span>
        <button type="button" :class="{ 'is-loading': loading }" @click="load">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.3M21 3v6h-6" /></svg>
          刷新
        </button>
      </div>
    </header>

    <section class="fu__tools" aria-label="待我跟进筛选">
      <label class="fu__search">
        <span>搜索</span>
        <input v-model="keyword" type="search" placeholder="客户、手机号、小区或地址" />
      </label>
      <div class="fu__filters">
        <button
          v-for="item in QUEUE_FILTERS"
          :key="item.key"
          type="button"
          :class="{ active: filter === item.key }"
          @click="filter = item.key"
        >
          {{ item.label }}
          <small>{{ filterCounts[item.key] }}</small>
        </button>
      </div>
    </section>

    <el-alert v-if="actionError" type="error" :closable="false" :title="actionError" show-icon />

    <WorkbenchState
      v-if="error && !customers.length"
      variant="error"
      title="待我跟进暂不可确认"
      :description="error"
      action-text="重新加载"
      min-height="300px"
      @action="load"
    />

    <div v-else-if="loading && !customers.length" class="fu__skeleton" aria-busy="true">
      <span v-for="n in 6" :key="n" />
    </div>

    <div v-else class="fu__layout">
      <aside class="fu__queue">
        <header class="fu__queue-head">
          <div>
            <strong>客户 / 房屋队列</strong>
            <small>先选客户，需要安排量房时再确认具体房屋</small>
          </div>
          <span>{{ queueCustomers.length }}</span>
        </header>

        <WorkbenchState
          v-if="!queueCustomers.length"
          title="当前没有需要我跟进的客户"
          description="没有逾期、今日、3 天内或未安排的客户；也可以清空搜索和筛选项后再看。"
          action-text="刷新"
          min-height="240px"
          @action="load"
        />

        <div v-else class="fu__queue-list">
          <button
            v-for="customer in queueCustomers"
            :key="customer.id"
            type="button"
            class="fu__queue-item"
            :class="{ active: customer.id === selectedCustomerId }"
            @click="selectCustomer(customer)"
          >
            <span class="fu__queue-top">
              <strong>{{ customer.name || '客户待完善' }}</strong>
              <StatusTag :tone="STAGE_META[customer.stage].tone" :text="STAGE_META[customer.stage].label" :dot="false" />
            </span>
            <span class="fu__queue-property">{{ customerPropertySummary(customer) }}</span>
            <span class="fu__queue-meta">
              <small>{{ customer.nextFollowAt ? `下次 ${formatRelativeDay(customer.nextFollowAt)}` : '未安排下次跟进' }}</small>
              <StatusTag
                v-if="customer.riskLevel"
                :tone="RISK_META[customer.riskLevel].tone"
                :text="RISK_META[customer.riskLevel].label"
                :dot="false"
              />
            </span>
            <span class="fu__queue-reason">{{ customer.riskReason || customer.nextAction || '按约定时间联系客户' }}</span>
          </button>
        </div>
      </aside>

      <main class="fu__workspace">
        <WorkbenchState
          v-if="!selectedCustomer && !queueCustomers.length"
          title="当前没有可跟进的客户"
          description="没有逾期、今日、3 天内或未安排的客户。请调整筛选，或先完成新的客户跟进任务。"
          min-height="360px"
        />
        <WorkbenchState
          v-else-if="!selectedCustomer"
          title="先选择需要跟进的客户"
          description="从左侧选一位客户，查看他的基本资料、客户画像、标签和最近沟通记录。"
          min-height="360px"
        />

        <template v-else>
          <CustomerHeroCard
            :customer="selectedCustomer"
            portrait-title="客户画像"
            portrait-hint="沟通前先了解需求、预算和决策方式"
          >
            <!-- L1 当前阶段关注层（≤4）；阶段重点字段待 REQ-BIZ-20261009-003 / T06 冻结后改由服务端 stageFocus 投影驱动 -->
            <template #focus>
              <HeroFocusItem
                label="下次联系"
                :value="selectedCustomer.nextFollowAt ? formatRelativeDay(selectedCustomer.nextFollowAt) : '未安排'"
                :note="followReminderHint"
                :tone="followReminderTone === 'danger' ? 'blocked' : followReminderTone === 'pending' ? 'pending' : 'info'"
              />
              <HeroFocusItem
                label="最近沟通"
                :value="latestFollow ? `${FOLLOW_WAY_LABELS[latestFollow.way]} · ${latestFollow.createdAt ? formatDateTime(latestFollow.createdAt) : '时间待确认'}` : '还没有沟通记录'"
                :note="latestFollow?.content || '第一次联系后记录结果，下一次跟进才有依据'"
                tone="info"
              />
            </template>
            <template #portrait-action>
              <button class="fu__text-button" type="button" @click="openPortraitDialog">完善画像</button>
            </template>
            <template #footer>
              <div><small>客户资料</small><b>需要修改称呼、电话、地址或预算？</b></div>
            </template>
            <template #actions>
              <button class="fu__hero-edit" type="button" @click="openCustomerEditDialog">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L20 8l-4-4L4 16v4Z" /><path d="M13.5 6.5l4 4" /></svg>
                编辑基本信息
              </button>
            </template>
          </CustomerHeroCard>

          <el-alert v-if="contextError" type="warning" :closable="false" :title="contextError" show-icon />

          <section class="fu__context-card">
            <div class="fu__context-col">
              <header class="fu__context-head">
                <div><strong>装修房屋</strong><small>选中本次要安排量房或设计的房屋</small></div>
                <button type="button" @click="openPropertyDrawer()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V8l7-5 7 5v13" /><path d="M12 11.5v6M9 14.5h6" /></svg>新增房屋</button>
              </header>
              <WorkbenchState
                v-if="contextLoading"
                title="房屋加载中"
                description="正在读取客户房屋信息。"
                min-height="130px"
              />
              <div v-else-if="!properties.length" class="fu__empty-inline">
                <strong>还没有房屋档案</strong>
                <span>要安排量房，先建立具体房屋。</span>
                <button type="button" @click="openPropertyDrawer()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V8l7-5 7 5v13" /><path d="M12 11.5v6M9 14.5h6" /></svg>建立房屋</button>
              </div>
              <div v-else class="fu__properties">
                <div
                  v-for="property in properties"
                  :key="property.id"
                  class="fu__property"
                  :class="{ active: property.id === selectedPropertyId }"
                  role="button"
                  tabindex="0"
                  @click="selectProperty(property)"
                  @keydown.enter="selectProperty(property)"
                >
                  <div class="fu__property-main">
                    <span class="fu__property-title">{{ propertyTitle(property) }}</span>
                    <span class="fu__property-sub">{{ propertySubtitle(property) }}</span>
                    <span class="fu__property-status">{{ PROPERTY_STATUS_LABELS[property.status] }}</span>
                  </div>
                  <div class="fu__property-actions">
                    <button type="button" class="fu__property-action" @click.stop="openPropertyDrawer(property)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L20 8l-4-4L4 16v4Z" /><path d="M13.5 6.5l4 4" /></svg>编辑</button>
                    <button type="button" class="fu__property-action fu__property-action--danger" :disabled="deletingPropertyId === property.id" @click.stop="deleteProperty(property)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M6 7l1 13h10l1-13" /></svg><span>{{ deletingPropertyId === property.id ? '删除中…' : '删除' }}</span></button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <CustomerContextPanels
            :requirements="requirements"
            :follows="follows"
            :order="['follow', 'requirement']"
            emphasis="primary"
            @record-requirement="requirementOpen = true"
            @record-follow="openFollowDialog"
          />
        </template>
      </main>

      <aside class="fu__guide">
        <template v-if="selectedCustomer">
          <section class="fu__guide-card fu__guide-card--primary">
            <div class="fu__guide-title-row">
              <div>
                <p class="fu__eyebrow">本次跟进</p>
                <h3>{{ currentQueueIndex >= 0 ? queueBucketLabel(selectedCustomer) : '本次已处理' }}</h3>
              </div>
              <span class="fu__guide-order">{{ currentQueueIndex >= 0 ? `${currentQueueIndex + 1}/${queueSource.length}` : '已完成' }}</span>
            </div>
            <div class="fu__follow-reminder" :class="`fu__follow-reminder--${followReminderTone}`">
              <strong>{{ formatFollowDue(selectedCustomer.nextFollowAt) }}</strong>
              <small>{{ followReminderHint }}</small>
            </div>
            <p class="fu__guide-reason">{{ currentWhy }}</p>
            <div class="fu__guide-inline"><span>建议</span><b>{{ selectedCustomer.nextAction || '先联系客户确认情况' }}</b></div>
            <button class="fu__primary" type="button" @click="openFollowDialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v14H4zM8 9h8M8 13h5" /></svg>写跟进</button>
            <p class="fu__guide-note">保存后会更新客户阶段、本次沟通记录和下次联系时间。客户已明确需求时，可直接预约量房。</p>
            <div v-if="nextQueueCustomer" class="fu__next-inline"><span>下一位</span><button type="button" @click="selectNextQueueCustomer">查看下一项</button></div>
          </section>

          <section class="fu__guide-card fu__guide-card--actions">
            <header class="fu__actions-head"><div><h4>客户操作</h4><small>在当前页面完成，不需要再搜索客户</small></div></header>
            <div class="fu__action-grid">
              <WorkbenchQuickAction
                tone="measure"
                primary
                title="预约量房"
                :hint="selectedCustomer.stage === 'intention' ? '需先完成首次跟进（首联）' : '选择或建立量房房屋，约定上门时间'"
                @click="openMeasureAppointment"
              >
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.6 7-12a7 7 0 1 0-14 0c0 6.4 7 12 7 12Z" /><path d="M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" /></svg></template>
              </WorkbenchQuickAction>
              <WorkbenchQuickAction tone="brand" title="打电话" hint="立即联系客户" @click="callCustomer(selectedCustomer)">
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.8 2Z" /></svg></template>
              </WorkbenchQuickAction>
              <WorkbenchQuickAction tone="contact" :title="selectedCustomer.wechatAdded ? '更新微信' : '记录加微信'" :hint="selectedCustomer.wechatAdded ? '补充或修改微信号' : '客户已加微信时登记'" @click="openWechatDialog">
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 9.8 9.8 0 0 1-3.7-.7L4 20l1.5-3.4A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" /></svg></template>
              </WorkbenchQuickAction>
              <WorkbenchQuickAction tone="record" title="记录到店" :hint="`当前已到店 ${selectedCustomer.visitCount || 0} 次`" :disabled="saving" @click="recordVisit">
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" /></svg></template>
              </WorkbenchQuickAction>
              <WorkbenchQuickAction tone="requirement" title="客户诉求" hint="记录客户的诉求与排斥点" @click="requirementOpen = true">
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v14H4z" /><path d="M8 9h8M8 13h8M8 17h4" /></svg></template>
              </WorkbenchQuickAction>
              <WorkbenchQuickAction tone="outline" title="完整档案" hint="查看历史与低频资料" @click="openCustomer360(selectedCustomer)">
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h5M8 16h8" /></svg></template>
              </WorkbenchQuickAction>
              <WorkbenchQuickAction v-if="canSetDormant" tone="warn" title="暂不跟进" hint="设为休眠客户" @click="openDormantDialog">
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z" /></svg></template>
              </WorkbenchQuickAction>
              <WorkbenchQuickAction v-else-if="isDormantCustomer && canManageDormant" tone="success" title="恢复跟进" hint="回到休眠前的客户阶段" :disabled="saving" @click="resumeCustomer">
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 1-2.3-5.7M20 4v7h-7" /></svg></template>
              </WorkbenchQuickAction>
            </div>
            <p v-if="!canManageDormant" class="fu__guide-note">当前岗位可以联系客户、记录微信和到店；设置休眠由客户负责人、店长或企业负责人处理。</p>
          </section>
        </template>

        <WorkbenchState
          v-else-if="!queueCustomers.length"
          title="暂无待跟进操作"
          description="当前没有可跟进的客户，先处理新的客户任务或调整筛选条件。"
          min-height="320px"
        />
        <WorkbenchState
          v-else
          title="等待选择客户"
          description="选中客户后，这里会提示现在适合做什么，以及操作后客户资料会怎么更新。"
          min-height="320px"
        />
      </aside>
    </div>


    <RequirementFormDrawer
      v-model="requirementOpen"
      :customer-id="selectedCustomer?.id || ''"
      :customer-name="selectedCustomer?.name"
      :property-id="selectedPropertyId"
      :property-name="selectedProperty ? propertyTitle(selectedProperty) : ''"
      @saved="loadCustomerContext"
    />

    <el-drawer v-model="followOpen" title="写客户跟进" size="520px" direction="rtl" append-to-body>
      <CustomerPropertyContext :customer="selectedCustomer" :property="selectedProperty" />
      <p class="fu__drawer-section-title">沟通结果</p>
      <p class="fu__dialog-hint">{{ selectedCustomer?.name }} · 记录这次沟通结果，并约定下次什么时候再联系。</p>
      <el-form label-position="top">
        <el-form-item label="跟进方式">
          <el-select v-model="followForm.way" style="width: 100%">
            <el-option v-for="(label, value) in FOLLOW_WAY_LABELS" :key="value" :label="label" :value="value" />
          </el-select>
        </el-form-item>
        <el-form-item label="跟进内容" required>
          <el-input v-model="followForm.content" type="textarea" :rows="4" maxlength="500" show-word-limit placeholder="例如：电话确认周末带看时间，客户关注旧房拆除预算" />
        </el-form-item>
        <el-form-item label="下次跟进时间">
          <el-date-picker v-model="followForm.nextFollowAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="未安排可留空" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="followOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="!followForm.content.trim()" @click="saveFollow">保存跟进</el-button>
      </template>
    </el-drawer>

    <el-drawer v-model="measureAppointmentOpen" title="预约量房" size="580px" direction="rtl" append-to-body>
      <CustomerPropertyContext :customer="selectedCustomer" :property="selectedProperty" />
      <p class="fu__drawer-section-title">选择量房房屋</p>
      <p class="fu__dialog-hint">量房必须绑定具体房屋。可以在已有房屋中选择，也可以直接在这里建立新房屋。</p>
      <el-form label-position="top">
      <div v-if="properties.length && !measureAppointmentForm.creatingProperty" class="fu__measure-properties">
        <button
          v-for="property in properties"
          :key="property.id"
          type="button"
          class="fu__measure-property"
          :class="{ active: measureAppointmentForm.propertyId === property.id }"
          @click="measureAppointmentForm.propertyId = property.id"
        >
          <strong>{{ propertyTitle(property) }}</strong>
          <small>{{ propertySubtitle(property) }}</small>
        </button>
      </div>
      <button v-if="properties.length" class="fu__text-button" type="button" @click="toggleMeasurePropertyCreate">
        {{ measureAppointmentForm.creatingProperty ? '使用已有房屋' : '没有合适房屋，建立新房屋' }}
      </button>
      <div v-if="measureAppointmentForm.creatingProperty || !properties.length" class="fu__form-grid fu__measure-new-property">
        <el-form-item label="小区 / 楼盘">
          <el-input v-model="measureAppointmentForm.community" maxlength="64" placeholder="例如：荷塘家园" />
        </el-form-item>
        <el-form-item label="楼栋 / 单元">
          <el-input v-model="measureAppointmentForm.building" maxlength="32" placeholder="例如：3栋2单元" />
        </el-form-item>
        <el-form-item label="房号">
          <el-input v-model="measureAppointmentForm.roomNo" maxlength="32" placeholder="例如：1202" />
        </el-form-item>
        <el-form-item label="面积（㎡）">
          <el-input-number v-model="measureAppointmentForm.area" :min="0" :precision="2" :controls="false" style="width: 100%" />
        </el-form-item>
        <el-form-item label="详细地址" class="fu__form-wide" required>
          <el-input v-model="measureAppointmentForm.address" maxlength="128" placeholder="例如：合肥市蜀山区荷塘家园3栋1202室" />
        </el-form-item>
        <el-form-item label="户型">
          <el-input v-model="measureAppointmentForm.layout" maxlength="32" placeholder="例如：三室两厅" />
        </el-form-item>
      </div>
      <p class="fu__drawer-section-title">预约时间</p>
      <el-form-item label="约定量房时间" required>
        <el-date-picker v-model="measureAppointmentForm.measureAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="选择上门量房时间" style="width: 100%" />
      </el-form-item>
      </el-form>
      <el-alert type="info" :closable="false" title="预约成功后，客户会进入待我量房工作台；系统会自动打开并定位到本次客户与房屋。" show-icon />
      <template #footer>
        <el-button @click="measureAppointmentOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="!measureAppointmentForm.measureAt" @click="saveMeasureAppointment">确认预约并进入待我量房</el-button>
      </template>
    </el-drawer>

    <el-drawer v-model="customerEditOpen" title="编辑客户资料" size="560px" direction="rtl" append-to-body>
      <CustomerPropertyContext :customer="selectedCustomer" :property="selectedProperty" />
      <p class="fu__drawer-section-title">基本信息</p>
      <p class="fu__dialog-hint">客户阶段、添加微信、到店和量房事实请通过对应业务动作维护，这里只修改客户基础资料。</p>
      <el-form label-position="top" class="fu__customer-edit-form">
        <div class="fu__form-grid">
          <el-form-item label="客户姓名" required>
            <el-input v-model="profileForm.name" maxlength="32" />
          </el-form-item>
          <el-form-item label="手机号" required>
            <el-input v-model="profileForm.phone" maxlength="11" :disabled="Boolean(selectedCustomer?.lastFollowAt)" placeholder="11 位手机号" />
          </el-form-item>
          <el-form-item label="性别">
            <el-select v-model="profileForm.gender" style="width: 100%">
              <el-option label="男" value="M" />
              <el-option label="女" value="F" />
            </el-select>
          </el-form-item>
          <el-form-item label="客户来源">
            <el-select v-model="profileForm.source" clearable placeholder="请选择" style="width: 100%">
              <el-option v-for="option in CUSTOMER_SOURCE_OPTIONS" :key="option.value" :label="option.label" :value="option.value" />
            </el-select>
          </el-form-item>
        </div>
        <p class="fu__drawer-section-title">房屋与预算</p>
        <div class="fu__form-grid">
          <el-form-item label="意向小区">
            <el-input v-model="profileForm.community" maxlength="64" />
          </el-form-item>
          <el-form-item label="面积（㎡）">
            <el-input-number v-model="profileForm.area" :min="0" :precision="2" :controls="false" style="width: 100%" />
          </el-form-item>
          <el-form-item label="详细地址" class="fu__form-wide">
            <el-input v-model="profileForm.addr" maxlength="200" />
          </el-form-item>
          <el-form-item label="预算（万）">
            <el-input-number v-model="profileForm.budget" :min="0" :precision="2" :controls="false" style="width: 100%" />
          </el-form-item>
          <el-form-item label="备注" class="fu__form-wide">
            <el-input v-model="profileForm.remark" type="textarea" :rows="3" maxlength="200" show-word-limit />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="customerEditOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="!profileForm.name.trim() || !profileForm.phone" @click="saveCustomerEdit">保存客户资料</el-button>
      </template>
    </el-drawer>

    <el-drawer v-model="portraitOpen" title="完善客户画像" size="680px" direction="rtl" append-to-body>
      <CustomerPropertyContext :customer="selectedCustomer" :property="selectedProperty" />
      <p class="fu__drawer-section-title">画像信息</p>
      <p class="fu__dialog-hint">{{ selectedCustomer?.name }} · 已填写 {{ portraitFilledCount }}/10 项；不确定的留空即可。</p>
      <el-form label-position="top">
        <section v-for="section in PORTRAIT_SECTIONS" :key="section.title" class="fu__portrait-section">
          <h4>{{ section.title }}</h4>
          <div class="fu__portrait-form">
            <el-form-item v-for="key in section.keys" :key="key">
              <template #label>
                <span>{{ PORTRAIT_LABELS[key] }}</span>
                <small>{{ PORTRAIT_HINTS[key] }}</small>
              </template>
              <el-select v-model="portraitForm[key]" clearable placeholder="未填写" style="width: 100%">
                <el-option v-for="option in PORTRAIT_OPTIONS[key]" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
            </el-form-item>
          </div>
        </section>
        <section class="fu__portrait-section">
          <h4>主要顾虑</h4>
          <p class="fu__form-hint">可多选，决定后续异议处理和沟通重点。</p>
          <el-checkbox-group v-model="portraitConcerns" class="fu__concern-options">
            <el-checkbox v-for="option in PORTRAIT_CONCERN_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</el-checkbox>
          </el-checkbox-group>
        </section>
      </el-form>
      <template #footer>
        <el-button @click="portraitOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="savePortrait">保存画像</el-button>
      </template>
    </el-drawer>

    <el-drawer v-model="wechatOpen" title="记录客户微信" size="480px" direction="rtl" append-to-body>
      <CustomerPropertyContext :customer="selectedCustomer" :property="selectedProperty" />
      <p class="fu__drawer-section-title">微信信息</p>
      <p class="fu__dialog-hint">{{ selectedCustomer?.name }} · 客户已经添加微信时登记，微信号可以留空。</p>
      <el-form label-position="top">
        <el-form-item label="客户微信号（选填）">
          <el-input v-model="wechatNo" maxlength="64" placeholder="填写后方便团队统一查找" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="wechatOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveWechat">{{ selectedCustomer?.wechatAdded ? '保存微信信息' : '确认已加微信' }}</el-button>
      </template>
    </el-drawer>

    <el-drawer v-model="dormantOpen" title="设为休眠客户" size="520px" direction="rtl" append-to-body>
      <CustomerPropertyContext :customer="selectedCustomer" :property="selectedProperty" />
      <p class="fu__drawer-section-title">休眠设置</p>
      <p class="fu__dialog-hint">客户暂时不需要继续跟进时使用。休眠后不会再出现在待跟进提醒里，后续也可以恢复。</p>
      <el-form label-position="top">
        <el-form-item label="休眠原因" required>
          <el-select v-model="dormantForm.reasonCode" placeholder="请选择休眠原因" style="width: 100%">
            <el-option v-for="item in DORMANT_REASONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="dormantForm.reasonCode === 'Other'" label="补充说明" required>
          <el-input v-model="dormantForm.reasonText" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="请说明暂不跟进的原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dormantOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="!dormantForm.reasonCode || (dormantForm.reasonCode === 'Other' && !dormantForm.reasonText.trim())" @click="saveDormant">确认设为休眠</el-button>
      </template>
    </el-drawer>

    <PropertyFormDrawer
      v-if="selectedCustomer"
      v-model="propertyDrawerOpen"
      :customer-id="selectedCustomer.id"
      :customer-name="selectedCustomer.name"
      :property="editingProperty"
      @saved="onPropertySaved"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/workbench-shell' as wb;
.fu { display: flex; flex-direction: column; gap: $space-3; min-width: 0; }

.fu__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: $space-5;

  h1 { margin: 0; color: $text-primary; font-size: $font-display; letter-spacing: -.02em; }
  p { max-width: 920px; margin: $space-2 0 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
}

.fu__eyebrow {
  margin: 0 !important;
  color: $brand-600 !important;
  font-size: $font-caption !important;
  font-weight: $font-weight-semibold;
  letter-spacing: .1em;
}

.fu__head-meta { display: flex; align-items: center; flex-wrap: wrap; gap: $space-3; color: $text-secondary; font-size: $font-caption; }
.fu__head-meta b { color: $brand-700; font-size: $font-title; }
.fu__head-meta button,
.fu__section-head button,
.fu__secondary button,
.fu__empty-inline button,
.fu__guide-card--next button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-0;
  color: $text-secondary;
  font: inherit;
  cursor: pointer;
}
.fu__head-meta button:hover,
.fu__section-head button:hover,
.fu__secondary button:hover,
.fu__empty-inline button:hover,
.fu__guide-card--next button:hover { color: $brand-600; border-color: $brand-300; background: $brand-50; }
.fu__head-meta svg { width: 14px; height: 14px; }
.fu__head-meta .is-loading svg { animation: fu-spin .7s linear infinite; }
@keyframes fu-spin { to { transform: rotate(360deg); } }

.fu__tools {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: $space-3;
  padding: 12px;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
}
.fu__search { display: flex; flex-direction: column; gap: 6px; min-width: 280px; color: $text-secondary; font-size: $font-caption; }
.fu__search input { height: 36px; padding: 0 10px; border: 1px solid $border-color; border-radius: $radius-sm; color: $text-primary; background: $surface-0; font: inherit; }
.fu__filters { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.fu__filters button { display: inline-flex; align-items: center; gap: 6px; padding: 7px 11px; border: 1px solid $border-color; border-radius: $radius-pill; background: $surface-0; color: $text-secondary; font: inherit; font-size: $font-caption; cursor: pointer; }
.fu__filters button.active { border-color: $brand-300; background: $brand-50; color: $brand-700; }
.fu__filters small { color: $text-tertiary; font-variant-numeric: tabular-nums; }

.fu__layout { @include wb.workbench-layout(295px, 265px); }
.fu__queue { @include wb.workbench-queue; }
.fu__queue-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid $border-color; background: linear-gradient(135deg, $surface-50, $surface-0); }
.fu__queue-head div { display: flex; flex-direction: column; gap: 3px; }
.fu__queue-head strong { color: $text-primary; font-size: $font-body; }
.fu__queue-head small { color: $text-tertiary; font-size: $font-caption; }
.fu__queue-head > span { color: $brand-700; font-size: $font-title; font-weight: $font-weight-bold; }
.fu__queue-list { display: flex; flex-direction: column; @include wb.workbench-queue-scroll; }
.fu__queue-item {
  display: flex;
  flex-direction: column;
  gap: 7px;
  width: 100%;
  padding: 15px 16px;
  border: 0;
  border-bottom: 1px solid $border-color;
  background: $surface-0;
  text-align: left;
  cursor: pointer;
}
.fu__queue-item:last-child { border-bottom: 0; }
.fu__queue-item:hover { background: $surface-50; }
.fu__queue-item.active { background: $brand-50; box-shadow: inset 3px 0 0 $brand-500; }
.fu__queue-top,
.fu__queue-meta { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.fu__queue-top strong { min-width: 0; color: $text-primary; font-size: $font-body; }
.fu__queue-property { overflow: hidden; color: $text-secondary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
.fu__queue-meta small { color: $text-tertiary; font-size: $font-caption; }
.fu__queue-reason { color: $brand-700; font-size: $font-caption; font-weight: $font-weight-semibold; }

.fu__workspace { @include wb.workbench-workspace; }
.fu__identity { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-4; padding: $space-5; border: 1px solid $border-color; border-radius: $radius-lg; background: linear-gradient(135deg, $brand-50, $surface-0 65%); }
.fu__identity h2 { margin: 5px 0 0; color: $text-primary; font-size: $font-title; }
.fu__identity p { margin: 6px 0 0; color: $text-secondary; font-size: $font-body-sm; }
.fu__identity-tags { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.fu__facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: $space-3; }
.fu__facts article { min-width: 0; padding: 14px 15px; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; }
.fu__facts small { display: block; color: $text-tertiary; font-size: $font-caption; }
.fu__facts b { display: block; margin-top: 5px; overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }

.fu__hero-card { padding: 10px; border: 1px solid $border-color; border-radius: $radius-lg; background: linear-gradient(135deg, $brand-50, $surface-0 70%); }
.fu__hero-layer--identity { min-width: 0; }
.fu__hero-layer--focus { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-top: 8px; }
.fu__hero-layer--background { margin-top: 8px; }
.fu__focus-item { min-width: 0; padding: 7px 10px; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; }
.fu__focus-item small { display: inline; color: $text-tertiary; font-size: $font-caption; }
.fu__focus-item b { display: inline; margin-left: 6px; overflow: hidden; color: $text-primary; font-size: $font-body-sm; font-variant-numeric: tabular-nums; }
.fu__focus-item--danger { border-color: $status-blocked-border; background: $status-blocked-soft; }
.fu__focus-item--danger b { color: $status-blocked; }
.fu__focus-item--pending { border-color: $status-pending-border; background: $status-pending-soft; }
.fu__focus-item--pending b { color: $status-pending; }
.fu__focus-item--info { border-color: $status-info-border; background: $status-info-soft; }
.fu__focus-item--info b { color: $status-info; }
.fu__focus-item span { display: -webkit-box; overflow: hidden; margin-top: 3px; color: $text-secondary; font-size: $font-caption; line-height: 1.5; -webkit-box-orient: vertical; -webkit-line-clamp: 1; }
.fu__hero-top { display: flex; align-items: flex-start; gap: $space-3; }
.fu__hero-avatar { width: 50px; height: 50px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 50%; background: $brand-600; color: $surface-0; font-size: $font-title; font-weight: $font-weight-bold; }
.fu__hero-ident { flex: 1; min-width: 0; }
.fu__hero-name-row { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; }
.fu__hero-name-row h2 { margin: 0; color: $text-primary; font-size: $font-title; }
.fu__grade { padding: 3px 9px; border-radius: $radius-pill; font-size: $font-caption; font-weight: $font-weight-semibold; }
.fu__grade--a { color: $success-500; background: $success-50; }
.fu__grade--b { color: $warning-700; background: $warning-50; }
.fu__grade--c { color: $text-secondary; background: $surface-100; }
.fu__grade--none { color: $text-tertiary; background: $surface-100; }
.fu__hero-contact { margin: 5px 0 0; color: $text-secondary; font-size: $font-body-sm; }
.fu__hero-facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; }
.fu__hero-facts > div { min-width: 0; padding: 6px 8px; border-radius: $radius-sm; background: rgba(255, 255, 255, .72); }
.fu__hero-facts small { display: block; color: $text-tertiary; font-size: $font-caption; }
.fu__hero-facts b { display: block; margin-top: 3px; overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
.fu__portrait-strip { margin-top: 6px; padding-top: 6px; border-top: 1px solid $border-color; }
.fu__portrait-head { display: flex; align-items: center; justify-content: space-between; gap: $space-3; }
.fu__portrait-head strong { color: $text-primary; font-size: $font-body-sm; }
.fu__portrait-head small { display: block; margin-top: 2px; color: $text-tertiary; font-size: $font-caption; }
.fu__portrait-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: $space-2; }
.fu__portrait-chips > span { display: inline-flex; align-items: center; gap: 5px; padding: 5px 8px; border-radius: $radius-pill; background: $surface-0; color: $text-secondary; font-size: $font-caption; }
.fu__portrait-chips small { color: $text-tertiary; }
.fu__portrait-empty { margin: $space-2 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.fu__hero-footer { display: flex; align-items: center; justify-content: space-between; gap: $space-3; margin-top: $space-3; padding-top: $space-3; border-top: 1px solid $border-color; }
.fu__hero-footer > div { min-width: 0; }
.fu__hero-footer small { display: block; color: $text-tertiary; font-size: $font-caption; }
.fu__hero-footer b { display: block; margin-top: 3px; color: $text-secondary; font-size: $font-body-sm; font-weight: $font-weight-medium; }
.fu__hero-edit { display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto; padding: 8px 12px; border: 1px solid $brand-300; border-radius: $radius-sm; background: $brand-50; color: $brand-700; font: inherit; font-size: $font-caption; font-weight: $font-weight-semibold; cursor: pointer; }
.fu__hero-edit:hover { border-color: $brand-500; background: $brand-100; }
.fu__hero-edit svg { width: 15px; height: 15px; }
.fu__text-button { padding: 0; border: 0; background: transparent; color: $brand-600; font: inherit; font-size: $font-caption; font-weight: $font-weight-semibold; cursor: pointer; }
.fu__context-card { display: flex; flex-direction: column; gap: $space-4; padding: $space-4; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.fu__context-col { min-width: 0; }
.fu__context-col + .fu__context-col { padding-top: $space-4; border-top: 1px solid $border-color; }
.fu__context-head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; margin-bottom: $space-3; }
.fu__context-head strong { color: $text-primary; font-size: $font-body; }
.fu__context-head small { display: block; margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }
.fu__context-head button { display: inline-flex; align-items: center; gap: 5px; flex: 0 0 auto; padding: 6px 9px; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; color: $brand-600; font: inherit; font-size: $font-caption; cursor: pointer; }
.fu__context-head button:hover { border-color: $brand-300; background: $brand-50; }
.fu__guide-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; }
.fu__guide-title-row h3 { margin: 3px 0 0; color: $text-primary; font-size: $font-body; }
.fu__guide-order { padding: 3px 8px; border-radius: $radius-pill; background: $surface-100; color: $text-tertiary; font-size: $font-caption; }
.fu__follow-reminder { display: flex; align-items: center; justify-content: space-between; gap: $space-2; margin-top: 8px; padding: 7px 9px; border-radius: $radius-sm; }
.fu__follow-reminder strong { font-size: $font-body-sm; }
.fu__follow-reminder small { color: inherit; font-size: 11px; }
.fu__follow-reminder--danger { color: $danger-500; background: $danger-50; }
.fu__follow-reminder--pending { color: $warning-700; background: $warning-50; }
.fu__follow-reminder--info { color: $brand-700; background: $brand-50; }
.fu__guide-reason { margin-top: 8px !important; display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.fu__guide-inline { display: flex; align-items: center; gap: 6px; margin-top: 6px; padding: 6px 8px; border-radius: $radius-sm; background: $surface-50; }
.fu__guide-inline span { color: $text-tertiary; font-size: $font-caption; }
.fu__guide-inline b { color: $brand-700; font-size: $font-body-sm; }
.fu__actions-head { margin-bottom: 6px; }
.fu__actions-head h4 { margin: 0; }
.fu__actions-head small { display: block; margin-top: 2px; color: $text-tertiary; font-size: 10px; }
.fu__next-inline { display: flex; align-items: center; justify-content: space-between; gap: $space-2; margin-top: 7px; padding-top: 7px; border-top: 1px solid $border-color; color: $text-tertiary; font-size: $font-caption; }
.fu__next-inline button { padding: 0; border: 0; background: transparent; color: $brand-600; font: inherit; font-size: $font-caption; font-weight: $font-weight-semibold; cursor: pointer; }
.fu__portrait-section { padding: $space-3 0; border-bottom: 1px solid $border-color; }
.fu__portrait-section:last-child { border-bottom: 0; }
.fu__portrait-section h4 { margin: 0 0 $space-3; color: $text-primary; font-size: $font-body-sm; }
.fu__portrait-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 $space-3; }
.fu__portrait-form :deep(.el-form-item) { margin-bottom: $space-3; }
.fu__portrait-form :deep(.el-form-item__label) { display: flex; align-items: baseline; justify-content: space-between; gap: $space-2; width: 100%; }
.fu__portrait-form :deep(.el-form-item__label small) { color: $text-tertiary; font-weight: $font-weight-regular; }
.fu__form-hint { margin: 0 0 $space-2; color: $text-tertiary; font-size: $font-caption; }
.fu__section { padding: $space-4; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.fu__section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-4; margin-bottom: $space-3; }
.fu__overview-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: $space-3; }
.fu__overview-grid > div { min-width: 0; padding: 11px 12px; border-radius: $radius-md; background: $surface-50; }
.fu__overview-grid small { display: block; color: $text-tertiary; font-size: $font-caption; }
.fu__overview-grid b { display: block; margin-top: 4px; overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
.fu__chip-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: $space-3; }
.fu__portrait-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: $space-2; }
.fu__portrait-item { min-width: 0; padding: 11px 12px; border-radius: $radius-md; background: $surface-50; }
.fu__portrait-item small { display: block; color: $text-tertiary; font-size: $font-caption; }
.fu__portrait-item b { display: block; margin-top: 4px; overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
.fu__section-head h3 { margin: 0; color: $text-primary; font-size: $font-body; }
.fu__section-head p { margin: 4px 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.fu__empty-inline { display: flex; flex-direction: column; align-items: flex-start; gap: 7px; padding: $space-4; border-radius: $radius-md; background: $surface-50; }
.fu__context-head button svg,
.fu__empty-inline button svg,
.fu__property-action svg { width: 13px; height: 13px; flex: 0 0 auto; }
.fu__empty-inline strong { color: $text-primary; }
.fu__empty-inline span { color: $text-secondary; font-size: $font-body-sm; line-height: 1.6; }
.fu__properties { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-2; }
.fu__property { position: relative; display: flex; flex-direction: column; gap: 5px; padding: 13px 14px; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; text-align: left; cursor: pointer; }
.fu__property:hover { border-color: $brand-300; background: $brand-50; }
.fu__property.active { border-color: $brand-500; box-shadow: 0 0 0 2px $brand-100; }
.fu__property-main { display: flex; flex-direction: column; gap: 5px; }
.fu__property-title { color: $text-primary; font-size: $font-body-sm; font-weight: $font-weight-semibold; }
.fu__property-sub { overflow: hidden; color: $text-secondary; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; }
.fu__property-status { color: $brand-700; font-size: $font-caption; }
.fu__property-actions { display: flex; gap: $space-2; margin-top: 4px; }
.fu__property-action { display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: transparent; color: $brand-600; font: inherit; font-size: $font-caption; cursor: pointer; }
.fu__property-action:disabled { cursor: not-allowed; opacity: .6; }
.fu__property-action--danger { color: $danger-500; }
.fu__requirements { display: flex; flex-direction: column; gap: $space-2; }
.fu__requirement { display: flex; flex-direction: column; gap: 3px; padding: 7px 9px; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; }
.fu__requirement > div { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.fu__requirement strong { overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
.fu__requirement small { color: $text-tertiary; font-size: $font-caption; }
.fu__requirement p { display: -webkit-box; overflow: hidden; margin: 0; color: $text-secondary; font-size: $font-caption; line-height: 1.5; -webkit-box-orient: vertical; -webkit-line-clamp: 1; }
.fu__requirement-more { margin: 2px 0 0; color: $text-tertiary; font-size: $font-caption; }
.fu__follows { display: flex; flex-direction: column; gap: $space-2; }
.fu__follow { padding: 13px 14px; border-radius: $radius-md; background: $surface-50; }
.fu__follow > div { display: flex; align-items: center; justify-content: space-between; gap: $space-3; }
.fu__follow strong { color: $text-primary; font-size: $font-body-sm; }
.fu__follow span,
.fu__follow small { color: $text-tertiary; font-size: $font-caption; }
.fu__follow p { margin: 6px 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.6; }

.fu__guide { @include wb.workbench-guide; }
.fu__guide-card { padding: 12px; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.fu__guide-card--primary { border-color: $brand-200; background: linear-gradient(135deg, $surface-0, $brand-50); }
.fu__guide-card--primary h3 { margin: 4px 0 0; color: $text-primary; font-size: $font-body; }
.fu__guide-card h4 { margin: 0 0 8px; color: $text-primary; font-size: $font-body; }
.fu__guide-card p { margin: 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
.fu__guide-label { margin-top: 5px !important; color: $brand-700 !important; font-weight: $font-weight-semibold; }
.fu__guide-card dl { display: grid; gap: $space-3; margin: $space-3 0 0; }
.fu__guide-card dl div { display: grid; gap: 3px; }
.fu__guide-card dt { color: $text-tertiary; font-size: $font-caption; }
.fu__guide-card dd { margin: 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.6; }
.fu__guide-card ul { margin: 0; padding-left: 18px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.8; }
.fu__guide-note { margin-top: 5px !important; color: $text-tertiary !important; font-size: 10px !important; line-height: 1.35; }
.fu__primary { width: 100%; margin-top: 8px; padding: 11px 16px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 0; border-radius: $radius-sm; background: $brand-600; color: $surface-0; font: inherit; font-weight: $font-weight-semibold; cursor: pointer; }
.fu__primary:hover { background: $brand-700; }
.fu__action-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.fu__quick { display: flex; align-items: center; gap: 7px; min-width: 0; min-height: 50px; padding: 7px 8px; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; color: $text-secondary; text-align: left; font: inherit; cursor: pointer; }
.fu__quick:hover { border-color: $brand-300; background: $brand-50; }
.fu__quick:disabled { cursor: not-allowed; opacity: .55; }
.fu__quick--quiet { border-style: dashed; }
.fu__quick--call .fu__quick-icon { color: $brand-600; background: $brand-50; }
.fu__quick--contact .fu__quick-icon { color: $success-500; background: $success-50; }
.fu__quick--visit .fu__quick-icon { color: $warning-700; background: $warning-50; }
.fu__quick--measure .fu__quick-icon { color: $brand-700; background: $brand-100; }
.fu__quick--primary { grid-column: 1 / -1; border-color: $brand-500; background: linear-gradient(135deg, $brand-50, $surface-0 70%); box-shadow: inset 0 0 0 1px $brand-200; }
.fu__quick--primary .fu__quick-icon { color: $surface-0; background: $brand-600; }
.fu__quick--primary strong { color: $brand-700; font-size: $font-body-sm; }
.fu__quick--primary:hover { border-color: $brand-600; background: linear-gradient(135deg, $brand-100, $surface-0 70%); }
.fu__quick--outline .fu__quick-icon { color: $text-secondary; background: $surface-100; }
.fu__quick--requirement .fu__quick-icon { color: $status-special; background: $status-special-soft; }
.fu__quick--warn { border-color: $warning-200; background: $warning-50; }
.fu__quick--warn .fu__quick-icon { color: $warning-700; background: $warning-200; }
.fu__quick--success { border-color: $success-500; background: $success-50; }
.fu__quick--success .fu__quick-icon { color: $success-500; background: #d9f2e5; }
.fu__primary svg { width: 15px; height: 15px; }
.fu__quick-icon { display: grid; place-items: center; width: 27px; height: 27px; flex: 0 0 auto; border-radius: $radius-sm; background: $brand-50; color: $brand-600; }
.fu__quick-icon svg { width: 16px; height: 16px; }
.fu__quick > span:last-child { display: flex; flex-direction: column; min-width: 0; gap: 3px; }
.fu__quick strong, .fu__quick small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fu__quick strong { color: $text-primary; font-size: $font-caption; font-weight: $font-weight-semibold; }
.fu__quick small { color: $text-tertiary; font-size: 11px; line-height: 1.35; }
.fu__secondary { display: flex; flex-wrap: wrap; gap: $space-2; }
.fu__guide-card--next { display: flex; align-items: center; justify-content: space-between; gap: $space-3; }
.fu__guide-card--next p { flex: 1; }
.fu__drawer-section-title { margin: $space-4 0 0; color: $text-primary; font-size: $font-body-sm; font-weight: $font-weight-semibold; }
.fu__measure-properties { display: flex; flex-direction: column; gap: 7px; margin-bottom: $space-2; }
.fu__measure-property { display: flex; flex-direction: column; gap: 4px; padding: 10px 11px; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; color: $text-secondary; text-align: left; font: inherit; cursor: pointer; }
.fu__measure-property.active { border-color: $brand-500; background: $brand-50; box-shadow: 0 0 0 2px $brand-100; }
.fu__measure-property strong { color: $text-primary; font-size: $font-body-sm; }
.fu__measure-property small { color: $text-tertiary; font-size: $font-caption; }
.fu__form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 $space-3; }
.fu__form-wide { grid-column: 1 / -1; }
.fu__concern-options { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 4px; }
.fu__concern-options :deep(.el-checkbox) { margin-right: 0; padding: 6px 9px; border: 1px solid $border-color; border-radius: $radius-pill; background: $surface-0; }
.fu__concern-options :deep(.el-checkbox.is-checked) { border-color: $brand-400; background: $brand-50; }
.fu__concern-options :deep(.el-checkbox__label) { padding-left: 5px; color: $text-secondary; font-size: $font-caption; }
.fu__dialog-hint { margin: $space-2 0 $space-4; padding: $space-3; border-radius: $radius-md; background: $brand-50; color: $text-secondary; font-size: $font-body-sm; line-height: 1.6; }

.fu__skeleton { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: $space-4; }
.fu__skeleton span { height: 180px; border-radius: $radius-md; background: linear-gradient(90deg, $surface-100 25%, $surface-50 37%, $surface-100 63%); background-size: 400% 100%; animation: fu-shimmer 1.4s ease infinite; }
@keyframes fu-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }

@media (max-width: 1300px) {
  .fu__head { align-items: center; }
  .fu__head > div:first-child > p:last-child { display: none; }
}
@media (max-width: 1024px) {
  .fu__tools { align-items: stretch; flex-direction: column; }
  .fu__filters { justify-content: flex-start; }
  .fu__facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fu__overview-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fu__portrait-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fu__hero-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fu__hero-layer--focus { grid-template-columns: 1fr; }
  .fu__portrait-form { grid-template-columns: 1fr; }
  .fu__form-grid { grid-template-columns: 1fr; }
  .fu__form-wide { grid-column: auto; }
}
</style>
