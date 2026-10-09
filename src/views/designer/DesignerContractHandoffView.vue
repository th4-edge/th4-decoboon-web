<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StatusTag from '@/components/StatusTag.vue'
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import MoneyText from '@/components/MoneyText.vue'
import CustomerHeroCard from '@/components/customer/CustomerHeroCard.vue'
import CustomerContextPanels from '@/components/customer/CustomerContextPanels.vue'
import RequirementFormDrawer from '@/components/design/RequirementFormDrawer.vue'
import HeroFocusItem from '@/components/workbench/HeroFocusItem.vue'
import WorkbenchQuickAction from '@/components/workbench/WorkbenchQuickAction.vue'
import WorkbenchState from '@/components/workbench/WorkbenchState.vue'
import CustomerPropertyContext from '@/components/CustomerPropertyContext.vue'
import { formatDateTime } from '@/core/format'
import { quoteDesignerPage } from '@/domains/trade/api'
import type { Quote } from '@/domains/trade/model'
import { contractApi } from '@/domains/contract/api'
import { documentApi } from '@/domains/document/api'
import type { DocumentArchive } from '@/domains/document/model'
import type { DesignScheme, TalkPlan } from '@/domains/design/model'
import type { Contract, ContractStatus } from '@/domains/contract/model'
import { crmApi } from '@/domains/crm/api'
import type { Customer, CustomerFollow } from '@/domains/crm/model'
import { designApi } from '@/domains/design/api'
import type { DesignRequirement } from '@/domains/design/model'
import type { StatusTone } from '@/core/tone'

const router = useRouter()
const route = useRoute()

type QueueFilter = 'all' | 'toCreate' | 'waitingConfirm' | 'effective'

const FILTERS: Array<{ key: QueueFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'toCreate', label: '待发起合同' },
  { key: 'waitingConfirm', label: '待企业确认' },
  { key: 'effective', label: '已生效' }
]

/** 合同发起后进入企业确认阶段的状态（Signed 之前均未完成签约）。 */
const CONFIRM_STATUSES: ContractStatus[] = ['pendingSign', 'signed']
/** 合同已生效（含履约中、已变更等）；terminated/void 为终态不进入项目主链。 */
const EFFECTIVE_STATUSES: ContractStatus[] = ['effective', 'changing', 'active', 'changed', 'completed', 'closed', 'settled']
const SIGNED_STATUSES: ContractStatus[] = ['signed', ...EFFECTIVE_STATUSES]

interface ContractQueueItem {
  quote: Quote
  contract: Contract | null
  contractLoading: boolean
  contractError: boolean
}

const items = ref<ContractQueueItem[]>([])
const loading = ref(false)
const error = ref('')
const keyword = ref('')
const filter = ref<QueueFilter>('all')
const selectedKey = ref('')
const actionError = ref('')
const saving = ref(false)

const customer = ref<Customer | null>(null)
const follows = ref<CustomerFollow[]>([])
const requirements = ref<DesignRequirement[]>([])
const contextLoading = ref(false)
const contextError = ref('')

const TALK_STATUS_LABELS: Record<string, string> = {
  draft: '草稿', generated: '已生成', published: '已发布', archived: '已归档'
}

const requirementOpen = ref(false)

// ── 签约资料：方案 / 谈单 PPT / 报价 PDF / 合同 PDF ────────────
const scheme = ref<DesignScheme | null>(null)
const talks = ref<TalkPlan[]>([])
const quotePdf = ref<DocumentArchive | null>(null)
const contractPdf = ref<DocumentArchive | null>(null)
const talkBusy = ref(false)
const pdfBusy = ref(false)
const talkError = ref('')
const pdfError = ref('')

const latestTalk = computed(() => talks.value[0] ?? null)

/** 签约依据：方案 + 谈单 PPT + 报价 PDF + 合同 PDF。 */
async function loadDealContext(item: ContractQueueItem | null): Promise<void> {
  scheme.value = null
  talks.value = []
  quotePdf.value = null
  contractPdf.value = null
  talkError.value = ''
  pdfError.value = ''
  if (!item) return
  const quote = item.quote
  const tasks: Promise<unknown>[] = []
  if (quote.designId) {
    tasks.push(
      designApi.schemeInfo(quote.designId).then((r) => { scheme.value = r }).catch(() => { scheme.value = null }),
      designApi.listTalks(quote.designId).then((r) => { talks.value = r }).catch(() => { talks.value = [] })
    )
  }
  tasks.push(
    documentApi.quoteRecords(quote.id).then((r) => { quotePdf.value = r[0] ?? null }).catch(() => { quotePdf.value = null })
  )
  if (item.contract?.id) {
    tasks.push(
      documentApi.contractRecords(item.contract.id).then((r) => { contractPdf.value = r[0] ?? null }).catch(() => { contractPdf.value = null })
    )
  }
  await Promise.allSettled(tasks)
}

async function buildTalkPpt(): Promise<void> {
  const item = selectedItem.value
  const quote = item?.quote
  if (!quote?.designId || talkBusy.value) return
  talkBusy.value = true
  talkError.value = ''
  try {
    const talk = await designApi.buildTalk(quote.designId, quote.id, latestTalk.value?.id)
    talks.value = [talk, ...talks.value.filter((t) => t.id !== talk.id)]
    ElMessage.success('谈单 PPT 已生成')
  } catch (err) {
    talkError.value = err instanceof Error ? err.message : '谈单 PPT 生成失败'
  } finally {
    talkBusy.value = false
  }
}

async function buildPdf(kind: 'quote' | 'contract'): Promise<void> {
  const item = selectedItem.value
  if (!item || pdfBusy.value) return
  if (kind === 'contract' && !item.contract?.id) return
  pdfBusy.value = true
  pdfError.value = ''
  try {
    if (kind === 'quote') {
      quotePdf.value = await documentApi.buildQuote(item.quote.id)
      ElMessage.success('报价 PDF 已生成')
    } else {
      contractPdf.value = await documentApi.buildContract(String(item.contract?.id))
      ElMessage.success('合同 PDF 已生成')
    }
  } catch (err) {
    pdfError.value = err instanceof Error ? err.message : 'PDF 生成失败'
  } finally {
    pdfBusy.value = false
  }
}

