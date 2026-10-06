<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import type { FundAccount } from '@/domains/finance/model'
import { ACCOUNT_LABEL } from '@/domains/finance/meta'

const props = withDefaults(defineProps<{ visible: boolean; type?: 'EmployeeSalary' | 'EmployeeCommission' }>(), { type: undefined })
const emit = defineEmits<{ 'update:visible': [value: boolean]; saved: [] }>()
const payables = ref<Awaited<ReturnType<typeof financeApi.employeePayables>>>([])
const selectedId = ref('')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const form = reactive({ account: 'companyBank' as FundAccount, paidAt: localDate(), remark: '' })
const selected = computed(() => payables.value.find((item) => item.id === selectedId.value))

watch(() => props.visible, async (visible) => {
  if (!visible) return
  loading.value = true
  error.value = ''
  try {
    const rows = await financeApi.employeePayables()
    payables.value = rows.filter((item) => !props.type || item.type.toLowerCase().includes(props.type === 'EmployeeSalary' ? 'employeesalary' : 'employeecommission'))
    selectedId.value = payables.value[0]?.id || ''
  } catch (loadError) { error.value = loadError instanceof ProviderError ? loadError.message : '员工应付加载失败' }
  finally { loading.value = false }
})

async function submit(): Promise<void> {
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
      idempotencyKey: `web-employee-pay-${selected.value.id}-${Date.now()}`,
      remark: form.remark.trim() || '员工工资/提成发放'
    })
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
      <el-form-item label="待发应付"><el-select v-model="selectedId" :loading="loading" style="width:100%"><el-option v-for="item in payables" :key="item.id" :label="`${item.employee.name} · ${item.name} · ¥${item.outstandingAmount.toFixed(2)}`" :value="item.id" /></el-select></el-form-item>
      <el-form-item label="付款账户"><el-select v-model="form.account" style="width:100%"><el-option v-for="(label,value) in ACCOUNT_LABEL" :key="value" :label="label" :value="value" /></el-select></el-form-item>
      <el-form-item label="发放日期"><el-date-picker v-model="form.paidAt" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
      <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="3" maxlength="300" /></el-form-item>
    </el-form>
    <el-descriptions v-if="selected" :column="1" border><el-descriptions-item label="本次发放"><strong>¥{{ selected.outstandingAmount.toFixed(2) }}</strong></el-descriptions-item></el-descriptions>
    <template #footer><el-button @click="emit('update:visible', false)">取消</el-button><el-button type="primary" :loading="saving" @click="submit">确认发放</el-button></template>
  </el-drawer>
</template>
