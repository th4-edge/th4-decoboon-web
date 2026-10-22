<script setup lang="ts">
import { computed } from 'vue'
import StatusTag from '@/components/StatusTag.vue'
import type { StatusTone } from '@/core/tone'
import type { BusinessNextAction } from '@/domains/business-state/model'

const props = withDefaults(defineProps<{
  action?: BusinessNextAction | null
  title?: string
  compact?: boolean
  busy?: boolean
  actionText?: string
  showAction?: boolean
  risk?: { label?: string; tone?: StatusTone; reason?: string } | null
}>(), {
  action: null,
  title: '下一步',
  compact: false,
  busy: false,
  actionText: '去处理',
  showAction: true,
  risk: null
})

const emit = defineEmits<{
  action: [action: BusinessNextAction]
}>()

const enabled = computed(() => Boolean(props.action) && props.action?.enabled !== false && !props.busy)
const blocked = computed(() => props.action?.blockedReasons ?? [])
const missing = computed(() => props.action?.missingFields ?? [])
const hasGuide = computed(() => Boolean(props.action || props.risk?.reason))

function trigger(): void {
  if (props.action && enabled.value) emit('action', props.action)
}
</script>

<template>
  <section v-if="hasGuide" class="next-action" :class="{ 'next-action--compact': compact }" aria-label="业务下一步">
    <div class="next-action__main">
      <span class="next-action__eyebrow">{{ title }}</span>
      <strong class="next-action__label">{{ action?.label || '待确认' }}</strong>
      <p v-if="action?.hint" class="next-action__hint">{{ action.hint }}</p>
      <p v-if="risk?.reason" class="next-action__risk">
        <StatusTag :text="risk.label || '需关注'" :tone="risk.tone || 'pending'" :dot="false" />
        <span>{{ risk.reason }}</span>
      </p>
    </div>

    <div v-if="!compact" class="next-action__meta">
      <span v-if="action?.ownerRole"><small>责任人</small>{{ action.ownerRole }}</span>
      <span v-if="action?.toStatusLabel"><small>完成后</small>{{ action.toStatusLabel }}</span>
      <span v-if="missing.length"><small>缺少条件</small>{{ missing.join('、') }}</span>
      <span v-if="blocked.length"><small>阻断原因</small>{{ blocked.join('；') }}</span>
    </div>

    <button
      v-if="!compact && action && showAction"
      class="next-action__button"
      type="button"
      :disabled="!enabled"
      @click="trigger"
    >
      {{ busy ? '处理中…' : actionText }}
    </button>
  </section>
</template>

<style scoped lang="scss">
.next-action {
  display: flex;
  flex-wrap: wrap;
  gap: $space-4;
  align-items: center;
  padding: $space-4;
  border: 1px solid $brand-100;
  border-radius: $radius-md;
  background: linear-gradient(135deg, $brand-50 0%, $surface-0 72%);
}

.next-action--compact {
  display: block;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.next-action__main { flex: 1 1 220px; min-width: 0; }
.next-action__eyebrow,
.next-action__label,
.next-action__hint,
.next-action__risk { display: block; min-width: 0; word-break: break-word; }

.next-action__eyebrow {
  color: $text-tertiary;
  font-size: $font-caption;
  font-weight: $font-weight-medium;
}

.next-action__label {
  margin-top: 4px;
  color: $text-primary;
  font-size: $font-title;
  line-height: 1.45;
}

.next-action__hint {
  margin: 6px 0 0;
  color: $text-secondary;
  font-size: $font-body-sm;
  line-height: 1.6;
}

.next-action__risk {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 0 0;
  color: $text-secondary;
  font-size: $font-caption;
  line-height: 1.55;
}

.next-action__meta {
  flex: 0 1 190px;
  min-width: 150px;
  display: grid;
  gap: 6px;
  color: $text-secondary;
  font-size: $font-caption;
}

.next-action__meta span { display: grid; gap: 2px; }
.next-action__meta small { color: $text-tertiary; font-size: $font-caption; }

.next-action__button {
  flex: 0 0 auto;
  min-height: 36px;
  padding: 0 18px;
  border: 0;
  border-radius: $radius-sm;
  background: $brand-500;
  color: $surface-0;
  font-weight: $font-weight-medium;
  cursor: pointer;
}

.next-action__button:disabled {
  cursor: not-allowed;
  opacity: .55;
}

@media (max-width: 860px) {
  .next-action__main,
  .next-action__meta { flex-basis: 100%; }
  .next-action__button { width: 100%; }
}
</style>
