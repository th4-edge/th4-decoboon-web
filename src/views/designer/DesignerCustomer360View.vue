<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import NextActionPanel from '@/components/business-state/NextActionPanel.vue'
import MoneyText from '@/components/MoneyText.vue'
import StatusTag from '@/components/StatusTag.vue'
import WorkbenchState from '@/components/workbench/WorkbenchState.vue'
import { formatDateTime, formatRelativeDay } from '@/core/format'
import { contractApi } from '@/domains/contract/api'
import type { Contract } from '@/domains/contract/model'
import { crmApi } from '@/domains/crm/api'
import { customerClock, lifecycleOf, mainlineActionOf, riskToneOf } from '@/domains/crm/journey'
import type { Customer, CustomerFollow } from '@/domains/crm/model'
import { designApi } from '@/domains/design/api'
import type { DesignRequirement, DesignScheme } from '@/domains/design/model'
import { REQUIREMENT_CATEGORY_LABELS, REQUIREMENT_PRIORITY_LABELS, REQUIREMENT_STATUS_LABELS } from '@/domains/design/requirementOptions'
import { propertyApi } from '@/domains/property/api'
import type { Measure, Property, PropertyStatus } from '@/domains/property/model'
import { projectApi } from '@/domains/project/api'
import type { ProjectBrief } from '@/domains/project/model'
import { financeApi } from '@/domains/finance/api'
import type { Receivable } from '@/domains/finance/model'
import { quoteDesignerPage } from '@/domains/trade/api'
import type { Quote, QuoteStatus } from '@/domains/trade/model'
import CustomerEditSheet from './components/CustomerEditSheet.vue'
import PropertyEditSheet from './components/PropertyEditSheet.vue'

type RelatedTab = 'requirement' | 'scheme' | 'quote' | 'contract' | 'project' | 'measure' | 'payment'

const route = useRoute()
const router = useRouter()
const customerId = computed(() => String(route.params.customerId ?? ''))

const PROPERTY_LABELS: Record<PropertyStatus, string> = {
  pendingMeasure: '待量房', measuring: '量房中', measured: '已量房', designing: '设计中',
  quoted: '已报价', contracted: '已签约', serving: '施工中', completed: '已完工'
}
const QUOTE_LABELS: Record<QuoteStatus, string> = {
  draft: '草稿', submitted: '待客户决策', accepted: '客户已接受', rejected: '客户驳回',
  superseded: '已被替代', converted: '已转项目'
}
const DESIGN_STATUS_LABELS: Record<string, string> = {
  draft: '草稿', ready: '待谈单', presented: '已讲解', selected: '已选定', archived: '已归档'
}
const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: '草稿', pendingSign: '待签约', signed: '已签约（未生效）', effective: '已生效',
  active: '履约中', changing: '变更中', changed: '已变更', completed: '已完成',
  settled: '已结算', closed: '已关闭', terminated: '已终止'
}
const PROJECT_STATUS_LABELS: Record<string, string> = {
  preparing: '待开工', ongoing: '施工中', suspended: '已停工', accepting: '待验收',
  finished: '已完工', settled: '已结算'
}
const PORTRAIT_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'decisionRole', label: '决策角色' },
  { key: 'purpose', label: '装修目的' },
  { key: 'houseCondition', label: '房屋状况' },
  { key: 'startWindow', label: '开工窗口' },
  { key: 'style', label: '风格偏好' },
  { key: 'eco', label: '环保要求' },
  { key: 'household', label: '家庭结构' },
  { key: 'payment', label: '付款方式' },
  { key: 'competitor', label: '竞品对比' }
]
/** Tab 图标：形状语义与 App 保持一致（诉求=对话、方案=画板、报价=单据、合同=盾牌、项目=工地）。 */
const MEASURE_STATUS_LABELS: Record<string, string> = { scheduled: '已预约', completed: '已完成', cancelled: '已取消' }
const RECEIVABLE_TYPE_LABELS: Record<string, string> = {
  deposit: '定金', progress: '进度款', final: '尾款', retention: '质保金', other: '其他'
}
const RECEIVABLE_STATUS_LABELS: Record<string, string> = {
  pending: '待收', partial: '部分已收', received: '已收清', overdue: '逾期', cancelled: '已取消'
}
const TAB_ICONS: Record<RelatedTab, string[]> = {
  requirement: ['M5 5h14v10H9l-4 4V5Z', 'M9 9h6M9 12h4'],
  scheme: ['M4 5h16v14H4z', 'M7 15.5l3.2-3.2 2.5 2.5L16 11.5l4 4'],
  quote: ['M4 7.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4v-3Z', 'M9 8.5h6M9 12h6M9 15.5h4'],
  contract: ['M6 3h8l4 4v14H6z', 'M14 3v5h5M9 14l2 2 4-4.5'],
  project: ['M4 21h16M6 21V5h8v16M14 9h4v12M9 8h2M9 12h2M9 16h2'],
  measure: ['M12 21s7-5.6 7-12a7 7 0 1 0-14 0c0 6.4 7 12 7 12Z', 'M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'],
  payment: ['M3 7h18v10H3z', 'M3 11h18', 'M7 15h3']
}
const RELATED_TABS: Array<{ key: RelatedTab; label: string }> = [
  { key: 'requirement', label: '诉求' },
  { key: 'scheme', label: '方案' },
  { key: 'quote', label: '报价' },
  { key: 'contract', label: '合同' },
  { key: 'project', label: '项目' },
  { key: 'measure', label: '量房' },
  { key: 'payment', label: '付款' }
]
const requestedTab = RELATED_TABS.find((item) => item.key === String(route.query.tab ?? ''))?.key
const requestedPropertyId = computed(() => String(route.query.propertyId ?? ''))

const customer = ref<Customer | null>(null)
const loading = ref(true)
const error = ref('')

const properties = ref<Property[]>([])
const measuresByProperty = ref<Record<string, Measure[]>>({})
const activePropertyId = ref('')

const schemes = ref<DesignScheme[]>([])
const quotes = ref<Quote[]>([])
const projects = ref<ProjectBrief[]>([])
const relationsError = ref('')

const requirements = ref<DesignRequirement[]>([])
const requirementsLoading = ref(false)
const contracts = ref<Contract[]>([])
const contractsLoading = ref(false)

const follows = ref<CustomerFollow[]>([])
const followsLoading = ref(false)
const followsError = ref('')

const receivables = ref<Receivable[]>([])
const paymentsLoading = ref(false)
const paymentsError = ref('')
/** 设计师没有财务权限（FinanceAccessContext 仅放行 Boss/Finance/StoreManager），降级为合同付款条款。 */
const paymentsDenied = ref(false)
const activeTab = ref<RelatedTab>(requestedTab ?? 'requirement')
const archiveOpen = ref(false)
const customerSheetOpen = ref(false)
const propertySheetOpen = ref(false)
const editingProperty = ref<Property | null>(null)
const deletingId = ref('')
const deleteError = ref('')

