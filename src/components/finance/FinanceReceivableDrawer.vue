<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ProviderError } from '@/core/http'
import { formatMoney } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import type { FinanceProjectReport, Receivable, ReceivableType } from '@/domains/finance/model'
import { toInputDate } from '@/domains/finance/format'
import ProjectPicker from '@/components/picker/ProjectPicker.vue'

const props = withDefaults(defineProps<{
  visible: boolean
  projectId?: string
  item?: Receivable | null
}>(), { projectId: '', item: null })

const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: []
}>()

const saving = ref(false)
const error = ref('')
const selectedProjectName = ref('')
const projectContext = ref<FinanceProjectReport | null>(null)
const contextLoading = ref(false)
const contextError = ref('')
let contextSeq = 0
const form = reactive({
  projectId: '',
  name: '',
  stageName: '',
  type: 'other' as ReceivableType,
  amount: '',
  dueDate: toInputDate(),
  invoiceRequired: false,
  invoiceNo: '',
  remark: ''
})

const title = computed(() => props.item ? '编辑应收节点' : '新增其他应收')
const allTypeOptions: Array<{ label: string; value: ReceivableType; tone: string; description: string }> = [
  { label: '首期款', value: 'first', tone: 'brand', description: '签约或开工阶段收取' },
  { label: '进度款', value: 'progress', tone: 'success', description: '施工节点完成后收取' },
  { label: '尾款', value: 'final', tone: 'warning', description: '竣工或交付前收取' },
  { label: '质保金', value: 'retention', tone: 'neutral', description: '质保期后释放' },
  { label: '其他应收', value: 'other', tone: 'neutral', description: '合同外或补充应收' }
]
const typeOptions = computed(() => props.item
  ? allTypeOptions.filter((option) => option.value === form.type)
  : allTypeOptions.filter((option) => option.value === 'other'))
const selectedTypeLabel = computed(() => typeOptions.value.find((option) => option.value === form.type)?.label || '应收类型')

watch(() => props.visible, (visible) => {
  if (!visible) return
  error.value = ''
  contextError.value = ''
  if (props.item) {
    form.projectId = props.item.project.id || props.projectId
    form.name = props.item.name
    form.stageName = props.item.stageName ?? ''
    form.type = props.item.type
    form.amount = String(props.item.amount)
    form.dueDate = props.item.dueDate || toInputDate()
    form.invoiceRequired = props.item.invoiceRequired
    form.invoiceNo = props.item.invoiceNo ?? ''
    form.remark = props.item.remark ?? ''
  } else {
    form.projectId = props.projectId
    form.name = ''
    form.stageName = ''
    form.type = 'other'
    form.amount = ''
    form.dueDate = toInputDate()
    form.invoiceRequired = false
    form.invoiceNo = ''
    form.remark = ''
  }
  void loadProjectContext(form.projectId)
}, { immediate: true })

watch(() => form.projectId, (projectId) => {
  if (props.visible) void loadProjectContext(projectId)
})

function selectType(option: { value: ReceivableType; label: string }): void {
  form.type = option.value
  if (!form.name.trim()) form.name = option.label
}

function onProjectChange(option: { label?: string } | null): void {
  selectedProjectName.value = option?.label ?? ''
  if (!option) projectContext.value = null
}

async function loadProjectContext(projectId: string): Promise<void> {
  const seq = ++contextSeq
  projectContext.value = null
  contextError.value = ''
  if (!projectId) return
  contextLoading.value = true
  try {
    const report = await financeApi.projectReport(projectId)
    if (seq === contextSeq) projectContext.value = report
  } catch (loadError) {
    if (seq === contextSeq) contextError.value = loadError instanceof ProviderError ? loadError.message : '项目资金参考暂不可确认'
  } finally {
    if (seq === contextSeq) contextLoading.value = false
  }
}

