<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import type { FundAccount, Receipt } from '@/domains/finance/model'
import { ACCOUNT_LABEL } from '@/domains/finance/meta'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'update:visible': [value: boolean]; saved: [] }>()
const receipts = ref<Receipt[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const form = reactive({ receiptId: '', amount: '', account: 'companyBank' as FundAccount, refundAt: localDate(), reason: '' })
const selected = computed(() => receipts.value.find((item) => item.id === form.receiptId))

watch(() => props.visible, async (visible) => {
  if (!visible) return
  error.value = ''
  loading.value = true
  try { receipts.value = (await financeApi.receipts({ size: 200 })).list }
  catch (loadError) { error.value = loadError instanceof ProviderError ? loadError.message : '原收款加载失败' }
  finally { loading.value = false }
})

watch(() => form.receiptId, () => { if (selected.value) form.amount = String(selected.value.amount) })

async function submit(): Promise<void> {
  const amount = Number(form.amount)
  if (!form.receiptId || !Number.isFinite(amount) || amount <= 0) { error.value = '请选择原收款并填写退款金额'; return }
  if (selected.value && amount > selected.value.amount) { error.value = `退款金额不得超过原收款 ${selected.value.amount.toFixed(2)}`; return }
  saving.value = true
  error.value = ''
  try {
    await financeApi.createRefund({
      receiptId: form.receiptId,
      amount,
      account: form.account,
      refundAt: form.refundAt,
      reason: form.reason.trim() || undefined,
      idempotencyKey: `web-refund-${form.receiptId}-${Date.now()}`
    })
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
        <el-select v-model="form.receiptId" filterable :loading="loading" placeholder="选择原收款记录" style="width: 100%">
          <el-option v-for="item in receipts" :key="item.id" :label="`${item.project.name} · ${item.receivedAt} · ¥${item.amount.toFixed(2)}`" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="退款金额"><el-input v-model="form.amount" inputmode="decimal" placeholder="0.00"><template #prepend>¥</template></el-input></el-form-item>
      <el-form-item label="退款账户"><el-select v-model="form.account" style="width:100%"><el-option v-for="(label, value) in ACCOUNT_LABEL" :key="value" :label="label" :value="value" /></el-select></el-form-item>
      <el-form-item label="退款日期"><el-date-picker v-model="form.refundAt" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
      <el-form-item label="退款原因"><el-input v-model="form.reason" type="textarea" :rows="3" maxlength="300" show-word-limit /></el-form-item>
    </el-form>
    <template #footer><el-button @click="emit('update:visible', false)">取消</el-button><el-button type="primary" :loading="saving" @click="submit">确认退款</el-button></template>
  </el-drawer>
</template>
