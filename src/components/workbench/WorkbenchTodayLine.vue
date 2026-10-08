<script setup lang="ts">
import WorkbenchState from './WorkbenchState.vue'
import type { WorkQueueItem } from '@/domains/workbench/model'

withDefaults(defineProps<{
  items: WorkQueueItem[]
  loading?: boolean
  error?: string
}>(), { loading: false, error: '' })

const emit = defineEmits<{ open: [route: string]; retry: [] }>()

function open(route: string): void {
  if (route) emit('open', route)
}

function riskClass(riskLevel: string): string {
  if (riskLevel === 'high') return 'queue__risk--high'
  if (riskLevel === 'warning') return 'queue__risk--warning'
  return 'queue__risk--normal'
}
</script>

<template>
  <section class="queue" :aria-busy="loading">
    <div v-if="loading" class="queue__skeleton" aria-hidden="true">
      <div v-for="n in 4" :key="n" class="queue__skeleton-row">
        <span class="queue__skeleton-dot" />
        <span class="queue__skeleton-lines">
          <span class="queue__skeleton-line queue__skeleton-line--name" />
          <span class="queue__skeleton-line queue__skeleton-line--sub" />
        </span>
        <span class="queue__skeleton-tag" />
      </div>
    </div>

    <WorkbenchState
      v-else-if="error"
      variant="error"
      title="今日主线暂不可确认"
      :description="error"
      action-text="重新加载"
      min-height="240px"
      @action="emit('retry')"
    />

    <WorkbenchState
      v-else-if="!items.length"
      title="今日主线已清空"
      description="当前没有需要你优先推进的对象，新的待办出现后会自动排到这里。"
      min-height="240px"
    />

    <template v-else>
      <div
        v-for="item in items"
        :key="item.queueKey"
        class="queue-item"
        role="button"
        tabindex="0"
        @click="open(item.route)"
        @keydown.enter.prevent="open(item.route)"
        @keydown.space.prevent="open(item.route)"
      >
        <span class="q-dot" :class="riskClass(item.riskLevel)" aria-hidden="true" />
        <div class="q-main">
          <div class="q-name" :title="item.title">{{ item.title }}</div>
          <div class="q-sub" :title="item.subtitle">{{ item.subtitle }}</div>
        </div>
        <span class="q-tag" :class="riskClass(item.riskLevel)">{{ item.stateLabel }}</span>
        <button class="q-act" type="button" @click.stop="open(item.route)">
          {{ item.nextActionLabel }}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped lang="scss">
.queue {
  min-height: 286px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.queue__skeleton {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.queue__skeleton-row {
  display: flex;
  align-items: center;
  gap: $space-3;
  padding: 12px 16px;
  border-radius: $radius-md;
  background: $bg-page;
}

.queue__skeleton-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: $radius-pill;
  background: $surface-100;
}

.queue__skeleton-lines {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.queue__skeleton-line,
.queue__skeleton-tag {
  display: block;
  border-radius: $radius-xs;
  background: linear-gradient(90deg, $surface-100 25%, $surface-50 37%, $surface-100 63%);
  background-size: 400% 100%;
  animation: queue-shimmer 1.4s ease infinite;
}

.queue__skeleton-line--name { width: 62%; height: 13px; }
.queue__skeleton-line--sub { width: 84%; height: 11px; }
.queue__skeleton-tag { width: 62px; height: 20px; border-radius: $radius-pill; }

@keyframes queue-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

.queue-item {
  display: flex;
  align-items: center;
  gap: $space-3;
  padding: 12px 16px;
  border: 1px solid transparent;
  border-radius: $radius-md;
  background: $bg-page;
  cursor: pointer;
  transition: background .18s, border-color .18s;

  &:hover {
    border-color: $border-color;
    background: $surface-100;

    .q-act { color: $brand-700; }
    .q-act svg { transform: translateX(2px); }
  }

  &:focus-visible {
    outline: 2px solid $brand-500;
    outline-offset: 2px;
  }
}

.q-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: $radius-pill;
  box-shadow: 0 0 0 3px rgba(0, 0, 0, .03);
}

.queue__risk--normal { background: $status-info; }
.queue__risk--warning { background: $status-pending; }
.queue__risk--high { background: $status-blocked; }

.q-main {
  min-width: 0;
  flex: 1;
}

.q-name {
  overflow: hidden;
  color: $text-primary;
  font-size: $font-body-sm;
  font-weight: $font-weight-semibold;
  letter-spacing: -.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.q-sub {
  overflow: hidden;
  margin-top: 1px;
  color: $text-secondary;
  font-size: $font-caption;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.q-tag {
  flex-shrink: 0;
  padding: 3px 10px;
  border-radius: $radius-pill;
  font-size: 11px;
  font-weight: $font-weight-semibold;
  white-space: nowrap;
}

.q-tag.queue__risk--normal {
  color: $status-info;
  background: $status-info-soft;
}

.q-tag.queue__risk--warning {
  color: $warning-700;
  background: $warning-50;
}

.q-tag.queue__risk--high {
  color: $danger-500;
  background: $danger-50;
}

.q-act {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  padding: 6px 4px;
  border: 0;
  background: transparent;
  color: $brand-600;
  font: inherit;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
  white-space: nowrap;
  transition: color .15s;

  svg {
    width: 12px;
    height: 12px;
    transition: transform .15s;
  }
}

@media (prefers-reduced-motion: reduce) {
  .queue__skeleton-line,
  .queue__skeleton-tag { animation: none; }
}
</style>
