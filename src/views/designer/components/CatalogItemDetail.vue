<script setup lang="ts">
import { computed } from 'vue'
import MoneyText from '@/components/MoneyText.vue'
import StatusTag from '@/components/StatusTag.vue'
import { DESIGN_ITEM_TYPE_LABELS, PRICING_MODE_LABELS } from '@/domains/design/meta'
import type { CatalogItem } from '@/domains/catalog/model'
import type { StatusTone } from '@/core/tone'

const props = withDefaults(defineProps<{
  item: CatalogItem
  images?: string[]
  imagesLoading?: boolean
  imagesError?: string
}>(), {
  images: () => [],
  imagesLoading: false,
  imagesError: ''
})

const TYPE_TONES: Record<CatalogItem['type'], StatusTone> = {
  construction: 'alert',
  material: 'progress',
  soft: 'special',
  custom: 'accent',
  appliance: 'info',
  general: 'todo'
}

interface PricePart {
  label: string
  value: number | null
}

const salesPrice = computed<number | null>(() => {
  const item = props.item
  if (item.pricingMode === 'fixedTotal') return item.fixedTotalPrice ?? item.materialPrice + item.manualPrice
  if (item.pricingMode === 'materialOnly') return item.materialPrice
  if (item.pricingMode === 'manualOnly') return item.manualPrice
  return item.materialPrice + item.manualPrice
})

const priceParts = computed<PricePart[]>(() => {
  const item = props.item
  if (item.pricingMode === 'fixedTotal') {
    return [{
      label: item.fixedTotalPrice === undefined ? '固定总价（历史兼容）' : '固定总价',
      value: item.fixedTotalPrice ?? item.materialPrice + item.manualPrice
    }]
  }
  if (item.pricingMode === 'materialOnly') return [{ label: '材料价', value: item.materialPrice }]
  if (item.pricingMode === 'manualOnly') return [{ label: '人工价', value: item.manualPrice }]
  return [
    { label: '材料价', value: item.materialPrice },
    { label: '人工价', value: item.manualPrice }
  ]
})

const identity = computed(() =>
  [props.item.brand, props.item.series, props.item.spec].filter(Boolean).join(' · ') || '品牌与规格未维护'
)
</script>

<template>
  <article class="detail">
    <header class="detail__head">
      <div>
        <span class="detail__kicker">报价分项详情</span>
        <strong>{{ item.code || '编码未维护' }}</strong>
      </div>
      <StatusTag :tone="TYPE_TONES[item.type]" :text="DESIGN_ITEM_TYPE_LABELS[item.type]" />
    </header>

    <h3>{{ item.name }}</h3>
    <p class="detail__identity">{{ identity }}</p>

    <section class="detail__price" aria-label="销售单价">
      <span>销售单价 / {{ item.unit }}</span>
      <MoneyText :value="salesPrice" size="lg" />
      <small>{{ PRICING_MODE_LABELS[item.pricingMode] }}</small>
    </section>

    <section v-if="imagesLoading || images.length || imagesError" class="detail__section detail__images-section">
      <h4>效果图片</h4>
      <el-skeleton v-if="imagesLoading" :rows="2" animated />
      <p v-else-if="imagesError" class="detail__images-error">{{ imagesError }}</p>
      <div v-else class="detail__images">
        <el-image
          v-for="(src, index) in images"
          :key="src"
          :src="src"
          :preview-src-list="images"
          :initial-index="index"
          fit="cover"
          preview-teleported
          class="detail__image"
        >
          <template #error>
            <div class="detail__image-error">图片无法预览</div>
          </template>
        </el-image>
      </div>
    </section>

    <dl class="detail__facts">
      <div>
        <dt>项目分类</dt>
        <dd>{{ item.category || '分类未维护' }}</dd>
      </div>
      <div>
        <dt>计量单位</dt>
        <dd>{{ item.unit || '单位未维护' }}</dd>
      </div>
      <div>
        <dt>计价方式</dt>
        <dd>{{ PRICING_MODE_LABELS[item.pricingMode] }}</dd>
      </div>
    </dl>

    <section class="detail__section">
      <h4>价格构成</h4>
      <dl class="detail__prices">
        <div v-for="part in priceParts" :key="part.label">
          <dt>{{ part.label }}</dt>
          <dd><MoneyText :value="part.value" /></dd>
        </div>
        <div v-if="item.costPrice !== undefined" class="detail__cost-row">
          <dt>标准成本</dt>
          <dd>
            <span v-if="item.costPrice === null" class="detail__cost-pending">成本待维护</span>
            <MoneyText v-else :value="item.costPrice" />
          </dd>
        </div>
      </dl>
      <p v-if="item.costPrice === null" class="detail__cost-hint">成本不完整时，项目利润与毛利率不会以 0 成本代替计算。</p>
    </section>

    <section class="detail__section">
      <h4>计价公式</h4>
      <p>{{ item.formula || '计价公式暂未维护' }}</p>
    </section>

    <section class="detail__section">
      <h4>工艺要求</h4>
      <p class="detail__long-text">{{ item.craft || '工艺说明暂未维护' }}</p>
    </section>

    <section class="detail__section">
      <h4>验收标准</h4>
      <p class="detail__long-text">{{ item.criterion || '验收标准暂未维护' }}</p>
    </section>

    <section class="detail__section">
      <h4>项目说明</h4>
      <p class="detail__long-text">{{ item.description || '项目说明暂未维护' }}</p>
    </section>

  </article>