function openArchive(url?: string): void {
  if (!url) return
  window.open(url, '_blank', 'noopener')
}
const createOpen = ref(false)
const createForm = reactive({
  startDate: '',
  planEndDate: '',
  paymentTerms: '',
  remark: ''
})

const selectedItem = computed(() => items.value.find((item) => item.quote.id === selectedKey.value) ?? null)
const selectedContract = computed(() => selectedItem.value?.contract ?? null)

/** Hero 用客户对象：优先服务端客户档案，缺失时退到报价里的客户名（不伪装完整档案）。 */
const heroCustomer = computed<Partial<Customer> | null>(() => {
  if (customer.value) return customer.value
  const quote = selectedItem.value?.quote
  return quote ? { name: quote.customerName ?? undefined } : null
})

/** 金额文本：给 HeroFocusItem 的 value 用（组件插槽里无法嵌套组件）。 */
function moneyText(value?: number | null): string {
  if (value === null || value === undefined) return '金额暂不可确认'
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const isSigned = (status: ContractStatus): boolean => SIGNED_STATUSES.includes(status)
const isEffective = (status: ContractStatus): boolean => EFFECTIVE_STATUSES.includes(status)
const isTerminated = (status: ContractStatus): boolean => status === 'terminated' || status === 'void'

function stayDays(value?: string): number {
  if (!value) return 0
  const start = new Date(value.replace(' ', 'T')).getTime()
  if (Number.isNaN(start)) return 0
  return Math.max(0, Math.floor((Date.now() - start) / 86400000))
}

function contractTone(status: ContractStatus): StatusTone {
  if (status === 'terminated') return 'blocked'
  if (status === 'void' || status === 'closed') return 'closed'
  if (status === 'pendingSign') return 'pending'
  if (status === 'signed') return 'progress'
  if (status === 'effective' || status === 'active') return 'done'
  if (status === 'changing') return 'alert'
  if (status === 'changed') return 'special'
  return 'dark'
}

function itemReason(item: ContractQueueItem): string {
  if (!item.contract) return '报价已确认 · 待发起合同'
  const contract = item.contract
  if (contract.status === 'pendingSign') return `待企业确认签约 · 已停留 ${stayDays(contract.createdAt)} 天`
  if (contract.status === 'signed') return `待企业确认生效 · 已停留 ${stayDays(contract.createdAt)} 天`
  if (isEffective(contract.status)) return '合同已生效 · 可进入项目履约'
  return contract.status === 'draft' ? '合同草稿 · 待企业确认' : '合同已关闭或终止 · 只读查看'
}

function itemTone(item: ContractQueueItem): StatusTone {
  if (!item.contract) return 'pending'
  return contractTone(item.contract.status)
}

const filteredItems = computed(() => {
  const needle = keyword.value.trim().toLowerCase()
  return items.value.filter((item) => {
    const contract = item.contract
    const matchesFilter = filter.value === 'all'
      || (filter.value === 'toCreate' && !contract)
      || (filter.value === 'waitingConfirm' && contract && CONFIRM_STATUSES.includes(contract.status))
      || (filter.value === 'effective' && contract && isEffective(contract.status))
    if (!matchesFilter) return false
    if (!needle) return true
    return [item.quote.customerName, item.quote.propertyName, item.quote.no, item.quote.title]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle))
  })
})

const filterCounts = computed<Record<QueueFilter, number>>(() => {
  const counts: Record<QueueFilter, number> = { all: items.value.length, toCreate: 0, waitingConfirm: 0, effective: 0 }
  for (const item of items.value) {
    if (!item.contract) counts.toCreate += 1
    else if (CONFIRM_STATUSES.includes(item.contract.status)) counts.waitingConfirm += 1
    else if (isEffective(item.contract.status)) counts.effective += 1
  }
  return counts
})

/** 阶段轨道：报价确认 → 合同发起 → 企业签约 → 生效 → 项目，全部来自真实对象投影（规范：StateJourney 不得前端自造状态机）。 */
const stages = computed(() => {
  const quote = selectedItem.value?.quote
  const contract = selectedContract.value
  if (!quote) return []
  const signed = Boolean(contract && isSigned(contract.status))
  const effective = Boolean(contract && isEffective(contract.status))
  const projectCreated = Boolean(contract?.projectId)
  return [
    { label: '报价已确认', done: true, detail: `${quote.no} · 客户已接受` },
    { label: '合同已发起', done: Boolean(contract), detail: contract?.no || '待设计师发起' },
    { label: '企业确认签约', done: signed, detail: signed ? (contract?.signedAt ? formatDateTime(contract.signedAt) : '已签署') : '企业负责人 / 店长确认' },
    { label: '企业确认生效', done: effective, detail: effective ? (contract?.effectiveAt ? formatDateTime(contract.effectiveAt) : '已生效') : '生效后才建立项目' },
    { label: '项目已建立', done: projectCreated, detail: projectCreated ? '已进入项目主链' : '待合同生效' }
  ]
})

const currentStage = computed(() => stages.value.find((stage) => !stage.done)?.label ?? '项目已建立')

/** 唯一主行动：设计师只拥有「发起合同」；确认签约/生效是服务端 nextAction（企业负责人/店长），设计师页只读展示，不生成可执行按钮。 */
const mainAction = computed<{ key: 'create' | 'waiting' | 'project' | 'review'; label: string; hint: string; disabled: boolean; ownerRole?: string } | null>(() => {
  const item = selectedItem.value
  if (!item) return null
  if (item.contractLoading) return null
  if (item.contractError) {
    return { key: 'review', label: '合同状态暂不可确认', hint: '合同读取失败，请刷新后重试；不会用旧数据伪装状态。', disabled: true }
  }
  const contract = item.contract
  if (!contract) {
    return {
      key: 'create',
      label: '发起合同',
      hint: '从客户已确认报价生成待签约合同（PendingSign），由企业负责人或店长复核确认签约。',
      disabled: false
    }
  }
  const next = contract.businessStateView?.nextAction
  if (contract.status === 'pendingSign') {
    return {
      key: 'waiting',
      label: '待企业确认签约',
      hint: `设计师不携带签署价格直接完成签约。${next?.ownerRole ? `由${next.ownerRole}复核后确认签约。` : '等待企业负责人 / 店长处理。'}`,
      disabled: true,
      ownerRole: next?.ownerRole || '企业负责人 / 店长'
    }
  }
  if (contract.status === 'signed') {
    return {
      key: 'waiting',
      label: '待企业确认生效',
      hint: `合同已签署，${next?.ownerRole ? `由${next.ownerRole}` : '由企业负责人 / 店长'}确认生效后生成唯一项目。`,
      disabled: true,
      ownerRole: next?.ownerRole || '企业负责人 / 店长'
    }
  }
  if (isEffective(contract.status) && contract.projectId) {
    return { key: 'project', label: '查看项目', hint: '合同已生效，可进入项目履约、收款和变更。', disabled: false }
  }
  if (isEffective(contract.status)) {
    return { key: 'waiting', label: '合同已生效待项目建立', hint: '合同已生效但项目尚未建立，请稍后刷新；不会用空数据伪装完成。', disabled: true }
  }
  if (isTerminated(contract.status) || contract.status === 'closed' || contract.status === 'void') {
    return { key: 'review', label: '合同已关闭或终止', hint: '终态合同只保留历史查看。', disabled: true }
  }
  return {
    key: 'review',
    label: '合同草稿待确认',
    hint: '合同处于草稿状态，等待企业负责人 / 店长确认。',
    disabled: true,
    ownerRole: '企业负责人 / 店长'
  }
})

