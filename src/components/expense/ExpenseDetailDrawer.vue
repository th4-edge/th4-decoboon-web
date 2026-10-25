<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ProviderError } from '@/core/http'
import { formatDateTime, formatMoney } from '@/core/format'
import { expenseApi } from '@/domains/expense/api'
import { financeApi } from '@/domains/finance/api'
import { ACCOUNT_LABEL } from '@/domains/finance/meta'
import { createIdempotencyKey, toInputDate } from '@/domains/finance/format'
import type { FundAccount } from '@/domains/finance/model'
import {
  EXPENSE_PAYMENT_MODE_META,
  expenseDocumentTypeLabel,
  expenseStatusMeta
} from '@/domains/expense/meta'
import type { Expense, ExpenseStatus } from '@/domains/expense/model'
import { useSessionStore } from '@/stores/session'
import FinanceDocumentLayout from '@/components/finance/FinanceDocumentLayout.vue'
import StatusTag from '@/components/StatusTag.vue'

const session = useSessionStore()

const props = defineProps<{
  visible: boolean
  item: Expense | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  edit: [value: Expense]
  changed: [value?: Expense]
}>()

const detail = ref<Expense | null>(null)
const loading = ref(false)
const error = ref('')
const busy = ref(false)
const paymentVisible = ref(false)
const paying = ref(false)
const paymentError = ref('')
const voucherBusyId = ref('')
let paymentIntentKey = ''
const paymentForm = reactive({
  amount: '',
  account: 'companyBank' as FundAccount,
  paidAt: toInputDate(),
  payeeName: '',
  transactionNo: '',
  remark: ''
})
const accountOptions = (Object.entries(ACCOUNT_LABEL) as Array<[FundAccount, string]>)
  .map(([value, label]) => ({ value, label }))

const current = computed(() => detail.value ?? props.item)
const currentStatus = computed(() => current.value ? expenseStatusMeta(current.value.status) : null)
const paymentMode = computed(() => current.value ? EXPENSE_PAYMENT_MODE_META[current.value.paymentMode] : null)
function hasAction(action: string): boolean {
  return Array.isArray(current.value?.allowedActions) && current.value.allowedActions.includes(action)
}

const canEdit = computed(() => hasAction('edit'))
const canSubmit = computed(() => hasAction('submit'))
const canWithdraw = computed(() => hasAction('withdraw'))
const canApprove = computed(() => hasAction('approve'))
const canReturn = computed(() => hasAction('return'))
const canReject = computed(() => hasAction('reject'))
const canDelete = computed(() => hasAction('delete'))
const canPay = computed(() => hasAction('pay') && Boolean(current.value?.payable?.id))
const canGenerateVoucher = computed(() =>
  session.role === 'Boss' || session.role === 'StoreManager' || session.role === 'Finance')

watch(() => [props.visible, props.item?.id] as const, ([visible]) => {
  if (visible) void reload()
}, { immediate: true })

async function reload(): Promise<void> {
  const expenseId = props.item?.id
  if (!expenseId) {
    detail.value = null
    return
  }
  loading.value = true
  error.value = ''
  try {
    detail.value = await expenseApi.info(expenseId)
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '费用详情暂不可确认'
  } finally {
    loading.value = false
  }
}

function isCancel(value: unknown): boolean {
  return value === 'cancel' || value === 'close'
}

async function promptAction(target: 'Returned' | 'Approved' | 'Rejected'): Promise<void> {
  if (!current.value) return
  const config = target === 'Approved'
    ? {
        title: '批准费用',
        message: '可填写审批意见；批准后形成费用事实，但本切片不会生成应付、付款或凭证。',
        confirm: '确认批准',
        required: false
      }
    : target === 'Returned'
      ? {
          title: '退回补充',
          message: '请说明需要补充的证据或信息；退回后由归属员工修改并重新提交。',
          confirm: '确认退回',
          required: true
        }
      : {
          title: '拒绝费用',
          message: '请填写拒绝原因；拒绝后本次费用流程终止。',
          confirm: '确认拒绝',
          required: true
        }
  try {
    const result = await ElMessageBox.prompt(config.message, config.title, {
      confirmButtonText: config.confirm,
      cancelButtonText: '取消',
      inputType: 'textarea',
      inputPlaceholder: config.required ? '必填' : '可选',
      inputValidator: (value: string) => !config.required || Boolean(value?.trim()) || '请填写原因',
      distinguishCancelAndClose: true
    })
    await runAction(target, result.value?.trim() || undefined)
  } catch (actionError) {
    if (!isCancel(actionError)) error.value = actionError instanceof Error ? actionError.message : '操作暂不可确认'
  }
}

