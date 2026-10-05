<script setup lang="ts">
withDefaults(defineProps<{
  /** 缺哪些成本，用于提示；不传则用通用说明。 */
  hint?: string
}>(), { hint: '' })
</script>

<template>
  <el-tooltip
    :content="hint || '存在应计成本缺失，补齐标准成本后才可确认毛利与毛利率'"
    placement="top"
  >
    <span class="cost-incomplete">
      <span class="cost-incomplete__dot" aria-hidden="true" />
      成本未完整
    </span>
  </el-tooltip>
</template>

<style scoped lang="scss">
.cost-incomplete {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: $font-body-sm;
  color: $warning-700;
  cursor: help;
}

.cost-incomplete__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: $warning-500;
}
</style>
