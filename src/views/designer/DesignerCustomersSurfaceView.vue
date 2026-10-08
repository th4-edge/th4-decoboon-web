<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DesignerCustomersView from './DesignerCustomersView.vue'
import DesignerMeasureTasksView from './DesignerMeasureTasksView.vue'
import DesignerRequirementQueueView from './DesignerRequirementQueueView.vue'

type CustomerSurface = 'measure' | 'requirement' | ''

const route = useRoute()
const surface = computed<CustomerSurface>(() => {
  const value = String(route.query.surface ?? '')
  return value === 'measure' || value === 'requirement' ? value : ''
})
</script>

<template>
  <DesignerMeasureTasksView v-if="surface === 'measure'" />
  <DesignerRequirementQueueView v-else-if="surface === 'requirement'" />
  <DesignerCustomersView v-else />
</template>
