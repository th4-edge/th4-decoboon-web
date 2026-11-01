<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '@/components/EmptyState.vue'
import MoneyText from '@/components/MoneyText.vue'
import StatusTag from '@/components/StatusTag.vue'
import { designApi } from '@/domains/design/api'
import type { DesignItem, DesignScheme, DesignStatus, PricingMode } from '@/domains/design/model'
import type { StatusTone } from '@/core/tone'

const route = useRoute()
const router = useRouter()
const designId = computed(() => String(route.params.designId ?? ''))
const scheme = ref<DesignScheme | null>(null)
const loading = ref(false)
const error = ref('')

const STATUS_META: Record<DesignStatus, { label: string; tone: StatusTone }> = {
  draft: { label: '设计中', tone: 'doing' },
  ready: { label: '待谈单', tone: 'done' },
  presented: { label: '已讲解', tone: 'progress' },
  selected: { label: '已选中', tone: 'special' },
  archived: { label: '已归档', tone: 'muted' }
}

const PRICING_LABELS: Record<PricingMode, string> = {
  materialAndManual: '材料+人工',
  materialOnly: '仅材料',
  manualOnly: '仅人工',
  fixedTotal: '固定总价'
}

const spacesById = computed(() => new Map((scheme.value?.spaces ?? []).map((space) => [space.id, space])))
const priceLabel = computed(() => scheme.value?.priceSource === 'quote'
  ? `当前正式报价${scheme.value.currentQuoteNo ? ` · ${scheme.value.currentQuoteNo}` : ''}`
  : scheme.value?.priceSource === 'calculated' ? '方案计算价 · 待生成正式报价' : '尚无设计分项 · 暂不可计算')
const primaryPrice = computed(() => {
  if (!scheme.value) return null
  if (scheme.value.priceSource === 'quote') return scheme.value.currentQuoteAmount ?? null
  if (scheme.value.priceSource === 'calculated') return scheme.value.calculatedAmount
  return null
})
const costVisible = computed(() => (scheme.value?.items ?? []).some((item) => item.cost !== undefined))
const costComplete = computed(() => costVisible.value
  && (scheme.value?.items ?? []).every((item) => item.cost !== null && item.cost !== undefined))
const totalCost = computed(() => costComplete.value
  ? (scheme.value?.items ?? []).reduce((sum, item) => sum + Number(item.cost ?? 0), 0)
  : null)
const grossProfit = computed(() => {
  if (!scheme.value || totalCost.value === null) return null
  return scheme.value.calculatedAmount - totalCost.value
})

function itemSpaceName(item: DesignItem): string {
  return item.spaceId ? spacesById.value.get(item.spaceId)?.name ?? '区域待确认' : '综合项目'
}

function itemUnitPrice(item: DesignItem): number {
  if (item.pricingMode === 'fixedTotal') return item.fixedTotalPrice ?? item.price
  if (item.pricingMode === 'materialOnly') return item.materialPrice
  if (item.pricingMode === 'manualOnly') return item.manualPrice
  return item.materialPrice + item.manualPrice
}

