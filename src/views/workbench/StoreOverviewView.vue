<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ProviderError } from '@/core/http'
import { statisticApi } from '@/domains/statistic/api'
import type { StoreMonthlyTarget, StoreProfitReport, StoreReport } from '@/domains/statistic/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import { useStoreScopeStore } from '@/stores/storeScope'
import { useSessionStore } from '@/stores/session'

/**
 * 门店经营概览（店长本店范围；DEC-076 起含本店目标与经营利润参考）。
 * 数据全部取 `statistic/store/report`，服务端按登录员工的门店数据范围裁剪。
 *
 * **成本/毛利边界（依据事实而非取舍）**：
 * 该 Provider **不返回成本、毛利，也不返回成本完整性标记**；若把「最近项目」里的 `cost` 拿出来展示，
 * 既没有完整性标记、又极易被读成利润依据（`BR-003` 明确采购执行价不得被解释为综合成本）。
 * 因此本页**不展示任何成本字段**，并在页面写明：展示成本/毛利需后端提供成本完整性投影后再按 `BR-003` 定边界。
 */
const scope = useStoreScopeStore()
const session = useSessionStore()
const report = ref<StoreReport | null>(null)
const profit = ref<StoreProfitReport | null>(null)
const target = ref<StoreMonthlyTarget | null>(null)
const targetSaving = ref(false)
const targetError = ref('')
const loading = ref(false)
const error = ref('')
const currentMonth = new Date().toISOString().slice(0, 7)

/**
 * 「全部门店」视图（`DESIGN-BIZ-20261013-003` P0D-02）：本页含人员结构与比率类指标，
 * **不提供全部门店合计**（比率不可简单相加）。由服务端 `storeScope.scopeType` 判定，
 * 前端只给「请先选择门店」引导，不展示任何合计数字。
 */
const needsStorePick = computed(() => report.value?.storeScope?.scopeType === 'AllStores')
const storeTitle = computed(() => report.value?.storeScope?.storeName || report.value?.storeName || '门店经营概览')
const isStoreScoped = computed(() => ['StoreManager', 'Finance'].includes(session.role ?? '') || !!scope.requestStoreId)
const targetForm = ref<StoreMonthlyTarget>({
  targetMonth: `${currentMonth}-01`, signedAmount: 0, receivedAmount: 0, grossProfit: 0, activeProjectCount: 0
})

/** 门店维度门控（`REQ-BIZ-20261013-001` §5-I5）：对齐完成前不取数，切换门店重新取数。 */
watch(
  [() => scope.resolved, () => scope.requestStoreId],
  ([ready]) => { if (ready) void load() },
  { immediate: true }
)

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    report.value = await statisticApi.storeReport(scope.requestStoreId)
    if (isStoreScoped.value && report.value.storeScope?.scopeType !== 'AllStores') {
      const [targetResult, profitResult] = await Promise.all([
        statisticApi.storeTarget(`${currentMonth}-01`, scope.requestStoreId).catch(() => null),
        statisticApi.storeProfit(scope.requestStoreId).catch(() => null)
      ])
      target.value = targetResult
      profit.value = profitResult
      if (targetResult) {
        targetForm.value = { ...targetResult, targetMonth: `${currentMonth}-01` }
      }
    } else {
      target.value = null
      profit.value = null
    }
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '门店经营数据暂不可确认'
  } finally { loading.value = false }
}

async function saveTarget(): Promise<void> {
  if (targetSaving.value) return
  targetSaving.value = true
  targetError.value = ''
  try {
    target.value = await statisticApi.saveStoreTarget(targetForm.value, scope.requestStoreId)
    targetForm.value = { ...target.value, targetMonth: `${currentMonth}-01` }
  } catch (saveError) {
    targetError.value = saveError instanceof ProviderError ? saveError.message : '本店目标保存失败'
  } finally {
    targetSaving.value = false
  }
}

/** 店长首答：本店今天最该处理什么（可干预项）。 */
const attention = computed(() => {
  const d = report.value
  if (!d) return []
  return [
    { key: 'unassigned', label: '未指派设计师', value: d.unassignedDesignerCount, hint: '客户已到店但未落到设计师' },
    { key: 'pendingDecision', label: '待客户决策报价', value: d.pendingDecisionQuoteCount, hint: `已提交待决策 ${d.submittedQuoteCount}` },
    { key: 'measure', label: '待安排量房', value: d.pendingMeasureCount, hint: `跟进中客户 ${d.followingCustomerCount}` },
    { key: 'task', label: '任务待办', value: d.taskTodoCount, hint: `逾期 ${d.taskOverdueCount}` }
  ]
})

