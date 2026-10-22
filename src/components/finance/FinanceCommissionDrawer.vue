<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ProviderError } from '@/core/http'
import { formatAmountPreview } from '@/domains/finance/format'
import { financeApi } from '@/domains/finance/api'
import ProjectPicker from '@/components/picker/ProjectPicker.vue'
import EmployeePicker from '@/components/picker/EmployeePicker.vue'
import FinanceDocumentLayout from '@/components/finance/FinanceDocumentLayout.vue'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: []
}>()

const saving = ref(false)
const error = ref('')
const projectName = ref('')
const employeeName = ref('')
const form = reactive({
  empId: '',
  projectId: '',
  contractAmount: '',
  manualRate: '2',
  commissionAmount: '',
  remark: ''
})

const commissionPreview = computed(() => {
  if (form.commissionAmount) return formatAmountPreview(form.commissionAmount)
  if (form.contractAmount && form.manualRate) return '由系统按签约额和比例计算'
  return '待计算'
})

watch(() => props.visible, (visible) => {
  if (!visible) return
  error.value = ''
  form.empId = ''
  form.projectId = ''
  form.contractAmount = ''
  form.manualRate = '2'
  form.commissionAmount = ''
  form.remark = ''
})

function onProjectChange(option: { label?: string } | null): void {
  projectName.value = option?.label ?? ''
}

function onEmployeeChange(option: { label?: string } | null): void {
  employeeName.value = option?.label ?? ''
}

async function submit(): Promise<void> {
  if (!form.empId || !form.projectId || !form.contractAmount || !form.manualRate) {
    error.value = '请选择员工、项目并填写签约额和比例'
    return
  }
  saving.value = true
  error.value = ''
  try {
    await financeApi.saveEmployeeCommission({
      empId: form.empId,
      projectId: form.projectId,
      contractAmount: Number(form.contractAmount),
      manualRate: Number(form.manualRate),
      commissionAmount: form.commissionAmount ? Number(form.commissionAmount) : undefined,
      remark: form.remark
    })
    ElMessage.success('提成已计提')
    emit('saved')
    emit('update:visible', false)
  } catch (submitError) {
    error.value = submitError instanceof ProviderError ? submitError.message : '提成计提失败'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-drawer :model-value="visible" title="提成计提" size="min(980px, 96vw)" destroy-on-close @update:model-value="emit('update:visible', $event)">
    <FinanceDocumentLayout document-label="员工提成单" :document-title="employeeName || '待选择员工'">
      <template #context>
        <div class="finance-document__context">
          <ProjectPicker v-model="form.projectId" placeholder="选择主合同项目" @change="onProjectChange" />
        </div>
      </template>

      <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
      <el-form label-position="top" class="finance-form-grid" @submit.prevent>
        <el-form-item label="员工" class="finance-form-grid__wide">
          <EmployeePicker v-model="form.empId" @change="onEmployeeChange" />
        </el-form-item>
        <el-form-item label="主合同签约额">
          <el-input v-model="form.contractAmount" inputmode="decimal" placeholder="0.00">
            <template #prepend>¥</template>
          </el-input>
        </el-form-item>
        <el-form-item label="手工比例">
          <el-input v-model="form.manualRate" inputmode="decimal" placeholder="2">
            <template #append>%</template>
          </el-input>
        </el-form-item>
        <el-form-item label="提成金额（可留空自动计算）">
          <el-input v-model="form.commissionAmount" inputmode="decimal" placeholder="留空由自动计算">
            <template #prepend>¥</template>
          </el-input>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="300" show-word-limit />
        </el-form-item>
      </el-form>

      <template #aside>
        <div class="finance-document__result">
          <span>提交结果</span>
          <h4>待系统计提</h4>
          <dl>
            <div><dt>项目</dt><dd>{{ projectName || '未选择项目' }}</dd></div>
            <div><dt>员工</dt><dd>{{ employeeName || '未选择员工' }}</dd></div>
            <div><dt>签约额</dt><dd>{{ formatAmountPreview(form.contractAmount) }}</dd></div>
            <div><dt>手工比例</dt><dd>{{ form.manualRate || '待填写' }}%</dd></div>
            <div><dt>提成金额</dt><dd>{{ commissionPreview }}</dd></div>
          </dl>
          <p>提成金额留空时由系统按签约额和比例计算；最终计提结果以保存结果为准。</p>
        </div>
      </template>
    </FinanceDocumentLayout>

    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">确认计提</el-button>
    </template>
  </el-drawer>
</template>
