<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { supplyApi } from '@/domains/supply/api'
import type { SettlementMode, SupplierPartner, SupplierPartnerStatus, SupplierPartnerType } from '@/domains/supply/model'

const props = withDefaults(defineProps<{
  modelValue: boolean
  mode: 'create' | 'edit'
  partner?: SupplierPartner | null
}>(), { partner: null })
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [value: SupplierPartner]
}>()

const saving = ref(false)
const error = ref('')
const brandsText = ref('')
const form = reactive({
  name: '',
  type: 'supplier' as SupplierPartnerType,
  contactName: '',
  telNo: '',
  taxNo: '',
  addr: '',
  settlementTerms: '',
  settlementMode: 'ReceiptDays' as SettlementMode,
  settlementDays: 30 as number | undefined,
  cutoffDay: 25 as number | undefined,
  bankName: '',
  bankAccount: '',
  remark: '',
  status: 'active' as SupplierPartnerStatus
})

const typeOptions: Array<{ value: SupplierPartnerType; label: string }> = [
  { value: 'supplier', label: '材料供应商' },
  { value: 'factory', label: '厂家' },
  { value: 'laborTeam', label: '劳务班组' },
  { value: 'installer', label: '安装服务' },
  { value: 'logistics', label: '物流' },
  { value: 'service', label: '其他服务' }
]
const statusOptions: Array<{ value: SupplierPartnerStatus; label: string }> = [
  { value: 'active', label: '合作中' },
  { value: 'disabled', label: '已停用' }
]
const title = computed(() => props.mode === 'create' ? '新增供应商' : '编辑供应商资料')
const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

watch(() => props.modelValue, (open) => {
  if (open) reset()
})

function reset(): void {
  const partner = props.partner
  Object.assign(form, {
    name: partner?.name || '',
    type: partner?.type || 'supplier',
    contactName: partner?.contactName || '',
    telNo: partner?.telNo || '',
    taxNo: partner?.taxNo || '',
    addr: partner?.addr || '',
    settlementTerms: partner?.settlementTerms || '',
    settlementMode: partner?.settlementMode || 'ReceiptDays',
    settlementDays: partner?.settlementDays ?? 30,
    cutoffDay: partner?.cutoffDay ?? 25,
    bankName: partner?.bankName || '',
    bankAccount: partner?.bankAccount || '',
    remark: partner?.remark || '',
    status: partner?.status || 'active'
  })
  brandsText.value = partner?.brands.join('、') || ''
  error.value = ''
}

async function save(): Promise<void> {
  error.value = ''
  if (!form.name.trim()) {
    error.value = '请填写供应商名称'
    return
  }
  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      type: form.type,
      contactName: form.contactName,
      telNo: form.telNo,
      taxNo: form.taxNo,
      addr: form.addr,
      settlementTerms: form.settlementTerms,
      settlementMode: form.settlementMode,
      settlementDays: form.settlementDays,
      cutoffDay: form.cutoffDay,
      bankName: form.bankName,
      bankAccount: form.bankAccount,
      remark: form.remark,
      status: form.status,
      brands: brandsText.value.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean)
    }
    const saved = props.mode === 'edit' && props.partner
      ? await supplyApi.partnerUpdate({ ...props.partner, ...payload, id: props.partner.id })
      : await supplyApi.partnerSave(payload)
    emit('saved', saved)
    ElMessage.success(props.mode === 'edit' ? '供应商资料已更新' : '供应商已新增')
    visible.value = false
  } catch (saveError) {
    error.value = saveError instanceof Error ? saveError.message : '供应商保存失败，请保留输入后重试'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-drawer v-model="visible" :title="title" size="620px" destroy-on-close>
    <el-alert v-if="error" type="error" :closable="false" show-icon :title="error" />
    <el-form label-position="top" class="supplier-form">
      <el-form-item label="供应商名称" required>
        <el-input v-model="form.name" maxlength="128" placeholder="如：合肥瓷砖供应商" />
      </el-form-item>
      <div class="supplier-form__grid">
        <el-form-item label="合作类型">
          <el-select v-model="form.type"><el-option v-for="item in typeOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select>
        </el-form-item>
        <el-form-item v-if="mode === 'edit'" label="合作状态">
          <el-select v-model="form.status"><el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select>
        </el-form-item>
        <el-form-item label="联系人"><el-input v-model="form.contactName" maxlength="32" /></el-form-item>
        <el-form-item label="联系电话"><el-input v-model="form.telNo" maxlength="20" /></el-form-item>
        <el-form-item label="关联品牌"><el-input v-model="brandsText" maxlength="512" placeholder="马可波罗、东鹏，用逗号分隔" /></el-form-item>
        <el-form-item label="税号"><el-input v-model="form.taxNo" maxlength="64" /></el-form-item>
      </div>
      <el-form-item label="地址"><el-input v-model="form.addr" maxlength="256" /></el-form-item>
      <div class="supplier-form__grid">
        <el-form-item label="结算说明"><el-input v-model="form.settlementTerms" maxlength="64" placeholder="如：月结 30 天" /></el-form-item>
        <el-form-item label="账期模式">
          <el-select v-model="form.settlementMode">
            <el-option label="收货后账期" value="ReceiptDays" />
            <el-option label="月结对账" value="MonthlyCutoff" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.settlementMode === 'ReceiptDays'" label="账期天数">
          <el-input-number v-model="form.settlementDays" :min="0" :precision="0" controls-position="right" />
        </el-form-item>
        <el-form-item v-else label="每月截账日">
          <el-input-number v-model="form.cutoffDay" :min="1" :max="31" :precision="0" controls-position="right" />
        </el-form-item>
        <el-form-item label="开户行"><el-input v-model="form.bankName" maxlength="64" /></el-form-item>
        <el-form-item label="银行账号"><el-input v-model="form.bankAccount" maxlength="64" /></el-form-item>
      </div>
      <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="3" maxlength="500" show-word-limit /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存供应商</el-button>
    </template>
  </el-drawer>
</template>

<style scoped lang="scss">
.supplier-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 $space-4;
}
.supplier-form :deep(.el-select),
.supplier-form :deep(.el-input-number) { width: 100%; }
@media (max-width: 700px) {
  .supplier-form__grid { grid-template-columns: 1fr; }
}
</style>
