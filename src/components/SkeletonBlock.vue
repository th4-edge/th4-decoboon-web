<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'text' | 'table' | 'card'
  rows?: number
}>(), { variant: 'text', rows: 4 })
</script>

<template>
  <div class="skeleton" :class="`skeleton--${variant}`" aria-busy="true" aria-live="polite">
    <template v-if="variant === 'table'">
      <div v-for="row in rows" :key="row" class="skeleton__row">
        <span class="skeleton__cell skeleton__cell--wide" />
        <span class="skeleton__cell" />
        <span class="skeleton__cell" />
        <span class="skeleton__cell skeleton__cell--num" />
      </div>
    </template>
    <template v-else>
      <span v-for="row in rows" :key="row" class="skeleton__line" :style="{ width: `${100 - (row % 3) * 12}%` }" />
    </template>
    <span class="skeleton__sr">加载中</span>
  </div>
</template>

<style scoped lang="scss">
.skeleton {
  display: flex;
  flex-direction: column;
  gap: $space-3;
  padding: $space-4;
}

.skeleton__line,
.skeleton__cell {
  display: block;
  height: 12px;
  border-radius: $radius-xs;
  background: linear-gradient(90deg, $surface-100 25%, $surface-50 37%, $surface-100 63%);
  background-size: 400% 100%;
  animation: skeleton-shimmer 1.4s ease infinite;
}

.skeleton__row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: $space-3;
}

.skeleton__cell { height: 14px; }
.skeleton__cell--num { justify-self: end; width: 70%; }

.skeleton__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

@keyframes skeleton-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton__line,
  .skeleton__cell { animation: none; }
}
</style>
