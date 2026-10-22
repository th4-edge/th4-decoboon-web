<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '@/components/EmptyState.vue'
import MoneyText from '@/components/MoneyText.vue'
import StatusTag from '@/components/StatusTag.vue'
import { designApi } from '@/domains/design/api'
import type { DesignReviewPageResult, DesignScheme, DesignStatus } from '@/domains/design/model'
import { useSessionStore } from '@/stores/session'
import type { StatusTone } from '@/core/tone'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const STATUS_META: Record<DesignStatus, { label: string; tone: StatusTone }> = {
  draft: { label: '设计中', tone: 'doing' },
  ready: { label: '待谈单', tone: 'done' },
  presented: { label: '已讲解', tone: 'progress' },
  selected: { label: '已选中', tone: 'special' },
  archived: { label: '已归档', tone: 'muted' }
}

const items = ref<DesignScheme[]>([])
const result = ref<DesignReviewPageResult>({ items: [], total: 0, current: 1, size: 30, pages: 1 })
const loading = ref(false)
const error = ref('')
const keyword = ref('')
const status = ref<DesignStatus | ''>('')
const ownerId = ref('')
const currentPage = ref(1)
const PAGE_SIZE = 30

const title = computed(() => {
  if (session.role === 'StoreManager') return '本店设计方案'
  if (session.role === 'Finance') return '设计方案与报价查看'
  return '设计方案运营查看'
})

const subtitle = computed(() => {
  if (session.role === 'Finance') return '只读查看数据范围内的方案价格、报价状态和成本完整性，不产生审批或核价流程。'
  if (session.role === 'StoreManager') return '只读查看本店方案与当前报价；需要处理时进入现有设计或报价工作面。'
  return '只读查看全企业方案与当前报价；不改变设计方案、报价或合同状态。'
})

const ownerOptions = computed(() => {
  const map = new Map<string, string>()
  for (const item of items.value) {
    if (item.ownerId && item.ownerName) map.set(item.ownerId, item.ownerName)
  }
  return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
})

const shownItems = computed(() => ownerId.value ? items.value.filter((item) => item.ownerId === ownerId.value) : items.value)

function statusMeta(value: DesignStatus) {
  return STATUS_META[value] ?? { label: '状态待确认', tone: 'info' as StatusTone }
}

function primaryPrice(item: DesignScheme): number | null {
  if (item.priceSource === 'quote') return item.currentQuoteAmount ?? null
  if (item.priceSource === 'calculated') return item.calculatedAmount
  return null
}

function priceLabel(item: DesignScheme): string {
  if (item.priceSource === 'quote') {
    return `当前正式报价${item.currentQuoteNo ? ` · ${item.currentQuoteNo}` : ''}`
  }
  if (item.priceSource === 'calculated') return '方案计算价 · 待生成正式报价'
  return '尚无设计分项 · 暂不可计算'
}

async function load(page = 1): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const next = await designApi.reviewDesigns({
      status: status.value || undefined,
      keyword: keyword.value.trim() || undefined,
      current: page,
      size: PAGE_SIZE
    })
    result.value = next
    items.value = next.items
    currentPage.value = next.current
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : '设计方案暂不可确认'
    items.value = []
  } finally {
    loading.value = false
  }
}

function search(): void {
  ownerId.value = ''
  void load(1)
}

function reset(): void {
  keyword.value = ''
  status.value = ''
  ownerId.value = ''
  void load(1)
}

function openScheme(item: DesignScheme): void {
  const base = route.path.startsWith('/finance')
    ? '/finance/design-reviews'
    : '/workbench/design-reviews'
  void router.push(`${base}/${item.id}`)
}

onMounted(() => { void load(1) })
</script>

