<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  variant?: 'white' | 'color'
  size?: number
  alt?: string
}>(), {
  variant: 'color',
  size: 32,
  alt: '装得清'
})

const source = computed(() => props.variant === 'white'
  ? '/brand/logo-mark-white.png'
  : '/brand/logo-mark-color.png')
const style = computed(() => ({ width: `${props.size}px`, height: `${props.size}px` }))
</script>

<template>
  <img class="brand-logo" :src="source" :alt="alt" :style="style" />
</template>

<style scoped>
.brand-logo {
  display: block;
  flex: 0 0 auto;
  object-fit: contain;
}
</style>
