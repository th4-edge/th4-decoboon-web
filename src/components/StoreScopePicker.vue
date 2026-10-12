<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ALL_STORES, useStoreScopeStore, type StoreScopeOption } from '@/stores/storeScope'
import { useSessionStore } from '@/stores/session'

/**
 * 门店维度控件（`DEC-067` / `DESIGN-BIZ-20261012-002` §2）。
 *
 * - 取值来自共享门店上下文（`@/stores/storeScope`），**同一时刻只存在一个状态源**；
 * - 门店 ≤1 家不渲染；门店范围角色只读显示本店、无下钻；
 * - 重名门店附 `addr`，默认总店带「总店」标签；门店列表加载失败时回落「全部门店」+ 可重试；
 * - 「全部门店」在请求层一律转 `null`（绝不把状态值 `'0'` 当门店 ID 传出）。
 */
const props = defineProps<{
  /** 可选受控值；缺省直接使用共享门店上下文。 */
  modelValue?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string, payload: { mode: 'all' | 'store' }): void
}>()

const scope = useStoreScopeStore()
const session = useSessionStore()
/** 只有企业范围与门店范围角色才展示门店维度（团队/个人范围不展示）。 */
const visible = computed(() => session.dataScope === 'Company' || session.dataScope === 'Store')
/** 门店范围角色（店长、门店财务）：只读显示本店，无下钻。 */
const storeScoped = computed(() => session.dataScope === 'Store')
const value = computed(() => props.modelValue ?? scope.storeId)

const duplicatedNames = computed(() => {
  const counts = new Map<string, number>()
  for (const item of scope.stores) {
    counts.set(item.name, (counts.get(item.name) ?? 0) + 1)
  }
  return counts
})

function optionLabel(item: StoreScopeOption): string {
  const duplicated = (duplicatedNames.value.get(item.name) ?? 0) > 1
  const parts = [item.name]
  if (duplicated && item.addr) parts.push(`（${item.addr}）`)
  if (item.defaultStore) parts.push(' · 总店')
  return parts.join('')
}

function onChange(event: Event): void {
  const next = (event.target as HTMLSelectElement).value
  emit('update:modelValue', next)
  emit('change', next, { mode: next === ALL_STORES ? 'all' : 'store' })
  scope.setStore(next)
}

/**
 * 门店范围对齐**不在这里**：统一由 `stores/storeScope` 的 `activate()` 在 `router.isReady()` 之后
 * 注册（`router.afterEach` + 会话范围变化），组件只负责展示与用户交互。
 * 这里仅在控件挂载时兜底激活一次（`activate()` 幂等），避免出现「控件未挂载 → 无人对齐」。
 */
onMounted(() => {
  scope.activate()
})
</script>
<template>
  <span v-if="visible" class="store-scope-picker">
    <!-- 企业范围且门店 > 1：可选「全部门店 / 单店」 -->
    <template v-if="scope.showPicker">
      <span class="store-scope-picker__label">门店维度</span>
      <select
        class="store-scope-picker__select"
        :value="value"
        :disabled="disabled || scope.loading"
        aria-label="门店维度"
        @change="onChange"
      >
        <option :value="ALL_STORES">全部门店</option>
        <option v-for="item in scope.stores" :key="item.id" :value="item.id">{{ optionLabel(item) }}</option>
      </select>
    </template>
    <!-- 企业范围但门店列表加载失败：提示 + 可重试（按「全部门店」出数） -->
    <small v-else-if="scope.canSwitchStore && scope.loadFailed" class="store-scope-picker__hint">
      门店列表加载失败，当前为「全部门店」
      <button type="button" class="store-scope-picker__retry" @click="scope.reload()">重试</button>
    </small>
    <!-- 门店范围角色：只读显示本店；企业范围且门店 ≤1 家：完全不渲染 -->
    <small v-else-if="storeScoped" class="store-scope-picker__locked">门店维度 · {{ scope.ownStoreName }}（本店）</small>
    <small v-if="scope.notice" class="store-scope-picker__notice">{{ scope.notice }}</small>
  </span>
</template>

<style scoped>
.store-scope-picker { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.store-scope-picker__label { color: var(--text-3, #6b7280); font-size: 12px; }
.store-scope-picker__select { min-width: 140px; padding: 4px 6px; border: 1px solid var(--border-1, #dcdfe6); border-radius: 4px; background: #fff; }
.store-scope-picker__locked, .store-scope-picker__hint, .store-scope-picker__notice { color: var(--text-3, #6b7280); font-size: 12px; }
.store-scope-picker__retry { margin-left: 4px; border: 0; background: none; color: var(--brand-1, #2563eb); cursor: pointer; font-size: 12px; }
</style>
