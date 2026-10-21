<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import StatusTag from '@/components/StatusTag.vue'
import { financeApi } from '@/domains/finance/api'
import type { FinanceEmployeeRef } from '@/domains/finance/model'
import type { PickerOption } from '@/domains/common/picker'
import type { StatusTone } from '@/core/tone'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  clearable?: boolean
  storeId?: string
}>(), {
  placeholder: '选择员工',
  clearable: false,
  storeId: undefined
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [option: PickerOption | null]
}>()

const ROLE_LABELS: Record<string, string> = {
  Boss: '企业负责人',
  StoreManager: '店长',
  TeamLeader: '团队负责人',
  Marketer: '业务员',
  Designer: '设计师',
  Pm: '项目经理',
  Finance: '财务'
}

const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))

const visible = ref(false)
const keyword = ref('')
const roleFilter = ref('')
const storeFilter = ref('')
const teamFilter = ref('')
const statusFilter = ref<'all' | 'active' | 'inactive'>('active')
const employees = ref<FinanceEmployeeRef[]>([])
const selected = ref<FinanceEmployeeRef | null>(null)
const loading = ref(false)
const error = ref('')

const fieldLabel = computed(() => selected.value?.name || (props.modelValue ? '已选员工需重新确认' : props.placeholder))
const fieldDescription = computed(() => selected.value ? employeeDescription(selected.value) : '')
const storeOptions = computed(() => [...new Set(employees.value.map((item) => item.storeName).filter((value): value is string => Boolean(value)))])
const teamOptions = computed(() => [...new Set(employees.value.map((item) => item.teamName).filter((value): value is string => Boolean(value)))])
const filteredEmployees = computed(() => {
  const needle = keyword.value.trim().toLowerCase()
  return employees.value.filter((item) => {
    if (roleFilter.value && item.role !== roleFilter.value) return false
    if (storeFilter.value && item.storeName !== storeFilter.value) return false
    if (teamFilter.value && item.teamName !== teamFilter.value) return false
    if (statusFilter.value === 'active' && !isActive(item)) return false
    if (statusFilter.value === 'inactive' && isActive(item)) return false
    if (!needle) return true
    return [item.name, roleLabel(item.role), item.storeName, item.teamName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle))
  })
})

watch(() => props.modelValue, async (id) => {
  if (!id) {
    selected.value = null
    return
  }
  if (selected.value?.id === id) return
  if (!employees.value.length) await load()
  selected.value = employees.value.find((item) => item.id === id) ?? null
}, { immediate: true })

function open(): void {
  visible.value = true
  keyword.value = ''
  roleFilter.value = ''
  storeFilter.value = ''
  teamFilter.value = ''
  statusFilter.value = 'active'
  void load()
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    employees.value = await financeApi.employeeOptions({ storeId: props.storeId || undefined })
    if (props.modelValue) selected.value = employees.value.find((item) => item.id === props.modelValue) ?? null
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : '员工数据暂不可确认'
  } finally {
    loading.value = false
  }
}

function choose(employee: FinanceEmployeeRef): void {
  selected.value = employee
  emit('update:modelValue', employee.id)
  emit('change', {
    id: employee.id,
    label: employee.name,
    description: employeeDescription(employee),
    raw: employee
  })
  visible.value = false
}

function clear(): void {
  selected.value = null
  emit('update:modelValue', '')
  emit('change', null)
}

function roleLabel(role?: string): string {
  if (!role) return '角色待确认'
  const match = Object.entries(ROLE_LABELS).find(([key]) => key.toLowerCase() === role.toLowerCase())
  return match?.[1] ?? role
}

function statusLabel(employee: FinanceEmployeeRef): string {
  const status = String(employee.status ?? '').toLowerCase()
  if (status === 'active') return '在职'
  if (status === 'inactive') return '停用'
  if (status === 'suspended') return '暂停'
  return '状态待确认'
}

function statusTone(employee: FinanceEmployeeRef): StatusTone {
  const status = String(employee.status ?? '').toLowerCase()
  return status === 'active' ? 'done' : status === 'inactive' || status === 'suspended' ? 'closed' : 'muted'
}

function isActive(employee: FinanceEmployeeRef): boolean {
  return String(employee.status ?? '').toLowerCase() === 'active'
}

function employeeDescription(employee: FinanceEmployeeRef): string {
  return [roleLabel(employee.role), employee.storeName || '门店待确认', employee.teamName || '未分团队'].join(' · ')
}
</script>

