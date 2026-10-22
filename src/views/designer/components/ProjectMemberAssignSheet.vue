<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { identityApi } from '@/domains/identity/api'
import type { EntityOption } from '@/domains/identity/api'
import { projectApi } from '@/domains/project/api'
import type { ProjectBrief } from '@/domains/project/model'

/**
 * 项目成员指派（XA-20261011-016）。
 * 合同生效生成项目后必须由企业负责人/店长确定项目经理，否则项目经理看不到该项目、阶段也无法开工。
 * 后端门禁：`project/project/update` + `requireMemberEditor`（企业负责人或本门店店长）。
 */
const props = defineProps<{
  modelValue: boolean
  project: ProjectBrief | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [project: ProjectBrief]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const form = reactive({
  managerId: '',
  designerId: '',
  supportId: ''
})

const managers = ref<EntityOption[]>([])
const designers = ref<EntityOption[]>([])
const supports = ref<EntityOption[]>([])
const loadingOptions = ref(false)
const optionError = ref('')
const saving = ref(false)
const saveError = ref('')

/** 候选加载失败时按事实展示，不静默降级为「没有候选人」。 */
async function loadOptions(): Promise<void> {
  loadingOptions.value = true
  optionError.value = ''
  try {
    const [pmList, bossList, designerList, financeList] = await Promise.all([
      identityApi.employeesByRole('Pm'),
      identityApi.employeesByRole('Boss'),
      identityApi.employeesByRole('Designer'),
      identityApi.employeesByRole('Finance')
    ])
    // 后端：项目经理须为「项目经理」或「企业负责人」；履约负责人须为「财务」或「企业负责人」。
    managers.value = mergeById(pmList, bossList)
    supports.value = mergeById(financeList, bossList)
    designers.value = designerList
  } catch (error) {
    optionError.value = error instanceof Error ? error.message : '人员候选暂不可确认，请稍后重试'
    managers.value = []
    designers.value = []
    supports.value = []
  } finally {
    loadingOptions.value = false
  }
}

function mergeById(primary: EntityOption[], secondary: EntityOption[]): EntityOption[] {
  const map = new Map<string, EntityOption>()
  for (const item of [...primary, ...secondary]) {
    if (item?.id && !map.has(item.id)) map.set(item.id, item)
  }
  return [...map.values()]
}

watch(
  () => [visible.value, props.project?.id] as const,
  ([open]) => {
    if (!open) return
    saveError.value = ''
    form.managerId = props.project?.managerId ?? ''
    form.designerId = props.project?.designerId ?? ''
    form.supportId = props.project?.supportId ?? ''
    void loadOptions()
  },
  { immediate: true }
)

const noManager = computed(() => !props.project?.managerId)

async function submit(): Promise<void> {
  const project = props.project
  if (!project) return
  if (!form.managerId && noManager.value) {
    saveError.value = '项目必须指定项目经理后才能开工，请先选择项目经理。'
    return
  }
  saving.value = true
  saveError.value = ''
  try {
    const updated = await projectApi.updateProjectMembers({
      projectId: project.id,
      managerId: form.managerId || undefined,
      designerId: form.designerId || undefined,
      supportId: form.supportId || undefined
    })
    ElMessage.success('项目成员已更新，已写入项目成员调整动态')
    emit('saved', updated)
    visible.value = false
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : '指派失败，请重新读取项目后重试'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-drawer v-model="visible" title="指定项目成员" size="480px" :destroy-on-close="true">
    <div class="member">
      <p class="member__intro">
        合同生效生成项目后，必须由企业负责人或店长确定项目经理；未指定项目经理时，项目经理看不到该项目、阶段也无法开工。
      </p>

      <el-alert
        v-if="noManager && project"
        class="member__alert"
        type="warning"
        :closable="false"
        show-icon
        title="该项目当前没有项目经理"
      />

      <el-alert
        v-if="optionError"
        class="member__alert"
        type="error"
        :closable="false"
        show-icon
        :title="optionError"
      >
        <el-button size="small" type="primary" plain @click="loadOptions">重新加载人员</el-button>
      </el-alert>

      <el-form label-position="top" class="member__form" @submit.prevent>
        <el-form-item label="项目经理（必填）" required>
          <el-select
            v-model="form.managerId"
            filterable
            :loading="loadingOptions"
            placeholder="选择项目经理或企业负责人"
            style="width: 100%"
          >
            <el-option v-for="item in managers" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="项目设计师">
          <el-select
            v-model="form.designerId"
            filterable
            clearable
            :loading="loadingOptions"
            placeholder="从当前在职员工中选择"
            style="width: 100%"
          >
            <el-option v-for="item in designers" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="履约负责人">
          <el-select
            v-model="form.supportId"
            filterable
            clearable
            :loading="loadingOptions"
            placeholder="财务或企业负责人"
            style="width: 100%"
          >
            <el-option v-for="item in supports" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
      </el-form>

      <el-alert v-if="saveError" class="member__alert" type="error" :closable="false" show-icon :title="saveError" />

      <p class="member__note">成员变更后会立即更新项目动态；项目经理不能修改合同基准开工或完工日期。</p>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="!project" @click="submit">保存成员</el-button>
    </template>
  </el-drawer>
</template>

<style scoped lang="scss">
.member { display: flex; flex-direction: column; gap: $space-3; }
.member__intro { margin: 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
.member__form { display: flex; flex-direction: column; }
.member__note { margin: 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
</style>