async function submit(): Promise<void> {
  const amount = Number(form.amount)
  if (!form.projectId) {
    error.value = '请选择项目'
    return
  }
  if (!form.name.trim()) {
    error.value = '请填写应收节点名称'
    return
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    error.value = '应收金额必须大于 0'
    return
  }
  if (!props.item && form.type !== 'other') {
    error.value = '手工应收仅支持其他应收；首期、进度、尾款和质保金须由合同或付款计划生成'
    return
  }
  saving.value = true
  error.value = ''
  try {
    if (props.item) {
      await financeApi.updateReceivable({
        id: props.item.id,
        name: form.name.trim(),
        stageName: form.stageName.trim() || undefined,
        type: form.type,
        amount,
        dueDate: form.dueDate,
        invoiceRequired: form.invoiceRequired,
        invoiceNo: form.invoiceNo.trim() || undefined,
        remark: form.remark.trim() || undefined
      })
    } else {
      await financeApi.saveReceivable({
        projectId: form.projectId,
        name: form.name.trim(),
        stageName: form.stageName.trim() || undefined,
        type: form.type,
        amount,
        dueDate: form.dueDate,
        invoiceRequired: form.invoiceRequired,
        invoiceNo: form.invoiceNo.trim() || undefined,
        remark: form.remark.trim() || undefined
      })
    }
    ElMessage.success(props.item ? '应收节点已更新' : '应收节点已创建')
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
    <div class="receivable-document">
      <p class="finance-drawer__hint">直接编辑应收节点单据。保存后由保存时自动核对合同归属、金额、状态和到期日。</p>
      <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />

      <div class="receivable-document__project">
        <ProjectPicker v-model="form.projectId" placeholder="选择所属项目" :disabled="Boolean(item)" @change="onProjectChange" />
      </div>

      <div class="receivable-document__layout">
        <section class="receivable-document__paper">
          <header class="receivable-document__head">
            <div>
              <span>应收节点</span>
              <strong>{{ form.name || '未命名节点' }}</strong>
            </div>
            <span class="receivable-document__type-badge">{{ selectedTypeLabel }}</span>
          </header>

          <el-form label-position="top" @submit.prevent>
            <el-form-item label="节点名称">
              <el-input v-model="form.name" class="receivable-document__name" maxlength="60" placeholder="如 补充约定款" />
            </el-form-item>
            <el-form-item label="应收类型">
              <div class="receivable-type-checks">
                <el-checkbox
                  v-for="option in typeOptions"
                  :key="option.value"
                  :model-value="form.type === option.value"
                  @change="selectType(option)"
                >
                  <span>{{ option.label }}</span>
                  <small>{{ option.description }}</small>
                </el-checkbox>
              </div>
            </el-form-item>
            <el-form-item label="合同阶段 / 触发条件">
              <el-input v-model="form.stageName" maxlength="60" placeholder="如 签约后 7 日" />
            </el-form-item>

            <div class="receivable-document__amounts">
              <el-form-item label="应收金额" class="receivable-document__amount-block">
                <el-input v-model="form.amount" class="receivable-document__amount" inputmode="decimal" placeholder="0.00">
                  <template #prepend>¥</template>
                </el-input>
              </el-form-item>
              <el-form-item label="到期日" class="receivable-document__due-block">
                <el-date-picker v-model="form.dueDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
              </el-form-item>
            </div>

            <div class="receivable-document__invoice">
              <el-switch v-model="form.invoiceRequired" active-text="需要发票" />
              <el-input v-if="form.invoiceRequired" v-model="form.invoiceNo" maxlength="80" placeholder="发票号" />
            </div>

            <el-form-item label="节点说明">
              <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="300" show-word-limit placeholder="补充合同约定、开票要求或收款条件" />
            </el-form-item>
          </el-form>
        </section>

        <aside class="receivable-document__context">
          <h3>项目资金参考</h3>
          <p>{{ selectedProjectName || '选择项目后显示项目资金数据' }}</p>

          <el-skeleton v-if="contextLoading" :rows="5" animated />
          <el-alert v-else-if="contextError" type="warning" :closable="false" :title="contextError" show-icon />
          <el-empty v-else-if="!projectContext" description="尚未选择项目" :image-size="70" />
          <div v-else class="receivable-document__metrics">
            <div class="metric--contract"><span>合同金额</span><strong>¥{{ formatMoney(projectContext.contractAmount) }}</strong></div>
            <div class="metric--received"><span>累计已收</span><strong>¥{{ formatMoney(projectContext.receivedAmount) }}</strong></div>
            <div class="metric--outstanding"><span>待收金额</span><strong>¥{{ formatMoney(projectContext.outstandingAmount) }}</strong></div>
            <div class="metric--overdue"><span>逾期金额</span><strong>¥{{ formatMoney(projectContext.overdueAmount) }}</strong></div>
          </div>

          <div class="receivable-document__rules">
            <strong>提交说明</strong>
            <span>手工仅补充其他应收；合同节点由合同与付款计划生成，正式收入以财务确认为准。</span>
            <span>金额与状态由系统最终校验。</span>
            <span>保存后进入项目的应收计划。</span>
          </div>
        </aside>
      </div>
    </div>

    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">{{ item ? '保存应收节点' : '创建应收节点' }}</el-button>
    </template>
  </el-drawer>
</template>

<style scoped lang="scss">
.receivable-document {
  display: flex;
  flex-direction: column;
  gap: $space-4;
}

.receivable-document__project {
  margin-bottom: 0;
  width: 100%;
}

.receivable-document__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(340px, .85fr);
  gap: $space-4;
  align-items: stretch;
}

.receivable-document__paper {
  padding: $space-5;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: linear-gradient(150deg, $surface-0 0%, $brand-50 100%);
  box-shadow: $shadow-card;
}

.receivable-document__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;
  padding-bottom: $space-4;
  margin-bottom: $space-4;
  border-bottom: 1px solid $border-color;
}

