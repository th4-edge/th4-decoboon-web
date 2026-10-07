<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ProviderError } from '@/core/http'
import { bossApi } from '@/domains/boss/api'
import type { OrganizationReport } from '@/domains/boss/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'

const report = ref<OrganizationReport | null>(null)
const loading = ref(false)
const error = ref('')

onMounted(() => { void load() })

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    report.value = await bossApi.organizationReport()
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '组织效能暂不可确认'
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
        <span class="finance-eyebrow">ORGANIZATION · 组织效能</span>
        <h1>组织效能</h1>
        <p>本月人均产出、订单与角色产能，以及设计师/业务员/项目经理排行；样本不足时按服务端标记提示。</p>
      </div>
      <div class="finance-actions"><el-button @click="load">刷新</el-button></div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default><el-button size="small" plain @click="load">重新加载</el-button></template>
    </el-alert>

    <SkeletonBlock v-if="loading && !report" variant="card" :rows="4" />

    <template v-else-if="report">
      <el-alert v-if="!report.sampleSufficient" type="warning" :closable="false" show-icon title="样本不足" description="本月数据量较小，比率类指标仅供参考。" />

      <section class="finance-kpis">
        <article class="finance-kpi"><span>在职人数</span><strong>{{ report.headcount }}</strong><small>新增 {{ report.newHires }}</small></article>
        <article class="finance-kpi"><span>本月签约额</span><strong><MoneyText :value="report.signedAmount" size="lg" /></strong><small>新项目 {{ report.newProjectCount }}</small></article>
        <article class="finance-kpi"><span>人均产出</span><strong><MoneyText :value="report.perCapitaOutput" size="lg" /></strong><small>签约额 / 在职人数</small></article>
        <article class="finance-kpi"><span>人均订单</span><strong>{{ report.perCapitaOrders.toFixed(2) }}</strong><small>订单 / 在职人数</small></article>
      </section>

      <PanelCard title="角色产能" description="按角色统计在职人数与核心指标。">
        <EmptyState v-if="!report.roleCapacities.length" title="暂无角色产能数据" description="角色与在职员工就绪后展示。" />
        <el-table v-else :data="report.roleCapacities" stripe>
          <el-table-column prop="label" label="角色" min-width="130" />
          <el-table-column prop="count" label="人数" width="90" align="right" />
          <el-table-column prop="metricLabel" label="核心指标" min-width="150" />
          <el-table-column label="指标值" width="140" align="right"><template #default="{ row }">{{ row.metricValue.toFixed(2) }}</template></el-table-column>
        </el-table>
      </PanelCard>

      <PanelCard title="设计师排行" description="按报价与接受情况。">
        <EmptyState v-if="!report.designerRanking.length" title="暂无设计师数据" description="设计师产生报价后进入排行。" />
        <el-table v-else :data="report.designerRanking" stripe>
          <el-table-column prop="name" label="设计师" min-width="130" />
          <el-table-column prop="quoteCount" label="报价" width="90" align="right" />
          <el-table-column prop="acceptedQuoteCount" label="接受" width="90" align="right" />
          <el-table-column label="转化率" width="110" align="right"><template #default="{ row }">{{ percent(row.designerConversionRate) }}</template></el-table-column>
        </el-table>
      </PanelCard>

      <PanelCard title="业务员排行" description="按客户与签约情况。">
        <EmptyState v-if="!report.marketerRanking.length" title="暂无业务员数据" description="业务员建立客户后进入排行。" />
        <el-table v-else :data="report.marketerRanking" stripe>
          <el-table-column prop="name" label="业务员" min-width="130" />
          <el-table-column prop="customerCount" label="客户" width="90" align="right" />
          <el-table-column prop="signedCustomerCount" label="签约客户" width="110" align="right" />
          <el-table-column label="签约率" width="110" align="right"><template #default="{ row }">{{ percent(row.marketerSignRate) }}</template></el-table-column>
        </el-table>
      </PanelCard>

      <PanelCard title="项目经理排行" description="按交付与准时情况。">
        <EmptyState v-if="!report.pmRanking.length" title="暂无项目经理数据" description="项目经理交付项目后进入排行。" />
        <el-table v-else :data="report.pmRanking" stripe>
          <el-table-column prop="name" label="项目经理" min-width="130" />
          <el-table-column prop="deliveredProjectCount" label="已交付" width="110" align="right" />
          <el-table-column prop="onTimeProjectCount" label="准时" width="100" align="right" />
          <el-table-column label="准时率" width="110" align="right"><template #default="{ row }">{{ percent(row.pmOnTimeDeliveryRate) }}</template></el-table-column>
          <el-table-column prop="acceptanceCount" label="验收" width="90" align="right" />
        </el-table>
      </PanelCard>

      <div><StatusTag :text="report.sampleSufficient ? '样本充分' : '样本不足'" :tone="report.sampleSufficient ? 'done' : 'pending'" /></div>
    </template>
  </div>
</template>