const mainline = computed(() => customer.value ? mainlineActionOf(customer.value) : null)
const riskGuide = computed(() => {
  const source = customer.value
  if (!source?.riskReason) return null
  return {
    label: source.riskLevel === 'High' ? '高风险' : '需关注',
    tone: riskToneOf(source),
    reason: source.riskReason
  }
})

const portrait = computed(() => customer.value?.portrait ?? null)
const activeProperty = computed(() => properties.value.find((item) => item.id === activePropertyId.value) ?? null)

const portraitItems = computed(() => {
  const source = portrait.value
  if (!source) return []
  return PORTRAIT_FIELDS
    .map((field) => ({ label: field.label, value: enumLabel(source[field.key]) }))
    .filter((item) => item.value && item.value !== '—')
})

const activeSchemes = computed(() => schemes.value.filter((item) => item.propertyId === activePropertyId.value))
const activeQuotes = computed(() => quotes.value.filter((item) => item.propertyId === activePropertyId.value))
const activeProjects = computed(() => projects.value.filter((item) => item.propertyId === activePropertyId.value))
const activeMeasures = computed(() => measuresByProperty.value[activePropertyId.value] || [])

/** 报价版本轨：同一房屋按版本升序排列，标记当前版本，Superseded 只作历史（DEC-002）。 */
const quoteVersions = computed(() =>
  [...activeQuotes.value].sort((a, b) => a.version - b.version)
)
const currentQuoteId = computed(() => {
  const candidates = quoteVersions.value.filter((item) => item.status !== 'superseded')
  return candidates.length ? candidates[candidates.length - 1].id : quoteVersions.value.at(-1)?.id ?? ''
})

