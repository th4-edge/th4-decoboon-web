<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import StatusTag from '@/components/StatusTag.vue'
import MoneyText from '@/components/MoneyText.vue'
import EmptyState from '@/components/EmptyState.vue'
import { crmApi } from '@/domains/crm/api'
import type { Customer } from '@/domains/crm/model'
import { propertyApi } from '@/domains/property/api'
import type { Property } from '@/domains/property/model'
import { quoteDesignerPage } from '@/domains/trade/api'
import type { Quote } from '@/domains/trade/model'
import { projectApi } from '@/domains/project/api'
import type { ProjectBrief, ProjectStatus } from '@/domains/project/model'
import { formatDateTime, formatPercent } from '@/core/format'
import type { StatusTone } from '@/core/tone'

const PROJECT_STATUS_META: Record<ProjectStatus, { label: string; tone: StatusTone }> = {
  preparing: { label: '待开工', tone: 'info' },
  ongoing: { label: '施工中', tone: 'alert' },
  suspended: { label: '已停工', tone: 'blocked' },
  accepting: { label: '待验收', tone: 'pending' },
  finished: { label: '已完工', tone: 'done' },
  settled: { label: '已结算', tone: 'dark' }
}

const loading = ref(false)
const error = ref('')
const dataAsOf = ref('')
const customers = ref<Customer[]>([])
const properties = ref<Property[]>([])
const quotes = ref<Quote[]>([])
const projects = ref<ProjectBrief[]>([])

const measuredCount = computed(() => properties.value.filter((property) =>
  Boolean(property.latestMeasureAt) || ['measured', 'designing', 'quoted', 'contracted', 'serving', 'completed'].includes(property.status)
).length)

const designedCount = computed(() => properties.value.filter((property) =>
  ['designing', 'quoted', 'contracted', 'serving', 'completed'].includes(property.status)
).length)

const quotedPropertyCount = computed(() => new Set(
  quotes.value
    .filter((quote) => ['submitted', 'accepted', 'rejected', 'converted'].includes(quote.status))
    .map((quote) => quote.propertyId)
    .filter((id): id is string => Boolean(id))
).size)

const signedProjects = computed(() => projects.value)
const deliveredProjects = computed(() => projects.value.filter((project) => project.status === 'finished' || project.status === 'settled'))
const signedCustomerCount = computed(() => new Set(projects.value.map((project) => project.customerId).filter((id): id is string => Boolean(id))).size)
const signedAmount = computed(() => projects.value.reduce((sum, project) => sum + project.contractAmount, 0))
const quoteAcceptanceRate = computed(() => {
  const valid = quotes.value.filter((quote) => ['submitted', 'accepted', 'rejected', 'converted'].includes(quote.status))
  const accepted = valid.filter((quote) => quote.status === 'accepted' || quote.status === 'converted').length
  return valid.length ? accepted / valid.length : 0
})
const customerConversionRate = computed(() => customers.value.length ? signedCustomerCount.value / customers.value.length : 0)

const funnel = computed(() => {
  const levels = [
    { label: '负责客户', count: customers.value.length },
    { label: '完成量房', count: measuredCount.value },
    { label: '进入设计', count: designedCount.value },
    { label: '提交报价', count: quotedPropertyCount.value },
    { label: '签约成交', count: signedProjects.value.length },
    { label: '完工交付', count: deliveredProjects.value.length }
  ]
  return levels.map((level, index) => {
    const previous = index === 0 ? level.count : levels[index - 1].count
    return {
      ...level,
      rate: previous > 0 ? level.count / previous : 0,
      width: levels[0].count > 0 ? `${Math.max(8, (level.count / levels[0].count) * 100)}%` : '0%'
    }
  })
})

const maxLoss = computed(() => {
  let result = { from: '负责客户', to: '完成量房', loss: 0 }
  for (let index = 0; index < funnel.value.length - 1; index += 1) {
    const loss = Math.max(0, funnel.value[index].count - funnel.value[index + 1].count)
    if (loss > result.loss) result = { from: funnel.value[index].label, to: funnel.value[index + 1].label, loss }
  }
  return result
})

const monthlyDelivery = computed(() => {
  const map = new Map<string, number>()
  for (const project of deliveredProjects.value) {
    const date = project.planEndDate || project.createdAt
    const month = date ? date.slice(0, 7) : '待确认'
    map.set(month, (map.get(month) ?? 0) + 1)
  }
  return [...map.entries()].sort(([left], [right]) => left.localeCompare(right)).slice(-6)
})

