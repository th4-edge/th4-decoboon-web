<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ProviderError } from '@/core/http'
import { formatDateTime, formatFollowDue, formatMoney, formatRelativeDay } from '@/core/format'
import { crmApi } from '@/domains/crm/api'
import type {
  Customer,
  CustomerFollow,
  CustomerMetricCard,
  CustomerOwnerGroup,
  CustomerOverviewReport,
  StoreScopeInfo
} from '@/domains/crm/model'
import { CUSTOMER_RISK_META, CUSTOMER_SOURCE_LABELS, CUSTOMER_STAGE_META } from '@/domains/crm/customerMeta'
import { canManageDormantRole } from '@/domains/crm/dormant'
import { portraitItemsOf } from '@/domains/crm/portrait'
import { designApi } from '@/domains/design/api'
import type { DesignRequirement, DesignScheme } from '@/domains/design/model'
import { contractApi } from '@/domains/contract/api'
import type { Contract } from '@/domains/contract/model'
import { listLeadTouches } from '@/domains/content/api'
import type { LeadTouch } from '@/domains/content/model'
import { financeApi } from '@/domains/finance/api'
import { projectApi } from '@/domains/project/api'
import type { ProjectBrief } from '@/domains/project/model'
import { propertyApi } from '@/domains/property/api'
import type { Measure, Property } from '@/domains/property/model'
import { quoteFinancePage } from '@/domains/trade/api'
import type { Quote } from '@/domains/trade/model'
import { useSessionStore } from '@/stores/session'
import { useStoreScopeStore } from '@/stores/storeScope'
import StoreScopePicker from '@/components/StoreScopePicker.vue'
import NavIcon from '@/components/shell/NavIcon.vue'
import StatusTag from '@/components/StatusTag.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import CustomerCreateSheet from '@/components/customer/CustomerCreateSheet.vue'
import CustomerEditSheet from '@/components/customer/CustomerEditSheet.vue'
import CustomerFollowFormDrawer from '@/components/customer/CustomerFollowFormDrawer.vue'
import CustomerLossDrawer from '@/components/customer/CustomerLossDrawer.vue'
import PropertyPicker from '@/components/picker/PropertyPicker.vue'
import EmployeePicker from '@/components/picker/EmployeePicker.vue'
import PropertyFormDrawer from '@/components/property/PropertyFormDrawer.vue'

const CONTENT_ATTRIBUTION_LABELS: Record<string, string> = {
  platform: '平台回传', uniqueCode: '专属入口', manual: '人工确认', selfReport: '客户自述', inference: '辅助推断'
}
const CONTENT_CONFIDENCE_LABELS: Record<string, string> = { high: '高置信', medium: '中置信', low: '低置信' }

type CardFilter = 'all' | 'risk' | 'pendingMeasure' | 'quote' | 'sign' | 'construction' | 'lost' | 'contract' | 'project' | 'receivable' | 'overdue'
type DetailTab = 'requirement' | 'scheme' | 'quote' | 'contract' | 'project' | 'measure' | 'payment'

interface CustomerCardProjection {
  customer: Customer
  contractAmount?: number
  receivableAmount?: number
  overdueAmount?: number
  measureStatus?: string
  designStatus?: string
  quoteStatus?: string
  nextAction: string
  nextHint?: string
  filterKeys: string[]
  previewStoreKey?: 'binhu' | 'zhengwu' | 'main'
}

interface MetricView {
  key: string
  label: string
  value: string
  unit: string
  note: string
  tone: 'normal' | 'attention' | 'danger' | 'info'
  icon: string
}

interface OwnerGroupView {
  key: string
  name: string
  count: number
  pendingCount: number
}

interface BusinessChainView {
  label: string
  stateText: string
  detail: string
  tone: 'normal' | 'attention' | 'danger' | 'info'
}

interface JourneyStepView {
  key: string
  label: string
  status: 'done' | 'current' | 'todo'
}

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const scope = useStoreScopeStore()
const previewMode = computed(() => String(route.query.preview ?? '') === '1')
const customerId = computed(() => String(route.params.customerId ?? ''))
const isCustomer360Page = computed(() => Boolean(customerId.value))
const role = computed(() => session.role)
const isBoss = computed(() => role.value === 'Boss')
const isStoreManager = computed(() => role.value === 'StoreManager')
const isFinance = computed(() => role.value === 'Finance')
/** 与小程序客户 Tab 同源：Boss / 店长 / 财务统一消费 customer/customer/overview。 */
const usesCustomerOverview = computed(() => ['Boss', 'StoreManager', 'Finance'].includes(role.value ?? ''))
const canMaintainCustomer = computed(() => ['Boss', 'StoreManager', 'Finance'].includes(role.value ?? ''))
/** 财务可经营客户，但不承担设计派单；派单/改派只属于 Boss、店长。 */
const canAssignDesigner = computed(() => ['Boss', 'StoreManager'].includes(role.value ?? ''))
const canManageLoss = computed(() => canManageDormantRole(role.value))
const pageTitle = computed(() => isStoreManager.value ? '本店客户' : '客户')
const pageDescription = computed(() => isFinance.value
  ? '客户是房屋、设计、报价、合同、项目和收款的统一入口；所有角色使用同一客户卡，专业动作在客户上下文内承接。'
  : isStoreManager.value
    ? '查看本店客户当前状态、房屋、负责人和下一步；按负责人分组找到需要协同的客户。'
    : '从客户当前状态、房屋、负责人和下一步观察经营情况；按门店与负责人分组查看客户。')

const customers = ref<Customer[]>([])
const overview = ref<CustomerOverviewReport | null>(null)
const serverScope = ref<StoreScopeInfo | null>(null)
const keyword = ref('')
const ownerKeyword = ref('')
const activeFilter = ref<CardFilter>('all')
const selectedOwner = ref('all')
const previewStoreId = ref<'all' | 'binhu' | 'zhengwu' | 'main'>('all')
const loading = ref(false)
const error = ref('')
const busy = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const selectedCard = ref<CustomerCardProjection | null>(null)
const selectedCustomer = ref<Customer | null>(null)
const detailProperties = ref<Property[]>([])
const detailFollows = ref<CustomerFollow[]>([])
const detailSchemes = ref<DesignScheme[]>([])
const detailQuotes = ref<Quote[]>([])
const detailProjects = ref<ProjectBrief[]>([])
const detailRequirements = ref<DesignRequirement[]>([])
const detailContracts = ref<Contract[]>([])
const detailMeasuresByProperty = ref<Record<string, Measure[]>>({})
const detailContentTouches = ref<LeadTouch[]>([])
const detailContentError = ref('')
const detailReceivables = ref<Array<{ projectId?: string; amount?: number; receivedAmount?: number; outstandingAmount?: number; overdue?: boolean }>>([])
const activePropertyId = ref('')
const detailTab = ref<DetailTab>('requirement')
let loadingCustomer360Id = ''
let loadedCustomer360Id = ''

const createVisible = ref(false)
const editVisible = ref(false)
const followVisible = ref(false)
const lossVisible = ref(false)
const lossMode = ref<'mark' | 'restore'>('mark')
const transferVisible = ref(false)
const assignVisible = ref(false)
const propertyFormVisible = ref(false)
const propertyFormEditing = ref<Property | null>(null)
const propertyPickerKey = ref(0)
const ownerId = ref('')
const ownerReason = ref('')
const designerId = ref('')
const propertyId = ref('')

const allPreviewCards: CustomerCardProjection[] = [
  {
    customer: {
      id: 'preview-c1', name: '张先生', phone: '138****2618', stage: 'construction', grade: 'A',
      store: { id: 'preview-store-binhu', name: '滨湖店' }, community: '滨湖云谷 3栋1601',
      ownerId: 'owner-lina', ownerName: '李娜', designerName: '周宁', riskLevel: 'Normal', idleDays: 2,
      lastFollowAt: '2026-10-27 10:20:00', nextFollowAt: '2026-10-30 09:30:00',
      measured: true, measureAt: '2026-10-18 14:00:00', quoteAmount: 286000, signedAmount: 268000,
      projectId: 'preview-project-1', projectName: '滨湖云谷 · 张先生家', nextAction: '查看下一收款节点', riskReason: '项目施工中'
    },
    contractAmount: 268000, receivableAmount: 68000, overdueAmount: 0, measureStatus: '已完成',
    designStatus: '已确认', quoteStatus: '已接受', nextAction: '查看下一收款节点',
    nextHint: '10月30日下期款 ¥42,000', filterKeys: ['contract', 'project', 'receivable'], previewStoreKey: 'binhu'
  },
  {
    customer: {
      id: 'preview-c2', name: '王女士', phone: '139****7720', stage: 'quote', grade: 'B',
      store: { id: 'preview-store-binhu', name: '滨湖店' }, community: '望江台 2栋902',
      ownerId: 'owner-wang', ownerName: '王强', designerName: '陈晨', riskLevel: 'High', idleDays: 6,
      lastFollowAt: '2026-10-23 16:00:00', nextFollowAt: '2026-10-27 10:00:00',
      measured: true, measureAt: '2026-10-12 09:00:00', quoteAmount: 182000, signedAmount: 0,
      nextAction: '跟进报价确认', riskReason: '报价停留超过 3 天'
    },
    contractAmount: 0, receivableAmount: 0, overdueAmount: 0, measureStatus: '已完成',
    designStatus: '方案已出', quoteStatus: '待客户确认', nextAction: '跟进报价确认',
    nextHint: '报价 V3 · ¥182,000', filterKeys: ['quote', 'risk'], previewStoreKey: 'binhu'
  },
  {
    customer: {
      id: 'preview-c3', name: '陈先生', phone: '136****5833', stage: 'construction', grade: 'A',
      store: { id: 'preview-store-zhengwu', name: '政务店' }, community: '荷塘家园 8栋1102',
      ownerId: 'owner-lina', ownerName: '李娜', designerName: '周宁', riskLevel: 'Attention', idleDays: 1,
      lastFollowAt: '2026-10-28 17:20:00', nextFollowAt: '2026-10-31 14:00:00',
      measured: true, measureAt: '2026-10-02 10:00:00', quoteAmount: 435000, signedAmount: 425000,
      projectId: 'preview-project-3', projectName: '荷塘家园 · 陈先生家', nextAction: '登记收款', riskReason: '下期应收逾期 3 天'
    },
    contractAmount: 425000, receivableAmount: 123000, overdueAmount: 32000, measureStatus: '已完成',
    designStatus: '已确认', quoteStatus: '已接受', nextAction: '登记收款',
    nextHint: '逾期 3 天 · ¥32,000', filterKeys: ['contract', 'project', 'receivable', 'overdue', 'risk'], previewStoreKey: 'zhengwu'
  },
  {
    customer: {
      id: 'preview-c4', name: '刘女士', phone: '137****0941', stage: 'pendingMeasure', grade: 'B',
      store: { id: 'preview-store-main', name: '总店' }, community: '高速时代 5栋2203',
      ownerName: '未分配', designerName: '未指派', riskLevel: 'Attention', idleDays: 4,
      lastFollowAt: '2026-10-25 11:00:00', nextFollowAt: '2026-10-30 14:00:00',
      measured: false, measureScheduled: true, nextAction: '指派设计师', riskReason: '待量房超过 3 天'
    },
    receivableAmount: 0, overdueAmount: 0, measureStatus: '已预约', designStatus: '未开始',
    quoteStatus: '未生成', nextAction: '指派设计师', nextHint: '量房预约 10-30 14:00',
    filterKeys: ['pendingMeasure', 'risk'], previewStoreKey: 'main'
  },
  {
    customer: {
      id: 'preview-c5', name: '何先生', phone: '135****4108', stage: 'sign', grade: 'A',
      store: { id: 'preview-store-binhu', name: '滨湖店' }, community: '保利香槟 1栋701',
      ownerId: 'owner-zhao', ownerName: '赵敏', designerName: '周宁', riskLevel: 'Normal', idleDays: 3,
      lastFollowAt: '2026-10-26 15:00:00', nextFollowAt: '2026-11-02 10:00:00',
      measured: true, measureAt: '2026-09-28 14:00:00', quoteAmount: 188000, signedAmount: 188000,
      projectId: 'preview-project-5', projectName: '保利香槟 · 何先生家', nextAction: '核对首期款', riskReason: '合同已生效，项目待立项'
    },
    contractAmount: 188000, receivableAmount: 188000, overdueAmount: 0, measureStatus: '已完成',
    designStatus: '已确认', quoteStatus: '已接受', nextAction: '核对首期款',
    nextHint: '合同已生效 · 待立项', filterKeys: ['contract', 'receivable', 'sign'], previewStoreKey: 'binhu'
  },
  {
    customer: {
      id: 'preview-c6', name: '孙女士', phone: '133****6650', stage: 'done', grade: 'B',
      store: { id: 'preview-store-zhengwu', name: '政务店' }, community: '万科城 12栋902',
      ownerId: 'owner-chen', ownerName: '陈晨', designerName: '周宁', riskLevel: 'Normal', idleDays: 9,
      lastFollowAt: '2026-10-20 09:00:00', measured: true, measureAt: '2026-08-16 10:00:00',
      quoteAmount: 156000, signedAmount: 156000, projectId: 'preview-project-6', projectName: '万科城 · 孙女士家',
      nextAction: '查看结算'
    },
    contractAmount: 156000, receivableAmount: 0, overdueAmount: 0, measureStatus: '已完成',
    designStatus: '已确认', quoteStatus: '已接受', nextAction: '查看结算',
    nextHint: '应收已清零 · 待结算', filterKeys: ['contract', 'project'], previewStoreKey: 'zhengwu'
  },
  {
    customer: {
      id: 'preview-c7', name: '赵先生', phone: '132****8080', stage: 'lost', grade: 'C',
      store: { id: 'preview-store-main', name: '总店' }, community: '翡翠天际 9栋1808',
      ownerId: 'owner-wang', ownerName: '王强', designerName: '—', riskLevel: 'High', idleDays: 41,
      lastFollowAt: '2026-09-18 16:00:00', quoteAmount: 120000, signedAmount: 0, nextAction: '查看流失原因',
      riskReason: '价格或预算不匹配'
    },
    contractAmount: 0, receivableAmount: 0, overdueAmount: 0, measureStatus: '已取消',
    designStatus: '—', quoteStatus: '已驳回', nextAction: '查看流失原因',
    nextHint: '价格或预算不匹配', filterKeys: ['lost', 'risk'], previewStoreKey: 'main'
  }
]

const previewStoreOptions = [
  { value: 'all', label: '全部门店' },
  { value: 'binhu', label: '滨湖店' },
  { value: 'zhengwu', label: '政务店' },
  { value: 'main', label: '总店' }
]

const previewMetric = (
  key: string,
  label: string,
  value: string,
  note: string,
  tone: MetricView['tone'],
  icon: string
): MetricView => ({ key, label, value, unit: '位', note, tone, icon })

/**
 * 预览页只展示与真实 Provider 同形状的聚合快照。
 * 即使处于 preview 模式，也从聚合夹具取值，不从客户卡数组计算经营指标。
 */
