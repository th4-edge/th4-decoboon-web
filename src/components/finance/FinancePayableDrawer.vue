<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import type { Payable, PayableType } from '@/domains/finance/model'
import { PAYABLE_TYPE_META } from '@/domains/finance/meta'
import { formatAmountPreview, toInputDate } from '@/domains/finance/format'
import ProjectPicker from '@/components/picker/ProjectPicker.vue'
import FinanceDocumentLayout from '@/components/finance/FinanceDocumentLayout.vue'
import StatusTag from '@/components/StatusTag.vue'
import type { StatusTone } from '@/core/tone'

const props = withDefaults(defineProps<{
  visible: boolean
  projectId?: string
  item?: Payable | null
  defaultType?: PayableType
}>(), { projectId: '', item: null, defaultType: 'other' })

const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: []
}>()

const saving = ref(false)
const error = ref('')
const selectedProjectName = ref('')
const form = reactive({
  projectId: '',
  name: '',
  type: 'other' as PayableType,
  payeeName: '',
  period: '',
  amount: '',
  dueDate: toInputDate(),
  urgent: false,
  sourceNo: '',
  remark: ''
})

const title = computed(() => props.item ? '编辑应付单' : '新增手工应付')
const allTypeOptions = (Object.entries(PAYABLE_TYPE_META) as Array<[PayableType, { label: string; tone: string }]>)
  .map(([value, meta]) => ({ value, label: meta.label, tone: meta.tone }))
const typeOptions = computed(() => props.item
  ? allTypeOptions.filter((option) => option.value === form.type)
  : allTypeOptions)
const typeMeta = computed(() => PAYABLE_TYPE_META[form.type])
const typeTone = computed(() => typeMeta.value.tone as StatusTone)

watch(() => props.visible, (visible) => {
  if (!visible) return
  error.value = ''
  if (props.item) {
    form.projectId = props.item.project?.id ?? props.projectId
    form.name = props.item.name
    form.type = props.item.type
    form.payeeName = props.item.payeeName ?? props.item.payeeEmployee?.name ?? ''
    form.period = props.item.period ?? ''
    form.amount = String(props.item.amount)
    form.dueDate = props.item.dueDate || toInputDate()
    form.urgent = props.item.urgent
    form.sourceNo = props.item.sourceNo ?? ''
    form.remark = props.item.remark ?? ''
  } else {
    form.projectId = props.projectId
    form.name = ''
    form.type = props.defaultType
    form.payeeName = ''
    form.period = ''
    form.amount = ''
    form.dueDate = toInputDate()
    form.urgent = false
    form.sourceNo = ''
    form.remark = ''
  }
}, { immediate: true })

function onProjectChange(option: { label?: string } | null): void {
  selectedProjectName.value = option?.label ?? ''
}

async function submit(): Promise<void> {
  const amount = Number(form.amount)
  if (!form.name.trim()) {
    error.value = '请填写应付名称'
    return
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    error.value = '应付金额必须大于 0'
    return
  }
  saving.value = true
  error.value = ''
  try {
    if (props.item) {
      await financeApi.updatePayable({
        id: props.item.id,
        name: form.name.trim(),
        amount,
        dueDate: form.dueDate,
        urgent: form.urgent,
        period: form.period.trim() || undefined,
        remark: form.remark.trim() || undefined
      })
    } else {
      await financeApi.savePayable({
        projectId: form.projectId || undefined,
        name: form.name.trim(),
        type: form.type,
        payeeName: form.payeeName.trim() || undefined,
        period: form.period.trim() || undefined,
        amount,
        dueDate: form.dueDate,
        urgent: form.urgent,
        sourceNo: form.sourceNo.trim() || undefined,
        remark: form.remark.trim() || undefined
      })
    }
    ElMessage.success(props.item ? '应付单已更新' : '应付单已创建')
    emit('saved')
    emit('update:visible', false)
  } catch (submitError) {
    error.value = submitError instanceof ProviderError ? submitError.message : '保存失败，暂不可确认'
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
    <FinanceDocumentLayout document-label="应付单" :document-title="form.name || '待填写应付名称'">
      <template #context>
        <div class="finance-document__context">
          <ProjectPicker v-model="form.projectId" placeholder="选择所属项目" :disabled="Boolean(item)" clearable @change="onProjectChange" />
        </div>
      </template>
      <template #head-extra>
        <StatusTag :tone="typeTone" :text="typeMeta.label" />
      </template>

      <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
      <el-form label-position="top" class="finance-form-grid" @submit.prevent>
        <el-form-item label="应付类型">
          <el-select v-model="form.type" :disabled="Boolean(item)" style="width: 100%">
            <el-option v-for="option in typeOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="应付名称" class="finance-form-grid__wide">
          <el-input v-model="form.name" maxlength="80" placeholder="如 瓷砖到货款、泥工阶段工资" />
        </el-form-item>
        <el-form-item label="收款方">
          <el-input v-model="form.payeeName" maxlength="80" placeholder="供应商、班组或个人" />
        </el-form-item>
        <el-form-item label="账期/期间">
          <el-input v-model="form.period" maxlength="40" placeholder="如 2026-10 或 月结 30 天" />
        </el-form-item>
        <el-form-item label="应付金额">
          <el-input v-model="form.amount" inputmode="decimal" placeholder="0.00">
            <template #prepend>¥</template>
          </el-input>
        </el-form-item>
        <el-form-item label="到期日">
          <el-date-picker v-model="form.dueDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="紧急付款">
          <el-switch v-model="form.urgent" active-text="标记紧急" />
        </el-form-item>
        <el-form-item label="来源说明">
          <el-input v-model="form.sourceNo" maxlength="80" placeholder="采购、工资或其他来源说明" />
        </el-form-item>
        <el-form-item label="备注" class="finance-form-grid__wide">
          <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="300" show-word-limit />
        </el-form-item>
      </el-form>

      <template #aside>
        <div class="finance-document__result">
          <span>提交结果</span>
          <h4>待付款</h4>
          <dl>
            <div><dt>应付类型</dt><dd>{{ typeMeta.label }}</dd></div>
            <div><dt>收款方</dt><dd>{{ form.payeeName || '待填写' }}</dd></div>
            <div><dt>应付金额</dt><dd>{{ formatAmountPreview(form.amount) }}</dd></div>
            <div><dt>到期日</dt><dd>{{ form.dueDate || '待填写' }}</dd></div>
            <div><dt>来源说明</dt><dd>{{ form.sourceNo || '无来源单' }}</dd></div>
          </dl>
          <p>保存后形成统一付款义务；后续付款时保存后自动核销，不在此处直接改变资金账户。</p>
        </div>
      </template>
    </FinanceDocumentLayout>
    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">保存应付单</el-button>
    </template>
  </el-drawer>
</template>
