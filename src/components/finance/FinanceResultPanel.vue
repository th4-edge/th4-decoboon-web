<script setup lang="ts">
interface ResultItem {
  label: string
  value: string
  emphasis?: boolean
}

withDefaults(defineProps<{
  title?: string
  note?: string
  items: ResultItem[]
}>(), {
  title: '提交结果预览',
  note: ''
})
</script>

<template>
  <section class="finance-result-panel">
    <header>
      <strong>{{ title }}</strong>
      <span>提交前确认</span>
    </header>
    <div class="finance-result-panel__grid">
      <div v-for="item in items" :key="item.label" :class="{ 'finance-result-panel__item--emphasis': item.emphasis }">
        <small>{{ item.label }}</small>
        <strong>{{ item.value }}</strong>
      </div>
    </div>
    <p v-if="note">{{ note }}</p>
  </section>
</template>

<style scoped lang="scss">
.finance-result-panel {
  margin-top: $space-5;
  padding: $space-4;
  border: 1px solid $brand-100;
  border-radius: $radius-md;
  background: linear-gradient(135deg, $brand-50 0%, $surface-0 76%);
}

.finance-result-panel header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: $space-3;
  margin-bottom: $space-3;
}

.finance-result-panel header strong { font-size: $font-card-title; }
.finance-result-panel header span { color: $brand-600; font-size: $font-caption; }

.finance-result-panel__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-3;
}

.finance-result-panel__grid > div {
  padding: $space-3;
  border-radius: $radius-sm;
  background: rgba(255, 255, 255, .72);
}

.finance-result-panel__grid small,
.finance-result-panel__grid strong { display: block; }
.finance-result-panel__grid small { color: $text-tertiary; font-size: $font-caption; }
.finance-result-panel__grid strong { margin-top: 3px; color: $text-primary; font-size: $font-body-sm; word-break: break-word; }
.finance-result-panel__item--emphasis strong { color: $brand-700; font-size: $font-title; }

.finance-result-panel p {
  margin: $space-3 0 0;
  color: $text-secondary;
  font-size: $font-caption;
  line-height: 1.6;
}
</style>