const previewMetricFixtures: Record<string, Record<string, MetricView[]>> = {
  all: {
    Boss: [
      previewMetric('new', '本月新增客户', '18', '全公司 · 今日新增变化', 'info', 'customer.followup'),
      previewMetric('follow', '活跃跟进', '42', '全公司 · 7 日内有沟通', 'normal', 'designer.followup'),
      previewMetric('signed', '本月已签约', '12', '全公司 · 本月签约变化', 'normal', 'designer.contract'),
      previewMetric('risk', '风险客户', '4', '全公司 · 逾期或长期未跟进', 'danger', 'boss.risk')
    ],
    StoreManager: [
      previewMetric('total', '本店客户', '3', '本店客户范围', 'info', 'customer.followup'),
      previewMetric('measure', '待量房', '0', '等待安排量房', 'attention', 'designer.measure'),
      previewMetric('quote', '方案/报价中', '1', '正在设计与报价', 'normal', 'designer.design'),
      previewMetric('signed', '已签约/施工', '2', '已进入签约或项目阶段', 'normal', 'designer.contract')
    ],
    Finance: [
      previewMetric('total', '当前客户', '7', '当前客户范围', 'info', 'customer.followup'),
      previewMetric('measure', '待量房', '1', '等待安排量房', 'attention', 'designer.measure'),
      previewMetric('quote', '方案/报价中', '1', '正在设计与报价', 'normal', 'designer.design'),
      previewMetric('signed', '已签约/施工', '4', '已进入签约或项目阶段', 'normal', 'designer.contract')
    ]
  },
  binhu: {
    Boss: [
      previewMetric('new', '本月新增客户', '7', '滨湖店 · 今日新增变化', 'info', 'customer.followup'),
      previewMetric('follow', '活跃跟进', '19', '滨湖店 · 7 日内有沟通', 'normal', 'designer.followup'),
      previewMetric('signed', '本月已签约', '5', '滨湖店 · 本月签约变化', 'normal', 'designer.contract'),
      previewMetric('risk', '风险客户', '3', '滨湖店 · 逾期或长期未跟进', 'danger', 'boss.risk')
    ],
    StoreManager: [
      previewMetric('total', '本店客户', '3', '本店客户范围', 'info', 'customer.followup'),
      previewMetric('measure', '待量房', '0', '等待安排量房', 'attention', 'designer.measure'),
      previewMetric('quote', '方案/报价中', '1', '正在设计与报价', 'normal', 'designer.design'),
      previewMetric('signed', '已签约/施工', '2', '已进入签约或项目阶段', 'normal', 'designer.contract')
    ],
    Finance: [
      previewMetric('total', '当前客户', '3', '滨湖店客户范围', 'info', 'customer.followup'),
      previewMetric('measure', '待量房', '0', '等待安排量房', 'attention', 'designer.measure'),
      previewMetric('quote', '方案/报价中', '1', '正在设计与报价', 'normal', 'designer.design'),
      previewMetric('signed', '已签约/施工', '2', '已进入签约或项目阶段', 'normal', 'designer.contract')
    ]
  },
  zhengwu: {
    Boss: [
      previewMetric('new', '本月新增客户', '5', '政务店 · 今日新增变化', 'info', 'customer.followup'),
      previewMetric('follow', '活跃跟进', '12', '政务店 · 7 日内有沟通', 'normal', 'designer.followup'),
      previewMetric('signed', '本月已签约', '3', '政务店 · 本月签约变化', 'normal', 'designer.contract'),
      previewMetric('risk', '风险客户', '2', '政务店 · 逾期或长期未跟进', 'danger', 'boss.risk')
    ],
    Finance: [
      previewMetric('total', '当前客户', '2', '政务店客户范围', 'info', 'customer.followup'),
      previewMetric('measure', '待量房', '0', '等待安排量房', 'attention', 'designer.measure'),
      previewMetric('quote', '方案/报价中', '0', '正在设计与报价', 'normal', 'designer.design'),
      previewMetric('signed', '已签约/施工', '2', '已进入签约或项目阶段', 'normal', 'designer.contract')
    ]
  },
  main: {
    Boss: [
      previewMetric('new', '本月新增客户', '6', '总店 · 今日新增变化', 'info', 'customer.followup'),
      previewMetric('follow', '活跃跟进', '11', '总店 · 7 日内有沟通', 'normal', 'designer.followup'),
      previewMetric('signed', '本月已签约', '4', '总店 · 本月签约变化', 'normal', 'designer.contract'),
      previewMetric('risk', '风险客户', '2', '总店 · 逾期或长期未跟进', 'danger', 'boss.risk')
    ],
    Finance: [
      previewMetric('total', '当前客户', '2', '总店客户范围', 'info', 'customer.followup'),
      previewMetric('measure', '待量房', '1', '等待安排量房', 'attention', 'designer.measure'),
      previewMetric('quote', '方案/报价中', '0', '正在设计与报价', 'normal', 'designer.design'),
      previewMetric('signed', '已签约/施工', '0', '已进入签约或项目阶段', 'normal', 'designer.contract')
    ]
  }
}

const previewOwnerGroupFixtures: Record<string, OwnerGroupView[]> = {
  all: [
    { key: 'all', name: '全部客户', count: 7, pendingCount: 1 },
    { key: 'owner-lina', name: '李娜', count: 2, pendingCount: 0 },
    { key: 'owner-wang', name: '王强', count: 2, pendingCount: 0 },
    { key: 'owner-zhao', name: '赵敏', count: 1, pendingCount: 1 },
    { key: 'owner-chen', name: '陈晨', count: 1, pendingCount: 0 },
    { key: 'unassigned', name: '未分配', count: 1, pendingCount: 0 }
  ],
  binhu: [
    { key: 'all', name: '全部客户', count: 3, pendingCount: 0 },
    { key: 'owner-lina', name: '李娜', count: 1, pendingCount: 0 },
    { key: 'owner-wang', name: '王强', count: 1, pendingCount: 0 },
    { key: 'owner-zhao', name: '赵敏', count: 1, pendingCount: 0 }
  ],
  zhengwu: [
    { key: 'all', name: '全部客户', count: 2, pendingCount: 0 },
    { key: 'owner-lina', name: '李娜', count: 1, pendingCount: 0 },
    { key: 'owner-chen', name: '陈晨', count: 1, pendingCount: 0 }
  ],
  main: [
    { key: 'all', name: '全部客户', count: 2, pendingCount: 1 },
    { key: 'owner-zhao', name: '赵敏', count: 1, pendingCount: 1 },
    { key: 'owner-wang', name: '王强', count: 1, pendingCount: 0 }
  ]
}

const effectivePreviewStore = computed(() => isStoreManager.value ? 'binhu' : previewStoreId.value)
const previewMetrics = computed<Record<string, MetricView[]>>(() => previewMetricFixtures[effectivePreviewStore.value] ?? {})

const realCards = computed<CustomerCardProjection[]>(() => customers.value.map(customer => toCardProjection(customer)))
const baseCards = computed(() => {
  if (previewMode.value) {
    return allPreviewCards.filter(card => effectivePreviewStore.value === 'all' || card.previewStoreKey === effectivePreviewStore.value)
  }
  return realCards.value
})

const ownerGroups = computed<OwnerGroupView[]>(() => {
  if (previewMode.value) return previewOwnerGroupFixtures[effectivePreviewStore.value] ?? []
  const serverPendingCount = overview.value?.stageCounts.find(item => item.key === 'pendingMeasure')?.count
  const pendingCount = serverPendingCount ?? 0
  const allGroup: OwnerGroupView = { key: 'all', name: '全部客户', count: overview.value?.total ?? 0, pendingCount }
  if (usesCustomerOverview.value) {
    return [
      allGroup,
      ...(overview.value?.ownerGroups ?? []).map((group: CustomerOwnerGroup) => ({
        key: group.ownerId || group.ownerName,
        name: group.ownerName,
        count: group.customerCount,
        pendingCount: group.pendingMeasureCount
      }))
    ]
  }
  return [{ key: 'all', name: '全部客户', count: 0, pendingCount: 0 }]
})

const ownerSummaryUnavailable = computed(() => !previewMode.value && !usesCustomerOverview.value)

const filteredOwnerGroups = computed(() => {
  const q = ownerKeyword.value.trim().toLowerCase()
  if (!q) return ownerGroups.value
  return ownerGroups.value.filter(group => group.key === 'all' || group.name.toLowerCase().includes(q))
})

const metrics = computed<MetricView[]>(() => {
  if (previewMode.value) return previewMetrics.value[role.value ?? 'Boss'] ?? []
  if (usesCustomerOverview.value && overview.value?.metrics?.length) return overview.value.metrics.slice(0, 4).map(metric => mapRealMetric(metric))
  return []
})

const filterOptions: Array<{ key: CardFilter; label: string; icon: string }> = [
  { key: 'all', label: '全部客户', icon: 'customer.followup' },
  { key: 'risk', label: '风险客户', icon: 'boss.risk' },
  { key: 'pendingMeasure', label: '待量房', icon: 'designer.measure' },
  { key: 'quote', label: '方案/报价', icon: 'designer.design' },
  { key: 'sign', label: '已签约', icon: 'designer.contract' },
  { key: 'construction', label: '施工中', icon: 'pm.project' },
  { key: 'lost', label: '已流失', icon: 'back' }
]

const visibleCards = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  return baseCards.value.filter(card => {
    const customer = card.customer
    if (selectedOwner.value !== 'all' && (customer.ownerId || customer.ownerName || '未分配') !== selectedOwner.value) return false
    if (!cardMatchesFilter(card, activeFilter.value)) return false
    if (q && ![customer.name, customer.phone, customer.community, customer.ownerName, customer.designerName].filter(Boolean).join(' ').toLowerCase().includes(q)) return false
    return true
  })
})

const unassignedCount = computed(() => serverScope.value?.unassignedCount ?? 0)
const showUnassigned = computed(() => usesCustomerOverview.value && !scope.requestStoreId && unassignedCount.value > 0)
const displayStoreName = computed(() => {
  if (previewMode.value) return isStoreManager.value ? '滨湖店（本店）' : storeLabel(previewStoreId.value)
  return scope.activeStoreName || '全部门店'
})

const detailProperty = computed(() => detailProperties.value.find(property => property.id === activePropertyId.value) ?? null)
const detailActiveSchemes = computed(() => detailSchemes.value.filter(item => !activePropertyId.value || item.propertyId === activePropertyId.value))
const detailActiveQuotes = computed(() => detailQuotes.value.filter(item => !activePropertyId.value || item.propertyId === activePropertyId.value))
const detailActiveProjects = computed(() => detailProjects.value.filter(item => !activePropertyId.value || item.propertyId === activePropertyId.value))
const detailActiveMeasures = computed(() => detailMeasuresByProperty.value[activePropertyId.value] ?? [])
const detailQuoteVersions = computed(() => [...detailActiveQuotes.value].sort((a, b) => a.version - b.version))
const detailPortrait = computed(() => portraitItemsOf(selectedCustomer.value?.portrait))
const detailSourceLabel = computed(() => {
  const source = selectedCustomer.value?.source
  return source ? (CUSTOMER_SOURCE_LABELS[source] ?? source) : '来源暂未填写'
})
const detailTabOptions: Array<{ key: DetailTab; label: string; icon: string }> = [
  { key: 'requirement', label: '需求', icon: 'designer.followup' },
  { key: 'scheme', label: '方案', icon: 'designer.design' },
  { key: 'quote', label: '报价', icon: 'designer.quote' },
  { key: 'contract', label: '合同', icon: 'designer.contract' },
  { key: 'project', label: '项目', icon: 'pm.project' },
  { key: 'measure', label: '量房', icon: 'designer.measure' },
  { key: 'payment', label: '收款', icon: 'finance.receivable' }
]
const detailJourney = computed<JourneyStepView[]>(() => {
  const customer = selectedCustomer.value
  if (!customer) return []
  const steps = [
    { key: 'visit', label: '到店' }, { key: 'follow', label: '跟进' }, { key: 'measure', label: '量房' },
    { key: 'design', label: '设计' }, { key: 'quote', label: '报价' }, { key: 'sign', label: '签约' },
    { key: 'project', label: '项目' }
  ]
  let currentIndex = 1
  if (detailActiveProjects.value.length || ['construction', 'done'].includes(customer.stage)) currentIndex = 6
  else if ((customer.signedAmount ?? 0) > 0 || customer.stage === 'sign') currentIndex = 5
  else if ((customer.quoteAmount ?? 0) > 0 || customer.stage === 'quote') currentIndex = 4
  else if (detailActiveSchemes.value.length || customer.designerName) currentIndex = 3
  else if (customer.measured || customer.measureAt || customer.stage === 'pendingMeasure') currentIndex = 2
  else if (customer.stage === 'following') currentIndex = 1
  else if (customer.stage === 'intention') currentIndex = 0
  return steps.map((step, index) => ({
    ...step,
    status: index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo'
  }))
})
const detailBusinessChain = computed<BusinessChainView[]>(() => {
  const card = selectedCard.value
  if (!card) return []
  if (previewMode.value) {
    return [
      { label: '量房', stateText: card.measureStatus ?? '暂不可确认', detail: card.customer.measureAt ? `最近量房 ${formatDateTime(card.customer.measureAt)}` : '尚未形成量房记录', tone: card.measureStatus === '已完成' ? 'normal' : 'attention' },
      { label: '设计方案', stateText: card.designStatus ?? '暂不可确认', detail: card.designStatus ? '设计方案事实按当前房屋展示' : '方案状态暂不可确认', tone: card.designStatus ? 'normal' : 'attention' },
      { label: '报价', stateText: card.quoteStatus ?? '暂不可确认', detail: card.customer.quoteAmount ? `报价 ¥${formatMoney(card.customer.quoteAmount)}` : '暂无有效报价', tone: card.quoteStatus ? 'normal' : 'attention' },
      { label: '合同', stateText: (card.contractAmount ?? 0) > 0 ? '已形成' : '未形成', detail: (card.contractAmount ?? 0) > 0 ? `合同金额 ¥${formatMoney(card.contractAmount)}` : '暂无合同事实', tone: (card.contractAmount ?? 0) > 0 ? 'normal' : 'attention' },
      { label: '项目', stateText: card.customer.projectName ? (card.customer.stage === 'construction' ? '施工中' : '已立项') : '未立项', detail: card.customer.projectName || '暂无项目事实', tone: card.customer.projectName ? 'normal' : 'attention' },
      { label: '应收', stateText: (card.overdueAmount ?? 0) > 0 ? '存在逾期' : (card.receivableAmount ?? 0) > 0 ? '待收' : (card.receivableAmount === 0 ? '已清' : '暂不可确认'), detail: (card.receivableAmount ?? 0) > 0 ? `待收 ¥${formatMoney(card.receivableAmount)}${(card.overdueAmount ?? 0) > 0 ? ` · 逾期 ¥${formatMoney(card.overdueAmount)}` : ''}` : '当前列表未返回正式应收摘要', tone: (card.overdueAmount ?? 0) > 0 ? 'danger' : (card.receivableAmount ?? 0) > 0 ? 'attention' : 'info' }
    ]
  }
  const propertyId = activePropertyId.value
  const schemes = detailSchemes.value.filter(item => !propertyId || item.propertyId === propertyId)
  const quotes = detailQuotes.value.filter(item => !propertyId || item.propertyId === propertyId)
  const projects = detailProjects.value.filter(item => !propertyId || item.propertyId === propertyId)
  const receivable = detailReceivables.value.filter(item => !propertyId || projects.some(project => project.id === item.projectId))
  const latestScheme = schemes[0]
  const latestQuote = quotes[0]
  const latestProject = projects[0]
  const sum = (values: Array<number | undefined>) => values.reduce<number>((total, value) => total + (value ?? 0), 0)
  const receivableAmount = receivable.length ? sum(receivable.map(item => item.amount)) : sum(projects.map(item => item.receivableAmount))
  const receivedAmount = receivable.length ? sum(receivable.map(item => item.receivedAmount)) : sum(projects.map(item => item.receivedAmount))
  return [
    { label: '量房', stateText: card.measureStatus ?? '暂不可确认', detail: card.customer.measureAt ? `最近量房 ${formatDateTime(card.customer.measureAt)}` : '暂不可确认', tone: card.measureStatus === '已完成' ? 'normal' : 'attention' },
    { label: '设计方案', stateText: latestScheme ? designStatusLabel(latestScheme.status) : '暂不可确认', detail: latestScheme?.name || '暂未读取到方案', tone: latestScheme ? 'normal' : 'attention' },
    { label: '报价', stateText: latestQuote ? quoteStatusLabel(latestQuote.status) : '暂不可确认', detail: latestQuote ? `报价版本 ${latestQuote.version ?? '—'} · ¥${formatMoney(latestQuote.amount)}` : '暂未读取到报价', tone: latestQuote ? 'normal' : 'attention' },
    { label: '合同', stateText: latestProject?.contractAmount ? '已形成' : '暂不可确认', detail: latestProject?.contractAmount ? `项目合同额 ¥${formatMoney(latestProject.contractAmount)}` : '请在项目财务中核对', tone: latestProject?.contractAmount ? 'normal' : 'attention' },
    { label: '项目', stateText: latestProject ? projectStatusLabel(latestProject.status) : '暂不可确认', detail: latestProject ? `${latestProject.name}${latestProject.managerName ? ` · 项目经理 ${latestProject.managerName}` : ''}` : '暂未读取到项目', tone: latestProject ? 'normal' : 'attention' },
    { label: '应收', stateText: receivableAmount > 0 ? '有待收' : receivableAmount === 0 ? '已清/暂无' : '暂不可确认', detail: receivableAmount > 0 ? `应收 ¥${formatMoney(receivableAmount)} · 已收 ¥${formatMoney(receivedAmount)}` : '应收信息暂不可确认', tone: receivableAmount > 0 ? 'attention' : 'info' }
  ]
})

