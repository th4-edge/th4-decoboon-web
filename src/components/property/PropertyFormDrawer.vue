<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { propertyApi } from '@/domains/property/api'
import type { Property } from '@/domains/property/model'

/**
 * 房屋档案新增 / 维护（单据化表单）。
 *
 * 依据：App `subpackages/customer/pages/property-edit.vue`（同一 Provider：
 * `property/property/save` / `property/property/update`）。
 * 房屋是设计、报价、合同、项目的对象锚点，客户跟进阶段必须能建立与维护，
 * 否则「量房前必须先建立房屋档案」会变成无出口的死路。
 */
const props = defineProps<{
  customerId: string
  customerName?: string
  /** 传入即为维护模式，调用 update；为空为新增模式，调用 save。 */
  property?: Property | null
}>()

const visible = defineModel<boolean>({ required: true })
const emit = defineEmits<{ saved: [property: Property] }>()

const formRef = ref<FormInstance>()
const submitting = ref(false)
const isEdit = computed(() => !!props.property?.id)

const form = reactive({
  community: '',
  building: '',
  roomNo: '',
  address: '',
  area: undefined as number | undefined,
  layout: '',
  remark: ''
})

const rules: FormRules = {
  address: [{ required: true, message: '房屋地址必填：量房、报价、合同都以房屋地址为准', trigger: 'blur' }]
}

function reset(): void {
  const p = props.property
  form.community = p?.community ?? ''
  form.building = p?.building ?? ''
  form.roomNo = p?.roomNo ?? ''
  form.address = p?.address ?? ''
  form.area = p?.area || undefined
  form.layout = p?.layout ?? ''
  form.remark = p?.remark ?? ''
  formRef.value?.clearValidate()
}

watch(visible, (open) => { if (open) reset() })
watch(() => props.property?.id, () => { if (visible.value) reset() })

async function submit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  if (!props.customerId) {
    ElMessage.warning('缺少客户上下文，无法保存房屋档案')
    return
  }
  submitting.value = true
  try {
    const saved = isEdit.value && props.property?.id
      ? await propertyApi.updateProperty({
          propertyId: props.property.id,
          community: form.community || undefined,
          building: form.building || undefined,
          roomNo: form.roomNo || undefined,
          address: form.address.trim(),
          area: form.area,
          layout: form.layout || undefined,
          remark: form.remark || undefined
        })
      : await propertyApi.saveProperty({
          customerId: props.customerId,
          community: form.community || undefined,
          building: form.building || undefined,
          roomNo: form.roomNo || undefined,
          address: form.address.trim(),
          area: form.area,
          layout: form.layout || undefined,
          remark: form.remark || undefined
        })
    ElMessage.success(isEdit.value ? '房屋档案已更新' : '房屋档案已建立')
    emit('saved', saved)
    visible.value = false
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : '房屋档案保存失败，请稍后重试'
    ElMessage.error(message)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-drawer v-model="visible" :title="isEdit ? '维护房屋档案' : '新增房屋'" size="520px" destroy-on-close>
    <p class="property-form__hint">
      {{ customerName || '当前客户' }} · 房屋贯穿量房、设计、报价、合同和项目，地址为必填。
    </p>
    <el-alert
      v-if="isEdit"
      class="property-form__impact"
      type="warning"
      :closable="false"
      show-icon
      title="修改房屋地址、面积或户型会影响量房、设计与报价"
    >
      <template #default>
        <p class="property-form__impact-text">
          量房、设计、报价、合同与项目都绑定这套房屋：改地址会改变上门与交付口径，改面积/户型会影响设计与报价的取值基础。
          已进入采购或已签订的历史单据不会被改写，请确认无误后再保存。
        </p>
      </template>
    </el-alert>
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
      <el-form-item label="小区 / 楼盘" prop="community">
        <el-input v-model="form.community" maxlength="64" placeholder="例如：荷塘家园" />
      </el-form-item>
      <el-form-item label="楼栋 / 单元" prop="building">
        <el-input v-model="form.building" maxlength="32" placeholder="例如：3栋2单元" />
      </el-form-item>
      <el-form-item label="房号" prop="roomNo">
        <el-input v-model="form.roomNo" maxlength="32" placeholder="例如：1202" />
      </el-form-item>
      <el-form-item label="详细地址" prop="address">
        <el-input v-model="form.address" maxlength="128" placeholder="例如：合肥市蜀山区荷塘家园3栋1202室" />
      </el-form-item>
      <el-form-item label="建筑面积（㎡）" prop="area">
        <el-input-number v-model="form.area" :min="0" :precision="2" :controls="false" style="width: 100%" placeholder="按合同/量房口径填写" />
      </el-form-item>
      <el-form-item label="户型" prop="layout">
        <el-input v-model="form.layout" maxlength="32" placeholder="例如：三室两厅" />
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="房屋特殊情况、入户方式等（选填）" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">{{ isEdit ? '保存修改' : '建立房屋档案' }}</el-button>
    </template>
  </el-drawer>
</template>

<style scoped lang="scss">
.property-form__hint {
  margin: 0 0 $space-4;
  padding: $space-3;
  border-radius: $radius-md;
  background: $brand-50;
  font-size: $font-body-sm;
  color: $text-secondary;
}

.property-form__impact { margin-bottom: $space-4; }
.property-form__impact-text { margin: 4px 0 0; font-size: $font-caption; line-height: 1.7; }
</style>