<template>
  <div class="employee-picker">
    <button
      type="button"
      class="employee-picker__field"
      :class="{ 'employee-picker__field--empty': !modelValue, 'employee-picker__field--selected': Boolean(selected && modelValue) }"
      @click="open"
    >
      <span v-if="selected && modelValue" class="employee-picker__selected">
        <span class="employee-picker__selected-top">
          <span>当前员工</span>
          <StatusTag :tone="statusTone(selected)" :text="statusLabel(selected)" />
          <span class="employee-picker__selected-role">{{ roleLabel(selected.role) }}</span>
        </span>
        <strong>{{ selected.name }}</strong>
        <small>员工编号 {{ selected.id }}</small>
        <span class="employee-picker__selected-facts">
          <span><small>角色</small><b>{{ roleLabel(selected.role) }}</b></span>
          <span><small>门店</small><b>{{ selected.storeName || '待确认' }}</b></span>
          <span><small>团队</small><b>{{ selected.teamName || '未分团队' }}</b></span>
          <span><small>状态</small><b>{{ statusLabel(selected) }}</b></span>
        </span>
      </span>
      <span v-else class="employee-picker__copy">
        <strong>{{ fieldLabel }}</strong>
        <small v-if="fieldDescription">{{ fieldDescription }}</small>
      </span>
      <span class="employee-picker__actions">
        <span v-if="clearable && modelValue" @click.stop="clear">清除</span>
        <span aria-hidden="true">选择</span>
      </span>
    </button>

    <el-dialog v-model="visible" title="选择员工" width="min(1000px, 96vw)" append-to-body destroy-on-close class="employee-picker__dialog">
      <div class="employee-picker__toolbar">
        <el-input v-model="keyword" clearable placeholder="搜索员工姓名、角色、门店或团队" />
        <div class="employee-picker__status">
          <button type="button" :class="{ active: statusFilter === 'active' }" @click="statusFilter = 'active'">在职</button>
          <button type="button" :class="{ active: statusFilter === 'all' }" @click="statusFilter = 'all'">全部状态</button>
          <button type="button" :class="{ active: statusFilter === 'inactive' }" @click="statusFilter = 'inactive'">停用/暂停</button>
        </div>
        <span>已加载 {{ employees.length }} 人</span>
      </div>

      <div class="employee-picker__layout">
        <aside class="employee-picker__filters">
          <strong>角色</strong>
          <button type="button" :class="{ active: !roleFilter }" @click="roleFilter = ''">全部角色</button>
          <button v-for="role in ROLE_OPTIONS" :key="role.value" type="button" :class="{ active: roleFilter === role.value }" @click="roleFilter = role.value">{{ role.label }}</button>

          <strong>门店</strong>
          <button type="button" :class="{ active: !storeFilter }" @click="storeFilter = ''">全部门店</button>
          <button v-for="store in storeOptions" :key="store" type="button" :class="{ active: storeFilter === store }" @click="storeFilter = store">{{ store }}</button>

          <strong>团队</strong>
          <button type="button" :class="{ active: !teamFilter }" @click="teamFilter = ''">全部团队</button>
          <button v-for="team in teamOptions" :key="team" type="button" :class="{ active: teamFilter === team }" @click="teamFilter = team">{{ team }}</button>
        </aside>

        <main class="employee-picker__results" aria-live="polite">
          <el-alert v-if="error" type="error" :closable="false" title="员工数据暂不可确认" show-icon>
            <template #default><el-button size="small" plain @click="load()">重新加载</el-button></template>
          </el-alert>
          <el-skeleton v-else-if="loading && !employees.length" :rows="6" animated />
          <div v-else-if="!filteredEmployees.length" class="employee-picker__empty"><strong>当前条件下没有员工</strong><span>调整角色、门店、团队、状态或关键词后重试。</span></div>
          <button
            v-for="employee in filteredEmployees"
            v-else
            :key="employee.id"
            type="button"
            class="employee-picker__card"
            :class="{ active: employee.id === modelValue }"
            @click="choose(employee)"
          >
            <span class="employee-picker__card-head">
              <strong>{{ employee.name }}</strong>
              <StatusTag :tone="statusTone(employee)" :text="statusLabel(employee)" />
            </span>
            <span class="employee-picker__card-role">{{ roleLabel(employee.role) }}</span>
            <span class="employee-picker__card-tags">
              <small>{{ employee.storeName || '门店待确认' }}</small>
              <small>{{ employee.teamName || '未分团队' }}</small>
              <small>员工编号 {{ employee.id }}</small>
            </span>
            <span class="employee-picker__card-foot">
              <small>用于工资、提成和发薪选择</small>
              <b>{{ employee.id === modelValue ? '已选' : '选择员工' }}</b>
            </span>
          </button>
        </main>
      </div>

      <template #footer><el-button @click="visible = false">关闭</el-button><el-button v-if="clearable && modelValue" @click="clear(); visible = false">清除选择</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.employee-picker__field { display: flex; align-items: center; justify-content: space-between; gap: $space-3; width: 100%; min-height: 54px; padding: $space-2 $space-3; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; color: $text-primary; text-align: left; cursor: pointer; }
