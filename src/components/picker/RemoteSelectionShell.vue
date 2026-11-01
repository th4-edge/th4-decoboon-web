<!-- 低层远程选择壳：只负责加载、分页、错误、选择和清除；项目/分类/报价分项等业务语义由专用组件决定。 -->
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { PickerOption, PickerPage } from '@/domains/common/picker'

const props = withDefaults(defineProps<{
  modelValue: string
  title: string
  placeholder?: string
  search: (params: { keyword: string; current: number; size: number }) => Promise<PickerPage>
  resolve?: (id: string) => Promise<PickerOption | null>
  disabled?: boolean
  clearable?: boolean
  emptyText?: string
  searchPlaceholder?: string
  contextKey?: string | number
}>(), {
  placeholder: '请选择',
  disabled: false,
  clearable: true,
  emptyText: '没有匹配的业务对象',
  searchPlaceholder: '输入客户、项目或房屋名称搜索',
  contextKey: ''
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [option: PickerOption | null]
}>()

const visible = ref(false)
const keyword = ref('')
const options = ref<PickerOption[]>([])
const selected = ref<PickerOption | null>(null)
const loading = ref(false)
const error = ref('')
const current = ref(1)
const total = ref(0)
const hasMore = ref(false)
const pageSize = 20
let searchTimer: ReturnType<typeof setTimeout> | undefined
let requestSeq = 0

const selectedLabel = computed(() => selected.value?.label || (props.modelValue ? '已选对象需重新确认' : props.placeholder))
const selectedDescription = computed(() => selected.value?.description || '')

watch(() => props.modelValue, async (id) => {
  if (!id) {
    selected.value = null
    return
  }
  if (selected.value?.id === id) return
  if (!props.resolve) {
    selected.value = { id, label: id }
    return
  }
  try {
    selected.value = await props.resolve(id)
  } catch {
    selected.value = null
  }
}, { immediate: true })

watch(() => props.contextKey, () => {
  if (!visible.value) return
  void load(true)
})

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

function open(): void {
  if (props.disabled) return
  visible.value = true
  keyword.value = ''
  void load(true)
}

async function load(reset = true): Promise<void> {
  const seq = ++requestSeq
  if (reset) {
    current.value = 1
    options.value = []
    total.value = 0
    hasMore.value = false
  }
  loading.value = true
  error.value = ''
  try {
    const page = await props.search({
      keyword: keyword.value.trim(),
      current: current.value,
      size: pageSize
    })
    if (seq !== requestSeq) return
    options.value = reset ? page.list : mergeOptions(options.value, page.list)
    total.value = page.total
    hasMore.value = page.hasMore
  } catch (loadError) {
    if (seq !== requestSeq) return
    error.value = loadError instanceof Error ? loadError.message : '选择数据暂不可确认'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function mergeOptions(left: PickerOption[], right: PickerOption[]): PickerOption[] {
  const merged = new Map(left.map((item) => [item.id, item]))
  right.forEach((item) => merged.set(item.id, item))
  return [...merged.values()]
}

function onKeywordInput(): void {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void load(true) }, 300)
}

function loadMore(): void {
  if (!hasMore.value || loading.value) return
  current.value += 1
  void load(false)
}

function choose(option: PickerOption): void {
  if (option.disabled) return
  selected.value = option
  emit('update:modelValue', option.id)
  emit('change', option)
  visible.value = false
}

function clear(): void {
  selected.value = null
  emit('update:modelValue', '')
  emit('change', null)
}

function retry(): void {
  void load(true)
}
</script>

<template>
  <div class="remote-picker">
    <button
      type="button"
      class="remote-picker__field"
      :class="{ 'remote-picker__field--empty': !modelValue, 'remote-picker__field--disabled': disabled }"
      :disabled="disabled"
      @click="open"
    >
      <span class="remote-picker__copy">
        <strong>{{ selectedLabel }}</strong>
        <small v-if="selectedDescription">{{ selectedDescription }}</small>
      </span>
      <span class="remote-picker__actions">
        <span v-if="clearable && modelValue && !disabled" class="remote-picker__clear" @click.stop="clear">清除</span>
        <span class="remote-picker__arrow" aria-hidden="true">选择</span>
      </span>
    </button>

    <el-dialog v-model="visible" :title="title" width="720px" destroy-on-close>
      <div class="remote-picker__toolbar">
        <el-input
          v-model="keyword"
          clearable
          :placeholder="searchPlaceholder"
          @input="onKeywordInput"
          @keyup.enter="load(true)"
          @clear="load(true)"
        />
        <slot name="filters" />
        <span>{{ total ? `共 ${total} 条` : '按关键词检索' }}</span>
      </div>

      <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
        <template #default>
          <el-button size="small" plain @click="retry">重新加载</el-button>
        </template>
      </el-alert>

      <div v-else class="remote-picker__list" aria-live="polite">
        <el-skeleton v-if="loading && !options.length" :rows="5" animated />
        <div v-else-if="!options.length" class="remote-picker__empty">
          <strong>{{ emptyText }}</strong>
          <span>调整关键词或上游筛选条件后重试。</span>
        </div>
        <button
          v-for="option in options"
          :key="option.id"
          type="button"
          class="remote-picker__option"
          :class="{ 'remote-picker__option--active': option.id === modelValue }"
          :disabled="option.disabled"
          @click="choose(option)"
        >
          <span class="remote-picker__option-main">
            <strong>{{ option.label }}</strong>
            <small v-if="option.description">{{ option.description }}</small>
          </span>
          <span class="remote-picker__option-side">{{ option.id === modelValue ? '已选' : '选择' }}</span>
        </button>
        <div v-if="hasMore" class="remote-picker__more">
          <el-button :loading="loading" @click="loadMore">加载更多</el-button>
        </div>
      </div>

      <template #footer>
        <el-button @click="visible = false">关闭</el-button>
        <el-button v-if="clearable && modelValue" @click="clear(); visible = false">清除选择</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.remote-picker__field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
  width: 100%;
  min-height: 40px;
  padding: 0 $space-3;
  color: $text-primary;
  background: $surface-0;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  text-align: left;
  cursor: pointer;
  transition: border-color $transition-fast, box-shadow $transition-fast;
}

