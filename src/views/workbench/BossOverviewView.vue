<script setup lang="ts">
import { ref, watch } from 'vue'
import { ProviderError } from '@/core/http'
import { bossApi } from '@/domains/boss/api'
import type { BusinessAnalysisReport } from '@/domains/boss/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import { useStoreScopeStore } from '@/stores/storeScope'

const scope = useStoreScopeStore()
const report = ref<BusinessAnalysisReport | null>(null)
const loading = ref(false)
const error = ref('')

/**
 * 门店维度门控（`REQ-BIZ-20261013-001` §5-I5）：门店范围未对齐完成前不取数，
 * 避免「先用本地记忆取一次数、对齐后再改门店」导致的标题与数字不同源（I3）。
 */
watch(
  [() => scope.resolved, () => scope.requestStoreId],
  ([ready]) => { if (ready) void load() },
  { immediate: true }
)

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    report.value = await bossApi.businessReport(scope.requestStoreId ?? undefined)
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '经营总览暂不可确认'
  } finally {
    loading.value = false
  }
}

function percent(value: number): string { return `${value.toFixed(1)}%` }
function formatCompact(value: number): string { return `¥${value.toFixed(2)}` }
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <h1>经营总览<span class="scope-chip">{{ scope.activeStoreName }}</span>
        <span
          v-if="report?.storeScope?.scopeType === 'AllStores' && report?.storeScope?.unassignedCount > 0"
          class="scope-chip scope-chip--warn"
        >含未归属门店 {{ report.storeScope.unassignedCount }} 条</span></h1>
      </div>
      <div class="finance-actions"><el-button @click="load">刷新</el-button></div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default><el-button size="small" plain @click="load">重新加载</el-button></template>
    </el-alert>

    <SkeletonBlock v-if="loading && !report" variant="card" :rows="4" />

    <template v-else-if="report">
      <section class="business-summary" aria-label="本月经营摘要">
        <div class="business-summary__lead">
          <span>整体转化率</span>
          <strong>{{ percent(report.overallConversionRate) }}</strong>
          <small>{{ report.month }}</small>
        </div>
        <div class="business-summary__item">
          <span>最终报价接受率</span>
          <strong>{{ percent(report.quoteConversion.finalQuoteAcceptanceRate) }}</strong>
          <small>已决策 {{ report.quoteConversion.decidedOpportunityCount }} 个机会</small>
        </div>
        <div class="business-summary__item">
          <span>已提交报价</span>
          <strong>{{ report.quoteConversion.submittedQuoteCount }}</strong>
          <small>待决策 {{ report.quoteConversion.pendingDecisionQuoteCount }} 个</small>
        </div>
        <div class="business-summary__item">
          <span>订单中位金额</span>
          <strong><MoneyText :value="report.medianOrderAmount" size="lg" /></strong>
          <small>最高 {{ formatCompact(report.maxOrderAmount) }}</small>
        </div>
      </section>

      <PanelCard title="经营漏斗">
        <div class="finance-kpis">
          <article v-for="stage in report.funnel" :key="stage.key" class="finance-kpi">
            <span>{{ stage.label }}</span>
            <strong>{{ stage.count }}</strong>
            <small>{{ stage.unit }}</small>
          </article>
        </div>
      </PanelCard>

      <PanelCard title="报价过程">
        <div class="finance-kpis">
          <article class="finance-kpi">
            <span>首版接受率</span>
            <strong>{{ percent(report.quoteConversion.firstQuoteAcceptanceRate) }}</strong>
            <small>首版方案命中能力</small>
          </article>
          <article class="finance-kpi">
            <span>已决策机会</span>
            <strong>{{ report.quoteConversion.decidedOpportunityCount }}</strong>
            <small>已产生接受或拒绝结果</small>
          </article>
          <article class="finance-kpi">
            <span>待决策报价</span>
            <strong>{{ report.quoteConversion.pendingDecisionQuoteCount }}</strong>
            <small>等待客户决策</small>
          </article>
          <article class="finance-kpi">
            <span>已提交报价</span>
            <strong>{{ report.quoteConversion.submittedQuoteCount }}</strong>
            <small>排除草稿与被替代版本</small>
          </article>
        </div>
      </PanelCard>

      <PanelCard title="渠道结构">
        <EmptyState v-if="!report.channels.length" title="本月暂无线索渠道数据" description="线索进入后，这里按来源形成结构。" />
        <el-table v-else :data="report.channels" stripe>
          <el-table-column prop="label" label="来源" min-width="130" />
          <el-table-column prop="leadCount" label="线索" width="90" align="right" />
          <el-table-column prop="visitCount" label="到店" width="90" align="right" />
          <el-table-column prop="signedCount" label="签约" width="90" align="right" />
          <el-table-column label="签约率" width="110" align="right"><template #default="{ row }">{{ percent(row.signRate) }}</template></el-table-column>
          <el-table-column label="平均订单" width="150" align="right"><template #default="{ row }"><MoneyText :value="row.avgOrderAmount" /></template></el-table-column>
        </el-table>
      </PanelCard>

      <PanelCard title="区域与订单结构">
        <div class="finance-kpis" style="margin-bottom: 12px">
          <article v-for="bucket in report.orderSizes" :key="bucket.key" class="finance-kpi">
            <span>{{ bucket.label }}</span>
            <strong>{{ bucket.count }}</strong>
            <small>单</small>
          </article>
        </div>
        <EmptyState v-if="!report.regions.length" title="本月暂无区域签约数据" description="签约后按小区归集。" />
        <el-table v-else :data="report.regions" stripe>
          <el-table-column prop="community" label="小区" min-width="160" />
          <el-table-column prop="signedCount" label="签约数" width="110" align="right" />
          <el-table-column label="签约金额" width="160" align="right"><template #default="{ row }"><MoneyText :value="row.signedAmount" /></template></el-table-column>
        </el-table>
      </PanelCard>

    </template>
  </div>
</template>

<style scoped lang="scss">
.business-summary {
  display: grid;
  grid-template-columns: minmax(260px, 1.35fr) repeat(3, minmax(160px, 1fr));
  gap: $space-4;
  padding: $space-5;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: linear-gradient(125deg, $brand-50 0%, $surface-0 70%);
}

.business-summary__lead,
.business-summary__item { min-width: 0; }
.business-summary span,
.business-summary small { display: block; color: $text-secondary; font-size: $font-caption; }
.business-summary strong { display: block; margin: $space-2 0 $space-1; color: $text-primary; font-size: $font-title; font-variant-numeric: tabular-nums; }
.business-summary__lead strong { font-size: $font-kpi; line-height: 1; }

.scope-chip--warn {
  background: var(--fill-warn, #fef3c7);
  color: var(--warn-1, #b45309);
}
.scope-chip {
  margin-left: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--fill-1, #eef2ff);
  color: var(--brand-1, #2563eb);
  font-size: 12px;
  font-weight: 500;
  vertical-align: middle;
}

@media (max-width: 1000px) {
  .business-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .business-summary__lead { grid-column: 1 / -1; }
}
</style>
