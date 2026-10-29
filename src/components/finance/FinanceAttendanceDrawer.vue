<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
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

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: []
}>()

const rows = ref<EmployeeAttendanceSummary[]>([])
const saving = ref(false)
const error = ref('')
const employeeName = ref('')
const schemeLoading = ref(false)
const schemeError = ref('')
let schemeRequest = 0
const form = reactive({
  empId: '',
  month: localMonth(),
  scheduledDays: '',
  normalDays: '0',
  personalLeaveDays: '0',
  sickLeaveDays: '0',
  absenceDays: '0',
  externalDays: '0',
  annualLeaveDays: '0',
  compLeaveDays: '0',
  remark: ''
})

watch(() => props.visible, async (visible) => {
  if (!visible) {
    schemeRequest += 1
    schemeLoading.value = false
    return
  }
  error.value = ''
  schemeError.value = ''
  employeeName.value = ''
  form.empId = ''
  form.scheduledDays = ''
  form.normalDays = '0'
  await load()
})

async function load(): Promise<void> {
  try {
    rows.value = await financeApi.employeeAttendances(form.month)
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '考勤数据加载失败'
  }
}

function onEmployeeChange(option: { label?: string } | null): void {
  employeeName.value = option?.label ?? ''
  schemeRequest += 1
  form.scheduledDays = ''
  form.normalDays = '0'
  schemeError.value = ''
  schemeLoading.value = false
  if (form.empId && option) void loadScheme()
}

async function onMonthChange(): Promise<void> {
  schemeRequest += 1
  form.scheduledDays = ''
  form.normalDays = '0'
  schemeError.value = ''
  schemeLoading.value = false
  await load()
  if (form.empId) await loadScheme()
}

async function loadScheme(): Promise<void> {
  if (!form.empId || !form.month) return
  const version = ++schemeRequest
  schemeLoading.value = true
  schemeError.value = ''
  try {
    const scheme = await financeApi.employeeCompensationForMonth(form.empId, form.month)
    if (version !== schemeRequest) return
    form.scheduledDays = String(scheme.scheduledDays)
  } catch (loadError) {
    if (version !== schemeRequest) return
    form.scheduledDays = ''
    schemeError.value = loadError instanceof ProviderError ? loadError.message : '该工资月份没有生效薪酬方案'
  } finally {
    if (version === schemeRequest) schemeLoading.value = false
  }
}

async function submit(): Promise<void> {
  if (!form.empId) {
    error.value = '请选择员工'
    return
  }
  if (schemeError.value) {
    error.value = schemeError.value
    return
  }
  const scheduledDays = Number(form.scheduledDays)
  if (!Number.isInteger(scheduledDays) || scheduledDays < 1 || scheduledDays > 31) {
    error.value = '应出勤天数必须为 1 至 31 天的整数'
    return
  }
  saving.value = true
  error.value = ''
  try {
    await financeApi.saveEmployeeAttendance({
      empId: form.empId,
      month: form.month,
      scheduledDays: Number(form.scheduledDays),
      normalDays: Number(form.normalDays),
      personalLeaveDays: Number(form.personalLeaveDays),
      sickLeaveDays: Number(form.sickLeaveDays),
      absenceDays: Number(form.absenceDays),
      externalDays: Number(form.externalDays),
      annualLeaveDays: Number(form.annualLeaveDays),
      compLeaveDays: Number(form.compLeaveDays),
      remark: form.remark
    })
    ElMessage.success('考勤已保存')
    await load()
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
    ElMessage.success('考勤已确认')
    await load()
    emit('saved')
  } catch (confirmError) {
    error.value = confirmError instanceof ProviderError ? confirmError.message : '考勤确认失败'
  }
}

function attendanceStatusMeta(row: Record<string, unknown>): { label: string; tone: StatusTone } {
  const status = String(row.status ?? '') as EmployeeAttendanceStatus
  return ATTENDANCE_STATUS_META[status] ?? ATTENDANCE_STATUS_META.draft
}

function confirmRow(row: Record<string, unknown>): void {
  void confirm(row as unknown as EmployeeAttendanceSummary)
}

