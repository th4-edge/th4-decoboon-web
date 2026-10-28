<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import MoneyText from '@/components/MoneyText.vue'
import WorkbenchState from '@/components/workbench/WorkbenchState.vue'
import { formatDateTime } from '@/core/format'
import { contractApi } from '@/domains/contract/api'
import type { Contract, ContractChange, ContractLine } from '@/domains/contract/model'
import { CONTRACT_CHANGE_STATUS_LABELS } from '@/domains/contract/meta'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => String(route.params.projectId ?? ''))
const contract = ref<Contract | null>(null)
const lines = ref<ContractLine[]>([])
const changes = ref<ContractChange[]>([])
const loading = ref(false)
const error = ref('')
const partialError = ref('')

const lineTotal = computed(() => lines.value.reduce((sum, line) => sum + Number(line.amount || 0), 0))
const changeTotal = computed(() => changes.value.reduce((sum, change) => sum + Number(change.amount || 0), 0))

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  partialError.value = ''
  try {
    const loaded = await contractApi.contractByProject(projectId.value)
    contract.value = loaded
    if (!loaded) {
      lines.value = []
      changes.value = []
      return
    }
    const [lineResult, changeResult] = await Promise.allSettled([
      contractApi.listContractLines(loaded.id),
      contractApi.listContractChanges(projectId.value)
    ])
    lines.value = lineResult.status === 'fulfilled' ? lineResult.value : []
    changes.value = changeResult.status === 'fulfilled' ? changeResult.value : []
    if (lineResult.status === 'rejected' || changeResult.status === 'rejected') {
      partialError.value = '部分合同明细暂不可确认，可刷新重试'
    }
  } catch (err) {
    contract.value = null
    error.value = err instanceof Error ? err.message : '合同档案暂不可确认'
  } finally {
    loading.value = false
  }
}

function backToProject(): void {
  void router.push({ path: '/designer/projects', query: { projectId: projectId.value } })
}

function openQuote(): void {
  if (!contract.value?.quoteId) return
  void router.push(`/designer/quotes/${contract.value.quoteId}`)
}

function openCustomer(): void {
  if (!contract.value?.customerId) return
  void router.push(`/designer/my-customers/${contract.value.customerId}`)
}

onMounted(load)
</script>

