<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { crmApi } from '@/domains/crm/api'
import type { Customer, CustomerLossReason, CustomerLossStage } from '@/domains/crm/model'

const props = defineProps<{
  modelValue: boolean
  customer?: Partial<Customer> | null
  propertyId?: string
  propertyName?: string
  lossStage?: CustomerLossStage
  mode?: 'mark' | 'restore'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  updated: []
}>()

const STAGE_OPTIONS: Array<{ value: CustomerLossStage; label: string }> = [
  { value: 'FollowUp', label: '待我跟进' },
  { value: 'Measure', label: '待我量房' },
  { value: 'Design', label: '待我设计' },
  { value: 'Negotiation', label: '待我谈单' },
  { value: 'Signing', label: '待我签约' }
]

const REASON_OPTIONS: Array<{ value: CustomerLossReason; label: string }> = [
  { value: 'ChoseOtherCompany', label: '选择了其他装修公司' },
  { value: 'PriceBudgetMismatch', label: '价格或预算不匹配' },
  { value: 'DesignUnsatisfied', label: '设计方案不满意' },
  { value: 'ScheduleMismatch', label: '工期或开工时间不匹配' },
  { value: 'SelfOrRelative', label: '自装或亲友装修' },
  { value: 'ProjectCancelled', label: '装修计划取消' },
  { value: 'ServiceTrust', label: '服务或信任问题' },
  { value: 'Other', label: '其他' }
]

const RESTORE_STATUS_OPTIONS = [
  { value: '', label: '按流失前阶段恢复' },
  { value: 'New', label: '待首联' },
  { value: 'Following', label: '跟进中' },
  { value: 'PendingMeasure', label: '待量房' },
  { value: 'Quoted', label: '方案报价' }
]

const form = reactive({
  scope: 'Customer' as 'Customer' | 'Property',
  stage: '' as CustomerLossStage | '',
  reasonCode: '' as CustomerLossReason | '',
  reasonText: '',
  competitorName: '',
  restoreStatus: '',
  restoreNote: ''
})
const saving = ref(false)
const mode = ref<'mark' | 'restore'>('mark')
const markRequestId = ref('')
const restoreRequestId = ref('')
const isRestore = computed(() => mode.value === 'restore')

const stageLabel = computed(() => STAGE_OPTIONS.find((item) => item.value === (form.stage || inferredStage.value))?.label || '阶段暂不可确认')
const defaultStage = computed<CustomerLossStage>(() => {
  if (props.lossStage) return props.lossStage
  switch (props.customer?.stage) {
    case 'pendingMeasure': return 'Measure'
    case 'quote': return 'Negotiation'
    case 'sign': return 'Signing'
    default: return 'FollowUp'
  }
})
const inferredStage = computed(() => props.customer?.lossStage || defaultStage.value)
const expectedStatus = computed(() => {
  switch (props.customer?.stage) {
    case 'intention': return 'New'
    case 'following': return 'Following'
    case 'pendingMeasure': return 'PendingMeasure'
    case 'quote': return 'Quoted'
    default: return undefined
  }
})

watch(() => props.modelValue, (open) => {
  if (!open) return
  mode.value = props.mode || (props.customer?.stage === 'lost' && props.customer?.lossId ? 'restore' : 'mark')
  markRequestId.value = `web-loss-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  restoreRequestId.value = `web-restore-loss-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  form.scope = props.propertyId ? 'Property' : 'Customer'
  form.stage = defaultStage.value
  form.reasonCode = ''
  form.reasonText = ''
  form.competitorName = ''
  form.restoreStatus = ''
  form.restoreNote = ''
})

function close() {
  emit('update:modelValue', false)
}

