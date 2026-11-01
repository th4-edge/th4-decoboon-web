<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import NextActionPanel from '@/components/business-state/NextActionPanel.vue'
import MoneyText from '@/components/MoneyText.vue'
import StatusTag from '@/components/StatusTag.vue'
import WorkbenchState from '@/components/workbench/WorkbenchState.vue'
import PageHeader from '@/components/shell/PageHeader.vue'
import CustomerCreateSheet from '@/components/customer/CustomerCreateSheet.vue'
import { formatCount } from '@/core/format'
import NavIcon from '@/components/shell/NavIcon.vue'
import { crmApi } from '@/domains/crm/api'
import { STAGE_META, STAGE_ORDER, customerClock, lifecycleOf, mainlineActionOf } from '@/domains/crm/journey'
import type { CustomerStage, MyCustomerOverview } from '@/domains/crm/model'

const router = useRouter()

const KPI_KEYS = [
  'designerInProgressCustomerCount',
  'designerPendingMeasureCustomerCount',
  'designerQuotedCustomerCount',
  'designerSignedCustomerCount'
]
const CLOCK_KEYS = [
  'designerClockOverdueCount',
  'designerClockTodayCount',
  'designerClockSoonCount',
  'designerClockIdleCount'
]

/** 客户列表每页条数：与 App 一致，滚动到底自动加载下一页。 */
const PAGE_SIZE = 24

const overview = ref<MyCustomerOverview | null>(null)
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(false)
const current = ref(1)
const loadMoreError = ref('')
const listFooter = ref<HTMLElement | null>(null)
const error = ref('')
const keyword = ref('')
const stageFilter = ref<CustomerStage | ''>('')
const sort = ref<'risk' | 'due' | 'newest'>('risk')
const createOpen = ref(false)
const createdNotice = ref('')

const customers = computed(() => overview.value?.customers ?? [])
const stageCounts = computed(() => overview.value?.stageCounts ?? [])
const kpis = computed(() => pickMetrics(KPI_KEYS))
// 「逾期跟进」为 0 时不再渲染该提醒标签；其它经营时钟维持原口径。
const clocks = computed(() =>
  pickMetrics(CLOCK_KEYS).filter((item) => item.key !== 'designerClockOverdueCount' || item.value > 0)
)

function pickMetrics(keys: string[]) {
  const metrics = overview.value?.metrics ?? []
  return keys
    .map((key) => metrics.find((item) => item.key === key))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
}

function countOf(key: string): number {
  return stageCounts.value.find((item) => item.key === key)?.count ?? 0
}

/** 重新加载第一页：筛选 / 关键词 / 排序变化与刷新都走这里。 */
async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  loadMoreError.value = ''
  try {
    const data = await crmApi.myCustomerOverview({
      keyword: keyword.value.trim() || undefined,
      stage: stageFilter.value || undefined,
      sort: sort.value,
      current: 1,
      size: PAGE_SIZE
    })
    overview.value = data
    current.value = 1
    hasMore.value = data.hasMore
  } catch (err) {
    error.value = err instanceof Error ? err.message : '我的客户暂不可确认，请稍后重试'
  } finally {
    loading.value = false
  }
}

/** 加载下一页并追加；失败保留已加载内容，底部可重试。 */
async function loadMore(): Promise<void> {
  if (!hasMore.value || loading.value || loadingMore.value) return
  loadingMore.value = true
  loadMoreError.value = ''
  try {
    const data = await crmApi.myCustomerOverview({
      keyword: keyword.value.trim() || undefined,
      stage: stageFilter.value || undefined,
      sort: sort.value,
      current: current.value + 1,
      size: PAGE_SIZE
    })
    overview.value = overview.value
      ? { ...data, customers: [...overview.value.customers, ...data.customers] }
      : data
    current.value += 1
    hasMore.value = data.hasMore
  } catch (err) {
    loadMoreError.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loadingMore.value = false
  }
}

function setStage(next: CustomerStage | ''): void {
  stageFilter.value = next
  void load()
}

function setSort(next: 'risk' | 'due' | 'newest'): void {
  sort.value = next
  void load()
}

function openCustomer(id: string): void {
  void router.push(`/designer/my-customers/${id}`)
}

/** 新增成功后刷新列表并直接进入新客户 360，避免用户再搜一次。 */
async function onCustomerCreated(customer: { id: string; name: string }): Promise<void> {
  createOpen.value = false
  createdNotice.value = `已新增客户「${customer.name}」，正在打开客户 360`
  await load()
  void router.push(`/designer/my-customers/${customer.id}`)
}

let listObserver: IntersectionObserver | null = null