async function load(): Promise<void> {
  if (!designId.value) return
  loading.value = true
  error.value = ''
  try {
    scheme.value = await designApi.schemeInfo(designId.value)
  } catch (loadError) {
    scheme.value = null
    error.value = loadError instanceof Error ? loadError.message : '设计方案暂不可确认'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="review-detail">
    <header class="review-detail__head">
      <el-button link @click="router.back()">← 返回设计方案列表</el-button>
      <template v-if="scheme">
        <div class="review-detail__title-row">
          <div>
            <p class="review-detail__eyebrow">设计报价 · 运营查看</p>
            <h2>{{ scheme.name || '设计方案' }}</h2>
            <p>V{{ scheme.version }} · {{ scheme.ownerName || '设计师待定' }} · {{ scheme.storeName || '门店待确认' }}</p>
          </div>
          <StatusTag :tone="STATUS_META[scheme.status]?.tone ?? 'info'" :text="STATUS_META[scheme.status]?.label ?? '状态待确认'" :dot="false" />
        </div>
      </template>
    </header>

    <div v-if="error" class="review-detail__state">
      <EmptyState title="设计方案暂不可确认" :description="error" action-text="重新加载" @action="load" />
    </div>
    <div v-else-if="loading" class="review-detail__state">
      <el-skeleton :rows="8" animated />
    </div>
    <template v-else-if="scheme">
      <section class="review-detail__context">
        <div><small>客户</small><strong>{{ scheme.customerName || '客户待确认' }}</strong></div>
        <div><small>房屋</small><strong>{{ scheme.propertyAddress || scheme.propertyName || '房屋待确认' }}</strong></div>
        <div><small>设计进度</small><strong>{{ scheme.spaceCount }} 个区域 · {{ scheme.itemCount }} 个分项</strong></div>
        <div><small>最近更新</small><strong>{{ scheme.updatedAt || '暂不可确认' }}</strong></div>
      </section>

      <section class="review-detail__price-grid">
        <article class="review-detail__price-card review-detail__price-card--primary">
          <small>{{ priceLabel }}</small>
          <strong v-if="primaryPrice !== null"><MoneyText :value="primaryPrice" size="lg" /></strong>
          <strong v-else class="review-detail__muted">暂不可计算</strong>
          <span v-if="scheme.currentQuoteStatusName">报价状态：{{ scheme.currentQuoteStatusName }}</span>
        </article>
        <article class="review-detail__price-card">
          <small>方案计算价</small>
          <strong><MoneyText :value="scheme.calculatedAmount" /></strong>
          <span>当前设计分项销售金额合计</span>
        </article>
        <article v-if="costVisible" class="review-detail__price-card">
          <small>预计成本</small>
          <strong v-if="costComplete"><MoneyText :value="totalCost" /></strong>
          <strong v-else class="review-detail__muted">成本未完整</strong>
          <span>{{ costComplete ? '根据设计分项标准成本汇总' : '存在成本待维护，不能计算可靠毛利' }}</span>
        </article>
        <article v-if="costVisible" class="review-detail__price-card">
          <small>预计毛利</small>
          <strong v-if="grossProfit !== null"><MoneyText :value="grossProfit" /></strong>
          <strong v-else class="review-detail__muted">成本未完整</strong>
          <span>毛利 = 方案计算价 − 预计成本</span>
        </article>
      </section>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="该页面仅用于企业运营查看，不产生审批、核价、退回或状态变化。"
        description="需要调整方案或报价时，请回到原有设计工作区或报价工作台处理。"
      />

      <section class="review-detail__items">
        <header>
          <div>
            <h3>设计分项与价格</h3>
            <p>按区域查看设计构成、销售价和报价口径；成本字段仅授权角色可见。</p>
          </div>
          <span>{{ scheme.itemCount }} 项</span>
        </header>

        <EmptyState
          v-if="!scheme.items.length"
          title="尚无设计分项"
          description="当前方案还不能形成方案计算价或正式报价。"
        />
        <div v-else class="review-detail__table-wrap">
          <table class="review-detail__table">
            <thead>
              <tr>
                <th>区域 / 分项</th>
                <th>工程量</th>
                <th>销售单价</th>
                <th>销售金额</th>
                <th>计价方式</th>
                <th v-if="costVisible">成本</th>
                <th v-if="costVisible">毛利</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in scheme.items" :key="item.id">
                <td>
                  <strong>{{ item.name }}</strong>
                  <small>{{ itemSpaceName(item) }} · {{ item.category }}</small>
                </td>
                <td>{{ item.quantity }} {{ item.unit }}</td>
                <td><MoneyText :value="itemUnitPrice(item)" /></td>
                <td><MoneyText :value="item.amount" /></td>
                <td>{{ PRICING_LABELS[item.pricingMode] }}</td>
                <td v-if="costVisible">
                  <MoneyText v-if="item.cost !== null && item.cost !== undefined" :value="item.cost" />
                  <span v-else class="review-detail__muted">待维护</span>
                </td>
                <td v-if="costVisible">
                  <MoneyText v-if="item.cost !== null && item.cost !== undefined" :value="item.amount - item.cost" />
                  <span v-else class="review-detail__muted">暂不可计算</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="review-detail__support">
        <h3>设计上下文</h3>
        <dl>
          <div><dt>客户诉求</dt><dd>{{ scheme.requirements.length }} 条</dd></div>
          <div><dt>量房原始区域</dt><dd>{{ scheme.spaces.length }} 个</dd></div>
          <div><dt>方案状态</dt><dd>{{ STATUS_META[scheme.status]?.label ?? '状态待确认' }}</dd></div>
          <div><dt>成本口径</dt><dd>{{ costVisible ? (costComplete ? '完整' : '未完整') : '当前角色不可见' }}</dd></div>
        </dl>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
.review-detail {
  min-height: 100%;
  padding: $space-5;
  background: $bg-page;
}

.review-detail__head {
  display: grid;
  gap: $space-3;
}

.review-detail__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;

  h2 { margin: $space-1 0 $space-2; color: $text-primary; font-size: $font-display; }
  p:last-child { margin: 0; color: $text-secondary; font-size: $font-body-sm; }
}

.review-detail__eyebrow {
  margin: 0;
  color: $brand-700 !important;
  font-size: $font-caption !important;
  font-weight: $font-weight-semibold;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.review-detail__state { margin-top: $space-4; padding: $space-5; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; }

.review-detail__context,
.review-detail__price-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: $space-3;
  margin-top: $space-4;
}

.review-detail__context > div,
.review-detail__price-card,
.review-detail__items,
.review-detail__support {
  padding: $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  box-shadow: $shadow-card;
}

.review-detail__context small,
.review-detail__price-card small { display: block; color: $text-secondary; font-size: $font-caption; }
.review-detail__context strong { display: block; margin-top: 4px; color: $text-primary; font-size: $font-body-sm; overflow-wrap: anywhere; }

.review-detail__price-card {
  display: grid;
  gap: $space-2;

  strong { color: $text-primary; }
  span { color: $text-secondary; font-size: $font-caption; line-height: 1.55; }
}

.review-detail__price-card--primary {
  border-color: $brand-200;
  background: $brand-50;

  strong { color: $brand-700; }
}

.review-detail__muted { color: $warning-700 !important; font-size: $font-body-sm !important; }

.review-detail :deep(.el-alert) { margin-top: $space-4; }

.review-detail__items,
.review-detail__support { margin-top: $space-4; }

.review-detail__items > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-3;
  margin-bottom: $space-3;

  h3, p { margin: 0; }
  h3 { color: $text-primary; font-size: $font-card-title; }
  p { margin-top: 4px; color: $text-secondary; font-size: $font-caption; }
  > span { color: $text-secondary; font-size: $font-caption; }
}

.review-detail__table-wrap { overflow-x: auto; }
.review-detail__table {
  width: 100%;
  min-width: 920px;
  border-collapse: collapse;

  th, td { padding: $space-3; border-bottom: 1px solid $border-color; text-align: left; vertical-align: top; }
  th { color: $text-secondary; background: $surface-50; font-size: $font-caption; font-weight: $font-weight-semibold; }
  td { color: $text-primary; font-size: $font-body-sm; }
  td strong, td small { display: block; }
  td small { margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }
}

.review-detail__support h3 { margin: 0 0 $space-3; color: $text-primary; font-size: $font-card-title; }
.review-detail__support dl { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: $space-3; margin: 0; }
.review-detail__support dt { color: $text-secondary; font-size: $font-caption; }
.review-detail__support dd { margin: 4px 0 0; color: $text-primary; font-size: $font-body-sm; }

@media (max-width: 1100px) {
  .review-detail__context,
  .review-detail__price-grid,
  .review-detail__support dl { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 720px) {
  .review-detail { padding: $space-4; }
  .review-detail__title-row { flex-direction: column; }
  .review-detail__context,
  .review-detail__price-grid,
  .review-detail__support dl { grid-template-columns: minmax(0, 1fr); }
}
</style>
