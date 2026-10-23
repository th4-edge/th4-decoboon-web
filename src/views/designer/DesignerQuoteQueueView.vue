<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StatusTag from '@/components/StatusTag.vue'
import MoneyText from '@/components/MoneyText.vue'
import CustomerHeroCard from '@/components/customer/CustomerHeroCard.vue'
import HeroFocusItem from '@/components/workbench/HeroFocusItem.vue'
import WorkbenchQuickAction from '@/components/workbench/WorkbenchQuickAction.vue'
import WorkbenchState from '@/components/workbench/WorkbenchState.vue'
import type { Customer } from '@/domains/crm/model'
import { formatDateTime, formatRelativeDay } from '@/core/format'
import type { StatusTone } from '@/core/tone'
import type { DesignerQuoteTask } from '@/domains/workbench/model'
import { workbenchApi } from '@/domains/workbench/api'
import { useSessionStore } from '@/stores/session'
import { canManageDormantRole } from '@/domains/crm/dormant'

type QueueFilter = 'all' | 'draft' | 'submitted' | 'rejected'

const PAGE_SIZE = 20
const session = useSessionStore()
const canManageLoss = computed(() => canManageDormantRole(session.role))
const route = useRoute()
const router = useRouter()
const tasks = ref<DesignerQuoteTask[]>([])
const total = ref(0)
const page = ref(1)
const pages = ref(1)
const loading = ref(false)
const error = ref('')
const filter = ref<QueueFilter>('all')
const keyword = ref('')
const selectedKey = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined

const FILTERS: Array<{ key: QueueFilter; label: string }> = [
  { key: 'all', label: '全部任务' },
  { key: 'draft', label: '草稿' },
  { key: 'submitted', label: '待客户确认' },
  { key: 'rejected', label: '需调整' }
]

const STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  Draft: { label: '草稿', tone: 'todo' },
  Submitted: { label: '待客户确认', tone: 'pending' },
  Rejected: { label: '客户已驳回', tone: 'blocked' }
}

const RISK_META: Record<string, { label: string; tone: StatusTone }> = {
  Normal: { label: '正常', tone: 'done' },
  Warning: { label: '需关注', tone: 'pending' },
  Danger: { label: '高风险', tone: 'blocked' }
}

function statusOf(task: DesignerQuoteTask) {
  return STATUS_META[task.quoteStatus] ?? { label: task.quoteStatusName || '状态待确认', tone: 'info' as StatusTone }
}

function riskOf(task: DesignerQuoteTask) {
  return RISK_META[task.riskLevel] ?? { label: '风险待确认', tone: 'info' as StatusTone }
}

const selectedTask = computed(() => tasks.value.find((task) => String(task.quoteId) === selectedKey.value) ?? null)
const heroCustomer = computed<Partial<Customer> | null>(() => {
  const task = selectedTask.value
  if (!task) return null
  return {
    id: task.custId,
    name: task.customerName,
    phone: task.telNo,
    community: task.community,
    area: task.area ?? undefined,
    stage: task.customerStatus === 'Dormant' ? 'dormant' : 'quote'
  }
})
const currentQueueIndex = computed(() => tasks.value.findIndex((task) => String(task.quoteId) === selectedKey.value))
const nextTask = computed(() => {
  if (!tasks.value.length) return null
  if (currentQueueIndex.value < 0) return tasks.value[0] ?? null
  return tasks.value[currentQueueIndex.value + 1] ?? null
})

function syncQuery(): void {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(route.query)) {
    if (typeof value === 'string' && !['customerId', 'activePropertyId', 'quoteId'].includes(key)) query[key] = value
  }
  if (selectedTask.value?.custId) query.customerId = selectedTask.value.custId
  if (selectedTask.value?.propertyId) query.activePropertyId = selectedTask.value.propertyId
  if (selectedTask.value?.quoteId) query.quoteId = selectedTask.value.quoteId
  void router.replace({ query })
}

function selectTask(task: DesignerQuoteTask): void {
  selectedKey.value = String(task.quoteId)
  syncQuery()
}