/** 列表底部进入视口即自动加载下一页；按钮兜底，避免滚动事件缺失时取不到更多客户。 */
watch(listFooter, (el) => {
  listObserver?.disconnect()
  listObserver = null
  if (!el || typeof IntersectionObserver === 'undefined') return
  listObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) void loadMore()
  }, { rootMargin: '160px 0px' })
  listObserver.observe(el)
})

onMounted(async () => {
  await load()
  await nextTick()
})

onBeforeUnmount(() => {
  listObserver?.disconnect()
  listObserver = null
})
</script>

<template>
  <div class="mc">
    <PageHeader title="我的客户" summary="只显示本人负责或指派给我设计的客户；点击客户卡片进入客户 360。">
      <template #actions>
        <div class="meta">
          <span v-if="overview?.asOf" class="live-note"><span class="live-dot" />数据更新于 {{ overview.asOf }}</span>
          <button class="refresh-btn" type="button" :class="{ spin: loading }" @click="load">
            <NavIcon name="refresh" />
            刷新
          </button>
        </div>
      </template>
    </PageHeader>

    <WorkbenchState
      v-if="error && !overview"
      variant="error"
      title="我的客户暂不可确认"
      :description="error"
      action-text="重新加载"
      min-height="320px"
      @action="load"
    />

    <template v-else>
      <!-- 区域一：我的客户概览（统计） -->
      <section class="mc__zone" aria-label="我的客户概览">
        <header class="mc__zone-head">
          <h2>客户概览</h2>
          <span>按当前数据范围汇总</span>
        </header>
        <div class="mc__kpis">
          <article v-for="item in kpis" :key="item.key" class="mc__kpi">
            <span class="mc__kpi-label">{{ item.label }}</span>
            <strong class="mc__kpi-value num">{{ formatCount(item.value) }}</strong>
            <small class="mc__kpi-sub">{{ item.subText }}</small>
          </article>
        </div>
        <div class="mc__clocks">
          <span v-for="item in clocks" :key="item.key" class="mc__clock" :class="`mc__clock--${item.key}`">
            <b class="num">{{ formatCount(item.value) }}</b>
            {{ item.label }}
          </span>
          <span class="mc__total">共 {{ formatCount(overview?.total ?? 0) }} 位客户</span>
        </div>
      </section>

      <!-- 区域二：筛选与查询 -->
      <section class="mc__zone" aria-label="筛选与查询">
        <header class="mc__zone-head">
          <h2>筛选与查询</h2>
          <span>阶段胶囊点击即筛选</span>
        </header>
        <div class="mc__stages" role="tablist" aria-label="客户阶段">
          <button type="button" class="mc__stage" :class="{ active: stageFilter === '' }" :aria-selected="stageFilter === ''" @click="setStage('')">
            全部<b class="num">{{ countOf('all') }}</b>
          </button>
          <button v-for="stage in STAGE_ORDER" :key="stage" type="button" class="mc__stage" :class="{ active: stageFilter === stage }" :aria-selected="stageFilter === stage" @click="setStage(stage)">
            {{ STAGE_META[stage].label }}<b class="num">{{ countOf(stage) }}</b>
          </button>
          <button type="button" class="mc__stage" :class="{ active: stageFilter === 'lost' }" :aria-selected="stageFilter === 'lost'" @click="setStage('lost')">
            {{ STAGE_META.lost.label }}<b class="num">{{ countOf('lost') }}</b>
          </button>
          <button v-if="countOf('assign')" type="button" class="mc__stage mc__stage--alert" :aria-selected="false" @click="setStage('pendingMeasure')">
            待指派设计<b class="num">{{ countOf('assign') }}</b>
          </button>
        </div>
        <div class="mc__query">
          <label class="mc__search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
            <input v-model="keyword" type="search" placeholder="搜索客户姓名、手机号、小区" @keyup.enter="load" />
          </label>
          <div class="mc__sorts">
            <button v-for="option in [{ key: 'risk', label: '风险优先' }, { key: 'due', label: '跟进到期' }, { key: 'newest', label: '最近录入' }]" :key="option.key" type="button" class="mc__sort" :class="{ active: sort === option.key }" @click="setSort(option.key as 'risk' | 'due' | 'newest')">
              {{ option.label }}
            </button>
          </div>
        </div>
      </section>

      <!-- 区域三：客户列表 -->
      <section class="mc__zone" aria-label="客户列表">
        <header class="mc__zone-head">
          <h2>客户列表</h2>
          <div class="mc__zone-ops">
            <span>{{ createdNotice || '点击任意客户进入客户 360' }}</span>
            <button class="mc__create" type="button" @click="createOpen = true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              新增客户
            </button>
          </div>
        </header>
        <div v-if="loading && !customers.length" class="mc__skeleton">
          <span v-for="n in 6" :key="n" class="mc__skeleton-card" />
        </div>
        <WorkbenchState
          v-else-if="!customers.length"
          title="没有符合条件的客户"
          description="切换阶段筛选或清空关键词后重试；也可能是当前范围内确实没有客户。"
          action-text="刷新"
          min-height="240px"
          @action="load"
        />
        <div v-else class="mc__cards">
          <article
            v-for="customer in customers"
            :key="customer.id"
            class="mc__card"
            role="button"
            tabindex="0"
            @click="openCustomer(customer.id)"
            @keydown.enter.prevent="openCustomer(customer.id)"
          >
            <header class="mc__card-head">
              <strong>{{ customer.name || '客户待完善' }}</strong>
              <BusinessStateTag object-key="customer" :status-key="customer.stage" />
            </header>
            <p class="mc__card-line">{{ customer.phone || '电话待补充' }} · {{ customer.community || '小区待补充' }}</p>
            <p class="mc__card-line">
              <span>{{ customer.area ? `${customer.area}㎡` : '面积待补充' }}</span>
              <span v-if="customer.budget">预算 <MoneyText :value="customer.budget" /></span>
              <span v-if="customer.grade">{{ customer.grade }} 级</span>
            </p>
            <div class="mc__card-chips">
              <StatusTag v-if="customerClock(customer)" :tone="customerClock(customer)!.tone" :text="customerClock(customer)!.label" :dot="false" />
              <StatusTag v-if="lifecycleOf(customer)" :tone="lifecycleOf(customer)!.tone" :text="lifecycleOf(customer)!.label" :dot="false" />
            </div>
            <NextActionPanel class="mc__card-action" compact :action="mainlineActionOf(customer)" title="主行动" />
            <p v-if="customer.riskReason" class="mc__card-risk">风险：{{ customer.riskReason }}</p>
          </article>
        </div>
        <div v-if="customers.length" ref="listFooter" class="mc__list-footer">
          <span v-if="loadingMore" class="mc__list-footer-text">加载中…</span>
          <button v-else-if="loadMoreError" type="button" class="mc__list-footer-retry" @click="loadMore">{{ loadMoreError }}，点击重试</button>
          <button v-else-if="hasMore" type="button" class="mc__list-footer-more" @click="loadMore">加载更多客户</button>
          <span v-else class="mc__list-footer-text">已经到底了</span>
        </div>
      </section>
    </template>

    <CustomerCreateSheet :open="createOpen" @close="createOpen = false" @created="onCustomerCreated" />
  </div>
