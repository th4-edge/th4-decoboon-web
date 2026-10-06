<script setup lang="ts">
import { computed } from 'vue'
import type { Customer, CustomerStage } from '@/domains/crm/model'
import type { Property, PropertyStatus } from '@/domains/property/model'

const props = withDefaults(defineProps<{
  customer?: Customer | null
  property?: Property | null
  schemeName?: string
}>(), {
  customer: null,
  property: null,
  schemeName: ''
})

const STAGE_LABELS: Record<CustomerStage, string> = {
  intention: '待首联',
  following: '跟进中',
  pendingMeasure: '待量房',
  quote: '方案报价',
  sign: '已签约',
  construction: '施工中',
  done: '已完工',
  lost: '已流失'
}

const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  pendingMeasure: '待量房',
  measuring: '量房中',
  measured: '已量房',
  designing: '设计中',
  quoted: '已报价',
  contracted: '已签约',
  serving: '施工中',
  completed: '已完工'
}

const customerDescription = computed(() => {
  if (!props.customer) return '客户待确认'
  return [
    props.customer.phone || '电话待补充',
    STAGE_LABELS[props.customer.stage],
    props.customer.designerName || '负责人待确认'
  ].join(' · ')
})

const propertyDescription = computed(() => {
  if (!props.property) return '尚未选择房屋'
  return [
    props.property.address || [props.property.community, props.property.building, props.property.roomNo].filter(Boolean).join(' '),
    props.property.area ? `${props.property.area}㎡` : '面积待补充',
    props.property.layout || '户型待补充',
    PROPERTY_STATUS_LABELS[props.property.status]
  ].filter(Boolean).join(' · ')
})

function propertyLabel(property: Property): string {
  return property.community || property.address || [property.building, property.roomNo].filter(Boolean).join(' ') || '房屋待完善'
}
</script>

<template>
  <div class="customer-property-context">
    <div>
      <span>客户</span>
      <strong>{{ customer?.name || '客户待确认' }}</strong>
      <small>{{ customerDescription }}</small>
    </div>
    <div>
      <span>房屋</span>
      <strong>{{ property ? propertyLabel(property) : '尚未选择房屋' }}</strong>
      <small>{{ propertyDescription }}</small>
    </div>
    <div v-if="schemeName">
      <span>当前方案</span>
      <strong>{{ schemeName }}</strong>
      <small>方案与当前客户、房屋绑定</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.customer-property-context {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-3;
  padding: $space-3;
  margin-bottom: $space-4;
  border: 1px solid $brand-100;
  border-radius: $radius-md;
  background: linear-gradient(135deg, $brand-50 0%, $surface-0 82%);
}

.customer-property-context > div {
  min-width: 0;
  padding: $space-3;
  border: 1px solid rgba(255, 255, 255, .82);
  border-radius: $radius-sm;
  background: rgba(255, 255, 255, .72);
}

.customer-property-context span,
.customer-property-context strong,
.customer-property-context small { display: block; }
.customer-property-context span { color: $text-tertiary; font-size: $font-caption; }
.customer-property-context strong { margin-top: 3px; font-size: $font-body-sm; word-break: break-word; }
.customer-property-context small { margin-top: 3px; color: $text-secondary; font-size: $font-caption; line-height: 1.5; word-break: break-word; }

@media (max-width: 620px) {
  .customer-property-context { grid-template-columns: 1fr; }
}
</style>
