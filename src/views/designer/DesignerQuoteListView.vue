<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
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
import { formatDateTime } from '@/core/format'
import { quoteDesignerPage } from '@/domains/trade/api'
import type { Quote, QuoteStatus } from '@/domains/trade/model'
import { crmApi } from '@/domains/crm/api'
import type { Customer, CustomerFollow } from '@/domains/crm/model'
import { designApi } from '@/domains/design/api'
import type { DesignRequirement, DesignScheme, TalkPlan } from '@/domains/design/model'
import { documentApi } from '@/domains/document/api'
import type { DocumentArchive } from '@/domains/document/model'
import type { StatusTone } from '@/core/tone'

const router = useRouter()
const route = useRoute()

type QueueFilter = 'all' | 'draft' | 'submitted' | 'rejected' | 'handoff' | 'history'

const FILTERS: Array<{ key: QueueFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'draft', label: '草稿待完善' },
  { key: 'submitted', label: '待客户决策' },
  { key: 'rejected', label: '已驳回改版' },
  { key: 'handoff', label: '待交接 / 已转项目' },
  { key: 'history', label: '历史版本' }
]

/** 待我处理优先级：后端 DesignerWorkQueueContext 以 Rejected、Draft 入队，submitted 属等待客户决策。 */
const STATUS_RANK: Record<QuoteStatus, number> = {
  rejected: 0, draft: 1, submitted: 2, accepted: 3, converted: 4, superseded: 5
}

/** 报价动作策略：状态→主行动全部 pending_business_review（原注册表条款，现归档于《WEB-工作台契约条款》），未裁决前只展示不执行。 */
const PRIMARY_LABEL: Partial<Record<QuoteStatus, string>> = {
  draft: '继续编辑并提交',
  submitted: '等待客户决策',
  rejected: '修订后重报'
}

const quotes = ref<Quote[]>([])
const loading = ref(false)
const error = ref('')
const keyword = ref('')
const filter = ref<QueueFilter>('all')
const selectedKey = ref('')
const actionError = ref('')

const customer = ref<Customer | null>(null)
const follows = ref<CustomerFollow[]>([])
const requirements = ref<DesignRequirement[]>([])
const contextLoading = ref(false)
const contextError = ref('')

const selectedQuote = computed(() => quotes.value.find((quote) => quote.id === selectedKey.value) ?? null)

/** Hero 用客户对象：优先服务端客户档案，缺失时退到报价里的客户名。 */
const heroCustomer = computed<Partial<Customer> | null>(() => {
  if (customer.value) return customer.value
  const quote = selectedQuote.value
  return quote ? { name: quote.customerName ?? undefined } : null
})

