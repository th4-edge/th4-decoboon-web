<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import NextActionPanel from '@/components/business-state/NextActionPanel.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import MoneyText from '@/components/MoneyText.vue'
import { quoteDesignerPage } from '@/domains/trade/api'
import type { Quote } from '@/domains/trade/model'
import { contractApi } from '@/domains/contract/api'
import type { Contract, ContractStatus } from '@/domains/contract/model'
import { projectApi } from '@/domains/project/api'
import type { ProjectBrief } from '@/domains/project/model'
import { crmApi } from '@/domains/crm/api'
import type { CustomerFollow } from '@/domains/crm/model'
import { formatDateTime } from '@/core/format'
import type { StatusTone } from '@/core/tone'

const router = useRouter()

const loading = ref(false)
const error = ref('')
const actionError = ref('')
const quotes = ref<Quote[]>([])
const selectedQuoteId = ref('')
const contract = ref<Contract | null>(null)
const projects = ref<ProjectBrief[]>([])
const follows = ref<CustomerFollow[]>([])
const contextLoading = ref(false)
const copied = ref(false)

const FOLLOW_WAY_LABELS: Record<string, string> = {
  phone: '电话',
  visit: '到店',
  wechat: '微信',
  video: '视频',
  other: '其他'
}

const CONTRACT_STATUS_META: Record<ContractStatus, { label: string; tone: StatusTone }> = {
  draft: { label: '合同草稿', tone: 'todo' },
  pendingSign: { label: '待签署', tone: 'pending' },
  signed: { label: '已签署', tone: 'progress' },
  effective: { label: '已生效', tone: 'done' },
  changing: { label: '变更中', tone: 'alert' },
  active: { label: '履约中', tone: 'doing' },
  changed: { label: '已变更', tone: 'special' },
  completed: { label: '已完工', tone: 'dark' },
  closed: { label: '已关闭', tone: 'closed' },
  settled: { label: '已结算', tone: 'dark' },
  terminated: { label: '已终止', tone: 'blocked' },
  void: { label: '已作废', tone: 'closed' }
}

const queue = computed(() => quotes.value.filter((quote) => quote.status === 'accepted' || quote.status === 'converted'))

const selectedQuote = computed(() => queue.value.find((quote) => quote.id === selectedQuoteId.value) ?? queue.value[0] ?? null)
const selectedProject = computed(() => selectedQuote.value ? projects.value.find((project) => project.quoteId === selectedQuote.value?.id) ?? null : null)

const stages = computed(() => {
  const quote = selectedQuote.value
  if (!quote) return []
  const signed = Boolean(contract.value && ['signed', 'effective', 'changing', 'active', 'changed', 'completed', 'closed', 'settled'].includes(contract.value.status))
  const effective = Boolean(contract.value && ['effective', 'changing', 'active', 'changed', 'completed', 'closed', 'settled'].includes(contract.value.status))
  return [
    { label: '报价已确认', done: quote.status === 'accepted' || quote.status === 'converted', detail: quote.no },
    { label: '合同已生成', done: Boolean(contract.value), detail: contract.value?.no || '待企业负责人或店长处理' },
    { label: '合同已签署', done: signed, detail: contract.value?.signedAt ? formatDateTime(contract.value.signedAt) : '设计师不参与签署' },
    { label: '合同已生效', done: effective, detail: effective ? '可进入项目主链' : '生效后才能建立项目' },
    { label: '项目已立项', done: Boolean(selectedProject.value), detail: selectedProject.value?.no || '待合同生效' }
  ]
})

const handoffState = computed(() => {
  if (!selectedQuote.value) return '暂不可确认'
  if (selectedProject.value) return '已交接项目'
  if (!contract.value) return '待合同生成'
  if (contract.value.status === 'draft' || contract.value.status === 'pendingSign') return '待签署'
  if (contract.value.status === 'signed') return '待生效'
  return '待项目立项'
})