.receivable-document__head > div {
  min-width: 0;
}

.receivable-document__head span,
.receivable-document__head strong {
  display: block;
}

.receivable-document__head span {
  color: $text-tertiary;
  font-size: $font-caption;
  letter-spacing: .08em;
}

.receivable-document__head strong {
  margin-top: $space-2;
  font-size: $font-display;
  line-height: 1.25;
  word-break: break-word;
}

.receivable-document__type-badge {
  flex: 0 0 auto;
  padding: 4px 10px;
  color: $brand-700;
  background: $brand-50;
  border: 1px solid $brand-100;
  border-radius: $radius-pill;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
}

.receivable-type-checks {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $space-2;
}

.receivable-type-checks :deep(.el-checkbox) {
  height: auto;
  min-height: 42px;
  margin-right: 0;
  padding: $space-2 $space-3;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: rgba(255, 255, 255, .72);
}

.receivable-type-checks :deep(.el-checkbox.is-checked) {
  border-color: $brand-500;
  background: $brand-50;
}

.receivable-type-checks :deep(.el-checkbox__label) {
  display: flex;
  flex-direction: column;
  gap: 2px;
  white-space: normal;
  line-height: 1.35;
}

.receivable-type-checks :deep(.el-checkbox__label small) {
  color: $text-tertiary;
  font-size: $font-caption;
}

.receivable-document__name :deep(.el-input__inner) {
  font-size: $font-title;
  font-weight: $font-weight-semibold;
}

.receivable-document__amounts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-4;
}

.receivable-document__amount-block,
.receivable-document__due-block {
  padding: $space-4;
  border-radius: $radius-md;
  background: rgba(255, 255, 255, .72);
  border: 1px solid $border-color;
}

.receivable-document__amount :deep(.el-input__inner) {
  font-size: $font-card-title;
  font-weight: $font-weight-semibold;
}

.receivable-document__invoice {
  display: flex;
  align-items: center;
  gap: $space-4;
  margin-bottom: $space-4;
}

.receivable-document__invoice .el-input {
  max-width: 220px;
}

.receivable-document__context {
  padding: $space-4;
  border: 1px solid $brand-100;
  border-radius: $radius-lg;
  background: linear-gradient(160deg, $brand-50 0%, $surface-0 68%);
}

.receivable-document__context h3 {
  margin: 0;
  font-size: $font-card-title;
}

.receivable-document__context > p {
  margin: $space-2 0 $space-4;
  color: $text-secondary;
  font-size: $font-caption;
  line-height: 1.6;
  word-break: break-word;
}

.receivable-document__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-2;
}

.receivable-document__metrics > div {
  padding: $space-3;
  border: 1px solid transparent;
  border-radius: $radius-sm;
  background: rgba(255, 255, 255, .76);
}

.receivable-document__metrics .metric--contract,
.receivable-document__metrics .metric--received,
.receivable-document__metrics .metric--outstanding,
.receivable-document__metrics .metric--overdue {
  border-color: rgba(255, 255, 255, .72);
  background: rgba(255, 255, 255, .76);
}

.receivable-document__metrics span,
.receivable-document__metrics strong {
  display: block;
}

.receivable-document__metrics span {
  color: $text-tertiary;
  font-size: $font-caption;
}

.receivable-document__metrics strong {
  margin-top: 3px;
  font-size: $font-body-sm;
  font-variant-numeric: tabular-nums;
}

.receivable-document__rules {
  display: flex;
  flex-direction: column;
  gap: $space-2;
  padding-top: $space-4;
  margin-top: $space-4;
  border-top: 1px solid $brand-100;
  color: $text-secondary;
  font-size: $font-caption;
  line-height: 1.5;
}

.receivable-document__rules strong {
  color: $text-primary;
}

@media (max-width: 900px) {
  .receivable-document__layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
