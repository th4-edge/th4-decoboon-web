<script setup lang="ts">
import { computed } from 'vue'
import StatusTag from '@/components/StatusTag.vue'
import type { StatusTone } from '@/core/tone'
import { resolveBusinessStatus, unregisteredStatusLabel } from '@/domains/business-state/registry'

const props = withDefaults(defineProps<{
  objectKey?: string
  statusKey?: string
  serverValue?: string
  text?: string
  tone?: StatusTone
  mode?: 'soft' | 'solid'
  size?: 'sm' | 'md'
  dot?: boolean
}>(), {
  objectKey: '',
  statusKey: '',
  serverValue: '',
  text: '',
  tone: 'info',
  mode: 'soft',
  size: 'sm',
  dot: true
})

const resolved = computed(() => {
  const fromRegistry = resolveBusinessStatus(props.objectKey, props.statusKey || props.serverValue)
  if (fromRegistry) return { text: fromRegistry.label, tone: fromRegistry.tone }
  return {
    text: props.text || (props.objectKey ? unregisteredStatusLabel() : '—'),
    tone: props.tone
  }
})
</script>

<template>
  <StatusTag :text="resolved.text" :tone="resolved.tone" :mode="mode" :size="size" :dot="dot" />
</template>