</template>

<style scoped lang="scss">
.detail {
  padding: $space-4;
}

.detail__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-3;
  padding-bottom: $space-3;
  border-bottom: 1px solid $border-color;

  > div {
    min-width: 0;
  }

  strong {
    display: block;
    margin-top: 3px;
    color: $text-secondary;
    font-size: $font-caption;
    font-weight: $font-weight-medium;
    font-variant-numeric: tabular-nums;
  }
}

.detail__kicker {
  color: $text-secondary;
  font-size: $font-caption;
}

.detail h3 {
  margin: $space-4 0 $space-2;
  color: $text-primary;
  font-size: $font-h1;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.detail__identity {
  margin: 0;
  color: $text-secondary;
  font-size: $font-body-sm;
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.detail__price {
  display: grid;
  gap: $space-1;
  margin-top: $space-4;
  padding: $space-4;
  border: 1px solid $brand-100;
  border-radius: $radius-md;
  background: $brand-50;

  > span:first-child,
  > small {
    color: $text-secondary;
    font-size: $font-caption;
  }

  :deep(.money) {
    color: $brand-700;
  }
}

.detail__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 $space-4;
  margin: $space-4 0 0;

  div {
    min-width: 0;
    padding: $space-3 0;
    border-bottom: 1px solid $border-color;
  }

  dt {
    color: $text-secondary;
    font-size: $font-caption;
  }

  dd {
    margin: 3px 0 0;
    color: $text-primary;
    font-size: $font-body-sm;
    overflow-wrap: anywhere;
  }
}

.detail__section {
  padding-top: $space-4;

  h4 {
    margin: 0 0 $space-2;
    color: $text-primary;
    font-size: $font-body;
  }

  p {
    margin: 0;
    color: $text-secondary;
    font-size: $font-body-sm;
    line-height: 1.75;
  }
}

.detail__prices {
  display: grid;
  gap: $space-2;
  margin: 0;

  div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-3;
    padding: $space-2 $space-3;
    border-radius: $radius-sm;
    background: $surface-50;
  }

  dt {
    color: $text-secondary;
    font-size: $font-body-sm;
  }

  dd {
    margin: 0;
  }
}

.detail__cost-row {
  border: 1px solid $brand-100;
  background: $brand-50;
}

.detail__cost-pending {
  color: $warning-700;
  font-size: $font-body-sm;
  font-weight: $font-weight-semibold;
}

.detail__cost-hint {
  margin-top: $space-2 !important;
  color: $warning-700 !important;
  font-size: $font-caption !important;
}

.detail__long-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.detail__images {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-2;
}

.detail__image {
  width: 100%;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-50;
  cursor: zoom-in;
}

.detail__image-error {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  padding: $space-2;
  color: $text-secondary;
  font-size: $font-caption;
  text-align: center;
}

.detail__images-error {
  color: $warning-700 !important;
}

@media (max-width: 1399px) {
  .detail {
    padding: $space-5;
  }
}
</style>
