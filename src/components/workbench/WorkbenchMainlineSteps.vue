<script setup lang="ts">
import { computed } from 'vue'
import { formatCount } from '@/core/format'

export type WorkbenchStepStatus = 'done' | 'current' | 'upcoming'

export interface WorkbenchMainlineBreakdown {
  key: string
  label: string
  count: number
}

export interface WorkbenchMainlineStep {
  key: string
  label: string
  count: number
  unit: string
  status: WorkbenchStepStatus
  breakdown: WorkbenchMainlineBreakdown[]
  route: string
  description?: string
}

const props = withDefaults(defineProps<{
  steps: WorkbenchMainlineStep[]
  mainActionLabel: string
  loading?: boolean
}>(), { loading: false })

const emit = defineEmits<{ open: [route: string] }>()

const current = computed(() => props.steps.find((step) => step.status === 'current'))

function description(step: WorkbenchMainlineStep): string {
  if (step.description) return step.description
  if (step.breakdown.length) {
    return step.breakdown.map((item) => `${item.label} ${item.count}`).join(' · ')
  }
  return step.count === 0 ? '当前无待办' : `${step.count} ${step.unit}待处理`
}

function open(route: string): void {
  if (route) emit('open', route)
}
</script>

<template>
  <section class="pipeline" :aria-busy="loading">
    <div class="pipe-head">
      <div>
        <div class="pipe-title">方案报价主链</div>
        <div class="pipe-desc">量房 → 设计 → 报价 → 合同：当前阶段唯一主行动，完成后自动进入下一站。</div>
      </div>
      <button v-if="current" class="pipe-cta" type="button" @click="open(current.route)">
        {{ mainActionLabel }}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
    </div>

    <div v-if="loading" class="pipeline-steps pipeline-steps--loading" aria-hidden="true">
      <div v-for="n in 4" :key="n" class="p-step">
        <span class="p-ring p-ring--skeleton" />
        <span class="p-skeleton p-skeleton--name" />
        <span class="p-skeleton p-skeleton--count" />
        <span class="p-skeleton p-skeleton--desc" />
      </div>
    </div>

    <div v-else class="pipeline-steps">
      <div
        v-for="(step, index) in steps"
        :key="step.key"
        class="p-step"
        :class="{ done: step.status === 'done', current: step.status === 'current' }"
      >
        <div class="p-ring">
          <svg v-if="step.status === 'done'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
          <span v-else>{{ index + 1 }}</span>
        </div>
        <div class="p-name">{{ step.label }}</div>
        <div class="p-count num">{{ formatCount(step.count) }} {{ step.unit }}待处理</div>
        <div class="p-desc">{{ description(step) }}</div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.pipeline {
  position: relative;
  overflow: hidden;
  margin-bottom: $space-6;
  padding: $space-6;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
  box-shadow: $shadow-card;

  &::after {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 3px;
    opacity: .5;
    background: linear-gradient(90deg, $brand-500 0%, $brand-100 42%, transparent 100%);
  }
}

.pipe-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-4;
  flex-wrap: wrap;
  margin-bottom: $space-5;
}

.pipe-title {
  color: $text-primary;
  font-size: $font-title;
  font-weight: $font-weight-bold;
  letter-spacing: -.01em;
}

.pipe-desc {
  margin-top: 2px;
  color: $text-secondary;
  font-size: $font-caption;
}

.pipe-cta {
  display: inline-flex;
  align-items: center;
  gap: $space-2;
  height: 40px;
  padding: 0 $space-5;
  border: 0;
  border-radius: $radius-sm;
  color: $surface-0;
  font: inherit;
  background: $brand-500;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
  box-shadow: 0 6px 18px rgba(47, 125, 90, .3);
  transition: all .2s;

  &:hover { background: $brand-600; transform: translateY(-1px); }
  &:active { transform: translateY(0); }
  svg { width: 14px; height: 14px; }
}

.pipeline-steps {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  position: relative;
}

.p-step {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 10px;
  text-align: center;

  &::before {
    content: '';
    position: absolute;
    top: 17px;
    left: calc(50% + 20px);
    right: calc(-50% + 20px);
    height: 2px;
    background: $border-color;
    z-index: 0;
  }

  &:last-child::before { display: none; }

  &.done::before {
    background: linear-gradient(90deg, $brand-300, $brand-500);
  }
}

.p-ring {
  position: relative;
  z-index: 1;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 2px solid $status-idle-border;
  border-radius: $radius-pill;
  color: $text-tertiary;
  background: $bg-page;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
  transition: all .25s;
}

.p-step.done .p-ring {
  color: $surface-0;
  border-color: $brand-500;
  background: $brand-500;
}

.p-step.current .p-ring {
  color: $brand-600;
  border-color: $brand-500;
  background: $surface-0;
  box-shadow: 0 0 0 6px $brand-50;
  animation: ringPulse 2.6s ease-out infinite;
}

@keyframes ringPulse {
  0% { box-shadow: 0 0 0 5px $brand-50; }
  55% { box-shadow: 0 0 0 11px rgba(47, 125, 90, .06); }
  100% { box-shadow: 0 0 0 5px $brand-50; }
}

.p-name {
  margin-top: 10px;
  color: $ink-800;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
}

.p-step.current .p-name { color: $brand-700; }

.p-count {
  margin-top: 1px;
  color: $text-secondary;
  font-size: $font-caption;
  font-variant-numeric: tabular-nums;
}

.p-step.current .p-count {
  color: $brand-600;
  font-weight: $font-weight-semibold;
}

.p-desc {
  margin-top: 3px;
  color: $text-tertiary;
  font-size: 11px;
  line-height: 1.5;
}

.p-ring--skeleton {
  border-color: transparent;
  background: linear-gradient(90deg, $surface-100 25%, $surface-50 37%, $surface-100 63%);
  background-size: 400% 100%;
  animation: pipeline-shimmer 1.4s ease infinite;
}

.p-skeleton {
  display: block;
  border-radius: $radius-xs;
  background: linear-gradient(90deg, $surface-100 25%, $surface-50 37%, $surface-100 63%);
  background-size: 400% 100%;
  animation: pipeline-shimmer 1.4s ease infinite;
}

.p-skeleton--name { width: 40px; height: 13px; margin-top: 10px; }
.p-skeleton--count { width: 66px; height: 11px; margin-top: 6px; }
.p-skeleton--desc { width: 84px; height: 11px; margin-top: 5px; }

@keyframes pipeline-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

@media (max-width: 720px) {
  .pipeline-steps {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 26px;
  }

  .p-step::before { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .p-step.current .p-ring,
  .p-ring--skeleton,
  .p-skeleton { animation: none; }
}
</style>