const kpis = computed(() => {
  const d = report.value
  if (!d) return []
  return [
    { key: 'customer', label: '本店客户', value: d.customerCount, hint: `新增 ${d.newCustomerCount} · 跟进中 ${d.followingCustomerCount} · 休眠 ${d.dormantCustomerCount}` },
    { key: 'quote', label: '本店报价', value: d.quoteCount, hint: `待决策 ${d.pendingDecisionQuoteCount} · 已接受 ${d.acceptedQuoteCount} · 已提交 ${d.submittedQuoteCount}` },
    { key: 'project', label: '本店项目', value: d.projectCount, hint: `待开工 ${d.preparingProjectCount} · 施工中 ${d.ongoingProjectCount} · 待验收 ${d.acceptingProjectCount} · 停工 ${d.suspendedProjectCount}` },
    { key: 'member', label: '本店成员', value: d.memberCount, hint: `设计师 ${d.designerCount} · 业务员 ${d.marketerCount} · 项目经理 ${d.projectManagerCount}` }
  ]
})

const amounts = computed(() => {
  const d = report.value
  if (!d) return []
  return [
    { key: 'quoteAmount', label: '报价金额', value: d.quoteAmount, hint: '系统按报价单金额汇总' },
    { key: 'signedAmount', label: '签约额', value: d.signedAmount, hint: '按合同签约口径，非成本口径' }
  ]
})

const rates = computed(() => {
  const d = report.value
  if (!d) return []
  return [
    { key: 'final', label: '最终报价接受率', value: d.finalQuoteAcceptanceRate },
    { key: 'first', label: '首版报价接受率', value: d.firstQuoteAcceptanceRate },
    { key: 'conversion', label: '转化率', value: d.conversionRate }
  ]
})
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">门店经营概览</span>
        <h1>{{ storeTitle }}</h1>
        <p>按<b>本店</b>数据范围展示客户、报价、项目、任务、成员、月度目标与经营利润（参考）。经营利润来自门店利润数据；成本未完整时利润暂不显示，不会用 0 代替。</p>
      </div>
      <div class="finance-actions">
        <el-button @click="load">刷新</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default><el-button size="small" plain @click="load">重新加载</el-button></template>
    </el-alert>

    <SkeletonBlock v-if="loading && !report" variant="card" :rows="4" />

    <!-- 全部门店视图：不提供合计，先引导选门店（同页不做页面求和补救） -->
    <EmptyState
      v-else-if="needsStorePick"
      title="请先选择门店"
      description="门店经营概览包含人员结构与比率类指标，无法在全部门店视图简单合计。请在顶部「门店维度」选择一家门店后再查看。"
    />

    <template v-else-if="report">
      <PanelCard title="今天先看这几项" description="本店可直接干预的事项，全部取系统统计。" flush>
        <section class="finance-kpis">
          <article v-for="item in attention" :key="item.key" class="finance-kpi">
            <span>{{ item.label }}</span>
            <strong :class="{ 'store-overview__alert': item.value > 0 }">{{ item.value }}</strong>
            <small>{{ item.hint }}</small>
          </article>
        </section>
      </PanelCard>

      <section class="finance-hero" aria-label="门店经营金额">
        <div class="finance-hero__lead">
          <span>本店签约额</span>
          <strong><MoneyText :value="report.signedAmount" size="lg" /></strong>
          <small>金额为自动汇总；经营利润按系统口径，成本未完整时显示「成本未完整」。</small>
        </div>
        <div v-for="item in amounts" :key="item.key" class="finance-metric">
          <span>{{ item.label }}</span>
          <strong><MoneyText :value="item.value" size="lg" /></strong>
          <small>{{ item.hint }}</small>
        </div>
        <div v-for="item in rates" :key="item.key" class="finance-metric">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}%</strong>
          <small>系统口径</small>
        </div>
      </section>

      <section v-if="isStoreScoped" class="finance-grid-2">
        <PanelCard title="本店月度目标" description="店长维护本店目标；公司目标仍由企业负责人维护，两层目标不自动相加。" flush>
          <div class="store-target-grid">
            <label>签约目标（元）<el-input v-model.number="targetForm.signedAmount" type="number" :min="0" /></label>
            <label>回款目标（元）<el-input v-model.number="targetForm.receivedAmount" type="number" :min="0" /></label>
            <label>毛利目标（元）<el-input v-model.number="targetForm.grossProfit" type="number" :min="0" /></label>
            <label>在建项目目标（个）<el-input v-model.number="targetForm.activeProjectCount" type="number" :min="0" /></label>
          </div>
          <p v-if="targetError" class="store-target-error">{{ targetError }}</p>
          <div class="store-target-actions">
            <span v-if="target?.targetMonth">当前月份：{{ target.targetMonth.slice(0, 7) }}</span>
            <el-button type="primary" :loading="targetSaving" @click="saveTarget">保存本店目标</el-button>
          </div>
        </PanelCard>

        <PanelCard title="本店经营利润（参考）" description="门店项目毛利 + 非项目其他收入 − 直接归属企业费用；未分摊总部/公共费用。" flush>
          <div v-if="!profit" class="store-profit-empty">暂不可确认本店经营利润</div>
          <template v-else>
            <div class="store-profit-hero">
              <span>{{ profit.periodLabel }}经营利润（参考）</span>
              <strong v-if="profit.storeProfit !== null"><MoneyText :value="profit.storeProfit" size="lg" /></strong>
              <strong v-else class="store-profit-warning">{{ profit.profitWarning || '成本未完整' }}</strong>
              <small>{{ profit.unallocatedNote }}</small>
            </div>
            <div class="store-profit-breakdown">
              <div><span>项目毛利</span><b><MoneyText v-if="profit.projectGrossProfit !== null" :value="profit.projectGrossProfit" /><template v-else>—</template></b></div>
              <div><span>非项目其他收入</span><b><MoneyText :value="profit.otherIncome" /></b></div>
              <div><span>直接归属企业费用</span><b><MoneyText :value="profit.directCompanyExpense" /></b></div>
            </div>
          </template>
        </PanelCard>
      </section>

      <section class="finance-kpis">
        <article v-for="kpi in kpis" :key="kpi.key" class="finance-kpi">
          <span>{{ kpi.label }}</span>
          <strong>{{ kpi.value }}</strong>
          <small>{{ kpi.hint }}</small>
        </article>
      </section>

      <PanelCard title="设计师业绩" description="本店设计师的客户、报价、签约与在管项目（只读）。" flush>
        <EmptyState v-if="!report.designerPerformances.length" title="暂无设计师业绩" description="当前暂未获取本店设计师业绩数据。" />
        <el-table v-else :data="report.designerPerformances" stripe>
          <el-table-column prop="designerName" label="设计师" min-width="120" />
          <el-table-column prop="customerCount" label="客户" width="90" />
          <el-table-column prop="pendingMeasureCount" label="待量房" width="100" />
          <el-table-column prop="quoteCount" label="报价" width="90" />
          <el-table-column label="签约额" width="150"><template #default="{ row }"><MoneyText :value="row.signedAmount" /></template></el-table-column>
          <el-table-column prop="ongoingProjectCount" label="在管项目" width="110" />
          <el-table-column prop="taskTodoCount" label="任务待办" width="110" />
          <el-table-column label="最终接受率" width="120"><template #default="{ row }">{{ row.finalQuoteAcceptanceRate }}%</template></el-table-column>
        </el-table>
      </PanelCard>

      <div class="finance-grid-2">
        <PanelCard title="最近项目" description="只读项目信息；按边界不展示成本字段。" flush>
          <EmptyState v-if="!report.recentProjects.length" title="暂无项目" description="当前暂未获取本店最近项目。" />
          <el-table v-else :data="report.recentProjects" stripe>
            <el-table-column prop="name" label="项目 / 客户" min-width="220" show-overflow-tooltip />
            <el-table-column prop="statusLabel" label="状态" width="100" />
            <el-table-column label="合同额" width="140"><template #default="{ row }"><MoneyText v-if="row.amount !== null" :value="row.amount" /><span v-else>—</span></template></el-table-column>
            <el-table-column label="进度" width="90"><template #default="{ row }">{{ row.progress === null ? '—' : `${row.progress}%` }}</template></el-table-column>
          </el-table>
        </PanelCard>

        <PanelCard title="最近客户" description="只读客户信息与归属。" flush>
          <EmptyState v-if="!report.recentCustomers.length" title="暂无客户" description="当前暂未获取本店最近客户。" />
          <el-table v-else :data="report.recentCustomers" stripe>
            <el-table-column prop="name" label="客户" min-width="140" />
            <el-table-column prop="extraLabel" label="小区 / 地址" min-width="180" show-overflow-tooltip />
            <el-table-column prop="statusLabel" label="状态" width="100" />
            <el-table-column prop="createdAt" label="建档时间" min-width="160" />
          </el-table>
        </PanelCard>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.store-overview__alert { color: $warning-700; }

