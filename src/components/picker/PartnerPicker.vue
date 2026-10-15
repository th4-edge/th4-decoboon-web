<script setup lang="ts">
import { partnerPickerSource } from '@/domains/finance/picker'
import RemoteSelectionShell from './RemoteSelectionShell.vue'

/**
 * 供应商/经销商选择器（业务概念 supplier，BR-019）。
 *
 * 登记表要求：合作状态、结算方式与账期在选项中展示；已选摘要卡与清除由壳统一提供。
 */
const props = withDefaults(defineProps<{ modelValue: string; clearable?: boolean; disabled?: boolean }>(), {
  clearable: true,
  disabled: false
})
const emit = defineEmits<{ 'update:modelValue': [value: string]; change: [option: { raw?: unknown } | null] }>()
</script>

<template>
  <RemoteSelectionShell
    :model-value="props.modelValue"
    :title="partnerPickerSource.title"
    :placeholder="partnerPickerSource.placeholder"
    :search="partnerPickerSource.search"
    :clearable="props.clearable"
    :disabled="props.disabled"
    empty-text="没有匹配的合作方"
    @update:model-value="emit('update:modelValue', $event)"
    @change="emit('change', $event)"
  />
</template>
