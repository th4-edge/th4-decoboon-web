<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import type { LedgerCategory, LedgerDirection } from '@/domains/finance/model'
import { useSessionStore } from '@/stores/session'

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

const session = useSessionStore()
const canManage = computed(() => ['Boss', 'Finance'].includes(session.role ?? ''))
const visible = ref(false)
const loading = ref(false)
const error = ref('')
const keyword = ref('')
const categories = ref<LedgerCategory[]>([])
const selectedName = ref('')
const selectedDescription = ref('')
const editorVisible = ref(false)
const editorSaving = ref(false)
const editingCategory = ref<LedgerCategory | null>(null)
const categoryForm = reactive({ name: '', description: '', active: true })

const filteredCategories = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return categories.value
    .filter((item) => item.direction === props.direction && item.active)
    .filter((item) => !kw || item.name.toLowerCase().includes(kw) || (item.description ?? '').toLowerCase().includes(kw))
})
const fieldTitle = computed(() => selectedName.value || (props.modelValue ? '已选分类需重新确认' : '选择业务分类'))
const editorTitle = computed(() => editingCategory.value ? '编辑业务分类' : '新增业务分类')

watch(() => props.modelValue, () => syncSelected(), { immediate: true })
watch(() => props.direction, () => { categories.value = []; selectedName.value = ''; selectedDescription.value = ''; if (visible.value) void load() })

function open(): void {
  if (props.disabled) return
  visible.value = true
  void load()
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    categories.value = await financeApi.ledgerCategories()
    syncSelected()
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '业务分类暂不可确认'
  } finally {
    loading.value = false
  }
}

function syncSelected(): void {
  const found = categories.value.find((item) => item.id === props.modelValue)
  selectedName.value = found?.name ?? ''
  selectedDescription.value = found?.description ?? ''
}

function selectCategory(category: LedgerCategory): void {
  selectedName.value = category.name
  selectedDescription.value = category.description ?? ''
  emit('update:modelValue', category.id)
  emit('change', { category, path: category.name })
  visible.value = false
}

function clear(): void {
  selectedName.value = ''
  selectedDescription.value = ''
  emit('update:modelValue', '')
  emit('change', null)
}

function openCreate(): void {
  if (!canManage.value) return
  editingCategory.value = null
  categoryForm.name = ''
  categoryForm.description = ''
  categoryForm.active = true
  editorVisible.value = true
}

function openEdit(category: LedgerCategory): void {
  if (!canManage.value) return
  editingCategory.value = category
  categoryForm.name = category.name
  categoryForm.description = category.description ?? ''
  categoryForm.active = category.active
  editorVisible.value = true
}

async function saveCategory(): Promise<void> {
  if (!categoryForm.name.trim()) { ElMessage.warning('请填写分类名称'); return }
  if (!categoryForm.description.trim()) { ElMessage.warning('请填写分类说明'); return }
  if (editorSaving.value) return
  editorSaving.value = true
  try {
    if (editingCategory.value) {
      await financeApi.updateLedgerCategory({
        id: editingCategory.value.id,
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim(),
        active: categoryForm.active
      })
      ElMessage.success('业务分类已更新')
    } else {
      const created = await financeApi.saveLedgerCategory({
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim(),
        direction: props.direction
      })
      await load()
      selectCategory(created)
      ElMessage.success('业务分类已新增')
    }
    editorVisible.value = false
    await load()
  } catch (saveError) {
    ElMessage.error(saveError instanceof ProviderError ? saveError.message : '业务分类保存失败')
  } finally {
    editorSaving.value = false
  }
}