const maxMonthly = computed(() => Math.max(1, ...monthlyDelivery.value.map(([, count]) => count)))

const detailProjects = computed(() => [...projects.value].sort((left, right) =>
  String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? ''))
))

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const [customerResult, propertyResult, quoteResult, projectResult] = await Promise.allSettled([
      crmApi.pageCustomers({ size: 200 }),
      propertyApi.listProperties(),
      quoteDesignerPage({ size: 200 }),
      projectApi.listProjects()
    ])
    customers.value = customerResult.status === 'fulfilled' ? customerResult.value : []
    properties.value = propertyResult.status === 'fulfilled' ? propertyResult.value : []
    quotes.value = quoteResult.status === 'fulfilled' ? quoteResult.value : []
    projects.value = projectResult.status === 'fulfilled' ? projectResult.value : []
    if ([customerResult, propertyResult, quoteResult, projectResult].every((result) => result.status === 'rejected')) {
      throw new Error('业绩数据全部加载失败')
    }
    dataAsOf.value = new Date().toISOString()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '我的业绩暂不可确认'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="pf">
    <header class="pf__head">
      <div>
        <p class="pf__eyebrow">MY PERFORMANCE · DATA AS OF</p>
        <h2>我的业绩</h2>
        <p>只看本人负责客户、报价和项目的经营结果；不展示项目成本、毛利和利润，也不把本地推算当作服务端正式指标。</p>
      </div>
      <div class="pf__head-actions">
        <span>数据截止：{{ formatDateTime(dataAsOf) }}</span>
        <el-button type="primary" @click="load">刷新业绩</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />

    <section v-if="loading && !customers.length" class="pf__loading"><el-skeleton :rows="7" animated /></section>
    <template v-else>
      <section class="pf__hero">
        <div class="pf__hero-main">
          <span>累计签约业绩</span>
          <strong><MoneyText :value="signedAmount" size="lg" /></strong>
          <small>已签约客户 {{ signedCustomerCount }} 户 · 项目 {{ signedProjects.length }} 个</small>
        </div>
        <div class="pf__metrics">
          <div><span>已完工项目</span><b>{{ deliveredProjects.length }}</b></div>
          <div><span>报价接受率</span><b>{{ formatPercent(quoteAcceptanceRate) }}</b></div>
          <div><span>客户转化率</span><b>{{ formatPercent(customerConversionRate) }}</b></div>
        </div>
      </section>

      <section class="pf__board">
        <div class="pf__funnel">
          <div class="pf__section-head"><div><h3>设计转化漏斗</h3><p>按当前本人可见客户、房屋、报价和项目事实计算。</p></div><span>{{ maxLoss.loss ? `最大流失：${maxLoss.from} → ${maxLoss.to} ${maxLoss.loss}` : '漏斗无流失' }}</span></div>
          <div class="pf__funnel-list">
            <div v-for="level in funnel" :key="level.label" class="pf__funnel-item">
              <div><span>{{ level.label }}</span><b>{{ level.count }}</b><em>{{ formatPercent(level.rate) }}</em></div>
              <div class="pf__funnel-track"><i :style="{ width: level.width }" /></div>
            </div>
          </div>
        </div>

        <div class="pf__monthly">
          <div class="pf__section-head"><div><h3>完工节奏</h3><p>最近六个月实际 / 计划完工项目数。</p></div></div>
          <EmptyState v-if="!monthlyDelivery.length" title="暂无完工节奏" description="项目完工后会形成月度交付事实。" />
          <div v-else class="pf__bars">
            <div v-for="[month, count] in monthlyDelivery" :key="month" class="pf__bar-item">
              <b>{{ count }}</b>
              <div><i :style="{ height: `${Math.max(12, (count / maxMonthly) * 100)}%` }" /></div>
              <small>{{ month }}</small>
            </div>
          </div>
        </div>
      </section>

      <section class="pf__table">
        <div class="pf__section-head"><div><h3>签约与交付明细</h3><p>项目金额为合同金额，不含成本、毛利和回款。</p></div><span>{{ detailProjects.length }} 个项目</span></div>
        <EmptyState v-if="!detailProjects.length" title="暂无签约项目" description="客户接受报价、合同生效并立项后，项目会进入业绩明细。" />
        <div v-else class="pf__table-scroll">
          <div class="pf__row pf__row--head"><span>客户 / 房屋</span><span>项目编号</span><span>状态</span><span>合同金额</span><span>开工计划</span><span>完工计划</span></div>
          <div v-for="project in detailProjects" :key="project.id" class="pf__row">
            <span><strong>{{ project.customerName || '客户待补充' }}</strong><small>{{ project.propertyName || project.community || '房屋待补充' }}</small></span>
            <span>{{ project.no }}</span>
            <span><StatusTag :tone="PROJECT_STATUS_META[project.status].tone" :text="PROJECT_STATUS_META[project.status].label" /></span>
            <span><MoneyText :value="project.contractAmount" /></span>
            <span>{{ project.startDate || '—' }}</span>
            <span>{{ project.planEndDate || '—' }}</span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
