<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ name: string }>()

const ICONS: Record<string, string[]> = {
  'today.mainline': ['M4 4h16v16H4z', 'M4 9h16M9 9v11'],
  'customer.followup': ['M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M2.5 21a6.5 6.5 0 0 1 13 0', 'M17 8h4M19 6v4'],
  'designer.measure': ['M12 21s7-5.6 7-12a7 7 0 1 0-14 0c0 6.4 7 12 7 12Z', 'M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'],
  'designer.design': ['M4 5h16v14H4z', 'M7 15.5l3.2-3.2 2.5 2.5L16 11.5l4 4', 'M8 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z'],
  'designer.quote': ['M4 7.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4v-3Z', 'M9 8.5h6M9 12h6M9 15.5h4'],
  'designer.contract': ['M6 3h8l4 4v14H6z', 'M14 3v5h5M9 14l2 2 4-4.5'],
  'designer.requirement': ['M5 5h14v10H9l-4 4V5Z', 'M9 9h6M9 12h4'],
  'designer.feedback': ['M12 21a9 9 0 1 0-9-9', 'M12 8v4M12 16h.01', 'M3 21l2-2'],
  'designer.catalog': ['M4 6h16M4 10h16M4 14h10M4 18h6'],
  'designer.performance': ['M4 20V10M10 20V4M16 20v-7M21 20H3'],
  'pm.project': ['M4 21h16M6 21V5h8v16M14 9h4v12M9 8h2M9 12h2M9 16h2'],
  'pm.materialSelection': ['M21 8l-9-5-9 5 9 5 9-5Z', 'M3 8v8l9 5 9-5V8', 'M12 13v8'],
  'pm.change': ['M4 20h4l10-10-4-4L4 16v4Z', 'M13.5 6.5l4 4'],
  'pm.acceptance': ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M8 12l3 3 5-6'],
  'finance.receivable': ['M12 3v18M7 8h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8'],
  'finance.payable': ['M12 21V3M7 16h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h8'],
  'finance.ledger': ['M5 4h14v16H5z', 'M8 8h8M8 12h8M8 16h5'],
  bell: ['M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z', 'M10 21h4'],
  'boss.risk': ['M12 9v4M12 17h.01', 'M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z'],
  'team.overview': ['M4 19V9M10 19V5M16 19v-8M21 19H3'],
  fallback: ['M5 5h14v14H5z']
}

const paths = computed(() => ICONS[props.name] ?? ICONS.fallback)
</script>

<template>
  <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path v-for="path in paths" :key="path" :d="path" />
  </svg>
</template>

<style scoped lang="scss">
.nav-icon {
  width: 17px;
  height: 17px;
  flex: 0 0 17px;
}
</style>
