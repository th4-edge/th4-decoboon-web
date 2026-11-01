<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ProviderError } from '@/core/http'
import { createIdempotencyKey } from '@/core/idempotency'
import { financeApi } from '@/domains/finance/api'
import type { Receipt, ReceiptReversalReason } from '@/domains/finance/model'
import { ACCOUNT_LABEL, RECEIPT_REVERSAL_REASON_META } from '@/domains/finance/meta'
import MoneyText from '@/components/MoneyText.vue'
import FinanceDocumentLayout from '@/components/finance/FinanceDocumentLayout.vue'

const props = defineProps<{ visible: boolean; receipt: Receipt | null }>()
const emit = defineEmits<{ 'update:visible': [value: boolean]; saved: [] }>()
const form = reactive({ reasonType: 'notReceived' as ReceiptReversalReason, reason: '', reversalAt: localDate() })
const verified = ref(false)
const submitting = ref(false)
const error = ref('')
let intentKey = ''

const reasonOptions = Object.entries(RECEIPT_REVERSAL_REASON_META) as Array<[ReceiptReversalReason, { label: string; hint: string }]>
const selectedReason = computed(() => RECEIPT_REVERSAL_REASON_META[form.reasonType])
const blockedReason = computed(() => {
  if (!props.receipt) return '收款记录暂不可确认'
  if (props.receipt.status === 'reversed') return '该收款已冲正，不能重复操作'
  return ''
})
const canSubmit = computed(() => Boolean(props.receipt)
  && !blockedReason.value
  && form.reason.trim().length >= 8
  && verified.value
  && !submitting.value)

watch(() => props.visible, (visible) => {
  if (!visible) return
  form.reasonType = 'notReceived'
  form.reason = ''
  form.reversalAt = localDate()
  verified.value = false
  error.value = ''
  intentKey = createIdempotencyKey('web-receipt-reversal')
}, { immediate: true })

async function submit(): Promise<void> {
  if (!props.receipt || !canSubmit.value) return
  submitting.value = true
  error.value = ''
  try {
    await financeApi.reverseReceipt({
      receiptId: props.receipt.id,
      reasonType: form.reasonType,
      reason: form.reason.trim(),
      reversalAt: form.reversalAt,
      idempotencyKey: intentKey
    })
    intentKey = ''
    ElMessage.success('收款已冲正，应收余额已更新')
    emit('saved')
    emit('update:visible', false)
  } catch (submitError) {
    error.value = submitError instanceof ProviderError ? submitError.message : '收款冲正失败，暂不可确认'
  } finally {
    submitting.value = false
  }
}

function localDate(): string {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
</script>

<template>
  <el-drawer
    :model-value="visible"
    title="收款冲正"
    size="min(820px, 96vw)"
    destroy-on-close
    @update:model-value="emit('update:visible', $event)"
  >
    <el-alert
      v-if="error"
      type="error"
      :closable="false"
      :title="error"
      show-icon
      class="reversal-alert"
    />
    <el-alert
      v-else
      type="warning"
      :closable="false"
      title="冲正不是删除"
      description="原收款会保留，对应应收恢复为待收，并生成一笔冲正支出用于对账。"
      show-icon
      class="reversal-alert"
    />

    <FinanceDocumentLayout
      document-label="收款冲正"
      :document-title="receipt?.project?.name || '待选择原收款'"
    >
      <el-form label-position="top" class="finance-form-grid" @submit.prevent>
        <el-form-item label="冲正原因" class="finance-form-grid__wide">
          <el-select v-model="form.reasonType" style="width: 100%">
            <el-option
              v-for="[value, meta] in reasonOptions"
              :key="value"
              :label="meta.label"
              :value="value"
            />
          </el-select>
          <span class="reversal-hint">{{ selectedReason.hint }}</span>
        </el-form-item>
        <el-form-item label="冲正日期">
          <el-date-picker v-model="form.reversalAt" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="冲正说明" class="finance-form-grid__wide">
          <el-input
            v-model="form.reason"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            placeholder="至少8个字，说明为什么需要冲正以及核对依据"
          />
        </el-form-item>
        <el-form-item class="finance-form-grid__wide">
          <el-checkbox v-model="verified">
            我已核对原收款、应收余额、到账账户和冲正影响
          </el-checkbox>
        </el-form-item>
      </el-form>

      <template #aside>
        <div class="finance-document__result">
          <span>当前收款</span>
          <h4>{{ receipt?.receivable?.name || '应收节点暂不可确认' }}</h4>
          <dl>
            <div><dt>项目</dt><dd>{{ receipt?.project?.name || '暂不可确认' }}</dd></div>
            <div><dt>收款金额</dt><dd><MoneyText :value="receipt?.amount" /></dd></div>
            <div><dt>到账账户</dt><dd>{{ receipt ? ACCOUNT_LABEL[receipt.account] : '暂不可确认' }}</dd></div>
            <div><dt>到账日期</dt><dd>{{ receipt?.receivedAt || '暂不可确认' }}</dd></div>
            <div><dt>付款方</dt><dd>{{ receipt?.payerName || receipt?.customer?.name || '暂不可确认' }}</dd></div>
          </dl>
          <p>{{ blockedReason || '提交前请再次核对冲正原因和日期。' }}</p>
        </div>
      </template>
    </FinanceDocumentLayout>

    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="danger" :loading="submitting" :disabled="!canSubmit" @click="submit">
        确认冲正
      </el-button>
    </template>
  </el-drawer>
</template>

<style scoped lang="scss">
.reversal-alert { margin-bottom: $space-4; }
.reversal-hint {
  display: block;
  margin-top: $space-2;
  color: $text-tertiary;
  font-size: $font-caption;
  line-height: 1.55;
}
</style>
