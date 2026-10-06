<script setup lang="ts">
withDefaults(defineProps<{
  documentLabel: string
  documentTitle?: string
}>(), {
  documentTitle: ''
})
</script>

<template>
  <div class="finance-document-layout">
    <div v-if="$slots.context" class="finance-document-layout__context">
      <slot name="context" />
    </div>

    <div class="finance-document-layout__body">
      <section class="finance-document-layout__paper">
        <header class="finance-document-layout__head">
          <div>
            <span>{{ documentLabel }}</span>
            <strong>{{ documentTitle || documentLabel }}</strong>
          </div>
          <slot name="head-extra" />
        </header>
        <slot />
      </section>

      <aside class="finance-document-layout__aside">
        <slot name="aside" />
      </aside>
    </div>
  </div>
</template>

<style scoped lang="scss">
.finance-document-layout {
  display: flex;
  flex-direction: column;
  gap: $space-4;
}

.finance-document-layout__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, .72fr);
  gap: $space-4;
  align-items: stretch;
}

.finance-document-layout__paper {
  min-width: 0;
  padding: $space-5;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: linear-gradient(150deg, $surface-0 0%, $brand-50 100%);
  box-shadow: $shadow-card;
}

.finance-document-layout__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;
  padding-bottom: $space-4;
  margin-bottom: $space-4;
  border-bottom: 1px solid $border-color;

  > div { min-width: 0; }
  span,
  strong { display: block; }
  span { color: $text-tertiary; font-size: $font-caption; letter-spacing: .08em; }
  strong { margin-top: $space-2; font-size: $font-display; line-height: 1.25; word-break: break-word; }
}

.finance-document-layout__aside {
  min-width: 0;
  padding: $space-4;
  border: 1px solid $brand-100;
  border-radius: $radius-lg;
  background: linear-gradient(160deg, $brand-50 0%, $surface-0 68%);
}

@media (max-width: 900px) {
  .finance-document-layout__body { grid-template-columns: 1fr; }
}
</style>
