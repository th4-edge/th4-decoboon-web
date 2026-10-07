<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import { ACCOUNT_LABEL, LEDGER_PURPOSE_META } from '@/domains/finance/meta'
import type { FundAccount, Ledger, LedgerCategory, LedgerDirection, LedgerManualPurpose } from '@/domains/finance/model'
import { formatAmountPreview, toInputDate } from '@/domains/finance/format'
import ProjectPicker from '@/components/picker/ProjectPicker.vue'
import LedgerCategoryPicker from '@/components/picker/LedgerCategoryPicker.vue'
import FinanceDocumentLayout from '@/components/finance/FinanceDocumentLayout.vue'

const props = withDefaults(defineProps<{
  visible: boolean
  projectId?: string
  item?: Ledger | null
}>(), { projectId: '', item: null })

const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: []
}>()

const saving = ref(false)
const error = ref('')
const selectedProjectName = ref('')
const selectedCategoryDescription = ref('')
const form = reactive({
  projectId: '',
  direction: 'expense' as LedgerDirection,
  purpose: 'projectIncidentalCost' as LedgerManualPurpose,
  category: '',
  categoryId: '',
  amount: '',
  account: 'companyBank' as FundAccount,
  occurredAt: toInputDate(),
  counterparty: '',
  summary: '',
  remark: '',
  reason: ''
})

const title = computed(() => props.item ? '更正手工记账' : '手工记账')
const accountOptions = (Object.entries(ACCOUNT_LABEL) as Array<[FundAccount, string]>)
  .map(([value, label]) => ({ value, label }))
const purposeOptions = (Object.entries(LEDGER_PURPOSE_META) as Array<[LedgerManualPurpose, { label: string; hint: string; directions: LedgerDirection[]; tone: string }]>)
  .map(([value, meta]) => ({ value, label: meta.label, hint: meta.hint, directions: meta.directions, tone: meta.tone }))
const allowedDirections = computed(() => LEDGER_PURPOSE_META[form.purpose].directions)

watch(() => props.visible, (visible) => {
  if (!visible) return
  error.value = ''
  if (props.item) {
    form.projectId = props.item.project?.id ?? props.projectId
    form.direction = props.item.direction
    form.purpose = props.item.purpose ?? 'other'
    form.category = props.item.category
    form.categoryId = props.item.categoryNode?.id ?? ''
    form.amount = String(props.item.amount)
    form.account = props.item.account
    form.occurredAt = props.item.occurredAt || toInputDate()
    form.counterparty = props.item.counterparty ?? ''
    form.summary = props.item.summary
    form.remark = props.item.remark ?? ''
    form.reason = ''
  } else {
    form.projectId = props.projectId
    form.direction = 'expense'
    form.purpose = 'projectIncidentalCost'
    form.category = ''
    form.categoryId = ''
    form.amount = ''
    form.account = 'companyBank'
    form.occurredAt = toInputDate()
    form.counterparty = ''
    form.summary = ''
    form.remark = ''
    form.reason = ''
  }
  void boot()
}, { immediate: true })

watch(() => form.purpose, (purpose) => {
  if (props.item && form.categoryId && purpose === props.item.purpose) return
  const directions = LEDGER_PURPOSE_META[purpose].directions
  if (!directions.includes(form.direction)) form.direction = directions[0]
  form.categoryId = ''
  form.category = ''
})


watch(() => form.direction, () => {
  form.categoryId = ''
  form.category = ''
})

async function boot(): Promise<void> {
  try {
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '记账基础数据暂不可确认'
  }
}

function onProjectChange(option: { label?: string } | null): void {
  selectedProjectName.value = option?.label ?? ''
}

function onCategoryChange(selection: { category: LedgerCategory; path: string } | null): void {
  form.categoryId = selection?.category.id ?? ''
  form.category = selection?.category.name ?? ''
  selectedCategoryDescription.value = selection?.category.description ?? ''
}

