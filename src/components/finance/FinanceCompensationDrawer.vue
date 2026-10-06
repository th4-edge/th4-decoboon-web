<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import EmployeePicker from '@/components/picker/EmployeePicker.vue'
import FinanceDocumentLayout from '@/components/finance/FinanceDocumentLayout.vue'

const props = defineProps<{ visible: boolean }>()
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
  effectiveFrom: localDate(),
  effectiveTo: '',
  remark: ''
})

watch(() => props.visible, (visible) => {
  if (!visible) return
  error.value = ''
  form.empId = ''
  form.baseSalary = ''
  form.effectiveFrom = localDate()
  form.effectiveTo = ''
  form.remark = ''
  employeeName.value = ''
})

function onEmployeeChange(option: { label?: string } | null): void {
  employeeName.value = option?.label ?? ''
}

async function submit(): Promise<void> {
  if (!form.empId || !form.baseSalary || !form.effectiveFrom) {
    error.value = '请选择员工并填写固定工资和生效日期'
    return
  }
  saving.value = true
  error.value = ''
  try {
    await financeApi.saveEmployeeCompensation({
      empId: form.empId,
      baseSalary: Number(form.baseSalary),
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo || undefined,
      remark: form.remark
    })
    ElMessage.success('薪酬方案已保存')
    emit('saved')
    emit('update:visible', false)
  } catch (submitError) {
    error.value = submitError instanceof ProviderError ? submitError.message : '薪酬方案保存失败'
  } finally {
    saving.value = false
  }
}

function localDate(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <el-drawer :model-value="visible" title="新增员工薪酬方案" size="min(900px, 96vw)" destroy-on-close @update:model-value="emit('update:visible', $event)">
    <FinanceDocumentLayout document-label="员工薪酬方案" :document-title="employeeName || '待选择员工'">
      <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
      <el-form label-position="top" class="finance-form-grid" @submit.prevent>
        <el-form-item label="员工" class="finance-form-grid__wide">
          <EmployeePicker v-model="form.empId" @change="onEmployeeChange" />
        </el-form-item>
        <el-form-item label="月固定工资">
          <el-input v-model="form.baseSalary" inputmode="decimal" placeholder="0.00">
            <template #prepend>¥</template>
          </el-input>
        </el-form-item>
        <el-form-item label="生效日期">
          <el-date-picker v-model="form.effectiveFrom" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="失效日期（可空）">
          <el-date-picker v-model="form.effectiveTo" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注" class="finance-form-grid__wide">
          <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="300" show-word-limit />
        </el-form-item>
      </el-form>

      <template #aside>
        <div class="finance-document__result">
          <span>提交结果</span>
          <h4>员工薪酬方案</h4>
          <dl>
            <div><dt>员工</dt><dd>{{ employeeName || '未选择员工' }}</dd></div>
            <div><dt>月固定工资</dt><dd>{{ form.baseSalary ? `¥${form.baseSalary}` : '待填写' }}</dd></div>
            <div><dt>生效日期</dt><dd>{{ form.effectiveFrom || '待填写' }}</dd></div>
            <div><dt>失效日期</dt><dd>{{ form.effectiveTo || '长期有效' }}</dd></div>
          </dl>
          <p>薪酬方案用于工资计算，保存后由服务端校验员工归属、日期区间和历史版本。</p>
        </div>
      </template>
    </FinanceDocumentLayout>

    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">保存方案</el-button>
    </template>
  </el-drawer>
</template>
