<script setup lang="ts">
import StatusTag from '@/components/StatusTag.vue'
import type { BusinessStateHistoryItem } from '@/domains/business-state/model'

withDefaults(defineProps<{
  items: BusinessStateHistoryItem[]
  title?: string
  emptyText?: string
}>(), {
  title: '状态记录',
  emptyText: '暂无状态记录'
})
</script>

<template>
  <section class="state-history">
    <h2>{{ title }}</h2>
    <ol v-if="items.length" class="state-history__list">
      <li v-for="(item, index) in items" :key="item.id || `${item.statusLabel}-${index}`">
        <span class="state-history__dot" aria-hidden="true" />
        <div class="state-history__body">
          <div class="state-history__head">
            <StatusTag :text="item.statusLabel" :tone="item.tone || 'info'" />
            <small v-if="item.time">{{ item.time }}</small>
          </div>
          <p v-if="item.reason">{{ item.reason }}</p>
          <small v-if="item.operator">操作人：{{ item.operator }}</small>
        </div>
      </li>
    </ol>
    <p v-else class="state-history__empty">{{ emptyText }}</p>
  </section>
</template>

<style scoped lang="scss">
.state-history { padding: $space-4; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; }
.state-history h2 { margin: 0 0 $space-3; font-size: $font-title; }
.state-history__list { display: grid; gap: $space-3; padding: 0; margin: 0; list-style: none; }
.state-history__list li { position: relative; display: grid; grid-template-columns: 12px minmax(0, 1fr); gap: $space-3; }
.state-history__dot { width: 8px; height: 8px; margin-top: 5px; border-radius: 50%; background: $brand-400; }
.state-history__body { min-width: 0; padding-bottom: $space-3; border-bottom: 1px solid $border-color; }
.state-history__list li:last-child .state-history__body { padding-bottom: 0; border-bottom: 0; }
.state-history__head { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.state-history__head small,
.state-history__body > small { color: $text-tertiary; font-size: $font-caption; }
.state-history__body p { margin: 6px 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.6; }
.state-history__empty { margin: 0; color: $text-tertiary; font-size: $font-body-sm; }
</style>
