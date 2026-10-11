<script setup lang="ts">
/**
 * 业务员「我的业绩」——App 侧对应 `subpackages/statistic/pages/performance.vue` 的业务员分支（`view:performance`）。
 *
 * 纪律：
 * - 数据全部来自 `statistic/marketer/report`（**App 已在用**，非新开接口），前端**不做任何金额/比率/排名计算**；
 * - **不展示成本、利润、毛利**（业务员不可见，`BR-006`）；本页只有报价额、客户已接受额与签约额（客户侧金额）；
 * - 结论 → 可执行：每个"我该做什么"都给出进入对应工作面的入口（不留只有数字没有动作的看板）。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ProviderError } from '@/core/http'
import { workbenchApi } from '@/domains/workbench/api'
import type { MarketerPerformanceReport, PerformanceRankingItem } from '@/domains/workbench/model'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'

const router = useRouter()
const report = ref<MarketerPerformanceReport | null>(null)
const loading = ref(false)
const error = ref('')

/** 首屏第一答案（App 业务员业绩页同款）：本月录入客户 / 本月量房率 / 本月跟进。 */
const headline = computed(() => {
  const data = report.value
  if (!data) return null
  return {
    inputMonth: data.customerInputMonth,
    measureRateMonth: data.measureRateMonth,
    followMonth: data.followMonth
  }
})

const structure = computed(() => {
  const data = report.value
  if (!data) return []
  return [
    { label: '客户总数', value: data.customerCount, filter: '' },
    { label: '跟进中', value: data.followingCustomerCount, filter: 'following' },
    { label: '待量房', value: data.pendingMeasureCount, filter: 'pendingMeasure' },
    { label: '已报价', value: data.quotedCustomerCount, filter: 'quote' },
    { label: '成交客户', value: data.signedCustomerCount, filter: 'sign' },
    { label: '已流失', value: data.lostCustomerCount, filter: 'lost' }
  ]
})

/** 跟进压力 = 该我动的活；点击直接带上阶段筛选进入「我的客户」。 */
const followPressure = computed(() => {
  const data = report.value
  if (!data) return []
  return [
    { key: 'due', label: '到期跟进', value: data.followDueCount, hint: '已到约定跟进时间，尚未记录新的跟进事实' },
    { key: 'overdue', label: '逾期跟进', value: data.followOverdueCount, hint: '超过约定跟进时间，客户随时可能被别家签走', danger: data.followOverdueCount > 0 }
  ]
})

const amountRows = computed(() => {
  const data = report.value
  if (!data) return []
  return [
    { label: '报价金额', value: data.quoteAmount, hint: `草稿 ${data.draftQuoteCount} · 已提交 ${data.submittedQuoteCount}` },
    { label: '客户已接受', value: data.acceptedQuoteAmount, hint: '客户已接受但尚未转入签约的部分' },
    { label: '签约金额', value: data.signedAmount, hint: `成交客户 ${data.signedCustomerCount} 位` }
  ]
})

interface TrendCell { label: string; value: number; trend: number; suffix?: string }

const trends = computed((): Array<{ key: string; label: string; cells: TrendCell[] }> => {
  const data = report.value
  if (!data) return []
  return [
    { key: 'input', label: '录入客户', cells: [
      { label: '今日', value: data.customerInputDay.current, trend: data.customerInputDay.growthRate },
      { label: '本周', value: data.customerInputWeek.current, trend: data.customerInputWeek.growthRate },
      { label: '本月', value: data.customerInputMonth.current, trend: data.customerInputMonth.growthRate }
    ] },
    { key: 'follow', label: '写跟进', cells: [
      { label: '今日', value: data.followDay.current, trend: data.followDay.growthRate },
      { label: '本周', value: data.followWeek.current, trend: data.followWeek.growthRate },
      { label: '本月', value: data.followMonth.current, trend: data.followMonth.growthRate }
    ] },
    { key: 'measureRate', label: '量房率', cells: [
      { label: '今日', value: data.measureRateDay.currentRate, trend: data.measureRateDay.change, suffix: '%' },
      { label: '本周', value: data.measureRateWeek.currentRate, trend: data.measureRateWeek.change, suffix: '%' },
      { label: '本月', value: data.measureRateMonth.currentRate, trend: data.measureRateMonth.change, suffix: '%' }
    ] }
  ]
})

