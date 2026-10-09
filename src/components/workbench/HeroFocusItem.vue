<script setup lang="ts">
/**
 * Hero 的 L1 关注项（共享）。
 * 依据：`WEB-工作台设计构建规范` §4.2 / §4.7——五种主体 Hero 的 L1 关注层必须外观一致，只有内容按页面变。
 */
import { computed } from 'vue'
import { toneVar, type StatusTone } from '@/core/tone'

const props = withDefaults(defineProps<{
  label: string
  value: string
  note?: string
  tone?: StatusTone
}>(), {
  note: '',
  tone: undefined
})

const style = computed(() => props.tone
  ? { background: toneVar(props.tone, 'soft'), borderColor: toneVar(props.tone, 'border'), '--hero-focus-value': toneVar(props.tone) }
  : {})
</script>

<template>
  <article class="hfocus" :style="style">
    <small>{{ label }}</small>
    <b>{{ value }}</b>
    <span v-if="note">{{ note }}</span>
  </article>
</template>

<style scoped lang="scss">
.hfocus {
  min-width: 0;
  padding: 7px 10px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-0;
}

.hfocus small { display: block; color: $text-tertiary; font-size: $font-caption; }
.hfocus b { display: block; margin-top: 2px; overflow: hidden; color: var(--hero-focus-value, #{$text-primary}); font-size: $font-body-sm; font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }
.hfocus span { display: -webkit-box; overflow: hidden; margin-top: 2px; color: $text-secondary; font-size: $font-caption; line-height: 1.5; -webkit-box-orient: vertical; -webkit-line-clamp: 1; }
</style>