async function submit() {
  if (!props.customer?.id) return
  if (!isRestore.value) {
    if (!form.stage) { ElMessage.warning('请选择流失阶段'); return }
    if (!form.reasonCode) { ElMessage.warning('请选择流失原因'); return }
    if (form.reasonCode === 'Other' && !form.reasonText.trim()) { ElMessage.warning('选择“其他”时必须填写说明'); return }
    if (form.scope === 'Property' && !props.propertyId) { ElMessage.warning('本次房屋流失必须指定房屋'); return }
  }
  saving.value = true
  try {
    if (isRestore.value && props.customer.lossId) {
      await crmApi.restoreCustomerLoss(props.customer.lossId, form.restoreStatus || undefined, form.restoreNote, restoreRequestId.value)
      ElMessage.success('客户流失记录已恢复')
    } else {
      await crmApi.markCustomerLoss({
        customerId: props.customer.id,
        propertyId: form.scope === 'Property' ? props.propertyId : undefined,
        scope: form.scope,
        stage: form.stage,
        reasonCode: form.reasonCode,
        reasonText: form.reasonText,
        competitorName: form.competitorName,
        expectedStatus: expectedStatus.value,
        requestId: markRequestId.value
      })
      ElMessage.success('已标记客户流失，客户已退出活跃工作队列')
    }
    close()
    emit('updated')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '客户流失操作失败，请稍后重试')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    :title="isRestore ? '恢复客户' : '标记客户流失'"
    size="520px"
    direction="rtl"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <section class="cld__summary">
      <strong>{{ customer?.name || '客户待确认' }}</strong>
      <span v-if="propertyName">{{ propertyName }}</span>
      <span v-if="isRestore && customer?.lossStage">流失于 {{ STAGE_OPTIONS.find((item) => item.value === customer?.lossStage)?.label }}</span>
    </section>

    <template v-if="isRestore">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="恢复后重新参与客户风险与工作台待办"
        description="系统会保留原流失记录；若客户仍有其他房屋处于流失状态，客户整体仍保持已流失。"
      />
      <el-form label-position="top" class="cld__form">
        <el-form-item label="恢复后的客户阶段">
          <el-select v-model="form.restoreStatus" style="width: 100%">
            <el-option v-for="item in RESTORE_STATUS_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="恢复说明">
          <el-input v-model="form.restoreNote" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="例如：客户重新联系，希望继续设计方案沟通" />
        </el-form-item>
      </el-form>
    </template>

    <template v-else>
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        title="标记后立即退出待跟进、量房、设计、谈单和签约队列"
        description="量房、设计、报价、合同等历史事实会完整保留；客户可在“已流失”中查询。"
      />
      <el-form label-position="top" class="cld__form">
        <el-form-item v-if="propertyId" label="流失范围" required>
          <el-radio-group v-model="form.scope">
            <el-radio value="Property">本次房屋</el-radio>
            <el-radio value="Customer">客户全部装修意向</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="流失阶段" required>
          <el-select v-model="form.stage" style="width: 100%">
            <el-option v-for="item in STAGE_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="流失原因" required>
          <el-select v-model="form.reasonCode" placeholder="请选择客户流失原因" style="width: 100%">
            <el-option v-for="item in REASON_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="竞争对手名称">
          <el-input v-model="form.competitorName" maxlength="100" placeholder="选填；客户不愿透露时不要填写" />
        </el-form-item>
        <el-form-item :label="form.reasonCode === 'Other' ? '补充说明（必填）' : '补充说明'">
          <el-input v-model="form.reasonText" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="记录客户原话或明确决策，不写推测" />
        </el-form-item>
      </el-form>
    </template>

    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">
        {{ isRestore ? '确认恢复' : `确认标记为流失（${stageLabel}）` }}
      </el-button>
    </template>
  </el-drawer>
</template>

<style scoped lang="scss">
.cld__summary { display: flex; flex-direction: column; gap: 5px; margin-bottom: $space-4; padding: $space-3; border-radius: $radius-md; background: $surface-50; }
.cld__summary strong { color: $text-primary; }
.cld__summary span { color: $text-tertiary; font-size: $font-caption; }
.cld__form { margin-top: $space-4; }
</style>