async function load(reset = false, pinQuoteId = false): Promise<void> {
  if (reset) page.value = 1
  loading.value = true
  error.value = ''
  try {
    const requestedQuoteId = pinQuoteId ? String(route.query.quoteId ?? '') : ''
    const result = await workbenchApi.designerQuoteTasks({
      current: page.value,
      size: PAGE_SIZE,
      filter: filter.value,
      keyword: keyword.value,
      quoteId: requestedQuoteId || undefined
    })
    tasks.value = result.list
    total.value = result.total
    page.value = result.current
    pages.value = result.pages
    if (!tasks.value.some((task) => String(task.quoteId) === selectedKey.value)) {
      selectedKey.value = String(tasks.value[0]?.quoteId ?? '')
    }
    syncQuery()
  } catch (err) {
    tasks.value = []
    total.value = 0
    pages.value = 1
    selectedKey.value = ''
    error.value = err instanceof Error ? err.message : '待我谈单队列暂不可确认'
  } finally {
    loading.value = false
  }
}

function pageTo(next: number): void {
  if (next < 1 || next > pages.value || next === page.value || loading.value) return
  page.value = next
  void load()
}

function openQuote(task: DesignerQuoteTask): void {
  void router.push(`/designer/quotes/${task.quoteId}`)
}

function openHistory(): void {
  void router.push('/designer/quote-history')
}

function openCustomer(task: DesignerQuoteTask): void {
  if (!task.custId) return
  void router.push(`/designer/my-customers/${task.custId}`)
}

function callCustomer(task: DesignerQuoteTask): void {
  if (!task.telNo) return
  window.location.href = `tel:${task.telNo}`
}

function timeText(task: DesignerQuoteTask): string {
  if (task.quoteStatus === 'Rejected' && task.lastFeedbackAt) return `反馈于 ${formatRelativeDay(task.lastFeedbackAt)}`
  if (task.quoteStatus === 'Submitted' && task.submittedAt) return `提交于 ${formatDateTime(task.submittedAt)}`
  return `已停留 ${task.stayDays} 天`
}

watch(filter, () => { void load(true) })
watch(keyword, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void load(true) }, 300)
})
onMounted(() => { void load(true, true) })
onUnmounted(() => { if (searchTimer) clearTimeout(searchTimer) })
</script>