/** 金额文本：给 HeroFocusItem 的 value 用。 */
function moneyText(value?: number | null): string {
  if (value === null || value === undefined) return '金额暂不可确认'
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const DESIGN_STATUS_LABELS: Record<string, string> = {
  draft: '设计中', ready: '待谈单', presented: '已讲解', selected: '已选定', archived: '已归档'
}
const TALK_STATUS_LABELS: Record<string, string> = {
  draft: '草稿', generated: '已生成', published: '已发布', archived: '已归档'
}

function openDesignWorkspace(quote: Quote): void {
  if (!quote.designId) return
  void router.push(`/designer/design/${quote.designId}`)
}

const requirementOpen = ref(false)

// ── 谈单资料：方案 / 谈单 PPT / 报价 PDF ──────────────────────
const scheme = ref<DesignScheme | null>(null)
const talks = ref<TalkPlan[]>([])
const talkBusy = ref(false)
const talkError = ref('')
const quotePdfBusy = ref(false)
const quotePdf = ref<DocumentArchive | null>(null)
const quotePdfError = ref('')

const latestTalk = computed(() => talks.value[0] ?? null)

/** 谈单上下文：方案 + 谈单 PPT + 报价 PDF（都来自既有 Provider，不新开 API）。 */
async function loadTalkContext(quote: Quote | null): Promise<void> {
  scheme.value = null
  talks.value = []
  quotePdf.value = null
  talkError.value = ''
  quotePdfError.value = ''
  if (!quote) return
  const tasks: Promise<unknown>[] = []
  if (quote.designId) {
    tasks.push(
      designApi.schemeInfo(quote.designId).then((result) => { scheme.value = result }).catch(() => { scheme.value = null }),
      designApi.listTalks(quote.designId).then((result) => { talks.value = result }).catch(() => { talks.value = [] })
    )
  }
  tasks.push(
    documentApi.quoteRecords(quote.id).then((records) => { quotePdf.value = records[0] ?? null }).catch(() => { quotePdf.value = null })
  )
  await Promise.allSettled(tasks)
}

/** 生成/重新生成谈单 PPT。 */
async function buildTalkPpt(): Promise<void> {
  const quote = selectedQuote.value
  if (!quote?.designId || talkBusy.value) return
  talkBusy.value = true
  talkError.value = ''
  try {
    const talk = await designApi.buildTalk(quote.designId, quote.id, latestTalk.value?.id)
    talks.value = [talk, ...talks.value.filter((item) => item.id !== talk.id)]
    ElMessage.success('谈单 PPT 已生成')
  } catch (err) {
    talkError.value = err instanceof Error ? err.message : '谈单 PPT 生成失败'
  } finally {
    talkBusy.value = false
  }
}

/** 生成报价 PDF（服务端渲染并归档）。 */
async function buildQuotePdf(): Promise<void> {
  const quote = selectedQuote.value
  if (!quote || quotePdfBusy.value) return
  quotePdfBusy.value = true
  quotePdfError.value = ''
  try {
    quotePdf.value = await documentApi.buildQuote(quote.id)
    ElMessage.success('报价 PDF 已生成')
  } catch (err) {
    quotePdfError.value = err instanceof Error ? err.message : '报价 PDF 生成失败'
  } finally {
    quotePdfBusy.value = false
  }
}

function openArchive(url?: string): void {
  if (!url) return
  window.open(url, '_blank', 'noopener')
}

function isHandoff(status: QuoteStatus): boolean {
  return status === 'accepted' || status === 'converted'
}

function stayDays(value?: string): number {
  if (!value) return 0
  const start = new Date(value.replace(' ', 'T')).getTime()
  if (Number.isNaN(start)) return 0
  return Math.max(0, Math.floor((Date.now() - start) / 86400000))
}

function quoteTone(status: QuoteStatus): StatusTone {
  if (status === 'rejected') return 'blocked'
  if (status === 'draft') return 'todo'
  if (status === 'submitted') return 'pending'
  if (status === 'accepted') return 'done'
  if (status === 'superseded') return 'closed'
  return 'dark'
}

/** 队列风险行：口径对齐后端 quoteRiskLevel（Draft≥7 高、Rejected≥1 警示、其余 normal）。 */
function itemReason(quote: Quote): string {
  const days = stayDays(quote.createdAt)
  if (quote.status === 'draft') return days >= 7 ? `草稿停留 ${days} 天，请尽快完善并提交` : `草稿停留 ${days} 天`
  if (quote.status === 'rejected') return days >= 1 ? `客户已驳回 ${days} 天，请修订后重报` : '客户已驳回，请修订后重报'
  if (quote.status === 'submitted') return `等待客户决策 ${days} 天`
  if (quote.status === 'accepted') return '客户已接受 · 待交接合同'
  if (quote.status === 'converted') return '已转项目 · 进入合同与项目主链'
  return '已被新版本替代 · 只读历史'
}

function itemRisk(quote: Quote): { tone: StatusTone; label: string } {
  if (quote.status === 'draft') return stayDays(quote.createdAt) >= 7 ? { tone: 'blocked', label: '停留超 7 天' } : { tone: 'done', label: '正常' }
  if (quote.status === 'rejected') return stayDays(quote.createdAt) >= 1 ? { tone: 'pending', label: '已驳回' } : { tone: 'done', label: '正常' }
  if (quote.status === 'submitted') return stayDays(quote.createdAt) >= 7 ? { tone: 'pending', label: '等待较久' } : { tone: 'done', label: '正常' }
  return { tone: 'done', label: '正常' }
}

const filteredQuotes = computed(() => {
  const needle = keyword.value.trim().toLowerCase()
  return quotes.value
    .filter((quote) => {
      const matchesFilter = filter.value === 'all'
        || (filter.value === 'draft' && quote.status === 'draft')
        || (filter.value === 'submitted' && quote.status === 'submitted')
        || (filter.value === 'rejected' && quote.status === 'rejected')
        || (filter.value === 'handoff' && isHandoff(quote.status))
        || (filter.value === 'history' && quote.status === 'superseded')
      if (!matchesFilter) return false
      if (!needle) return true
      return [quote.customerName, quote.propertyName, quote.no, quote.title, quote.id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    })
    .sort((left, right) => {
      const byStatus = STATUS_RANK[left.status] - STATUS_RANK[right.status]
      if (byStatus !== 0) return byStatus
      return String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? ''))
    })
})

const filterCounts = computed<Record<QueueFilter, number>>(() => {
  const counts: Record<QueueFilter, number> = { all: quotes.value.length, draft: 0, submitted: 0, rejected: 0, handoff: 0, history: 0 }
  for (const quote of quotes.value) {
    if (quote.status === 'draft') counts.draft += 1
    if (quote.status === 'submitted') counts.submitted += 1
    if (quote.status === 'rejected') counts.rejected += 1
    if (isHandoff(quote.status)) counts.handoff += 1
    if (quote.status === 'superseded') counts.history += 1
  }
  return counts
})

/** 阶段轨道：客户→房屋→设计→报价→合同→项目，全部来自真实对象投影。 */
const stages = computed(() => {
  const quote = selectedQuote.value
  if (!quote) return []
  const hasDesign = Boolean(quote.designId || quote.designName)
  const hasContract = quote.businessStateView?.derivedLabels?.some((label) => label.key === 'contractExists')
  const hasProject = quote.businessStateView?.derivedLabels?.some((label) => label.key === 'projectExists')
  return [
    { label: '客户与房屋', done: true, detail: `${quote.customerName || '客户待完善'} · ${quote.propertyName || '房屋待完善'}` },
    { label: '设计方案', done: hasDesign, detail: hasDesign ? (quote.designName || '已关联方案') : '可先设计后报价' },
    { label: '报价', done: quote.status !== 'draft', detail: `${quote.no} · V${quote.version}` },
    { label: '客户决策', done: quote.status === 'accepted' || quote.status === 'converted' || quote.status === 'rejected', detail: quote.status === 'submitted' ? '等待客户确认' : '客户已反馈' },
    { label: '合同交接', done: hasContract, detail: hasContract ? '已生成合同' : '接受后进入合同工作台' },
    { label: '项目', done: hasProject, detail: hasProject ? '已进入项目主链' : '合同生效后建立' }
  ]
})

const currentStage = computed(() => stages.value.find((stage) => !stage.done)?.label ?? '项目已建立')

