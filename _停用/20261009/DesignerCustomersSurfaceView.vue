<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DesignerCustomersView from './DesignerCustomersView.vue'
import DesignerMeasureTasksView from './DesignerMeasureTasksView.vue'
import DesignerFollowUpTasksView from './DesignerFollowUpTasksView.vue'

type CustomerSurface = 'followup' | 'measure' | ''

const route = useRoute()
const surface = computed<CustomerSurface>(() => {
  const value = String(route.query.surface ?? '')
  return value === 'followup' || value === 'measure' ? value : ''
})
</script>

<template>
  <DesignerFollowUpTasksView v-if="surface === 'followup'" />
  <DesignerMeasureTasksView v-else-if="surface === 'measure'" />
  <DesignerCustomersView v-else />
</template>