/** 黄金客户分布：距首次联系的天数分档（App 同款文案与分档）。 */
const goldenBands = computed(() => {
  const data = report.value
  if (!data) return []
  const max = Math.max(data.goldenHotCount, data.goldenWarmCount, data.goldenCoolingCount, data.goldenRiskCount, 1)
  return [
    { label: '0-3 天 · 黄金期', value: data.goldenHotCount, tone: 'hot' },
    { label: '4-7 天 · 热度期', value: data.goldenWarmCount, tone: 'warm' },
    { label: '8-15 天 · 降温期', value: data.goldenCoolingCount, tone: 'cooling' },
    { label: '15 天+ · 风险期', value: data.goldenRiskCount, tone: 'risk' }
  ].map((band) => ({ ...band, width: `${Math.max(6, Math.round((band.value / max) * 100))}%` }))
})

/** 榜单：业务员榜（我 vs 同事）与门店榜。 */
const rankTables = computed(() => {
  const data = report.value
  if (!data) return []
  return [
    { key: 'marketer', title: '业务员榜', mine: data.myMarketerRank, total: data.companyMarketerCount, rows: data.marketerRankings },
    { key: 'store', title: '门店榜', mine: data.myStoreRank, total: data.companyStoreCount, rows: data.storeRankings }
  ]
})

function trendText(trend: number): string {
  if (!trend) return '与上期持平'
  return `${trend > 0 ? '↑' : '↓'} ${Math.abs(Math.round(trend * 10) / 10)}%`
}

function goCustomers(filter: string): void {
  void router.push({ path: '/workbench/my-customers', query: filter ? { stage: filter } : {} })
}

function goCustomerDetail(customerId: string): void {
  void router.push({ path: '/workbench/my-customers', query: { customerId } })
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    report.value = await workbenchApi.marketerPerformanceReport()
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '我的业绩暂不可确认'
  } finally {
    loading.value = false
  }
}

