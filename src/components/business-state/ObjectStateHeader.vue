<script setup lang="ts">
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import type { StatusTone } from '@/core/tone'

withDefaults(defineProps<{
  title: string
  subtitle?: string
  objectKey?: string
  statusKey?: string
  statusText?: string
  statusTone?: StatusTone
  ownerText?: string
  updatedAt?: string
  facts?: Array<{ label: string; value: string }>
}>(), {
  subtitle: '',
  objectKey: '',
  statusKey: '',
  statusText: '',
  statusTone: 'info',
  ownerText: '',
  updatedAt: '',
  facts: () => []
})
</script>

<template>
  <header class="object-state-header">
    <div class="object-state-header__main">
      <div class="object-state-header__title">
        <h1>{{ title }}</h1>
        <BusinessStateTag
          :object-key="objectKey"
          :status-key="statusKey"
          :text="statusText"
          :tone="statusTone"
          size="md"
        />
      </div>
      <p v-if="subtitle" class="object-state-header__subtitle">{{ subtitle }}</p>
      <ul v-if="ownerText || updatedAt" class="object-state-header__meta">
        <li v-if="ownerText"><small>责任人</small><span>{{ ownerText }}</span></li>
        <li v-if="updatedAt"><small>最近更新</small><span>{{ updatedAt }}</span></li>
      </ul>
    </div>
    <dl v-if="facts.length" class="object-state-header__facts">
      <div v-for="fact in facts" :key="fact.label">
        <dt>{{ fact.label }}</dt>
        <dd>{{ fact.value }}</dd>
      </div>
    </dl>
    <div v-if="$slots.default" class="object-state-header__slot">
      <slot />
    </div>
  </header>
</template>

<style scoped lang="scss">
.object-state-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: $space-4;
  align-items: start;
  padding: $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
}

.object-state-header__title { display: flex; align-items: center; flex-wrap: wrap; gap: $space-3; }
.object-state-header__title h1 { margin: 0; font-size: $font-h1; line-height: 1.35; }
.object-state-header__subtitle { margin: 8px 0 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.6; }
.object-state-header__meta { display: flex; flex-wrap: wrap; gap: $space-4; padding: 0; margin: 10px 0 0; list-style: none; }
.object-state-header__meta li { display: grid; gap: 2px; color: $text-secondary; font-size: $font-caption; }
.object-state-header__meta small { color: $text-tertiary; }
.object-state-header__facts { display: grid; grid-template-columns: repeat(2, minmax(90px, 1fr)); gap: $space-3; padding: 0; margin: 0; }
.object-state-header__facts div { padding: 8px 10px; border-radius: $radius-sm; background: $surface-100; }
.object-state-header__facts dt { color: $text-tertiary; font-size: $font-caption; }
.object-state-header__facts dd { margin: 4px 0 0; color: $text-primary; font-size: $font-body-sm; font-weight: $font-weight-medium; }
.object-state-header__slot { grid-column: 1 / -1; }

@media (max-width: 760px) {
  .object-state-header { grid-template-columns: 1fr; }
  .object-state-header__facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