async function disableCategory(): Promise<void> {
  const category = editingCategory.value
  if (!category) return
  editorSaving.value = true
  try {
    await financeApi.deleteLedgerCategory(category.id)
    ElMessage.success('业务分类已停用，历史流水保持不变')
    editorVisible.value = false
    await load()
  } catch (disableError) {
    ElMessage.error(disableError instanceof ProviderError ? disableError.message : '业务分类停用失败')
  } finally {
    editorSaving.value = false
  }
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
        <small>{{ selectedDescription || (direction === 'income' ? '其他收入类' : '其他支出类') }}</small>
      </span>
      <span class="ledger-category-picker__actions">
        <span v-if="clearable && modelValue && !disabled" @click.stop="clear">清除</span>
        <span aria-hidden="true">选择</span>
      </span>
    </button>

    <el-dialog v-model="visible" title="选择业务分类" width="680px" destroy-on-close>
      <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
        <template #default><el-button size="small" plain @click="load">重新加载</el-button></template>
      </el-alert>
      <template v-else>
        <el-input v-model="keyword" clearable placeholder="搜索分类名称或说明" />
        <el-skeleton v-if="loading && !categories.length" :rows="6" animated class="ledger-category-picker__skeleton" />
        <el-empty v-else-if="!filteredCategories.length" description="当前方向暂无其他账务分类" />
        <div v-else class="ledger-category-picker__list">
          <button v-for="category in filteredCategories" :key="category.id" type="button" class="ledger-category-picker__row"
            :class="{ 'ledger-category-picker__row--selected': modelValue === category.id }" @click="selectCategory(category)">
            <span class="ledger-category-picker__identity">
              <strong>{{ category.name }}</strong>
              <small>{{ category.builtIn ? '标准' : '自定义' }}</small>
              <em>{{ category.description || '未填写分类说明' }}</em>
            </span>
            <span class="ledger-category-picker__node-actions">
              <el-button v-if="canManage" link type="primary" @click.stop="openEdit(category)">编辑</el-button>
              <span aria-hidden="true">选择</span>
            </span>
          </button>
        </div>
      </template>
      <template #footer>
        <el-button v-if="canManage" @click="openCreate">新增分类</el-button>
        <el-button v-if="clearable && modelValue" @click="clear(); visible = false">清除选择</el-button>
        <el-button @click="visible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editorVisible" :title="editorTitle" width="560px" destroy-on-close>
      <el-alert type="info" :closable="false" show-icon title="手工记账分类只有一级，仅用于应收应付闭环之外的其他账务。" />
      <el-form label-position="top" style="margin-top: 16px">
        <el-form-item label="分类名称">
          <el-input v-model="categoryForm.name" maxlength="64" show-word-limit placeholder="例如：银行手续费、临时保洁、股东借款" />
        </el-form-item>
        <el-form-item label="分类说明">
          <el-input v-model="categoryForm.description" type="textarea" :rows="4" maxlength="500" show-word-limit
            placeholder="说明适用场景、举例和禁止用途" />
        </el-form-item>
        <el-form-item v-if="editingCategory" label="启用状态">
          <el-switch v-model="categoryForm.active" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button v-if="editingCategory" type="danger" plain :loading="editorSaving" @click="disableCategory">停用分类</el-button>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" :loading="editorSaving" @click="saveCategory">保存</el-button>
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
.ledger-category-picker__list { max-height: 480px; margin-top: $space-3; overflow: auto; border: 1px solid $border-color; border-radius: $radius-sm; }
.ledger-category-picker__row { display: flex; align-items: center; justify-content: space-between; gap: $space-3; width: 100%; padding: $space-3; border: 0; border-bottom: 1px solid $border-color; background: $surface-0; text-align: left; cursor: pointer; }
.ledger-category-picker__row:last-child { border-bottom: 0; }
.ledger-category-picker__row--selected { background: $brand-50; }
.ledger-category-picker__identity { display: flex; flex-wrap: wrap; align-items: baseline; min-width: 0; }
.ledger-category-picker__identity strong { font-weight: $font-weight-medium; }
.ledger-category-picker__identity small { margin-left: $space-2; color: $text-tertiary; font-size: $font-caption; }
.ledger-category-picker__identity em { flex-basis: 100%; margin-top: 2px; color: $text-tertiary; font-size: $font-caption; font-style: normal; line-height: 1.4; }
.ledger-category-picker__node-actions { display: flex; align-items: center; gap: $space-2; flex-shrink: 0; color: $text-tertiary; font-size: $font-caption; }
</style>
