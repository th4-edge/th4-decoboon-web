<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ProviderError } from '@/core/http'
import { createIdempotencyKey } from '@/core/idempotency'
import { financeApi } from '@/domains/finance/api'
import type { FundAccount, Receipt } from '@/domains/finance/model'
import type { PickerOption } from '@/domains/common/picker'
import ReceiptPicker from '@/components/picker/ReceiptPicker.vue'
import { ACCOUNT_LABEL } from '@/domains/finance/meta'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'update:visible': [value: boolean]; saved: [] }>()
const selected = ref<Receipt | null>(null)
const saving = ref(false)
const error = ref('')
let intentKey = ''
const form = reactive({ receiptId: '', amount: '', account: 'companyBank' as FundAccount, refundAt: localDate(), reason: '' })

watch(() => props.visible, (visible) => {
  if (!visible) {
    intentKey = ''
    return
  }
  intentKey = createIdempotencyKey('web-refund')
  form.receiptId = ''
  form.amount = ''
  selected.value = null
  error.value = ''
}, { immediate: true })

function onReceiptChange(option: PickerOption | null): void {
  selected.value = option?.raw as Receipt | null
  form.amount = selected.value ? String(selected.value.amount) : ''
  error.value = ''
}

async function submit(): Promise<void> {
  if (saving.value) return
  const amount = Number(form.amount)
  if (!form.receiptId || !selected.value || !Number.isFinite(amount) || amount <= 0) { error.value = '请选择原收款并填写退款金额'; return }
  if (selected.value.status === 'reversed') { error.value = '原收款已冲正，不能登记退款'; return }
  if (amount > selected.value.amount) { error.value = `退款金额不得超过原收款 ${selected.value.amount.toFixed(2)}`; return }
  saving.value = true
  error.value = ''
  try {
    await financeApi.createRefund({
      receiptId: form.receiptId,
      amount,
      account: form.account,
      refundAt: form.refundAt,
      reason: form.reason.trim() || undefined,
      idempotencyKey: intentKey
    })
    intentKey = ''
    ElMessage.success('退款已登记，并已联动提成负向调整')
    emit('saved')
    emit('update:visible', false)
  } catch (submitError) {
    error.value = submitError instanceof ProviderError ? submitError.message : '退款登记失败'
  } finally { saving.value = false }
}

function localDate(): string {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
</script>

<template>
  <el-drawer :model-value="visible" title="登记客户退款" size="min(720px, 96vw)" destroy-on-close @update:model-value="emit('update:visible', $event)">
    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <el-form label-position="top" class="finance-form-grid" @submit.prevent>
      <el-form-item label="原收款" class="finance-form-grid__wide">
        <ReceiptPicker v-model="form.receiptId" clearable @change="onReceiptChange" />
      </el-form-item>
      <el-form-item label="退款金额"><el-input v-model="form.amount" inputmode="decimal" placeholder="0.00"><template #prepend>¥</template></el-input></el-form-item>
      <el-form-item label="退款账户"><el-select v-model="form.account" style="width:100%"><el-option v-for="(label, value) in ACCOUNT_LABEL" :key="value" :label="label" :value="value" /></el-select></el-form-item>
      <el-form-item label="退款日期"><el-date-picker v-model="form.refundAt" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
      <el-form-item label="退款原因"><el-input v-model="form.reason" type="textarea" :rows="3" maxlength="300" show-word-limit /></el-form-item>
    </el-form>
    <template #footer><el-button @click="emit('update:visible', false)">取消</el-button><el-button type="primary" :loading="saving" @click="submit">确认退款</el-button></template>
  </el-drawer>
</template>