.pf {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: $space-5;
}

.pf__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;

  h2 { margin: $space-1 0; font-size: $font-display; }
  p { margin: 0; max-width: 780px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
}

.pf__eyebrow {
  color: $brand-600 !important;
  font-size: $font-caption !important;
  font-weight: $font-weight-semibold;
  letter-spacing: .1em;
}

.pf__head-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: $space-2;

  span { color: $text-secondary; font-size: $font-caption; }
}

.pf__hero {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(360px, 1fr);
  gap: $space-4;
  padding: $space-5;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: linear-gradient(135deg, $brand-50 0%, $surface-0 72%);
  box-shadow: $shadow-card;
}

.pf__hero-main {
  span { color: $text-secondary; font-size: $font-body-sm; }
  strong { display: block; margin: $space-2 0; font-size: $font-hero; color: $brand-700; }
  small { color: $text-secondary; font-size: $font-body-sm; }
}

.pf__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $space-3;

  div { display: flex; flex-direction: column; gap: 3px; padding: $space-3; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; }
  span { color: $text-secondary; font-size: $font-caption; }
  b { font-size: $font-title; }
}

.pf__board {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(360px, 1fr);
  gap: $space-4;
}

.pf__funnel,
.pf__monthly,
.pf__table {
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  box-shadow: $shadow-card;
  overflow: hidden;
}

.pf__section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-3;
  padding: $space-4;
  border-bottom: 1px solid $border-color;

  h3 { margin: 0 0 $space-1; font-size: $font-title; }
  p { margin: 0; color: $text-secondary; font-size: $font-caption; }
  > span { color: $text-tertiary; font-size: $font-caption; }
}

.pf__funnel-list { display: flex; flex-direction: column; gap: $space-3; padding: $space-4; }
.pf__funnel-item > div:first-child { display: grid; grid-template-columns: 100px 60px 1fr; align-items: center; gap: $space-2; margin-bottom: $space-2; }
.pf__funnel-item span { color: $text-secondary; font-size: $font-body-sm; }
.pf__funnel-item b { font-size: $font-card-title; }
.pf__funnel-item em { color: $text-tertiary; font-size: $font-caption; font-style: normal; text-align: right; }
.pf__funnel-track { height: 10px; border-radius: $radius-pill; background: $surface-100; overflow: hidden; }
.pf__funnel-track i { display: block; height: 100%; background: linear-gradient(90deg, $brand-600, $brand-400); }

.pf__bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  gap: $space-3;
  min-height: 260px;
  padding: $space-4;
}

.pf__bar-item {
  flex: 1;
  display: grid;
  grid-template-rows: 24px 1fr 24px;
  justify-items: center;
  gap: $space-2;
  height: 220px;

  b { color: $brand-700; font-size: $font-body-sm; }
  > div { width: 100%; display: flex; align-items: flex-end; justify-content: center; }
  i { display: block; width: 44px; min-height: 12px; border-radius: $radius-sm $radius-sm 0 0; background: $brand-400; }
  small { color: $text-secondary; font-size: $font-caption; }
}

.pf__table-scroll { min-width: 980px; overflow-x: auto; }
.pf__row {
  display: grid;
  grid-template-columns: minmax(200px, 1.4fr) 140px 120px 140px 120px 120px;
  align-items: center;
  gap: $space-3;
  min-height: 58px;
  padding: 0 $space-4;
  border-bottom: 1px solid $border-color;
  font-size: $font-body-sm;

  strong,
  small { display: block; }
  small { margin-top: 3px; color: $text-secondary; font-size: $font-caption; }
  > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}

.pf__row--head {
  min-height: 42px;
  background: $surface-50;
  color: $text-secondary;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
}

.pf__loading { padding: $space-5; }

@media (max-width: 1280px) {
  .pf__hero,
  .pf__board { grid-template-columns: 1fr; }
}

@media (max-width: 1024px) {
  .pf__head { flex-direction: column; }
  .pf__head-actions { align-items: flex-start; }
  .pf__metrics { grid-template-columns: 1fr; }
  .pf__table { overflow-x: auto; }
}
</style>
