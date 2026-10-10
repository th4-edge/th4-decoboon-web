<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import CustomerPropertyContext from '@/components/CustomerPropertyContext.vue'
import FileUploadField from '@/components/form/FileUploadField.vue'
import { crmApi } from '@/domains/crm/api'
import type { Customer, FollowWay } from '@/domains/crm/model'
import type { UploadedFile } from '@/domains/file/model'
import type { Property } from '@/domains/property/model'

const props = withDefaults(defineProps<{
  modelValue: boolean
  customer: Customer | null
  property?: Property | null
  title?: string
}>(), {
  property: null,
  title: '写客户跟进'
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [value: unknown]
}>()

const FOLLOW_WAYS: Array<{ value: FollowWay; label: string }> = [
  { value: 'phone', label: '电话' },
  { value: 'wechat', label: '微信' },
  { value: 'visit', label: '到店/拜访' },
  { value: 'video', label: '视频' },
  { value: 'other', label: '其他' }
]

const form = reactive<{
  way: FollowWay
  content: string
  nextFollowAt: string
  images: UploadedFile[]
}>({
  way: 'phone',
  content: '',
  nextFollowAt: '',
  images: []
})
const requestId = ref('')
const saving = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})
const canSubmit = computed(() => Boolean(props.customer && form.content.trim() && !saving.value))

watch(() => props.modelValue, (open) => {
  if (open) reset()
})
watch(() => props.customer?.id, () => {
  if (props.modelValue) reset()
})

function reset(): void {
  form.way = 'phone'
  form.content = ''
  form.nextFollowAt = ''
  form.images = []
  requestId.value = `web-follow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

async function submit(): Promise<void> {
  const customer = props.customer
  if (!customer || !form.content.trim() || saving.value) return
  saving.value = true
  try {
    const saved = await crmApi.saveFollow({
      customerId: customer.id,
      way: form.way,
      content: form.content.trim(),
      nextFollowAt: form.nextFollowAt || undefined,
      images: form.images.map((item) => item.path),
      requestId: requestId.value
    })
    emit('saved', saved)
    ElMessage.success('跟进已记录')
    visible.value = false
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '跟进保存失败，请保留输入后重试')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-drawer v-model="visible" :title="title" size="520px" direction="rtl" append-to-body>
    <CustomerPropertyContext :customer="customer" :property="property" />
    <el-form label-position="top">
      <el-form-item label="跟进方式">
        <el-select v-model="form.way" style="width: 100%">
          <el-option v-for="item in FOLLOW_WAYS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="跟进内容" required>
        <el-input
          v-model="form.content"
          type="textarea"
          :rows="4"
          maxlength="500"
          show-word-limit
          placeholder="例如：电话确认周末到店时间，客户关注旧房拆除预算"
        />
      </el-form-item>
      <el-form-item label="现场图片（选填，最多 9 张）">
        <FileUploadField
          v-model="form.images"
          business-type="CustomerFollow"
          accept="image/*"
          :max="9"
          multiple
          hint="支持 JPG、PNG、WEBP，单张不超过 10MB；图片作为本次跟进的内部证据，不会进入报价、合同或金额计算。"
        />
      </el-form-item>
      <el-form-item label="下次跟进时间">
        <el-date-picker
          v-model="form.nextFollowAt"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          placeholder="未安排可留空"
          style="width: 100%"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="!canSubmit" @click="submit">保存跟进</el-button>
    </template>
  </el-drawer>
</template>
