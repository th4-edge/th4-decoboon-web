<script setup lang="ts">
import { computed } from 'vue'
import { formatCount } from '@/core/format'
import { toneVar, type StatusTone } from '@/core/tone'
import type { BusinessWorkbenchChartSeries } from '@/domains/workbench/model'

const props = withDefaults(defineProps<{
  series: BusinessWorkbenchChartSeries[]
  labels: Record<string, string>
  tones: Record<string, StatusTone>
  loading?: boolean
}>(), { loading: false })

const maxValue = computed(() => Math.max(1, ...props.series.map((item) => item.value ?? 0)))

const bars = computed(() => props.series.map((item) => ({
  key: item.key,
  label: props.labels[item.key] ?? item.key,
  value: item.value ?? 0,
  percent: (item.value ?? 0) > 0 ? Math.max(2, ((item.value ?? 0) / maxValue.value) * 100) : 0,
  color: toneVar(props.tones[item.key] ?? 'info')
})))
</script>

<template>
  <section class="distribution" :aria-busy="loading">
    <header class="distribution__head">
      <div>
        <h3>当前工作分布</h3>
        <p>直接使用业务工作卡的主数量，不从明细重新计算。</p>
      </div>
    </header>

    <div v-if="loading" class="distribution__loading">
      <el-skeleton :rows="5" animated />
    </div>

    <div v-else-if="!bars.length" class="distribution__empty">
      暂无工作分布数据
    </div>

    <div v-else class="distribution__list">
      <div v-for="item in bars" :key="item.key" class="distribution__item">
        <div class="distribution__label">
          <span>{{ item.label }}</span>
          <b>{{ formatCount(item.value) }}</b>
        </div>
        <div class="distribution__track">
          <i :style="{ width: `${item.percent}%`, backgroundColor: item.color }" aria-hidden="true" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.distribution {
  min-width: 0;
  padding: $space-5;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
  box-shadow: $shadow-card;
}

.distribution__head {
  margin-bottom: $space-4;

  h3 { margin: 0 0 $space-1; font-size: $font-title; }
  p { margin: 0; color: $text-secondary; font-size: $font-body-sm; }
}

.distribution__loading { min-height: 260px; }
.distribution__empty { min-height: 260px; display: grid; place-items: center; color: $text-tertiary; font-size: $font-body-sm; }
.distribution__list { display: flex; flex-direction: column; gap: $space-4; }
.distribution__item { display: flex; flex-direction: column; gap: $space-2; }
.distribution__label { display: flex; align-items: center; justify-content: space-between; gap: $space-3; font-size: $font-body-sm; }
.distribution__label span { color: $text-secondary; }

.distribution__label b {
  color: $text-primary;
  font-variant-numeric: tabular-nums;
}

.distribution__track {
  height: 9px;
  overflow: hidden;
  border-radius: $radius-pill;
  background: $surface-100;

  i { display: block; height: 100%; border-radius: inherit; transition: width $transition-base; }
}
</style>
