<script setup lang="ts">
import { computed } from 'vue'
import { formatMoney, formatSignedMoney } from '@/core/format'

const props = withDefaults(defineProps<{
  value: number | null | undefined
  size?: 'sm' | 'md' | 'lg'
  /** true = 差额语义（带正负号并按正红负绿着色）。 */
  delta?: boolean
  /** 缺值时的文案；默认表达「暂不可确认」，禁止用 0 冒充。 */
  emptyText?: string
}>(), { size: 'md', delta: false, emptyText: '暂不可确认' })

const known = computed(
  () => props.value !== null && props.value !== undefined && !Number.isNaN(props.value)
)

const display = computed(() =>
  props.delta ? formatSignedMoney(props.value) : `¥${formatMoney(props.value)}`
)

const deltaClass = computed(() => {
  if (!props.delta || !known.value) return ''
  const v = props.value as number
  if (v > 0) return 'money--up'
  if (v < 0) return 'money--down'
  return ''
})
</script>

<template>
  <span class="money" :class="[`money--${size}`, deltaClass, { 'money--unknown': !known }]">
    <template v-if="known">{{ display }}</template>
    <template v-else>{{ emptyText }}</template>
  </span>
</template>

<style scoped lang="scss">
.money {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.money--sm { font-size: $font-caption; }
.money--md { font-size: $font-body-sm; font-weight: $font-weight-medium; }
.money--lg { font-size: $font-card-title; font-weight: $font-weight-semibold; }

.money--unknown {
  color: $text-tertiary;
  font-weight: $font-weight-regular;
}

/* 差额着色：报价增加用警示色、减少用成功色（与 V2 差额卡一致） */
.money--up { color: $danger-500; }
.money--down { color: $success-500; }
</style>