async function submit(): Promise<void> {
  const amount = Number(form.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    error.value = '金额必须大于 0'
    return
  }
  if (!form.categoryId || !form.category.trim()) {
    error.value = '请选择账务分类'
    return
  }
  if (!form.summary.trim()) {
    error.value = '请填写摘要'
    return
  }
  if (props.item && !form.reason.trim()) {
    error.value = '更正必须填写原因'
    return
  }
  saving.value = true
  error.value = ''
  const payload = {
    projectId: form.projectId || undefined,
    direction: form.direction,
    purpose: form.purpose,
    category: form.category.trim(),
    categoryId: form.categoryId || undefined,
    amount,
    account: form.account,
    occurredAt: form.occurredAt,
    counterparty: form.counterparty.trim() || undefined,
    summary: form.summary.trim(),
    remark: form.remark.trim() || undefined
  }
  try {
    if (props.item) {
      await financeApi.correctLedger({
        ledgerId: props.item.id,
        ...payload,
        reason: form.reason.trim()
      })
    } else {
      await financeApi.saveLedger(payload)
    }
    ElMessage.success(props.item ? '手工流水已冲正重记' : '手工流水已保存')
    emit('saved')
    emit('update:visible', false)
  } catch (submitError) {
    error.value = submitError instanceof ProviderError ? submitError.message : '记账失败，暂不可确认'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-drawer
    :model-value="visible"
    :title="title"
    size="min(1040px, 96vw)"
    destroy-on-close
    @update:model-value="emit('update:visible', $event)"
  >
    <FinanceDocumentLayout document-label="手工记账单" :document-title="form.summary || '待填写记账摘要'">
      <template #context>
        <div class="finance-document__context">
          <ProjectPicker v-model="form.projectId" placeholder="选择关联项目（可选）" clearable @change="onProjectChange" />
        </div>
      </template>

      <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
      <el-form label-position="top" class="finance-form-grid" @submit.prevent>
        <el-form-item label="用途">
          <el-select v-model="form.purpose" style="width: 100%">
            <el-option v-for="option in purposeOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="方向">
          <el-radio-group v-model="form.direction">
            <el-radio-button v-for="direction in allowedDirections" :key="direction" :value="direction">
              {{ direction === 'income' ? '收入' : '支出' }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="账务分类">
          <LedgerCategoryPicker v-model="form.categoryId" :direction="form.direction" @change="onCategoryChange" />
          <p v-if="selectedCategoryDescription" style="margin: 6px 0 0; color: #7a7a72; font-size: 12px; line-height: 1.5">{{ selectedCategoryDescription }}</p>
        </el-form-item>
        <el-form-item label="金额">
          <el-input v-model="form.amount" inputmode="decimal" placeholder="0.00">
            <template #prepend>¥</template>
          </el-input>
        </el-form-item>
        <el-form-item label="资金账户">
          <el-select v-model="form.account" style="width: 100%">
            <el-option v-for="option in accountOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="发生日期">
          <el-date-picker v-model="form.occurredAt" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="对方">
          <el-input v-model="form.counterparty" maxlength="80" placeholder="客户、供应商、员工或其他" />
        </el-form-item>
        <el-form-item label="摘要" class="finance-form-grid__wide">
          <el-input v-model="form.summary" maxlength="120" placeholder="清晰说明资金事实" />
        </el-form-item>
        <el-form-item label="备注" class="finance-form-grid__wide">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="300" show-word-limit />
        </el-form-item>
        <el-form-item v-if="item" label="更正原因" class="finance-form-grid__wide">
          <el-input v-model="form.reason" type="textarea" :rows="2" maxlength="200" placeholder="更正会冲正原流水并重记，必须留痕" />
        </el-form-item>
      </el-form>

      <template #aside>
        <div class="finance-document__result">
          <span>提交结果</span>
          <h4>写入资金台账</h4>
          <dl>
            <div><dt>方向</dt><dd>{{ form.direction === 'income' ? '收入' : '支出' }}</dd></div>
            <div><dt>用途</dt><dd>{{ LEDGER_PURPOSE_META[form.purpose].label }}</dd></div>
            <div><dt>账务分类</dt><dd>{{ form.category || '未选择' }}</dd></div>
            <div><dt>金额</dt><dd>{{ formatAmountPreview(form.amount) }}</dd></div>
            <div><dt>发生日期</dt><dd>{{ form.occurredAt || '待填写' }}</dd></div>
          </dl>
          <p>手工记账只用于无来源单据的事实；更正会由服务端冲正原流水并重记，保留完整留痕。</p>
        </div>
      </template>
    </FinanceDocumentLayout>
    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">{{ item ? '确认更正' : '保存手工流水' }}</el-button>
    </template>
  </el-drawer>
</template>