const handoffSummary = computed(() => {
  const quote = selectedQuote.value
  if (!quote) return ''
  const contractText = contract.value
    ? `${contract.value.no} · ${CONTRACT_STATUS_META[contract.value.status].label} · ¥${contract.value.currentAmount.toFixed(2)}`
    : '合同尚未生成'
  const projectText = selectedProject.value ? `${selectedProject.value.no} · ${selectedProject.value.status}` : '项目尚未立项'
  const latest = follows.value[follows.value.length - 1]
  return [
    `客户：${quote.customerName || quote.title || '客户待完善'}`,
    `房屋：${quote.propertyName || '房屋待完善'}`,
    `报价：${quote.no} · V${quote.version} · ¥${quote.amount.toFixed(2)} · ${quote.status === 'accepted' ? '客户已接受' : '已转项目'}`,
    `合同：${contractText}`,
    `项目：${projectText}`,
    `最近沟通：${latest ? `${formatDateTime(latest.createdAt)} ${latest.content}` : '暂无跟进记录'}`,
    `交接建议：${selectedProject.value ? '项目已建立，继续项目协同。' : '请企业负责人或店长核对报价与客户决策，完成签约、生效和立项；设计师不代替客户确认，也不越权签署合同。'}`
  ].join('\n')
})

async function loadQueue(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const [quoteResult, projectResult] = await Promise.all([
      quoteDesignerPage({ size: 200 }),
      projectApi.listProjects()
    ])
    quotes.value = quoteResult
    projects.value = projectResult
    if (!selectedQuoteId.value && queue.value.length) selectedQuoteId.value = queue.value[0].id
    if (selectedQuoteId.value) await loadContext()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '合同交接队列暂不可确认'
  } finally {
    loading.value = false
  }
}

async function loadContext(): Promise<void> {
  const quote = selectedQuote.value
  if (!quote) return
  contextLoading.value = true
  actionError.value = ''
  contract.value = null
  follows.value = []
  try {
    const [contractResult, followResult] = await Promise.allSettled([
      contractApi.contractByQuote(quote.id),
      quote.customerId ? crmApi.customerFollows(quote.customerId) : Promise.resolve([])
    ])
    contract.value = contractResult.status === 'fulfilled' ? contractResult.value : null
    follows.value = followResult.status === 'fulfilled' ? followResult.value : []
    if (contractResult.status === 'rejected' || followResult.status === 'rejected') {
      actionError.value = '部分合同或沟通事实暂不可确认，请稍后重试。'
    }
  } finally {
    contextLoading.value = false
  }
}

function selectQuote(quote: Quote): void {
  selectedQuoteId.value = quote.id
  void loadContext()
}

async function copySummary(): Promise<void> {
  copied.value = false
  try {
    await navigator.clipboard.writeText(handoffSummary.value)
    copied.value = true
    ElMessage.success('交接摘要已复制')
  } catch {
    ElMessage.warning('浏览器未授予剪贴板权限，请手工复制摘要')
  }
}

onMounted(loadQueue)
</script>

