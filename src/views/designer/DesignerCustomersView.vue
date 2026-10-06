<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import MoneyText from '@/components/MoneyText.vue'
import { crmApi, type CustomerPageQuery } from '@/domains/crm/api'
import type { Customer, CustomerFollow, CustomerStage, FollowWay } from '@/domains/crm/model'
import { propertyApi } from '@/domains/property/api'
import type { Measure, Property, PropertyStatus } from '@/domains/property/model'
import { designApi } from '@/domains/design/api'
import type { DesignScheme, DesignStatus, RequirementCategory, RequirementKind, RequirementPriority } from '@/domains/design/model'
import { formatDateTime } from '@/core/format'
import type { StatusTone } from '@/core/tone'

const router = useRouter()

const STAGE_META: Record<CustomerStage, { label: string; tone: StatusTone }> = {
  intention: { label: '意向', tone: 'todo' },
  following: { label: '跟进中', tone: 'doing' },
  pendingMeasure: { label: '待量房', tone: 'info' },
  quote: { label: '已报价', tone: 'pending' },
  sign: { label: '已签约', tone: 'done' },
  construction: { label: '施工中', tone: 'alert' },
  done: { label: '已完工', tone: 'dark' },
  lost: { label: '已流失', tone: 'closed' }
}

const DESIGN_STATUS_META: Record<DesignStatus, { label: string; tone: StatusTone }> = {
  draft: { label: '草稿', tone: 'todo' },
  ready: { label: '方案完成', tone: 'done' },
  presented: { label: '已汇报', tone: 'progress' },
  selected: { label: '客户已选', tone: 'special' },
  archived: { label: '已归档', tone: 'muted' }
}

const MEASURE_STATUS_META: Record<Measure['status'], { label: string; tone: StatusTone }> = {
  scheduled: { label: '待量房', tone: 'info' },
  completed: { label: '已量房', tone: 'done' },
  cancelled: { label: '已取消', tone: 'closed' }
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

const REQUIREMENT_CATEGORY_LABELS: Record<RequirementCategory, string> = {
  function: '功能',
  style: '风格',
  material: '材料',
  budget: '预算',
  schedule: '工期',
  quality: '品质',
  other: '其他'
}

const REQUIREMENT_PRIORITY_LABELS: Record<RequirementPriority, string> = {
  high: '高优先',
  medium: '中优先',
  low: '低优先'
}

const stageOptions: Array<{ value: CustomerStage | ''; label: string }> = [
  { value: '', label: '全部阶段' },
  { value: 'intention', label: '意向' },
  { value: 'following', label: '跟进中' },
  { value: 'pendingMeasure', label: '待量房' },
  { value: 'quote', label: '已报价' },
  { value: 'sign', label: '已签约' }
]

const followWays: Array<{ value: FollowWay; label: string }> = [
  { value: 'phone', label: '电话' },
  { value: 'visit', label: '到店' },
  { value: 'wechat', label: '微信' },
  { value: 'video', label: '视频' },
  { value: 'other', label: '其他' }
]

const requirementCategories: Array<{ value: RequirementCategory; label: string }> = [
  { value: 'function', label: '功能' },
  { value: 'style', label: '风格' },
  { value: 'material', label: '材料' },
  { value: 'budget', label: '预算' },
  { value: 'schedule', label: '工期' },
  { value: 'quality', label: '品质' },
  { value: 'other', label: '其他' }
]

const requirementPriorities: Array<{ value: RequirementPriority; label: string }> = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' }
]

const loading = ref(false)
const error = ref('')
const partialError = ref('')
const customers = ref<Customer[]>([])
const keyword = ref('')
const stageFilter = ref<CustomerStage | ''>('')
const selectedCustomerId = ref('')
const selectedCustomer = ref<Customer | null>(null)
const properties = ref<Property[]>([])
const selectedPropertyId = ref('')
const measures = ref<Measure[]>([])
const schemes = ref<DesignScheme[]>([])
const selectedSchemeId = ref('')
const selectedScheme = ref<DesignScheme | null>(null)
const follows = ref<CustomerFollow[]>([])