function storeLabel(key: string): string {
  return key === 'all' ? '全部门店' : key === 'binhu' ? '滨湖店' : key === 'zhengwu' ? '政务店' : '总店'
}
function mapRealMetric(metric: CustomerMetricCard): MetricView {
  const unit = metric.valueType === 'amount' ? '元' : metric.valueType === 'percent' ? '%' : '位'
  const value = metric.valueType === 'amount' ? formatMetricAmount(metric.value) : String(metric.value)
  return {
    key: metric.key,
    label: metric.label,
    value,
    unit,
    note: metric.subText || '当前客户经营数据',
    tone: metric.status === 'danger' ? 'danger' : metric.status === 'attention' ? 'attention' : 'normal',
    icon: metric.key.includes('risk') ? 'boss.risk' : metric.key.includes('sign') ? 'designer.contract' : metric.key.includes('follow') ? 'designer.followup' : 'customer.followup'
  }
}
function formatMetricAmount(value: number): string {
  if (Math.abs(value) >= 100000000) return `${(value / 100000000).toFixed(1)}亿`
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(1)}万`
  return formatMoney(value)
}
function toCardProjection(customer: Customer): CustomerCardProjection {
  const measureStatus = customer.measured ? '已完成' : customer.measureScheduled || customer.measureAt ? '已预约' : '暂不可确认'
  const quoteStatus = (customer.quoteAmount ?? 0) > 0 ? '已有报价' : '暂无报价'
  const filterKeys = ['all']
  if (customer.riskLevel && customer.riskLevel !== 'Normal') filterKeys.push('risk')
  if (customer.stage === 'pendingMeasure') filterKeys.push('pendingMeasure')
  if (customer.stage === 'quote') filterKeys.push('quote')
  if (['sign', 'construction', 'done'].includes(customer.stage) || (customer.signedAmount ?? 0) > 0) filterKeys.push('sign', 'contract')
  if (customer.stage === 'construction') filterKeys.push('construction')
  if (customer.stage === 'lost') filterKeys.push('lost')
  if (customer.projectName) filterKeys.push('project')
  return {
    customer,
    contractAmount: customer.signedAmount,
    measureStatus,
    designStatus: '暂不可确认',
    quoteStatus,
    nextAction: customer.nextAction || customer.mainlineLabel || '查看客户',
    nextHint: customer.mainlineHint || customer.riskReason || (customer.nextFollowAt ? `下次跟进 ${formatRelativeDay(customer.nextFollowAt)}` : '暂未安排下一步'),
    filterKeys
  }
}
function cardMatchesFilter(card: CustomerCardProjection, filter: CardFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'risk') return card.customer.riskLevel === 'High' || card.customer.riskLevel === 'Attention'
  if (filter === 'contract') return (card.contractAmount ?? card.customer.signedAmount ?? 0) > 0
  if (filter === 'project') return !!card.customer.projectName
  if (filter === 'receivable') return (card.receivableAmount ?? 0) > 0
  if (filter === 'overdue') return (card.overdueAmount ?? 0) > 0
  return card.filterKeys.includes(filter) || card.customer.stage === filter
}
function stageMeta(card: CustomerCardProjection) {
  return CUSTOMER_STAGE_META[card.customer.stage] ?? CUSTOMER_STAGE_META.unknown
}
function riskMeta(card: CustomerCardProjection) {
  const level = card.customer.riskLevel
  return level ? CUSTOMER_RISK_META[level] : null
}
function riskClass(card: CustomerCardProjection): string {
  return card.customer.riskLevel === 'High' ? 'risk-high' : card.customer.riskLevel === 'Attention' ? 'risk-attention' : ''
}
function customerInitial(card: CustomerCardProjection): string {
  return (card.customer.name || '客').slice(0, 1)
}
function formatCardMoney(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '暂不可确认'
  return `¥${formatMoney(value)}`
}
function customerBusinessSummary(card: CustomerCardProjection): string {
  const customer = card.customer
  if ((customer.signedAmount ?? 0) > 0) return `已签约 ${formatCardMoney(customer.signedAmount)}`
  if ((customer.quoteAmount ?? 0) > 0) return `当前报价 ${formatCardMoney(customer.quoteAmount)}`
  return stageMeta(card).label
}
function customerBusinessDetail(card: CustomerCardProjection): string {
  return card.customer.projectName || card.nextHint || card.customer.riskReason || '暂无更多业务摘要'
}
function lastFollowText(card: CustomerCardProjection): string {
  return card.customer.lastFollowAt ? formatDateTime(card.customer.lastFollowAt).slice(0, 10) : '暂无跟进'
}
function designStatusLabel(status: string): string {
  return ({ draft: '草稿', ready: '待谈单', presented: '已讲解', selected: '已选定', archived: '已归档' } as Record<string, string>)[status] ?? status
}
function quoteStatusLabel(status: string): string {
  return ({ draft: '草稿', submitted: '待客户决策', accepted: '客户已接受', rejected: '客户驳回', superseded: '已被替代', converted: '已转项目' } as Record<string, string>)[status] ?? status
}
function projectStatusLabel(status: string): string {
  return ({ preparing: '待开工', ongoing: '施工中', suspended: '已停工', accepting: '待验收', finished: '已完工', settled: '已结算' } as Record<string, string>)[status] ?? status
}
function contractStatusLabel(status: string): string {
  return ({ draft: '草稿', pendingSign: '待签约', signed: '已签约', effective: '已生效', changing: '变更中', active: '履约中', changed: '已变更', completed: '已完成', settled: '已结算', terminated: '已终止' } as Record<string, string>)[status] ?? status
}
function measureStatusLabel(status: string): string {
  return ({ scheduled: '已预约', completed: '已完成', cancelled: '已取消' } as Record<string, string>)[status] ?? status
}
function requirementKindLabel(kind: string): string {
  return kind === 'reject' ? '禁忌' : '需求'
}
function setFilter(filter: CardFilter): void {
  activeFilter.value = filter
}
function selectOwner(key: string): void {
  selectedOwner.value = key
}
function switchDetailTab(tab: DetailTab): void {
  detailTab.value = tab
}
async function selectDetailProperty(property: Property): Promise<void> {
  if (activePropertyId.value === property.id) return
  activePropertyId.value = property.id
  detailTab.value = 'requirement'
  await loadDetailRequirements()
  await loadDetailContracts()
}
async function loadDetailRequirements(): Promise<void> {
  const customer = selectedCustomer.value
  if (!customer || !activePropertyId.value || previewMode.value) return
  try {
    detailRequirements.value = await designApi.listRequirements(customer.id, activePropertyId.value)
  } catch {
    detailRequirements.value = []
  }
}
async function loadDetailContracts(): Promise<void> {
  if (previewMode.value) return
  const quoteIds = detailActiveQuotes.value.map(item => item.id)
  const projectIds = detailActiveProjects.value.map(item => item.id)
  const results = await Promise.allSettled([
    ...quoteIds.map(id => contractApi.contractByQuote(id)),
    ...projectIds.map(id => contractApi.contractByProject(id))
  ])
  const found = results.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : [])
  detailContracts.value = [...new Map(found.map(item => [item.id, item])).values()]
}
async function copyCustomerPhone(): Promise<void> {
  const phone = selectedCustomer.value?.phone
  if (!phone) { ElMessage.warning('客户电话暂不可确认'); return }
  try {
    await navigator.clipboard.writeText(phone)
    ElMessage.success('客户电话已复制')
  } catch {
    ElMessage.error('复制失败，请手动选择号码')
  }
}
function callCustomer(): void {
  const phone = selectedCustomer.value?.phone
  if (!phone) { ElMessage.warning('客户电话暂不可确认'); return }
  window.location.href = `tel:${phone}`
}
function clearFilters(): void {
  keyword.value = ''
  ownerKeyword.value = ''
  activeFilter.value = 'all'
  selectedOwner.value = 'all'
}

async function load(): Promise<void> {
  if (previewMode.value) {
    loading.value = false
    error.value = ''
    return
  }
  loading.value = true
  error.value = ''
  try {
    if (usesCustomerOverview.value) {
      overview.value = await crmApi.customerOverview({
        current: 1,
        size: 20,
        storeId: scope.requestStoreId,
        keyword: keyword.value.trim() || undefined
      })
      customers.value = overview.value.customers
      serverScope.value = overview.value.storeScope ?? null
    } else {
      customers.value = await crmApi.pageCustomers({
        keyword: keyword.value.trim() || undefined,
        size: 20,
        storeId: scope.requestStoreId
      })
      serverScope.value = null
    }
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '客户数据暂不可确认'
    customers.value = []
    overview.value = null
  } finally {
    loading.value = false
  }
}

watch(
  [() => scope.resolved, () => scope.requestStoreId, () => route.query.preview, customerId],
  ([ready, , , id]) => {
    if (id) {
      void loadCustomer360Page(id)
      return
    }
    if (previewMode.value || ready) void load()
  },
  { immediate: true }
)
watch([isBoss, isStoreManager, isFinance], () => {
  selectedOwner.value = 'all'
  ownerKeyword.value = ''
  activeFilter.value = 'all'
  previewStoreId.value = isStoreManager.value ? 'binhu' : 'all'
})

function openTransfer(card: CustomerCardProjection): void {
  if (previewMode.value) { ElMessage.info('预览模式：示例数据不可执行写操作'); return }
  selectedCustomer.value = card.customer
  ownerId.value = ''
  ownerReason.value = ''
  transferVisible.value = true
}
function openAssign(card: CustomerCardProjection): void {
  if (previewMode.value) { ElMessage.info('预览模式：示例数据不可执行写操作'); return }
  selectedCustomer.value = card.customer
  designerId.value = ''
  propertyId.value = ''
  assignVisible.value = true
}
function openLoss(card: CustomerCardProjection, mode: 'mark' | 'restore'): void {
  if (previewMode.value) { ElMessage.info('预览模式：示例数据不可执行写操作'); return }
  selectedCustomer.value = card.customer
  lossMode.value = mode
  lossVisible.value = true
}
async function submitTransfer(): Promise<void> {
  const customer = selectedCustomer.value
  if (!customer) return
  if (!ownerId.value) { ElMessage.warning('请选择新的负责人'); return }
  if (!ownerReason.value.trim()) { ElMessage.warning('请填写负责人变更原因'); return }
  busy.value = true
  try {
    await crmApi.changeOwner({ customerId: customer.id, ownerId: ownerId.value, reason: ownerReason.value.trim() })
    ElMessage.success('已转交客户负责人')
    transferVisible.value = false
    await reloadCurrentScope()
  } catch (actionError) {
    ElMessage.error(actionError instanceof ProviderError ? actionError.message : '转交失败，暂不可确认')
  } finally {
    busy.value = false
  }
}
function openCreateProperty(): void {
  if (previewMode.value) { ElMessage.info('预览模式：示例数据不可执行写操作'); return }
  if (!selectedCustomer.value?.id) return
  propertyFormEditing.value = null
  propertyFormVisible.value = true
}
function openEditProperty(property: Property): void {
  if (previewMode.value) { ElMessage.info('预览模式：示例数据不可执行写操作'); return }
  propertyFormEditing.value = property
  propertyFormVisible.value = true
}
async function submitAssign(): Promise<void> {
  const customer = selectedCustomer.value
  if (!customer) return
  if (!designerId.value) { ElMessage.warning('请选择设计师'); return }
  busy.value = true
  try {
    await crmApi.assignDesigner({ customerId: customer.id, designerId: designerId.value, propertyId: propertyId.value || undefined })
    ElMessage.success('已指派设计师')
    assignVisible.value = false
    await reloadCurrentScope()
  } catch (actionError) {
    ElMessage.error(actionError instanceof ProviderError ? actionError.message : '指派失败，暂不可确认')
  } finally {
    busy.value = false
  }
}
function openCreate(): void {
  if (previewMode.value) { ElMessage.info('预览模式：示例数据不可执行写操作'); return }
  createVisible.value = true
}
function openCurrentProperty(): void {
  if (detailProperty.value) openEditProperty(detailProperty.value)
}
async function onPropertySaved(property: Property): Promise<void> {
  propertyPickerKey.value += 1
  if (property.id) propertyId.value = property.id
  if (isCustomer360Page.value) await reloadCurrentScope()
}
async function onCustomerSaved(): Promise<void> {
  editVisible.value = false
  await reloadCurrentScope()
}
async function onCustomerCreated(customer: Customer): Promise<void> {
  createVisible.value = false
  ElMessage.success('客户已登记')
  await load()
  if (customer.id) {
    const card = realCards.value.find(item => item.customer.id === customer.id)
    if (card) openDetail(card)
  }
}
function openEdit(card: CustomerCardProjection): void {
  if (previewMode.value) { ElMessage.info('预览模式：示例数据不可执行写操作'); return }
  selectedCustomer.value = card.customer
  editVisible.value = true
}
function openFollow(card: CustomerCardProjection): void {
  if (previewMode.value) { ElMessage.info('预览模式：示例数据不可执行写操作'); return }
  selectedCustomer.value = card.customer
  followVisible.value = true
}
async function onFollowSaved(): Promise<void> {
  followVisible.value = false
  await reloadCurrentScope()
}

async function hydrateCustomer360(card: CustomerCardProjection): Promise<void> {
  selectedCard.value = card
  selectedCustomer.value = card.customer
  activePropertyId.value = ''
  detailTab.value = 'requirement'
  if (previewMode.value) {
    detailError.value = ''
    detailLoading.value = false
    const property: Property = {
      id: 'preview-property-1', propertyNo: 'PREVIEW-P1', customerId: card.customer.id,
      community: card.customer.community?.split(' ')[0] || '当前房屋', building: card.customer.community?.split(' ')[1] || '',
      roomNo: '', address: card.customer.community || '房屋地址待补充', area: card.customer.area ?? 118,
      layout: '三室两厅', status: card.customer.stage === 'construction' ? 'serving' : card.customer.stage === 'done' ? 'completed' : 'designing',
      latestMeasureAt: card.customer.measureAt
    }
    detailProperties.value = [property]
    activePropertyId.value = property.id
    detailFollows.value = [
      { id: 'preview-f1', customerId: card.customer.id, way: 'phone', content: `客户确认本周可以推进下一步，约定 ${card.nextHint || '按时跟进'}。`, empName: card.customer.ownerName, nextFollowAt: card.customer.nextFollowAt, createdAt: card.customer.lastFollowAt },
      { id: 'preview-f2', customerId: card.customer.id, way: 'wechat', content: '量房与方案信息已同步，当前业务链继续按房屋推进。', empName: card.customer.designerName, createdAt: '2026-10-24 10:18:00' }
    ]
    detailContentError.value = ''
    detailContentTouches.value = [
      { id: 'preview-touch-1', attributionType: 'platform', confidence: 'high', isPrimary: true, taskTitle: '合肥改善型住房避坑清单', employeeName: card.customer.designerName, touchedAt: '2026-10-12 18:20:00' },
      { id: 'preview-touch-2', attributionType: 'manual', confidence: 'medium', isPrimary: false, taskTitle: '旧房改造预算讲解', employeeName: card.customer.ownerName, touchedAt: '2026-10-15 09:40:00' }
    ]
    detailRequirements.value = [
      { id: 'preview-r1', customerId: card.customer.id, propertyId: property.id, kind: 'demand', category: 'function', priority: 'high', status: 'confirmed', title: '客餐厅需要充足收纳', detail: '保留通透感，同时增加入户与餐边收纳。', spaceName: '客餐厅' },
      { id: 'preview-r2', customerId: card.customer.id, propertyId: property.id, kind: 'reject', category: 'style', priority: 'medium', status: 'confirmed', title: '不接受大面积深色墙面', detail: '希望整体保持明亮、耐看。', spaceName: '全屋' }
    ]
    detailSchemes.value = card.customer.quoteAmount ? [{
      id: 'preview-design-1', no: 'PREVIEW-D1', name: '全屋空间设计方案', customerId: card.customer.id,
      customerName: card.customer.name, propertyId: property.id, propertyNo: property.propertyNo,
      propertyName: property.community, propertyAddress: property.address, propertyArea: property.area,
      propertyLayout: property.layout, propertyStatus: property.status, ownerId: card.customer.ownerId,
      ownerName: card.customer.ownerName, version: 3, style: '现代简约', status: 'selected', editable: false,
      area: property.area, layout: property.layout, description: '围绕客户收纳与采光诉求完成的空间方案。',
      sitePhotos: [], surveyPhotos: [], originalPlanImages: [], spaceCount: 6, itemCount: 42,
      calculatedAmount: card.customer.quoteAmount ?? 0, currentQuoteAmount: card.customer.quoteAmount,
      currentQuoteStatusName: card.quoteStatus, priceSource: 'calculated', spaces: [], items: [], requirements: [],
      createdAt: '2026-10-12 10:20:00', updatedAt: '2026-10-24 16:30:00'
    }] : []
    detailQuotes.value = card.customer.quoteAmount ? [{
      id: 'preview-quote-1', no: 'PREVIEW-Q1', customerId: card.customer.id, customerName: card.customer.name,
      propertyId: property.id, propertyName: property.community, designId: 'preview-design-1', designName: '全屋空间设计方案',
      title: '全屋整装报价', version: 3, status: card.customer.signedAmount ? 'accepted' : 'submitted', mode: 'hybrid',
      area: property.area, subtotal: card.customer.quoteAmount, amount: card.customer.quoteAmount, discount: 0,
      taxRate: 0, taxAmount: 0, items: [], constructionGroups: [], materialGroups: [], otherGroups: [],
      createdAt: '2026-10-20 14:30:00', createdBy: { name: card.customer.designerName }
    }] : []
    detailProjects.value = card.customer.projectId ? [{
      id: card.customer.projectId, no: 'PREVIEW-PRJ1', name: card.customer.projectName ?? `${card.customer.name}家`,
      status: card.customer.stage === 'construction' ? 'ongoing' : card.customer.stage === 'done' ? 'finished' : 'preparing',
      progress: card.customer.stage === 'construction' ? 48 : card.customer.stage === 'done' ? 100 : 10,
      currentStageName: card.customer.stage === 'construction' ? '泥木阶段' : card.customer.stage === 'done' ? '已完工' : '待开工',
      customerId: card.customer.id, customerName: card.customer.name, designerName: card.customer.designerName,
      managerName: '项目经理 待分配', propertyId: property.id, propertyName: property.community, area: property.area,
      contractAmount: card.customer.signedAmount ?? card.customer.quoteAmount ?? 0,
      receivableAmount: card.receivableAmount, receivedAmount: (card.customer.signedAmount ?? 0) - (card.receivableAmount ?? 0),
      startDate: '2026-10-22 09:00:00', planEndDate: '2027-01-18 18:00:00', createdAt: '2026-10-21 11:30:00'
    }] : []
    detailContracts.value = (card.contractAmount ?? 0) > 0 ? [{
      id: 'preview-contract-1', no: 'PREVIEW-C1', status: 'effective', currentAmount: card.contractAmount ?? 0,
      signedAmount: card.contractAmount, signedAt: '2026-10-21 10:00:00', effectiveAt: '2026-10-21 10:00:00',
      startDate: '2026-10-22 09:00:00', planEndDate: '2027-01-18 18:00:00', quoteId: 'preview-quote-1',
      customerId: card.customer.id, customerName: card.customer.name, propertyId: property.id,
      propertyCommunity: property.community, propertyAddress: property.address, projectId: card.customer.projectId,
      projectName: card.customer.projectName, createdByName: card.customer.ownerName, createdAt: '2026-10-21 09:30:00'
    }] : []
    detailMeasuresByProperty.value = card.customer.measured ? { [property.id]: [{
      id: 'preview-measure-1', propertyId: property.id, measureTime: card.customer.measureAt,
      completedAt: card.customer.measureAt, status: 'completed', originalStructure: '原结构保留，局部拆改',
      dimensions: '已录入客餐厅、厨房、主卧与次卧尺寸', customerRequirements: '重视收纳和采光',
      designerConclusion: '厨房可调整门洞，客餐厅保持通透。', sitePhotos: [], structureImages: [], attachments: [],
      createdAt: card.customer.measureAt
    }] } : {}
    detailReceivables.value = (card.receivableAmount ?? 0) > 0 ? [{
      projectId: card.customer.projectId, amount: card.customer.signedAmount, receivedAmount: (card.customer.signedAmount ?? 0) - (card.receivableAmount ?? 0),
      outstandingAmount: card.receivableAmount, overdue: (card.overdueAmount ?? 0) > 0
    }] : []
    return
  }
  await loadDetail(card.customer)
}

function openDetail(card: CustomerCardProjection): void {
  loadedCustomer360Id = ''
  void router.push({
    path: `/workbench/customers/${card.customer.id}`,
    query: {
      ...(previewMode.value ? { preview: '1' } : {}),
      from: route.fullPath
    }
  })
}

async function reloadCurrentScope(): Promise<void> {
  if (isCustomer360Page.value && customerId.value) {
    await loadCustomer360Page(customerId.value, true)
    return
  }
  await load()
}

function goBackFromCustomer360(): void {
  const state = window.history.state as { back?: string | null } | null
  const back = state?.back ?? ''
  if (back && !back.startsWith('/login')) {
    router.back()
    return
  }
  void router.push('/workbench/customers')
}

async function loadCustomer360Page(id: string, force = false): Promise<void> {
  if (!id) return
  if (!force && (loadingCustomer360Id === id || (loadedCustomer360Id === id && selectedCustomer.value?.id === id))) return
  loadingCustomer360Id = id
  try {
    if (previewMode.value) {
      const card = allPreviewCards.find(item => item.customer.id === id)
      if (!card) {
        selectedCard.value = null
        selectedCustomer.value = null
        detailError.value = '预览客户不存在或已被移除'
        detailLoading.value = false
        return
      }
      await hydrateCustomer360(card)
      loadedCustomer360Id = id
      return
    }
    detailLoading.value = true
    detailError.value = ''
    try {
      const customer = await crmApi.customerInfo(id)
      selectedCustomer.value = customer
      selectedCard.value = toCardProjection(customer)
      await loadDetail(customer)
      loadedCustomer360Id = id
    } catch (loadError) {
      selectedCard.value = null
      selectedCustomer.value = null
      detailError.value = loadError instanceof ProviderError ? loadError.message : '客户 360 暂不可确认'
      detailLoading.value = false
    }
  } finally {
    if (loadingCustomer360Id === id) loadingCustomer360Id = ''
  }
}

async function loadDetail(customer: Customer): Promise<void> {
  detailLoading.value = true
  detailError.value = ''
  detailRequirements.value = []
  detailContracts.value = []
  detailMeasuresByProperty.value = {}
  detailContentTouches.value = []
  detailContentError.value = ''
  try {
    const [propertiesResult, followsResult, schemesResult, quotesResult, projectsResult, contentResult] = await Promise.allSettled([
      propertyApi.listProperties(customer.id),
      crmApi.customerFollows(customer.id),
      designApi.listSchemes(customer.id),
      quoteFinancePage({ customerId: customer.id, current: 1, size: 20 }),
      projectApi.listProjects({ size: 20 }),
      listLeadTouches(customer.id)
    ])
    detailProperties.value = propertiesResult.status === 'fulfilled' ? propertiesResult.value : []
    detailFollows.value = followsResult.status === 'fulfilled' ? followsResult.value : []
    detailSchemes.value = schemesResult.status === 'fulfilled' ? schemesResult.value : []
    detailQuotes.value = quotesResult.status === 'fulfilled' ? quotesResult.value.list : []
    detailProjects.value = projectsResult.status === 'fulfilled'
      ? projectsResult.value.filter(project => project.customerId === customer.id || project.customerName === customer.name)
      : []
    detailContentTouches.value = contentResult.status === 'fulfilled' ? contentResult.value : []
    detailContentError.value = contentResult.status === 'rejected'
      ? (contentResult.reason instanceof Error ? contentResult.reason.message : '内容来源暂不可确认')
      : ''
    activePropertyId.value = detailProperties.value[0]?.id ?? ''
    detailTab.value = 'requirement'
    const measureResults = await Promise.allSettled(detailProperties.value.map(property => propertyApi.listMeasures(property.id)))
    detailMeasuresByProperty.value = Object.fromEntries(measureResults.map((result, index) => [
      detailProperties.value[index]?.id ?? '',
      result.status === 'fulfilled' ? result.value : []
    ]))
    await Promise.all([loadDetailRequirements(), loadDetailContracts()])
    if (detailProjects.value.length && isFinance.value) {
      const receivableResults = await Promise.allSettled(detailProjects.value.map(project => financeApi.receivables({ projectId: project.id, size: 20 })))
      detailReceivables.value = receivableResults.flatMap((result, index) => {
        if (result.status !== 'fulfilled') return []
        return result.value.list.map(item => ({
          projectId: detailProjects.value[index]?.id,
          amount: item.amount,
          receivedAmount: item.receivedAmount,
          outstandingAmount: item.outstandingAmount,
          overdue: item.status === 'overdue'
        }))
      })
    }
  } catch (loadError) {
    detailError.value = loadError instanceof ProviderError ? loadError.message : '客户详情暂不可确认'
  } finally {
    detailLoading.value = false
  }
}
function metricIcon(icon: string): string { return icon }
</script>

<template>
  <div class="customer-page">
    <template v-if="!isCustomer360Page">
    <el-alert v-if="previewMode" class="customer-page__preview" type="info" show-icon :closable="false"
      title="界面预览：当前使用示例数据，不代表真实业务事实">
      <template #default>预览地址仅用于设计评审；真实客户数据请去掉地址中的 `?preview=1`。</template>
    </el-alert>

    <header class="customer-page__head">
      <div class="customer-page__titles">
        <h1>{{ pageTitle }}</h1>
        <p>{{ pageDescription }}</p>
        <div class="customer-page__scope-line">
          <span>{{ displayStoreName }}</span>
          <span v-if="showUnassigned" class="customer-page__warning">含未归属门店 {{ unassignedCount }} 条</span>
          <span v-if="previewMode" class="customer-page__preview-label">示例数据</span>
        </div>
      </div>
      <div class="customer-page__actions">
        <template v-if="previewMode">
          <el-select v-if="!isStoreManager" v-model="previewStoreId" size="default" aria-label="预览门店">
            <el-option v-for="item in previewStoreOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <span v-else class="customer-page__locked-store">滨湖店（本店）</span>
        </template>
        <StoreScopePicker v-else />
        <el-button v-if="canMaintainCustomer" type="primary" @click="openCreate"><NavIcon name="add" />新增客户</el-button>
        <el-button @click="load"><NavIcon name="refresh" />刷新</el-button>
      </div>
    </header>

    <section class="customer-metrics" aria-label="角色客户统计">
      <article v-for="metric in metrics" :key="metric.key" class="customer-metric" :class="`customer-metric--${metric.tone}`">
        <div class="customer-metric__head">
          <span>{{ metric.label }}</span>
          <span class="customer-metric__icon"><NavIcon :name="metricIcon(metric.icon)" /></span>
        </div>
        <div class="customer-metric__value num">{{ metric.value }}<small>{{ metric.unit }}</small></div>
        <div class="customer-metric__note">{{ metric.note }}</div>
      </article>
    </section>

    <div class="customer-layout">
      <aside class="customer-owner">
        <div class="customer-owner__head">
          <strong>{{ isStoreManager ? '本店负责人分组' : '负责人分组' }}</strong>
          <small>客户按当前负责人归组</small>
        </div>
        <div class="customer-owner__search">
          <el-input v-model="ownerKeyword" clearable placeholder="查找负责人" aria-label="查找负责人">
            <template #prefix><NavIcon name="search" /></template>
          </el-input>
        </div>
        <div class="customer-owner__list">
          <button v-for="group in filteredOwnerGroups" :key="group.key" type="button" class="customer-owner__item" :class="{ active: selectedOwner === group.key }" @click="selectOwner(group.key)">
            <span class="customer-owner__avatar"><NavIcon :name="group.key === 'all' ? 'customer.followup' : 'user'" /></span>
            <span class="customer-owner__copy"><b>{{ group.name }}</b><small>{{ group.key === 'all' ? '当前客户范围' : '客户负责人' }}</small></span>
            <span class="customer-owner__count num"><b>{{ group.count }}</b><small v-if="group.pendingCount">待量房 {{ group.pendingCount }}</small></span>
          </button>
          <p v-if="ownerSummaryUnavailable" class="customer-owner__empty"><NavIcon name="filter" />当前角色暂无负责人经营汇总</p>
          <p v-else-if="ownerGroups.length === 1" class="customer-owner__empty"><NavIcon name="filter" />当前范围暂无负责人分组</p>
        </div>
      </aside>

      <section class="customer-main">
        <div class="customer-query">
          <div class="customer-query__row">
            <el-input v-model="keyword" clearable placeholder="搜索客户姓名 / 手机号 / 小区 / 负责人" class="customer-query__search">
              <template #prefix><NavIcon name="search" /></template>
            </el-input>
            <el-button @click="clearFilters"><NavIcon name="filter-clear" />清除筛选</el-button>
          </div>
          <div class="customer-query__filters">
            <button v-for="filter in filterOptions" :key="filter.key" type="button" class="customer-filter" :class="{ active: activeFilter === filter.key }" @click="setFilter(filter.key)">
              <NavIcon :name="filter.icon" />{{ filter.label }}
            </button>
          </div>
        </div>

        <div v-if="loading && !visibleCards.length" class="customer-cards customer-cards--skeleton">
          <div v-for="index in 4" :key="index" class="customer-card-skeleton"><SkeletonBlock variant="card" :rows="5" /></div>
        </div>
        <section v-else-if="error" class="customer-state" role="alert">
          <span class="customer-state__icon"><NavIcon name="boss.risk" /></span>
          <h2>客户列表暂不可确认</h2>
          <p>{{ error }}</p>
          <el-button type="primary" plain @click="load"><NavIcon name="refresh" />重新加载</el-button>
        </section>
        <section v-else-if="!visibleCards.length" class="customer-state">
          <span class="customer-state__icon"><NavIcon name="customer.followup" /></span>
          <h2>没有符合条件的客户</h2>
          <p>当前筛选或权限范围内没有客户；可清除筛选或调整门店与负责人分组。</p>
          <el-button type="primary" plain @click="clearFilters"><NavIcon name="filter-clear" />清除筛选</el-button>
        </section>
        <div v-else class="customer-cards">
          <article v-for="card in visibleCards" :key="card.customer.id" class="customer-card" :class="riskClass(card)">
            <header class="customer-card__head">
              <div class="customer-card__avatar">{{ customerInitial(card) }}</div>
              <div class="customer-card__identity">
                <div class="customer-card__name">
                  <strong>{{ card.customer.name || '客户待完善' }}</strong>
                  <StatusTag :text="stageMeta(card).label" :tone="stageMeta(card).tone" :dot="false" />
                  <span v-if="card.customer.grade" class="customer-grade">{{ card.customer.grade }}级</span>
                  <StatusTag v-if="riskMeta(card)" :text="riskMeta(card)!.label" :tone="riskMeta(card)!.tone" :dot="false" />
                </div>
                <div class="customer-card__contact"><NavIcon name="user" /><span>{{ card.customer.ownerName || '待分配负责人' }}</span><span>·</span><span>{{ card.customer.phone || '电话待补充' }}</span></div>
              </div>
              <span class="customer-card__follow">{{ card.customer.nextFollowAt ? formatFollowDue(card.customer.nextFollowAt) : '未安排下次跟进' }}</span>
            </header>

            <div class="customer-card__location">
              <NavIcon name="building" />
              <strong>{{ card.customer.community || '小区待补充' }}</strong>
              <span>{{ card.customer.area ? `${card.customer.area}㎡` : '面积待补充' }}</span>
              <span v-if="card.customer.budget">预算 {{ card.customer.budget }} 万</span>
            </div>

            <div class="customer-card__people">
              <div><small>客户负责人</small><b>{{ card.customer.ownerName || '待分配' }}</b></div>
              <div><small>负责设计师</small><b>{{ card.customer.designerName || '未指派' }}</b></div>
              <div><small>项目</small><b>{{ card.customer.projectName || '未立项' }}</b></div>
            </div>

            <div class="customer-card__signals">
              <span v-if="card.customer.wechatAdded !== undefined"><NavIcon name="check" />{{ card.customer.wechatAdded ? '已加微信' : '未加微信' }}</span>
              <span v-if="(card.customer.visitCount ?? 0) > 0"><NavIcon name="customer.followup" />到店 {{ card.customer.visitCount }} 次</span>
              <span v-if="card.customer.measureAt"><NavIcon name="designer.measure" />量房 {{ card.customer.measureAt.slice(5, 10) }}</span>
              <span v-if="card.customer.designerName"><NavIcon name="designer.design" />设计 {{ card.customer.designerName }}</span>
              <span v-if="card.customer.projectId"><NavIcon name="pm.project" />已转项目</span>
            </div>

            <div class="customer-card__progress">
              <div><small>上次跟进</small><b>{{ lastFollowText(card) }}</b></div>
              <div><small>当前停留</small><b :class="{ danger: (card.customer.idleDays ?? 0) >= 15 }">{{ card.customer.idleDays ?? 0 }} 天</b></div>
              <div><small>下次跟进</small><b :class="{ danger: card.customer.nextFollowAt && formatFollowDue(card.customer.nextFollowAt).startsWith('已逾期') }">{{ card.customer.nextFollowAt ? formatFollowDue(card.customer.nextFollowAt) : '未安排' }}</b></div>
            </div>

            <div class="customer-card__business">
              <div><small>客户当前业务</small><strong>{{ customerBusinessSummary(card) }}</strong></div>
              <span>{{ customerBusinessDetail(card) }}</span>
            </div>

            <div v-if="isFinance" class="customer-card__finance-context">
              <span><NavIcon name="designer.contract" />合同 <b class="num">{{ formatCardMoney(card.contractAmount ?? card.customer.signedAmount) }}</b></span>
              <span><NavIcon name="pm.project" />项目 <b>{{ card.customer.projectName ? (card.customer.stage === 'construction' ? '施工中' : '已立项') : '未立项' }}</b></span>
              <span><NavIcon name="finance.receivable" />待收 <b class="num" :class="{ danger: (card.receivableAmount ?? 0) > 0 }">{{ card.receivableAmount === undefined ? '暂不可确认' : formatCardMoney(card.receivableAmount) }}</b></span>
              <span v-if="(card.overdueAmount ?? 0) > 0" class="danger"><NavIcon name="boss.risk" />逾期 <b class="num">{{ formatCardMoney(card.overdueAmount) }}</b></span>
            </div>

            <footer class="customer-card__next">
              <div><small>下一步</small><strong>{{ card.nextAction }}</strong><span>{{ card.nextHint }}</span></div>
              <el-button plain type="primary" @click="openDetail(card)"><NavIcon name="chevron-right" />查看客户</el-button>
            </footer>
          </article>
        </div>
      </section>
    </div>
    </template>

    <template v-else>
      <header class="customer-360-page__toolbar">
        <el-button @click="goBackFromCustomer360"><NavIcon name="back" />返回上一页</el-button>
        <span>{{ selectedCustomer?.name || '客户 360' }}</span>
      </header>
      <div v-if="detailLoading && !selectedCard" class="c360__loading"><SkeletonBlock variant="card" :rows="10" /></div>
      <section v-else-if="detailError && !selectedCard" class="customer-state" role="alert">
        <span class="customer-state__icon"><NavIcon name="boss.risk" /></span>
        <h2>客户 360 暂不可确认</h2>
        <p>{{ detailError }}</p>
        <el-button type="primary" plain @click="goBackFromCustomer360"><NavIcon name="back" />返回上一页</el-button>
      </section>
      <div v-else-if="selectedCard" class="customer-detail c360 customer-detail--page">
        <header class="c360__hero">
          <div class="c360__identity">
            <div class="c360__avatar">{{ customerInitial(selectedCard) }}</div>
            <div class="c360__identity-copy">
              <div class="c360__name-row">
                <h2>{{ selectedCustomer?.name || selectedCard.customer.name }}</h2>
                <StatusTag :text="stageMeta(selectedCard).label" :tone="stageMeta(selectedCard).tone" :dot="false" />
                <span v-if="selectedCustomer?.grade || selectedCard.customer.grade" class="customer-grade">{{ selectedCustomer?.grade || selectedCard.customer.grade }}级</span>
                <StatusTag v-if="riskMeta(selectedCard)" :text="riskMeta(selectedCard)!.label" :tone="riskMeta(selectedCard)!.tone" :dot="false" />
              </div>
              <div class="c360__contact-line">
                <span><NavIcon name="phone" />{{ selectedCustomer?.phone || selectedCard.customer.phone || '电话待补充' }}</span>
                <span><NavIcon name="designer.followup" />{{ detailSourceLabel }}</span>
                <span><NavIcon name="designer.followup" />{{ selectedCustomer?.lastFollowAt ? `最近跟进 ${formatDateTime(selectedCustomer.lastFollowAt).slice(0, 10)}` : '暂无跟进' }}</span>
              </div>
              <div v-if="selectedCustomer?.tags?.length" class="c360__tags">
                <span v-for="tag in selectedCustomer.tags" :key="tag">{{ tag }}</span>
              </div>
            </div>
          </div>
          <div class="c360__hero-actions">
            <el-button v-if="canMaintainCustomer" type="primary" @click="openFollow(selectedCard)"><NavIcon name="designer.followup" />写跟进</el-button>
            <el-button @click="callCustomer"><NavIcon name="phone" />打电话</el-button>
            <el-button @click="copyCustomerPhone"><NavIcon name="copy" />复制号码</el-button>
          </div>
        </header>

        <div v-if="detailLoading" class="c360__loading"><SkeletonBlock variant="card" :rows="10" /></div>
        <el-alert v-else-if="detailError" type="warning" :closable="false" :title="detailError" show-icon />
        <div v-else class="c360__scroll">
          <section class="c360__relations" aria-label="客户责任与下一步">
            <button class="c360__relation" type="button" :disabled="!canMaintainCustomer" @click="openTransfer(selectedCard)">
              <span class="c360__relation-icon"><NavIcon name="user" /></span>
              <span><small>客户负责人</small><strong>{{ selectedCustomer?.ownerName || selectedCard.customer.ownerName || '待分配' }}</strong></span>
              <NavIcon v-if="canMaintainCustomer" name="chevron-right" />
            </button>
            <button class="c360__relation" type="button" :disabled="!canAssignDesigner" @click="canAssignDesigner && openAssign(selectedCard)">
              <span class="c360__relation-icon"><NavIcon name="designer.design" /></span>
              <span><small>负责设计师</small><strong>{{ selectedCustomer?.designerName || selectedCard.customer.designerName || '待指派' }}</strong></span>
              <NavIcon v-if="canAssignDesigner" name="chevron-right" />
            </button>
            <div class="c360__relation c360__relation--static">
              <span class="c360__relation-icon"><NavIcon name="designer.followup" /></span>
              <span><small>下次跟进</small><strong>{{ selectedCustomer?.nextFollowAt ? formatFollowDue(selectedCustomer.nextFollowAt) : '未安排' }}</strong></span>
            </div>
            <div class="c360__relation c360__relation--static">
              <span class="c360__relation-icon"><NavIcon name="boss.risk" /></span>
              <span><small>当前下一步</small><strong>{{ selectedCard.nextAction }}</strong></span>
            </div>
          </section>

          <section class="c360__journey" aria-label="客户业务进度">
            <header><div><strong>客户业务进度</strong><small>从客户当前情况识别已发生事实与下一步</small></div><span>{{ stageMeta(selectedCard).label }}</span></header>
            <div class="c360__journey-rail">
              <div v-for="step in detailJourney" :key="step.key" class="c360__journey-step" :class="`is-${step.status}`">
                <span class="c360__journey-node"><NavIcon :name="step.status === 'done' ? 'check' : 'chevron-right'" /></span>
                <b>{{ step.label }}</b>
              </div>
            </div>
          </section>

          <div class="c360__grid">
            <main class="c360__main">
              <section class="c360__panel">
                <header class="c360__panel-head">
                  <div><h3>装修房屋</h3><p>客户可有多套房屋，诉求、设计、报价、合同与项目按当前房屋展开。</p></div>
                  <el-button v-if="canMaintainCustomer" plain type="primary" @click="openCreateProperty"><NavIcon name="add" />新增房屋</el-button>
                </header>
                <div v-if="detailProperties.length" class="c360__houses">
                  <article v-for="property in detailProperties" :key="property.id" class="c360__house" :class="{ active: activePropertyId === property.id }">
                    <header>
                      <strong><NavIcon name="building" />{{ property.community || property.address }}</strong>
                      <StatusTag :text="property.status === 'serving' ? '施工中' : property.status === 'completed' ? '已完工' : property.status === 'contracted' ? '已签约' : property.status === 'quoted' ? '已报价' : property.status === 'designing' ? '设计中' : property.status === 'measured' ? '已量房' : property.status === 'measuring' ? '量房中' : '待量房'" :tone="activePropertyId === property.id ? 'doing' : 'info'" :dot="false" />
                    </header>
                    <p>{{ property.address }}</p>
                    <div class="c360__house-meta"><span>{{ property.area ? `${property.area}㎡` : '面积待补充' }}</span><span>{{ property.layout || '户型待补充' }}</span><span>{{ property.latestMeasureAt ? `量房 ${property.latestMeasureAt.slice(0, 10)}` : '尚未量房' }}</span></div>
                    <footer>
                      <el-button size="small" :type="activePropertyId === property.id ? 'primary' : 'default'" plain @click="selectDetailProperty(property)"><NavIcon :name="activePropertyId === property.id ? 'check' : 'chevron-right'" />{{ activePropertyId === property.id ? '当前房屋' : '选择房屋' }}</el-button>
                      <el-button v-if="canMaintainCustomer" size="small" @click="openEditProperty(property)"><NavIcon name="edit" />编辑房屋</el-button>
                    </footer>
                  </article>
                </div>
                <div v-else class="c360__empty"><NavIcon name="building" /><span>暂无房屋档案；量房、设计、报价和项目都应绑定具体房屋。</span></div>
              </section>

              <section v-if="detailProperty" class="c360__panel">
                <header class="c360__panel-head"><div><h3>当前房屋业务链</h3><p>以当前房屋为对象查看量房、方案、报价、合同、项目与收款事实。</p></div><span class="c360__subject">{{ detailProperty.community }} · {{ detailProperty.area }}㎡</span></header>
                <div class="c360__chain">
                  <article v-for="item in detailBusinessChain" :key="item.label" class="c360__chain-item" :class="`tone-${item.tone}`">
                    <small>{{ item.label }}</small><strong>{{ item.stateText }}</strong><p>{{ item.detail }}</p>
                  </article>
                </div>
              </section>

              <section v-if="detailProperty" class="c360__panel">
                <header class="c360__panel-head"><div><h3>房屋关联信息</h3><p>按当前房屋查看需求、方案、报价、合同、项目、量房和收款。</p></div></header>
                <nav class="c360__tabs" role="tablist" aria-label="房屋关联信息">
                  <button v-for="tab in detailTabOptions" :key="tab.key" type="button" role="tab" :aria-selected="detailTab === tab.key" :class="{ active: detailTab === tab.key }" @click="switchDetailTab(tab.key)">
                    <NavIcon :name="tab.icon" />{{ tab.label }}
                  </button>
                </nav>
                <div class="c360__tab-panel">
                  <template v-if="detailTab === 'requirement'">
                    <div v-if="detailRequirements.length" class="c360__records">
                      <article v-for="item in detailRequirements" :key="item.id" class="c360__record">
                        <header><strong>{{ item.title }}</strong><StatusTag :text="requirementKindLabel(item.kind)" :tone="item.kind === 'reject' ? 'blocked' : 'info'" :dot="false" /></header>
                        <p>{{ item.detail || '—' }}</p><small>{{ item.spaceName || '全屋' }} · {{ item.status === 'confirmed' ? '已确认' : item.status === 'resolved' ? '已解决' : '待确认' }}</small>
                      </article>
                    </div>
                    <div v-else class="c360__empty"><NavIcon name="designer.followup" /><span>该房屋尚未登记需求或禁忌。</span></div>
                  </template>
                  <template v-else-if="detailTab === 'scheme'">
                    <div v-if="detailActiveSchemes.length" class="c360__records">
                      <article v-for="item in detailActiveSchemes" :key="item.id" class="c360__record">
                        <header><strong>{{ item.name || '方案待命名' }}</strong><StatusTag :text="designStatusLabel(item.status)" :tone="item.status === 'selected' ? 'done' : 'info'" :dot="false" /></header>
                        <p>第 {{ item.version }} 版 · {{ item.area ? `${item.area}㎡` : '面积待补充' }} · {{ item.spaceCount }} 个空间 · {{ item.itemCount }} 个设计项</p>
                        <small>{{ item.updatedAt ? `更新于 ${formatDateTime(item.updatedAt)}` : '更新时间暂不可确认' }}</small>
                      </article>
                    </div>
                    <div v-else class="c360__empty"><NavIcon name="designer.design" /><span>该房屋尚无设计方案。</span></div>
                  </template>
                  <template v-else-if="detailTab === 'quote'">
                    <div v-if="detailQuoteVersions.length" class="c360__records">
                      <article v-for="item in detailQuoteVersions" :key="item.id" class="c360__record">
                        <header><strong>报价 V{{ item.version }}</strong><StatusTag :text="quoteStatusLabel(item.status)" :tone="item.status === 'accepted' || item.status === 'converted' ? 'done' : item.status === 'rejected' ? 'blocked' : 'pending'" :dot="false" /></header>
                        <p class="num">报价金额 {{ formatCardMoney(item.amount) }}</p><small>{{ item.designName || '未关联方案' }} · {{ formatDateTime(item.createdAt) }}</small>
                      </article>
                    </div>
                    <div v-else class="c360__empty"><NavIcon name="designer.quote" /><span>该房屋尚未生成报价。</span></div>
                  </template>
                  <template v-else-if="detailTab === 'contract'">
                    <div v-if="detailContracts.length" class="c360__records">
                      <article v-for="item in detailContracts" :key="item.id" class="c360__record">
                        <header><strong>{{ item.projectName || selectedCustomer?.name }}的合同</strong><StatusTag :text="contractStatusLabel(item.status)" :tone="['effective','active','completed','settled'].includes(item.status) ? 'done' : 'pending'" :dot="false" /></header>
                        <p class="num">合同金额 {{ formatCardMoney(item.currentAmount) }}</p><small>签约 {{ formatDateTime(item.signedAt) }} · 生效 {{ formatDateTime(item.effectiveAt) }}</small>
                      </article>
                    </div>
                    <div v-else class="c360__empty"><NavIcon name="designer.contract" /><span>该房屋暂无合同事实。</span></div>
                  </template>
                  <template v-else-if="detailTab === 'project'">
                    <div v-if="detailActiveProjects.length" class="c360__records">
                      <article v-for="item in detailActiveProjects" :key="item.id" class="c360__record">
                        <header><strong>{{ item.name }}</strong><StatusTag :text="projectStatusLabel(item.status)" :tone="item.status === 'ongoing' ? 'alert' : item.status === 'finished' || item.status === 'settled' ? 'done' : 'pending'" :dot="false" /></header>
                        <p>{{ item.currentStageName || '阶段暂不可确认' }} · 进度 {{ item.progress }}%</p><small>项目经理 {{ item.managerName || '待分配' }} · 合同额 {{ formatCardMoney(item.contractAmount) }}</small>
                      </article>
                    </div>
                    <div v-else class="c360__empty"><NavIcon name="pm.project" /><span>该房屋尚未立项。</span></div>
                  </template>
                  <template v-else-if="detailTab === 'measure'">
                    <div v-if="detailActiveMeasures.length" class="c360__records">
                      <article v-for="item in detailActiveMeasures" :key="item.id" class="c360__record">
                        <header><strong>{{ measureStatusLabel(item.status) }}</strong><StatusTag :text="measureStatusLabel(item.status)" :tone="item.status === 'completed' ? 'done' : item.status === 'cancelled' ? 'blocked' : 'pending'" :dot="false" /></header>
                        <p>{{ item.originalStructure || '原始结构待补充' }}</p><small>{{ item.completedAt ? `完成于 ${formatDateTime(item.completedAt)}` : item.scheduledAt ? `预约于 ${formatDateTime(item.scheduledAt)}` : '时间暂不可确认' }}</small>
                      </article>
                    </div>
                    <div v-else class="c360__empty"><NavIcon name="designer.measure" /><span>该房屋尚无量房记录。</span></div>
                  </template>
                  <template v-else>
                    <div v-if="detailReceivables.length" class="c360__records">
                      <article v-for="item in detailReceivables" :key="`${item.projectId}-${item.amount}`" class="c360__record">
                        <header><strong>收款计划</strong><StatusTag :text="item.overdue ? '存在逾期' : (item.outstandingAmount ?? 0) > 0 ? '待收' : '已收清'" :tone="item.overdue ? 'blocked' : (item.outstandingAmount ?? 0) > 0 ? 'pending' : 'done'" :dot="false" /></header>
                        <p class="num">未收 {{ formatCardMoney(item.outstandingAmount) }}</p><small>应收 {{ formatCardMoney(item.amount) }} · 已收 {{ formatCardMoney(item.receivedAmount) }}</small>
                      </article>
                    </div>
                    <div v-else class="c360__empty"><NavIcon name="finance.receivable" /><span>{{ isFinance ? '该房屋当前没有收款计划。' : '当前角色暂无可查看的收款计划。' }}</span></div>
                  </template>
                </div>
              </section>

              <section class="c360__panel">
                <header class="c360__panel-head"><div><h3>跟进记录</h3><p>客户级沟通历史与下一次计划，不随房屋切换。</p></div><el-button v-if="canMaintainCustomer" plain type="primary" @click="openFollow(selectedCard)"><NavIcon name="designer.followup" />写跟进</el-button></header>
                <div v-if="detailFollows.length" class="c360__timeline">
                  <article v-for="follow in detailFollows" :key="follow.id" class="c360__timeline-item">
                    <span class="c360__timeline-dot" />
                    <div><p>{{ follow.content }}</p><small>{{ formatDateTime(follow.createdAt) }} · {{ follow.empName || '—' }}<template v-if="follow.nextFollowAt"> · 下次 {{ formatRelativeDay(follow.nextFollowAt) }}</template></small></div>
                  </article>
                </div>
                <div v-else class="c360__empty"><NavIcon name="designer.followup" /><span>暂无跟进记录。</span></div>
              </section>
            </main>

            <aside class="c360__aside">
              <section class="c360__panel">
                <header class="c360__panel-head"><div><h3>客户资料</h3><p>客户本身的稳定信息。</p></div><el-button v-if="canMaintainCustomer" link type="primary" @click="openEdit(selectedCard)"><NavIcon name="edit" />编辑</el-button></header>
                <dl class="c360__facts">
                  <div><dt>客户来源</dt><dd>{{ detailSourceLabel }}</dd></div>
                  <div><dt>意向小区</dt><dd>{{ selectedCustomer?.community || '—' }}</dd></div>
                  <div><dt>房屋面积</dt><dd>{{ selectedCustomer?.area ? `${selectedCustomer.area}㎡` : '—' }}</dd></div>
                  <div><dt>装修预算</dt><dd>{{ selectedCustomer?.budget ? `${selectedCustomer.budget} 万` : '—' }}</dd></div>
                  <div><dt>客户等级</dt><dd>{{ selectedCustomer?.grade ? `${selectedCustomer.grade} 级` : '待评估' }}</dd></div>
                  <div><dt>到店次数</dt><dd>{{ selectedCustomer?.visitCount ?? 0 }} 次</dd></div>
                  <div class="wide"><dt>详细地址</dt><dd>{{ selectedCustomer?.addr || '暂未填写' }}</dd></div>
                  <div class="wide"><dt>备注</dt><dd>{{ selectedCustomer?.remark || '暂无备注' }}</dd></div>
                </dl>
              </section>

              <section class="c360__panel">
                <header class="c360__panel-head"><div><h3>客户画像</h3><p>决策、需求与偏好。</p></div><el-button v-if="canMaintainCustomer" link type="primary" @click="openEdit(selectedCard)"><NavIcon name="edit" />维护画像</el-button></header>
                <div v-if="detailPortrait.length" class="c360__portrait">
                  <div v-for="item in detailPortrait" :key="item.key"><small>{{ item.label }}</small><strong>{{ item.value }}</strong></div>
                </div>
                <div v-else class="c360__empty"><NavIcon name="designer.design" /><span>画像尚未填写。</span></div>
              </section>

              <section class="c360__panel">
                <header class="c360__panel-head"><div><h3>内容来源</h3><p>客户与内容任务、发布触点之间的归因关系。</p></div></header>
                <div v-if="detailContentError" class="c360__empty"><NavIcon name="boss.risk" /><span>{{ detailContentError }}</span></div>
                <div v-else-if="detailContentTouches.length" class="c360__content-list">
                  <article v-for="touch in detailContentTouches.slice(0, 3)" :key="touch.id" class="c360__content-touch">
                    <header><strong>{{ touch.taskTitle || touch.contentCaption || '内容触点' }}</strong><StatusTag :text="CONTENT_CONFIDENCE_LABELS[touch.confidence]" :tone="touch.confidence === 'high' ? 'done' : touch.confidence === 'medium' ? 'pending' : 'info'" :dot="false" /></header>
                    <p>{{ touch.employeeName || '—' }} · {{ CONTENT_ATTRIBUTION_LABELS[touch.attributionType] }} · {{ touch.isPrimary ? '主归因' : '辅助触点' }}</p>
                    <small v-if="touch.touchedAt">{{ formatDateTime(touch.touchedAt) }}</small>
                  </article>
                  <small v-if="detailContentTouches.length > 3" class="c360__content-more">另有 {{ detailContentTouches.length - 3 }} 条内容触点</small>
                </div>
                <div v-else class="c360__empty"><NavIcon name="designer.followup" /><span>尚未关联内容来源。</span></div>
              </section>

              <section class="c360__panel">
                <header class="c360__panel-head"><div><h3>客户动作</h3><p>低频动作集中处理，避免打断 360 阅读。</p></div></header>
                <div class="c360__action-list">
                  <el-button @click="openTransfer(selectedCard)"><NavIcon name="user" />转交客户负责人</el-button>
                  <el-button v-if="canAssignDesigner" @click="openAssign(selectedCard)"><NavIcon name="designer.design" />指派设计师</el-button>
                  <el-button @click="openCreateProperty"><NavIcon name="add" />新增房屋</el-button>
                  <el-button v-if="canManageLoss" type="danger" plain @click="openLoss(selectedCard, 'mark')"><NavIcon name="boss.risk" />标记客户流失</el-button>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </template>

    <CustomerCreateSheet :open="createVisible" @close="createVisible = false" @created="onCustomerCreated" />
    <CustomerEditSheet :open="editVisible" :customer="selectedCustomer" @close="editVisible = false" @saved="onCustomerSaved" />
    <CustomerFollowFormDrawer v-model="followVisible" :customer="selectedCustomer" @saved="onFollowSaved" />
    <CustomerLossDrawer v-model="lossVisible" :customer="selectedCustomer" :mode="lossMode" @updated="load" />
    <PropertyFormDrawer v-model="propertyFormVisible" :customer-id="selectedCustomer?.id ?? ''" :customer-name="selectedCustomer?.name ?? ''" :property="propertyFormEditing" @saved="onPropertySaved" />

    <el-dialog v-model="transferVisible" title="转交客户负责人" width="460px" destroy-on-close>
      <p class="customer-dialog__hint">{{ selectedCustomer?.name }} · 当前负责人 {{ selectedCustomer?.ownerName || '—' }}</p>
      <EmployeePicker
        v-model="ownerId"
        source="directory"
        :store-id="scope.requestStoreId ?? undefined"
        title="选择客户负责人"
        placeholder="选择负责人"
        clearable
      />
      <el-input v-model="ownerReason" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="请说明本次负责人变更原因" style="margin-top: 12px" />
      <template #footer><el-button @click="transferVisible = false"><NavIcon name="back" />取消</el-button><el-button type="primary" :loading="busy" @click="submitTransfer"><NavIcon name="check" />确认转交</el-button></template>
    </el-dialog>

    <el-dialog v-model="assignVisible" title="指派客户设计师" width="460px" destroy-on-close>
      <p class="customer-dialog__hint">{{ selectedCustomer?.name }} · 当前设计师 {{ selectedCustomer?.designerName || '未指派' }}</p>
      <PropertyPicker :key="propertyPickerKey" v-model="propertyId" :customer-id="selectedCustomer?.id ?? ''" title="选择当前房屋" placeholder="选择本次指派对应的房屋" />
      <el-button size="small" style="margin-top: 8px" @click="openCreateProperty"><NavIcon name="add" />新增房屋</el-button>
      <el-button size="small" style="margin-top: 8px" :disabled="!propertyId || !detailProperty" @click="openCurrentProperty"><NavIcon name="edit" />维护当前房屋</el-button>
      <EmployeePicker
        v-model="designerId"
        source="directory"
        :store-id="scope.requestStoreId ?? undefined"
        title="选择客户设计师"
        placeholder="选择设计师"
        clearable
        class="customer-dialog__employee"
      />
      <template #footer><el-button @click="assignVisible = false"><NavIcon name="back" />取消</el-button><el-button type="primary" :loading="busy" @click="submitAssign"><NavIcon name="check" />确认指派</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.customer-page { display:flex; flex-direction:column; gap:$space-4; min-width:0; }
.customer-dialog__employee { display:block; margin-top:$space-3; }
.customer-page__preview { border-radius:$radius-md; }
.customer-page__head { display:flex; align-items:flex-start; justify-content:space-between; gap:$space-6; }
.customer-page__titles { min-width:0; flex:1; }
.customer-page__kicker { margin:0 0 $space-1; color:$brand-700; font-size:$font-caption; font-weight:$font-weight-semibold; }
.customer-page__titles h1 { margin:0; color:$text-primary; font-size:$font-display; line-height:1.25; letter-spacing:-.02em; }
.customer-page__titles > p:not(.customer-page__kicker) { max-width:780px; margin:$space-2 0 0; color:$text-secondary; font-size:$font-body-sm; line-height:1.7; }
.customer-page__scope-line { display:flex; align-items:center; gap:$space-2; flex-wrap:wrap; margin-top:$space-2; color:$text-tertiary; font-size:$font-caption; }
.customer-page__warning { color:$danger-500; }
.customer-page__preview-label { padding:2px 7px; border-radius:$radius-pill; background:$info-50; color:$info-500; }
.customer-page__actions { display:flex; align-items:center; justify-content:flex-end; gap:$space-2; flex-wrap:wrap; }
.customer-page__locked-store { padding:5px 8px; border-radius:$radius-sm; background:$surface-100; color:$text-secondary; font-size:$font-caption; }
.customer-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); overflow:hidden; border:1px solid $border-color; border-radius:$radius-md; background:$surface-0; box-shadow:$shadow-card; }
.customer-metric { min-width:0; padding:15px 18px 14px; border-left:1px solid $border-color; }
.customer-metric:first-child { border-left:0; }
.customer-metric__head { display:flex; align-items:center; justify-content:space-between; gap:$space-2; color:$text-secondary; font-size:$font-caption; }
.customer-metric__icon { width:24px; height:24px; display:grid; place-items:center; border-radius:7px; background:$brand-50; color:$brand-700; }
.customer-metric__icon :deep(svg) { width:14px; height:14px; }
.customer-metric--attention .customer-metric__icon { background:$warning-50; color:$warning-700; }
.customer-metric--danger .customer-metric__icon { background:$danger-50; color:$danger-500; }
.customer-metric--info .customer-metric__icon { background:$info-50; color:$info-500; }
.customer-metric__value { margin-top:7px; color:$text-primary; font-size:$font-kpi; font-weight:$font-weight-bold; line-height:1.15; }
.customer-metric__value small { margin-left:3px; font-family:$font-sans; font-size:$font-caption; font-weight:$font-weight-medium; color:$text-secondary; }
.customer-metric__note { margin-top:4px; color:$text-tertiary; font-size:$font-caption; }
.customer-layout { display:grid; grid-template-columns:216px minmax(0,1fr); gap:$space-4; align-items:start; }
.customer-owner { position:sticky; top:$space-4; overflow:hidden; border:1px solid $border-color; border-radius:$radius-md; background:$surface-0; box-shadow:$shadow-card; }
.customer-owner__head { padding:14px 14px 12px; border-bottom:1px solid $border-color; }
.customer-owner__head strong, .customer-owner__head small { display:block; }
.customer-owner__head strong { color:$text-primary; font-size:$font-body-sm; }
.customer-owner__head small { margin-top:3px; color:$text-tertiary; font-size:$font-caption; }
.customer-owner__search { padding:10px 8px 4px; }
.customer-owner__list { display:flex; max-height:600px; overflow-y:auto; flex-direction:column; gap:2px; padding:4px 6px 8px; }
.customer-owner__item { min-width:0; display:grid; grid-template-columns:30px minmax(0,1fr) auto; gap:9px; align-items:center; padding:9px 8px; border:0; border-radius:$radius-sm; background:transparent; color:$text-primary; text-align:left; }
.customer-owner__item:hover { background:$surface-50; }
.customer-owner__item.active { background:$brand-50; }
.customer-owner__avatar { width:30px; height:30px; display:grid; place-items:center; border-radius:50%; background:$surface-100; color:$text-secondary; font-size:$font-caption; font-weight:$font-weight-bold; }
.customer-owner__item.active .customer-owner__avatar { background:$brand-100; color:$brand-700; }
.customer-owner__copy { min-width:0; }
.customer-owner__copy b, .customer-owner__copy small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.customer-owner__copy b { font-size:$font-caption; }
.customer-owner__copy small { margin-top:2px; color:$text-tertiary; font-size:$font-caption; }
.customer-owner__count { color:$text-secondary; font-size:$font-caption; text-align:right; }
.customer-owner__count b { display:block; color:$text-primary; font-size:$font-body-sm; }
.customer-owner__count small { display:block; color:$danger-500; font-size:$font-caption; }
.customer-owner__empty { display:flex; align-items:center; gap:6px; margin:4px 8px 8px; padding:10px; border-radius:$radius-sm; background:$surface-50; color:$text-tertiary; font-size:$font-caption; line-height:1.5; }
.customer-main { min-width:0; display:flex; flex-direction:column; gap:$space-3; }
.customer-query { padding:$space-3; border:1px solid $border-color; border-radius:$radius-md; background:$surface-0; box-shadow:$shadow-card; }
.customer-query__row { display:flex; align-items:center; gap:$space-2; flex-wrap:wrap; }
.customer-query__search { flex:1; min-width:250px; }
.customer-query__filters { display:flex; gap:6px; flex-wrap:wrap; margin-top:$space-3; }
.customer-filter { min-height:32px; display:inline-flex; align-items:center; gap:5px; padding:0 11px; border:1px solid $border-color; border-radius:$radius-pill; background:$surface-0; color:$text-secondary; font-size:$font-caption; cursor:pointer; }
.customer-filter:hover { border-color:$brand-200; color:$brand-700; }
.customer-filter.active { border-color:$brand-200; background:$brand-50; color:$brand-700; font-weight:$font-weight-semibold; }
.customer-state { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:320px; padding:$space-8 $space-5; border:1px solid $border-color; border-radius:$radius-md; background:$surface-0; box-shadow:$shadow-card; text-align:center; }
.customer-state__icon { width:44px; height:44px; display:grid; place-items:center; border-radius:$radius-md; background:$surface-100; color:$text-tertiary; }
.customer-state__icon :deep(svg) { width:22px; height:22px; }
.customer-state h2 { margin:$space-3 0 0; color:$text-primary; font-size:$font-body; }
.customer-state p { max-width:440px; margin:$space-2 0 $space-3; color:$text-secondary; font-size:$font-body-sm; line-height:1.65; }
.customer-cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:$space-3; }
.customer-cards--skeleton { grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); }
.customer-card-skeleton { min-height:420px; }
.customer-card { position:relative; min-width:0; padding:$space-4; border:1px solid $border-color; border-radius:$radius-md; background:$surface-0; box-shadow:$shadow-card; transition:border-color $transition-fast, box-shadow $transition-fast; }
.customer-card:hover { border-color:$brand-200; box-shadow:$shadow-elevated; }
.customer-card.risk-high::before, .customer-card.risk-attention::before { content:""; position:absolute; inset:14px auto 14px 0; width:3px; border-radius:0 3px 3px 0; }
.customer-card.risk-high::before { background:$danger-500; }
.customer-card.risk-attention::before { background:$warning-500; }
.customer-card__head { display:flex; align-items:flex-start; gap:10px; }
.customer-card__avatar { width:38px; height:38px; flex:0 0 auto; display:grid; place-items:center; border-radius:10px; background:$brand-50; color:$brand-700; font-size:$font-body; font-weight:$font-weight-bold; }
.customer-card__identity { min-width:0; flex:1; }
.customer-card__name { display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
.customer-card__name strong { color:$text-primary; font-size:$font-card-title; }
.customer-grade { padding:1px 6px; border-radius:$radius-pill; background:$surface-100; color:$text-secondary; font-size:$font-caption; }
.customer-card__contact { display:flex; align-items:center; gap:4px; min-width:0; margin-top:4px; color:$text-secondary; font-size:$font-caption; }
.customer-card__contact span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.customer-card__follow { flex:0 0 auto; padding:3px 7px; border-radius:$radius-pill; background:$surface-100; color:$text-secondary; font-size:$font-caption; white-space:nowrap; }
.customer-card__location { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:$space-3; padding:9px $space-3; border-radius:$radius-sm; background:$surface-50; color:$text-secondary; font-size:$font-caption; }
.customer-card__location strong { color:$text-primary; font-size:$font-body-sm; }
.customer-card__people { display:flex; gap:10px 18px; flex-wrap:wrap; margin-top:$space-3; color:$text-secondary; font-size:$font-caption; }
.customer-card__people div { min-width:0; display:flex; align-items:baseline; gap:5px; }
.customer-card__people small { color:$text-tertiary; font-size:$font-caption; }
.customer-card__people b { overflow:hidden; max-width:150px; color:$text-primary; font-size:$font-caption; text-overflow:ellipsis; white-space:nowrap; }
.customer-card__signals { display:flex; gap:6px; flex-wrap:wrap; margin-top:$space-3; }
.customer-card__signals span { display:inline-flex; align-items:center; gap:4px; padding:4px 7px; border-radius:$radius-sm; background:$surface-50; color:$text-secondary; font-size:$font-caption; }
.customer-card__progress { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1px; margin-top:$space-3; overflow:hidden; border:1px solid $border-color; border-radius:$radius-sm; background:$border-color; }
.customer-card__progress > div { min-width:0; padding:9px 10px; background:$surface-0; }
.customer-card__progress small, .customer-card__progress b { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.customer-card__progress small { color:$text-tertiary; font-size:$font-caption; }
.customer-card__progress b { margin-top:3px; color:$text-primary; font-size:$font-caption; font-weight:$font-weight-semibold; }
.customer-card__progress b.danger, .danger { color:$danger-500 !important; }
.customer-card__business { display:flex; align-items:center; justify-content:space-between; gap:$space-3; margin-top:$space-3; padding:$space-3; border-left:3px solid $brand-300; border-radius:$radius-sm; background:$brand-50; }
.customer-card__business div { min-width:0; }
.customer-card__business small, .customer-card__business strong { display:block; }
.customer-card__business small { color:$text-tertiary; font-size:$font-caption; }
.customer-card__business strong { margin-top:2px; color:$brand-700; font-size:$font-body-sm; }
.customer-card__business > span { max-width:45%; overflow:hidden; color:$text-secondary; font-size:$font-caption; text-align:right; text-overflow:ellipsis; white-space:nowrap; }
.customer-card__finance-context { display:flex; gap:6px 12px; flex-wrap:wrap; margin-top:$space-2; padding-top:$space-2; border-top:1px dashed $border-color; color:$text-secondary; font-size:$font-caption; }
.customer-card__finance-context span { display:inline-flex; align-items:center; gap:4px; }
.customer-card__finance-context b { color:$text-primary; font-weight:$font-weight-semibold; }
.customer-card__next { display:flex; align-items:center; gap:$space-3; margin-top:$space-3; padding-top:11px; border-top:1px solid $border-color; }
.customer-card__next > div { min-width:0; flex:1; }
.customer-card__next small, .customer-card__next strong, .customer-card__next span { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.customer-card__next small, .customer-card__next span { color:$text-tertiary; font-size:$font-caption; }
.customer-card__next strong { margin-top:2px; color:$text-primary; font-size:$font-body-sm; }
.customer-card__next span { margin-top:2px; }
.customer-card__next :deep(.el-button) { flex:0 0 auto; }
.customer-drawer :deep(.el-drawer__body) { padding:0; }
.customer-detail { min-height:100%; display:flex; flex-direction:column; background:$bg-page; }
.customer-detail__head { display:flex; align-items:flex-start; gap:$space-3; padding:$space-5; background:$surface-0; border-bottom:1px solid $border-color; }
.customer-detail__title { min-width:0; flex:1; }
.customer-detail__title h2 { margin:0; display:flex; align-items:center; gap:$space-2; flex-wrap:wrap; color:$text-primary; font-size:$font-h1; }
.customer-detail__title p { margin:$space-2 0 0; color:$text-secondary; font-size:$font-caption; }
.customer-detail__loading { padding:$space-4; }
.customer-detail__section { margin:$space-3 $space-4 0; overflow:hidden; border:1px solid $border-color; border-radius:$radius-md; background:$surface-0; box-shadow:$shadow-card; }
.customer-detail__section-head { display:flex; align-items:flex-start; justify-content:space-between; gap:$space-3; padding:14px 16px; border-bottom:1px solid $border-color; }
.customer-detail__section-head h3 { margin:0; color:$text-primary; font-size:$font-body-sm; }
.customer-detail__section-head p { margin:4px 0 0; color:$text-tertiary; font-size:$font-caption; }
.customer-detail__properties { display:flex; flex-wrap:wrap; gap:$space-2; padding:$space-3 $space-4; }
.customer-detail__property { padding:8px 10px; border:1px solid $border-color; border-radius:$radius-sm; background:$surface-0; color:$text-secondary; text-align:left; }
.customer-detail__property.active { border-color:$brand-200; background:$brand-50; color:$brand-700; }
.customer-detail__property b, .customer-detail__property small { display:block; }
.customer-detail__property b { display:flex; align-items:center; gap:5px; color:inherit; font-size:$font-caption; }
.customer-detail__property small { margin-top:2px; color:$text-tertiary; font-size:$font-caption; }
.customer-detail__empty { padding:$space-4; color:$text-secondary; font-size:$font-caption; line-height:1.6; }
.customer-detail__chain { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1px; background:$border-color; }
.customer-detail__chain-item { min-width:0; padding:14px; background:$surface-0; }
.customer-detail__chain-item small, .customer-detail__chain-item strong, .customer-detail__chain-item p { display:block; }
.customer-detail__chain-item small { color:$text-tertiary; font-size:$font-caption; }
.customer-detail__chain-item strong { margin-top:4px; color:$text-primary; font-size:$font-body-sm; }
.customer-detail__chain-item p { margin:5px 0 0; color:$text-secondary; font-size:$font-caption; line-height:1.5; }
.customer-detail__chain-item.tone-danger strong { color:$danger-500; }
.customer-detail__chain-item.tone-attention strong { color:$warning-700; }
.customer-detail__timeline { padding:14px 16px 16px; display:flex; flex-direction:column; gap:14px; }
.customer-detail__timeline-item { position:relative; padding-left:20px; }
.customer-detail__timeline-item::before { content:""; position:absolute; left:3px; top:5px; width:7px; height:7px; border-radius:50%; background:$brand-500; }
.customer-detail__timeline-item:not(:last-child)::after { content:""; position:absolute; left:6px; top:16px; bottom:-13px; width:1px; background:$border-color; }
.customer-detail__timeline-item p { margin:0; color:$text-primary; font-size:$font-caption; }
.customer-detail__timeline-item small { display:block; margin-top:4px; color:$text-tertiary; font-size:$font-caption; }
.customer-detail__projects { display:flex; flex-direction:column; gap:1px; background:$border-color; }
.customer-detail__project { display:flex; flex-direction:column; gap:4px; padding:12px 16px; background:$surface-0; }
.customer-detail__project strong { color:$text-primary; font-size:$font-body-sm; }
.customer-detail__project span, .customer-detail__project small { color:$text-secondary; font-size:$font-caption; }
.customer-detail__footer { position:sticky; bottom:0; display:flex; align-items:center; gap:$space-2; margin-top:$space-3; padding:12px 20px; border-top:1px solid $border-color; background:rgba(255,255,255,.96); }
.customer-detail__footer > div { min-width:0; flex:1; }
.customer-detail__footer small, .customer-detail__footer strong { display:block; }
.customer-detail__footer small { color:$text-tertiary; font-size:$font-caption; }
.customer-detail__footer strong { margin-top:2px; color:$text-primary; font-size:$font-body-sm; }

/* 客户 360：宽幅双栏工作面，先客户与责任关系，再当前房屋业务，最后资料、画像与跟进。 */
.customer-360-page__toolbar { display:flex; align-items:center; justify-content:space-between; gap:$space-3; }
.customer-360-page__toolbar > span { color:$text-tertiary; font-size:$font-caption; }
.c360 { height:100%; min-height:0; display:flex; flex-direction:column; background:$bg-page; }
.customer-detail--page { height:auto; min-height:0; overflow:visible; border:1px solid $border-color; border-radius:$radius-lg; background:$bg-page; box-shadow:$shadow-card; }
.customer-detail--page .c360__hero { border-radius:$radius-lg $radius-lg 0 0; }
.customer-detail--page .c360__scroll { overflow:visible; padding:18px 20px 24px; }
.c360__hero { flex:0 0 auto; display:flex; align-items:flex-start; justify-content:space-between; gap:$space-4; padding:20px 24px; border-bottom:1px solid $border-color; background:$surface-0; }
.c360__identity { min-width:0; flex:1; display:flex; align-items:flex-start; gap:14px; }
.c360__avatar { width:52px; height:52px; flex:0 0 auto; display:grid; place-items:center; border-radius:$radius-md; background:$brand-50; color:$brand-700; font-size:$font-title; font-weight:$font-weight-bold; }
.c360__identity-copy { min-width:0; flex:1; }
.c360__name-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.c360__name-row h2 { margin:0; color:$text-primary; font-size:$font-h1; line-height:1.25; }
.c360__contact-line { display:flex; align-items:center; gap:8px 18px; flex-wrap:wrap; margin-top:8px; color:$text-secondary; font-size:$font-caption; }
.c360__contact-line span { display:inline-flex; align-items:center; gap:5px; }
.c360__tags { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
.c360__tags span { padding:3px 8px; border-radius:$radius-pill; background:$surface-100; color:$text-secondary; font-size:$font-caption; }
.c360__hero-actions { flex:0 0 auto; display:flex; align-items:center; justify-content:flex-end; gap:$space-2; flex-wrap:wrap; max-width:430px; }
.c360__loading { padding:$space-5; }
.c360__scroll { flex:1; min-height:0; overflow-y:auto; padding:18px 24px 28px; }
.c360__relations { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); overflow:hidden; border:1px solid $border-color; border-radius:$radius-md; background:$surface-0; box-shadow:$shadow-card; }
.c360__relation { min-width:0; min-height:74px; display:grid; grid-template-columns:34px minmax(0,1fr) auto; align-items:center; gap:10px; padding:12px 14px; border:0; border-left:1px solid $border-color; background:transparent; color:$text-primary; text-align:left; }
.c360__relation:first-child { border-left:0; }
.c360__relation:not(:disabled) { cursor:pointer; }
.c360__relation:not(:disabled):hover { background:$surface-50; }
.c360__relation:disabled { cursor:default; }
.c360__relation-icon { width:34px; height:34px; display:grid; place-items:center; border-radius:$radius-sm; background:$brand-50; color:$brand-700; }
.c360__relation small, .c360__relation strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.c360__relation small { color:$text-tertiary; font-size:$font-caption; }
.c360__relation strong { margin-top:3px; color:$text-primary; font-size:$font-body-sm; }
.c360__relation--static { border-left:1px solid $border-color; }
.c360__journey { margin-top:$space-3; padding:16px 18px; border:1px solid $border-color; border-radius:$radius-md; background:$surface-0; box-shadow:$shadow-card; }
.c360__journey > header { display:flex; align-items:flex-start; justify-content:space-between; gap:$space-4; }
.c360__journey > header strong, .c360__journey > header small { display:block; }
.c360__journey > header strong { color:$text-primary; font-size:$font-body-sm; }
.c360__journey > header small { margin-top:3px; color:$text-tertiary; font-size:$font-caption; }
.c360__journey > header > span { color:$brand-700; font-size:$font-caption; font-weight:$font-weight-semibold; }
.c360__journey-rail { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); margin-top:16px; }
.c360__journey-step { position:relative; display:flex; flex-direction:column; align-items:center; gap:6px; color:$text-tertiary; font-size:$font-caption; }
.c360__journey-step:not(:first-child)::before { content:""; position:absolute; top:15px; right:50%; width:100%; height:1px; background:$border-color; }
.c360__journey-node { position:relative; z-index:1; width:30px; height:30px; display:grid; place-items:center; border:1px solid $border-color; border-radius:50%; background:$surface-0; }
.c360__journey-node :deep(svg) { width:13px; height:13px; }
.c360__journey-step b { font-weight:$font-weight-medium; }
.c360__journey-step.is-done { color:$brand-700; }
.c360__journey-step.is-done::before, .c360__journey-step.is-current::before { background:$brand-300; }
.c360__journey-step.is-done .c360__journey-node { border-color:$brand-500; background:$brand-500; color:$surface-0; }
.c360__journey-step.is-current { color:$brand-700; }
.c360__journey-step.is-current .c360__journey-node { border-color:$brand-500; background:$brand-50; color:$brand-700; box-shadow:0 0 0 3px $brand-50; }
.c360__grid { display:grid; grid-template-columns:minmax(0,1fr) 320px; gap:$space-4; align-items:start; margin-top:$space-3; }
.c360__main, .c360__aside { min-width:0; display:flex; flex-direction:column; gap:$space-3; }
.c360__panel { overflow:hidden; border:1px solid $border-color; border-radius:$radius-md; background:$surface-0; box-shadow:$shadow-card; }
.c360__panel-head { display:flex; align-items:flex-start; justify-content:space-between; gap:$space-3; padding:14px 16px; border-bottom:1px solid $border-color; }
.c360__panel-head h3 { margin:0; color:$text-primary; font-size:$font-body-sm; }
.c360__panel-head p { margin:4px 0 0; color:$text-tertiary; font-size:$font-caption; line-height:1.5; }
.c360__subject { color:$text-secondary; font-size:$font-caption; white-space:nowrap; }
.c360__houses { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:$space-3; padding:$space-3; }
.c360__house { min-width:0; padding:14px; border:1px solid $border-color; border-radius:$radius-sm; background:$surface-50; }
.c360__house.active { border-color:$brand-300; background:$brand-50; box-shadow:inset 3px 0 0 $brand-500; }
.c360__house > header { display:flex; align-items:flex-start; justify-content:space-between; gap:$space-2; }
.c360__house > header strong { min-width:0; display:flex; align-items:center; gap:6px; color:$text-primary; font-size:$font-body-sm; }
.c360__house > p { margin:8px 0 0; color:$text-secondary; font-size:$font-caption; line-height:1.5; }
.c360__house-meta { display:flex; gap:6px 12px; flex-wrap:wrap; margin-top:9px; color:$text-tertiary; font-size:$font-caption; }
.c360__house > footer { display:flex; gap:$space-2; flex-wrap:wrap; margin-top:12px; padding-top:10px; border-top:1px dashed $border-color; }
.c360__chain { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1px; background:$border-color; }
.c360__chain-item { min-width:0; padding:13px 14px; background:$surface-0; }
.c360__chain-item small, .c360__chain-item strong, .c360__chain-item p { display:block; }
.c360__chain-item small { color:$text-tertiary; font-size:$font-caption; }
.c360__chain-item strong { margin-top:4px; color:$text-primary; font-size:$font-body-sm; }
.c360__chain-item p { margin:4px 0 0; color:$text-secondary; font-size:$font-caption; line-height:1.5; }
.c360__chain-item.tone-danger strong { color:$danger-500; }
.c360__chain-item.tone-attention strong { color:$warning-700; }
.c360__tabs { display:flex; flex-wrap:wrap; gap:4px; padding:8px; border-bottom:1px solid $border-color; background:$surface-50; }
.c360__tabs button { min-height:32px; display:inline-flex; align-items:center; justify-content:center; gap:5px; flex:1 1 auto; padding:0 12px; border:1px solid transparent; border-radius:$radius-sm; background:transparent; color:$text-secondary; font:inherit; font-size:$font-caption; cursor:pointer; }
.c360__tabs button:hover { color:$brand-700; background:$surface-0; }
.c360__tabs button.active { border-color:$brand-200; background:$surface-0; color:$brand-700; font-weight:$font-weight-semibold; box-shadow:$shadow-card; }
.c360__tab-panel { min-height:190px; padding:$space-3; }
.c360__records { display:flex; flex-direction:column; gap:$space-2; }
.c360__record { padding:12px 14px; border:1px solid $border-color; border-radius:$radius-sm; background:$surface-50; }
.c360__record header { display:flex; align-items:flex-start; justify-content:space-between; gap:$space-3; }
.c360__record header strong { color:$text-primary; font-size:$font-body-sm; }
.c360__record p { margin:8px 0 0; color:$text-secondary; font-size:$font-caption; line-height:1.55; }
.c360__record small { display:block; margin-top:7px; color:$text-tertiary; font-size:$font-caption; }
.c360__timeline { display:flex; flex-direction:column; gap:14px; padding:$space-3 $space-4; }
.c360__timeline-item { position:relative; display:grid; grid-template-columns:12px minmax(0,1fr); gap:10px; }
.c360__timeline-item:not(:last-child)::after { content:""; position:absolute; left:4px; top:12px; bottom:-13px; width:1px; background:$border-color; }
.c360__timeline-dot { width:9px; height:9px; margin-top:5px; border-radius:50%; background:$brand-500; }
.c360__timeline-item p { margin:0; color:$text-primary; font-size:$font-caption; line-height:1.55; }
.c360__timeline-item small { display:block; margin-top:4px; color:$text-tertiary; font-size:$font-caption; }
.c360__facts { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1px; background:$border-color; }
.c360__facts > div { min-width:0; padding:11px 13px; background:$surface-0; }
.c360__facts > div.wide { grid-column:1 / -1; }
.c360__facts dt { color:$text-tertiary; font-size:$font-caption; }
.c360__facts dd { margin:3px 0 0; overflow:hidden; color:$text-primary; font-size:$font-caption; line-height:1.5; text-overflow:ellipsis; }
.c360__portrait { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1px; background:$border-color; }
.c360__portrait > div { min-width:0; padding:11px 13px; background:$surface-0; }
.c360__portrait small, .c360__portrait strong { display:block; }
.c360__portrait small { color:$text-tertiary; font-size:$font-caption; }
.c360__portrait strong { margin-top:3px; color:$text-primary; font-size:$font-caption; }
.c360__content-list { display:flex; flex-direction:column; gap:$space-2; padding:$space-3; }
.c360__content-touch { padding:11px 12px; border:1px solid $border-color; border-radius:$radius-sm; background:$surface-50; }
.c360__content-touch header { display:flex; align-items:flex-start; justify-content:space-between; gap:$space-2; }
.c360__content-touch header strong { min-width:0; overflow:hidden; color:$text-primary; font-size:$font-caption; text-overflow:ellipsis; white-space:nowrap; }
.c360__content-touch p { margin:7px 0 0; color:$text-secondary; font-size:$font-caption; line-height:1.5; }
.c360__content-touch > small { display:block; margin-top:5px; color:$text-tertiary; font-size:$font-caption; }
.c360__content-more { color:$text-tertiary; font-size:$font-caption; text-align:center; }
.c360__action-list { display:flex; flex-direction:column; gap:$space-2; padding:$space-3; }
.c360__action-list :deep(.el-button) { width:100%; margin-left:0; justify-content:flex-start; }
.c360__empty { min-height:120px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:$space-4; color:$text-tertiary; font-size:$font-caption; text-align:center; }
.c360__empty :deep(svg) { width:22px; height:22px; }
.customer-dialog__hint { margin:0 0 $space-2; color:$text-secondary; font-size:$font-caption; }
@media (max-width:1280px) {
  .customer-page__head { gap:$space-4; }
  .customer-layout { grid-template-columns:196px minmax(0,1fr); }
  .customer-metrics { grid-template-columns:repeat(4,minmax(0,1fr)); }
}
@media (max-width:1100px) {
  .customer-layout { grid-template-columns:minmax(0,1fr); }
  .customer-owner { position:static; }
  .customer-owner__head { display:flex; align-items:center; justify-content:space-between; }
  .customer-owner__search { padding-bottom:8px; }
  .customer-owner__list { flex-direction:row; overflow-x:auto; padding-bottom:8px; }
  .customer-owner__item { flex:0 0 176px; }
  .customer-owner__empty { flex:0 0 220px; margin:0 8px 8px; }
  .c360__relations { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .c360__relation:nth-child(3) { border-top:1px solid $border-color; border-left:0; }
  .c360__relation:nth-child(4) { border-top:1px solid $border-color; }
  .c360__hero { flex-direction:column; }
  .c360__hero-actions { max-width:none; justify-content:flex-start; }
  .c360__grid { grid-template-columns:minmax(0,1fr) 280px; }
  .c360__chain { grid-template-columns:repeat(2,minmax(0,1fr)); }
}
@media (max-width:820px) {
  .customer-page__head { flex-direction:column; }
  .customer-page__actions { justify-content:flex-start; }
  .customer-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .customer-metric:nth-child(3) { border-left:0; border-top:1px solid $border-color; }
  .customer-metric:nth-child(4) { border-top:1px solid $border-color; }
  .customer-detail__chain { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .c360__grid { grid-template-columns:minmax(0,1fr); }
  .c360__aside { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); align-items:start; }
  .c360__aside .c360__panel:last-child { grid-column:1 / -1; }
  .c360__journey-rail { grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px 0; }
  .c360__journey-step:nth-child(5)::before { display:none; }
}
</style>
