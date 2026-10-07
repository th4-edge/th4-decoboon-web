<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ProviderError } from '@/core/http'
import { bossApi } from '@/domains/boss/api'
import type { BusinessAnalysisReport } from '@/domains/boss/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'

const report = ref<BusinessAnalysisReport | null>(null)
const loading = ref(false)
const error = ref('')

onMounted(() => { void load() })

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    report.value = await bossApi.businessReport()
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '经营总览暂不可确认'
  } finally {
    loading.value = false
  }
}

function percent(value: number): string { return `${value.toFixed(1)}%` }
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">BOSS OVERVIEW · 经营总览与业务分析</span>
        <h1>经营总览</h1>
        <p>本月经营漏斗、报价转化、渠道与区域结构；口径取自服务端月报，不前端重算。</p>
      </div>
      <div class="finance-actions"><el-button @click="load">刷新</el-button></div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default><el-button size="small" plain @click="load">重新加载</el-button></template>
    </el-alert>

    <SkeletonBlock v-if="loading && !report" variant="card" :rows="4" />

    <template v-else-if="report">
      <PanelCard title="经营漏斗" :description="`统计月份 ${report.month} · 整体转化率 ${percent(report.overallConversionRate)}`">
        <div class="finance-kpis">
          <article v-for="stage in report.funnel" :key="stage.key" class="finance-kpi">
            <span>{{ stage.label }}</span>
            <strong>{{ stage.count }}</strong>
            <small>{{ stage.unit }}</small>
          </article>
        </div>
      </PanelCard>

      <PanelCard title="报价转化" description="最终报价接受率为主指标，首版接受率为辅助。">
        <div class="finance-kpis">
          <article class="finance-kpi">
            <span>最终接受率</span>
            <strong>{{ percent(report.quoteConversion.finalQuoteAcceptanceRate) }}</strong>
            <small>已决策机会 {{ report.quoteConversion.decidedOpportunityCount }}</small>
          </article>
          <article class="finance-kpi">
            <span>首版接受率</span>
            <strong>{{ percent(report.quoteConversion.firstQuoteAcceptanceRate) }}</strong>
            <small>待决策 {{ report.quoteConversion.pendingDecisionQuoteCount }}</small>
          </article>
          <article class="finance-kpi">
            <span>已提交报价</span>
            <strong>{{ report.quoteConversion.submittedQuoteCount }}</strong>
            <small>排除草稿与被替代版本</small>
          </article>
          <article class="finance-kpi">
            <span>订单金额</span>
            <strong><MoneyText :value="report.medianOrderAmount" size="lg" /></strong>
            <small>中位 {{ report.medianOrderAmount.toFixed(2) }} · 最高 {{ report.maxOrderAmount.toFixed(2) }}</small>
          </article>
        </div>
      </PanelCard>

      <PanelCard title="渠道结构" description="按来源统计线索、到店、签约与平均订单金额。">
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

      <PanelCard title="区域与订单结构" description="按小区与订单金额分档。">
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
