<script setup lang="ts">
import type { BusinessStateNode } from '@/domains/business-state/model'

withDefaults(defineProps<{
  nodes: BusinessStateNode[]
  title?: string
  hint?: string
}>(), {
  title: '对象进度',
  hint: ''
})
</script>

<template>
  <section class="state-journey" aria-label="对象状态轨道">
    <header class="state-journey__head">
      <h2>{{ title }}</h2>
      <span v-if="hint">{{ hint }}</span>
    </header>
    <ol class="state-journey__nodes">
      <li
        v-for="node in nodes"
        :key="node.key"
        class="state-journey__node"
        :class="`state-journey__node--${node.state || 'todo'}`"
      >
        <span class="state-journey__dot" aria-hidden="true" />
        <strong>{{ node.label }}</strong>
        <small v-if="node.hint">{{ node.hint }}</small>
      </li>
    </ol>
  </section>
</template>

<style scoped lang="scss">
.state-journey { padding: $space-4; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; }
.state-journey__head { display: flex; align-items: baseline; justify-content: space-between; gap: $space-3; }
.state-journey__head h2 { margin: 0; font-size: $font-title; }
.state-journey__head span { color: $text-tertiary; font-size: $font-caption; }
.state-journey__nodes { display: grid; grid-template-columns: repeat(auto-fit, minmax(112px, 1fr)); gap: $space-2; padding: 0; margin: $space-4 0 0; list-style: none; }
.state-journey__node { position: relative; display: grid; gap: 4px; min-width: 0; padding-top: 16px; color: $text-secondary; font-size: $font-caption; }
.state-journey__node::before { position: absolute; top: 5px; left: 0; width: 100%; height: 1px; background: $border-color; content: ''; }
.state-journey__dot { position: absolute; top: 0; left: 0; z-index: 1; width: 11px; height: 11px; border: 2px solid $surface-0; border-radius: 50%; background: $line-200; }
.state-journey__node strong { color: $text-secondary; font-size: $font-body-sm; }
.state-journey__node small { min-height: 16px; color: $text-tertiary; line-height: 1.45; }
.state-journey__node--done .state-journey__dot { background: $success-500; }
.state-journey__node--done strong { color: $status-done; }
.state-journey__node--current .state-journey__dot { background: $brand-500; box-shadow: 0 0 0 4px $brand-100; }
.state-journey__node--current strong { color: $brand-700; }
.state-journey__node--blocked .state-journey__dot { background: $danger-500; }
.state-journey__node--blocked strong { color: $status-blocked; }
@media (max-width: 640px) { .state-journey__nodes { grid-template-columns: 1fr; } .state-journey__node::before { width: 1px; height: calc(100% - 8px); top: 8px; } .state-journey__node { padding: 0 0 14px 20px; } .state-journey__dot { top: 2px; } }
</style>