const nextOwnerLabel = computed(() => {
  const item = selectedItem.value
  if (!item) return '待业务确认'
  if (item.contractError || item.contractLoading) return '待业务确认'
  const contract = item.contract
  if (!contract) return '企业负责人 / 店长（确认签约）'
  if (CONFIRM_STATUSES.includes(contract.status)) {
    return contract.businessStateView?.nextAction?.ownerRole || '企业负责人 / 店长'
  }
  if (isEffective(contract.status)) return '项目经理 / 财务'
  return '财务 / 企业负责人'
})

const currentQueueIndex = computed(() => filteredItems.value.findIndex((item) => item.quote.id === selectedKey.value))
const nextItem = computed(() => filteredItems.value.find((item) => item.quote.id !== selectedKey.value) ?? null)

/** 把对象锚点写回路由：刷新/返回/深链接可恢复（注册 contextKeys: customerId/activePropertyId/quoteId/contractId）。 */
function syncQuery(): void {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(route.query)) {
    if (typeof value === 'string') query[key] = value
  }
  if (selectedKey.value) query.quoteId = selectedKey.value
  else delete query.quoteId
  const item = selectedItem.value
  if (item) {
    query.customerId = String(item.quote.customerId ?? '')
    if (item.quote.propertyId) query.activePropertyId = String(item.quote.propertyId)
    else delete query.activePropertyId
    query.contractId = item.contract?.id ? String(item.contract.id) : ''
  } else {
    delete query.customerId
    delete query.activePropertyId
    delete query.contractId
  }
  void router.replace({ query })
}

/** 切换筛选/搜索时，中栏与右栏跟随新的可见队列（规范 §11.2）。 */
watch([filter, keyword], () => {
  const list = filteredItems.value
  if (!list.length) {
    if (!selectedKey.value) return
    selectedKey.value = ''
    syncQuery()
    void loadCustomerContext(null)
    return
  }
  if (list.some((item) => item.quote.id === selectedKey.value)) return
  selectedKey.value = list[0]?.quote.id ?? ''
  actionError.value = ''
  syncQuery()
  void loadCustomerContext(selectedItem.value)
  void loadDealContext(selectedItem.value)
})

function selectItem(item: ContractQueueItem): void {
  selectedKey.value = item.quote.id
  actionError.value = ''
  syncQuery()
  void loadCustomerContext(item)
}

/** 中栏客户背景：客户事实、跟进与诉求（复用现有 Provider，不新开 API）。 */
async function loadCustomerContext(item: ContractQueueItem | null): Promise<void> {
  if (!item || !item.quote.customerId) {
    customer.value = null
    follows.value = []
    requirements.value = []
    contextError.value = ''
    return
  }
  contextLoading.value = true
  contextError.value = ''
  const customerId = String(item.quote.customerId)
  const propertyId = item.quote.propertyId ? String(item.quote.propertyId) : undefined
  const [customerResult, followResult, requirementResult] = await Promise.allSettled([
    crmApi.customerInfo(customerId),
    crmApi.customerFollows(customerId),
    designApi.listRequirements(customerId, propertyId)
  ])
  customer.value = customerResult.status === 'fulfilled' ? customerResult.value : null
  follows.value = followResult.status === 'fulfilled' ? followResult.value : []
  requirements.value = requirementResult.status === 'fulfilled' ? requirementResult.value : []
  if (customerResult.status === 'rejected' || followResult.status === 'rejected' || requirementResult.status === 'rejected') {
    contextError.value = '部分数据暂不可确认（客户资料 / 跟进 / 诉求），可刷新重试'
  }
  contextLoading.value = false
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const quotes = await quoteDesignerPage({ size: 200 })
    const queue = quotes.filter((quote) => quote.status === 'accepted' || quote.status === 'converted')
    const contractResults = await Promise.allSettled(queue.map((quote) => contractApi.contractByQuote(quote.id)))
    items.value = queue.map((quote, index) => {
      const result = contractResults[index]
      return {
        quote,
        contract: result.status === 'fulfilled' ? result.value : null,
        contractLoading: false,
        contractError: result.status === 'rejected'
      }
    })
    const requestedQuoteId = String(route.query.quoteId ?? '')
    const requested = items.value.find((item) => item.quote.id === requestedQuoteId)
    if (requested) {
      selectedKey.value = requested.quote.id
    } else if (!items.value.some((item) => item.quote.id === selectedKey.value)) {
      selectedKey.value = items.value[0]?.quote.id ?? ''
    }
  } catch (err) {
    items.value = []
    selectedKey.value = ''
    error.value = err instanceof Error ? err.message : '待我签约队列暂不可确认'
  } finally {
    loading.value = false
    syncQuery()
    void loadCustomerContext(selectedItem.value)
  }
}

function openCustomer360(item: ContractQueueItem): void {
  if (!item.quote.customerId) return
  void router.push(`/designer/my-customers/${item.quote.customerId}`)
}

function openQuote(item: ContractQueueItem): void {
  void router.push(`/designer/quotes/${item.quote.id}`)
}