const followVisible = ref(false)
const measureVisible = ref(false)
const measureResultVisible = ref(false)
const schemeVisible = ref(false)
const requirementVisible = ref(false)
const saving = ref(false)
const actionError = ref('')

const followForm = reactive<{ way: FollowWay; content: string; nextFollowAt: string }>({
  way: 'phone',
  content: '',
  nextFollowAt: ''
})

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

const schemeForm = reactive<{ name: string; style: string; layout: string; description: string }>({
  name: '',
  style: '',
  layout: '',
  description: ''
})

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

const requirements = computed(() => selectedScheme.value?.requirements ?? [])

const filteredCustomers = computed(() => {
  const needle = keyword.value.trim().toLowerCase()
  return customers.value.filter((customer) => {
    if (stageFilter.value && customer.stage !== stageFilter.value) return false
    if (!needle) return true
    return [customer.name, customer.phone, customer.community, customer.addr]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle))
  })
})

function propertyLabel(property: Property): string {
  return property.community || property.address || [property.building, property.roomNo].filter(Boolean).join(' ') || '房屋待完善'
}

function customerSubtitle(customer: Customer): string {
  return [customer.community, customer.addr].filter(Boolean).join(' · ') || '地址待补充'
}

function nextAction(customer: Customer): string {
  if (customer.stage === 'intention') return '完成首次跟进'
  if (customer.stage === 'following') return '推进量房'
  if (customer.stage === 'pendingMeasure') return '完成量房与诉求记录'
  if (customer.stage === 'quote') return '跟进报价决策'
  if (customer.stage === 'sign') return '项目排期协同'
  return '查看客户事实'
}

function selectCustomer(customer: Customer): void {
  selectedCustomerId.value = customer.id
  void loadCustomerWorkspace(customer.id)
}

function selectProperty(property: Property): void {
  selectedPropertyId.value = property.id
  selectedSchemeId.value = ''
  selectedScheme.value = null
  void loadMeasures(property.id)
  void loadSchemes(selectedCustomerId.value)
}

function selectScheme(scheme: DesignScheme): void {
  selectedSchemeId.value = scheme.id
  void loadSchemeDetail(scheme.id)
}

async function loadCustomers(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const query: CustomerPageQuery = { keyword: keyword.value.trim() || undefined, stage: stageFilter.value || undefined, size: 200 }
    customers.value = await crmApi.pageCustomers(query)
    if (!selectedCustomerId.value && customers.value.length > 0) {
      await loadCustomerWorkspace(customers.value[0].id)
    } else if (selectedCustomerId.value && !customers.value.some((item) => item.id === selectedCustomerId.value)) {
      selectedCustomerId.value = ''
      selectedCustomer.value = null
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '客户列表暂不可确认'
  } finally {
    loading.value = false
  }
}

