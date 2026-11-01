<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ProviderError } from '@/core/http'
import { createIdempotencyKey } from '@/core/idempotency'
import { financeApi } from '@/domains/finance/api'
import type { FundAccount, Payable } from '@/domains/finance/model'
import type { PickerOption } from '@/domains/common/picker'
import EmployeePayablePicker from '@/components/picker/EmployeePayablePicker.vue'
import { ACCOUNT_LABEL } from '@/domains/finance/meta'

const props = withDefaults(defineProps<{
  visible: boolean
  type?: 'EmployeeSalary' | 'EmployeeCommission'
  /** 当前工资单上下文：工资单详情内发放时只加载该工资单产生的应付。 */
  sheetId?: string
  /** 当前门店维度；服务端仍会按登录员工的权限范围兜底。 */
  storeId?: string
}>(), { type: undefined, sheetId: undefined, storeId: undefined })
const emit = defineEmits<{ 'update:visible': [value: boolean]; saved: [] }>()
const selectedId = ref('')
const selected = ref<Payable | null>(null)
const saving = ref(false)
const error = ref('')
let intentKey = ''
const form = reactive({ account: 'companyBank' as FundAccount, paidAt: localDate(), remark: '' })

watch(() => props.visible, (visible) => {
  if (!visible) {
    intentKey = ''
    return
  }
  intentKey = createIdempotencyKey('web-employee-pay')
  selectedId.value = ''
  selected.value = null
  error.value = ''
}, { immediate: true })

function onPayableChange(option: PickerOption | null): void {
  selected.value = option?.raw as Payable | null
  error.value = ''
}

async function submit(): Promise<void> {
  if (saving.value) return
  if (!selected.value) { error.value = '请选择待发员工应付'; return }
  saving.value = true
  error.value = ''
  try {
    await financeApi.payEmployee({
      payableIds: [selected.value.id],
      amount: selected.value.outstandingAmount,
      account: form.account,
      paidAt: form.paidAt,
      batchNo: `EMP-${form.paidAt.replace(/-/g, '')}`,
      idempotencyKey: intentKey,
      remark: form.remark.trim() || '员工工资/提成发放'
    })
    intentKey = ''
    ElMessage.success('员工薪酬已发放并写入资金台账')
    emit('saved')
    emit('update:visible', false)
  } catch (submitError) { error.value = submitError instanceof ProviderError ? submitError.message : '员工发放失败' }
  finally { saving.value = false }
}

function localDate(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
</script>

<template>
  <el-drawer :model-value="visible" title="员工薪酬发放" size="min(680px, 96vw)" @update:model-value="emit('update:visible', $event)">
    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <el-form label-position="top">
      <el-form-item label="待发应付">
        <EmployeePayablePicker
          v-model="selectedId"
          :store-id="props.storeId"
          :sheet-id="props.sheetId"
          :type="props.type === 'EmployeeSalary' ? 'employeeSalary' : props.type === 'EmployeeCommission' ? 'employeeCommission' : undefined"
          clearable
          @change="onPayableChange"
        />
      </el-form-item>
      <el-form-item label="付款账户"><el-select v-model="form.account" style="width:100%"><el-option v-for="(label,value) in ACCOUNT_LABEL" :key="value" :label="label" :value="value" /></el-select></el-form-item>
      <el-form-item label="发放日期"><el-date-picker v-model="form.paidAt" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
      <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="3" maxlength="300" /></el-form-item>
    </el-form>
    <el-descriptions v-if="selected" :column="1" border><el-descriptions-item label="本次发放"><strong>¥{{ selected.outstandingAmount.toFixed(2) }}</strong></el-descriptions-item></el-descriptions>
    <template #footer><el-button @click="emit('update:visible', false)">取消</el-button><el-button type="primary" :loading="saving" :disabled="!selected" @click="submit">确认发放</el-button></template>
  </el-drawer>
</template>