<template>
  <div class="dq">
    <header class="dq__head">
      <div>
        <p class="dq__eyebrow">方案报价 · 待我谈单</p>
        <h1>待我谈单</h1>
        <p>这里只展示当前需要设计师处理的草稿、待客户确认和需调整报价。已接受、已转项目和历史版本统一进入报价历史。</p>
      </div>
      <div class="dq__head-meta">
        <span><b>{{ total }}</b> 个当前任务</span>
        <span>第 {{ page }} / {{ pages }} 页</span>
        <button type="button" :class="{ 'is-loading': loading }" @click="load()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.3M21 3v6h-6" /></svg>
          刷新
        </button>
      </div>
    </header>

    <section class="dq__tools">
      <label class="dq__search">
        <span>搜索</span>
        <input v-model="keyword" type="search" placeholder="客户、电话、小区或报价编号" />
      </label>
      <div class="dq__filters">
        <button
          v-for="item in FILTERS"
          :key="item.key"
          type="button"
          :class="{ active: filter === item.key }"
          @click="filter = item.key"
        >
          {{ item.label }}
        </button>
      </div>
    </section>

    <WorkbenchState
      v-if="error && !tasks.length"
      variant="error"
      title="待我谈单队列暂不可确认"
      :description="error"
      action-text="重新加载"
      min-height="320px"
      @action="load"
    />

    <div v-else-if="loading && !tasks.length" class="dq__skeleton" aria-busy="true">
      <span v-for="n in 6" :key="n" />
    </div>

    <div v-else class="dq__layout">
      <aside class="dq__queue">
        <header class="dq__queue-head">
          <div><strong>待办报价</strong><small>只显示当前需要处理的报价</small></div>
          <span>{{ total }}</span>
        </header>

        <WorkbenchState
          v-if="!tasks.length"
          title="当前没有符合条件的报价"
          description="切换筛选或清空搜索；无结果不等于没有历史报价。"
          action-text="刷新"
          min-height="220px"
          @action="load"
        />
        <div v-else class="dq__queue-list">
          <button
            v-for="task in tasks"
            :key="task.quoteId"
            type="button"
            class="dq__task"
            :class="{ active: String(task.quoteId) === selectedKey }"
            @click="selectTask(task)"
          >
            <span class="dq__task-top">
              <strong>{{ task.customerName || '客户待完善' }}</strong>
              <StatusTag :tone="statusOf(task).tone" :text="statusOf(task).label" :dot="false" />
            </span>
            <span class="dq__task-property">{{ task.community || '房屋待补充' }} · V{{ task.version }} · {{ task.quoteNo }}</span>
            <span class="dq__task-money"><MoneyText :value="task.amount" size="sm" /></span>
            <span class="dq__task-meta">{{ timeText(task) }} · 调整 {{ task.adjustmentCount }} 次</span>
            <span v-if="task.riskReason" class="dq__task-risk">{{ task.riskReason }}</span>
          </button>
        </div>
        <footer v-if="total > 0" class="dq__pager">
          <el-pagination
            small
            background
            layout="prev, pager, next"
            :current-page="page"
            :page-size="PAGE_SIZE"
            :pager-count="5"
            :total="total"
            :disabled="loading"
            @current-change="pageTo"
          />
          <span class="dq__pager-total">{{ total }} 条</span>
        </footer>
      </aside>

      <main class="dq__workspace">
        <template v-if="selectedTask">
          <CustomerHeroCard
            :customer="heroCustomer"
            portrait-title="客户画像"
            portrait-hint="谈单前先确认客户需求、预算和当前顾虑"
            :can-manage-loss="canManageLoss"
            :property-id="selectedTask?.propertyId"
            :property-name="selectedTask?.community"
            loss-stage="Negotiation"
            @loss-updated="load(true)"
          >
            <template #title-prefix>
              <span class="dq__hero-object">{{ selectedTask.quoteNo }}</span>
              <span class="dq__hero-object-detail">「报价 V{{ selectedTask.version }}」</span>
            </template>
            <template #title-extra>
              <span class="dq__hero-sep">·</span>
              <StatusTag :tone="statusOf(selectedTask).tone" :text="statusOf(selectedTask).label" :dot="false" />
            </template>
            <template #focus>
              <HeroFocusItem
                label="报价金额"
                :value="`¥${selectedTask.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`"
                note="客户确认前以当前报价版本为准"
                tone="info"
              />
              <HeroFocusItem
                label="当前停留"
                :value="`${selectedTask.stayDays} 天`"
                :note="selectedTask.riskReason || '风险原因暂不可确认'"
                :tone="riskOf(selectedTask).tone"
              />
              <HeroFocusItem
                label="调整次数"
                :value="`${selectedTask.adjustmentCount} 次`"
                :note="selectedTask.nextActionLabel || '下一步待确认'"
                tone="pending"
              />
            </template>
            <template #portrait-action>
              <button class="dq__text-button" type="button" @click="openCustomer(selectedTask)">完整档案</button>
            </template>
          </CustomerHeroCard>

          <section class="dq__evidence">
            <header>
              <div><strong>谈单依据</strong><small>报价版本、客户确认和停留风险以当前业务记录为准</small></div>
              <StatusTag :tone="riskOf(selectedTask).tone" :text="riskOf(selectedTask).label" :dot="false" />
            </header>
            <dl>
              <div><dt>报价状态</dt><dd>{{ statusOf(selectedTask).label }}</dd></div>
              <div><dt>当前版本</dt><dd>V{{ selectedTask.version }}</dd></div>
              <div><dt>提交时间</dt><dd>{{ timeText(selectedTask) }}</dd></div>
              <div><dt>客户确认</dt><dd>{{ selectedTask.quoteStatus === 'Submitted' ? '等待客户反馈' : '按当前状态跟进' }}</dd></div>
            </dl>
          </section>

          <section class="dq__note">
            <strong>{{ riskOf(selectedTask).label }}</strong>
            <span>风险等级、停留天数和下一动作按当前报价事实统一展示。</span>
          </section>
        </template>

        <WorkbenchState
          v-else
          title="请选择一个待办报价"
          description="左侧只展示当前工作队列；历史报价请进入「报价历史」。"
          min-height="320px"
        />
      </main>

      <aside class="dq__guide">
        <template v-if="selectedTask">
          <section class="dq__guide-card dq__guide-card--primary" :class="`dq__guide-card--${riskOf(selectedTask).tone}`">
            <div class="dq__guide-title-row">
              <div>
                <p class="dq__eyebrow">本次谈单</p>
                <h3>{{ selectedTask.nextActionLabel || '继续处理报价' }}</h3>
              </div>
              <span class="dq__guide-order">{{ currentQueueIndex >= 0 ? `${currentQueueIndex + 1}/${tasks.length}` : '已完成' }}</span>
            </div>
            <p class="dq__guide-reason">{{ selectedTask.riskReason || '按当前报价状态进入工作区处理，所有状态与金额以服务端为准。' }}</p>
            <div class="dq__guide-inline"><span>下一步</span><b>{{ selectedTask.nextActionLabel || '待确认' }}</b></div>
            <button type="button" class="dq__primary" @click="openQuote(selectedTask)">进入报价工作区</button>
            <button v-if="selectedTask.telNo" type="button" class="dq__secondary" @click="callCustomer(selectedTask)">联系客户</button>
            <p class="dq__guide-note">动作完成后会更新报价、客户反馈和后续签约状态。</p>
            <div v-if="nextTask" class="dq__next-inline">
              <span>下一项</span>
              <button type="button" @click="selectTask(nextTask)">查看下一项</button>
            </div>
          </section>

          <section class="dq__guide-card">
            <header class="dq__actions-head"><div><h4>其他可执行操作</h4><small>在当前页面完成，不需要重新查找同一个客户</small></div></header>
            <div class="dq__action-grid">
              <WorkbenchQuickAction tone="brand" title="打电话" :hint="selectedTask.telNo ? '立即联系客户' : '电话待补充'" :disabled="!selectedTask.telNo" @click="selectedTask.telNo && callCustomer(selectedTask)">
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.8 2Z" /></svg></template>
              </WorkbenchQuickAction>
              <WorkbenchQuickAction tone="outline" title="完整档案" hint="查看客户历史与低频资料" @click="openCustomer(selectedTask)">
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h5M8 16h8" /></svg></template>
              </WorkbenchQuickAction>
              <WorkbenchQuickAction tone="measure" title="报价历史" hint="查看全部版本与客户反馈" @click="openHistory">
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l3 2" /><path d="M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Z" /></svg></template>
              </WorkbenchQuickAction>
              <WorkbenchQuickAction tone="outline" title="刷新数据" hint="重新读取报价与风险事实" @click="load()">
                <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.3M21 3v6h-6" /></svg></template>
              </WorkbenchQuickAction>
            </div>
          </section>
        </template>
        <WorkbenchState
          v-else
          title="请选择一个待办报价"
          description="右侧会显示当前风险、主要动作和下一项。"
          min-height="240px"
        />
      </aside>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/workbench-shell' as wb;