function localMonth(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
</script>

<template>
  <el-drawer :model-value="visible" title="月度考勤" size="min(1040px, 96vw)" destroy-on-close @update:model-value="emit('update:visible', $event)">
    <FinanceDocumentLayout document-label="员工考勤单" :document-title="employeeName || '待选择员工'">
      <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
      <el-form label-position="top" class="finance-form-grid" @submit.prevent>
        <el-form-item label="员工" class="finance-form-grid__wide">
          <EmployeePicker v-model="form.empId" @change="onEmployeeChange" />
        </el-form-item>
        <el-form-item label="工资月份">
          <el-date-picker v-model="form.month" type="month" value-format="YYYY-MM" style="width: 100%" @change="onMonthChange" />
        </el-form-item>
        <el-form-item label="应出勤天数">
          <el-input v-model="form.scheduledDays" type="number" min="1" max="31" step="1" :disabled="schemeLoading" placeholder="默认按薪酬方案带出，可调整" />
          <p v-if="schemeError" class="attendance-scheme-hint">{{ schemeError }}</p>
          <p v-else class="attendance-scheme-note">默认从当月薪酬方案带出；可按当月实际出勤安排调整，工资计算以本考勤单为准。</p>
        </el-form-item>
        <el-form-item label="正常出勤"><el-input v-model="form.normalDays" type="number" /></el-form-item>
        <el-form-item label="事假"><el-input v-model="form.personalLeaveDays" type="number" /></el-form-item>
        <el-form-item label="病假"><el-input v-model="form.sickLeaveDays" type="number" /></el-form-item>
        <el-form-item label="旷工"><el-input v-model="form.absenceDays" type="number" /></el-form-item>
        <el-form-item label="备注" class="finance-form-grid__wide"><el-input v-model="form.remark" type="textarea" :rows="3" maxlength="300" show-word-limit /></el-form-item>
      </el-form>

      <template #aside>
        <div class="finance-document__result">
          <span>提交结果</span>
          <h4>员工考勤事实</h4>
          <dl>
            <div><dt>员工</dt><dd>{{ employeeName || '未选择员工' }}</dd></div>
            <div><dt>工资月份</dt><dd>{{ form.month }}</dd></div>
            <div><dt>应出勤</dt><dd>{{ form.scheduledDays || '0' }} 天</dd></div>
            <div><dt>正常出勤</dt><dd>{{ form.normalDays || '0' }} 天</dd></div>
            <div><dt>缺勤合计</dt><dd>{{ Number(form.personalLeaveDays || 0) + Number(form.sickLeaveDays || 0) + Number(form.absenceDays || 0) }} 天</dd></div>
          </dl>
          <p>应出勤默认取当月薪酬方案，可结合当月实际安排修改；保存后以本考勤单为准。</p>
        </div>
      </template>
    </FinanceDocumentLayout>

    <section class="attendance-history">
      <header><strong>本月考勤记录</strong><span>{{ rows.length }} 条</span></header>
      <el-table :data="rows" stripe>
        <el-table-column label="员工" min-width="150"><template #default="{ row }">{{ row.employee.name }}</template></el-table-column>
        <el-table-column prop="scheduledDays" label="应出勤" width="90" />
        <el-table-column prop="personalLeaveDays" label="事假" width="80" />
        <el-table-column prop="sickLeaveDays" label="病假" width="80" />
        <el-table-column prop="absenceDays" label="旷工" width="80" />
        <el-table-column label="状态" width="120"><template #default="{ row }"><StatusTag :tone="attendanceStatusMeta(row).tone" :text="attendanceStatusMeta(row).label" /></template></el-table-column>
        <el-table-column label="操作" width="110"><template #default="{ row }"><el-button v-if="attendanceStatusMeta(row).label !== '已确认'" text type="primary" @click="confirmRow(row)">确认</el-button></template></el-table-column>
      </el-table>
    </section>

    <template #footer>
      <el-button @click="emit('update:visible', false)">关闭</el-button>
      <el-button type="primary" :loading="saving" @click="submit">保存考勤</el-button>
    </template>
  </el-drawer>
</template>

<style scoped lang="scss">
.attendance-scheme-hint,
.attendance-scheme-note {
  margin: $space-1 0 0;
  font-size: $font-caption;
  line-height: 1.5;
}
.attendance-scheme-hint { color: $danger-500; }
.attendance-scheme-note { color: $text-tertiary; }
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
