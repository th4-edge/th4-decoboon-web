<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import type { LedgerCategory, LedgerDirection } from '@/domains/finance/model'

const props = withDefaults(defineProps<{
  modelValue: string
  direction: LedgerDirection
  disabled?: boolean
  clearable?: boolean
}>(), {
  disabled: false,
  clearable: true
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [option: { category: LedgerCategory; path: string } | null]
}>()

const visible = ref(false)
const loading = ref(false)
const error = ref('')
const keyword = ref('')
const categories = ref<LedgerCategory[]>([])
const selectedPath = ref('')
const treeRef = ref<{ filter: (value: string) => void } | null>(null)

const fieldTitle = computed(() => selectedPath.value || (props.modelValue ? '已选分类需重新确认' : '选择账务分类'))

const treeProps = {
  label: 'name',
  children: 'children',
  disabled: (data: unknown) => !Boolean((data as LedgerCategory).active)
}

watch(() => props.modelValue, () => {
  syncSelectedPath()
}, { immediate: true })

watch(() => props.direction, () => {
  categories.value = []
  selectedPath.value = ''
  if (visible.value) void load()
})

watch(keyword, (value) => {
  void nextTick(() => treeRef.value?.filter(value.trim()))
})

function open(): void {
  if (props.disabled) return
  visible.value = true
  void load()
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const all = await financeApi.ledgerCategories()
    categories.value = filterDirection(all, props.direction)
    syncSelectedPath()
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '账务分类暂不可确认'
  } finally {
    loading.value = false
  }
}

function filterDirection(items: LedgerCategory[], direction: LedgerDirection): LedgerCategory[] {
  return items
    .filter((item) => item.direction === direction)
    .map((item) => ({
      ...item,
      children: filterDirection(item.children ?? [], direction)
    }))
}

function findCategory(items: LedgerCategory[], id: string, parent = ''): { category: LedgerCategory; path: string } | null {
  for (const item of items) {
    const path = parent ? `${parent} / ${item.name}` : item.name
    if (item.id === id) return { category: item, path }
    const child = findCategory(item.children ?? [], id, path)
    if (child) return child
  }
  return null
}

function syncSelectedPath(): void {
  if (!props.modelValue) {
    selectedPath.value = ''
    return
  }
  const found = findCategory(categories.value, props.modelValue)
  selectedPath.value = found?.path ?? ''
}

function chooseNode(data: LedgerCategory, node: { expanded: boolean }): void {
  if (!data.active) return
  if (data.children?.length) {
    node.expanded = !node.expanded
    return
  }
  selectCategory(data)
}

function selectCategory(category: LedgerCategory): void {
  const found = findCategory(categories.value, category.id)
  if (!found) return
  selectedPath.value = found.path
  emit('update:modelValue', category.id)
  emit('change', found)
  visible.value = false
}

function clear(): void {
  selectedPath.value = ''
  emit('update:modelValue', '')
  emit('change', null)
}

function filterNode(value: string, data: unknown): boolean {
  if (!value) return true
  const category = data as LedgerCategory
  return category.name.toLowerCase().includes(value.toLowerCase())
}
</script>

<template>
  <div class="ledger-category-picker">
    <button
      type="button"
      class="ledger-category-picker__field"
      :class="{ 'ledger-category-picker__field--empty': !modelValue, 'ledger-category-picker__field--disabled': disabled }"
      :disabled="disabled"
      @click="open"
    >
      <span class="ledger-category-picker__copy">
        <strong>{{ fieldTitle }}</strong>
        <small>{{ direction === 'income' ? '收入分类' : '支出分类' }}</small>
      </span>
      <span class="ledger-category-picker__actions">
        <span v-if="clearable && modelValue && !disabled" @click.stop="clear">清除</span>
        <span aria-hidden="true">选择</span>
      </span>
    </button>

    <el-dialog v-model="visible" title="选择账务分类" width="680px" destroy-on-close>
      <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
        <template #default><el-button size="small" plain @click="load">重新加载</el-button></template>
      </el-alert>
      <template v-else>
        <el-input v-model="keyword" clearable placeholder="搜索一级或二级分类" />
        <el-skeleton v-if="loading && !categories.length" :rows="6" animated class="ledger-category-picker__skeleton" />
        <el-empty v-else-if="!categories.length" description="当前方向暂无可用分类" />
        <el-tree
          v-else
          ref="treeRef"
          class="ledger-category-picker__tree"
          :data="categories"
          :props="treeProps"
          node-key="id"
          :default-expand-all="false"
          :expand-on-click-node="false"
          :filter-node-method="filterNode"
          @node-click="chooseNode"
        >
          <template #default="{ data }">
            <div class="ledger-category-picker__node" :class="{ 'ledger-category-picker__node--disabled': !data.active }">
              <span>
                <strong>{{ data.name }}</strong>
                <small v-if="data.code">{{ data.code }}</small>
              </span>
              <span>{{ data.children?.length ? `${data.children.length} 个下级` : data.active ? '可选择' : '已停用' }}</span>
            </div>
          </template>
        </el-tree>
      </template>
      <template #footer>
        <el-button @click="visible = false">关闭</el-button>
        <el-button v-if="clearable && modelValue" @click="clear(); visible = false">清除选择</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.ledger-category-picker__field {
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
}

.ledger-category-picker__field--empty strong { color: $text-placeholder; font-weight: $font-weight-regular; }
.ledger-category-picker__field--disabled { color: $text-tertiary; background: $surface-100; cursor: not-allowed; }
.ledger-category-picker__copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ledger-category-picker__copy strong,
.ledger-category-picker__copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ledger-category-picker__copy strong { font-size: $font-body-sm; }
.ledger-category-picker__copy small { color: $text-tertiary; font-size: $font-caption; }
.ledger-category-picker__actions { display: flex; gap: $space-2; flex-shrink: 0; color: $brand-600; font-size: $font-caption; }
.ledger-category-picker__skeleton { margin-top: $space-4; }
.ledger-category-picker__tree { max-height: 480px; margin-top: $space-3; overflow: auto; border: 1px solid $border-color; border-radius: $radius-sm; }
.ledger-category-picker__node { display: flex; align-items: center; justify-content: space-between; gap: $space-3; width: 100%; padding-right: $space-3; }
.ledger-category-picker__node strong { font-weight: $font-weight-medium; }
.ledger-category-picker__node small { margin-left: $space-2; color: $text-tertiary; }
.ledger-category-picker__node > span:last-child { color: $text-tertiary; font-size: $font-caption; }
.ledger-category-picker__node--disabled { color: $text-tertiary; }
</style>
