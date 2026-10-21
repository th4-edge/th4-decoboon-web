<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ProviderError } from '@/core/http'
import { todayLocalDate } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import type { EmployeeCompensationScheme } from '@/domains/finance/model'
import EmployeePicker from '@/components/picker/EmployeePicker.vue'
import FinanceDocumentLayout from '@/components/finance/FinanceDocumentLayout.vue'

type CompensationDrawerMode = 'create' | 'edit' | 'successor'

const props = withDefaults(defineProps<{
  visible: boolean
  scheme?: EmployeeCompensationScheme | null
  mode?: CompensationDrawerMode
  storeId?: string
}>(), {
  scheme: null,
  mode: 'create',
  storeId: undefined
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: []
}>()

const saving = ref(false)
const error = ref('')
const employeeName = ref('')
const form = reactive({
  empId: '',
  baseSalary: '',
  scheduledDays: '22',
  effectiveFrom: todayLocalDate(),
  effectiveTo: '',
  remark: ''
})

const title = computed(() => props.mode === 'edit' ? '编辑薪酬方案'
  : props.mode === 'successor' ? '新增后续薪酬方案' : '新增员工薪酬方案')
const employeeLocked = computed(() => props.mode === 'edit' || props.mode === 'successor')
const submitText = computed(() => props.mode === 'edit' ? '保存修改' : '保存方案')
const resultTitle = computed(() => props.mode === 'successor' ? '后续生效方案' : '员工薪酬方案')

watch(form, () => {
  if (error.value) error.value = ''
}, { deep: true })

watch(() => props.visible, (visible) => {
  if (!visible) return
  error.value = ''
  const scheme = props.scheme
  form.empId = scheme?.employee.id || ''
  employeeName.value = scheme?.employee.name || ''
  form.baseSalary = scheme ? scheme.baseSalary.toFixed(2) : ''
  form.scheduledDays = String(scheme?.scheduledDays || 22)
  form.remark = scheme?.remark || ''
  form.effectiveTo = props.mode === 'edit' ? scheme?.effectiveTo || '' : ''
  form.effectiveFrom = props.mode === 'edit'
    ? scheme?.effectiveFrom || todayLocalDate()
    : props.mode === 'successor' && scheme
      ? suggestedSuccessorDate(scheme)
      : todayLocalDate()
})

function onEmployeeChange(option: { label?: string } | null): void {
  employeeName.value = option?.label ?? ''
}

async function submit(): Promise<void> {
  if (saving.value) return
  const salary = Number(form.baseSalary)
  const days = Number(form.scheduledDays)
  if (!form.empId || !Number.isFinite(salary) || salary <= 0) {
    error.value = '请选择员工并填写大于 0 的月固定工资'
    return
  }
  if (!Number.isInteger(days) || days < 1 || days > 31) {
    error.value = '月应出勤天数必须为 1 至 31 天的整数'
    return
  }
  if (!form.effectiveFrom) {
    error.value = '请选择生效日期'
    return
  }
  if (form.effectiveTo && form.effectiveTo < form.effectiveFrom) {
    error.value = '失效日期不能早于生效日期'
    return
  }
  if (props.mode === 'successor' && props.scheme && form.effectiveFrom <= props.scheme.effectiveFrom) {
    error.value = '后续方案的生效日期必须晚于原方案生效日期'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const payload = {
      baseSalary: salary,
      scheduledDays: days,
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo || undefined,
      remark: form.remark.trim() || undefined
    }
    if (props.mode === 'edit' && props.scheme) {
      await financeApi.updateEmployeeCompensation({ schemeId: props.scheme.id, ...payload })
    } else {
      await financeApi.saveEmployeeCompensation({ empId: form.empId, ...payload })
    }
    ElMessage.success(props.mode === 'edit' ? '薪酬方案已更新' : '薪酬方案已保存')
    emit('saved')
    emit('update:visible', false)
  } catch (submitError) {
    error.value = submitError instanceof ProviderError ? submitError.message : '薪酬方案保存失败，暂不可确认'
  } finally {
    saving.value = false
  }
}

function suggestedSuccessorDate(scheme: EmployeeCompensationScheme): string {
  const today = todayLocalDate()
  const candidate = addDay(scheme.effectiveTo || scheme.effectiveFrom)
  return candidate > today ? candidate : today
}

function addDay(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <el-drawer :model-value="visible" :title="title" size="min(940px, 96vw)" destroy-on-close @update:model-value="emit('update:visible', $event)">
    <FinanceDocumentLayout document-label="员工薪酬方案" :document-title="employeeName || '待选择员工'">
      <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
      <el-alert
        v-if="scheme?.locked"
        type="info"
        :closable="false"
        show-icon
        title="员工已锁定，本方案只用于生成新的生效版本；历史工资事实不会回写。"
      />
      <el-form label-position="top" class="finance-form-grid" @submit.prevent>
        <el-form-item label="发薪员工" class="finance-form-grid__wide">
          <el-input v-if="employeeLocked" :model-value="employeeName || scheme?.employee.name || '员工待确认'" disabled />
          <EmployeePicker v-else v-model="form.empId" :store-id="storeId" @change="onEmployeeChange" />
        </el-form-item>
        <el-form-item label="月固定工资">
          <el-input v-model="form.baseSalary" inputmode="decimal" placeholder="0.00">
            <template #prepend>¥</template>
          </el-input>
        </el-form-item>
        <el-form-item label="月应出勤天数">
          <el-input v-model="form.scheduledDays" type="number" min="1" max="31" step="1">
            <template #append>天</template>
          </el-input>
        </el-form-item>
        <el-form-item label="生效日期">
          <el-date-picker v-model="form.effectiveFrom" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="失效日期（可空）">
          <el-date-picker v-model="form.effectiveTo" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注" class="finance-form-grid__wide">
          <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="可填写调薪原因或方案说明" />
        </el-form-item>
      </el-form>

      <template #aside>
        <div class="finance-document__result">
          <span>提交结果</span>
          <h4>{{ resultTitle }}</h4>
          <dl>
            <div><dt>员工</dt><dd>{{ employeeName || '未选择员工' }}</dd></div>
            <div><dt>月固定工资</dt><dd>{{ form.baseSalary ? `¥${form.baseSalary}` : '待填写' }}</dd></div>
            <div><dt>月应出勤</dt><dd>{{ form.scheduledDays ? `${form.scheduledDays} 天` : '待填写' }}</dd></div>
            <div><dt>生效日期</dt><dd>{{ form.effectiveFrom || '待填写' }}</dd></div>
            <div><dt>失效日期</dt><dd>{{ form.effectiveTo || '长期有效' }}</dd></div>
          </dl>
          <p>月固定工资和应出勤天数由服务端校验。方案形成考勤、提成或工资事实后不可直接修改，只能新增后续方案。</p>
        </div>
      </template>
    </FinanceDocumentLayout>

    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">{{ submitText }}</el-button>
    </template>
  </el-drawer>
</template>