<template>
  <div class="ch">
    <header class="ch__head">
      <div>
        <p class="ch__eyebrow">CONTRACT HANDOFF</p>
        <h2>合同交接</h2>
        <p>设计师只负责报价确认后的资料准备、客户反馈和交接；签约、生效由企业负责人或店长完成，设计师不得越权签署。</p>
      </div>
      <el-button @click="loadQueue">刷新交接队列</el-button>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <el-alert v-if="actionError" type="warning" :closable="false" :title="actionError" show-icon />

    <div class="ch__layout">
      <aside class="ch__queue">
        <div class="ch__panel-head"><strong>交接队列</strong><span>{{ queue.length }} 条</span></div>
        <div v-if="loading" class="ch__loading"><el-skeleton :rows="6" animated /></div>
        <EmptyState v-else-if="!queue.length" title="没有待交接报价" description="客户接受报价后，报价会进入合同交接队列。" />
        <button
          v-for="quote in queue"
          v-else
          :key="quote.id"
          type="button"
          class="ch__queue-item"
          :class="{ active: quote.id === selectedQuote?.id }"
          @click="selectQuote(quote)"
        >
          <span class="ch__queue-top">
            <strong>{{ quote.customerName || quote.title || '客户待完善' }}</strong>
            <StatusTag tone="done" text="客户已接受" />
          </span>
          <span>{{ quote.propertyName || '房屋待完善' }} · {{ quote.no }}</span>
          <span class="ch__queue-foot"><MoneyText :value="quote.amount" /><small>V{{ quote.version }}</small></span>
        </button>
      </aside>

      <main class="ch__main">
        <template v-if="selectedQuote">
          <section class="ch__identity">
            <div>
              <p class="ch__eyebrow">CURRENT HANDOFF</p>
              <h3>{{ selectedQuote.customerName || selectedQuote.title || '客户待完善' }}</h3>
              <p>{{ selectedQuote.propertyName || '房屋待完善' }} · {{ selectedQuote.no }} · V{{ selectedQuote.version }}</p>
            </div>
            <div class="ch__state">
              <span>当前状态</span>
              <b>{{ handoffState }}</b>
            </div>
          </section>

          <section class="ch__stages">
            <div v-for="stage in stages" :key="stage.label" class="ch__stage" :class="{ done: stage.done }">
              <i aria-hidden="true">{{ stage.done ? '✓' : '·' }}</i>
              <div><strong>{{ stage.label }}</strong><small>{{ stage.detail }}</small></div>
            </div>
          </section>

          <section class="ch__facts">
            <article>
              <h4>报价事实</h4>
              <dl>
                <div><dt>报价编号</dt><dd>{{ selectedQuote.no }}</dd></div>
                <div><dt>报价金额</dt><dd><MoneyText :value="selectedQuote.amount" size="lg" /></dd></div>
                <div><dt>报价状态</dt><dd>客户已接受</dd></div>
                <div><dt>创建时间</dt><dd>{{ formatDateTime(selectedQuote.createdAt) }}</dd></div>
              </dl>
            </article>
            <article>
              <h4>合同事实</h4>
              <dl v-if="contract">
                <div><dt>合同编号</dt><dd>{{ contract.no }}</dd></div>
                <div><dt>合同状态</dt><dd><BusinessStateTag object-key="contract" :status-key="contract.status" /></dd></div>
                <div><dt>当前金额</dt><dd><MoneyText :value="contract.currentAmount" /></dd></div>
                <div><dt>签署时间</dt><dd>{{ formatDateTime(contract.signedAt) }}</dd></div>
                <div><dt>生效时间</dt><dd>{{ formatDateTime(contract.effectiveAt) }}</dd></div>
              </dl>
              <NextActionPanel
                v-if="contract"
                :action="contract.businessStateView?.nextAction"
                title="合同下一步"
                :show-action="false"
              />
              <EmptyState v-else title="合同尚未生成" description="设计师不创建或签署合同；请企业负责人或店长处理。" />
            </article>
          </section>

          <section class="ch__project">
            <div class="ch__section-head"><div><h4>项目交接</h4><p>合同生效并立项后，设计师进入项目协同；当前项目页仍在分批建设中。</p></div></div>
            <div v-if="selectedProject" class="ch__project-card">
              <div><strong>{{ selectedProject.name || '项目待命名' }}</strong><small>{{ selectedProject.no }} · <BusinessStateTag object-key="project" :status-key="selectedProject.status" size="sm" /></small></div>
              <el-button type="primary" plain @click="router.push('/designer/projects')">进入项目协同</el-button>
            </div>
            <EmptyState v-else title="项目尚未立项" description="项目由合同生效后服务端建立，设计师不绕过合同直接创建项目。" />
          </section>
        </template>
        <EmptyState v-else title="请选择一条待交接报价" description="队列只展示本人创建且客户已接受的报价。" />
      </main>

      <aside class="ch__context">
        <section class="ch__summary">
          <div class="ch__panel-head"><strong>交接摘要</strong></div>
          <p v-if="selectedQuote">{{ handoffSummary }}</p>
          <EmptyState v-else title="暂无可复制摘要" />
          <el-button type="primary" :disabled="!selectedQuote" @click="copySummary">{{ copied ? '已复制' : '复制交接摘要' }}</el-button>
        </section>
        <section class="ch__follows">
          <div class="ch__panel-head"><strong>客户沟通</strong></div>
          <EmptyState v-if="!follows.length" title="暂无跟进记录" description="跟进记录来自客户主链，设计师侧只读。" />
          <ol v-else>
            <li v-for="follow in follows.slice().reverse()" :key="follow.id">
              <span>{{ formatDateTime(follow.createdAt) }}</span>
              <strong>{{ follow.empName || '员工' }} · {{ FOLLOW_WAY_LABELS[follow.way] || follow.way }}</strong>
              <p>{{ follow.content }}</p>
            </li>
          </ol>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ch {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: $space-5;
}

.ch__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;

  h2 { margin: $space-1 0; font-size: $font-display; }
  p { margin: 0; max-width: 760px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
}