/** 唯一主行动：状态→主行动未裁决（pending_business_review，见《WEB-工作台契约条款》），仅展示；已接受/已转项目走合同交接。 */
const mainAction = computed<{ label: string; hint: string; disabled: boolean; kind: 'pending' | 'review' | 'handoff' } | null>(() => {
  const quote = selectedQuote.value
  if (!quote) return null
  if (quote.status === 'accepted' || quote.status === 'converted') {
    return {
      kind: 'handoff',
      label: '交接合同',
      hint: '客户已接受报价，进入合同签约工作台发起合同；签约与生效由企业负责人 / 店长确认。',
      disabled: false
    }
  }
  const label = PRIMARY_LABEL[quote.status]
  return {
    kind: 'review',
    label: label || '待业务确认',
    hint: quote.status === 'draft'
      ? '报价动作策略（保存 / 提交）待业务裁决（T06），当前仅展示；编辑与提交请在报价工作区进行。'
      : quote.status === 'rejected'
        ? '修订后重报动作待业务裁决（T06），当前仅展示；修订请在报价工作区进行。'
        : '报价已提交，等待客户决策；客户反馈后由设计师修订或交接。',
    disabled: true
  }
})

const nextOwnerLabel = computed(() => {
  const quote = selectedQuote.value
  if (!quote) return '待业务确认'
  if (quote.status === 'submitted') return '客户（决策）'
  if (isHandoff(quote.status)) return '设计师（交接合同）'
  if (quote.status === 'superseded') return '设计师（查看当前版本）'
  return '设计师（本人）'
})

const currentQueueIndex = computed(() => filteredQuotes.value.findIndex((quote) => quote.id === selectedKey.value))
const nextQuote = computed(() => filteredQuotes.value.find((quote) => quote.id !== selectedKey.value) ?? null)

/** 对象锚点写回路由：刷新/返回/深链接可恢复（注册 contextKeys: customerId/activePropertyId/quoteId/quoteVersion）。 */
function syncQuery(): void {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(route.query)) {
    if (typeof value === 'string') query[key] = value
  }
  if (selectedKey.value) query.quoteId = selectedKey.value
  else delete query.quoteId
  const quote = selectedQuote.value
  if (quote) {
    if (quote.customerId) query.customerId = String(quote.customerId)
    else delete query.customerId
    if (quote.propertyId) query.activePropertyId = String(quote.propertyId)
    else delete query.activePropertyId
    query.quoteVersion = String(quote.version)
  } else {
    delete query.customerId
    delete query.activePropertyId
    delete query.quoteVersion
  }
  void router.replace({ query })
}

watch([filter, keyword], () => {
  const list = filteredQuotes.value
  if (!list.length) {
    if (!selectedKey.value) return
    selectedKey.value = ''
    syncQuery()
    void loadCustomerContext(null)
    return
  }
  if (list.some((quote) => quote.id === selectedKey.value)) return
  selectedKey.value = list[0]?.id ?? ''
  actionError.value = ''
  syncQuery()
  void loadCustomerContext(selectedQuote.value)
})

function selectQuote(quote: Quote): void {
  selectedKey.value = quote.id
  actionError.value = ''
  syncQuery()
  void loadCustomerContext(quote)
}

/** 中栏客户背景：客户事实、跟进与诉求（复用现有 Provider，不新开 API）。 */
async function loadCustomerContext(quote: Quote | null): Promise<void> {
  if (!quote || !quote.customerId) {
    customer.value = null
    follows.value = []
    requirements.value = []
    contextError.value = ''
    return
  }
  contextLoading.value = true
  contextError.value = ''
  const customerId = String(quote.customerId)
  const propertyId = quote.propertyId ? String(quote.propertyId) : undefined
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
    quotes.value = await quoteDesignerPage({ size: 200 })
    const requestedQuoteId = String(route.query.quoteId ?? '')
    const requested = quotes.value.find((quote) => quote.id === requestedQuoteId)
    if (requested) {
      selectedKey.value = requested.id
    } else if (!quotes.value.some((quote) => quote.id === selectedKey.value)) {
      selectedKey.value = quotes.value[0]?.id ?? ''
    }
  } catch (err) {
    quotes.value = []
    selectedKey.value = ''
    error.value = err instanceof Error ? err.message : '待我谈单队列暂不可确认'
  } finally {
    loading.value = false
    syncQuery()
    void loadCustomerContext(selectedQuote.value)
    void loadTalkContext(selectedQuote.value)
  }
}

function openQuoteWorkspace(quote: Quote): void {
  void router.push(`/designer/quotes/${quote.id}`)
}

function openCustomer360(quote: Quote): void {
  if (!quote.customerId) return
  void router.push(`/designer/my-customers/${quote.customerId}`)
}

/** 主行动：已接受/已转项目 → 交接合同（跳合同工作台并选中该报价）；未裁决动作仅展示。 */
function handleMainAction(): void {
  const quote = selectedQuote.value
  const action = mainAction.value
  if (!quote || !action || action.disabled) return
  if (action.kind === 'handoff') {
    void router.push({ path: '/designer/contract', query: { quoteId: quote.id } })
  }
}

onMounted(load)
</script>