async function loadCustomerWorkspace(customerId: string): Promise<void> {
  selectedCustomerId.value = customerId
  partialError.value = ''
  loading.value = true
  try {
    const [customerResult, propertyResult, schemeResult, followResult] = await Promise.allSettled([
      crmApi.customerInfo(customerId),
      propertyApi.listProperties(customerId),
      designApi.listSchemes(customerId),
      crmApi.customerFollows(customerId)
    ])
    if (customerResult.status === 'fulfilled') selectedCustomer.value = customerResult.value
    if (propertyResult.status === 'fulfilled') {
      properties.value = propertyResult.value
      selectedPropertyId.value = properties.value[0]?.id ?? ''
    }
    if (schemeResult.status === 'fulfilled') {
      schemes.value = schemeResult.value
      if (selectedPropertyId.value) {
        const first = schemes.value.find((item) => item.propertyId === selectedPropertyId.value) ?? schemes.value[0]
        selectedSchemeId.value = first?.id ?? ''
        selectedScheme.value = first ?? null
        if (first) void loadSchemeDetail(first.id)
      }
    }
    if (followResult.status === 'fulfilled') follows.value = followResult.value
    const rejected = [customerResult, propertyResult, schemeResult, followResult].filter((item) => item.status === 'rejected')
    if (rejected.length) partialError.value = '部分客户与设计数据加载失败，当前页面可能不完整，请刷新重试。'
    if (selectedPropertyId.value) await loadMeasures(selectedPropertyId.value)
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

async function loadSchemes(customerId: string): Promise<void> {
  if (!customerId) return
  try {
    schemes.value = await designApi.listSchemes(customerId)
    const first = schemes.value.find((item) => item.propertyId === selectedPropertyId.value) ?? schemes.value[0]
    selectedSchemeId.value = first?.id ?? ''
    if (first) await loadSchemeDetail(first.id)
  } catch {
    schemes.value = []
  }
}

async function loadSchemeDetail(designId: string): Promise<void> {
  try {
    selectedScheme.value = await designApi.schemeInfo(designId)
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '设计方案详情暂不可确认'
  }
}

async function saveFollow(): Promise<void> {
  if (!selectedCustomer.value || !followForm.content.trim()) return
  saving.value = true
  actionError.value = ''
  try {
    await crmApi.saveFollow({
      customerId: selectedCustomer.value.id,
      way: followForm.way,
      content: followForm.content.trim(),
      nextFollowAt: followForm.nextFollowAt || undefined
    })
    followVisible.value = false
    followForm.content = ''
    followForm.nextFollowAt = ''
    follows.value = await crmApi.customerFollows(selectedCustomer.value.id)
    ElMessage.success('跟进已记录')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '跟进保存失败'
  } finally {
    saving.value = false
  }
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
      designerConclusion: measureResultForm.designerConclusion || undefined
    })
    measureResultVisible.value = false
    await loadMeasures(selectedProperty.value.id)
    ElMessage.success('量房结论已保存')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '量房结论保存失败'
  } finally {
    saving.value = false
  }
}

async function createScheme(): Promise<void> {
  if (!selectedCustomer.value || !selectedProperty.value || !schemeForm.name.trim()) return
  saving.value = true
  actionError.value = ''
  try {
    const scheme = await designApi.saveScheme({
      customerId: selectedCustomer.value.id,
      propertyId: selectedProperty.value.id,
      name: schemeForm.name.trim(),
      style: schemeForm.style || undefined,
      layout: schemeForm.layout || undefined,
      description: schemeForm.description || undefined
    })
    schemeVisible.value = false
    schemeForm.name = ''
    schemeForm.style = ''
    schemeForm.layout = ''
    schemeForm.description = ''
    schemes.value = await designApi.listSchemes(selectedCustomer.value.id)
    selectedSchemeId.value = scheme.id
    selectedScheme.value = scheme
    ElMessage.success('设计方案已创建')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '设计方案创建失败'
  } finally {
    saving.value = false
  }
}

async function advanceScheme(status: DesignStatus): Promise<void> {
  if (!selectedScheme.value) return
  saving.value = true
  actionError.value = ''
  try {
    const updated = await designApi.buildScheme(selectedScheme.value.id, status)
    selectedScheme.value = updated
    schemes.value = schemes.value.map((item) => item.id === updated.id ? updated : item)
    ElMessage.success(`方案已推进为「${DESIGN_STATUS_META[status].label}」`)
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '方案状态推进失败'
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
    ElMessage.success('设计诉求已记录')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '设计诉求保存失败'
  } finally {
    saving.value = false
  }
}

onMounted(loadCustomers)
</script>