.store-target-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-3;
  padding: $space-4;
}

.store-target-grid label {
  display: grid;
  gap: $space-1;
  color: $text-secondary;
  font-size: $font-body-sm;
}

.store-target-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
  padding: 0 $space-4 $space-4;
  color: $text-secondary;
  font-size: $font-caption;
}

.store-target-error { margin: 0 $space-4; color: $danger-500; font-size: $font-body-sm; }
.store-profit-hero { display: grid; gap: $space-2; padding: $space-4; border-bottom: 1px solid $border-color; }
.store-profit-hero > span { color: $text-secondary; font-size: $font-body-sm; }
.store-profit-hero > small { color: $text-secondary; font-size: $font-caption; }
.store-profit-warning { color: $warning-700; font-size: $font-title; }
.store-profit-breakdown { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: $space-3; padding: $space-4; }
.store-profit-breakdown > div { display: grid; gap: $space-1; }
.store-profit-breakdown span { color: $text-secondary; font-size: $font-caption; }
.store-profit-breakdown b { font-size: $font-body; }
.store-profit-empty { padding: $space-4; color: $text-secondary; font-size: $font-body-sm; }

@media (max-width: 900px) {
  .store-target-grid, .store-profit-breakdown { grid-template-columns: 1fr; }
}
</style>