<template>
  <div class="pcv">
    <header class="pcv__head">
      <div>
        <p class="pcv__eyebrow">项目工地 · 合同档案</p>
        <h1>项目合同档案</h1>
        <p>项目内只读查看合同基线、当前金额、付款计划、施工计划、合同范围和变更历史。</p>
      </div>
      <button type="button" @click="backToProject">返回项目</button>
    </header>

    <WorkbenchState
      v-if="error"
      variant="error"
      title="合同档案暂不可确认"
      :description="error"
      action-text="重新加载"
      min-height="300px"
      @action="load"
    />
    <div v-else-if="loading" class="pcv__skeleton" aria-busy="true"><span v-for="n in 5" :key="n" /></div>
    <WorkbenchState
      v-else-if="!contract"
      title="当前项目尚无合同档案"
      description="合同发起并生效后，会在这里形成项目合同档案。"
      action-text="返回项目"
      min-height="280px"
      @action="backToProject"
    />

    <template v-else>
      <el-alert v-if="partialError" type="warning" :title="partialError" :closable="false" show-icon />

      <section class="pcv__hero">
        <div class="pcv__hero-main">
          <p>{{ contract.customerName || '客户待确认' }} · {{ contract.propertyCommunity || contract.propertyAddress || '房屋待确认' }}</p>
          <h2>{{ contract.no }}</h2>
          <div class="pcv__hero-meta">
            <BusinessStateTag object-key="contract" :status-key="contract.status" :dot="false" />
            <span>项目 {{ contract.projectName || contract.projectNo || '暂不可确认' }}</span>
            <span>报价 {{ contract.quoteNo || '暂不可确认' }}</span>
          </div>
        </div>
        <div class="pcv__amounts">
          <article><small>签约金额</small><MoneyText :value="contract.signedAmount ?? contract.currentAmount" size="lg" /></article>
          <article><small>当前合同额</small><MoneyText :value="contract.currentAmount" size="lg" /></article>
        </div>
      </section>

      <section class="pcv__facts">
        <article><small>签约日期</small><strong>{{ contract.signedAt || '尚未签约' }}</strong></article>
        <article><small>生效时间</small><strong>{{ contract.effectiveAt ? formatDateTime(contract.effectiveAt) : '尚未生效' }}</strong></article>
        <article><small>计划工期</small><strong>{{ contract.startDate || '-' }} 至 {{ contract.planEndDate || '-' }}</strong></article>
        <article><small>合同变更</small><strong>{{ changes.length }} 项 · <MoneyText :value="changeTotal" size="sm" /></strong></article>
      </section>

      <section class="pcv__actions">
        <button v-if="contract.quoteId" type="button" @click="openQuote">查看签约报价</button>
        <button v-if="contract.customerId" type="button" @click="openCustomer">查看客户 360</button>
      </section>

      <section v-if="contract.paymentPlan" class="pcv__section">
        <header><div><h3>付款计划</h3><p>{{ contract.paymentPlan.name }} · 合计 <MoneyText :value="contract.paymentPlan.totalAmount" size="sm" /></p></div></header>
        <div class="pcv__table">
          <div class="pcv__table-head"><span>节点</span><span>比例</span><span>金额</span><span>到期日</span></div>
          <div v-for="node in contract.paymentPlan.nodes" :key="node.id" class="pcv__table-row">
            <strong>{{ node.name }}</strong>
            <span>{{ node.ratio ? `${Math.round(node.ratio * 100)}%` : '暂不可确认' }}</span>
            <MoneyText :value="node.amount" size="sm" />
            <span>{{ node.dueDate || node.triggerStageName || '暂不可确认' }}</span>
          </div>
        </div>
      </section>

      <section v-if="contract.constructionPlan" class="pcv__section">
        <header><div><h3>施工计划</h3><p>{{ contract.constructionPlan.name }} · {{ contract.constructionPlan.startDate || '-' }} 至 {{ contract.constructionPlan.endDate || '-' }}</p></div></header>
        <div class="pcv__stages">
          <article v-for="stage in contract.constructionPlan.stages" :key="stage.id">
            <strong>{{ stage.name }}</strong>
            <span>{{ stage.plannedStart || '-' }} 至 {{ stage.plannedEnd || '-' }}</span>
            <small>{{ stage.acceptanceMode || '验收方式暂不可确认' }}</small>
          </article>
        </div>
      </section>

      <section class="pcv__section">
        <header><div><h3>合同范围</h3><p>合同范围 · {{ lines.length }} 项 · 合计 <MoneyText :value="lineTotal" size="sm" /></p></div></header>
        <WorkbenchState v-if="!lines.length" title="合同明细暂不可确认" description="请刷新后重试，不使用空数据伪装合同范围。" min-height="180px" />
        <div v-else class="pcv__lines">
          <article v-for="line in lines.slice(0, 30)" :key="line.id">
            <div><strong>{{ line.name }}</strong><small>{{ [line.brand, line.spec, line.spaceName].filter(Boolean).join(' · ') || '规格信息待确认' }}</small></div>
            <span>{{ line.quantity }} {{ line.unit }}</span>
            <MoneyText :value="line.amount" size="sm" />
          </article>
          <p v-if="lines.length > 30" class="pcv__more">当前显示前 30 项，共 {{ lines.length }} 项。</p>
        </div>
      </section>

      <section class="pcv__section">
        <header><div><h3>变更历史</h3><p>合同生效后的独立变更事实</p></div></header>
        <WorkbenchState v-if="!changes.length" title="暂无合同变更" description="当前项目没有增减项或合同变更记录。" min-height="160px" />
        <div v-else class="pcv__changes">
          <article v-for="change in changes" :key="change.id">
            <div><strong>{{ change.reason }}</strong><small>{{ change.no }} · {{ change.requestedByName || '发起人待确认' }}</small></div>
            <span>{{ CONTRACT_CHANGE_STATUS_LABELS[change.status] || '状态待确认' }}</span>
            <MoneyText :value="change.amount" size="sm" />
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
.pcv { display: flex; flex-direction: column; gap: $space-4; padding: $space-5; min-width: 0; }
.pcv__head { display: flex; align-items: flex-end; justify-content: space-between; gap: $space-4; }
.pcv__head h1 { margin: 0; color: $text-primary; font-size: $font-display; }
.pcv__head p { max-width: 820px; margin: $space-2 0 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
.pcv__eyebrow { margin: 0 0 6px !important; color: $brand-600 !important; font-size: $font-caption !important; font-weight: $font-weight-semibold; letter-spacing: .08em; }
.pcv__head > button, .pcv__actions button { padding: 8px 12px; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; color: $text-secondary; font: inherit; cursor: pointer; }
.pcv__hero { display: flex; align-items: stretch; justify-content: space-between; gap: $space-4; padding: $space-5; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }
.pcv__hero-main p { margin: 0; color: $text-tertiary; font-size: $font-caption; }
.pcv__hero-main h2 { margin: 7px 0 12px; color: $text-primary; font-size: $font-title; }
.pcv__hero-meta { display: flex; flex-wrap: wrap; align-items: center; gap: $space-3; color: $text-secondary; font-size: $font-caption; }
.pcv__amounts { display: flex; gap: $space-5; }
.pcv__amounts article { min-width: 140px; padding: $space-3; border-radius: $radius-md; background: $surface-50; }
.pcv__amounts small, .pcv__facts small { display: block; color: $text-tertiary; font-size: $font-caption; }
.pcv__facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: $space-3; }
.pcv__facts article { padding: $space-3; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; }
.pcv__facts strong { display: block; margin-top: 5px; color: $text-primary; font-size: $font-body-sm; }
.pcv__actions { display: flex; gap: $space-2; }
.pcv__section { border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; overflow: hidden; }
.pcv__section > header { display: flex; justify-content: space-between; padding: 15px 18px; border-bottom: 1px solid $border-color; background: linear-gradient(135deg, $surface-50, $surface-0); }
.pcv__section h3 { margin: 0; color: $text-primary; font-size: $font-body; }
.pcv__section p { margin: 5px 0 0; color: $text-secondary; font-size: $font-caption; }
.pcv__table-head, .pcv__table-row { display: grid; grid-template-columns: minmax(180px, 1fr) 100px 130px 180px; gap: $space-3; align-items: center; padding: 11px 18px; border-bottom: 1px solid $border-color; }
.pcv__table-head { color: $text-tertiary; font-size: $font-caption; }
.pcv__table-row { color: $text-secondary; font-size: $font-body-sm; }
.pcv__stages { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: $space-3; padding: $space-4; }
.pcv__stages article { display: flex; flex-direction: column; gap: 5px; padding: $space-3; border-radius: $radius-md; background: $surface-50; }
.pcv__stages span, .pcv__stages small { color: $text-secondary; font-size: $font-caption; }
.pcv__lines, .pcv__changes { display: flex; flex-direction: column; }
.pcv__lines article, .pcv__changes article { display: grid; grid-template-columns: minmax(240px, 1fr) 100px 120px; gap: $space-3; align-items: center; padding: 11px 18px; border-bottom: 1px solid $border-color; }
.pcv__lines article div, .pcv__changes article div { display: flex; flex-direction: column; gap: 3px; }
.pcv__lines small, .pcv__changes small { color: $text-tertiary; font-size: $font-caption; }
.pcv__more { padding: 12px 18px; color: $text-tertiary; font-size: $font-caption; }
.pcv__changes article span { color: $text-secondary; font-size: $font-caption; }
.pcv__skeleton { display: grid; gap: $space-2; }
.pcv__skeleton span { height: 90px; border-radius: $radius-md; background: linear-gradient(90deg, $surface-100 25%, $surface-50 37%, $surface-100 63%); background-size: 400% 100%; animation: pcv-shimmer 1.4s ease infinite; }
@keyframes pcv-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
@media (max-width: 1180px) { .pcv__facts { grid-template-columns: 1fr 1fr; } .pcv__hero { flex-direction: column; } }
@media (max-width: 760px) { .pcv { padding: $space-3; } .pcv__head { align-items: stretch; flex-direction: column; } .pcv__facts { grid-template-columns: 1fr; } .pcv__table-head, .pcv__table-row { grid-template-columns: 1fr 1fr; } .pcv__lines article, .pcv__changes article { grid-template-columns: 1fr; } }
</style>