<template>
  <div class="cd">
    <header class="cd__head">
      <div>
        <p class="cd__eyebrow">CUSTOMER · DESIGN · MEASURE</p>
        <h2>客户与设计</h2>
        <p>围绕本人负责的客户与房屋推进跟进、量房和设计方案；不展示其他设计师的客户，也不展示成本与利润。</p>
      </div>
      <div class="cd__filters">
        <el-input v-model="keyword" clearable placeholder="搜索客户、手机号、小区" @keyup.enter="loadCustomers" />
        <el-select v-model="stageFilter" placeholder="全部阶段" clearable @change="loadCustomers">
          <el-option v-for="item in stageOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-button type="primary" @click="loadCustomers">刷新</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <el-alert v-if="partialError" type="warning" :closable="false" :title="partialError" show-icon />
    <el-alert v-if="actionError" type="error" :closable="false" :title="actionError" show-icon />

    <div class="cd__layout">
      <aside class="cd__pool">
        <div class="cd__pool-head">
          <strong>我的客户</strong>
          <span>{{ filteredCustomers.length }} 位</span>
        </div>
        <div v-if="loading && !customers.length" class="cd__loading"><el-skeleton :rows="6" animated /></div>
        <EmptyState v-else-if="!filteredCustomers.length" title="没有符合条件的客户" description="切换筛选条件或刷新服务端数据。" action-text="刷新" @action="loadCustomers" />
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
            <StatusTag :tone="STAGE_META[customer.stage].tone" :text="STAGE_META[customer.stage].label" />
          </span>
          <span>{{ customerSubtitle(customer) }}</span>
          <span class="cd__customer-foot">
            <small>{{ customer.phone || '电话待补充' }}</small>
            <b v-if="customer.grade">{{ customer.grade }} 级</b>
          </span>
        </button>
      </aside>

      <main class="cd__workspace">
        <template v-if="selectedCustomer">
          <section class="cd__identity">
            <div>
              <p class="cd__eyebrow">CUSTOMER 360</p>
              <h3>{{ selectedCustomer.name }} <StatusTag :tone="STAGE_META[selectedCustomer.stage].tone" :text="STAGE_META[selectedCustomer.stage].label" /></h3>
              <p>{{ selectedCustomer.phone || '电话待补充' }} · {{ customerSubtitle(selectedCustomer) }}</p>
            </div>
            <div class="cd__facts">
              <span><small>预算</small><MoneyText :value="selectedCustomer.budget" /></span>
              <span><small>面积</small><b>{{ selectedCustomer.area ? `${selectedCustomer.area}㎡` : '暂不可确认' }}</b></span>
              <span><small>设计师</small><b>{{ selectedCustomer.designerName || '本人负责' }}</b></span>
              <span><small>下次跟进</small><b>{{ formatDateTime(selectedCustomer.nextFollowAt) }}</b></span>
            </div>
          </section>

          <section class="cd__properties">
            <div class="cd__section-head">
              <div><h4>房屋</h4><p>同一客户多房屋必须显式选择当前房屋，量房与方案均以当前房屋为准。</p></div>
            </div>
            <div v-if="!properties.length" class="cd__inline-empty">当前客户还没有房屋记录。</div>
            <div v-else class="cd__property-tabs">
              <button
                v-for="property in properties"
                :key="property.id"
                type="button"
                :class="{ active: property.id === selectedPropertyId }"
                @click="selectProperty(property)"
              >
                <strong>{{ propertyLabel(property) }}</strong>
                <small>{{ property.area ? `${property.area}㎡` : '面积待补充' }} · {{ PROPERTY_STATUS_LABELS[property.status] }}</small>
              </button>
            </div>
          </section>

          <section class="cd__measure">
            <div class="cd__section-head">
              <div><h4>量房</h4><p>量房结论与客户诉求是设计方案的输入；没有量房时不得伪装方案完成。</p></div>
              <el-button size="small" :disabled="!selectedProperty" @click="measureResultVisible = true">登记量房结论</el-button>
            </div>
            <div v-if="selectedMeasure" class="cd__measure-card">
              <div class="cd__measure-top">
                <StatusTag :tone="MEASURE_STATUS_META[selectedMeasure.status].tone" :text="MEASURE_STATUS_META[selectedMeasure.status].label" />
                <span>{{ formatDateTime(selectedMeasure.measureTime || selectedMeasure.createdAt) }}</span>
              </div>
              <dl>
                <div><dt>原始结构</dt><dd>{{ selectedMeasure.originalStructure || '暂不可确认' }}</dd></div>
                <div><dt>尺寸记录</dt><dd>{{ selectedMeasure.dimensions || '暂不可确认' }}</dd></div>
                <div><dt>客户诉求</dt><dd>{{ selectedMeasure.customerRequirements || '暂不可确认' }}</dd></div>
                <div><dt>设计师结论</dt><dd>{{ selectedMeasure.designerConclusion || '暂不可确认' }}</dd></div>
              </dl>
            </div>
            <EmptyState v-else title="当前房屋还没有量房记录" description="可以先安排量房，量房完成后再登记结论与诉求。" action-text="安排量房" @action="measureVisible = true" />
          </section>

          <section class="cd__schemes">
            <div class="cd__section-head">
              <div><h4>设计与方案</h4><p>方案状态推进：草稿 → 方案完成 → 已汇报 → 客户已选。</p></div>
              <el-button size="small" type="primary" :disabled="!selectedProperty" @click="schemeVisible = true">新建方案</el-button>
            </div>
            <div v-if="!schemes.length" class="cd__inline-empty">当前客户还没有设计方案。</div>
            <div v-else class="cd__scheme-list">
              <button
                v-for="scheme in schemes"
                :key="scheme.id"
                type="button"
                class="cd__scheme"
                :class="{ active: scheme.id === selectedSchemeId }"
                @click="selectScheme(scheme)"
              >
                <span>
                  <strong>{{ scheme.name || '方案待命名' }}</strong>
                  <small>V{{ scheme.version }} · {{ scheme.area ? `${scheme.area}㎡` : '面积待补充' }}</small>
                </span>
                <StatusTag :tone="DESIGN_STATUS_META[scheme.status].tone" :text="DESIGN_STATUS_META[scheme.status].label" />
              </button>
            </div>
            <div v-if="selectedScheme" class="cd__scheme-detail">
              <div class="cd__scheme-summary">
                <div><small>版本</small><b>V{{ selectedScheme.version }}</b></div>
                <div><small>空间</small><b>{{ selectedScheme.spaceCount }} 个</b></div>
                <div><small>设计项</small><b>{{ selectedScheme.itemCount }} 项</b></div>
                <div><small>状态</small><StatusTag :tone="DESIGN_STATUS_META[selectedScheme.status].tone" :text="DESIGN_STATUS_META[selectedScheme.status].label" /></div>
              </div>
              <p class="cd__scheme-desc">{{ selectedScheme.description || '方案说明待补充。' }}</p>
              <div class="cd__scheme-actions">
                <el-button size="small" :loading="saving" :disabled="selectedScheme.status !== 'draft'" @click="advanceScheme('ready')">标记方案完成</el-button>
                <el-button size="small" :loading="saving" :disabled="selectedScheme.status !== 'ready'" @click="advanceScheme('presented')">标记已汇报</el-button>
                <el-button size="small" :loading="saving" :disabled="selectedScheme.status !== 'presented'" @click="advanceScheme('selected')">标记客户已选</el-button>
                <el-button size="small" type="primary" plain @click="requirementVisible = true">记录设计诉求</el-button>
                <el-button size="small" type="primary" @click="router.push(`/designer/design/${selectedScheme.id}`)">打开设计工作区</el-button>
              </div>
            </div>
          </section>

          <section v-if="selectedScheme" class="cd__requirements">
            <div class="cd__section-head"><div><h4>设计诉求与排斥点</h4><p>诉求是客户事实，不能由设计师自行补造。</p></div></div>
            <div v-if="!requirements.length" class="cd__inline-empty">当前方案还没有结构化诉求。</div>
            <div v-else class="cd__requirement-list">
              <article v-for="item in requirements" :key="item.id">
                <div><strong>{{ item.title }}</strong><StatusTag tone="info" :text="item.spaceName || '全局'" /></div>
                <p>{{ item.detail || '暂无补充说明' }}</p>
                <small>{{ item.kind === 'demand' ? '诉求' : '排斥点' }} · {{ REQUIREMENT_CATEGORY_LABELS[item.category] }} · {{ REQUIREMENT_PRIORITY_LABELS[item.priority] }}</small>
              </article>
            </div>
          </section>
        </template>
        <EmptyState v-else title="请选择一位客户" description="客户列表来自服务端，选中后才能查看房屋、量房和设计方案。" />
      </main>

      <aside class="cd__context">
        <section v-if="selectedCustomer" class="cd__next">
          <p class="cd__eyebrow">NEXT ACTION</p>
          <h4>{{ nextAction(selectedCustomer) }}</h4>
          <p>当前客户：{{ selectedCustomer.name }} · {{ selectedProperty ? propertyLabel(selectedProperty) : '未选择房屋' }}</p>
          <el-button type="primary" @click="followVisible = true">写跟进</el-button>
          <el-button :disabled="!selectedProperty" @click="measureVisible = true">安排量房</el-button>
          <el-button :disabled="!selectedProperty" @click="schemeVisible = true">新建方案</el-button>
        </section>
        <section class="cd__timeline">
          <div class="cd__section-head"><div><h4>跟进时间线</h4><p>最近 100 条服务端记录。</p></div></div>
          <EmptyState v-if="!follows.length" title="还没有跟进记录" description="写跟进后会在这里按时间倒序显示。" />
          <ol v-else>
            <li v-for="follow in follows.slice().reverse()" :key="follow.id">
              <span>{{ formatDateTime(follow.createdAt) }}</span>
              <strong>{{ follow.empName || '员工' }} · {{ FOLLOW_WAY_LABELS[follow.way] }}</strong>
              <p>{{ follow.content }}</p>
              <small v-if="follow.nextFollowAt">下次跟进：{{ formatDateTime(follow.nextFollowAt) }}</small>
            </li>
          </ol>
        </section>
      </aside>
    </div>

    <el-dialog v-model="followVisible" title="写跟进" width="520px" append-to-body>
      <el-form label-width="88px">
        <el-form-item label="跟进方式">
          <el-select v-model="followForm.way" style="width: 100%">
            <el-option v-for="item in followWays" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="跟进内容"><el-input v-model="followForm.content" type="textarea" :rows="4" maxlength="500" show-word-limit /></el-form-item>
        <el-form-item label="下次跟进"><el-date-picker v-model="followForm.nextFollowAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="followVisible = false">取消</el-button><el-button type="primary" :loading="saving" :disabled="!followForm.content.trim()" @click="saveFollow">保存跟进</el-button></template>
    </el-dialog>

    <el-dialog v-model="measureVisible" title="安排量房" width="480px" append-to-body>
      <el-form label-width="88px">
        <el-form-item label="量房时间"><el-date-picker v-model="measureForm.measureAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" /></el-form-item>
      </el-form>
      <el-alert type="info" :closable="false" title="量房安排会写回客户主链，量房结论由设计师完成量房后登记。" show-icon />
      <template #footer><el-button @click="measureVisible = false">取消</el-button><el-button type="primary" :loading="saving" :disabled="!measureForm.measureAt" @click="scheduleMeasure">确认安排</el-button></template>
    </el-dialog>

    <el-dialog v-model="measureResultVisible" title="登记量房结论" width="680px" append-to-body>
      <el-form label-width="100px">
        <el-form-item label="量房时间"><el-date-picker v-model="measureResultForm.measureTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" /></el-form-item>
        <el-form-item label="原始结构"><el-input v-model="measureResultForm.originalStructure" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="尺寸记录"><el-input v-model="measureResultForm.dimensions" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="客户诉求"><el-input v-model="measureResultForm.customerRequirements" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="设计师结论"><el-input v-model="measureResultForm.designerConclusion" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="measureResultVisible = false">取消</el-button><el-button type="primary" :loading="saving" @click="saveMeasureResult">保存量房结论</el-button></template>
    </el-dialog>

    <el-dialog v-model="schemeVisible" title="新建设计方案" width="600px" append-to-body>
      <el-form label-width="88px">
        <el-form-item label="方案名称"><el-input v-model="schemeForm.name" maxlength="80" /></el-form-item>
        <el-form-item label="风格"><el-input v-model="schemeForm.style" maxlength="40" /></el-form-item>
        <el-form-item label="户型"><el-input v-model="schemeForm.layout" maxlength="40" /></el-form-item>
        <el-form-item label="方案说明"><el-input v-model="schemeForm.description" type="textarea" :rows="4" maxlength="500" show-word-limit /></el-form-item>
      </el-form>
      <template #footer><el-button @click="schemeVisible = false">取消</el-button><el-button type="primary" :loading="saving" :disabled="!schemeForm.name.trim()" @click="createScheme">创建方案</el-button></template>
    </el-dialog>

    <el-dialog v-model="requirementVisible" title="记录设计诉求" width="620px" append-to-body>
      <el-form label-width="88px">
        <el-form-item label="诉求类型"><el-select v-model="requirementForm.kind" style="width: 100%"><el-option label="诉求" value="demand" /><el-option label="排斥点" value="reject" /></el-select></el-form-item>
        <el-form-item label="分类"><el-select v-model="requirementForm.category" style="width: 100%"><el-option v-for="item in requirementCategories" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item>
        <el-form-item label="优先级"><el-select v-model="requirementForm.priority" style="width: 100%"><el-option v-for="item in requirementPriorities" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item>
        <el-form-item label="空间"><el-input v-model="requirementForm.spaceName" placeholder="如客厅 / 主卧，可留空" /></el-form-item>
        <el-form-item label="标题"><el-input v-model="requirementForm.title" maxlength="80" /></el-form-item>
        <el-form-item label="详细说明"><el-input v-model="requirementForm.detail" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="设计回应"><el-input v-model="requirementForm.response" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="requirementVisible = false">取消</el-button><el-button type="primary" :loading="saving" :disabled="!requirementForm.title.trim()" @click="saveRequirement">保存诉求</el-button></template>
    </el-dialog>
  </div>
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
.cd__workspace,
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

