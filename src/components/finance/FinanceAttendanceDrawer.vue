<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import type { EmployeeAttendanceStatus, EmployeeAttendanceSummary } from '@/domains/finance/model'
import EmployeePicker from '@/components/picker/EmployeePicker.vue'
import FinanceDocumentLayout from '@/components/finance/FinanceDocumentLayout.vue'
import StatusTag from '@/components/StatusTag.vue'
import type { StatusTone } from '@/core/tone'

const ATTENDANCE_STATUS_META: Record<EmployeeAttendanceStatus, { label: string; tone: StatusTone }> = {
  draft: { label: '草稿', tone: 'todo' },
  pending: { label: '待确认', tone: 'pending' },
  confirmed: { label: '已确认', tone: 'done' },
  inPayroll: { label: '已入工资', tone: 'doing' },
  disputed: { label: '有异议', tone: 'alert' },
  rejected: { label: '已驳回', tone: 'blocked' }
}

const props = withDefaults(defineProps<{ visible: boolean; month?: string }>(), { month: undefined })
const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: []
}>()

const rows = ref<EmployeeAttendanceSummary[]>([])
const saving = ref(false)
const deletingId = ref('')
const error = ref('')
const employeeName = ref('')
const editingId = ref('')
const scheduledDays = ref<number | null>(null)
const schemeLoading = ref(false)
const schemeError = ref('')
let schemeRequest = 0
const isEditing = computed(() => Boolean(editingId.value))
const form = reactive({
  empId: '',
  month: localMonth(),
  normalDays: '0',
  personalLeaveDays: '0',
  sickLeaveDays: '0',
  absenceDays: '0',
  externalDays: '0',
  annualLeaveDays: '0',
  compLeaveDays: '0',
  remark: ''
})

watch(() => [props.visible, props.month] as const, async ([visible, month]) => {
  if (!visible) return
  resetForm(validMonth(month) || localMonth())
  await load()
})

async function load(): Promise<void> {
  try {
    rows.value = await financeApi.employeeAttendances(form.month)
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '考勤数据加载失败'
  }
}

function resetForm(month: string): void {
  schemeRequest += 1
  editingId.value = ''
  employeeName.value = ''
  scheduledDays.value = null
  schemeLoading.value = false
  schemeError.value = ''
  form.empId = ''
  form.month = month
  form.normalDays = '0'
  form.personalLeaveDays = '0'
  form.sickLeaveDays = '0'
  form.absenceDays = '0'
  form.externalDays = '0'
  form.annualLeaveDays = '0'
  form.compLeaveDays = '0'
  form.remark = ''
}

function onEmployeeChange(option: { label?: string } | null): void {
  employeeName.value = option?.label ?? ''
  if (isEditing.value) return
  scheduledDays.value = null
  schemeError.value = ''
  void loadScheme()
}

async function loadScheme(): Promise<void> {
  const empId = form.empId
  const month = form.month
  if (isEditing.value || !empId || !validMonth(month)) {
    scheduledDays.value = null
    return
  }
  const version = ++schemeRequest
  schemeLoading.value = true
  schemeError.value = ''
  try {
    const scheme = await financeApi.employeeCompensationForMonth(empId, month)
    if (version !== schemeRequest) return
    scheduledDays.value = scheme.scheduledDays
  } catch (loadError) {
    if (version !== schemeRequest) return
    scheduledDays.value = null
    schemeError.value = loadError instanceof ProviderError ? loadError.message : '未找到该工资月份生效的薪酬方案'
  } finally {
    if (version === schemeRequest) schemeLoading.value = false
  }
}

async function onMonthChange(): Promise<void> {
  editingId.value = ''
  scheduledDays.value = null
  schemeError.value = ''
  await load()
  if (form.empId) await loadScheme()
}

async function editRow(row: EmployeeAttendanceSummary): Promise<void> {
  if (row.status === 'inPayroll') {
    error.value = '该考勤已进入工资单，不能编辑；如需修正，请先处理对应工资单'
    return
  }
  try {
    schemeRequest += 1
    schemeLoading.value = false
    const item = await financeApi.employeeAttendanceInfo(row.id)
    editingId.value = item.id
    employeeName.value = item.employee.name
    scheduledDays.value = item.scheduledDays
    schemeError.value = ''
    form.empId = item.employee.id
    form.month = item.payrollMonth || form.month
    form.normalDays = String(item.normalDays)
    form.personalLeaveDays = String(item.personalLeaveDays)
    form.sickLeaveDays = String(item.sickLeaveDays)
    form.absenceDays = String(item.absenceDays)
    form.externalDays = String(item.externalDays)
    form.annualLeaveDays = String(item.annualLeaveDays)
    form.compLeaveDays = String(item.compLeaveDays)
    form.remark = item.remark || ''
    error.value = ''
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '考勤详情加载失败，暂不可编辑'
  }
}

