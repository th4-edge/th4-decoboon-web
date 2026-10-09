<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import CustomerPropertyContext from '@/components/CustomerPropertyContext.vue'
import { designApi } from '@/domains/design/api'
import type { RequirementCategory, RequirementKind, RequirementPriority } from '@/domains/design/model'
import {
  REQUIREMENT_CATEGORY_OPTIONS,
  REQUIREMENT_KIND_OPTIONS,
  REQUIREMENT_PRIORITY_OPTIONS
} from '@/domains/design/requirementOptions'

const props = withDefaults(defineProps<{
  modelValue: boolean
  customerId: string
  customerName?: string
  propertyId?: string
  propertyName?: string
  /** 已存在诉求时传入，用于「追记」场景展示；本期只新增，不回填编辑。 */
  spaceOptions?: string[]
}>(), {
  customerName: '',
  propertyId: '',
  propertyName: '',
  spaceOptions: () => []
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const saving = ref(false)
const error = ref('')
const form = reactive<{
  kind: RequirementKind
  category: RequirementCategory
  priority: RequirementPriority
  spaceName: string
  title: string
  detail: string
  response: string
}>({
  kind: 'demand',
  category: 'function',
  priority: 'medium',
  spaceName: '',
  title: '',
  detail: '',
  response: ''
})

watch(() => props.modelValue, (open) => {
  if (!open) return
  form.kind = 'demand'
  form.category = 'function'
  form.priority = 'medium'
  form.spaceName = ''
  form.title = ''
  form.detail = ''
  form.response = ''
  error.value = ''
})

function close(): void {
  emit('update:modelValue', false)
}

async function save(): Promise<void> {
  if (!props.customerId || !form.title.trim()) return
  saving.value = true
  error.value = ''
  try {
    await designApi.saveRequirement({
      customerId: props.customerId,
      propertyId: props.propertyId || undefined,
      kind: form.kind,
      category: form.category,
      priority: form.priority,
      title: form.title.trim(),
      detail: form.detail || undefined,
      response: form.response || undefined,
      spaceName: form.spaceName || undefined
    })
    emit('saved')
    emit('update:modelValue', false)
    ElMessage.success('客户诉求已记录')
  } catch (saveError) {
    error.value = saveError instanceof Error ? saveError.message : '诉求保存失败，请保留输入后重试'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-drawer :model-value="modelValue" title="记录客户诉求" size="560px" direction="rtl" append-to-body @update:model-value="emit('update:modelValue', $event)">
    <CustomerPropertyContext :customer="{ name: customerName }" :property="propertyName ? { community: propertyName } : null" />
    <p class="req__section-label">诉求内容</p>
    <p class="req__hint">诉求是客户事实，先原样记录；不确定的内容留空，后续可在设计阶段确认。</p>
    <el-form label-position="top">
      <el-form-item label="诉求类型">
        <el-select v-model="form.kind" style="width: 100%">
          <el-option v-for="item in REQUIREMENT_KIND_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="分类">
        <el-select v-model="form.category" style="width: 100%">
          <el-option v-for="item in REQUIREMENT_CATEGORY_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="优先级">
        <el-select v-model="form.priority" style="width: 100%">
          <el-option v-for="item in REQUIREMENT_PRIORITY_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="空间（选填）">
        <el-input v-model="form.spaceName" maxlength="40" placeholder="如客厅 / 主卧，可留空" />
      </el-form-item>
      <el-form-item label="标题" required>
        <el-input v-model="form.title" maxlength="80" placeholder="一句话说清客户要什么或不要什么" />
      </el-form-item>
      <el-form-item label="详细说明">
        <el-input v-model="form.detail" type="textarea" :rows="3" maxlength="500" show-word-limit />
      </el-form-item>
      <el-form-item label="设计回应">
        <el-input v-model="form.response" type="textarea" :rows="2" maxlength="300" placeholder="设计师对这条诉求的回应，可稍后补充" />
      </el-form-item>
    </el-form>
    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="!form.title.trim()" @click="save">保存诉求</el-button>
    </template>
  </el-drawer>
</template>

<style scoped lang="scss">
.req__section-label { margin: 16px 0 0; color: $brand-600; font-size: $font-caption; font-weight: $font-weight-semibold; letter-spacing: .09em; }
.req__hint { margin: 6px 0 14px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
</style>
