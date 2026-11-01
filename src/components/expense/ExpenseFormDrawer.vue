<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ProviderError } from '@/core/http'
import { formatEditableNumber, todayLocalDate } from '@/core/format'
import { expenseApi } from '@/domains/expense/api'
import {
  EXPENSE_DOCUMENT_TYPE_META,
  EXPENSE_PAYMENT_MODE_META
} from '@/domains/expense/meta'
import type {
  Expense,
  ExpenseCategory,
  ExpenseDocumentType,
  ExpensePaymentMode,
  ExpenseSaveInput,
  ExpenseUpdateInput
} from '@/domains/expense/model'
import { fileApi } from '@/domains/file/api'
import type { UploadedFile } from '@/domains/file/model'
import { useSessionStore } from '@/stores/session'
import { useFinanceScopeStore } from '@/stores/financeScope'
import FinanceDocumentLayout from '@/components/finance/FinanceDocumentLayout.vue'
import FileUploadField from '@/components/form/FileUploadField.vue'
import EmployeePicker from '@/components/picker/EmployeePicker.vue'
import ProjectPicker from '@/components/picker/ProjectPicker.vue'

const props = defineProps<{
  visible: boolean
  item?: Expense | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: [value: Expense]
}>()

const session = useSessionStore()
const scope = useFinanceScopeStore()
const categories = ref<ExpenseCategory[]>([])
const categoriesLoading = ref(false)
const categoriesError = ref('')
const saving = ref(false)
const error = ref('')
const attachmentTypes = reactive<Record<string, ExpenseDocumentType>>({})
const form = reactive({
  paymentMode: 'Reimbursement' as ExpensePaymentMode,
  projectScope: 'enterprise' as 'enterprise' | 'project',
  projectId: '',
  categoryId: '',
  amount: '',
  expenseDate: todayLocalDate(),
  description: '',
  ownerId: '',
  attachments: [] as UploadedFile[],
  evidenceType: 'Invoice' as ExpenseDocumentType,
  idempotencyKey: createIdempotencyKey(),
  storeId: '',
  storeScope: 'current' as 'current' | 'unassigned'
})

const categoryOptions = computed(() => categories.value.filter((item) => item.active))
const canAssignOwner = computed(() => session.role === 'Boss' || session.role === 'StoreManager')
const canUseUnassignedStore = computed(() => session.dataScope === 'Company'
  && (session.role === 'Boss' || session.role === 'Finance'))
const lockedAfterSubmission = computed(() => Boolean(props.item && !['Draft', 'Returned'].includes(props.item.status)))
const title = computed(() => props.item ? '编辑费用单' : '新建费用单')
const paymentModeMeta = computed(() => EXPENSE_PAYMENT_MODE_META[form.paymentMode])
const ownerText = computed(() => {
  if (form.ownerId) {
    return canAssignOwner.value ? '已选择归属员工' : session.displayName
  }
  return `本人 · ${session.displayName}`
})
const selectedCategory = computed(() => categoryOptions.value.find((item) => item.id === form.categoryId))
const storeName = computed(() => session.store?.name || '当前员工所属门店')
const effectiveStoreName = computed(() => form.storeScope === 'unassigned'
  ? '未归属门店'
  : storeName.value)
const projectContextId = computed(() => form.projectScope === 'project' ? form.projectId : '')

watch(() => props.visible, (visible) => {
  if (visible) {
    resetForm()
    void loadCategories()
  }
})

