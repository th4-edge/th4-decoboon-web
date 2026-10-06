<script setup lang="ts">
import { computed, ref, useAttrs, watch } from 'vue'
import { evaluateQuantityFormula, formatQuantity } from '@/composables/quantityFormula'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue?: number
  disabled?: boolean
  placeholder?: string
  precision?: number
}>(), {
  modelValue: 0,
  disabled: false,
  placeholder: '数量或 =12.4*3',
  precision: 3
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
  change: [value: number]
}>()

const attrs = useAttrs()
const focused = ref(false)
const text = ref(formatQuantity(props.modelValue, props.precision))
const error = ref('')

const preview = computed(() => {
  if (!focused.value || !text.value.trim()) return ''
  const result = evaluateQuantityFormula(text.value)
  return result.valid ? formatQuantity(result.value, props.precision) : ''
})

watch(() => props.modelValue, (value) => {
  if (!focused.value && !error.value) text.value = formatQuantity(value, props.precision)
})

function handleInput(value: string) {
  text.value = value
  const result = evaluateQuantityFormula(value)
  error.value = result.valid ? '' : result.error || '计算公式不正确'
  const next = result.valid ? result.value : 0
  emit('update:modelValue', next)
  emit('change', next)
}

function handleFocus() {
  focused.value = true
}

function commit() {
  focused.value = false
  const result = evaluateQuantityFormula(text.value)
  if (!result.valid) {
    error.value = result.error || '计算公式不正确'
    emit('update:modelValue', 0)
    emit('change', 0)
    return
  }
  error.value = ''
  text.value = formatQuantity(result.value, props.precision)
  emit('update:modelValue', result.value)
  emit('change', result.value)
}
</script>

<template>
  <div class="quantity-formula-input" :class="{ 'has-error': error }">
    <el-input
      v-model="text"
      v-bind="attrs"
      :disabled="disabled"
      :placeholder="placeholder"
      @focus="handleFocus"
      @input="handleInput"
      @blur="commit"
    />
    <small v-if="preview" class="quantity-formula-input__preview">= {{ preview }}</small>
    <small v-else-if="error" class="quantity-formula-input__error">{{ error }}</small>
  </div>
</template>

<style scoped lang="scss">
.quantity-formula-input { width: 100%; min-width: 0; }
.quantity-formula-input__preview,
.quantity-formula-input__error { display: block; margin-top: 2px; overflow: hidden; font-size: $font-caption; line-height: 1.4; text-overflow: ellipsis; white-space: nowrap; }
.quantity-formula-input__preview { color: $brand-600; }
.quantity-formula-input__error { color: $danger-500; }
</style>
