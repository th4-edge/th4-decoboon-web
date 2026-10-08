<script setup lang="ts">
import { computed } from 'vue'
import { formatCount } from '@/core/format'
import { toneVar, type StatusTone } from '@/core/tone'
import { BUSINESS_CARD_ICONS } from './businessCardIcons'
import type { BusinessWorkbenchCardMetric } from '@/domains/workbench/model'

export type BusinessWorkbenchIconName =
  | 'measure'
  | 'design'
  | 'quote'
  | 'waiting'
  | 'contract'
  | 'project'
  | 'material'
  | 'change'
  | 'acceptance'

export interface BusinessWorkbenchCardConfig {
  key: string
  metricKey?: string
  label: string
  description: string
  icon: BusinessWorkbenchIconName
  route: string
  tone: StatusTone
  unit: string
  breakdownLabels: Record<string, string>
  actionText?: string
  group?: string
  pendingExcluded?: boolean
}

const props = withDefaults(defineProps<{
  config: BusinessWorkbenchCardConfig
  metric?: BusinessWorkbenchCardMetric
  loading?: boolean
}>(), { metric: undefined, loading: false })

const emit = defineEmits<{ open: [route: string] }>()

const iconPaths = computed(() => BUSINESS_CARD_ICONS[props.config.icon])
const cssVars = computed(() => ({
  '--wc-tone': toneVar(props.config.tone),
  '--wc-soft': toneVar(props.config.tone, 'soft')
}))

const countText = computed(() => {
  if (props.loading) return '—'
  if (!props.metric || props.metric.status === 'partial') return '暂不可确认'
  return formatCount(props.metric.count)
})

const partial = computed(() => props.metric?.status === 'partial')
const riskText = computed(() => {
  const risk = props.metric?.riskCount
  return typeof risk === 'number' && risk > 0 ? `${risk} 项含风险` : ''
})
const visibleBreakdown = computed(() =>
  (props.metric?.breakdown ?? []).filter((item) => item.count > 0)
)

function open(): void {
  emit('open', props.config.route)
}
</script>

<template>
  <article
    class="wcard"
    :style="cssVars"
    :aria-busy="loading"
    role="button"
    tabindex="0"
    @click="open"
    @keydown.enter.prevent="open"
    @keydown.space.prevent="open"
  >
    <div class="wcard-head">
      <div class="wcard-ic" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path v-for="path in iconPaths" :key="path" :d="path" />
        </svg>
      </div>
      <div>
        <div class="wcard-title">{{ config.label }}</div>
        <div class="wcard-desc" :title="config.description">{{ config.description }}</div>
      </div>
      <span v-if="riskText" class="wcard-hint">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
        </svg>
        {{ riskText }}
      </span>
    </div>

    <div class="wcard-count-row">
      <span v-if="loading" class="wcard-count-skeleton" aria-hidden="true" />
      <template v-else>
        <span class="wcard-count num" :class="{ 'wcard-count--unknown': countText === '暂不可确认' }">{{ countText }}</span>
        <span v-if="countText !== '暂不可确认'" class="wcard-unit">{{ config.unit }}</span>
      </template>
    </div>

    <div v-if="loading" class="wcard-break" aria-hidden="true">
      <span class="chip chip--skeleton" />
      <span class="chip chip--skeleton chip--skeleton--short" />
    </div>
    <div v-else-if="visibleBreakdown.length" class="wcard-break">
      <span v-for="item in visibleBreakdown" :key="item.key" class="chip">
        {{ config.breakdownLabels[item.key] ?? item.key }}
        <b>{{ item.count }}</b>
      </span>
    </div>
    <div v-else class="empty-line">
      <svg v-if="metric && metric.count === 0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 13l4 4L19 7" />
      </svg>
      {{ metric && metric.count === 0 ? '当前无待办' : '暂无细分数据' }}
    </div>

    <button class="wcard-act" type="button" :disabled="partial" @click.stop="open">
      {{ config.actionText ?? '进入工作台' }}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </button>
  </article>
</template>

