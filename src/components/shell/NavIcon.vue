<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ name: string }>()

const ICONS: Record<string, string[]> = {
  'today.mainline': ['M4 4h16v16H4z', 'M4 9h16M9 9v11'],
  'customer.followup': ['M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M2.5 21a6.5 6.5 0 0 1 13 0', 'M17 8h4M19 6v4'],
  'designer.followup': ['M4 5h16v14H4z', 'M8 9h8M8 12h5', 'M15.5 16.5l2 2 3-4'],
  'designer.measure': ['M12 21s7-5.6 7-12a7 7 0 1 0-14 0c0 6.4 7 12 7 12Z', 'M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'],
  'designer.design': ['M4 5h16v14H4z', 'M7 15.5l3.2-3.2 2.5 2.5L16 11.5l4 4', 'M8 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z'],
  'designer.quote': ['M4 7.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4v-3Z', 'M9 8.5h6M9 12h6M9 15.5h4'],
  'designer.contract': ['M6 3h8l4 4v14H6z', 'M14 3v5h5M9 14l2 2 4-4.5'],
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
  refresh: ['M21 12a9 9 0 1 1-2.6-6.3', 'M21 3v6h-6'],
  add: ['M12 5v14M5 12h14'],
  layers: ['M12 3 3 8l9 5 9-5-9-5Z', 'M3 13l9 5 9-5'],
  edit: ['M4 20h4l10-10-4-4L4 16v4Z', 'M13.5 6.5l4 4'],
  trash: ['M4 7h16', 'M9 7V5h6v2', 'M6 7l1 13h10l1-13', 'M10 11v6M14 11v6'],
  help: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M9.5 9.2a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .9-1 1.6v.4', 'M12 17h.01'],
  fullscreen: ['M4 9V4h5', 'M20 15v5h-5', 'M20 9V4h-5', 'M4 15v5h5'],
  collapse: ['M9 4v5H4', 'M15 20v-5h5', 'M15 4v5h5', 'M9 20v-5H4'],
  ruler: ['M3 9.5 9.5 3 21 14.5 14.5 21 3 9.5Z', 'M7 10.5l1.5 1.5M10.5 7l1.5 1.5M14 10.5l1.5 1.5'],
  formula: ['M4 4h16', 'M8 4 16 20', 'M16 4 8 20'],
  publish: ['M12 3v12', 'M7.5 7.5 12 3l4.5 4.5', 'M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3'],
  send: ['M4 12l16-8-6 16-2.5-6.5L4 12Z'],
  back: ['M11 5l-7 7 7 7', 'M4 12h16'],
  save: ['M5 4h11l3 3v13H5z', 'M8 4v6h7V4', 'M8 20v-6h8v6'],
  copy: ['M9 9h10v10H9z', 'M5 15V5h10'],
  'chevron-down': ['M6 9l6 6 6-6'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z', 'M21 21l-4.3-4.3'],
  bell: ['M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z', 'M10 21h4'],
  'boss.risk': ['M12 9v4M12 17h.01', 'M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z'],
  'business.blueprint': ['M4 5h6v5H4z', 'M14 14h6v5h-6z', 'M7 10v4h10', 'M17 10h-3V5h3z'],
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