function createIdempotencyKey(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  return uuid ? `expense-${uuid}` : `expense-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

function resetForm(): void {
  error.value = ''
  saving.value = false
  form.paymentMode = props.item?.paymentMode ?? 'Reimbursement'
  form.projectScope = props.item?.project ? 'project' : 'enterprise'
  form.projectId = props.item?.project?.id ?? ''
  form.categoryId = props.item?.category?.id ?? ''
  form.amount = props.item ? formatEditableNumber(props.item.amount, 2) : ''
  form.expenseDate = props.item?.expenseDate || todayLocalDate()
  form.description = props.item?.description ?? ''
  form.ownerId = canAssignOwner.value && props.item?.owner?.id !== session.employee?.empId
    ? props.item?.owner?.id ?? ''
    : ''
  form.attachments = (props.item?.attachments ?? []).map((attachment) => ({
    path: fileApi.storagePath(attachment.fileUrl) || attachment.fileUrl,
    url: attachment.url || fileApi.absolute(attachment.fileUrl),
    name: attachment.fileName || attachment.fileUrl.split('/').pop() || '证据附件',
    size: attachment.size
  }))
  form.evidenceType = props.item?.attachments?.[0]?.documentType ?? 'Invoice'
  form.idempotencyKey = createIdempotencyKey()
  form.storeId = scope.requestStoreId ?? session.store?.storeId ?? ''
  form.storeScope = canUseUnassignedStore.value && props.item && !props.item.store ? 'unassigned' : 'current'
  for (const key of Object.keys(attachmentTypes)) delete attachmentTypes[key]
  for (const attachment of props.item?.attachments ?? []) {
    const path = fileApi.storagePath(attachment.fileUrl) || attachment.fileUrl
    attachmentTypes[path] = attachment.documentType
  }
}

async function loadCategories(): Promise<void> {
  categoriesLoading.value = true
  categoriesError.value = ''
  try {
    categories.value = await expenseApi.categories()
    if (!form.categoryId && categories.value.length === 1) form.categoryId = categories.value[0].id
  } catch (loadError) {
    categories.value = []
    categoriesError.value = loadError instanceof ProviderError ? loadError.message : '费用分类暂不可确认'
  } finally {
    categoriesLoading.value = false
  }
}

function changePaymentMode(value: ExpensePaymentMode): void {
  form.paymentMode = value
  if (value === 'Direct') form.ownerId = canAssignOwner.value ? form.ownerId : ''
}

function changeProjectScope(value: 'enterprise' | 'project'): void {
  form.projectScope = value
  if (value === 'enterprise') {
    form.projectId = ''
    clearEvidence('费用归属已切换为企业费用，请重新确认证据附件')
  }
}

function onProjectChange(): void {
  if (!form.projectId) form.projectScope = 'enterprise'
  clearEvidence('项目归属已变化，请重新确认证据附件')
}

function clearEvidence(message: string): void {
  if (!form.attachments.length) return
  form.attachments = []
  for (const key of Object.keys(attachmentTypes)) delete attachmentTypes[key]
  ElMessage.warning(message)
}

function onFilesChange(files: UploadedFile[]): void {
  for (const file of files) {
    if (!attachmentTypes[file.path]) attachmentTypes[file.path] = form.evidenceType
  }
  form.attachments = files
}

function validate(submit: boolean): string {
  if (form.projectScope === 'project' && !form.projectId) return '请选择项目，或切换为企业费用'
  if (!form.categoryId) return '请选择费用分类'
  const amount = Number(form.amount)
  if (!Number.isFinite(amount) || amount <= 0) return '费用金额必须大于 0'
  if (!form.expenseDate) return '请选择费用发生日期'
  if (!form.description.trim()) return '请填写费用说明'
  if (submit && !form.attachments.length) return '提交前至少上传一份证据附件'
  return ''
}

function payloadBase() {
  const amount = Number(form.amount)
  const employeeId = canAssignOwner.value && form.ownerId ? form.ownerId : undefined
  const payeeEmployeeId = form.paymentMode === 'Reimbursement' && employeeId ? employeeId : undefined
  return {
    paymentMode: form.paymentMode,
    amount,
    expenseDate: form.expenseDate,
    description: form.description.trim(),
    categoryId: form.categoryId,
    projectId: form.projectScope === 'project' ? form.projectId : '0',
    // 项目费用始终以项目门店为准；企业费用才允许显式提交未归属门店哨兵 0。
    storeId: form.projectScope === 'project'
      ? undefined
      : form.storeScope === 'unassigned' && canUseUnassignedStore.value
        ? '0'
        : form.storeId || undefined,
    employeeId,
    payeeEmployeeId,
    attachments: form.attachments.map((file) => ({
      documentType: attachmentTypes[file.path] ?? form.evidenceType,
      fileUrl: file.path || file.url,
      fileName: file.name,
      size: file.size
    }))
  }
}

async function submit(submitAfterSave: boolean): Promise<void> {
  const validation = validate(submitAfterSave)
  if (validation) {
    error.value = validation
    return
  }
  saving.value = true
  error.value = ''
  let created: Expense | null = null
  try {
    if (props.item) {
      const payload: ExpenseUpdateInput = {
        expenseId: props.item.id,
        ...payloadBase(),
        status: submitAfterSave ? 'Submitted' : undefined
      }
      await expenseApi.update(payload)
      const detail = await expenseApi.info(props.item.id)
      ElMessage.success(submitAfterSave ? '费用已重新提交' : '费用草稿已保存')
      emit('saved', detail)
      emit('update:visible', false)
      return
    }

    const payload: ExpenseSaveInput = {
      ...payloadBase(),
      idempotencyKey: form.idempotencyKey
    }
    created = await expenseApi.save(payload)
    if (submitAfterSave) await expenseApi.update({ expenseId: created.id, status: 'Submitted' })
    const detail = await expenseApi.info(created.id)
    ElMessage.success(submitAfterSave ? '费用已提交审批' : '费用草稿已保存')
    emit('saved', detail)
    emit('update:visible', false)
  } catch (submitError) {
    if (created && submitAfterSave) {
      const detail = await expenseApi.info(created.id).catch(() => created as Expense)
      emit('saved', detail)
      ElMessage.warning('草稿已保存，但提交暂不可确认；请在列表中重新提交')
      emit('update:visible', false)
      return
    }
    error.value = submitError instanceof ProviderError ? submitError.message : '费用保存暂不可确认'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-drawer
    :model-value="visible"
    :title="title"
    size="min(1080px, 96vw)"
    destroy-on-close
    @update:model-value="emit('update:visible', $event)"
  >
    <FinanceDocumentLayout
      document-label="费用报销单"
      :document-title="form.description.trim() || '待填写费用说明'"
    >
      <template #context>
        <div class="expense-form__context">
          <span>归属门店</span>
          <strong>{{ form.projectScope === 'project' ? '项目门店为准' : effectiveStoreName }}</strong>
        </div>
      </template>

      <template #head-extra>
        <span class="expense-form__mode">{{ paymentModeMeta.label }}</span>
      </template>

      <el-alert
        v-if="item?.status === 'Returned'"
        class="expense-form__alert"
        type="warning"
        :closable="false"
        title="该费用已被退回，请按退回原因补齐后重新提交"
        :description="item.approvalNote || '退回原因暂不可确认，请先刷新详情'"
        show-icon
      />
      <el-alert v-if="error" class="expense-form__alert" type="error" :closable="false" :title="error" show-icon />
      <el-alert
        v-if="categoriesError"
        class="expense-form__alert"
        type="error"
        :closable="false"
        title="费用分类暂不可确认"
        :description="categoriesError"
        show-icon
      />

      <el-form label-position="top" class="finance-form-grid" @submit.prevent>
        <el-form-item label="费用支付方式" class="finance-form-grid__wide">
          <el-radio-group :model-value="form.paymentMode" :disabled="lockedAfterSubmission" @change="changePaymentMode($event as ExpensePaymentMode)">
            <el-radio-button value="Direct">企业直付</el-radio-button>
            <el-radio-button value="Reimbursement">员工报销</el-radio-button>
          </el-radio-group>
          <p class="expense-form__hint">
            {{ paymentModeMeta.hint }}
            <template v-if="lockedAfterSubmission">提交后支付方式不可修改。</template>
          </p>
        </el-form-item>

        <el-form-item label="费用归属" class="finance-form-grid__wide">
          <el-radio-group :model-value="form.projectScope" :disabled="lockedAfterSubmission" @change="changeProjectScope($event as 'enterprise' | 'project')">
            <el-radio-button value="enterprise">企业费用</el-radio-button>
            <el-radio-button value="project">项目费用</el-radio-button>
          </el-radio-group>
          <div v-if="form.projectScope === 'project'" class="expense-form__project">
            <ProjectPicker v-model="form.projectId" placeholder="选择费用所属项目" clearable :disabled="lockedAfterSubmission" @change="onProjectChange" />
            <p class="expense-form__hint">项目费用只进入对应项目成本；提交后项目/企业归属不可修改。</p>
          </div>
          <p v-else class="expense-form__hint">企业费用不进入任何项目成本。</p>
        </el-form-item>

        <el-form-item v-if="form.projectScope === 'enterprise'" label="归属门店" class="finance-form-grid__wide">
          <el-radio-group v-if="canUseUnassignedStore" v-model="form.storeScope">
            <el-radio-button v-if="form.storeId" value="current">{{ storeName }}</el-radio-button>
            <el-radio-button value="unassigned">未归属门店（仅企业负责人/总部财务）</el-radio-button>
          </el-radio-group>
          <div v-else class="expense-form__readonly">{{ storeName }}</div>
          <p class="expense-form__hint">
            {{ form.storeScope === 'unassigned'
              ? '该企业费用不归属具体门店；普通员工、店长和门店财务不能使用此选项。'
              : '企业费用将以当前门店作为归属；项目费用忽略此选择并以项目门店为准。' }}
          </p>
        </el-form-item>

        <el-form-item label="费用分类" required>
          <el-select v-model="form.categoryId" :loading="categoriesLoading" placeholder="选择费用分类" style="width: 100%">
            <el-option v-for="category in categoryOptions" :key="category.id" :label="category.name" :value="category.id">
              <span>{{ category.name }}</span>
              <small class="expense-form__option-note">{{ category.description || '企业费用分类' }}</small>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="金额" required>
          <el-input v-model="form.amount" inputmode="decimal" placeholder="0.00">
            <template #prepend>¥</template>
          </el-input>
        </el-form-item>
        <el-form-item label="费用发生日期" required>
          <el-date-picker v-model="form.expenseDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="费用归属员工" :required="form.paymentMode === 'Reimbursement'">
          <EmployeePicker
            v-if="canAssignOwner"
            v-model="form.ownerId"
            source="payroll"
            :store-id="form.storeId"
            placeholder="默认为本人；负责人/店长可代选"
            clearable
          />
          <div v-else class="expense-form__readonly">{{ ownerText }}</div>
          <p class="expense-form__hint">
            {{ form.paymentMode === 'Reimbursement'
              ? '报销收款员工必须等于费用归属员工，不能代他人收款。'
              : '企业直付默认由当前门店承担；负责人/店长可指定本企业归属员工。' }}
          </p>
        </el-form-item>

        <el-form-item label="费用说明" class="finance-form-grid__wide" required>
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            maxlength="5000"
            show-word-limit
            placeholder="说明为什么发生、用于什么事项，以及可核对的业务事实"
          />
        </el-form-item>

        <el-form-item label="证据附件" class="finance-form-grid__wide" :required="true">
          <div class="expense-form__evidence">
            <el-select v-model="form.evidenceType" style="width: 180px">
              <el-option
                v-for="(meta, value) in EXPENSE_DOCUMENT_TYPE_META"
                :key="value"
                :label="meta.label"
                :value="value"
              />
            </el-select>
            <FileUploadField
              v-model="form.attachments"
              business-type="Expense"
              :project-id="projectContextId"
              accept="image/*,.pdf"
              :max="9"
              label="费用证据"
              hint="发票、收据、支付截图或其他说明；附件仅作证据，不做发票查验或抵扣"
              @update:model-value="onFilesChange"
              @error="error = $event"
            />
          </div>
        </el-form-item>
      </el-form>

      <template #aside>
        <div class="finance-document__result expense-form__result">
          <span>提交结果</span>
          <h4>{{ paymentModeMeta.label }} · {{ form.projectScope === 'project' ? '项目费用' : '企业费用' }}</h4>
          <dl>
            <div><dt>费用分类</dt><dd>{{ selectedCategory?.name || '待选择' }}</dd></div>
            <div><dt>金额</dt><dd>{{ form.amount ? `¥${form.amount}` : '待填写' }}</dd></div>
            <div><dt>发生日期</dt><dd>{{ form.expenseDate || '待填写' }}</dd></div>
            <div><dt>归属员工</dt><dd>{{ ownerText }}</dd></div>
            <div><dt>归属门店</dt><dd>{{ form.projectScope === 'project' ? '项目门店为准' : effectiveStoreName }}</dd></div>
            <div><dt>证据附件</dt><dd>{{ form.attachments.length ? `${form.attachments.length} 份` : '提交前至少 1 份' }}</dd></div>
          </dl>
          <p>保存草稿不形成审批事实；提交后由企业负责人或店长审批。本页不生成应付、付款、流水或凭证。</p>
        </div>
      </template>
    </FinanceDocumentLayout>

    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button :loading="saving" @click="submit(false)">{{ item ? '保存修改' : '仅存草稿' }}</el-button>
      <el-button type="primary" :loading="saving" @click="submit(true)">
        {{ item?.status === 'Returned' ? '修改并重新提交' : '保存并提交' }}
      </el-button>
    </template>
  </el-drawer>
</template>

<style scoped lang="scss">
.expense-form__context {
  display: flex;
  align-items: center;
  gap: $space-2;
  min-width: 0;

  span { color: $text-tertiary; font-size: $font-caption; }
  strong { color: $text-primary; font-size: $font-body-sm; }
}

.expense-form__mode {
  padding: 4px 10px;
  border: 1px solid $brand-100;
  border-radius: $radius-pill;
  background: $brand-50;
  color: $brand-600;
  font-size: $font-caption;
}

.expense-form__alert { margin-bottom: $space-3; }

.expense-form__hint {
  margin: 6px 0 0;
  color: $text-tertiary;
  font-size: $font-caption;
  line-height: 1.55;
}

.expense-form__project { width: 100%; margin-top: $space-3; }

.expense-form__readonly {
  min-height: 34px;
  width: 100%;
  display: flex;
  align-items: center;
  padding: 0 $space-3;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-100;
  color: $text-secondary;
  font-size: $font-body-sm;
}

.expense-form__evidence {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: $space-3;
}

.expense-form__option-note {
  float: right;
  margin-left: $space-4;
  color: $text-tertiary;
  font-size: $font-caption;
}

.expense-form__result h4 { line-height: 1.35; }
</style>