<style scoped lang="scss">
.wcard {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: $space-3;
  min-width: 0;
  min-height: 208px;
  padding: $space-5;
  overflow: hidden;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
  box-shadow: $shadow-card;
  cursor: pointer;
  transition: transform .22s cubic-bezier(.34, 1.56, .64, 1), box-shadow .22s, border-color .22s;

  &::before {
    content: '';
    position: absolute;
    inset: auto 0 0 0;
    height: 2px;
    transform: scaleX(0);
    transform-origin: left;
    background: var(--wc-tone);
    transition: transform .28s cubic-bezier(.4, 0, .2, 1);
  }

  &:hover {
    transform: translateY(-3px);
    border-color: $border-color;
    box-shadow: $shadow-elevated;

    &::before { transform: scaleX(1); }
    .wcard-ic { transform: scale(1.06); }
    .wcard-act { color: $brand-700; }
    .wcard-act svg { transform: translateX(3px); }
  }

  &:active { transform: translateY(-1px); }

  &:focus-visible {
    outline: 2px solid $brand-500;
    outline-offset: 2px;
  }
}

.wcard-head {
  display: flex;
  align-items: flex-start;
  gap: $space-3;
}

.wcard-ic {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: $radius-md;
  color: var(--wc-tone);
  background: var(--wc-soft);
  transition: transform .22s;

  svg { width: 20px; height: 20px; }
}

.wcard-title {
  color: $text-primary;
  font-size: $font-card-title;
  font-weight: $font-weight-semibold;
  letter-spacing: -.01em;
}

.wcard-desc {
  display: -webkit-box;
  overflow: hidden;
  min-height: 38px;
  margin-top: 1px;
  color: $text-secondary;
  font-size: $font-caption;
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.wcard-count-row {
  display: flex;
  align-items: baseline;
  gap: 7px;
}

.wcard-count {
  color: $text-primary;
  font-size: 28px;
  font-weight: $font-weight-bold;
  line-height: 1;
  letter-spacing: -.03em;
  font-variant-numeric: tabular-nums;
}

.wcard-count--unknown {
  color: $text-tertiary;
  font-size: $font-card-title;
}

.wcard-count-skeleton {
  display: block;
  width: 74px;
  height: 28px;
  border-radius: $radius-sm;
  background: linear-gradient(90deg, $surface-100 25%, $surface-50 37%, $surface-100 63%);
  background-size: 400% 100%;
  animation: wcard-shimmer 1.4s ease infinite;
}

.wcard-unit {
  color: $text-secondary;
  font-size: $font-caption;
}

.chip--skeleton {
  width: 84px;
  height: 22px;
  background: linear-gradient(90deg, $surface-100 25%, $surface-50 37%, $surface-100 63%);
  background-size: 400% 100%;
  animation: wcard-shimmer 1.4s ease infinite;
}

.chip--skeleton--short { width: 62px; }

@keyframes wcard-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

.wcard-break {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 22px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 9px;
  border-radius: $radius-pill;
  color: $text-secondary;
  background: $bg-page;
  font-size: 11px;

  b {
    color: var(--wc-tone);
    font-weight: $font-weight-bold;
    font-variant-numeric: tabular-nums;
  }
}

.empty-line {
  min-height: 22px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: $text-tertiary;
  font-size: 11px;
}

.wcard-act {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 7px;
  margin-top: auto;
  padding: 7px 14px 7px 0;
  border: 0;
  background: transparent;
  color: var(--wc-tone);
  font: inherit;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
  transition: color .15s, gap .15s;

  svg {
    width: 13px;
    height: 13px;
    transition: transform .18s;
  }

  &:disabled {
    color: $text-tertiary;
    cursor: default;
  }
}

.wcard-hint {
  display: inline-flex;
  align-items: center;
  align-self: center;
  gap: 4px;
  margin-left: auto;
  color: $text-tertiary;
  font-size: 11px;
  white-space: nowrap;

  svg { color: $danger-500; }
}

@media (prefers-reduced-motion: reduce) {
  .wcard-count-skeleton,
  .chip--skeleton { animation: none; }
}
</style>