</template>

<style scoped lang="scss">
.mc { display: flex; flex-direction: column; gap: $space-5; min-width: 0; }

.meta { display: flex; align-items: center; flex-wrap: wrap; gap: $space-3; color: $text-secondary; font-size: $font-caption; }
.live-note { display: inline-flex; align-items: center; }

.live-dot {
  width: 7px;
  height: 7px;
  margin-right: 8px;
  border-radius: 50%;
  background: $success-500;
  box-shadow: 0 0 0 4px $success-50;
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  color: $text-secondary;
  background: $surface-0;
  font: inherit;
  font-size: $font-caption;
  cursor: pointer;

  svg { width: 13px; height: 13px; }
  &:hover { color: $brand-600; border-color: $brand-300; background: $brand-50; }
  &.spin svg { animation: spin .7s linear infinite; }
}

@keyframes spin { to { transform: rotate(360deg); } }

/* 区域化：每个功能区分块并带标注 */
.mc__zone {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: 20px 22px;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
  box-shadow: $shadow-card;
}

.mc__zone-ops {
  display: inline-flex;
  align-items: center;
  gap: $space-3;

  span { color: $text-tertiary; font-size: 11px; }
}

.mc__create {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border: 0;
  border-radius: $radius-sm;
  color: $surface-0;
  background: $brand-500;
  font: inherit;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
  cursor: pointer;

  svg { width: 13px; height: 13px; }
  &:hover { background: $brand-600; }
}

.mc__zone-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: $space-3;

  h2 { margin: 0; color: $text-primary; font-size: $font-card-title; font-weight: $font-weight-semibold; }
  span { color: $text-tertiary; font-size: 11px; }
}

.mc__kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: $space-4; }

.mc__kpi {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 18px;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-50;
}

.mc__kpi-label { color: $text-secondary; font-size: $font-caption; }
.mc__kpi-value { color: $text-primary; font-size: $font-kpi; font-weight: $font-weight-bold; line-height: 1; letter-spacing: -.03em; }
.mc__kpi-sub { color: $text-tertiary; font-size: 11px; }

.mc__clocks { display: flex; align-items: center; flex-wrap: wrap; gap: $space-2; }

.mc__clock {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: $radius-pill;
  background: $surface-100;
  color: $text-secondary;
  font-size: $font-caption;

  b { color: $text-primary; font-weight: $font-weight-bold; }
}

