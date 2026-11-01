<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  summary?: string
}>(), {
  summary: ''
})
</script>

<template>
  <header class="page-header">
    <div class="page-header__copy">
      <h1>{{ title }}</h1>
      <p v-if="summary">{{ summary }}</p>
    </div>
    <div v-if="$slots.actions" class="page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped lang="scss">
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: $space-5;
  min-width: 0;
}

.page-header__copy {
  min-width: 0;

  h1 {
    margin: 0;
    color: $text-primary;
    font-size: $font-display;
    font-weight: $font-weight-semibold;
    letter-spacing: -.02em;
    line-height: 1.3;
  }

  p {
    max-width: 760px;
    margin: $space-2 0 0;
    color: $text-secondary;
    font-size: $font-body-sm;
    line-height: 1.65;
  }
}

.page-header__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: $space-3;
  flex: none;
  flex-wrap: wrap;
}

@media (max-width: 720px) {
  .page-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .page-header__actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
