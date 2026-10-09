<script setup lang="ts">
/**
 * 工作台快捷操作按钮（图标 + 标题 + 一句话说明）。
 * 依据：`WEB-工作台设计构建规范` §6 操作按钮主次 UI 规范（功能按钮必须"图标 + 文字"）。
 * 各工作台的「客户操作 / 其他合法动作」统一用它渲染，禁止各页再写一套按钮样式。
 */
withDefaults(defineProps<{
  title: string
  hint?: string
  /** 语义色：brand 沟通 / contact 微信 / record 记录 / outline 次级 / warn 提醒 / success 恢复 / requirement 诉求 / measure 量房 */
  tone?: 'brand' | 'contact' | 'record' | 'outline' | 'warn' | 'success' | 'requirement' | 'measure'
  /** 整行强调（业务推进点）；仍为次级动作，不得与右栏唯一主行动同权 */
  primary?: boolean
  disabled?: boolean
}>(), {
  hint: '',
  tone: 'brand',
  primary: false,
  disabled: false
})
</script>

<template>
  <button
    type="button"
    class="qa"
    :class="[`qa--${tone}`, { 'qa--primary': primary }]"
    :disabled="disabled"
  >
    <span class="qa__icon"><slot name="icon" /></span>
    <span class="qa__body">
      <strong>{{ title }}</strong>
      <small v-if="hint">{{ hint }}</small>
    </span>
  </button>
</template>

<style scoped lang="scss">
.qa {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  min-height: 50px;
  padding: 7px 8px;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  color: $text-secondary;
  text-align: left;
  font: inherit;
  cursor: pointer;

  &:hover { border-color: $brand-300; background: $brand-50; }
  &:disabled { cursor: not-allowed; opacity: .55; }
}

.qa__icon {
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  flex: 0 0 auto;
  border-radius: $radius-sm;
  background: $brand-50;
  color: $brand-600;

  :deep(svg) { width: 16px; height: 16px; }
}

.qa__body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 3px;
}

.qa strong,
.qa small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qa strong { color: $text-primary; font-size: $font-caption; font-weight: $font-weight-semibold; }
.qa small { color: $text-tertiary; font-size: $font-micro; line-height: 1.35; }

.qa--brand .qa__icon { color: $brand-600; background: $brand-50; }
.qa--contact .qa__icon { color: $success-500; background: $success-50; }
.qa--record .qa__icon { color: $warning-700; background: $warning-50; }
.qa--measure .qa__icon { color: $brand-700; background: $brand-100; }
.qa--outline .qa__icon { color: $text-secondary; background: $surface-100; }
.qa--requirement .qa__icon { color: $status-special; background: $status-special-soft; }

.qa--warn { border-color: $warning-200; background: $warning-50; }
.qa--warn .qa__icon { color: $warning-700; background: $warning-200; }
.qa--success { border-color: $success-500; background: $success-50; }
.qa--success .qa__icon { color: $success-500; background: $success-50; }

.qa--primary {
  grid-column: 1 / -1;
  border-color: $brand-500;
  background: linear-gradient(135deg, $brand-50, $surface-0 70%);
  box-shadow: inset 0 0 0 1px $brand-200;

  .qa__icon { color: $surface-0; background: $brand-600; }
  strong { color: $brand-700; font-size: $font-body-sm; }
  &:hover { border-color: $brand-600; background: linear-gradient(135deg, $brand-100, $surface-0 70%); }
}
</style>