onMounted(() => { void load() })
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">MY PERFORMANCE · 我的业绩</span>
        <h1>我的业绩</h1>
        <p>本人客户转化的结论与下一步：录入、跟进、量房率、报价与签约金额、客户阶段结构、黄金期分布与同岗排名。数据只读，不展示成本与利润。</p>
      </div>
      <div class="finance-actions">
        <el-button @click="load">刷新</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default><el-button size="small" plain @click="load">重新加载</el-button></template>
    </el-alert>

    <SkeletonBlock v-if="loading && !report" variant="table" :rows="8" />

    <template v-else-if="report">
      <!-- 第一答案：本月录入 / 本月量房率 / 本月跟进 -->
      <PanelCard v-if="headline">
        <div class="perf-headline">
          <div class="perf-headline__main">
            <span class="perf-headline__eyebrow">本月录入客户</span>
            <strong class="perf-headline__value">{{ headline.inputMonth.current }}</strong>
            <span class="perf-headline__unit">位</span>
            <span class="perf-headline__trend">{{ trendText(headline.inputMonth.growthRate) }}</span>
          </div>
          <div class="perf-headline__side">
            <div>
              <span class="perf-kv__label">本月量房率</span>
              <strong class="perf-kv__value">{{ headline.measureRateMonth.currentRate }}%</strong>
              <small class="perf-kv__hint">{{ trendText(headline.measureRateMonth.change) }}</small>
            </div>
            <div>
              <span class="perf-kv__label">本月跟进</span>
              <strong class="perf-kv__value">{{ headline.followMonth.current }}</strong>
              <small class="perf-kv__hint">{{ trendText(headline.followMonth.growthRate) }}</small>
            </div>
            <div>
              <span class="perf-kv__label">转化率 / 平均转化天数</span>
              <strong class="perf-kv__value">{{ report.conversionRate }}% · {{ report.averageConversionDays }} 天</strong>
              <small class="perf-kv__hint">已转化 {{ report.convertedCustomerCount }} 位</small>
            </div>
          </div>
        </div>
      </PanelCard>

      <!-- 该我动的活：跟进压力 -->
      <PanelCard title="该我处理" subtitle="到期与逾期跟进——业务员的第一动作">
        <el-alert
          v-if="!report.followDueCount && !report.followOverdueCount"
          type="success"
          :closable="false"
          show-icon
          title="当前没有到期或逾期的跟进"
          description="新的跟进到期后会出现在这里，并同步到「我的客户」。"
        />
        <div v-else class="perf-pressure">
          <button
            v-for="item in followPressure"
            :key="item.key"
            type="button"
            class="perf-pressure__card"
            :class="{ 'perf-pressure__card--danger': item.danger }"
            @click="goCustomers('following')"
          >
            <span class="perf-pressure__label">{{ item.label }}</span>
            <strong class="perf-pressure__value">{{ item.value }}</strong>
            <small class="perf-pressure__hint">{{ item.hint }}</small>
            <span class="perf-pressure__cta">去我的客户处理 →</span>
            <small class="perf-pressure__note">进入「跟进中」客户池；到期与逾期请按列表的「下次跟进」列核对（服务端暂不支持按到期筛选）</small>
          </button>
        </div>
      </PanelCard>

      <!-- 客户阶段结构 -->
      <PanelCard title="客户阶段结构" subtitle="点击任一阶段进入对应客户池">
        <div class="perf-grid">
          <button v-for="item in structure" :key="item.label" type="button" class="perf-cell" @click="goCustomers(item.filter)">
            <span class="perf-cell__label">{{ item.label }}</span>
            <strong class="perf-cell__value">{{ item.value }}</strong>
          </button>
        </div>
      </PanelCard>

      <!-- 金额（客户侧，不含成本利润） -->
      <PanelCard title="报价与签约金额" subtitle="均为客户侧金额；成本与利润对业务员不可见，故不生成区块">
        <div class="perf-grid">
          <div v-for="item in amountRows" :key="item.label" class="perf-cell perf-cell--static">
            <span class="perf-cell__label">{{ item.label }}</span>
            <strong class="perf-cell__value"><MoneyText :value="item.value" /></strong>
            <small class="perf-cell__hint">{{ item.hint }}</small>
          </div>
        </div>
      </PanelCard>

      <!-- 趋势 -->
      <PanelCard title="我的节奏" subtitle="今日 / 本周 / 本月（口径由服务端给出）">
        <div class="perf-trends">
          <div v-for="group in trends" :key="group.key" class="perf-trend">
            <span class="perf-trend__title">{{ group.label }}</span>
            <div class="perf-trend__cells">
              <div v-for="cell in group.cells" :key="cell.label" class="perf-trend__cell">
                <span class="perf-kv__label">{{ cell.label }}</span>
                <strong class="perf-kv__value">{{ cell.value }}{{ cell.suffix ?? '' }}</strong>
                <small class="perf-kv__hint">{{ trendText(cell.trend) }}</small>
              </div>
            </div>
          </div>
        </div>
      </PanelCard>

      <!-- 黄金客户分布 -->
      <PanelCard title="黄金客户分布" subtitle="距首次联系的天数分档：越靠前越容易转化">
        <div class="perf-golden">
          <div v-for="band in goldenBands" :key="band.label" class="perf-golden__row">
            <div class="perf-golden__head">
              <span>{{ band.label }}</span>
              <strong :class="{ 'perf-golden__value--risk': band.tone === 'risk' }">{{ band.value }}</strong>
            </div>
            <div class="perf-golden__track">
              <div class="perf-golden__bar" :class="`perf-golden__bar--${band.tone}`" :style="{ width: band.width }" />
            </div>
          </div>
        </div>
      </PanelCard>

      <!-- 排名 -->
      <PanelCard title="同岗排名" subtitle="我的名次来自服务端；榜单口径与范围由服务端裁剪">
        <div class="perf-ranks">
          <div v-for="table in rankTables" :key="table.key" class="perf-rank">
            <div class="perf-rank__head">
              <strong>{{ table.title }}</strong>
              <span>我的名次 {{ table.mine || '—' }} / {{ table.total || '—' }}</span>
            </div>
            <EmptyState v-if="!table.rows.length" title="暂无榜单" description="同岗数据不足时服务端不返回榜单。" />
            <el-table v-else :data="table.rows" size="small" stripe>
              <el-table-column label="名次" width="70"><template #default="{ row }">{{ (row as PerformanceRankingItem).rank }}</template></el-table-column>
              <el-table-column label="姓名" min-width="110"><template #default="{ row }">{{ (row as PerformanceRankingItem).name }}</template></el-table-column>
              <el-table-column label="客户" width="70" align="right"><template #default="{ row }">{{ (row as PerformanceRankingItem).customerCount }}</template></el-table-column>
              <el-table-column label="量房" width="70" align="right"><template #default="{ row }">{{ (row as PerformanceRankingItem).measureCount }}</template></el-table-column>
              <el-table-column label="跟进" width="70" align="right"><template #default="{ row }">{{ (row as PerformanceRankingItem).followCount }}</template></el-table-column>
              <el-table-column label="量房率" width="90" align="right"><template #default="{ row }">{{ (row as PerformanceRankingItem).measureRate }}%</template></el-table-column>
            </el-table>
          </div>
        </div>
      </PanelCard>

      <!-- 最近客户 / 最近项目（只读） -->
      <PanelCard title="最近客户" subtitle="点击进入该客户工作面（本人客户范围内）">
        <EmptyState v-if="!report.recentCustomers.length" title="暂无客户" description="登记客户后，这里会出现最近跟进的对象。" />
        <el-table v-else :data="report.recentCustomers" size="small" stripe>
          <el-table-column prop="name" label="客户" min-width="120" />
          <el-table-column prop="community" label="小区" min-width="140"><template #default="{ row }">{{ row.community || '—' }}</template></el-table-column>
          <el-table-column label="最近跟进" width="160"><template #default="{ row }">{{ row.lastFollowAt || '—' }}</template></el-table-column>
          <el-table-column label="操作" width="100"><template #default="{ row }"><el-button link type="primary" @click="goCustomerDetail(row.id)">进入</el-button></template></el-table-column>
        </el-table>
      </PanelCard>

      <PanelCard title="最近项目（只读）" subtitle="客户签约立项后可见；业务员不参与项目写操作">
        <EmptyState v-if="!report.recentProjects.length" title="暂无项目" description="客户签约立项后，这里会出现只读进度。" />
        <el-table v-else :data="report.recentProjects" size="small" stripe>
          <el-table-column prop="name" label="项目" min-width="160" />
          <el-table-column prop="customerName" label="客户" width="120"><template #default="{ row }">{{ row.customerName || '—' }}</template></el-table-column>
          <el-table-column label="进度" width="80" align="right"><template #default="{ row }">{{ row.progress }}%</template></el-table-column>
          <el-table-column label="当前阶段" min-width="120"><template #default="{ row }">{{ row.currentStageName || '—' }}</template></el-table-column>
          <el-table-column label="状态" width="120"><template #default="{ row }"><StatusTag :text="String(row.status)" tone="info" /></template></el-table-column>
        </el-table>
      </PanelCard>

      <p v-if="report" class="perf-footnote">
        数据只读，不参与状态机或金额裁决；后台统计任务按周期更新。客户数与金额取自服务端，前端不做二次计算。
      </p>
    </template>
  </div>
