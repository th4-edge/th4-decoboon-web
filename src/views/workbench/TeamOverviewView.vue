<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ProviderError } from '@/core/http'
import { teamApi } from '@/domains/team/api'
import type { TeamLeaderReport } from '@/domains/team/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'

const report = ref<TeamLeaderReport | null>(null)
const loading = ref(false)
const error = ref('')

const kpis = computed(() => {
  const data = report.value
  if (!data) return []
  return [
    { key: 'member', label: '团队成员', value: String(data.memberCount), hint: `业务员 ${data.marketerCount} · 设计师 ${data.designerCount} · 项目经理 ${data.projectManagerCount}` },
    { key: 'customer', label: '本团队客户', value: String(data.customerCount), hint: `跟进中 ${data.followingCustomerCount} · 待量房 ${data.pendingMeasureCount}` },
    { key: 'followOverdue', label: '跟进逾期', value: String(data.followOverdueCount), hint: `待跟进 ${data.followDueCount}` },
    { key: 'quote', label: '报价数量', value: String(data.quoteCount), hint: `待决策 ${data.pendingQuoteCount} · 已接受 ${data.acceptedQuoteCount}` },
    { key: 'project', label: '本团队项目', value: String(data.projectCount), hint: `施工中 ${data.ongoingProjectCount} · 停工 ${data.suspendedProjectCount}` },
    { key: 'task', label: '任务待办', value: String(data.taskTodoCount), hint: `逾期 ${data.taskOverdueCount}` }
  ]
})

const amountFacts = computed(() => {
  const data = report.value
  if (!data) return []
  return [
    { key: 'quoteAmount', label: '报价金额', value: data.quoteAmount },
    { key: 'acceptedQuoteAmount', label: '已接受报价金额', value: data.acceptedQuoteAmount },
    { key: 'signedAmount', label: '签约额', value: data.signedAmount }
  ]
})

onMounted(() => { void load() })

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    report.value = await teamApi.report()
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '团队经营概览暂不可确认'
  } finally {
    loading.value = false
  }
}

function statusTone(value: number): 'alert' | 'done' {
  return value > 0 ? 'alert' : 'done'
}
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">团队经营概览</span>
        <h1>{{ report?.teamName || '团队经营概览' }}</h1>
        <p>按本团队数据范围只读展示客户、报价、项目与任务记录；成本、利润、应付、付款、现金流、工资与提成区块不展示。</p>
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
      <section class="finance-kpis">
        <article v-for="kpi in kpis" :key="kpi.key" class="finance-kpi">
          <span>{{ kpi.label }}</span>
          <strong>{{ kpi.value }}</strong>
          <small>{{ kpi.hint }}</small>
        </article>
      </section>

      <PanelCard title="金额记录（只读）" description="仅展示报价与签约金额；成本与利润不在团队负责人授权范围，区块不展示。">
        <div class="finance-kpis">
          <article v-for="fact in amountFacts" :key="fact.key" class="finance-kpi">
            <span>{{ fact.label }}</span>
            <strong><MoneyText :value="fact.value" size="lg" /></strong>
            <small>系统口径</small>
          </article>
        </div>
      </PanelCard>

      <PanelCard title="成员表现" description="团队成员客户、报价、项目与任务计数；不含成本、利润、工资与提成。">
        <EmptyState v-if="!report.memberPerformances.length" title="暂无团队成员数据" description="团队成员建立客户、报价或项目后，这里会出现计数。" />
        <el-table v-else :data="report.memberPerformances" stripe>
          <el-table-column label="成员" min-width="150">
            <template #default="{ row }">
              <div class="finance-table__main">
                <span class="finance-table__title">{{ row.name }}</span>
                <span class="finance-table__sub">{{ row.role }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="customerCount" label="客户" width="90" align="right" />
          <el-table-column prop="followOverdueCount" label="跟进逾期" width="110" align="right">
            <template #default="{ row }"><StatusTag :text="String(row.followOverdueCount)" :tone="statusTone(row.followOverdueCount)" /></template>
          </el-table-column>
          <el-table-column prop="quoteCount" label="报价" width="90" align="right" />
          <el-table-column label="报价金额" width="150" align="right">
            <template #default="{ row }"><MoneyText :value="row.quoteAmount" /></template>
          </el-table-column>
          <el-table-column label="签约额" width="150" align="right">
            <template #default="{ row }"><MoneyText :value="row.signedAmount" /></template>
          </el-table-column>
          <el-table-column prop="projectCount" label="项目" width="90" align="right" />
          <el-table-column prop="taskTodoCount" label="任务待办" width="110" align="right" />
          <el-table-column prop="taskOverdueCount" label="任务逾期" width="110" align="right">
            <template #default="{ row }"><StatusTag :text="String(row.taskOverdueCount)" :tone="statusTone(row.taskOverdueCount)" /></template>
          </el-table-column>
        </el-table>
      </PanelCard>

      <PanelCard title="最近客户" description="本团队范围内客户摘要。">
        <EmptyState v-if="!report.recentCustomers.length" title="暂无最近客户" description="本团队客户建档后，这里会显示最近记录。" />
        <el-table v-else :data="report.recentCustomers" stripe>
          <el-table-column prop="name" label="客户" min-width="160" />
          <el-table-column prop="community" label="小区" min-width="140" />
          <el-table-column prop="status" label="状态" width="120" />
          <el-table-column prop="ownerName" label="负责人" width="120" />
          <el-table-column prop="designerName" label="设计师" width="120" />
        </el-table>
      </PanelCard>
    </template>
  </div>
</template>