.mc__clock--designerClockOverdueCount { background: $danger-50; color: $danger-500; b { color: $danger-500; } }
.mc__clock--designerClockTodayCount { background: $warning-50; color: $warning-700; b { color: $warning-700; } }
.mc__clock--designerClockSoonCount { background: $info-50; color: $info-500; b { color: $info-500; } }
.mc__total { margin-left: auto; color: $text-tertiary; font-size: $font-caption; }

.mc__stages { display: flex; flex-wrap: wrap; gap: $space-2; }

.mc__stage {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid $border-color;
  border-radius: $radius-pill;
  color: $text-secondary;
  background: $surface-0;
  font: inherit;
  font-size: $font-caption;
  cursor: pointer;
  transition: all .16s;

  b { color: $text-primary; font-weight: $font-weight-bold; }
  &:hover { border-color: $brand-300; color: $brand-600; }
  &.active { border-color: $brand-500; color: $surface-0; background: $brand-500; b { color: $surface-0; } }
}

.mc__stage--alert { border-color: $warning-200; color: $warning-700; }

.mc__query { display: flex; align-items: center; justify-content: space-between; gap: $space-4; flex-wrap: wrap; }

.mc__search {
  display: flex;
  align-items: center;
  gap: $space-2;
  flex: 1;
  min-width: 260px;
  max-width: 420px;
  height: 38px;
  padding: 0 14px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-50;
  color: $text-tertiary;

  svg { width: 15px; height: 15px; flex-shrink: 0; }
  input { flex: 1; border: 0; outline: none; background: none; font: inherit; font-size: $font-body-sm; color: $text-primary; }
  &:focus-within { border-color: $brand-300; background: $surface-0; box-shadow: $shadow-focus; }
}

.mc__sorts { display: inline-flex; gap: 2px; padding: 3px; border-radius: $radius-sm; background: $surface-100; }

.mc__sort {
  padding: 5px 12px;
  border: 0;
  border-radius: 6px;
  color: $text-secondary;
  background: transparent;
  font: inherit;
  font-size: $font-caption;
  cursor: pointer;

  &.active { color: $brand-700; background: $surface-0; font-weight: $font-weight-semibold; box-shadow: $shadow-card; }
}

.mc__cards,
.mc__skeleton { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: $space-4; }

.mc__skeleton-card {
  display: block;
  height: 172px;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: linear-gradient(100deg, $surface-50 20%, $surface-100 42%, $surface-50 64%);
  background-size: 220% 100%;
  animation: mc-shimmer 1.5s linear infinite;
}

.mc__card {
  display: flex;
  flex-direction: column;
  gap: $space-2;
  padding: 18px 20px;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
  box-shadow: $shadow-card;
  cursor: pointer;
  transition: transform .2s, box-shadow .2s, border-color .2s;

  &:hover { transform: translateY(-2px); border-color: $brand-300; box-shadow: $shadow-elevated; }
  &:focus-visible { outline: 2px solid $brand-500; outline-offset: 2px; }
}

.mc__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;

  strong { min-width: 0; overflow: hidden; color: $text-primary; font-size: $font-card-title; font-weight: $font-weight-semibold; text-overflow: ellipsis; white-space: nowrap; }
}

.mc__card-line { display: flex; flex-wrap: wrap; gap: 10px; margin: 0; color: $text-secondary; font-size: $font-caption; }
.mc__card-chips { display: flex; flex-wrap: wrap; gap: 6px; }

.mc__card-action {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 0;
  padding-top: $space-2;
  border-top: 1px dashed $border-color;
  color: $brand-600;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;

  small { color: $text-tertiary; font-size: 11px; font-weight: 400; }
}

.mc__card-risk {
  margin: 0;
  overflow: hidden;
  color: $danger-500;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mc__list-footer { display: flex; align-items: center; justify-content: center; min-height: 48px; padding: $space-2 0; }
.mc__list-footer-text { color: $text-tertiary; font-size: $font-caption; }
.mc__list-footer-more,
.mc__list-footer-retry { padding: 8px 18px; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; font-size: $font-caption; cursor: pointer; }
.mc__list-footer-more { color: $brand-600; }
.mc__list-footer-more:hover { border-color: $brand-300; }
.mc__list-footer-retry { color: $danger-500; }

@keyframes mc-shimmer {
  0% { background-position: 140% 0; }
  100% { background-position: -40% 0; }
}

@media (max-width: 1240px) {
  .mc__kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 720px) {
  .mc__kpis,
  .mc__cards,
  .mc__skeleton { grid-template-columns: 1fr; }
  .mc__total { margin-left: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .refresh-btn.spin svg,
  .mc__skeleton-card { animation: none; }
}
</style>