.remote-picker__field:hover:not(:disabled),
.remote-picker__field:focus-visible {
  border-color: $brand-400;
  box-shadow: $shadow-focus;
}

.remote-picker__field--empty strong {
  color: $text-placeholder;
  font-weight: $font-weight-regular;
}

.remote-picker__field--disabled {
  color: $text-tertiary;
  background: $surface-100;
  cursor: not-allowed;
}

.remote-picker__copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.remote-picker__copy strong,
.remote-picker__copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remote-picker__copy strong { font-size: $font-body-sm; }
.remote-picker__copy small { color: $text-tertiary; font-size: $font-caption; }

.remote-picker__actions {
  display: flex;
  align-items: center;
  gap: $space-2;
  flex-shrink: 0;
}

.remote-picker__clear {
  color: $brand-600;
  font-size: $font-caption;
}

.remote-picker__arrow {
  color: $text-secondary;
  font-size: $font-caption;
}

.remote-picker__toolbar {
  display: flex;
  align-items: center;
  gap: $space-3;
  margin-bottom: $space-3;

  .el-input { flex: 1; }
  > span {
    color: $text-tertiary;
    font-size: $font-caption;
    white-space: nowrap;
  }
}

.remote-picker__list {
  min-height: 280px;
  max-height: 520px;
  overflow: auto;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
}

.remote-picker__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  color: $text-secondary;
  text-align: center;

  strong { color: $text-primary; font-size: $font-body; }
  span { margin-top: $space-2; font-size: $font-caption; }
}

.remote-picker__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-4;
  width: 100%;
  padding: $space-3 $space-4;
  color: $text-primary;
  background: transparent;
  border: 0;
  border-bottom: 1px solid $border-color;
  text-align: left;
  cursor: pointer;

  &:hover { background: $bg-hover; }
}

.remote-picker__option--active {
  background: $brand-50;
  box-shadow: inset 3px 0 0 $brand-500;
}

.remote-picker__option-main {
  min-width: 0;

  strong,
  small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong { font-size: $font-body-sm; }
  small { margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }
}

.remote-picker__option-side {
  flex-shrink: 0;
  color: $brand-600;
  font-size: $font-caption;
}

.remote-picker__more {
  display: flex;
  justify-content: center;
  padding: $space-3;
}
</style>
