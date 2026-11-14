<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  description?: string
  /** flush = 内容区不加内边距（表格/长列表用）。 */
  flush?: boolean
}>(), { title: '', description: '', flush: false })
</script>

<template>
  <section class="panel">
    <header v-if="title || $slots.extra" class="panel__head">
      <div class="panel__titles">
        <h2 v-if="title" class="panel__title">{{ title }}</h2>
      </div>
      <div v-if="$slots.extra" class="panel__extra">
        <slot name="extra" />
      </div>
    </header>
    <div class="panel__body" :class="{ 'panel__body--flush': flush }">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="panel__foot">
      <slot name="footer" />
    </footer>
  </section>
</template>

<style scoped lang="scss">
.panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: $surface-0;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  box-shadow: $shadow-card;
  overflow: hidden;
}

.panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-3;
  padding: $space-3 $space-4;
  border-bottom: 1px solid $border-color;
}

.panel__titles { min-width: 0; }

.panel__title {
  margin: 0;
  font-size: $font-body-sm;
  font-weight: $font-weight-semibold;
}


.panel__body {
  flex: 1;
  min-height: 0;
  min-width: 0;
  padding: $space-4;
  overflow: auto;
}

.panel__body--flush { padding: 0; }

.panel__foot {
  padding: $space-3 $space-4;
  border-top: 1px solid $border-color;
  font-size: $font-caption;
  color: $text-secondary;
}
</style>