async function submitExpense(): Promise<void> {
  if (!current.value) return
  try {
    await ElMessageBox.confirm(
      '提交后将冻结本次内容并生成提交版本，由企业负责人或店长审批。',
      '提交费用',
      { confirmButtonText: '确认提交', cancelButtonText: '取消', distinguishCancelAndClose: true }
    )
    await runAction('Submitted')
  } catch (actionError) {
    if (!isCancel(actionError)) error.value = actionError instanceof Error ? actionError.message : '提交暂不可确认'
  }
}

async function withdrawExpense(): Promise<void> {
  if (!current.value) return
  try {
    await ElMessageBox.confirm('撤回后本次费用进入已取消，不能继续审批。', '撤回费用', {
      confirmButtonText: '确认撤回',
      cancelButtonText: '保留已提交',
      distinguishCancelAndClose: true
    })
    await runAction('Cancelled')
  } catch (actionError) {
    if (!isCancel(actionError)) error.value = actionError instanceof Error ? actionError.message : '撤回暂不可确认'
  }
}

async function deleteExpense(): Promise<void> {
  if (!current.value) return
  try {
    await ElMessageBox.confirm('仅未提交草稿可删除；删除后无法从本页恢复。', '删除费用草稿', {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      type: 'warning',
      distinguishCancelAndClose: true
    })
    busy.value = true
    error.value = ''
    await expenseApi.remove(current.value.id)
    ElMessage.success('费用草稿已删除')
    emit('changed')
    emit('update:visible', false)
  } catch (actionError) {
    if (!isCancel(actionError)) error.value = actionError instanceof Error ? actionError.message : '删除暂不可确认'
  } finally {
    busy.value = false
  }
}

function openPayment(): void {
  if (!current.value?.payable || !canPay.value) return
  paymentIntentKey = createIdempotencyKey()
  paymentForm.amount = current.value.unpaidAmount > 0 ? String(current.value.unpaidAmount) : ''
  paymentForm.account = 'companyBank'
  paymentForm.paidAt = toInputDate()
  paymentForm.payeeName = current.value.payable.payeeEmployee?.name || current.value.payable.payeeName || ''
  paymentForm.transactionNo = ''
  paymentForm.remark = ''
  paymentError.value = ''
  paymentVisible.value = true
}

async function submitPayment(): Promise<void> {
  if (!current.value?.payable) return
  const amount = Number(paymentForm.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    paymentError.value = '付款金额必须大于 0'
    return
  }
  if (amount > current.value.unpaidAmount) {
    paymentError.value = `本次付款不得超过未付金额 ¥${current.value.unpaidAmount.toFixed(2)}`
    return
  }
  paying.value = true
  paymentError.value = ''
  try {
    await financeApi.createPayment({
      payableId: current.value.payable.id,
      amount,
      account: paymentForm.account,
      paidAt: paymentForm.paidAt,
      payeeName: paymentForm.payeeName.trim() || undefined,
      transactionNo: paymentForm.transactionNo.trim() || undefined,
      remark: paymentForm.remark.trim() || undefined,
      idempotencyKey: paymentIntentKey
    })
    paymentVisible.value = false
    await reload()
    emit('changed', detail.value || undefined)
    ElMessage.success('付款已核销')
  } catch (paymentIssue) {
    paymentError.value = paymentIssue instanceof ProviderError ? paymentIssue.message : '付款结果暂不可确认，请重新读取'
  } finally {
    paying.value = false
  }
}

function voucherForPayment(paymentId: string) {
  return current.value?.vouchers.find((voucher) => voucher.paymentId === paymentId)
}

function voucherStatusText(status?: string): string {
  return status === 'voided' ? '已作废' : '已发行'
}

