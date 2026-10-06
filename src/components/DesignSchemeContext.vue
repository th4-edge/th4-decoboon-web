<script setup lang="ts">
import { computed } from 'vue'
import StatusTag from '@/components/StatusTag.vue'
import type { DesignScheme, DesignStatus } from '@/domains/design/model'
import type { StatusTone } from '@/core/tone'

const props = withDefaults(defineProps<{
  scheme?: DesignScheme | null
  compact?: boolean
}>(), {
  scheme: null,
  compact: false
})

const STATUS_META: Record<DesignStatus, { label: string; tone: StatusTone }> = {
  draft: { label: '设计中', tone: 'doing' },
  ready: { label: '待谈单', tone: 'done' },
  presented: { label: '已讲解', tone: 'progress' },
  selected: { label: '已选中', tone: 'special' },
  archived: { label: '已归档', tone: 'muted' }
}

const PROPERTY_STATUS_LABELS: Record<string, string> = {
  PendingMeasure: '待量房',
  Measuring: '量房中',
  Measured: '已量房',
  Designing: '设计中',
  Quoted: '已报价',
  Contracted: '已签约',
  Serving: '施工中',
  Completed: '已完工'
}

const propertyStatusLabel = computed(() => {
  const status = props.scheme?.propertyStatus
  return status ? PROPERTY_STATUS_LABELS[status] ?? status : ''
})

const propertyDescription = computed(() => {
  const scheme = props.scheme
  if (!scheme) return '房屋待确认'
  return [
    scheme.propertyNo,
    scheme.propertyAddress,
    scheme.propertyArea ? `${scheme.propertyArea}㎡` : '',
    scheme.propertyLayout,
    propertyStatusLabel.value
  ].filter(Boolean).join(' · ') || '房屋信息待补充'
})

const schemeDescription = computed(() => {
  const scheme = props.scheme
  if (!scheme) return '方案待确认'
  return [scheme.no, `V${scheme.version}`, scheme.style, scheme.area ? `${scheme.area}㎡` : ''].filter(Boolean).join(' · ')
})
</script>

<template>
  <section class="design-context" :class="{ 'design-context--compact': compact }">
    <div>
      <span>客户</span>
      <strong>{{ scheme?.customerName || '客户待确认' }}</strong>
      <small>{{ scheme?.customerId ? `客户编号 ${scheme.customerId}` : '客户归属待确认' }}</small>
    </div>
    <div>
      <span>房屋</span>
      <strong>{{ scheme?.propertyName || '房屋待确认' }}</strong>
      <small>{{ propertyDescription }}</small>
    </div>
    <div>
      <span>设计方案</span>
      <strong>{{ scheme?.name || '方案待确认' }}</strong>
      <small>{{ schemeDescription }}</small>
    </div>
    <StatusTag v-if="scheme && !compact" :tone="STATUS_META[scheme.status].tone" :text="STATUS_META[scheme.status].label" />
  </section>
</template>

<style scoped lang="scss">
.design-context {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
  gap: $space-3;
  align-items: stretch;
  padding: $space-3;
  border: 1px solid $brand-100;
  border-radius: $radius-md;
  background: linear-gradient(135deg, $brand-50 0%, $surface-0 82%);
}

.design-context > div {
  min-width: 0;
  padding: $space-3;
  border: 1px solid rgba(255, 255, 255, .82);
  border-radius: $radius-sm;
  background: rgba(255, 255, 255, .72);
}

.design-context span,
.design-context strong,
.design-context small { display: block; }
.design-context span { color: $text-tertiary; font-size: $font-caption; }
.design-context strong { margin-top: 3px; font-size: $font-body-sm; word-break: break-word; }
.design-context small { margin-top: 3px; color: $text-secondary; font-size: $font-caption; line-height: 1.5; word-break: break-word; }

.design-context--compact {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: $space-2;
}

@media (max-width: 900px) {
  .design-context,
  .design-context--compact { grid-template-columns: 1fr; }
}
</style>