function handleMainAction(): void {
  const item = selectedItem.value
  const action = mainAction.value
  if (!item || !action || action.disabled) return
  if (action.key === 'create') {
    createForm.startDate = ''
    createForm.planEndDate = ''
    createForm.paymentTerms = ''
    createForm.remark = ''
    actionError.value = ''
    createOpen.value = true
    return
  }
  if (action.key === 'project') {
    void router.push('/designer/projects')
  }
}

function resetCreateForm(): void {
  createForm.startDate = ''
  createForm.planEndDate = ''
  createForm.paymentTerms = ''
  createForm.remark = ''
}

async function saveCreateContract(): Promise<void> {
  const item = selectedItem.value
  if (!item) return
  saving.value = true
  actionError.value = ''
  try {
    await contractApi.saveContract({
      quoteId: item.quote.id,
      startDate: createForm.startDate || undefined,
      planEndDate: createForm.planEndDate || undefined,
      paymentTerms: createForm.paymentTerms || undefined,
      remark: createForm.remark || undefined
    })
    createOpen.value = false
    resetCreateForm()
    await load()
    ElMessage.success('合同已发起，待企业负责人或店长确认签约')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '合同发起失败'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="cq">
    <header class="cq__head">
      <div>
        <p class="cq__eyebrow">方案报价 · 待我签约</p>
        <h1>待我签约</h1>
        <p>把客户已确认的报价接住：设计师只负责发起合同，签约与生效由企业负责人或店长确认；生效后才建立唯一项目，不越权不绕过。</p>
      </div>
      <div class="cq__head-meta">
        <span>{{ filter === 'all' ? `${filteredItems.length} 个当前任务` : `${filteredItems.length} 个筛选结果` }}</span>
        <button type="button" :class="{ 'is-loading': loading }" @click="load">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.3M21 3v6h-6" /></svg>
          刷新
        </button>
      </div>
    </header>

    <section class="cq__tools" aria-label="待我签约筛选">
      <label class="cq__search">
        <span>搜索</span>
        <input v-model="keyword" type="search" placeholder="客户、房屋或报价编号" />
      </label>
      <div class="cq__filters">
        <button v-for="item in FILTERS" :key="item.key" type="button" :class="{ active: filter === item.key }" @click="filter = item.key">
          {{ item.label }}
          <small>{{ filterCounts[item.key] }}</small>
        </button>
      </div>
    </section>

    <el-alert v-if="actionError" type="error" :closable="false" :title="actionError" show-icon />

    <WorkbenchState
      v-if="error && !items.length"
      variant="error"
      title="待我签约队列暂不可确认"
      :description="error"
      action-text="重新加载"
      min-height="300px"
      @action="load"
    />

    <div v-else-if="loading && !items.length" class="cq__skeleton" aria-busy="true">
      <span v-for="n in 6" :key="n" />
    </div>

    <div v-else class="cq__layout">
      <aside class="cq__queue">
        <header class="cq__queue-head">
          <div>
            <strong>待签约报价</strong>
            <small>客户已确认报价为主线，合同状态作为接棒线索</small>
          </div>
          <span>{{ filteredItems.length }}</span>
        </header>
        <WorkbenchState
          v-if="!filteredItems.length"
          title="当前没有符合条件的签约任务"
          description="切换筛选或清空搜索；真实没有任务时，不会用历史报价填充队列。"
          action-text="刷新"
          min-height="220px"
          @action="load"
        />
        <div v-else class="cq__task-list">
          <button
            v-for="item in filteredItems"
            :key="item.quote.id"
            type="button"
            class="cq__task"
            :class="{ active: item.quote.id === selectedKey }"
            @click="selectItem(item)"
          >
            <span class="cq__task-top">
              <span class="cq__task-title">
                <strong>{{ item.quote.customerName || item.quote.title || '客户待完善' }}</strong>
                <small>{{ item.quote.propertyName || '房屋待完善' }}</small>
              </span>
              <BusinessStateTag v-if="item.contract" object-key="contract" :status-key="item.contract.status" :dot="false" />
              <StatusTag v-else tone="pending" text="待发起合同" :dot="false" />
            </span>
            <span class="cq__task-meta">{{ item.quote.no }} · V{{ item.quote.version }} · <MoneyText :value="item.quote.amount" /></span>
            <span class="cq__task-reason">{{ itemReason(item) }}</span>
            <span class="cq__task-foot">
              <span><small>客户</small><strong>{{ item.quote.customerName || '客户待完善' }}</strong></span>
              <small v-if="item.contractError" class="cq__task-warn">合同状态暂不可确认</small>
              <small v-else-if="!item.contract">未发起合同</small>
              <small v-else-if="item.contract.projectId">已立项</small>
            </span>
          </button>
        </div>
      </aside>

      <main class="cq__workspace">
        <template v-if="selectedItem">
          <!-- 唯一 Hero：客户为基准形态；本合同信息以「标题行追加」进入 -->
          <CustomerHeroCard
            :customer="heroCustomer"
            portrait-title="客户画像"
            portrait-hint="签约前确认客户最新态度、画像与顾虑"
          >
            <template #title-prefix>
              <span class="cq__hero-object">{{ selectedContract?.no || '合同待发起' }}</span>
              <span v-if="selectedItem.quote.no" class="cq__hero-object-detail">「报价 {{ selectedItem.quote.no }} · V{{ selectedItem.quote.version }}」</span>
            </template>
            <template #title-extra>
              <span class="cq__hero-sep">·</span>
              <BusinessStateTag v-if="selectedContract" object-key="contract" :status-key="selectedContract.status" :dot="false" />
              <StatusTag v-else tone="pending" text="待发起合同" :dot="false" />
            </template>
            <template #focus>
              <HeroFocusItem label="合同阶段" :value="currentStage" :note="itemReason(selectedItem)" :tone="itemTone(selectedItem)" />
              <HeroFocusItem
                label="合同金额"
                :value="moneyText(selectedContract?.currentAmount ?? selectedItem.quote.amount)"
                :note="selectedContract ? '当前合同金额' : '报价金额（客户已接受）'"
                tone="info"
              />
              <HeroFocusItem
                label="签约进度"
                :value="selectedContract ? (selectedContract.signedAt ? '已签约' : selectedContract.status === 'signed' ? '已签署待生效' : '待企业确认') : '未发起'"
                :note="selectedContract?.effectiveAt ? `生效 ${formatDateTime(selectedContract.effectiveAt)}` : '生效后才建立唯一项目'"
              />
            </template>
            <template #portrait-action>
              <button class="cq__text-button" type="button" @click="openCustomer360(selectedItem)">完整档案</button>
            </template>
          </CustomerHeroCard>

          <section v-if="selectedContract" class="cq__evidence">
            <div>
              <p class="cq__section-label">合同事实</p>
              <p>金额、签署与生效时间来自服务端合同投影；设计师只读，不修改签约结果。</p>
            </div>
            <dl>
              <div><dt>当前金额</dt><dd><MoneyText :value="selectedContract.currentAmount" /></dd></div>
              <div><dt>签署时间</dt><dd>{{ formatDateTime(selectedContract.signedAt) || '未签署' }}</dd></div>
              <div><dt>生效时间</dt><dd>{{ formatDateTime(selectedContract.effectiveAt) || '未生效' }}</dd></div>
              <div><dt>付款条款</dt><dd>{{ selectedContract.paymentTerms || '待补充' }}</dd></div>
              <div><dt>计划工期</dt><dd>{{ selectedContract.startDate || '—' }} 至 {{ selectedContract.planEndDate || '—' }}</dd></div>
            </dl>
          </section>

          <section class="cq__stage-block">
            <header class="cq__stage-head">
              <div><strong>报价与方案信息</strong><small>合同来自已接受报价；金额与版本以服务端为准</small></div>
            </header>
            <dl class="cq__stage-grid">
              <div><dt>报价编号</dt><dd>{{ selectedItem.quote.no }}</dd></div>
              <div><dt>报价版本</dt><dd>V{{ selectedItem.quote.version }}</dd></div>
              <div><dt>报价金额</dt><dd><MoneyText :value="selectedItem.quote.amount" /></dd></div>
              <div><dt>报价时间</dt><dd>{{ formatDateTime(selectedItem.quote.createdAt) || '待确认' }}</dd></div>
              <div><dt>合同编号</dt><dd>{{ selectedContract?.no || '未发起' }}</dd></div>
              <div><dt>设计来源</dt><dd>{{ selectedItem.quote.designName || '未关联方案' }}</dd></div>
            </dl>
          </section>

          <section class="cq__stage-block">
            <header class="cq__stage-head">
              <div><strong>签约资料</strong><small>签约前与客户对齐的方案、报价与谈单材料</small></div>
            </header>

            <div class="cq__talk-row">
              <div class="cq__talk-meta">
                <strong>方案信息</strong>
                <small v-if="scheme">{{ scheme.name || '待命名' }} · V{{ scheme.version }} · {{ scheme.spaceCount }} 个空间 · {{ scheme.itemCount }} 个设计项</small>
                <small v-else>当前报价未关联设计方案</small>
              </div>
            </div>

            <div class="cq__talk-row">
              <div class="cq__talk-meta">
                <strong>谈单 PPT</strong>
                <small v-if="latestTalk">
                  V{{ latestTalk.version }} · {{ TALK_STATUS_LABELS[latestTalk.status] || latestTalk.status }}
                  <template v-if="latestTalk.builtAt"> · 生成 {{ formatDateTime(latestTalk.builtAt) }}</template>
                </small>
                <small v-else>还没有谈单 PPT；签约前建议生成并留档</small>
              </div>
              <div class="cq__talk-actions">
                <button type="button" class="cq__text-button" :disabled="talkBusy || !selectedItem.quote.designId" @click="buildTalkPpt">
                  {{ talkBusy ? '生成中…' : (latestTalk ? '重新生成' : '生成谈单 PPT') }}
                </button>
                <button v-if="latestTalk?.outputUrl" type="button" class="cq__text-button" @click="openArchive(latestTalk.outputUrl)">打开 PPT</button>
              </div>
            </div>

            <div class="cq__talk-row">
              <div class="cq__talk-meta">
                <strong>报价 PDF</strong>
                <small v-if="quotePdf">{{ quotePdf.businessNo || selectedItem.quote.no }} · {{ formatDateTime(quotePdf.generatedAt) || '已归档' }}</small>
                <small v-else>还没有报价 PDF</small>
              </div>
              <div class="cq__talk-actions">
                <button type="button" class="cq__text-button" :disabled="pdfBusy" @click="buildPdf('quote')">{{ quotePdf ? '重新生成' : '生成报价 PDF' }}</button>
                <button v-if="quotePdf?.url" type="button" class="cq__text-button" @click="openArchive(quotePdf.url)">打开 PDF</button>
              </div>
            </div>

            <div class="cq__talk-row">
              <div class="cq__talk-meta">
                <strong>合同 PDF</strong>
                <small v-if="contractPdf">{{ contractPdf.businessNo || selectedContract?.no }} · {{ formatDateTime(contractPdf.generatedAt) || '已归档' }}</small>
                <small v-else-if="!selectedContract">合同尚未发起</small>
                <small v-else>还没有合同 PDF；生效前生成正式文本</small>
              </div>
              <div class="cq__talk-actions">
                <button type="button" class="cq__text-button" :disabled="pdfBusy || !selectedContract" @click="buildPdf('contract')">{{ contractPdf ? '重新生成' : '生成合同 PDF' }}</button>
                <button v-if="contractPdf?.url" type="button" class="cq__text-button" @click="openArchive(contractPdf.url)">打开 PDF</button>
              </div>
            </div>

            <p v-if="talkError || pdfError" class="cq__talk-error">{{ talkError || pdfError }}</p>
          </section>

          <CustomerContextPanels
            :requirements="requirements"
            :follows="follows"
            emphasis="primary"
            :can-record-follow="false"
            @record-requirement="requirementOpen = true"
          />
        </template>

        <WorkbenchState
          v-else
          title="请选择一个签约报价"
          description="左侧队列已绑定客户、房屋与报价；选择后再发起合同或查看合同进度。"
          min-height="300px"
        />
      </main>

      <aside class="cq__guide">
        <template v-if="selectedItem">
          <section class="cq__guide-card cq__guide-card--primary">
            <div class="cq__guide-title-row">
              <div>
                <p class="cq__eyebrow">本次签约</p>
                <h3>{{ mainAction?.label || '待业务确认' }}</h3>
              </div>
              <span class="cq__guide-order">{{ currentQueueIndex >= 0 ? `${currentQueueIndex + 1}/${filteredItems.length}` : '已完成' }}</span>
            </div>
            <p class="cq__guide-reason">{{ mainAction?.hint || itemReason(selectedItem) }}</p>
            <div class="cq__guide-inline"><span>下一接棒</span><b>{{ nextOwnerLabel }}</b></div>
            <button
              type="button"
              class="cq__primary"
              :class="{ 'is-blocked': mainAction?.disabled }"
              :disabled="saving || !mainAction || mainAction.disabled"
              @click="handleMainAction"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" /><path d="M8 6h8M8 11h8M8 16h5" /></svg>
              {{ mainAction?.label || '暂不可执行' }}
            </button>
            <p class="cq__guide-note">{{ mainAction?.disabled ? mainAction.hint : '发起成功后系统会重新读取合同、报价、项目与客户事实。' }}</p>
            <div v-if="nextItem" class="cq__next-inline">
              <span>下一项</span>
              <button type="button" @click="selectItem(nextItem)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                查看下一项
              </button>
            </div>
          </section>

          <section class="cq__guide-card">
            <header class="cq__actions-head"><div><h4>其他合法动作</h4><small>在当前页面完成，不需要再搜索同一个报价</small></div></header>
            <div class="cq__action-grid">
              <WorkbenchQuickAction tone="outline" title="完整档案" hint="查看客户历史与低频资料" @click="openCustomer360(selectedItem)">
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h5M8 16h8" /></svg></template>
              </WorkbenchQuickAction>
              <WorkbenchQuickAction tone="measure" title="报价详情" hint="核对签约依据的报价与版本" @click="openQuote(selectedItem)">
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></svg></template>
              </WorkbenchQuickAction>
              <WorkbenchQuickAction tone="outline" title="刷新数据" hint="重新读取报价与合同事实" @click="load">
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.3M21 3v6h-6" /></svg></template>
              </WorkbenchQuickAction>
            </div>
            <p class="cq__guide-note">合同签署或生效后，系统会重新读取合同、报价与项目；读取不全时显示"部分数据暂不可确认"。</p>
          </section>
        </template>

        <WorkbenchState
          v-else
          title="等待选择签约报价"
          description="右侧会显示当前状态、唯一主行动、接棒人、完成回读与下一项。"
          min-height="280px"
        />
      </aside>
    </div>

    <el-drawer v-model="createOpen" title="发起合同" size="560px" direction="rtl" append-to-body>
      <CustomerPropertyContext
        :customer="selectedItem ? { name: selectedItem.quote.customerName || '客户待确认' } : null"
        :property="selectedItem?.quote.propertyName ? { community: selectedItem.quote.propertyName } : null"
      />
      <p class="cq__section-label">发起合同</p>
      <p class="cq__drawer-hint">发起后生成待签约合同（PendingSign），由企业负责人或店长复核确认签约；发起阶段不携带签署价格，也不建立项目。</p>
      <el-form label-position="top" class="cq__form-grid">
        <el-form-item label="计划开工日期"><el-date-picker v-model="createForm.startDate" type="date" value-format="YYYY-MM-DD" placeholder="选填" style="width: 100%" /></el-form-item>
        <el-form-item label="计划完工日期"><el-date-picker v-model="createForm.planEndDate" type="date" value-format="YYYY-MM-DD" placeholder="选填" style="width: 100%" /></el-form-item>
        <el-form-item label="付款说明" class="cq__form-wide"><el-input v-model="createForm.paymentTerms" type="textarea" :rows="2" maxlength="200" show-word-limit placeholder="如：首期 60%，开工 30%，验收 10%" /></el-form-item>
        <el-form-item label="备注" class="cq__form-wide"><el-input v-model="createForm.remark" type="textarea" :rows="3" maxlength="300" show-word-limit placeholder="选填，写给企业负责人 / 店长复核时参考" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveCreateContract">发起合同</el-button>
      </template>
    </el-drawer>

    <RequirementFormDrawer
      v-model="requirementOpen"
      :customer-id="selectedItem ? String(selectedItem.quote.customerId ?? '') : ''"
      :customer-name="selectedItem?.quote.customerName || ''"
      :property-id="selectedItem?.quote.propertyId ? String(selectedItem.quote.propertyId) : ''"
      :property-name="selectedItem?.quote.propertyName || ''"
      @saved="loadCustomerContext(selectedItem)"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/workbench-shell' as wb;
.cq { display: flex; flex-direction: column; gap: $space-5; min-width: 0; }

.cq__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: $space-5;
  h1 { margin: 0; font-size: $font-display; letter-spacing: -.02em; }
  p { max-width: 820px; margin: $space-2 0 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
}

.cq__eyebrow,
.cq__section-label { color: $brand-600 !important; font-size: $font-caption !important; font-weight: $font-weight-semibold; letter-spacing: .09em; }
.cq__drawer-hint { margin: 6px 0 14px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
.cq__head-meta { display: flex; align-items: center; gap: $space-3; color: $text-secondary; font-size: $font-caption; }
.cq__head-meta button,
.cq__secondary-actions button {
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
.cq__head-meta button:hover,
.cq__secondary-actions button:hover { color: $brand-600; border-color: $brand-300; background: $brand-50; }
.cq__head-meta svg { width: 14px; height: 14px; }
.cq__head-meta .is-loading svg { animation: cq-spin .7s linear infinite; }
@keyframes cq-spin { to { transform: rotate(360deg); } }

.cq__tools {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: $space-4;
  padding: $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
}
.cq__search { display: flex; flex-direction: column; gap: 6px; min-width: 280px; color: $text-secondary; font-size: $font-caption; }
.cq__search input { height: 36px; padding: 0 10px; border: 1px solid $border-color; border-radius: $radius-sm; color: $text-primary; background: $surface-0; font: inherit; }
.cq__filters { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.cq__filters button { padding: 7px 11px; border: 1px solid $border-color; border-radius: $radius-pill; background: $surface-0; color: $text-secondary; font: inherit; font-size: $font-caption; cursor: pointer; }
.cq__filters button.active { border-color: $brand-300; background: $brand-50; color: $brand-700; }
.cq__filters small { color: $text-tertiary; font-variant-numeric: tabular-nums; }

.cq__layout { @include wb.workbench-layout(327px); }
.cq__queue { @include wb.workbench-queue; }
.cq__queue-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid $border-color; background: linear-gradient(135deg, $surface-50, $surface-0); }
.cq__queue-head div { display: flex; flex-direction: column; gap: 3px; }
.cq__queue-head strong { color: $text-primary; font-size: $font-body; }
.cq__queue-head small { color: $text-tertiary; font-size: $font-caption; }
.cq__queue-head > span { color: $brand-700; font-size: $font-title; font-weight: $font-weight-bold; }
.cq__task-list { display: flex; flex-direction: column; @include wb.workbench-queue-scroll; }
.cq__task {
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
.cq__task:last-child { border-bottom: 0; }
.cq__task:hover { background: $surface-50; }
.cq__task.active { background: $brand-50; box-shadow: inset 3px 0 0 $brand-500; }
.cq__task-top,
.cq__task-foot { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.cq__task-top { align-items: flex-start; }
.cq__task-title { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.cq__task-title strong { overflow: hidden; color: $text-primary; font-size: $font-body; text-overflow: ellipsis; white-space: nowrap; }
.cq__task-title small { overflow: hidden; color: $text-secondary; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; }
.cq__task-meta { overflow: hidden; color: $text-secondary; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; }
.cq__task-reason { overflow: hidden; color: $brand-700; font-size: $font-caption; font-weight: $font-weight-semibold; text-overflow: ellipsis; white-space: nowrap; }
.cq__task-foot { padding-top: 7px; border-top: 1px dashed $border-color; }
.cq__task-foot > span { display: flex; align-items: baseline; gap: 5px; min-width: 0; }
.cq__task-foot small { flex: 0 0 auto; color: $text-tertiary; font-size: $font-caption; }
.cq__task-foot strong { overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
.cq__task-warn { color: $warning-700 !important; }

.cq__workspace { @include wb.workbench-workspace; }
.cq__guide { @include wb.workbench-guide; }
.cq__guide-card { padding: 14px; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.cq__guide-card--primary { border-color: $brand-200; background: linear-gradient(135deg, $surface-0, $brand-50); }
.cq__guide-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; }
.cq__guide-title-row h3 { margin: 4px 0 0; color: $text-primary; font-size: $font-body; }
.cq__guide-order { padding: 3px 8px; border-radius: $radius-pill; background: $surface-100; color: $text-tertiary; font-size: $font-caption; }
.cq__guide-reason { display: -webkit-box; overflow: hidden; margin: 10px 0 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.cq__guide-inline { display: flex; align-items: center; gap: 6px; margin-top: 8px; padding: 7px 9px; border-radius: $radius-sm; background: $surface-50; }
.cq__guide-inline span { color: $text-tertiary; font-size: $font-caption; }
.cq__guide-inline b { color: $brand-700; font-size: $font-body-sm; }
.cq__guide-card h4 { margin: 0 0 8px; color: $text-primary; font-size: $font-body; }
.cq__guide-card p { margin: 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
.cq__guide-note { margin: 8px 0 0 !important; color: $text-tertiary !important; font-size: $font-caption !important; line-height: 1.5 !important; }
.cq__next-inline { display: flex; align-items: center; justify-content: space-between; gap: $space-2; margin-top: 10px; padding-top: 9px; border-top: 1px solid $border-color; }
.cq__next-inline span { color: $text-tertiary; font-size: $font-caption; }
.cq__next-inline button { display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: transparent; color: $brand-700; font: inherit; font-size: $font-caption; font-weight: $font-weight-semibold; cursor: pointer; }
.cq__hero-card { padding: 12px; border: 1px solid $border-color; border-radius: $radius-lg; background: linear-gradient(135deg, $brand-50, $surface-0 70%); }
.cq__hero-top { display: flex; align-items: flex-start; gap: $space-3; }
.cq__hero-avatar { width: 46px; height: 46px; flex: 0 0 auto; display: grid; place-items: center; border-radius: $radius-md; background: $brand-600; color: $surface-0; }
.cq__hero-avatar svg { width: 24px; height: 24px; }
.cq__hero-ident { flex: 1; min-width: 0; }
.cq__hero-name-row { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; }
.cq__hero-name-row h2 { margin: 0; color: $text-primary; font-size: $font-title; }
.cq__hero-contact { margin: 5px 0 0; color: $text-secondary; font-size: $font-body-sm; }
.cq__hero-layer--focus { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-top: 10px; }
.cq__hero-layer--background { margin-top: 10px; }
.cq__focus-item { min-width: 0; padding: 8px 10px; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; }
.cq__focus-item small { display: block; color: $text-tertiary; font-size: $font-caption; }
.cq__focus-item b { display: block; margin-top: 2px; overflow: hidden; color: $text-primary; font-size: $font-body-sm; font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }
.cq__focus-item span { display: -webkit-box; overflow: hidden; margin-top: 2px; color: $text-secondary; font-size: $font-caption; line-height: 1.5; -webkit-box-orient: vertical; -webkit-line-clamp: 1; }
.cq__focus-item--blocked { border-color: $status-blocked-border; background: $status-blocked-soft; }
.cq__focus-item--blocked b { color: $status-blocked; }
.cq__focus-item--pending { border-color: $status-pending-border; background: $status-pending-soft; }
.cq__focus-item--pending b { color: $status-pending; }
.cq__focus-item--info { border-color: $status-info-border; background: $status-info-soft; }
.cq__focus-item--info b { color: $status-info; }
.cq__focus-item--done { border-color: $status-done-border; background: $status-done-soft; }
.cq__focus-item--done b { color: $status-done; }
.cq__focus-item--dark { border-color: $status-dark-border; background: $status-dark-soft; }
.cq__focus-item--dark b { color: $status-dark; }
.cq__facts { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
.cq__facts article { min-width: 0; padding: 7px 9px; border-radius: $radius-sm; background: rgba(255, 255, 255, .72); }
.cq__facts small { display: block; color: $text-tertiary; font-size: $font-caption; }
.cq__facts b { display: block; margin-top: 3px; overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
.cq__primary { display: inline-flex; align-items: center; justify-content: center; gap: 6px; width: 100%; min-width: 140px; margin-top: 10px; padding: 11px 18px; border: 0; border-radius: $radius-sm; background: $brand-600; color: $surface-0; font: inherit; font-weight: $font-weight-semibold; cursor: pointer; }
.cq__primary svg { width: 16px; height: 16px; }
.cq__primary.is-blocked { background: $warning-500; }
.cq__primary.is-blocked:hover { background: $warning-700; }
.cq__primary:hover { background: $brand-700; }
.cq__primary:disabled { background: $line-200; color: $text-tertiary; cursor: not-allowed; }
.cq__secondary-actions { display: flex; flex-wrap: wrap; gap: $space-2; margin-top: 10px; }
.cq__secondary-actions button svg,
.cq__next-inline button svg { width: 14px; height: 14px; }
.cq__evidence { display: flex; align-items: center; justify-content: space-between; gap: $space-4; padding: 18px 20px; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.cq__evidence p { margin: 5px 0 0; color: $text-secondary; font-size: $font-body-sm; }
.cq__evidence dl { display: flex; flex-wrap: wrap; gap: $space-5; margin: 0; }
.cq__evidence dt { color: $text-tertiary; font-size: $font-caption; }
.cq__evidence dd { margin: 4px 0 0; color: $text-primary; font-size: $font-body-sm; font-weight: $font-weight-semibold; }

.cq__actions-head { margin-bottom: 8px; }
.cq__actions-head h4 { margin: 0; color: $text-primary; font-size: $font-body; }
.cq__actions-head small { display: block; margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }
.cq__action-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.cq__guide-note { margin: 8px 0 0; color: $text-tertiary; font-size: $font-caption; line-height: 1.5; }
.cq__talk-row { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; padding: 10px 12px; border-radius: $radius-md; background: $surface-50; }
.cq__talk-meta strong { color: $text-primary; font-size: $font-body-sm; }
.cq__talk-meta small { display: block; margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }
.cq__talk-actions { display: flex; flex-wrap: wrap; gap: $space-3; flex: 0 0 auto; }
.cq__talk-error { margin: 0; color: $danger-500; font-size: $font-caption; }

.cq__hero-object { color: $text-primary; font-size: $font-h1; font-weight: $font-weight-bold; letter-spacing: -.01em; }
.cq__hero-object-detail { color: $text-secondary; font-size: $font-h1; font-weight: $font-weight-semibold; }
.cq__hero-sep { color: $text-tertiary; font-size: $font-body-sm; }
.cq__text-button { padding: 0; border: 0; background: transparent; color: $brand-600; font: inherit; font-size: $font-caption; font-weight: $font-weight-semibold; cursor: pointer; }
.cq__stage-block { display: flex; flex-direction: column; gap: $space-3; padding: $space-4; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.cq__stage-head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; }
.cq__stage-head strong { color: $text-primary; font-size: $font-body; }
.cq__stage-head small { display: block; margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }
.cq__stage-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: $space-3; margin: 0; }
.cq__stage-grid > div { min-width: 0; padding: 10px 12px; border-radius: $radius-md; background: $surface-50; }
.cq__stage-grid dt { color: $text-tertiary; font-size: $font-caption; }
.cq__stage-grid dd { margin: 4px 0 0; overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; }
.cq__customer { display: flex; flex-direction: column; gap: $space-3; padding: $space-4; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.cq__customer-head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; }
.cq__customer-head strong { color: $text-primary; font-size: $font-body; }
.cq__customer-head small { display: block; margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }
.cq__customer-head button,
.cq__customer-action { display: inline-flex; align-items: center; gap: 5px; flex: 0 0 auto; padding: 6px 10px; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; color: $brand-600; font: inherit; font-size: $font-caption; cursor: pointer; }
.cq__customer-head button:hover,
.cq__customer-action:hover { border-color: $brand-300; background: $brand-50; }
.cq__customer-head button svg,
.cq__customer-action svg { width: 13px; height: 13px; flex: 0 0 auto; }
.cq__customer-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-3; }
.cq__customer-col { display: flex; flex-direction: column; gap: $space-2; min-width: 0; padding: 12px 13px; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-50; }
.cq__customer-actions { display: flex; flex-wrap: wrap; gap: 6px; flex: 0 0 auto; }
.cq__customer-actions button { display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; color: $text-secondary; font: inherit; font-size: $font-caption; cursor: pointer; }
.cq__customer-actions button:hover { border-color: $brand-300; background: $brand-50; color: $brand-600; }
.cq__customer-actions svg { width: 13px; height: 13px; }
.cq__customer-col h4 { margin: 0; color: $text-primary; font-size: $font-body-sm; }
.cq__customer-col dl { display: grid; gap: 5px; margin: 0; }
.cq__customer-col dl div { display: flex; align-items: baseline; justify-content: space-between; gap: $space-2; }
.cq__customer-col dt { flex: 0 0 auto; color: $text-tertiary; font-size: $font-caption; }
.cq__customer-col dd { margin: 0; overflow: hidden; color: $text-primary; font-size: $font-caption; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
.cq__portrait-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.cq__portrait-chips > span { display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; border-radius: $radius-pill; background: $surface-0; color: $text-secondary; font-size: $font-caption; }
.cq__portrait-chips small { color: $text-tertiary; }
.cq__customer-empty { margin: 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.cq__follows,
.cq__requirements { display: flex; flex-direction: column; gap: $space-2; }
.cq__follow,
.cq__requirement { display: flex; flex-direction: column; gap: 3px; padding: 8px 10px; border-radius: $radius-sm; background: $surface-0; }
.cq__follow small { color: $text-tertiary; font-size: $font-caption; }
.cq__follow p,
.cq__requirement p { margin: 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.cq__follow em { color: $brand-700; font-size: $font-caption; font-style: normal; }
.cq__requirement > div { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.cq__requirement strong { overflow: hidden; color: $text-primary; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; }
.cq__requirement small { color: $text-tertiary; font-size: $font-caption; }
.cq__skeleton { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: $space-4; }
.cq__skeleton span { height: 170px; border-radius: $radius-md; background: linear-gradient(90deg, $surface-100 25%, $surface-50 37%, $surface-100 63%); background-size: 400% 100%; animation: cq-shimmer 1.4s ease infinite; }
@keyframes cq-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }

.cq__form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-3; }
.cq__form-wide { grid-column: 1 / -1; }

@media (max-width: 1280px) {
  .cq__hero-layer--focus { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .cq__facts { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 1024px) {
  .cq__tools,
  .cq__evidence { align-items: stretch; flex-direction: column; }
  .cq__hero-layer--focus { grid-template-columns: 1fr; }
  .cq__facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .cq__customer-grid { grid-template-columns: 1fr; }
  .cq__primary { width: 100%; }
}
</style>
