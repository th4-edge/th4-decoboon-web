<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import { ACCOUNT_LABEL } from '@/domains/finance/meta'
import type { FundAccount, Payable, WorkerRef } from '@/domains/finance/model'
import { createIdempotencyKey, formatAmountPreview, toInputDate } from '@/domains/finance/format'
import ProjectPicker from '@/components/picker/ProjectPicker.vue'
import PayablePicker from '@/components/picker/PayablePicker.vue'
import WorkerPicker from '@/components/picker/WorkerPicker.vue'
import FinanceDocumentLayout from '@/components/finance/FinanceDocumentLayout.vue'

const props = withDefaults(defineProps<{
  visible: boolean
  projectId?: string
  payableId?: string
}>(), { projectId: '', payableId: '' })

const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: []
}>()

const selectedPayable = ref<Payable | null>(null)
const selectedProjectName = ref('')
const saving = ref(false)
const error = ref('')
let intentKey = ''
const form = reactive({
  projectId: '',
  payableId: '',
  amount: '',
  account: 'companyBank' as FundAccount,
  paidAt: toInputDate(),
  payeeName: '',
  workerId: '',
  transactionNo: '',
  remark: ''
})

const accountOptions = (Object.entries(ACCOUNT_LABEL) as Array<[FundAccount, string]>)
  .map(([value, label]) => ({ value, label }))
const isSalaryPayment = computed(() => selectedPayable.value?.type === 'salary')

watch(() => props.visible, (visible) => {
  if (!visible) return
  error.value = ''
  intentKey = createIdempotencyKey()
  form.projectId = props.projectId
  form.payableId = props.payableId
  form.amount = ''
  form.account = 'companyBank'
  form.paidAt = toInputDate()
  form.payeeName = ''
  form.workerId = ''
  form.transactionNo = ''
  form.remark = ''
  selectedPayable.value = null
}, { immediate: true })

watch(() => form.projectId, (projectId, previous) => {
  if (previous && projectId !== previous) {
    form.payableId = ''
    form.amount = ''
    form.payeeName = ''
    form.workerId = ''
    selectedPayable.value = null
  }
})

function onProjectChange(option: { label?: string } | null): void {
  selectedProjectName.value = option?.label ?? ''
}

function onPayableChange(option: { raw?: unknown } | null): void {
  if (!option?.raw) {
    selectedPayable.value = null
    return
  }
  const payable = option.raw as Payable
  selectedPayable.value = payable
  form.amount = String(payable.outstandingAmount || payable.amount)
  form.payeeName = payable.payeeName ?? payable.payeeEmployee?.name ?? ''
  if (payable.project?.id) form.projectId = payable.project.id
}

function onWorkerChange(option: { raw?: unknown } | null): void {
  if (!option?.raw) return
  const worker = option.raw as WorkerRef
  if (!form.payeeName.trim()) form.payeeName = worker.name
}

async function submit(): Promise<void> {
  const amount = Number(form.amount)
  if (!form.payableId) {
    error.value = '请选择付款对应的应付单'
    return
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    error.value = '付款金额必须大于 0'
    return
  }
  if (selectedPayable.value && amount > selectedPayable.value.outstandingAmount) {
    error.value = `本次付款不得超过未付金额 ¥${selectedPayable.value.outstandingAmount.toFixed(2)}`
    return
  }
  if (isSalaryPayment.value && !form.workerId) {
    error.value = '工人工资付款必须选择个人工人'
    return
  }
  saving.value = true
  error.value = ''
  try {
    await financeApi.createPayment({
      payableId: form.payableId,
      amount,
      account: form.account,
      paidAt: form.paidAt,
      payeeName: form.payeeName.trim() || undefined,
      workerId: isSalaryPayment.value ? form.workerId : undefined,
      transactionNo: form.transactionNo.trim() || undefined,
      remark: form.remark.trim() || undefined,
      idempotencyKey: intentKey
    })
    ElMessage.success('付款已登记并完成核销')
    emit('saved')
    emit('update:visible', false)
  } catch (submitError) {
    error.value = submitError instanceof ProviderError ? submitError.message : '付款登记失败，暂不可确认'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-drawer
    :model-value="visible"
    title="安排业务付款"
    size="min(980px, 96vw)"
    destroy-on-close
    @update:model-value="emit('update:visible', $event)"
  >
    <FinanceDocumentLayout document-label="付款单" :document-title="selectedPayable?.name || '待选择应付单'">
      <template #context>
        <div class="finance-document__context">
          <ProjectPicker v-model="form.projectId" placeholder="选择所属项目" @change="onProjectChange" />
        </div>
      </template>

      <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
      <el-form label-position="top" class="finance-form-grid" @submit.prevent>
        <el-form-item label="待付应付单" class="finance-form-grid__wide">
          <PayablePicker v-model="form.payableId" :project-id="form.projectId" @change="onPayableChange" />
        </el-form-item>
        <el-form-item label="本次付款">
          <el-input v-model="form.amount" inputmode="decimal" placeholder="0.00">
            <template #prepend>¥</template>
          </el-input>
        </el-form-item>
        <el-form-item label="付款账户">
          <el-select v-model="form.account" style="width: 100%">
            <el-option v-for="option in accountOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="付款日期">
          <el-date-picker v-model="form.paidAt" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="收款方">
          <el-input v-model="form.payeeName" maxlength="80" />
        </el-form-item>
        <el-form-item v-if="isSalaryPayment" label="发放工人" class="finance-form-grid__wide">
          <WorkerPicker v-model="form.workerId" @change="onWorkerChange" />
        </el-form-item>
        <el-form-item label="交易号" class="finance-form-grid__wide">
          <el-input v-model="form.transactionNo" maxlength="80" placeholder="银行或支付平台交易号，可选" />
        </el-form-item>
        <el-form-item label="备注" class="finance-form-grid__wide">
          <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="300" show-word-limit />
        </el-form-item>
      </el-form>

      <template #aside>
        <div class="finance-document__result">
          <span>提交结果</span>
          <h4>待确认</h4>
          <dl>
            <div><dt>核销应付</dt><dd>{{ selectedPayable?.name || '未选择' }}</dd></div>
            <div><dt>原未付</dt><dd>{{ selectedPayable ? formatAmountPreview(selectedPayable.outstandingAmount) : '暂不可确认' }}</dd></div>
            <div><dt>本次付款</dt><dd>{{ formatAmountPreview(form.amount) }}</dd></div>
            <div><dt>付款日期</dt><dd>{{ form.paidAt || '待填写' }}</dd></div>
            <div v-if="isSalaryPayment"><dt>发放工人</dt><dd>{{ form.workerId ? '已选择工人' : '待选择' }}</dd></div>
          </dl>
          <p>保存后保存后自动核销应付并写入资金台账；项目成本不在此处重新计算。</p>
        </div>
      </template>
    </FinanceDocumentLayout>
    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">确认付款并核销</el-button>
    </template>
  </el-drawer>
</template>