/** 诉求按数据特征分组：先按「类型（需求/禁忌）」再按「类别」，便于逐条约束设计。 */
const requirementGroups = computed(() => {
  const groups = new Map<string, DesignRequirement[]>()
  requirements.value.forEach((item) => {
    const key = `${item.kind === 'reject' ? '禁忌项' : '需求项'} · ${REQUIREMENT_CATEGORY_LABELS[item.category] ?? item.category}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  })
  return [...groups.entries()].map(([label, items]) => ({ label, items }))
})

function enumLabel(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return String(record.name ?? record.label ?? record.value ?? record.key ?? '—')
  }
  return String(value)
}

function measuresOfProperty(id: string): number {
  return (measuresByProperty.value[id] || []).length
}
function schemesOfProperty(id: string): number {
  return schemes.value.filter((item) => item.propertyId === id).length
}
function quotesOfProperty(id: string): number {
  return quotes.value.filter((item) => item.propertyId === id).length
}
function projectsOfProperty(id: string): number {
  return projects.value.filter((item) => item.propertyId === id).length
}
/** 该方案已生成的报价数（方案 → 报价 的关联事实）。 */
function quotesOfScheme(designId: string): number {
  return quotes.value.filter((item) => item.designId === designId).length
}

async function loadCustomer(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const overview = await crmApi.myCustomerOverview({ size: 100 })
    const found = overview.customers.find((item) => item.id === customerId.value) ?? null
    customer.value = found
    if (!found) error.value = '该客户不在你的可见范围内，可能已被转移或超出数据权限。'
  } catch (err) {
    error.value = err instanceof Error ? err.message : '客户 360 暂不可确认'
  } finally {
    loading.value = false
  }
}

async function loadStructure(): Promise<void> {
  relationsError.value = ''
  try {
    const [propertyList, schemeList, quoteList, projectList] = await Promise.all([
      propertyApi.listProperties(customerId.value),
      designApi.listSchemes(customerId.value),
      quoteDesignerPage({ customerId: customerId.value, size: 100 }),
      projectApi.listProjects({ size: 200 })
    ])
    properties.value = propertyList
    schemes.value = schemeList
    quotes.value = quoteList
    projects.value = projectList.filter((item) => item.customerId === customerId.value)
    const requested = requestedPropertyId.value
    if (requested && propertyList.some((item) => item.id === requested)) {
      activePropertyId.value = requested
    } else if (!propertyList.some((item) => item.id === activePropertyId.value)) {
      activePropertyId.value = propertyList[0]?.id ?? ''
    }
    const entries = await Promise.all(propertyList.map(async (item) => {
      try {
        return [item.id, await propertyApi.listMeasures(item.id)] as const
      } catch {
        return [item.id, [] as Measure[]] as const
      }
    }))
    measuresByProperty.value = Object.fromEntries(entries)
  } catch (err) {
    relationsError.value = err instanceof Error ? err.message : '房屋与关联对象暂不可确认'
  }
}

async function loadRequirements(): Promise<void> {
  if (!activePropertyId.value) return
  requirementsLoading.value = true
  try {
    requirements.value = await designApi.listRequirements(customerId.value, activePropertyId.value)
  } catch {
    requirements.value = []
  } finally {
    requirementsLoading.value = false
  }
}

async function loadContracts(): Promise<void> {
  contractsLoading.value = true
  const quoteIds = activeQuotes.value.map((item) => item.id)
  const projectIds = activeProjects.value.map((item) => item.id)
  const [byQuote, byProject] = await Promise.all([
    Promise.allSettled(quoteIds.map((id) => contractApi.contractByQuote(id))),
    Promise.allSettled(projectIds.map((id) => contractApi.contractByProject(id)))
  ])
  const found: Contract[] = []
  byQuote.forEach((r) => { if (r.status === 'fulfilled' && r.value) found.push(r.value) })
  byProject.forEach((r) => { if (r.status === 'fulfilled' && r.value) found.push(r.value) })
  contracts.value = [...new Map(found.map((item) => [item.id, item])).values()]
  contractsLoading.value = false
}

/** 付款信息：按该房屋的项目取应收计划（收款），设计师可见客户侧金额，不含成本与利润。 */
async function loadPayments(): Promise<void> {
  paymentsLoading.value = true
  paymentsError.value = ''
  paymentsDenied.value = false
  try {
    // 合同付款条款走合同权限（设计师可见），不依赖财务权限
    if (!contracts.value.length) await loadContracts()
    const projectIds = activeProjects.value.map((item) => item.id)
    if (!projectIds.length) {
      receivables.value = []
      return
    }
    const pages = await Promise.all(projectIds.map((projectId) => financeApi.receivables({ projectId, size: 50 })))
    receivables.value = pages.flatMap((page) => page.list)
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (message.includes('无权') || message.includes('权限')) {
      paymentsDenied.value = true
      receivables.value = []
    } else {
      paymentsError.value = message || '付款信息暂不可确认'
    }
  } finally {
    paymentsLoading.value = false
  }
}

async function loadFollows(): Promise<void> {
  followsLoading.value = true
  followsError.value = ''
  try {
    follows.value = await crmApi.customerFollows(customerId.value)
  } catch (err) {
    followsError.value = err instanceof Error ? err.message : '跟进记录暂不可确认'
  } finally {
    followsLoading.value = false
  }
}

function selectProperty(id: string): void {
  if (activePropertyId.value === id) return
  activePropertyId.value = id
  contracts.value = []
  deleteError.value = ''
  receivables.value = []
  paymentsError.value = ''
  if (activeTab.value === 'requirement') void loadRequirements()
  if (activeTab.value === 'contract') void loadContracts()
  if (activeTab.value === 'payment') void loadPayments()
}

function switchTab(tab: RelatedTab): void {
  activeTab.value = tab
  if (tab === 'requirement') void loadRequirements()
  if (tab === 'contract') void loadContracts()
  if (tab === 'payment') void loadPayments()
}

function openCustomerSheet(): void {
  customerSheetOpen.value = true
}
function openPropertySheet(property: Property | null): void {
  editingProperty.value = property
  propertySheetOpen.value = true
}

/** 删除房屋：前端不做门禁判断，直接调用服务端；服务端有附带数据时返回明确原因。 */
async function removeProperty(property: Property): Promise<void> {
  const label = `${property.community || '未命名小区'} ${property.building || ''}${property.roomNo || ''}`
  if (!window.confirm(`确认删除房屋「${label}」？\n\n只有完全没有量房/诉求/方案/报价/合同/项目的房屋可以删除；有附带数据时服务端会拒绝并说明原因。`)) {
    return
  }
  deletingId.value = property.id
  deleteError.value = ''
  try {
    await propertyApi.deleteProperty(property.id)
    if (activePropertyId.value === property.id) activePropertyId.value = ''
    await loadStructure()
    await loadRequirements()
  } catch (err) {
    deleteError.value = err instanceof Error ? err.message : '删除失败，请稍后重试'
  } finally {
    deletingId.value = ''
  }
}

async function onCustomerSaved(): Promise<void> {
  await loadCustomer()
}
async function onPropertySaved(): Promise<void> {
  propertySheetOpen.value = false
  editingProperty.value = null
  await loadStructure()
  await loadRequirements()
}
function goBack(): void {
  const historyState = window.history.state as { back?: string | null } | null
  if (historyState?.back) {
    router.back()
    return
  }
  void router.push('/designer/my-customers')
}
function goWorkspace(): void {
  const route = mainline.value?.route
  if (route) void router.push(route)
}
function goPropertyWorkspace(): void {
  if (activeProperty.value) void router.push(`/designer/projects?propertyId=${activeProperty.value.id}`)
}

onMounted(async () => {
  await loadCustomer()
  if (!customer.value) return
  await Promise.all([loadStructure(), loadFollows()])
  await loadRequirements()
})
</script>

<template>
  <div class="c360">
    <button class="c360__back" type="button" @click="goBack">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
      返回上一页
    </button>

    <div v-if="loading" class="c360__skeleton" aria-busy="true">
      <span class="c360__skeleton-line c360__skeleton-line--title" />
      <span class="c360__skeleton-line" />
    </div>

    <WorkbenchState
      v-else-if="error && !customer"
      variant="error"
      title="客户 360 暂不可确认"
      :description="error"
      action-text="返回上一页"
      min-height="320px"
      @action="goBack"
    />

    <template v-else-if="customer">
      <header class="hero">
        <div class="hero__main">
          <p class="hero__eyebrow">CUSTOMER 360</p>
          <h1>
            {{ customer.name || '客户待完善' }}
            <BusinessStateTag object-key="customer" :status-key="customer.stage" />
            <StatusTag v-if="customerClock(customer)" :tone="customerClock(customer)!.tone" :text="customerClock(customer)!.label" :dot="false" />
            <button class="hero__edit" type="button" @click="openCustomerSheet">编辑</button>
          </h1>

          <div class="hero__contacts">
            <span class="hero__contact">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></svg>
              {{ customer.phone || '电话待补充' }}
            </span>
            <span class="hero__contact">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.6 7-12a7 7 0 1 0-14 0c0 6.4 7 12 7 12Z" /><path d="M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" /></svg>
              {{ customer.community || '小区待补充' }}<template v-if="customer.addr"> · {{ customer.addr }}</template>
            </span>
            <span class="hero__contact">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M2.5 21a6.5 6.5 0 0 1 13 0" /></svg>
              负责人 {{ customer.ownerName || '待分配' }}<template v-if="customer.designerName"> · 设计师 {{ customer.designerName }}</template>
            </span>
          </div>

          <ul class="hero__facts">
            <li><small>等级</small><b>{{ customer.grade ? `${customer.grade} 级` : '待评估' }}</b></li>
            <li><small>面积</small><b>{{ customer.area ? `${customer.area}㎡` : '待补充' }}</b></li>
            <li><small>预算</small><b><MoneyText :value="customer.budget" /></b></li>
            <li><small>停留</small><b>{{ customer.idleDays !== undefined ? `${customer.idleDays} 天` : '—' }}</b></li>
            <li><small>下次跟进</small><b>{{ customer.nextFollowAt ? formatRelativeDay(customer.nextFollowAt) : '未安排' }}</b></li>
            <li v-if="lifecycleOf(customer)"><small>生命周期</small><b>{{ lifecycleOf(customer)!.label }}</b></li>
          </ul>

          <div class="hero__portrait">
            <span class="hero__portrait-label">客户画像</span>
            <template v-if="portraitItems.length">
              <span v-for="item in portraitItems" :key="item.label" class="hero__portrait-chip">
                <small>{{ item.label }}</small>{{ item.value }}
              </span>
            </template>
            <span v-else class="hero__portrait-empty">画像尚未建立，可在推进工作区登记（缺失不影响跟进与量房）</span>
          </div>

          <!-- 客户档案：默认收起，避免把低频字段挤在首屏 -->
          <section class="archive" :class="{ 'archive--open': archiveOpen }">
            <button class="archive__toggle" type="button" :aria-expanded="archiveOpen" @click="archiveOpen = !archiveOpen">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="{ 'archive__caret--open': archiveOpen }"><path d="M9 6l6 6-6 6" /></svg>
              客户档案
              <small>建档时间、来源、备注与标签等低频字段</small>
            </button>
            <div v-if="archiveOpen" class="archive__body">
              <dl class="archive__facts">
                <div><dt>客户编号</dt><dd>{{ customer.id }}</dd></div>
                <div><dt>性别</dt><dd>{{ customer.gender === 'M' ? '男' : customer.gender === 'F' ? '女' : '未填写' }}</dd></div>
                <div><dt>来源</dt><dd>{{ customer.source || '未填写' }}</dd></div>
                <div><dt>详址</dt><dd>{{ customer.addr || '待补充' }}</dd></div>
                <div><dt>建档时间</dt><dd>{{ formatDateTime(customer.createdAt) }}</dd></div>
                <div><dt>最近跟进</dt><dd>{{ formatDateTime(customer.lastFollowAt) }}</dd></div>
                <div class="archive__wide"><dt>备注</dt><dd>{{ customer.remark || '无' }}</dd></div>
              </dl>
              <div v-if="customer.tags?.length" class="hero__tags">
                <StatusTag v-for="tag in customer.tags" :key="tag" tone="info" :text="tag" :dot="false" />
              </div>
            </div>
          </section>
        </div>

        <aside class="hero__guide">
          <NextActionPanel
            :action="mainline"
            :risk="riskGuide"
            title="当前主行动"
            action-text="去处理"
            @action="goWorkspace"
          />
        </aside>
      </header>

      <WorkbenchState
        v-if="relationsError"
        variant="error"
        title="房屋与关联对象暂不可确认"
        :description="relationsError"
        action-text="重新加载"
        min-height="240px"
        @action="loadStructure"
      />

      <div v-else class="body">
        <section class="houses">
          <header class="zone-head">
            <h2>装修房屋</h2>
            <button class="related__link" type="button" @click="openPropertySheet(null)">+ 新增房屋</button>
          </header>

          <WorkbenchState
            v-if="!properties.length"
            title="该客户尚无房屋档案"
            description="量房、设计与报价都必须绑定房屋，不能以客户地址代替。"
            min-height="200px"
          />

          <div v-else class="houses__list">
            <article
              v-for="item in properties"
              :key="item.id"
              class="house"
              :class="{ active: item.id === activePropertyId }"
              role="button"
              tabindex="0"
              @click="selectProperty(item.id)"
              @keydown.enter.prevent="selectProperty(item.id)"
            >
              <header class="house__head">
                <strong class="house__title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M9.5 20v-5.5h5V20" /></svg>
                  {{ item.community || '未命名小区' }} {{ item.building || '' }}{{ item.roomNo || '' }}
                </strong>
                <StatusTag tone="info" :text="PROPERTY_LABELS[item.status]" :dot="false" />
              </header>
              <p class="house__line">{{ item.area ? `${item.area}㎡` : '面积待补充' }} · {{ item.layout || '户型待补充' }}</p>
              <ul class="house__counts">
                <li><b>{{ measuresOfProperty(item.id) }}</b>量房</li>
                <li><b>{{ schemesOfProperty(item.id) }}</b>方案</li>
                <li><b>{{ quotesOfProperty(item.id) }}</b>报价</li>
                <li><b>{{ projectsOfProperty(item.id) }}</b>项目</li>
              </ul>
              <footer class="house__ops">
                <button class="house__op" type="button" @click.stop="openPropertySheet(item)">编辑</button>
                <button class="house__op house__op--danger" type="button" :disabled="deletingId === item.id" @click.stop="removeProperty(item)">
                  {{ deletingId === item.id ? '删除中…' : '删除' }}
                </button>
              </footer>
            </article>
            <p v-if="deleteError" class="houses__error">{{ deleteError }}</p>
          </div>
        </section>

        <section v-if="activeProperty" class="related">
          <header class="zone-head">
            <h2>房屋关联信息</h2>
            <button class="related__link" type="button" @click="goPropertyWorkspace">在推进工作区打开 →</button>
          </header>
          <p class="related__subject">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /></svg>
            {{ activeProperty.community || '未命名小区' }} {{ activeProperty.building || '' }}{{ activeProperty.roomNo || '' }} · {{ PROPERTY_LABELS[activeProperty.status] }}
          </p>

          <nav class="related__tabs" role="tablist" aria-label="房屋关联信息">
            <button
              v-for="tab in RELATED_TABS"
              :key="tab.key"
              type="button"
              role="tab"
              class="related__tab"
              :class="{ active: activeTab === tab.key }"
              :aria-selected="activeTab === tab.key"
              @click="switchTab(tab.key)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path v-for="d in TAB_ICONS[tab.key]" :key="d" :d="d" /></svg>
              {{ tab.label }}
            </button>
          </nav>

          <div class="related__panel">
            <!-- 诉求：按「需求 / 禁忌」再按类别分组，符合其数据特征 -->
            <template v-if="activeTab === 'requirement'">
              <div v-if="requirementsLoading" class="related__loading">加载中…</div>
              <div v-else-if="requirements.length" class="req">
                <section v-for="group in requirementGroups" :key="group.label" class="req__group">
                  <h4>{{ group.label }}<small>{{ group.items.length }} 条</small></h4>
                  <article v-for="item in group.items" :key="item.id" class="req__item" :class="{ 'req__item--reject': item.kind === 'reject' }">
                    <header>
                      <strong>{{ item.title }}</strong>
                      <span class="related__tags">
                        <StatusTag :tone="item.priority === 'high' ? 'blocked' : item.priority === 'medium' ? 'pending' : 'info'" :text="REQUIREMENT_PRIORITY_LABELS[item.priority] ?? '优先级待确认'" :dot="false" />
                        <StatusTag tone="info" :text="REQUIREMENT_STATUS_LABELS[item.status] ?? item.status" :dot="false" />
                      </span>
                    </header>
                    <p>{{ item.detail || '—' }}</p>
                    <small v-if="item.spaceName">空间：{{ item.spaceName }}</small>
                  </article>
                </section>
              </div>
              <WorkbenchState v-else title="该房屋尚未登记诉求" description="诉求用于约束设计方案；未登记时方案不得当作已确认。" min-height="200px" />
            </template>

            <!-- 方案：一对多，卡片刻意表达版本、空间与设计项，以及它派生出的报价 -->
            <template v-else-if="activeTab === 'scheme'">
              <div v-if="activeSchemes.length" class="related__list">
                <article v-for="item in activeSchemes" :key="item.id" class="card-scheme">
                  <header>
                    <div class="card__title">
                      <strong>{{ item.name || item.no }}</strong>
                      <small>第 {{ item.version }} 版 · {{ DESIGN_STATUS_LABELS[item.status] ?? item.status }}</small>
                    </div>
                    <StatusTag tone="special" :text="DESIGN_STATUS_LABELS[item.status] ?? item.status" :dot="false" />
                  </header>
                  <ul class="card__metrics">
                    <li><small>面积</small><b>{{ item.area ? `${item.area}㎡` : '—' }}</b></li>
                    <li><small>空间</small><b>{{ item.spaces?.length ?? 0 }}</b></li>
                    <li><small>设计项</small><b>{{ item.items?.length ?? 0 }}</b></li>
                    <li><small>已生成报价</small><b>{{ quotesOfScheme(item.id) }}</b></li>
                  </ul>
                  <p v-if="item.description" class="card__desc">{{ item.description }}</p>
                  <div v-if="item.spaces?.length" class="card__chips">
                    <span v-for="space in item.spaces.slice(0, 6)" :key="space.id">{{ space.name }}</span>
                  </div>
                  <footer class="card__foot">
                    <small>{{ item.style || '风格待补充' }} · {{ formatDateTime(item.createdAt) }}</small>
                    <button class="related__link" type="button" @click="router.push(`/designer/design/${item.id}`)">进入设计工作区 →</button>
                  </footer>
                </article>
              </div>
              <WorkbenchState v-else title="该房屋尚无设计方案" description="方案必须在明确房屋下创建；进入推进工作区可登记方案与设计项。" min-height="200px" />
            </template>

            <!-- 报价：跨版本视觉编排（版本轨），Superseded 只作历史 -->
            <template v-else-if="activeTab === 'quote'">
              <div v-if="quoteVersions.length" class="rail">
                <div class="rail__line" aria-hidden="true" />
                <article
                  v-for="item in quoteVersions"
                  :key="item.id"
                  class="rail__item"
                  :class="{ 'rail__item--history': item.status === 'superseded', 'rail__item--current': item.id === currentQuoteId }"
                >
                  <div class="rail__node">
                    <span class="rail__dot" />
                    <small>V{{ item.version }}</small>
                  </div>
                  <div class="rail__card">
                    <header>
                      <div class="card__title">
                        <strong>{{ item.no || item.id }}</strong>
                        <small>{{ formatDateTime(item.createdAt) }}<template v-if="item.id === currentQuoteId"> · 当前版本</template></small>
                      </div>
                      <StatusTag
                        :tone="item.status === 'submitted' ? 'pending' : item.status === 'accepted' ? 'done' : item.status === 'rejected' ? 'blocked' : item.status === 'superseded' ? 'muted' : 'info'"
                        :text="QUOTE_LABELS[item.status] ?? item.status"
                        :dot="false"
                      />
                    </header>
                    <div class="quote__amount">
                      <small>合计金额</small>
                      <strong><MoneyText :value="item.amount" /></strong>
                    </div>
                    <dl class="quote__breakdown">
                      <div><dt>小计</dt><dd><MoneyText :value="item.subtotal" /></dd></div>
                      <div><dt>优惠</dt><dd><MoneyText :value="item.discount" /></dd></div>
                      <div><dt>税率</dt><dd>{{ item.taxRate }}%</dd></div>
                      <div><dt>税额</dt><dd><MoneyText :value="item.taxAmount" /></dd></div>
                    </dl>
                    <footer class="card__foot">
                      <small>{{ item.designName ? `来源方案 ${item.designName}` : '未关联方案' }}</small>
                      <button class="related__link" type="button" @click="router.push(`/designer/quotes/${item.id}`)">进入报价工作区 →</button>
                    </footer>
                  </div>
                </article>
              </div>
              <WorkbenchState v-else title="该房屋尚未生成报价" description="报价必须在明确房屋与方案下生成；报价金额可见，成本与利润不展示。" min-height="200px" />
            </template>

            <!-- 合同：一套房屋通常只有一份，字段全部展开 -->
            <template v-else-if="activeTab === 'contract'">
              <div v-if="contractsLoading" class="related__loading">加载中…</div>
              <div v-else-if="contracts.length" class="related__list">
                <article v-for="item in contracts" :key="item.id" class="card-detail">
                  <header>
                    <div class="card__title">
                      <strong>{{ item.no || item.id }}</strong>
                      <small>合同编号</small>
                    </div>
                    <StatusTag :tone="item.status === 'effective' || item.status === 'active' ? 'done' : item.status === 'terminated' || item.status === 'closed' ? 'blocked' : 'pending'" :text="CONTRACT_STATUS_LABELS[item.status] ?? item.status" :dot="false" />
                  </header>
                  <ul class="card__metrics">
                    <li><small>当前金额</small><b><MoneyText :value="item.currentAmount" /></b></li>
                    <li><small>签约金额</small><b><MoneyText :value="item.signedAmount" /></b></li>
                    <li><small>开工日</small><b>{{ formatDateTime(item.startDate) }}</b></li>
                    <li><small>计划完工</small><b>{{ formatDateTime(item.planEndDate) }}</b></li>
                    <li><small>签约时间</small><b>{{ formatDateTime(item.signedAt) }}</b></li>
                    <li><small>生效时间</small><b>{{ formatDateTime(item.effectiveAt) }}</b></li>
                  </ul>
                  <p v-if="item.paymentTerms" class="card__desc">付款条款：{{ item.paymentTerms }}</p>
                  <p class="card__note">已签约与已生效是两个独立节点，只有已生效才能进入项目。</p>
                </article>
              </div>
              <WorkbenchState v-else title="该房屋尚无合同" description="合同由报价或项目承载；已签约与已生效是两个独立节点，只有已生效才能进入项目。" min-height="200px" />
            </template>

            <!-- 项目：一套房屋通常只有一个，阶段与排期详细展开 -->
            <template v-else-if="activeTab === 'project'">
              <div v-if="activeProjects.length" class="related__list">
                <article v-for="item in activeProjects" :key="item.id" class="card-detail">
                  <header>
                    <div class="card__title">
                      <strong>{{ item.name || item.no }}</strong>
                      <small>{{ item.no }}</small>
                    </div>
                    <StatusTag :tone="item.status === 'ongoing' ? 'alert' : item.status === 'finished' || item.status === 'settled' ? 'dark' : 'pending'" :text="PROJECT_STATUS_LABELS[item.status] ?? item.status" :dot="false" />
                  </header>
                  <div class="project__progress">
                    <div class="project__bar"><span :style="{ width: `${item.progress}%` }" /></div>
                    <small>进度 {{ item.progress }}%</small>
                  </div>
                  <ul class="card__metrics">
                    <li><small>当前阶段</small><b>{{ item.currentStageName || '—' }}</b></li>
                    <li><small>合同额</small><b><MoneyText :value="item.contractAmount" /></b></li>
                    <li><small>开工日</small><b>{{ formatDateTime(item.startDate) }}</b></li>
                    <li><small>计划完工</small><b>{{ formatDateTime(item.planEndDate) }}</b></li>
                    <li><small>项目经理</small><b>{{ item.managerName || '—' }}</b></li>
                    <li><small>设计师</small><b>{{ item.designerName || '—' }}</b></li>
                  </ul>
                  <footer class="card__foot">
                    <small v-if="item.address">工地：{{ item.address }}</small>
                    <button class="related__link" type="button" @click="router.push(`/designer/projects/${item.id}/acceptance`)">查看阶段验收 →</button>
                  </footer>
                </article>
              </div>
              <WorkbenchState v-else title="该房屋尚未立项" description="项目只能由已生效合同创建；未生效前不显示可执行的项目动作。" min-height="200px" />
            </template>

            <!-- 量房信息：房屋级的量房事实 -->
            <template v-else-if="activeTab === 'measure'">
              <div v-if="activeMeasures.length" class="related__list">
                <article v-for="item in activeMeasures" :key="item.id" class="card-detail">
                  <header>
                    <div class="card__title">
                      <strong>{{ item.completedAt ? '量房已完成' : item.scheduledAt ? '量房已预约' : '量房记录' }}</strong>
                      <small>{{ formatDateTime(item.completedAt || item.scheduledAt || item.measureTime || item.createdAt) }}</small>
                    </div>
                    <StatusTag
                      :tone="item.status === 'completed' ? 'done' : item.status === 'cancelled' ? 'blocked' : 'pending'"
                      :text="MEASURE_STATUS_LABELS[item.status] ?? item.status"
                      :dot="false"
                    />
                  </header>
                  <ul class="card__metrics">
                    <li><small>原始结构</small><b>{{ item.originalStructure || '—' }}</b></li>
                    <li><small>尺寸数据</small><b>{{ item.dimensions || '—' }}</b></li>
                    <li><small>现场照片</small><b>{{ item.sitePhotos?.length ?? 0 }} 张</b></li>
                    <li><small>结构图</small><b>{{ item.structureImages?.length ?? 0 }} 张</b></li>
                  </ul>
                  <p v-if="item.customerRequirements" class="card__desc">客户要求：{{ item.customerRequirements }}</p>
                  <p v-if="item.designerConclusion" class="card__desc">设计师结论：{{ item.designerConclusion }}</p>
                </article>
              </div>
              <WorkbenchState v-else title="该房屋尚未量房" description="量房是设计与报价的前置事实；未量房时方案不得当作已确认依据。" min-height="200px" />
            </template>

            <!-- 付款信息：该房屋项目的收款计划 -->
            <template v-else-if="activeTab === 'payment'">
              <div v-if="paymentsLoading" class="related__loading">加载中…</div>
              <WorkbenchState
                v-else-if="paymentsError"
                variant="error"
                title="付款信息暂不可确认"
                :description="paymentsError"
                action-text="重新加载"
                min-height="160px"
                @action="loadPayments"
              />
              <div v-else-if="receivables.length" class="related__list">
                <article v-for="item in receivables" :key="item.id" class="card-detail">
                  <header>
                    <div class="card__title">
                      <strong>{{ item.name }}</strong>
                      <small>{{ item.stageName || item.project?.name || '收款节点' }} · 到期 {{ formatDateTime(item.dueDate) }}</small>
                    </div>
                    <StatusTag
                      :tone="item.status === 'received' ? 'done' : item.status === 'overdue' ? 'blocked' : item.status === 'partial' ? 'pending' : 'info'"
                      :text="RECEIVABLE_STATUS_LABELS[item.status] ?? item.status"
                      :dot="false"
                    />
                  </header>
                  <ul class="card__metrics">
                    <li><small>应收</small><b><MoneyText :value="item.amount" /></b></li>
                    <li><small>已收</small><b><MoneyText :value="item.receivedAmount" /></b></li>
                    <li><small>未收</small><b><MoneyText :value="item.outstandingAmount" /></b></li>
                    <li><small>类型</small><b>{{ RECEIVABLE_TYPE_LABELS[item.type] ?? item.type }}</b></li>
                    <li><small>需开票</small><b>{{ item.invoiceRequired ? (item.invoiceNo || '是') : '否' }}</b></li>
                  </ul>
                  <p v-if="item.remark" class="card__desc">{{ item.remark }}</p>
                </article>
              </div>
              <div v-else class="pay">
                <article v-if="contracts.some((item) => item.paymentTerms)" class="card-detail">
                  <header>
                    <div class="card__title"><strong>合同付款条款</strong><small>来自该房屋合同（设计师可读）</small></div>
                  </header>
                  <p v-for="item in contracts.filter((c) => c.paymentTerms)" :key="item.id" class="card__desc">{{ item.paymentTerms }}</p>
                </article>
                <p v-if="paymentsDenied" class="pay__note">
                  收款节点与实收金额属于财务数据：当前角色不在财务可见范围内（仅企业负责人 / 财务 / 店长可查看），因此这里不展示应收与实收。
                </p>
                <WorkbenchState
                  v-else
                  title="暂无付款信息"
                  description="付款计划由项目合同节点生成；该房屋尚无已立项项目时不会出现收款节点。"
                  min-height="160px"
                />
              </div>
            </template>
          </div>
        </section>

        <section v-else class="related related--placeholder">
          <WorkbenchState title="请选择一套房屋" description="客户可能有多套房屋，右侧只展示当前选中房屋的诉求、方案、报价、合同与项目。" min-height="260px" />
        </section>
      </div>

      <!-- 跟进时间轴：客户级事实 -->
      <section class="follows">
        <header class="zone-head">
          <h2>跟进时间轴</h2>
          <span>最近服务端记录（{{ follows.length }} 条）</span>
        </header>
        <div v-if="followsLoading" class="related__loading">加载中…</div>
        <WorkbenchState
          v-else-if="followsError"
          variant="error"
          title="跟进记录暂不可确认"
          :description="followsError"
          action-text="重新加载"
          min-height="140px"
          @action="loadFollows"
        />
        <ol v-else-if="follows.length" class="timeline">
          <li v-for="item in follows" :key="item.id">
            <span class="timeline__dot" />
            <div class="timeline__body">
              <p>{{ item.content || '（未填写内容）' }}</p>
              <small>
                {{ formatDateTime(item.createdAt) }} · {{ item.empName || '—' }}
                <template v-if="item.nextFollowAt"> · 下次跟进 {{ formatRelativeDay(item.nextFollowAt) }}</template>
              </small>
            </div>
          </li>
        </ol>
        <p v-else class="related__loading">暂无跟进记录。</p>
      </section>
    </template>

    <CustomerEditSheet :open="customerSheetOpen" :customer="customer" @close="customerSheetOpen = false" @saved="onCustomerSaved" />
    <PropertyEditSheet :open="propertySheetOpen" :customer-id="customerId" :property="editingProperty" @close="propertySheetOpen = false" @saved="onPropertySaved" />
  </div>
</template>

<style scoped lang="scss">
.c360 { display: flex; flex-direction: column; gap: $space-4; min-width: 0; }

.c360__back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: 0;
  border: 0;
  color: $text-secondary;
  background: none;
  font: inherit;
  font-size: $font-caption;
  cursor: pointer;

  svg { width: 14px; height: 14px; }
  &:hover { color: $brand-600; }
}

.c360__skeleton { display: flex; flex-direction: column; gap: $space-3; padding: $space-6; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.c360__skeleton-line { display: block; height: 16px; border-radius: $radius-xs; background: linear-gradient(90deg, $surface-100 25%, $surface-50 37%, $surface-100 63%); background-size: 400% 100%; animation: c360-shimmer 1.4s ease infinite; }
.c360__skeleton-line--title { width: 240px; height: 28px; }

/* ── Hero ── */
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 258px;
  gap: $space-6;
  padding: 26px 28px;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: linear-gradient(135deg, $brand-50 0%, $surface-0 62%);
  box-shadow: $shadow-card;
}

.hero__eyebrow { margin: 0; color: $text-tertiary; font-size: 11px; font-weight: $font-weight-semibold; letter-spacing: .14em; }

.hero__main h1 {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: $space-2;
  margin: 8px 0 0;
  color: $text-primary;
  font-size: $font-display;
  font-weight: $font-weight-bold;
  letter-spacing: -.02em;
}

.hero__edit {
  padding: 4px 12px;
  border: 1px solid $border-color;
  border-radius: $radius-pill;
  color: $text-secondary;
  background: $surface-0;
  font: inherit;
  font-size: $font-caption;
  cursor: pointer;

  &:hover { color: $brand-600; border-color: $brand-300; background: $brand-50; }
}

.hero__contacts { display: flex; flex-wrap: wrap; gap: $space-4; margin-top: $space-3; }

.hero__contact {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: $text-secondary;
  font-size: $font-body-sm;

  svg { width: 15px; height: 15px; flex-shrink: 0; color: $text-tertiary; }
}

.hero__facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(126px, 1fr));
  gap: $space-3 $space-4;
  margin: $space-4 0 0;
  padding: 0;
  list-style: none;

  li { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  small { color: $text-tertiary; font-size: 11px; }
  b { overflow: hidden; color: $text-primary; font-size: $font-body-sm; font-weight: $font-weight-semibold; text-overflow: ellipsis; white-space: nowrap; }
}

.hero__portrait {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: $space-2;
  margin-top: $space-4;
  padding-top: $space-4;
  border-top: 1px dashed $border-color;
}

.hero__portrait-label { color: $text-tertiary; font-size: 11px; font-weight: $font-weight-semibold; letter-spacing: .08em; }

.hero__portrait-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  padding: 4px 11px;
  border-radius: $radius-pill;
  color: $text-primary;
  background: $surface-0;
  box-shadow: inset 0 0 0 1px $border-color;
  font-size: $font-caption;

  small { color: $text-tertiary; font-size: 11px; }
}

.hero__portrait-empty { color: $text-tertiary; font-size: $font-caption; }

.hero__tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: $space-3; }

/* 客户档案：默认收起 */
.archive { margin-top: $space-4; padding-top: $space-3; border-top: 1px dashed $border-color; }

.archive__toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  color: $text-secondary;
  background: none;
  font: inherit;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
  cursor: pointer;

  svg { width: 13px; height: 13px; transition: transform .18s; }
  small { color: $text-tertiary; font-weight: 400; }
  &:hover { color: $brand-600; }
}

.archive__caret--open { transform: rotate(90deg); }

.archive__body { margin-top: $space-3; }

.archive__facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: $space-3;
  margin: 0;

  div { min-width: 0; }
  dt { color: $text-tertiary; font-size: 11px; }
  dd { margin: 2px 0 0; overflow: hidden; color: $text-primary; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; }
}

.archive__wide { grid-column: 1 / -1; }
.archive__wide dd { white-space: normal; line-height: 1.6; }

.hero__guide { align-self: start; }

/* ── 下方布局 ── */
.body { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: $space-4; align-items: start; }

.houses,
.related,
.follows {
  display: flex;
  flex-direction: column;
  gap: $space-3;
  padding: 20px 22px;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
  box-shadow: $shadow-card;
}

.zone-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: $space-3;

  h2 { margin: 0; color: $text-primary; font-size: $font-card-title; font-weight: $font-weight-semibold; }
  span { color: $text-tertiary; font-size: 11px; }
}

.houses__list { display: flex; flex-direction: column; gap: $space-3; }

.house {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-50;
  cursor: pointer;
  transition: border-color .18s, box-shadow .18s, background .18s;

  &:hover { border-color: $brand-300; background: $surface-0; }
  &.active { border-color: $brand-500; background: $surface-0; box-shadow: 0 0 0 3px $brand-50; }
  &:focus-visible { outline: 2px solid $brand-500; outline-offset: 2px; }
}

.house__head { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }

.house__title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  color: $text-primary;
  font-size: $font-body-sm;
  font-weight: $font-weight-semibold;
  text-overflow: ellipsis;
  white-space: nowrap;

  svg { width: 15px; height: 15px; flex-shrink: 0; color: $text-tertiary; }
}

.house__line { margin: 0; color: $text-secondary; font-size: $font-caption; }

.house__counts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
  margin: 0;
  padding-top: 8px;
  border-top: 1px dashed $border-color;
  list-style: none;

  li { display: flex; flex-direction: column; align-items: center; gap: 2px; color: $text-tertiary; font-size: 11px; }
  b { color: $text-primary; font-size: $font-body-sm; font-weight: $font-weight-bold; }
}

.house__ops { display: flex; gap: $space-2; padding-top: 8px; border-top: 1px dashed $border-color; }

.house__op {
  padding: 3px 12px;
  border: 1px solid $border-color;
  border-radius: $radius-pill;
  color: $text-secondary;
  background: $surface-0;
  font: inherit;
  font-size: 11px;
  cursor: pointer;

  &:hover { color: $brand-600; border-color: $brand-300; }
  &:disabled { color: $text-tertiary; cursor: not-allowed; }
}

.house__op--danger:hover { color: $danger-500; border-color: $danger-200; background: $danger-50; }

.houses__error { margin: 0; padding: 8px 12px; border-radius: $radius-sm; color: $danger-500; background: $danger-50; font-size: $font-caption; line-height: 1.6; }

.related__subject {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: $text-secondary;
  font-size: $font-caption;

  svg { width: 14px; height: 14px; color: $text-tertiary; }
}

.related__link {
  padding: 0;
  border: 0;
  color: $brand-600;
  background: none;
  font: inherit;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
  cursor: pointer;

  &:hover { color: $brand-700; }
}

.related__tabs { display: flex; flex-wrap: wrap; gap: $space-1; padding: 4px; border-radius: $radius-md; background: $surface-100; }

.related__tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex: 1 1 auto;
  min-width: 84px;
  padding: 8px 14px;
  border: 0;
  border-radius: $radius-sm;
  color: $text-secondary;
  background: transparent;
  font: inherit;
  font-size: $font-body-sm;
  cursor: pointer;
  transition: all .16s;

  svg { width: 15px; height: 15px; }
  &:hover { color: $text-primary; }
  &.active { color: $brand-700; background: $surface-0; font-weight: $font-weight-semibold; box-shadow: $shadow-card; }
}

.related__panel { min-height: 220px; }
.related__loading { color: $text-tertiary; font-size: $font-body-sm; }

/* ── 通用卡片骨架 ── */
.related__list {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  article { padding: 16px 18px; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-50; }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; }
  p { margin: 8px 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.65; }
}

.card__title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  strong { color: $text-primary; font-size: $font-body-sm; font-weight: $font-weight-semibold; }
  small { color: $text-tertiary; font-size: 11px; }
}

.card__metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
  gap: $space-3;
  margin: $space-3 0 0;
  padding: $space-3 0 0;
  border-top: 1px dashed $border-color;
  list-style: none;

  li { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  small { color: $text-tertiary; font-size: 11px; }
  b { overflow: hidden; color: $text-primary; font-size: $font-body-sm; font-weight: $font-weight-semibold; text-overflow: ellipsis; white-space: nowrap; }
}

.card__desc { margin: 8px 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.65; }
.card__note { margin: 8px 0 0; color: $text-tertiary; font-size: 11px; line-height: 1.6; }

.card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: $space-3;

  span { padding: 2px 10px; border-radius: $radius-pill; color: $text-secondary; background: $surface-100; font-size: 11px; }
}

.card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
  flex-wrap: wrap;
  margin-top: $space-3;
  padding-top: $space-3;
  border-top: 1px dashed $border-color;

  small { color: $text-tertiary; font-size: 11px; }
}

/* ── 报价：金额是一等公民 ── */
.card-quote--history { opacity: .62; }

.quote__amount {
  display: flex;
  align-items: baseline;
  gap: $space-2;
  margin-top: $space-3;

  small { color: $text-tertiary; font-size: 11px; }
  strong { color: $brand-600; font-size: $font-kpi; font-weight: $font-weight-bold; letter-spacing: -.02em; }
}

.quote__breakdown {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: $space-3;
  margin: $space-3 0 0;
  padding: $space-3 0 0;
  border-top: 1px dashed $border-color;

  div { min-width: 0; }
  dt { color: $text-tertiary; font-size: 11px; }
  dd { margin: 2px 0 0; overflow: hidden; color: $text-primary; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; }
}

.related__tags { display: inline-flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }

/* ── 付款信息 ── */
.pay { display: flex; flex-direction: column; gap: $space-3; }

.pay__note {
  margin: 0;
  padding: 12px 14px;
  border: 1px solid $warning-200;
  border-radius: $radius-sm;
  color: $warning-700;
  background: $warning-50;
  font-size: $font-caption;
  line-height: 1.7;
}

/* ── 报价版本轨：跨版本视觉编排 ── */
.rail { position: relative; display: flex; flex-direction: column; gap: $space-4; padding-left: 4px; }

.rail__line {
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 21px;
  width: 2px;
  border-radius: $radius-pill;
  background: $border-color;
}

.rail__item { position: relative; display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: $space-3; align-items: start; }

.rail__node {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding-top: 10px;

  small { color: $text-tertiary; font-size: 11px; font-variant-numeric: tabular-nums; }
}

.rail__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: $surface-0;
  box-shadow: inset 0 0 0 2px $border-color;
}

.rail__item--current .rail__dot { background: $brand-500; box-shadow: 0 0 0 4px $brand-50; }
.rail__item--current .rail__node small { color: $brand-600; font-weight: $font-weight-semibold; }
.rail__item--history { opacity: .58; }
.rail__item--history .rail__dot { background: $surface-100; box-shadow: inset 0 0 0 2px $border-color; }

.rail__card {
  padding: 16px 18px;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-50;

  header { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; }
}

.rail__item--current .rail__card { border-color: $brand-300; background: $surface-0; box-shadow: 0 0 0 3px $brand-50; }

/* ── 诉求：按类型与类别分组 ── */
.req { display: flex; flex-direction: column; gap: $space-4; }

.req__group {
  display: flex;
  flex-direction: column;
  gap: $space-2;

  h4 {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    color: $text-secondary;
    font-size: $font-caption;
    font-weight: $font-weight-semibold;

    small { color: $text-tertiary; font-weight: 400; }
  }
}

.req__item {
  padding: 12px 14px;
  border: 1px solid $border-color;
  border-left: 3px solid $brand-300;
  border-radius: $radius-sm;
  background: $surface-50;

  header { display: flex; align-items: center; justify-content: space-between; gap: $space-3; }
  header strong { color: $text-primary; font-size: $font-body-sm; font-weight: $font-weight-semibold; }
  p { margin: 6px 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.65; }
  small { display: block; margin-top: 6px; color: $text-tertiary; font-size: 11px; }
}

.req__item--reject { border-left-color: $danger-500; }

/* ── 项目进度 ── */
.project__progress { display: flex; align-items: center; gap: $space-3; margin-top: $space-3; }
.project__bar { flex: 1; height: 6px; border-radius: $radius-pill; background: $surface-100; overflow: hidden; }
.project__bar span { display: block; height: 100%; border-radius: $radius-pill; background: $brand-500; }
.project__progress small { color: $text-secondary; font-size: 11px; white-space: nowrap; }

/* ── 跟进时间轴 ── */
.timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;

  li { position: relative; padding: 0 0 $space-4 $space-5; }

  li::before {
    content: '';
    position: absolute;
    top: 12px;
    bottom: 0;
    left: 3px;
    width: 1px;
    background: $border-color;
  }

  li:last-child { padding-bottom: 0; }
  li:last-child::before { display: none; }
  p { margin: 0; color: $text-primary; font-size: $font-body-sm; line-height: 1.65; }
  small { color: $text-tertiary; font-size: 11px; }
}

.timeline__dot {
  position: absolute;
  top: 5px;
  left: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: $brand-500;
  box-shadow: 0 0 0 3px $brand-50;
}

.related--placeholder { justify-content: center; }

@keyframes c360-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

@media (max-width: 1240px) {
  .hero { grid-template-columns: minmax(0, 1fr) 232px; }
  .body { grid-template-columns: 280px minmax(0, 1fr); }
}

@media (max-width: 1024px) {
  .hero { grid-template-columns: 1fr; }
  .body { grid-template-columns: 1fr; }
}

@media (max-width: 720px) {
  .hero { padding: 20px; }
  .houses,
  .related,
  .follows { padding: 16px; }
  .quote__breakdown { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (prefers-reduced-motion: reduce) {
  .c360__skeleton-line { animation: none; }
}
</style>