async function generateVoucher(paymentId: string): Promise<void> {
  if (!paymentId || voucherBusyId.value) return
  voucherBusyId.value = paymentId
  error.value = ''
  try {
    await financeApi.buildPaymentVoucher(paymentId)
    await reload()
    emit('changed', detail.value || undefined)
    ElMessage.success('付款凭证已生成')
  } catch (issue) {
    error.value = issue instanceof ProviderError ? issue.message : '付款凭证暂不可确认，请重试'
  } finally {
    voucherBusyId.value = ''
  }
}

function openVoucher(url?: string): void {
  if (!url) {
    error.value = '凭证地址暂不可确认，请重新读取'
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

function paymentStatusLabel(status?: string): string {
  return ({ Pending: '待付款', Partial: '部分付款', Paid: '已付清', Overdue: '已逾期', Closed: '已关闭' } as Record<string, string>)[status || ''] || '付款状态待确认'
}

async function runAction(target: ExpenseStatus, note?: string): Promise<void> {
  if (!current.value) return
  busy.value = true
  error.value = ''
  try {
    await expenseApi.update({
      expenseId: current.value.id,
      status: target as Exclude<ExpenseStatus, 'Draft' | 'Voided' | 'Closed'>,
      approvalNote: note
    })
    detail.value = await expenseApi.info(current.value.id)
    ElMessage.success(target === 'Approved'
      ? '费用已批准'
      : target === 'Returned'
        ? '费用已退回补充'
        : target === 'Rejected'
          ? '费用已拒绝'
          : target === 'Submitted'
            ? '费用已提交'
            : '费用已撤回')
    emit('changed', detail.value)
  } catch (actionError) {
    error.value = actionError instanceof ProviderError ? actionError.message : '操作暂不可确认，请刷新后重试'
  } finally {
    busy.value = false
  }
}

function formatAmount(value: number | undefined): string {
  return value === undefined ? '暂不可确认' : `¥${formatMoney(value)}`
}
</script>

<template>
  <el-drawer
    :model-value="visible"
    title="费用单详情"
    size="min(960px, 96vw)"
    destroy-on-close
    @update:model-value="emit('update:visible', $event)"
  >
    <div v-if="loading && !current" class="expense-detail__loading">
      <el-skeleton :rows="7" animated />
    </div>
    <el-alert v-else-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default>
        <el-button link type="primary" @click="reload">重新读取</el-button>
      </template>
    </el-alert>
    <FinanceDocumentLayout
      v-else-if="current"
      document-label="费用报销单"
      :document-title="current.expenseNo || '费用编号暂不可确认'"
    >
      <template #context>
        <div class="expense-detail__context">
          <span>{{ current.store?.name || '未归属门店' }}</span>
          <span>·</span>
          <span>{{ current.project ? `${current.project.name}（项目费用）` : '企业费用' }}</span>
        </div>
      </template>

      <template #head-extra>
        <StatusTag :text="currentStatus?.label || '状态待确认'" :tone="currentStatus?.tone || 'muted'" />
      </template>

      <el-alert
        v-if="current.status === 'Returned'"
        class="expense-detail__alert"
        type="warning"
        :closable="false"
        title="退回原因"
        :description="current.approvalNote || '退回原因暂不可确认'"
        show-icon
      />

      <section class="expense-detail__facts">
        <div>
          <span>支付方式</span>
          <strong>{{ paymentMode?.label || '支付方式待确认' }}</strong>
          <small>{{ paymentMode?.hint }}</small>
        </div>
        <div>
          <span>费用金额</span>
          <strong class="expense-detail__amount">{{ formatAmount(current.amount) }}</strong>
          <small>{{ current.expenseDate || '发生日期暂不可确认' }}</small>
        </div>
        <div>
          <span>费用分类</span>
          <strong>{{ current.category?.name || '分类暂不可确认' }}</strong>
          <small>{{ current.category?.code || '企业费用分类' }}</small>
        </div>
        <div>
          <span>提交版本</span>
          <strong>第 {{ current.version || 0 }} 次提交版本</strong>
          <small>{{ formatDateTime(current.submittedAt) }}</small>
        </div>
      </section>

      <section class="expense-detail__section">
        <h3>归属与责任人</h3>
        <dl class="expense-detail__dl">
          <div><dt>费用归属员工</dt><dd>{{ current.owner?.name || '暂不可确认' }}</dd></div>
          <div><dt>实际提交人</dt><dd>{{ current.requester?.name || '暂不可确认' }}</dd></div>
          <div v-if="current.paymentMode === 'Reimbursement'"><dt>报销收款员工</dt><dd>{{ current.payeeEmployee?.name || '暂不可确认' }}</dd></div>
          <div><dt>项目归属</dt><dd>{{ current.project ? current.project.name : '企业费用（不进入项目成本）' }}</dd></div>
        </dl>
      </section>

      <section v-if="current.payments.length" class="expense-detail__section">
        <div class="expense-detail__section-head">
          <h3>付款记录与付款凭证</h3>
          <span>{{ current.vouchers.length }} 张已发行凭证</span>
        </div>
        <div class="expense-detail__payments">
          <div v-for="payment in current.payments" :key="payment.id" class="expense-detail__payment">
            <div class="expense-detail__payment-head">
              <strong>{{ formatAmount(payment.amount) }}</strong>
              <span>{{ payment.paidAt || '付款日期暂不可确认' }}</span>
            </div>
            <small>{{ payment.payeeName || '收款方暂不可确认' }} · {{ ACCOUNT_LABEL[payment.account] }}</small>
            <small v-if="payment.transactionNo">流水号 {{ payment.transactionNo }}</small>
            <div class="expense-detail__payment-voucher">
              <template v-if="voucherForPayment(payment.id)">
                <span>{{ voucherForPayment(payment.id)?.voucherNo }} · {{ voucherStatusText(voucherForPayment(payment.id)?.status) }}</span>
                <el-button link type="primary" @click="openVoucher(voucherForPayment(payment.id)?.url)">查看凭证</el-button>
              </template>
              <el-button
                v-else-if="canGenerateVoucher"
                type="primary"
                plain
                :loading="voucherBusyId === payment.id"
                @click="generateVoucher(payment.id)"
              >生成付款凭证</el-button>
              <span v-else>凭证待财务生成</span>
            </div>
          </div>
        </div>
      </section>

      <section class="expense-detail__section">
        <h3>费用说明</h3>
        <p class="expense-detail__description">{{ current.description || '费用说明暂不可确认' }}</p>
      </section>

      <section class="expense-detail__section">
        <div class="expense-detail__section-head">
          <h3>证据附件</h3>
          <span>{{ current.attachments.length }} 份</span>
        </div>
        <div v-if="current.attachments.length" class="expense-detail__attachments">
          <a
            v-for="attachment in current.attachments"
            :key="attachment.attachmentId || attachment.fileUrl"
            :href="attachment.url || attachment.fileUrl"
            target="_blank"
            rel="noopener"
            class="expense-detail__attachment"
          >
            <strong>{{ attachment.fileName || '证据附件' }}</strong>
            <span>{{ expenseDocumentTypeLabel(attachment.documentType) }}</span>
            <small>{{ attachment.size ? `${Math.ceil(attachment.size / 1024)} KB` : '文件大小暂不可确认' }}</small>
          </a>
        </div>
        <p v-else class="expense-detail__muted">附件读取失败或尚未上传；提交前至少需要一份证据。</p>
      </section>

      <section class="expense-detail__section">
        <div class="expense-detail__section-head">
          <h3>提交版本</h3>
          <span>{{ current.revisions?.length || 0 }} 个版本</span>
        </div>
        <div v-if="current.revisions?.length" class="expense-detail__revisions">
          <div v-for="revision in current.revisions" :key="revision.revisionId || revision.version">
            <strong>第 {{ revision.version }} 版</strong>
            <span>{{ revision.submittedBy?.name || '提交人待确认' }} · {{ formatDateTime(revision.submittedAt) }}</span>
            <small v-if="revision.returnReason">上次退回：{{ revision.returnReason }} · {{ revision.returnedBy?.name || '退回人待确认' }} · {{ formatDateTime(revision.returnedAt) }}</small>
          </div>
        </div>
        <p v-else class="expense-detail__muted">暂无已提交版本；保存草稿不会生成版本记录。</p>
      </section>

      <section v-if="current.payable" class="expense-detail__section">
        <div class="expense-detail__section-head">
          <h3>付款与核销</h3>
          <span>{{ paymentStatusLabel(current.paymentStatus) }}</span>
        </div>
        <dl class="expense-detail__dl">
          <div><dt>应付金额</dt><dd>{{ formatAmount(current.payable.amount) }}</dd></div>
          <div><dt>已付金额</dt><dd>{{ formatAmount(current.payable.paidAmount) }}</dd></div>
          <div><dt>未付金额</dt><dd>{{ formatAmount(current.unpaidAmount) }}</dd></div>
          <div><dt>约定付款日</dt><dd>{{ current.payable.dueDate || '待确认' }}</dd></div>
        </dl>
      </section>

      <section v-if="current.approvedBy || current.approvalNote || current.approvedAt" class="expense-detail__section">
        <h3>审批记录</h3>
        <dl class="expense-detail__dl">
          <div><dt>审批人</dt><dd>{{ current.approvedBy?.name || '暂不可确认' }}</dd></div>
          <div><dt>审批时间</dt><dd>{{ formatDateTime(current.approvedAt) }}</dd></div>
          <div><dt>自审留痕</dt><dd>{{ current.selfApproved ? '是（企业负责人自审，已独立留痕）' : '否' }}</dd></div>
          <div class="expense-detail__wide"><dt>审批意见</dt><dd>{{ current.approvalNote || '无审批意见' }}</dd></div>
        </dl>
      </section>

      <template #aside>
        <div class="finance-document__result expense-detail__result">
          <span>当前事实</span>
          <h4>{{ currentStatus?.label || '状态待确认' }}</h4>
          <p>{{ current.nextAction || '下一步暂不可确认，请刷新后重试' }}</p>
          <dl>
            <div><dt>费用编号</dt><dd>{{ current.expenseNo || '暂不可确认' }}</dd></div>
            <div><dt>归属门店</dt><dd>{{ current.store?.name || '未归属门店' }}</dd></div>
            <div><dt>最后更新</dt><dd>{{ formatDateTime(current.updatedAt) }}</dd></div>
            <div><dt>下游影响</dt><dd>本切片不生成付款、凭证或利润</dd></div>
          </dl>
        </div>
      </template>
    </FinanceDocumentLayout>

    <template #footer>
      <el-button @click="emit('update:visible', false)">关闭</el-button>
      <el-button v-if="current && canDelete" :loading="busy" @click="deleteExpense">删除草稿</el-button>
      <el-button v-if="current && canEdit" @click="emit('edit', current)">编辑</el-button>
      <el-button v-if="current && canWithdraw" :loading="busy" @click="withdrawExpense">撤回</el-button>
      <el-button v-if="current && canReturn" :loading="busy" @click="promptAction('Returned')">退回补充</el-button>
      <el-button v-if="current && canReject" :loading="busy" @click="promptAction('Rejected')">拒绝</el-button>
      <el-button v-if="current && canSubmit" type="primary" :loading="busy" @click="submitExpense">提交审批</el-button>
      <el-button v-if="current && canApprove" type="primary" :loading="busy" @click="promptAction('Approved')">批准费用</el-button>
      <el-button v-if="current && canPay" type="primary" @click="openPayment">安排付款</el-button>
    </template>
  </el-drawer>

  <el-dialog v-model="paymentVisible" title="安排费用付款" width="min(620px, 92vw)" append-to-body>
    <el-alert v-if="paymentError" type="error" :closable="false" :title="paymentError" show-icon />
    <el-form label-position="top" class="finance-form-grid" @submit.prevent>
      <el-form-item label="本次付款">
        <el-input v-model="paymentForm.amount" inputmode="decimal" placeholder="0.00"><template #prepend>¥</template></el-input>
      </el-form-item>
      <el-form-item label="付款账户">
        <el-select v-model="paymentForm.account" style="width:100%">
          <el-option v-for="option in accountOptions" :key="option.value" :label="option.label" :value="option.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="付款日期">
        <el-date-picker v-model="paymentForm.paidAt" type="date" value-format="YYYY-MM-DD" style="width:100%" />
      </el-form-item>
      <el-form-item label="收款方">
        <el-input v-model="paymentForm.payeeName" maxlength="80" />
      </el-form-item>
      <el-form-item label="交易号" class="finance-form-grid__wide">
        <el-input v-model="paymentForm.transactionNo" maxlength="80" />
      </el-form-item>
      <el-form-item label="备注" class="finance-form-grid__wide">
        <el-input v-model="paymentForm.remark" type="textarea" :rows="3" maxlength="300" show-word-limit />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="paymentVisible = false">取消</el-button>
      <el-button type="primary" :loading="paying" @click="submitPayment">确认付款并核销</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.expense-detail__loading { padding: $space-4; }

.expense-detail__context {
  display: flex;
  align-items: center;
  gap: $space-2;
  color: $text-secondary;
  font-size: $font-body-sm;
}

.expense-detail__alert { margin-bottom: $space-4; }

.expense-detail__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-3;
  margin-bottom: $space-5;

  > div {
    min-width: 0;
    padding: $space-3;
    border: 1px solid $border-color;
    border-radius: $radius-sm;
    background: rgba(255, 255, 255, .72);
  }

  span,
  strong,
  small { display: block; }
  span { color: $text-tertiary; font-size: $font-caption; }
  strong { margin-top: 5px; font-size: $font-body-sm; }
  small { margin-top: 4px; color: $text-tertiary; font-size: $font-caption; line-height: 1.45; }
}

.expense-detail__amount {
  color: $text-primary;
  font-size: $font-title;
  font-variant-numeric: tabular-nums;
}

.expense-detail__section {
  padding: $space-4 0;
  border-top: 1px solid $border-color;

  h3 { margin: 0 0 $space-3; font-size: $font-body-sm; }
}

.expense-detail__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
  margin-bottom: $space-3;

  h3 { margin: 0; }
  span { color: $text-tertiary; font-size: $font-caption; }
}

