<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ProviderError } from '@/core/http'
import { statisticApi } from '@/domains/statistic/api'
import type { StoreReport } from '@/domains/statistic/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'

/**
 * 门店经营概览（店长只读）。
 * 数据全部取 `statistic/store/report`，服务端按登录员工的门店数据范围裁剪。
 *
 * **成本/毛利边界（依据事实而非取舍）**：
 * 该 Provider **不返回成本、毛利，也不返回成本完整性标记**；若把「最近项目」里的 `cost` 拿出来展示，
 * 既没有完整性标记、又极易被读成利润依据（`BR-003` 明确采购执行价不得被解释为综合成本）。
 * 因此本页**不展示任何成本字段**，并在页面写明：展示成本/毛利需后端提供成本完整性投影后再按 `BR-003` 定边界。
 */
const report = ref<StoreReport | null>(null)
const loading = ref(false)
const error = ref('')

onMounted(() => { void load() })

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    report.value = await statisticApi.storeReport()
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '门店经营数据暂不可确认'
  } finally { loading.value = false }
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
    { key: 'quoteAmount', label: '报价金额', value: d.quoteAmount, hint: '服务端按报价单金额汇总' },
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
        <span class="finance-eyebrow">STORE OVERVIEW · 门店经营概览</span>
        <h1>{{ report?.storeName || '门店经营概览' }}</h1>
        <p>按<b>本店</b>数据范围只读展示客户、报价、项目、任务与成员事实。<b>本页不含成本与毛利</b>：该接口不返回成本完整性标记，展示成本容易被读成利润依据（`BR-003`）；如需展示，需后端先提供成本完整性投影。</p>
      </div>
      <div class="finance-actions">
        <el-button @click="load">刷新</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default><el-button size="small" plain @click="load">重新加载</el-button></template>
    </el-alert>

    <SkeletonBlock v-if="loading && !report" variant="card" :rows="4" />

    <template v-else-if="report">
      <PanelCard title="今天先看这几项" description="本店可直接干预的事项，全部取服务端计数。" flush>
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
          <small>金额为服务端汇总；本页不展示成本与毛利。</small>
        </div>
        <div v-for="item in amounts" :key="item.key" class="finance-metric">
          <span>{{ item.label }}</span>
          <strong><MoneyText :value="item.value" size="lg" /></strong>
          <small>{{ item.hint }}</small>
        </div>
        <div v-for="item in rates" :key="item.key" class="finance-metric">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}%</strong>
          <small>服务端口径</small>
        </div>
      </section>

      <section class="finance-kpis">
        <article v-for="kpi in kpis" :key="kpi.key" class="finance-kpi">
          <span>{{ kpi.label }}</span>
          <strong>{{ kpi.value }}</strong>
          <small>{{ kpi.hint }}</small>
        </article>
      </section>

      <PanelCard title="设计师业绩" description="本店设计师的客户、报价、签约与在管项目（只读）。" flush>
        <EmptyState v-if="!report.designerPerformances.length" title="暂无设计师业绩" description="服务端未返回本店设计师业绩数据。" />
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
        <PanelCard title="最近项目" description="只读项目事实；按边界不展示成本字段。" flush>
          <EmptyState v-if="!report.recentProjects.length" title="暂无项目" description="服务端未返回本店最近项目。" />
          <el-table v-else :data="report.recentProjects" stripe>
            <el-table-column prop="name" label="项目 / 客户" min-width="220" show-overflow-tooltip />
            <el-table-column prop="statusLabel" label="状态" width="100" />
            <el-table-column label="合同额" width="140"><template #default="{ row }"><MoneyText v-if="row.amount !== null" :value="row.amount" /><span v-else>—</span></template></el-table-column>
            <el-table-column label="进度" width="90"><template #default="{ row }">{{ row.progress === null ? '—' : `${row.progress}%` }}</template></el-table-column>
          </el-table>
        </PanelCard>

        <PanelCard title="最近客户" description="只读客户事实与归属。" flush>
          <EmptyState v-if="!report.recentCustomers.length" title="暂无客户" description="服务端未返回本店最近客户。" />
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
</style>
