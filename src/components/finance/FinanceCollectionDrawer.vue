<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import { ACCOUNT_LABEL } from '@/domains/finance/meta'
import type { FundAccount, Receivable } from '@/domains/finance/model'
import { createIdempotencyKey, formatAmountPreview, toInputDate } from '@/domains/finance/format'
import ProjectPicker from '@/components/picker/ProjectPicker.vue'
import ReceivablePicker from '@/components/picker/ReceivablePicker.vue'
import FinanceDocumentLayout from '@/components/finance/FinanceDocumentLayout.vue'

const props = withDefaults(defineProps<{
  visible: boolean
  projectId?: string
  receivableId?: string
}>(), { projectId: '', receivableId: '' })

const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: []
}>()

const selectedReceivable = ref<Receivable | null>(null)
const selectedProjectName = ref('')
const saving = ref(false)
const error = ref('')
let intentKey = ''
const form = reactive({
  projectId: '',
  receivableId: '',
  amount: '',
  account: 'companyBank' as FundAccount,
  receivedAt: toInputDate(),
  payerName: '',
  remark: ''
})

const accountOptions = (Object.entries(ACCOUNT_LABEL) as Array<[FundAccount, string]>)
  .map(([value, label]) => ({ value, label }))

watch(() => props.visible, (visible) => {
  if (!visible) return
  error.value = ''
  intentKey = createIdempotencyKey()
  form.projectId = props.projectId
  form.receivableId = props.receivableId
  form.amount = ''
  form.account = 'companyBank'
  form.receivedAt = toInputDate()
  form.payerName = ''
  form.remark = ''
  selectedReceivable.value = null
}, { immediate: true })

watch(() => form.projectId, (projectId, previous) => {
  if (previous && projectId !== previous) {
    form.receivableId = ''
    form.amount = ''
    form.payerName = ''
    selectedReceivable.value = null
  }
})

function onProjectChange(option: { label?: string } | null): void {
  selectedProjectName.value = option?.label ?? ''
}

function onReceivableChange(option: { raw?: unknown } | null): void {
  if (!option?.raw) {
    selectedReceivable.value = null
    return
  }
  const receivable = option.raw as Receivable
  selectedReceivable.value = receivable
  form.amount = String(receivable.outstandingAmount || receivable.amount)
  form.payerName = receivable.customer?.name ?? receivable.project.customerName ?? ''
}

async function submit(): Promise<void> {
  const amount = Number(form.amount)
  if (!form.projectId || !form.receivableId) {
    error.value = '请选择项目和待收节点'
    return
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    error.value = '收款金额必须大于 0'
    return
  }
  if (selectedReceivable.value && amount > selectedReceivable.value.outstandingAmount) {
    error.value = `本次收款不得超过待收金额 ¥${selectedReceivable.value.outstandingAmount.toFixed(2)}`
    return
  }
  saving.value = true
  error.value = ''
  try {
    await financeApi.createReceipt({
      projectId: form.projectId,
      receivableId: form.receivableId,
      amount,
      account: form.account,
      receivedAt: form.receivedAt,
      payerName: form.payerName.trim() || undefined,
      remark: form.remark.trim() || undefined,
      idempotencyKey: intentKey
    })
    ElMessage.success('收款已登记并完成核销')
    emit('saved')
    emit('update:visible', false)
  } catch (submitError) {
    error.value = submitError instanceof ProviderError ? submitError.message : '收款登记失败，暂不可确认'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-drawer
    :model-value="visible"
    title="登记客户收款"
    size="min(980px, 96vw)"
    destroy-on-close
    @update:model-value="emit('update:visible', $event)"
  >
    <FinanceDocumentLayout document-label="收款单" :document-title="selectedReceivable?.name || '待选择应收节点'">
      <template #context>
        <div class="finance-document__context">
          <ProjectPicker v-model="form.projectId" placeholder="选择所属项目" @change="onProjectChange" />
        </div>
      </template>

      <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
      <el-form label-position="top" class="finance-form-grid" @submit.prevent>
        <el-form-item label="待收节点" class="finance-form-grid__wide">
          <ReceivablePicker v-model="form.receivableId" :project-id="form.projectId" @change="onReceivableChange" />
        </el-form-item>
        <el-form-item label="本次收款">
          <el-input v-model="form.amount" inputmode="decimal" placeholder="0.00">
            <template #prepend>¥</template>
          </el-input>
        </el-form-item>
        <el-form-item label="收款账户">
          <el-select v-model="form.account" style="width: 100%">
            <el-option v-for="option in accountOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="到账日期">
          <el-date-picker v-model="form.receivedAt" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="付款方">
          <el-input v-model="form.payerName" maxlength="80" placeholder="客户或代付人" />
        </el-form-item>
        <el-form-item label="备注" class="finance-form-grid__wide">
          <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="300" show-word-limit />
        </el-form-item>
      </el-form>

      <template #aside>
        <div class="finance-document__result">
          <span>提交结果</span>
          <h4>待服务端核销</h4>
          <dl>
            <div><dt>核销应收</dt><dd>{{ selectedReceivable?.name || '未选择' }}</dd></div>
            <div><dt>原待收</dt><dd>{{ selectedReceivable ? formatAmountPreview(selectedReceivable.outstandingAmount) : '暂不可确认' }}</dd></div>
            <div><dt>本次收款</dt><dd>{{ formatAmountPreview(form.amount) }}</dd></div>
            <div><dt>到账日期</dt><dd>{{ form.receivedAt || '待填写' }}</dd></div>
          </dl>
          <p>保存后由服务端核销应收并写入资金台账；应收状态和剩余待收金额以服务端回读为准。</p>
        </div>
      </template>
    </FinanceDocumentLayout>
    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">确认收款并核销</el-button>
    </template>
  </el-drawer>
</template>