.cd__workspace { min-width: 0; overflow: hidden; }

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
.cd__measure,
.cd__schemes,
.cd__requirements { border-bottom: 1px solid $border-color; }

.cd__property-tabs,
.cd__scheme-list {
  display: flex;
  flex-wrap: wrap;
  gap: $space-2;
  padding: $space-4;
}

.cd__property-tabs button,
.cd__scheme {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 180px;
  padding: $space-3;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-0;
  text-align: left;
  cursor: pointer;

  small { color: $text-secondary; font-size: $font-caption; }
  &.active { border-color: $brand-300; background: $brand-50; }
}

.cd__measure-card {
  margin: $space-4;
  padding: $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-50;
}

.cd__measure-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
  margin-bottom: $space-3;
  color: $text-secondary;
  font-size: $font-caption;
}

.cd__measure-card dl,
.cd__measure-card dl div { margin: 0; }
.cd__measure-card dl { display: grid; gap: $space-2; }
.cd__measure-card dt { color: $text-secondary; font-size: $font-caption; }
.cd__measure-card dd { margin: 2px 0 0; font-size: $font-body-sm; }

.cd__scheme {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.cd__scheme-detail {
  margin: 0 $space-4 $space-4;
  padding: $space-4;
  border: 1px solid $brand-100;
  border-radius: $radius-sm;
  background: $brand-50;
}

.cd__scheme-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(90px, 1fr));
  gap: $space-3;

  div { display: flex; flex-direction: column; gap: 3px; }
  small { color: $text-secondary; font-size: $font-caption; }
}

.cd__scheme-desc {
  margin: $space-3 0;
  color: $text-secondary;
  font-size: $font-body-sm;
  line-height: 1.7;
}

.cd__scheme-actions { display: flex; flex-wrap: wrap; gap: $space-2; }

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

@media (max-width: 1280px) {
  .cd__layout { grid-template-columns: 260px minmax(0, 1fr); }
  .cd__context { grid-column: 1 / -1; position: static; max-height: none; }
}

@media (max-width: 1024px) {
  .cd__head,
  .cd__filters { flex-direction: column; align-items: stretch; min-width: 0; }
  .cd__layout { grid-template-columns: 1fr; }
  .cd__pool { position: static; max-height: none; }
  .cd__identity { flex-direction: column; }
}
</style>