</template>

<style scoped lang="scss">
.perf-headline {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: $space-5;
  flex-wrap: wrap;
}

.perf-headline__main {
  display: flex;
  align-items: baseline;
  gap: $space-2;
}

.perf-headline__eyebrow {
  font-size: $font-body-sm;
  color: $text-secondary;
}

.perf-headline__value {
  font-size: 34px;
  line-height: 1.1;
}

.perf-headline__unit {
  font-size: $font-body-sm;
  color: $text-secondary;
}

.perf-headline__trend {
  font-size: $font-caption;
  color: $text-tertiary;
}

.perf-headline__side {
  display: flex;
  gap: $space-5;
  flex-wrap: wrap;
}

.perf-kv__label {
  display: block;
  font-size: $font-caption;
  color: $text-secondary;
}

.perf-kv__value {
  font-size: $font-card-title;
}

.perf-kv__hint {
  display: block;
  font-size: $font-caption;
  color: $text-tertiary;
}

.perf-pressure {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: $space-3;
}

.perf-pressure__card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: $space-4;
  text-align: left;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  cursor: pointer;

  &:hover { border-color: $brand-500; }
}

.perf-pressure__card--danger {
  border-color: $danger-200;
  background: $danger-50;
}

.perf-pressure__label {
  font-size: $font-caption;
  color: $text-secondary;
}