.dq { display: flex; flex-direction: column; gap: $space-4; padding: $space-5; min-width: 0; }
.dq__head { display: flex; align-items: flex-end; justify-content: space-between; gap: $space-5; }
.dq__head h1 { margin: 0; font-size: $font-display; color: $text-primary; }
.dq__head p { max-width: 780px; margin: $space-2 0 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
.dq__eyebrow { margin: 0 0 6px !important; color: $brand-600 !important; font-size: $font-caption !important; font-weight: $font-weight-semibold; letter-spacing: .09em; }
.dq__head-meta { display: flex; align-items: center; gap: $space-3; color: $text-secondary; font-size: $font-caption; }
.dq__head-meta b { color: $brand-700; font-size: $font-title; }
.dq__head-meta button { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; color: $text-secondary; font: inherit; cursor: pointer; }
.dq__head-meta button svg { width: 14px; height: 14px; }
.dq__head-meta button.is-loading svg { animation: dq-spin .7s linear infinite; }
@keyframes dq-spin { to { transform: rotate(360deg); } }
.dq__hero-object { color: $text-primary; font-size: $font-title; font-weight: $font-weight-semibold; }
.dq__hero-object-detail { color: $text-secondary; font-size: $font-body-sm; }
.dq__hero-sep { color: $text-tertiary; }
.dq__text-button { border: 0; background: transparent; color: $brand-700; font: inherit; font-size: $font-caption; cursor: pointer; }
.dq__tools { display: flex; align-items: end; justify-content: space-between; gap: $space-4; padding: $space-4; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.dq__search { display: flex; flex-direction: column; gap: 6px; min-width: 300px; color: $text-secondary; font-size: $font-caption; }
.dq__search input { height: 36px; padding: 0 10px; border: 1px solid $border-color; border-radius: $radius-sm; color: $text-primary; background: $surface-0; font: inherit; }
.dq__filters { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.dq__filters button { padding: 7px 11px; border: 1px solid $border-color; border-radius: $radius-pill; background: $surface-0; color: $text-secondary; font: inherit; font-size: $font-caption; cursor: pointer; }
.dq__filters button.active { border-color: $brand-300; background: $brand-50; color: $brand-700; }
.dq__filters small { color: $text-tertiary; }
.dq__layout { @include wb.workbench-layout(300px); min-height: 560px; }
.dq__queue { @include wb.workbench-queue; }
.dq__workspace { @include wb.workbench-workspace; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; padding: $space-5; overflow: hidden; }
.dq__guide { @include wb.workbench-guide; }
.dq__queue-head { display: flex; align-items: center; justify-content: space-between; gap: $space-3; padding: 16px 18px; border-bottom: 1px solid $border-color; background: linear-gradient(135deg, $surface-50, $surface-0); }
.dq__queue-head div { display: flex; flex-direction: column; gap: 3px; }
.dq__queue-head strong { color: $text-primary; font-size: $font-body; }
.dq__queue-head small { color: $text-tertiary; font-size: $font-caption; }
.dq__queue-head > span { color: $brand-700; font-size: $font-title; font-weight: $font-weight-bold; }
.dq__queue-list { @include wb.workbench-queue-scroll; display: flex; flex-direction: column; }
.dq__pager { display: flex; align-items: center; justify-content: center; gap: $space-2; padding: 10px 8px; border-top: 1px solid $border-color; color: $text-secondary; font-size: $font-caption; flex: 0 0 auto; }
.dq__pager :deep(.el-pagination) { margin: 0; }
.dq__pager :deep(.el-pagination.is-background .btn-prev),
.dq__pager :deep(.el-pagination.is-background .btn-next),
.dq__pager :deep(.el-pagination.is-background .el-pager li) { min-width: 24px; height: 24px; line-height: 24px; margin: 0 2px; }
.dq__pager-total { flex: 0 0 auto; }
.dq__task { display: flex; flex-direction: column; gap: 6px; width: 100%; padding: 14px 16px; border: 0; border-bottom: 1px solid $border-color; background: $surface-0; color: $text-secondary; text-align: left; cursor: pointer; }
.dq__task:hover { background: $surface-50; }
.dq__task.active { background: $brand-50; box-shadow: inset 3px 0 0 $brand-500; }
.dq__task-top, .dq__task-meta { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.dq__task-top strong { color: $text-primary; font-size: $font-body-sm; }
.dq__task-property, .dq__task-meta { color: $text-tertiary; font-size: $font-caption; }
.dq__task-money { color: $brand-700; font-size: $font-body; font-weight: $font-weight-semibold; }
.dq__task-risk { padding: 5px 8px; border-radius: $radius-sm; color: $danger-500; background: $danger-50; font-size: $font-caption; line-height: 1.5; }
.dq__workspace { display: flex; flex-direction: column; gap: $space-4; padding: $space-5; }
.dq__hero { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-4; }
.dq__hero h2 { margin: 0; color: $text-primary; font-size: $font-title; }
.dq__hero p:not(.dq__eyebrow) { margin: $space-2 0 0; color: $text-secondary; font-size: $font-body-sm; }
.dq__facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: $space-3; }
.dq__facts article { display: flex; flex-direction: column; gap: 6px; padding: 16px; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-50; }
.dq__facts small { color: $text-tertiary; font-size: $font-caption; }
.dq__facts strong { color: $text-primary; font-size: $font-body; }
.dq__evidence, .dq__guide-card { border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; overflow: hidden; }
.dq__evidence > header { display: flex; align-items: center; justify-content: space-between; gap: $space-3; padding: 14px 16px; border-bottom: 1px solid $border-color; background: linear-gradient(135deg, $surface-50, $surface-0); }
.dq__evidence header div { display: flex; flex-direction: column; gap: 3px; }
.dq__evidence header strong { color: $text-primary; font-size: $font-body-sm; }
.dq__evidence header small { color: $text-tertiary; font-size: $font-caption; }
.dq__evidence dl { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: $space-3; margin: 0; padding: $space-4; }
.dq__evidence dl div { padding: $space-3; border-radius: $radius-sm; background: $surface-50; }
.dq__evidence dt { color: $text-tertiary; font-size: $font-caption; }
.dq__evidence dd { margin: 5px 0 0; color: $text-primary; font-size: $font-body-sm; }
.dq__guide-card { padding: $space-4; }
.dq__guide-card--primary { border-color: $brand-200; background: linear-gradient(135deg, $brand-50, $surface-0); }
.dq__guide-card--blocked { border-color: $danger-200; background: linear-gradient(135deg, $danger-50, $surface-0); }
.dq__guide-card--pending { border-color: $warning-200; background: linear-gradient(135deg, $warning-50, $surface-0); }
.dq__guide-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; }
.dq__guide-title-row h3 { margin: 0; color: $text-primary; font-size: $font-title; }
.dq__guide-order { color: $text-tertiary; font-size: $font-caption; white-space: nowrap; }
.dq__guide-reason { margin: $space-3 0 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
.dq__guide-inline { display: flex; align-items: baseline; justify-content: space-between; gap: $space-2; margin-top: $space-3; padding: 10px 12px; border-radius: $radius-sm; background: rgba(255,255,255,.65); }
.dq__guide-inline span { color: $text-tertiary; font-size: $font-caption; }
.dq__guide-inline b { color: $text-primary; font-size: $font-body-sm; text-align: right; }
.dq__primary, .dq__secondary { width: 100%; min-height: 38px; margin-top: $space-3; border-radius: $radius-sm; font: inherit; cursor: pointer; }
.dq__primary { border: 1px solid $brand-500; color: $surface-0; background: $brand-500; }
.dq__secondary { border: 1px solid $border-color; color: $text-secondary; background: $surface-0; }
.dq__guide-note { margin: $space-2 0 0; color: $text-tertiary; font-size: $font-caption; line-height: 1.6; }
.dq__next-inline { display: flex; align-items: center; justify-content: space-between; gap: $space-2; margin-top: $space-4; padding-top: $space-3; border-top: 1px solid $border-color; color: $text-tertiary; font-size: $font-caption; }
.dq__next-inline button { border: 0; background: transparent; color: $brand-700; font: inherit; cursor: pointer; }
.dq__actions-head h4 { margin: 0; color: $text-primary; font-size: $font-body-sm; }
.dq__actions-head small { display: block; margin-top: 4px; color: $text-tertiary; font-size: $font-caption; }
.dq__action-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; margin-top: $space-3; }

.dq__note { display: flex; gap: $space-3; align-items: flex-start; padding: 14px 16px; border-radius: $radius-md; background: $surface-50; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.dq__note strong { flex: 0 0 auto; color: $text-primary; }
.dq__skeleton { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: $space-3; }
.dq__skeleton span { height: 160px; border-radius: $radius-md; background: linear-gradient(90deg, $surface-100 25%, $surface-50 37%, $surface-100 63%); background-size: 400% 100%; animation: dq-shimmer 1.4s ease infinite; }
@keyframes dq-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
@media (max-width: 1100px) { .dq__facts, .dq__evidence dl { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 760px) { .dq { padding: $space-3; } .dq__head, .dq__tools { align-items: stretch; flex-direction: column; } .dq__search { min-width: 0; } .dq__filters { justify-content: flex-start; } .dq__facts, .dq__evidence dl { grid-template-columns: 1fr; } }
</style>
