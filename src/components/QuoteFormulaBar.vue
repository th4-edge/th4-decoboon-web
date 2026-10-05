<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import MoneyText from '@/components/MoneyText.vue'
import { checkQuantityFormula } from '@/domains/trade/formula'

/**
 * 公式栏：与选中单元格联动。
 *
 * - 输入中做白名单语法预检，非法公式给出可理解错误并**不提交**；
 * - Enter 提交并跳到下一行；Esc 放弃本次输入；
 * - 右侧展示"服务端权威结果快照"（保存后由服务端返回，非前端计算）。
 */
const props = withDefaults(defineProps<{
  regionName?: string
  rowNo?: number
  /** 当前公式原文（draft 优先） */
  value: string
  /** 服务端权威结果快照：工程量 */
  savedQuantity?: number | null
  /** 服务端权威结果快照：行金额 */
  savedAmount?: number | null
  /** 前端即时估算（仅核对） */
  previewQuantity?: number | null
  disabled?: boolean
  empty?: boolean
}>(), {
  regionName: '', rowNo: 0, savedQuantity: null, savedAmount: null,
  previewQuantity: null, disabled: false, empty: false
})

const emit = defineEmits<{
  commit: [formula: string]
  next: [formula: string]
  clear: []
}>()

const raw = ref(props.value)
watch(() => props.value, (next) => { raw.value = next })

const check = computed(() => checkQuantityFormula(raw.value))
const dirty = computed(() => raw.value !== props.value)

function commit(moveNext: boolean): void {
  if (!check.value.ok) return
  if (moveNext) emit('next', raw.value.trim())
  else emit('commit', raw.value.trim())
}

function onEnter(): void { commit(true) }
function onBlur(): void { if (check.value.ok) commit(false) }
function onEscape(): void { raw.value = props.value }
</script>

<template>
  <div class="fbar" :class="{ 'fbar--error': !check.ok && raw.trim() !== '' }">
    <span class="fbar__anchor">
      {{ regionName || '综合项目' }} · 第 {{ rowNo || '—' }} 行
    </span>

    <el-input
      v-model="raw"
      class="fbar__input"
      :disabled="disabled"
      :placeholder="empty ? '先选中一个报价行' : '输入工程量公式，例如 =F1*2 或 =3.8*2.6'"
      :aria-invalid="!check.ok"
      @keydown.enter.prevent="onEnter"
      @keydown.esc.prevent="onEscape"
      @blur="onBlur"
    >
      <template v-if="dirty" #append>
        <span class="fbar__dirty">未提交</span>
      </template>
    </el-input>

    <div class="fbar__result">
      <template v-if="empty">
        <span class="fbar__hint">—</span>
      </template>
      <template v-else-if="!check.ok">
        <span class="fbar__error">{{ check.error }}</span>
      </template>
      <template v-else-if="check.empty">
        <span class="fbar__hint">无公式 · 手填工程量</span>
      </template>
      <!-- 未提交：不显示前端计算结果（Q5：以服务端为准）；已提交：展示服务端权威快照 -->
      <template v-else-if="dirty">
        <span class="fbar__hint">公式已改 · 待服务端计算</span>
        <span class="fbar__label">当前快照</span>
        <span class="fbar__value fbar__value--saved">{{ savedQuantity ?? '—' }}</span>
      </template>
      <template v-else>
        <span class="fbar__label">服务端工程量</span>
        <span class="fbar__value fbar__value--saved">{{ savedQuantity ?? '—' }}</span>
        <span class="fbar__label">表达式</span>
        <span class="fbar__value">{{ raw.trim() }}</span>
      </template>
    </div>

    <div class="fbar__snapshot">
      <span class="fbar__label">行金额</span>
      <MoneyText :value="savedAmount" size="sm" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.fbar {
  display: grid;
  grid-template-columns: 168px minmax(0, 1fr) minmax(220px, auto) auto;
  gap: $space-3;
  align-items: center;
  padding: $space-2 $space-3;
  background: $surface-50;
  border-bottom: 1px solid $border-color;
  font-size: $font-caption;
}

.fbar--error { background: $danger-50; }

.fbar__anchor {
  color: $text-secondary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fbar__input :deep(.el-input__wrapper) { background: $surface-0; }

.fbar__dirty {
  font-size: $font-caption;
  color: $warning-700;
}

.fbar__result {
  display: inline-flex;
  align-items: center;
  gap: $space-2;
  min-width: 0;
}

.fbar__label { color: $text-tertiary; }
.fbar__value {
  font-variant-numeric: tabular-nums;
  font-weight: $font-weight-medium;

  &--saved { color: $brand-700; }
}

.fbar__hint { color: $text-tertiary; }

.fbar__error {
  color: $danger-500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fbar__snapshot {
  display: inline-flex;
  align-items: center;
  gap: $space-2;
  white-space: nowrap;
}

@media (max-width: 1280px) {
  .fbar { grid-template-columns: 140px minmax(0, 1fr) auto; }
  .fbar__snapshot { display: none; }
}
</style>
