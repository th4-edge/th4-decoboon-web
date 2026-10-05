<script setup lang="ts">
import { computed } from 'vue'
import { toneVar, type StatusTone } from '@/core/tone'

const props = withDefaults(defineProps<{
  tone: StatusTone
  text: string
  mode?: 'soft' | 'solid'
  size?: 'sm' | 'md'
  dot?: boolean
}>(), { mode: 'soft', size: 'sm', dot: true })

const cssVars = computed(() => props.mode === 'solid'
  ? {
      '--tag-bg': toneVar(props.tone),
      '--tag-border': toneVar(props.tone),
      '--tag-text': 'var(--th4-surface-0)'
    }
  : {
      '--tag-bg': toneVar(props.tone, 'soft'),
      '--tag-border': toneVar(props.tone, 'border'),
      '--tag-text': toneVar(props.tone)
    })
</script>

<template>
  <span class="tag" :class="[`tag--${size}`, `tag--${mode}`]" :style="cssVars">
    <i v-if="dot" class="tag__dot" aria-hidden="true" />
    <span>{{ text }}</span>
  </span>
</template>

<style scoped lang="scss">
.tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--tag-border);
  border-radius: $radius-pill;
  background: var(--tag-bg);
  color: var(--tag-text);
  font-weight: $font-weight-medium;
  white-space: nowrap;
  line-height: 1;
}

.tag__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.tag--sm { padding: 3px 8px; font-size: $font-caption; }
.tag--md { padding: 5px 10px; font-size: $font-body-sm; }
</style>