.employee-picker__field--empty { color: $text-tertiary; }
.employee-picker__field--selected { min-height: 142px; align-items: stretch; background: linear-gradient(135deg, $brand-50 0%, $surface-0 76%); }
.employee-picker__selected { display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, .9fr); grid-template-areas: 'top top' 'name facts' 'desc facts'; gap: $space-2 $space-5; width: 100%; }
.employee-picker__selected-top { grid-area: top; display: flex; align-items: center; flex-wrap: wrap; gap: $space-2; > span:first-child { color: $brand-600; font-size: $font-caption; font-weight: $font-weight-semibold; letter-spacing: .08em; } }
.employee-picker__selected-role { padding: 2px 8px; color: $text-secondary; background: $surface-100; border-radius: $radius-pill; font-size: $font-caption; }
.employee-picker__selected > strong { grid-area: name; font-size: $font-title; line-height: 1.4; }
.employee-picker__selected > small { grid-area: desc; color: $text-secondary; font-size: $font-caption; }
.employee-picker__selected-facts { grid-area: facts; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-2; > span { padding: $space-2; border: 1px solid $border-color; border-radius: $radius-sm; background: rgba(255, 255, 255, .76); } small, b { display: block; } small { color: $text-tertiary; font-size: $font-caption; } b { margin-top: 2px; font-size: $font-body-sm; } }
.employee-picker__field--selected .employee-picker__actions { flex-direction: column; align-items: flex-end; justify-content: center; align-self: stretch; }
.employee-picker__copy { min-width: 0; strong, small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } strong { font-size: $font-body-sm; } small { margin-top: 3px; color: $text-secondary; font-size: $font-caption; } }
.employee-picker__actions { display: flex; gap: $space-2; color: $brand-700; font-size: $font-caption; }
.employee-picker__actions span:first-child { color: $text-tertiary; }
.employee-picker__toolbar { display: flex; align-items: center; gap: $space-3; margin-bottom: $space-3; > span { margin-left: auto; color: $text-tertiary; font-size: $font-caption; } }
.employee-picker__status { display: flex; gap: 6px; button { padding: 6px 10px; border: 1px solid $border-color; border-radius: $radius-pill; background: $surface-0; color: $text-secondary; cursor: pointer; font-size: $font-caption; &.active { border-color: $brand-300; background: $brand-50; color: $brand-700; } } }
.employee-picker__layout { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: $space-4; min-height: 460px; }
.employee-picker__filters { padding: $space-3; border: 1px solid $border-color; border-radius: $radius-md; background: linear-gradient(160deg, $brand-50 0%, $surface-0 82%); overflow: auto; strong { display: block; margin: $space-3 0 $space-2; color: $text-tertiary; font-size: $font-caption; &:first-child { margin-top: 0; } } button { width: 100%; padding: 7px $space-2; border: 0; border-radius: $radius-sm; background: transparent; color: $text-secondary; text-align: left; cursor: pointer; &:hover, &.active { background: $surface-0; color: $brand-700; } } }
.employee-picker__results { min-width: 0; max-height: 540px; overflow: auto; }
.employee-picker__card { display: block; width: 100%; padding: $space-3 $space-4; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; color: $text-primary; text-align: left; cursor: pointer; & + & { margin-top: $space-2; } &:hover, &.active { border-color: $brand-300; background: $brand-50; } }
.employee-picker__card-head, .employee-picker__card-foot, .employee-picker__card-tags { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.employee-picker__card-head strong { font-size: $font-card-title; }
.employee-picker__card-role { display: block; margin-top: $space-1; color: $brand-700; font-size: $font-caption; font-weight: $font-weight-semibold; }
.employee-picker__card-tags { justify-content: flex-start; flex-wrap: wrap; margin-top: $space-2; small { padding: 2px 7px; border-radius: $radius-pill; background: $surface-50; color: $text-secondary; } }
.employee-picker__card-foot { margin-top: $space-2; small { color: $text-tertiary; } b { color: $brand-700; font-size: $font-caption; } }
.employee-picker__empty { display: grid; gap: $space-2; padding: $space-8; color: $text-secondary; text-align: center; }
@media (max-width: 900px) { .employee-picker__selected { grid-template-columns: 1fr; grid-template-areas: 'top' 'name' 'desc' 'facts'; } .employee-picker__layout { grid-template-columns: 1fr; } }
</style>