.ch__eyebrow {
  color: $brand-600 !important;
  font-size: $font-caption !important;
  font-weight: $font-weight-semibold;
  letter-spacing: .1em;
}

.ch__layout {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 320px;
  gap: $space-4;
  align-items: start;
}

.ch__queue,
.ch__main,
.ch__context {
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  box-shadow: $shadow-card;
  overflow: hidden;
}

.ch__queue,
.ch__context { position: sticky; top: $space-4; max-height: calc(100vh - #{$topbar-height} - #{$space-8}); overflow: auto; }

.ch__panel-head,
.ch__section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-3;
  padding: $space-4;
  border-bottom: 1px solid $border-color;

  h4 { margin: 0 0 $space-1; font-size: $font-title; }
  p { margin: 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
}

.ch__panel-head span {
  color: $text-tertiary;
  font-size: $font-caption;
}

.ch__queue-item {
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

.ch__queue-top,
.ch__queue-foot {
  display: flex !important;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;
}

.ch__queue-top strong { color: $text-primary; font-size: $font-body; }
.ch__queue-foot small { color: $brand-700; }

.ch__identity {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;
  padding: $space-5;
  border-bottom: 1px solid $border-color;
  background: linear-gradient(135deg, $brand-50 0%, $surface-0 72%);

  h3 { margin: $space-1 0; font-size: $font-h1; }
  p { margin: 0; color: $text-secondary; font-size: $font-body-sm; }
}

.ch__state {
  min-width: 160px;
  text-align: right;

  span { display: block; color: $text-secondary; font-size: $font-caption; }
  b { display: block; margin-top: 3px; color: $brand-700; font-size: $font-title; }
}

.ch__stages {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: $space-2;
  padding: $space-4;
  border-bottom: 1px solid $border-color;
}

.ch__stage {
  display: flex;
  gap: $space-2;
  padding: $space-3;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-50;

  i { width: 24px; height: 24px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 50%; background: $surface-0; color: $text-tertiary; font-style: normal; }
  strong,
  small { display: block; }
  strong { font-size: $font-body-sm; }
  small { margin-top: 3px; color: $text-secondary; font-size: $font-caption; }
  &.done i { color: $surface-0; background: $brand-600; }
}

.ch__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-4;
  padding: $space-4;
  border-bottom: 1px solid $border-color;

  article { padding: $space-4; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; }
  h4 { margin: 0 0 $space-3; font-size: $font-body; }
  dl { display: grid; gap: $space-2; margin: 0; }
  dl div { display: flex; justify-content: space-between; gap: $space-3; }
  dt { color: $text-secondary; font-size: $font-caption; }
  dd { margin: 0; font-size: $font-body-sm; text-align: right; }
}

.ch__project { border-bottom: 1px solid $border-color; }
.ch__project-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-4;
  margin: $space-4;
  padding: $space-4;
  border: 1px solid $brand-100;
  border-radius: $radius-sm;
  background: $brand-50;

  strong,
  small { display: block; }
  small { margin-top: 3px; color: $text-secondary; font-size: $font-caption; }
}

.ch__summary { padding: $space-4; border-bottom: 1px solid $border-color; }
.ch__summary p { white-space: pre-wrap; color: $text-secondary; font-size: $font-body-sm; line-height: 1.8; }
.ch__summary .el-button { width: 100%; }

.ch__follows ol { margin: 0; padding: $space-4; list-style: none; }
.ch__follows li { padding-bottom: $space-3; margin-bottom: $space-3; border-bottom: 1px solid $border-color; }
.ch__follows li:last-child { border-bottom: 0; }
.ch__follows span { display: block; color: $text-tertiary; font-size: $font-caption; }
.ch__follows strong { display: block; margin: $space-1 0; font-size: $font-body-sm; }
.ch__follows p { margin: 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.6; }

.ch__loading { padding: $space-5; }

@media (max-width: 1280px) {
  .ch__layout { grid-template-columns: 260px minmax(0, 1fr); }
  .ch__context { grid-column: 1 / -1; position: static; max-height: none; }
}

@media (max-width: 1024px) {
  .ch__head { flex-direction: column; }
  .ch__layout { grid-template-columns: 1fr; }
  .ch__queue { position: static; max-height: none; }
  .ch__stages { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ch__facts { grid-template-columns: 1fr; }
}
</style>
