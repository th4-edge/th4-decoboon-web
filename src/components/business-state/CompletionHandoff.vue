<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  description?: string
  nextOwner?: string
  nextStep?: string
  actionText?: string
}>(), {
  title: '已完成，下一步已接棒',
  description: '',
  nextOwner: '',
  nextStep: '',
  actionText: ''
})

const emit = defineEmits<{
  action: []
}>()
</script>

<template>
  <section class="completion-handoff" aria-label="完成后的下一步">
    <div>
      <strong>{{ title }}</strong>
      <p v-if="description">{{ description }}</p>
      <ul v-if="nextOwner || nextStep">
        <li v-if="nextOwner"><small>接棒人</small>{{ nextOwner }}</li>
        <li v-if="nextStep"><small>下一步</small>{{ nextStep }}</li>
      </ul>
    </div>
    <button v-if="actionText" type="button" @click="emit('action')">{{ actionText }}</button>
  </section>
</template>

<style scoped lang="scss">
.completion-handoff { display: flex; align-items: center; justify-content: space-between; gap: $space-4; padding: $space-4; border: 1px solid $success-200; border-radius: $radius-md; background: $success-50; }
.completion-handoff strong { color: $status-done; }
.completion-handoff p { margin: 6px 0 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.6; }
.completion-handoff ul { display: flex; flex-wrap: wrap; gap: $space-4; padding: 0; margin: 8px 0 0; list-style: none; color: $text-secondary; font-size: $font-caption; }
.completion-handoff li { display: grid; gap: 2px; }
.completion-handoff small { color: $text-tertiary; }
.completion-handoff button { flex-shrink: 0; min-height: 34px; padding: 0 16px; border: 0; border-radius: $radius-sm; background: $success-500; color: $surface-0; cursor: pointer; }
</style>