async function submit(): Promise<void> {
  if (!form.empId) {
    error.value = '请选择员工'
    return
  }
  if (!isEditing.value && (!scheduledDays.value || schemeLoading.value)) {
    error.value = schemeError.value || '该工资月份没有生效薪酬方案，请先配置薪酬方案'
    return
  }
  const numericFields = [
    form.normalDays, form.personalLeaveDays, form.sickLeaveDays, form.absenceDays,
    form.externalDays, form.annualLeaveDays, form.compLeaveDays
  ].map(Number)
  if (numericFields.some((value) => !Number.isInteger(value) || value < 0 || value > 31)) {
    error.value = '考勤天数必须为 0 至 31 天的整数'
    return
  }
  saving.value = true
  error.value = ''
  try {
    await financeApi.saveEmployeeAttendance({
      ...(isEditing.value ? { summaryId: editingId.value } : { empId: form.empId, month: form.month }),
      ...(scheduledDays.value ? { scheduledDays: scheduledDays.value } : {}),
      normalDays: Number(form.normalDays),
      personalLeaveDays: Number(form.personalLeaveDays),
      sickLeaveDays: Number(form.sickLeaveDays),
      absenceDays: Number(form.absenceDays),
      externalDays: Number(form.externalDays),
      annualLeaveDays: Number(form.annualLeaveDays),
      compLeaveDays: Number(form.compLeaveDays),
      remark: form.remark.trim() || undefined
    })
    ElMessage.success(isEditing.value ? '考勤已更新' : '考勤已保存')
    const month = form.month
    await load()
    resetForm(month)
    emit('saved')
  } catch (submitError) {
    error.value = submitError instanceof ProviderError ? submitError.message : '考勤保存失败'
  } finally {
    saving.value = false
  }
}

async function confirm(item: EmployeeAttendanceSummary): Promise<void> {
  try {
    await financeApi.confirmEmployeeAttendance(item.id)
    ElMessage.success('考勤已确认；如工资单已生成，请重新生成同月工资单')
    await load()
    emit('saved')
  } catch (confirmError) {
    error.value = confirmError instanceof ProviderError ? confirmError.message : '考勤确认失败'
  }
}