.perf-pressure__value {
  font-size: $font-title;
}

.perf-pressure__hint {
  font-size: $font-caption;
  color: $text-tertiary;
}

.perf-pressure__cta {
  margin-top: $space-2;
  font-size: $font-body-sm;
  color: $brand-600;
  font-weight: $font-weight-semibold;
}

.perf-pressure__note {
  font-size: $font-caption;
  color: $text-tertiary;
}

.perf-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: $space-3;
}

.perf-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: $space-3 $space-4;
  text-align: left;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  cursor: pointer;

  &:hover { border-color: $brand-500; }
}

.perf-cell--static {
  cursor: default;

  &:hover { border-color: $border-color; }
}

.perf-cell__label {
  font-size: $font-caption;
  color: $text-secondary;
}

.perf-cell__value {
  font-size: $font-card-title;
}

.perf-cell__hint {
  font-size: $font-caption;
  color: $text-tertiary;
}

.perf-trends {
  display: flex;
  flex-direction: column;
  gap: $space-3;
}

.perf-trend {
  display: flex;
  align-items: center;
  gap: $space-4;
  flex-wrap: wrap;
}

.perf-trend__title {
  min-width: 72px;
  font-size: $font-body-sm;
  color: $text-secondary;
}

.perf-trend__cells {
  display: flex;
  gap: $space-5;
  flex-wrap: wrap;
}

.perf-trend__cell {
  min-width: 96px;
}

.perf-golden {
  display: flex;
  flex-direction: column;
  gap: $space-3;
}

.perf-golden__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: $font-body-sm;
  color: $text-secondary;
}

.perf-golden__value--risk {
  color: $danger-500;
}

.perf-golden__track {
  height: 8px;
  border-radius: 4px;
  background: $surface-100;
  overflow: hidden;
}

.perf-golden__bar {
  height: 100%;
  border-radius: 4px;
}

.perf-golden__bar--hot { background: $success-500; }
.perf-golden__bar--warm { background: $brand-500; }
.perf-golden__bar--cooling { background: $warning-500; }
.perf-golden__bar--risk { background: $danger-500; }

.perf-ranks {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: $space-4;
}

.perf-rank__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $space-2;
  font-size: $font-body-sm;
  color: $text-secondary;
}

.perf-footnote {
  margin: 0;
  font-size: $font-caption;
  color: $text-tertiary;
}
</style>