.expense-detail__dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-3;
  margin: 0;

  div { min-width: 0; }
  dt { color: $text-tertiary; font-size: $font-caption; }
  dd { margin: 4px 0 0; color: $text-primary; font-size: $font-body-sm; line-height: 1.55; word-break: break-word; }
}

.expense-detail__wide { grid-column: 1 / -1; }

.expense-detail__description {
  margin: 0;
  color: $text-primary;
  font-size: $font-body-sm;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
}

.expense-detail__attachments {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-2;
}

.expense-detail__payments { display: grid; gap: $space-2; }

.expense-detail__payment {
  display: grid;
  gap: 4px;
  padding: $space-3;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-0;

  small { color: $text-tertiary; font-size: $font-caption; line-height: 1.5; }
}

.expense-detail__payment-head,
.expense-detail__payment-voucher {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
}

.expense-detail__payment-head strong {
  color: $text-primary;
  font-size: $font-body;
  font-variant-numeric: tabular-nums;
}

.expense-detail__payment-head span,
.expense-detail__payment-voucher span {
  color: $text-tertiary;
  font-size: $font-caption;
}

.expense-detail__attachment {
  min-width: 0;
  display: grid;
  gap: 3px;
  padding: $space-3;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  color: $text-primary;
  background: $surface-0;
  text-decoration: none;

  &:hover { border-color: $brand-300; background: $brand-50; }
  strong { overflow: hidden; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
  span { color: $brand-600; font-size: $font-caption; }
  small { color: $text-tertiary; font-size: $font-caption; }
}

.expense-detail__revisions {
  display: grid;
  gap: $space-2;

  > div { display: flex; align-items: center; justify-content: space-between; gap: $space-3; padding: $space-2 $space-3; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; }
  strong { color: $text-primary; font-size: $font-body-sm; }
  span { color: $text-tertiary; font-size: $font-caption; }
  small { grid-column: 1 / -1; color: $text-secondary; font-size: $font-caption; line-height: 1.5; }
}

.expense-detail__muted {
  margin: 0;
  color: $text-tertiary;
  font-size: $font-caption;
  line-height: 1.6;
}

.expense-detail__result h4 { line-height: 1.35; }

@media (max-width: 760px) {
  .expense-detail__facts,
  .expense-detail__dl,
  .expense-detail__attachments { grid-template-columns: 1fr; }
}
</style>