<template>
  <div class="qq">
    <header class="qq__head">
      <div>
        <p class="qq__eyebrow">设计谈单 · 待我谈单</p>
        <h1>待我谈单</h1>
        <p>把需要设计师处理的报价接住：草稿待完善、已驳回改版优先，提交后等待客户决策；客户接受后交接合同，不越权不绕过。</p>
      </div>
      <div class="qq__head-meta">
        <span>{{ filter === 'all' ? `${filteredQuotes.length} 个当前报价` : `${filteredQuotes.length} 个筛选结果` }}</span>
        <button type="button" :class="{ 'is-loading': loading }" @click="load">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.3M21 3v6h-6" /></svg>
          刷新
        </button>
      </div>
    </header>

    <section class="qq__tools" aria-label="报价筛选">
      <label class="qq__search">
        <span>搜索</span>
        <input v-model="keyword" type="search" placeholder="客户、房屋、报价编号" />
      </label>
      <div class="qq__filters">
        <button v-for="item in FILTERS" :key="item.key" type="button" :class="{ active: filter === item.key }" @click="filter = item.key">
          {{ item.label }}
          <small>{{ filterCounts[item.key] }}</small>
        </button>
      </div>
    </section>

    <el-alert v-if="actionError" type="error" :closable="false" :title="actionError" show-icon />

    <WorkbenchState
      v-if="error && !quotes.length"
      variant="error"
      title="待我谈单队列暂不可确认"
      :description="error"
      action-text="重新加载"
      min-height="300px"
      @action="load"
    />

    <div v-else-if="loading && !quotes.length" class="qq__skeleton" aria-busy="true">
      <span v-for="n in 6" :key="n" />
    </div>

    <div v-else class="qq__layout">
      <aside class="qq__queue">
        <header class="qq__queue-head">
          <div>
            <strong>待我处理报价</strong>
            <small>草稿与驳回优先，历史版本只读</small>
          </div>
          <span>{{ filteredQuotes.length }}</span>
        </header>
        <WorkbenchState
          v-if="!filteredQuotes.length"
          title="当前没有符合条件的报价"
          description="切换筛选或清空搜索；真实没有任务时，不会用历史报价填充队列。"
          action-text="刷新"
          min-height="220px"
          @action="load"
        />
        <div v-else class="qq__task-list">
          <button
            v-for="quote in filteredQuotes"
            :key="quote.id"
            type="button"
            class="qq__task"
            :class="{ active: quote.id === selectedKey }"
            @click="selectQuote(quote)"
          >
            <span class="qq__task-top">
              <span class="qq__task-title">
                <strong>{{ quote.customerName || quote.title || '客户待完善' }}</strong>
                <small>{{ quote.propertyName || '房屋待完善' }}</small>
              </span>
              <BusinessStateTag object-key="quote" :status-key="quote.status" :dot="false" />
            </span>
            <span class="qq__task-meta">{{ quote.no }} · V{{ quote.version }} · <MoneyText :value="quote.amount" /></span>
            <span class="qq__task-reason">{{ itemReason(quote) }}</span>
            <span class="qq__task-foot">
              <span><small>创建</small><strong>{{ formatDateTime(quote.createdAt) || '待确认' }}</strong></span>
              <StatusTag :tone="itemRisk(quote).tone" :text="itemRisk(quote).label" :dot="false" />
            </span>
          </button>
        </div>
      </aside>

      <main class="qq__workspace">
        <template v-if="selectedQuote">
          <!-- 唯一 Hero：客户为基准形态；本报价以「标题行追加」进入 -->
          <CustomerHeroCard
            :customer="heroCustomer"
            portrait-title="客户画像"
            portrait-hint="报价前后确认客户预算、决策人与顾虑"
          >
            <template #title-prefix>
              <span class="qq__hero-object">{{ selectedQuote.no }}</span>
              <span class="qq__hero-object-detail">「V{{ selectedQuote.version }} · {{ selectedQuote.designName || '未关联方案' }}」</span>
            </template>
            <template #title-extra>
              <span class="qq__hero-sep">·</span>
              <BusinessStateTag object-key="quote" :status-key="selectedQuote.status" :dot="false" />
            </template>
            <template #focus>
              <HeroFocusItem label="报价阶段" :value="currentStage" :note="itemReason(selectedQuote)" :tone="quoteTone(selectedQuote.status)" />
              <HeroFocusItem
                label="报价金额"
                :value="moneyText(selectedQuote.amount)"
                :note="`V${selectedQuote.version} · 正式金额以服务端 revision 计算`"
                tone="info"
              />
              <HeroFocusItem
                label="客户决策"
                :value="selectedQuote.status === 'submitted' ? '等待客户确认' : selectedQuote.status === 'rejected' ? '客户已驳回' : selectedQuote.status === 'accepted' ? '客户已接受' : '尚未提交'"
                :note="selectedQuote.businessStateView?.nextAction?.hint || '决策后进入合同交接'"
              />
            </template>
            <template #portrait-action>
              <button class="qq__text-button" type="button" @click="openCustomer360(selectedQuote)">完整档案</button>
            </template>
          </CustomerHeroCard>

          <section class="qq__stage-block">
            <header class="qq__stage-head">
              <div><strong>方案信息</strong><small>谈单以方案为载体；方案版本与空间设计项是报价依据</small></div>
              <button v-if="selectedQuote.designId" type="button" class="qq__text-button" @click="openDesignWorkspace(selectedQuote)">打开设计工作区</button>
            </header>
            <dl v-if="scheme" class="qq__stage-grid">
              <div><dt>方案名称</dt><dd>{{ scheme.name || '待命名' }}</dd></div>
              <div><dt>版本</dt><dd>V{{ scheme.version }}</dd></div>
              <div><dt>状态</dt><dd>{{ DESIGN_STATUS_LABELS[scheme.status] || scheme.status }}</dd></div>
              <div><dt>空间</dt><dd>{{ scheme.spaceCount }} 个</dd></div>
              <div><dt>设计项</dt><dd>{{ scheme.itemCount }} 项</dd></div>
              <div><dt>面积 / 户型</dt><dd>{{ scheme.area ? `${scheme.area}㎡` : '待补充' }} / {{ scheme.layout || '待补充' }}</dd></div>
            </dl>
            <p v-else class="qq__empty">当前报价未关联设计方案，谈单前请先在设计工作区完成方案。</p>
          </section>

          <section class="qq__evidence">
            <div>
              <p class="qq__section-label">报价事实</p>
              <p>金额、折扣与税额来自服务端报价投影；进入报价工作区可编辑草稿、查看版本与驳回反馈。</p>
            </div>
            <dl>
              <div><dt>小计</dt><dd><MoneyText :value="selectedQuote.subtotal" /></dd></div>
              <div><dt>折扣</dt><dd><MoneyText :value="selectedQuote.discount" /></dd></div>
              <div><dt>税额（{{ selectedQuote.taxRate }}%）</dt><dd><MoneyText :value="selectedQuote.taxAmount" /></dd></div>
              <div><dt>合计</dt><dd><MoneyText :value="selectedQuote.amount" /></dd></div>
              <div><dt>设计费</dt><dd><MoneyText :value="selectedQuote.designFee" /></dd></div>
            </dl>
          </section>

          <section class="qq__stage-block">
            <header class="qq__stage-head">
              <div><strong>报价调整</strong><small>折扣、税额与版本调整在报价工作区完成，结果由服务端重算</small></div>
              <button type="button" class="qq__text-button" @click="openQuoteWorkspace(selectedQuote)">进入报价工作区</button>
            </header>
            <dl class="qq__stage-grid">
              <div><dt>小计</dt><dd><MoneyText :value="selectedQuote.subtotal" /></dd></div>
              <div><dt>折扣</dt><dd><MoneyText :value="selectedQuote.discount" /></dd></div>
              <div><dt>税额</dt><dd><MoneyText :value="selectedQuote.taxAmount" /></dd></div>
              <div><dt>合计</dt><dd><MoneyText :value="selectedQuote.amount" /></dd></div>
              <div><dt>设计来源</dt><dd>{{ selectedQuote.designName || '未关联方案' }}</dd></div>
              <div><dt>创建时间</dt><dd>{{ formatDateTime(selectedQuote.createdAt) || '待确认' }}</dd></div>
            </dl>
          </section>

          <section class="qq__stage-block">
            <header class="qq__stage-head">
              <div><strong>谈单资料</strong><small>与客户面对面谈单时的演示材料与书面报价</small></div>
            </header>

            <div class="qq__talk-row">
              <div class="qq__talk-meta">
                <strong>谈单 PPT</strong>
                <small v-if="latestTalk">
                  V{{ latestTalk.version }} · {{ TALK_STATUS_LABELS[latestTalk.status] || latestTalk.status }}
                  <template v-if="latestTalk.builtAt"> · 生成 {{ formatDateTime(latestTalk.builtAt) }}</template>
                </small>
                <small v-else>还没有谈单 PPT；生成后可在客户面前逐页讲解方案与报价</small>
              </div>
              <div class="qq__talk-actions">
                <button type="button" class="qq__text-button" :disabled="talkBusy || !selectedQuote.designId" @click="buildTalkPpt">
                  {{ talkBusy ? '生成中…' : (latestTalk ? '重新生成' : '生成谈单 PPT') }}
                </button>
                <button v-if="latestTalk?.outputUrl" type="button" class="qq__text-button" @click="openArchive(latestTalk.outputUrl)">打开 PPT</button>
              </div>
            </div>
            <p v-if="talkError" class="qq__talk-error">{{ talkError }}</p>

            <div class="qq__talk-row">
              <div class="qq__talk-meta">
                <strong>报价 PDF</strong>
                <small v-if="quotePdf">
                  {{ quotePdf.businessNo || selectedQuote.no }} · {{ formatDateTime(quotePdf.generatedAt) || '已归档' }}
                </small>
                <small v-else>还没有报价 PDF；生成后可作为书面报价发给客户</small>
              </div>
              <div class="qq__talk-actions">
                <button type="button" class="qq__text-button" :disabled="quotePdfBusy" @click="buildQuotePdf">
                  {{ quotePdfBusy ? '生成中…' : (quotePdf ? '重新生成' : '生成报价 PDF') }}
                </button>
                <button v-if="quotePdf?.url" type="button" class="qq__text-button" @click="openArchive(quotePdf.url)">打开 PDF</button>
              </div>
            </div>
            <p v-if="quotePdfError" class="qq__talk-error">{{ quotePdfError }}</p>
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
          title="请选择一个报价"
          description="左侧队列已绑定客户、房屋与报价版本；选择后再进入工作区编辑或交接。"
          min-height="300px"
        />
      </main>

      <aside class="qq__guide">
        <template v-if="selectedQuote">
          <section class="qq__guide-card qq__guide-card--primary">
            <div class="qq__guide-title-row">
              <div>
                <p class="qq__eyebrow">本次报价</p>
                <h3>{{ mainAction?.label || '待业务确认' }}</h3>
              </div>
              <span class="qq__guide-order">{{ currentQueueIndex >= 0 ? `${currentQueueIndex + 1}/${filteredQuotes.length}` : '已完成' }}</span>
            </div>
            <p class="qq__guide-reason">{{ mainAction?.hint || itemReason(selectedQuote) }}</p>
            <div class="qq__guide-inline"><span>下一接棒</span><b>{{ nextOwnerLabel }}</b></div>
            <button
              type="button"
              class="qq__primary"
              :class="{ 'is-blocked': mainAction?.disabled }"
              :disabled="!mainAction || mainAction.disabled"
              @click="handleMainAction"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></svg>
              {{ mainAction?.label || '暂不可执行' }}
            </button>
            <p class="qq__guide-note">{{ mainAction?.disabled ? mainAction.hint : '交接成功后合同工作台会重新读取报价与合同事实。' }}</p>
            <div v-if="nextQuote" class="qq__next-inline">
              <span>下一项</span>
              <button type="button" @click="selectQuote(nextQuote)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                查看下一项
              </button>
            </div>
          </section>

          <section class="qq__guide-card">
            <header class="qq__actions-head"><div><h4>其他合法动作</h4><small>在当前页面完成，不需要再搜索同一个报价</small></div></header>
            <div class="qq__action-grid">
              <WorkbenchQuickAction tone="measure" title="进入报价工作区" hint="编辑草稿、版本与报价调整" @click="openQuoteWorkspace(selectedQuote)">
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg></template>
              </WorkbenchQuickAction>
              <WorkbenchQuickAction tone="outline" title="完整档案" hint="查看客户历史与低频资料" @click="openCustomer360(selectedQuote)">
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h5M8 16h8" /></svg></template>
              </WorkbenchQuickAction>
              <WorkbenchQuickAction tone="outline" title="刷新数据" hint="重新读取队列与报价事实" @click="load">
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.3M21 3v6h-6" /></svg></template>
              </WorkbenchQuickAction>
            </div>
            <p class="qq__guide-note">报价保存或提交后，系统会重新读取报价、设计与下游合同；读取不全时显示"部分数据暂不可确认"。</p>
          </section>
        </template>

        <WorkbenchState
          v-else
          title="等待选择报价"
          description="右侧会显示当前状态、唯一主行动、接棒人、完成回读与下一项。"
          min-height="280px"
        />
      </aside>
    </div>
  </div>

    <RequirementFormDrawer
      v-model="requirementOpen"
      :customer-id="selectedQuote ? String(selectedQuote.customerId ?? '') : ''"
      :customer-name="selectedQuote?.customerName || ''"
      :property-id="selectedQuote?.propertyId ? String(selectedQuote.propertyId) : ''"
      :property-name="selectedQuote?.propertyName || ''"
      @saved="loadCustomerContext(selectedQuote)"
    />