async function deleteRow(row: EmployeeAttendanceSummary): Promise<void> {
  if (row.status === 'inPayroll') {
    error.value = '该考勤已进入工资单，不能删除'
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认删除 ${row.employee.name} ${row.payrollMonth} 的考勤？已进入工资单的考勤不可删除。`,
      '删除月度考勤',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
    deletingId.value = row.id
    await financeApi.deleteEmployeeAttendance(row.id)
    ElMessage.success('月度考勤已删除')
    if (editingId.value === row.id) resetForm(form.month)
    await load()
    emit('saved')
  } catch (deleteError) {
    if (deleteError === 'cancel' || deleteError === 'close') return
    error.value = deleteError instanceof ProviderError ? deleteError.message : '月度考勤删除失败'
  } finally {
    deletingId.value = ''
  }
}

function attendanceStatusMeta(row: EmployeeAttendanceSummary): { label: string; tone: StatusTone } {
  return ATTENDANCE_STATUS_META[row.status] ?? ATTENDANCE_STATUS_META.draft
}

function asAttendance(row: unknown): EmployeeAttendanceSummary {
  return row as EmployeeAttendanceSummary
}

function rowLeaveSummary(row: EmployeeAttendanceSummary): string {
  return `外勤${row.externalDays} · 年假${row.annualLeaveDays} · 调休${row.compLeaveDays}`
}

function validMonth(value?: string): string {
  return value && /^\d{4}-\d{2}$/.test(value) ? value : ''
}

function localMonth(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
</script>

<template>
  <el-drawer :model-value="visible" title="月度考勤" size="min(1160px, 96vw)" destroy-on-close @update:model-value="emit('update:visible', $event)">
    <FinanceDocumentLayout document-label="员工考勤单" :document-title="employeeName || '待选择员工'">
      <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
      <el-form label-position="top" class="finance-form-grid" @submit.prevent>
        <el-form-item label="员工" class="finance-form-grid__wide">
          <EmployeePicker v-model="form.empId" :disabled="isEditing" @change="onEmployeeChange" />
        </el-form-item>
        <el-form-item label="工资月份">
          <el-date-picker v-model="form.month" type="month" value-format="YYYY-MM" style="width: 100%" :disabled="isEditing" @change="onMonthChange" />
        </el-form-item>
        <div class="attendance-scheme finance-form-grid__wide">
          <div>
            <span>月应出勤天数（薪酬方案）</span>
            <strong>{{ schemeLoading ? '读取中…' : scheduledDays ? `${scheduledDays} 天` : '未带出' }}</strong>
          </div>
          <small>{{ isEditing ? '编辑已有考勤时使用原记录的应出勤天数' : '选择员工和工资月份后，按当月生效薪酬方案读取；保存后由系统写入考勤记录' }}</small>
          <el-alert v-if="schemeError && !isEditing" type="warning" :closable="false" :title="schemeError" show-icon />
        </div>
        <el-form-item label="正常出勤"><el-input v-model="form.normalDays" type="number" min="0" max="31" /></el-form-item>
        <el-form-item label="事假"><el-input v-model="form.personalLeaveDays" type="number" min="0" max="31" /></el-form-item>
        <el-form-item label="病假"><el-input v-model="form.sickLeaveDays" type="number" min="0" max="31" /></el-form-item>
        <el-form-item label="旷工"><el-input v-model="form.absenceDays" type="number" min="0" max="31" /></el-form-item>
        <el-form-item label="外勤"><el-input v-model="form.externalDays" type="number" min="0" max="31" /></el-form-item>
        <el-form-item label="年假"><el-input v-model="form.annualLeaveDays" type="number" min="0" max="31" /></el-form-item>
        <el-form-item label="调休"><el-input v-model="form.compLeaveDays" type="number" min="0" max="31" /></el-form-item>
        <el-form-item label="备注" class="finance-form-grid__wide"><el-input v-model="form.remark" type="textarea" :rows="3" maxlength="300" show-word-limit /></el-form-item>
      </el-form>

      <template #aside>
        <div class="finance-document__result">
          <span>提交结果</span>
          <h4>{{ isEditing ? '更新员工考勤事实' : '员工考勤事实' }}</h4>
          <dl>
            <div><dt>员工</dt><dd>{{ employeeName || '未选择员工' }}</dd></div>
            <div><dt>工资月份</dt><dd>{{ form.month }}</dd></div>
            <div><dt>应出勤</dt><dd>{{ scheduledDays ?? '—' }} 天</dd></div>
            <div><dt>正常出勤</dt><dd>{{ form.normalDays || '0' }} 天</dd></div>
            <div><dt>缺勤合计</dt><dd>{{ Number(form.personalLeaveDays || 0) + Number(form.sickLeaveDays || 0) + Number(form.absenceDays || 0) }} 天</dd></div>
          </dl>
          <p>应出勤由当月薪酬方案或已有考勤记录决定；确认考勤后，如工资单已生成，需要重新生成同月工资单。</p>
        </div>
      </template>
    </FinanceDocumentLayout>

    <section class="attendance-history">
      <header><strong>本月考勤记录</strong><span>{{ rows.length }} 条</span></header>
      <el-table :data="rows" stripe>
        <el-table-column label="员工" min-width="130"><template #default="{ row }">{{ row.employee.name }}</template></el-table-column>
        <el-table-column prop="scheduledDays" label="应出勤" width="82" />
        <el-table-column prop="normalDays" label="正常" width="72" />
        <el-table-column prop="personalLeaveDays" label="事假" width="72" />
        <el-table-column prop="sickLeaveDays" label="病假" width="72" />
        <el-table-column prop="absenceDays" label="旷工" width="72" />
        <el-table-column label="外勤/年假/调休" min-width="138"><template #default="{ row }">{{ rowLeaveSummary(asAttendance(row)) }}</template></el-table-column>
        <el-table-column label="状态" width="100"><template #default="{ row }"><StatusTag :tone="attendanceStatusMeta(asAttendance(row)).tone" :text="attendanceStatusMeta(asAttendance(row)).label" /></template></el-table-column>
        <el-table-column label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status !== 'inPayroll'" text type="primary" @click.stop="editRow(asAttendance(row))">编辑</el-button>
            <el-button v-if="row.status !== 'confirmed' && row.status !== 'inPayroll'" text type="primary" @click.stop="confirm(asAttendance(row))">确认</el-button>
            <el-button v-if="row.status !== 'inPayroll'" text type="danger" :loading="deletingId === row.id" @click.stop="deleteRow(asAttendance(row))">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <template #footer>
      <el-button v-if="isEditing" @click="resetForm(form.month)">取消编辑</el-button>
      <el-button @click="emit('update:visible', false)">关闭</el-button>
      <el-button type="primary" :loading="saving" :disabled="schemeLoading" @click="submit">{{ isEditing ? '保存变更' : '保存考勤' }}</el-button>
    </template>
  </el-drawer>
</template>

<style scoped lang="scss">
.attendance-scheme {
  display: grid;
  gap: $space-2;
  padding: $space-3 $space-4;
  border: 1px solid $brand-100;
  border-radius: $radius-md;
  background: $brand-50;

  > div { display: flex; align-items: center; justify-content: space-between; gap: $space-3; }
  span { color: $text-secondary; font-size: $font-body-sm; }
  strong { color: $brand-700; font-size: $font-title; }
  small { color: $text-tertiary; font-size: $font-caption; line-height: 1.6; }
}

.attendance-history {
  margin-top: $space-5;
  overflow: hidden;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-3;
    padding: $space-3 $space-4;
    border-bottom: 1px solid $border-color;
    span { color: $text-tertiary; font-size: $font-caption; }
  }
}
</style>
