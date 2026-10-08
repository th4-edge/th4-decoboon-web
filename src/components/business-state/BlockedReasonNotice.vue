<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  reasons?: string[]
  recovery?: string
}>(), {
  title: '当前不能继续推进',
  reasons: () => [],
  recovery: ''
})
</script>

<template>
  <section v-if="reasons.length || recovery" class="blocked-reason" role="status">
    <strong>{{ title }}</strong>
    <ul v-if="reasons.length">
      <li v-for="reason in reasons" :key="reason">{{ reason }}</li>
    </ul>
    <p v-if="recovery">{{ recovery }}</p>
  </section>
</template>

<style scoped lang="scss">
.blocked-reason { padding: $space-3 $space-4; border: 1px solid $danger-200; border-radius: $radius-md; background: $danger-50; color: $status-blocked; font-size: $font-body-sm; line-height: 1.6; }
.blocked-reason strong { display: block; }
.blocked-reason ul { padding-left: 18px; margin: 6px 0 0; }
.blocked-reason p { margin: 6px 0 0; }
</style>