</template>

<style scoped lang="scss">
@use '@/styles/workbench-shell' as wb;
.qq { display: flex; flex-direction: column; gap: $space-5; min-width: 0; }

.qq__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: $space-5;
  h1 { margin: 0; font-size: $font-display; letter-spacing: -.02em; }
  p { max-width: 820px; margin: $space-2 0 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
}

.qq__eyebrow,
.qq__section-label { color: $brand-600 !important; font-size: $font-caption !important; font-weight: $font-weight-semibold; letter-spacing: .09em; }
.qq__head-meta { display: flex; align-items: center; gap: $space-3; color: $text-secondary; font-size: $font-caption; }
.qq__head-meta button,
.qq__secondary-actions button {
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
.qq__head-meta button:hover,
.qq__secondary-actions button:hover { color: $brand-600; border-color: $brand-300; background: $brand-50; }
.qq__head-meta svg { width: 14px; height: 14px; }
.qq__head-meta .is-loading svg { animation: qq-spin .7s linear infinite; }
@keyframes qq-spin { to { transform: rotate(360deg); } }

.qq__tools {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: $space-4;
  padding: $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
}
.qq__search { display: flex; flex-direction: column; gap: 6px; min-width: 280px; color: $text-secondary; font-size: $font-caption; }
.qq__search input { height: 36px; padding: 0 10px; border: 1px solid $border-color; border-radius: $radius-sm; color: $text-primary; background: $surface-0; font: inherit; }
.qq__filters { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.qq__filters button { padding: 7px 11px; border: 1px solid $border-color; border-radius: $radius-pill; background: $surface-0; color: $text-secondary; font: inherit; font-size: $font-caption; cursor: pointer; }
.qq__filters button.active { border-color: $brand-300; background: $brand-50; color: $brand-700; }
.qq__filters small { color: $text-tertiary; font-variant-numeric: tabular-nums; }

.qq__layout { @include wb.workbench-layout(327px); }
.qq__queue { @include wb.workbench-queue; }
.qq__queue-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid $border-color; background: linear-gradient(135deg, $surface-50, $surface-0); }
.qq__queue-head div { display: flex; flex-direction: column; gap: 3px; }
.qq__queue-head strong { color: $text-primary; font-size: $font-body; }
.qq__queue-head small { color: $text-tertiary; font-size: $font-caption; }
.qq__queue-head > span { color: $brand-700; font-size: $font-title; font-weight: $font-weight-bold; }
.qq__task-list { display: flex; flex-direction: column; @include wb.workbench-queue-scroll; }
.qq__task {
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
.qq__task:last-child { border-bottom: 0; }
.qq__task:hover { background: $surface-50; }
.qq__task.active { background: $brand-50; box-shadow: inset 3px 0 0 $brand-500; }
.qq__task-top,
.qq__task-foot { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.qq__task-top { align-items: flex-start; }
.qq__task-title { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.qq__task-title strong { overflow: hidden; color: $text-primary; font-size: $font-body; text-overflow: ellipsis; white-space: nowrap; }
.qq__task-title small { overflow: hidden; color: $text-secondary; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; }
.qq__task-meta { overflow: hidden; color: $text-secondary; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; }
.qq__task-reason { overflow: hidden; color: $brand-700; font-size: $font-caption; font-weight: $font-weight-semibold; text-overflow: ellipsis; white-space: nowrap; }
.qq__task-foot { padding-top: 7px; border-top: 1px dashed $border-color; }
.qq__task-foot > span { display: flex; align-items: baseline; gap: 5px; min-width: 0; }
.qq__task-foot small { flex: 0 0 auto; color: $text-tertiary; font-size: $font-caption; }
.qq__task-foot strong { overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }

.qq__workspace { @include wb.workbench-workspace; }
.qq__guide { @include wb.workbench-guide; }
.qq__guide-card { padding: 14px; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.qq__guide-card--primary { border-color: $brand-200; background: linear-gradient(135deg, $surface-0, $brand-50); }
.qq__guide-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; }
.qq__guide-title-row h3 { margin: 4px 0 0; color: $text-primary; font-size: $font-body; }
.qq__guide-order { padding: 3px 8px; border-radius: $radius-pill; background: $surface-100; color: $text-tertiary; font-size: $font-caption; }
.qq__guide-reason { display: -webkit-box; overflow: hidden; margin: 10px 0 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.qq__guide-inline { display: flex; align-items: center; gap: 6px; margin-top: 8px; padding: 7px 9px; border-radius: $radius-sm; background: $surface-50; }
.qq__guide-inline span { color: $text-tertiary; font-size: $font-caption; }
.qq__guide-inline b { color: $brand-700; font-size: $font-body-sm; }
.qq__guide-card h4 { margin: 0 0 8px; color: $text-primary; font-size: $font-body; }
.qq__guide-card p { margin: 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
.qq__guide-note { margin: 8px 0 0 !important; color: $text-tertiary !important; font-size: $font-caption !important; line-height: 1.5 !important; }
.qq__next-inline { display: flex; align-items: center; justify-content: space-between; gap: $space-2; margin-top: 10px; padding-top: 9px; border-top: 1px solid $border-color; }
.qq__next-inline span { color: $text-tertiary; font-size: $font-caption; }
.qq__next-inline button { display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: transparent; color: $brand-700; font: inherit; font-size: $font-caption; font-weight: $font-weight-semibold; cursor: pointer; }
.qq__hero-card { padding: 12px; border: 1px solid $border-color; border-radius: $radius-lg; background: linear-gradient(135deg, $brand-50, $surface-0 70%); }
.qq__hero-top { display: flex; align-items: flex-start; gap: $space-3; }
.qq__hero-avatar { width: 46px; height: 46px; flex: 0 0 auto; display: grid; place-items: center; border-radius: $radius-md; background: $brand-600; color: $surface-0; }
.qq__hero-avatar svg { width: 24px; height: 24px; }
.qq__hero-ident { flex: 1; min-width: 0; }
.qq__hero-name-row { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; }
.qq__hero-name-row h2 { margin: 0; color: $text-primary; font-size: $font-title; }
.qq__hero-contact { margin: 5px 0 0; color: $text-secondary; font-size: $font-body-sm; }
.qq__hero-layer--focus { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-top: 10px; }
.qq__hero-layer--background { margin-top: 10px; }
.qq__focus-item { min-width: 0; padding: 8px 10px; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; }
.qq__focus-item small { display: block; color: $text-tertiary; font-size: $font-caption; }
.qq__focus-item b { display: block; margin-top: 2px; overflow: hidden; color: $text-primary; font-size: $font-body-sm; font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }
.qq__focus-item span { display: -webkit-box; overflow: hidden; margin-top: 2px; color: $text-secondary; font-size: $font-caption; line-height: 1.5; -webkit-box-orient: vertical; -webkit-line-clamp: 1; }
.qq__focus-item--blocked { border-color: $status-blocked-border; background: $status-blocked-soft; }
.qq__focus-item--blocked b { color: $status-blocked; }
.qq__focus-item--pending { border-color: $status-pending-border; background: $status-pending-soft; }
.qq__focus-item--pending b { color: $status-pending; }
.qq__focus-item--info { border-color: $status-info-border; background: $status-info-soft; }
.qq__focus-item--info b { color: $status-info; }
.qq__focus-item--todo { border-color: $status-todo-border; background: $status-todo-soft; }
.qq__focus-item--todo b { color: $status-todo; }
.qq__focus-item--done { border-color: $status-done-border; background: $status-done-soft; }
.qq__focus-item--done b { color: $status-done; }
.qq__focus-item--dark { border-color: $status-dark-border; background: $status-dark-soft; }
.qq__focus-item--dark b { color: $status-dark; }
.qq__facts { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
.qq__facts article { min-width: 0; padding: 7px 9px; border-radius: $radius-sm; background: rgba(255, 255, 255, .72); }
.qq__facts small { display: block; color: $text-tertiary; font-size: $font-caption; }
.qq__facts b { display: block; margin-top: 3px; overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
.qq__primary { display: inline-flex; align-items: center; justify-content: center; gap: 6px; width: 100%; min-width: 140px; margin-top: 10px; padding: 11px 18px; border: 0; border-radius: $radius-sm; background: $brand-600; color: $surface-0; font: inherit; font-weight: $font-weight-semibold; cursor: pointer; }
.qq__primary svg { width: 16px; height: 16px; }
.qq__primary.is-blocked { background: $warning-500; }
.qq__primary.is-blocked:hover { background: $warning-700; }
.qq__primary:hover { background: $brand-700; }
.qq__primary:disabled { background: $line-200; color: $text-tertiary; cursor: not-allowed; }
.qq__secondary-actions { display: flex; flex-wrap: wrap; gap: $space-2; margin-top: 10px; }
.qq__secondary-actions button svg,
.qq__next-inline button svg { width: 14px; height: 14px; }
.qq__actions-head { margin-bottom: 8px; }
.qq__actions-head h4 { margin: 0; color: $text-primary; font-size: $font-body; }
.qq__actions-head small { display: block; margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }
.qq__action-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.qq__guide-note { margin: 8px 0 0; color: $text-tertiary; font-size: $font-caption; line-height: 1.5; }
.qq__talk-row { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; padding: 10px 12px; border-radius: $radius-md; background: $surface-50; }
.qq__talk-meta strong { color: $text-primary; font-size: $font-body-sm; }
.qq__talk-meta small { display: block; margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }
.qq__talk-actions { display: flex; flex-wrap: wrap; gap: $space-3; flex: 0 0 auto; }
.qq__talk-error { margin: 0; color: $danger-500; font-size: $font-caption; }
.qq__empty { margin: 0; color: $text-secondary; font-size: $font-caption; }

.qq__evidence { display: flex; align-items: center; justify-content: space-between; gap: $space-4; padding: 18px 20px; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.qq__evidence p { margin: 5px 0 0; color: $text-secondary; font-size: $font-body-sm; }
.qq__evidence dl { display: flex; flex-wrap: wrap; gap: $space-5; margin: 0; }
.qq__evidence dt { color: $text-tertiary; font-size: $font-caption; }
.qq__evidence dd { margin: 4px 0 0; color: $text-primary; font-size: $font-body-sm; font-weight: $font-weight-semibold; }

.qq__hero-object { color: $text-primary; font-size: $font-h1; font-weight: $font-weight-bold; letter-spacing: -.01em; }
.qq__hero-object-detail { color: $text-secondary; font-size: $font-h1; font-weight: $font-weight-semibold; }
.qq__hero-sep { color: $text-tertiary; font-size: $font-body-sm; }
.qq__text-button { padding: 0; border: 0; background: transparent; color: $brand-600; font: inherit; font-size: $font-caption; font-weight: $font-weight-semibold; cursor: pointer; }
.qq__stage-block { display: flex; flex-direction: column; gap: $space-3; padding: $space-4; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.qq__stage-head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; }
.qq__stage-head strong { color: $text-primary; font-size: $font-body; }
.qq__stage-head small { display: block; margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }
.qq__stage-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: $space-3; margin: 0; }
.qq__stage-grid > div { min-width: 0; padding: 10px 12px; border-radius: $radius-md; background: $surface-50; }
.qq__stage-grid dt { color: $text-tertiary; font-size: $font-caption; }
.qq__stage-grid dd { margin: 4px 0 0; overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; }
.qq__customer { display: flex; flex-direction: column; gap: $space-3; padding: $space-4; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.qq__customer-head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; }
.qq__customer-head strong { color: $text-primary; font-size: $font-body; }
.qq__customer-head small { display: block; margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }
.qq__customer-head button,
.qq__customer-action { display: inline-flex; align-items: center; gap: 5px; flex: 0 0 auto; padding: 6px 10px; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; color: $brand-600; font: inherit; font-size: $font-caption; cursor: pointer; }
.qq__customer-head button:hover,
.qq__customer-action:hover { border-color: $brand-300; background: $brand-50; }
.qq__customer-head button svg,
.qq__customer-action svg { width: 13px; height: 13px; flex: 0 0 auto; }
.qq__customer-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-3; }
.qq__customer-col { display: flex; flex-direction: column; gap: $space-2; min-width: 0; padding: 12px 13px; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-50; }
.qq__customer-actions { display: flex; flex-wrap: wrap; gap: 6px; flex: 0 0 auto; }
.qq__customer-actions button { display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; color: $text-secondary; font: inherit; font-size: $font-caption; cursor: pointer; }
.qq__customer-actions button:hover { border-color: $brand-300; background: $brand-50; color: $brand-600; }
.qq__customer-actions svg { width: 13px; height: 13px; }
.qq__customer-col h4 { margin: 0; color: $text-primary; font-size: $font-body-sm; }
.qq__customer-col dl { display: grid; gap: 5px; margin: 0; }
.qq__customer-col dl div { display: flex; align-items: baseline; justify-content: space-between; gap: $space-2; }
.qq__customer-col dt { flex: 0 0 auto; color: $text-tertiary; font-size: $font-caption; }
.qq__customer-col dd { margin: 0; overflow: hidden; color: $text-primary; font-size: $font-caption; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
.qq__portrait-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.qq__portrait-chips > span { display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; border-radius: $radius-pill; background: $surface-0; color: $text-secondary; font-size: $font-caption; }
.qq__portrait-chips small { color: $text-tertiary; }
.qq__customer-empty { margin: 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.qq__follows,
.qq__requirements { display: flex; flex-direction: column; gap: $space-2; }
.qq__follow,
.qq__requirement { display: flex; flex-direction: column; gap: 3px; padding: 8px 10px; border-radius: $radius-sm; background: $surface-0; }
.qq__follow small { color: $text-tertiary; font-size: $font-caption; }
.qq__follow p,
.qq__requirement p { margin: 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.qq__follow em { color: $brand-700; font-size: $font-caption; font-style: normal; }
.qq__requirement > div { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.qq__requirement strong { overflow: hidden; color: $text-primary; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; }
.qq__requirement small { color: $text-tertiary; font-size: $font-caption; }
.qq__skeleton { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: $space-4; }
.qq__skeleton span { height: 170px; border-radius: $radius-md; background: linear-gradient(90deg, $surface-100 25%, $surface-50 37%, $surface-100 63%); background-size: 400% 100%; animation: qq-shimmer 1.4s ease infinite; }
@keyframes qq-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }

@media (max-width: 1280px) {
  .qq__hero-layer--focus { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .qq__facts { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 1024px) {
  .qq__tools,
  .qq__evidence { align-items: stretch; flex-direction: column; }
  .qq__hero-layer--focus { grid-template-columns: 1fr; }
  .qq__facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .qq__customer-grid { grid-template-columns: 1fr; }
  .qq__primary { width: 100%; }
}
</style>