<template>
  <div class="review">
    <header class="review__head">
      <div>
        <p class="review__eyebrow">设计报价 · 运营查看</p>
        <h2>{{ title }}</h2>
        <p>{{ subtitle }}</p>
      </div>
      <span class="review__readonly">只读</span>
    </header>

    <section class="review__filters" aria-label="设计方案筛选">
      <el-input v-model="keyword" clearable placeholder="方案名 / 编号 / 客户 / 房屋" @keyup.enter="search" />
      <el-select v-model="status" clearable placeholder="设计状态" @change="search">
        <el-option v-for="(meta, key) in STATUS_META" :key="key" :label="meta.label" :value="key" />
      </el-select>
      <el-select v-model="ownerId" clearable placeholder="设计师">
        <el-option v-for="owner in ownerOptions" :key="owner.id" :label="owner.name" :value="owner.id" />
      </el-select>
      <el-button type="primary" @click="search">筛选</el-button>
      <el-button @click="reset">重置</el-button>
    </section>

    <EmptyState
      v-if="error"
      title="设计方案暂不可确认"
      :description="error"
      action-text="重新加载"
      @action="load(currentPage)"
    />
    <div v-else-if="loading" class="review__skeleton">
      <el-skeleton v-for="index in 6" :key="index" :rows="3" animated />
    </div>
    <EmptyState
      v-else-if="!shownItems.length"
      title="当前范围没有设计方案"
      description="调整设计状态、设计师或关键词后重试；没有数据不等于加载失败。"
      action-text="重置筛选"
      @action="reset"
    />
    <section v-else class="review__grid" aria-label="设计方案列表">
      <article v-for="item in shownItems" :key="item.id" class="review-card" @click="openScheme(item)">
        <header class="review-card__head">
          <div>
            <strong>{{ item.name || '方案待命名' }}</strong>
            <small>{{ item.no || '编号待确认' }} · V{{ item.version }} · {{ item.ownerName || '设计师待定' }}</small>
          </div>
          <StatusTag :tone="statusMeta(item.status).tone" :text="statusMeta(item.status).label" :dot="false" />
        </header>

        <div class="review-card__context">
          <span>{{ item.customerName || '客户待确认' }}</span>
          <span>{{ item.propertyAddress || item.propertyName || '房屋待确认' }}</span>
          <span v-if="item.storeName">{{ item.storeName }}</span>
        </div>

        <div class="review-card__price">
          <small>{{ priceLabel(item) }}</small>
          <strong v-if="primaryPrice(item) !== null"><MoneyText :value="primaryPrice(item)" size="lg" /></strong>
          <strong v-else class="review-card__price-empty">暂不可计算</strong>
          <span v-if="item.currentQuoteStatusName">{{ item.currentQuoteStatusName }}</span>
        </div>

        <dl class="review-card__facts">
          <div><dt>面积</dt><dd>{{ item.area ? `${item.area}㎡` : '待补充' }}</dd></div>
          <div><dt>区域</dt><dd>{{ item.spaceCount }} 个</dd></div>
          <div><dt>分项</dt><dd>{{ item.itemCount }} 项</dd></div>
          <div v-if="item.priceSource === 'quote'"><dt>方案计算价</dt><dd><MoneyText :value="item.calculatedAmount" /></dd></div>
        </dl>

        <footer class="review-card__foot">
          <span>点击查看方案价格与分项</span>
          <span aria-hidden="true">→</span>
        </footer>
      </article>
    </section>

    <div v-if="!error && result.pages > 1" class="review__pagination">
      <el-pagination
        background
        layout="prev, pager, next"
        :current-page="currentPage"
        :page-size="PAGE_SIZE"
        :total="result.total"
        @current-change="load"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.review {
  min-height: 100%;
  padding: $space-5;
  background: $bg-page;
}

.review__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-6;

  h2 { margin: $space-1 0 $space-2; color: $text-primary; font-size: $font-display; }
  p:last-child { max-width: 760px; margin: 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
}

.review__eyebrow {
  margin: 0;
  color: $brand-700 !important;
  font-size: $font-caption !important;
  font-weight: $font-weight-semibold;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.review__readonly {
  flex: 0 0 auto;
  padding: 5px 10px;
  border: 1px solid $brand-200;
  border-radius: $radius-pill;
  color: $brand-700;
  background: $brand-50;
  font-size: $font-caption;
}

.review__filters {
  display: grid;
  grid-template-columns: minmax(240px, 1.6fr) 180px 180px auto auto;
  gap: $space-2;
  align-items: center;
  margin-top: $space-5;
  padding: $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  box-shadow: $shadow-card;
}

.review__skeleton,
.review__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-4;
  margin-top: $space-4;
}

.review__skeleton > *,
.review-card {
  padding: $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  box-shadow: $shadow-card;
}

.review-card {
  cursor: pointer;
  transition: $transition-fast;

  &:hover { border-color: $brand-300; transform: translateY(-1px); }
}

.review-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-3;

  > div { min-width: 0; }
  strong, small { display: block; }
  strong { overflow: hidden; color: $text-primary; font-size: $font-card-title; text-overflow: ellipsis; white-space: nowrap; }
  small { margin-top: 4px; color: $text-tertiary; font-size: $font-caption; }
}

.review-card__context {
  display: flex;
  flex-wrap: wrap;
  gap: $space-2;
  margin-top: $space-3;

  span {
    padding: 3px 7px;
    border-radius: $radius-sm;
    color: $text-secondary;
    background: $surface-50;
    font-size: $font-caption;
  }
}

.review-card__price {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: $space-1 $space-3;
  align-items: end;
  margin-top: $space-4;
  padding: $space-3;
  border: 1px solid $brand-100;
  border-radius: $radius-sm;
  background: $brand-50;

  small { grid-column: 1 / -1; color: $text-secondary; font-size: $font-caption; }
  strong { color: $brand-700; }
  > span { color: $brand-700; font-size: $font-caption; }
}

.review-card__price-empty {
  color: $text-secondary !important;
  font-size: $font-body-sm !important;
}

.review-card__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-2 $space-4;
  margin: $space-3 0 0;

  div { display: flex; justify-content: space-between; gap: $space-2; }
  dt { color: $text-secondary; font-size: $font-caption; }
  dd { margin: 0; color: $text-primary; font-size: $font-body-sm; }
}

.review-card__foot {
  display: flex;
  justify-content: space-between;
  margin-top: $space-4;
  padding-top: $space-3;
  border-top: 1px solid $border-color;
  color: $text-tertiary;
  font-size: $font-caption;
}

.review__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: $space-4;
}

@media (max-width: 1100px) {
  .review__filters { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .review__grid,
  .review__skeleton { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 720px) {
  .review { padding: $space-4; }
  .review__head { flex-direction: column; }
  .review__filters { grid-template-columns: minmax(0, 1fr); }
}
</style>
