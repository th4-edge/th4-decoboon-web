<script setup lang="ts">
import { workerPickerSource } from '@/domains/finance/picker'
import RemoteSelectionShell from './RemoteSelectionShell.vue'

withDefaults(defineProps<{ modelValue: string; clearable?: boolean }>(), { clearable: true })
const emit = defineEmits<{ 'update:modelValue': [value: string]; change: [option: { raw?: unknown } | null] }>()
</script>

<template>
  <RemoteSelectionShell
    :model-value="modelValue"
    :title="workerPickerSource.title"
    :placeholder="workerPickerSource.placeholder"
    :search="workerPickerSource.search"
    :clearable="clearable"
    @update:model-value="emit('update:modelValue', $event)"
    @change="emit('change', $event)"
  />
</template>
