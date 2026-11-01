<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import StatusTag from '@/components/StatusTag.vue'
import { identityApi, type EntityOption } from '@/domains/identity/api'
import { financeApi } from '@/domains/finance/api'
import type { PickerOption } from '@/domains/common/picker'
import type { StatusTone } from '@/core/tone'

type EmployeeSource = 'payroll' | 'directory'
type EmployeeStatusFilter = 'Active' | 'Suspended' | 'Resigned' | 'all'
interface EmployeeItem {
  id: string
  name: string
  role?: string
  status?: string
  avatarUrl?: string
  storeId?: string
  storeName?: string
  teamId?: string
  teamName?: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  title?: string
  placeholder?: string
  clearable?: boolean
  disabled?: boolean
  storeId?: string
  /** payroll 保留薪酬域权限；directory 用于项目、风险和设计等普通员工目录场景。 */
  source: EmployeeSource
  /** 限定可选岗位；不传时展示全部应用岗位。 */
  roles?: string[]
  /** card=表单全宽已选卡；compact=筛选条紧凑回显。 */
  variant?: 'card' | 'compact'
  initialStatus?: EmployeeStatusFilter
}>(), {
  title: '选择员工',
  placeholder: '选择员工',
  clearable: false,
  disabled: false,
  storeId: undefined,
  roles: () => [],
  variant: 'card',
  initialStatus: 'Active'
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
const DEFAULT_ROLE_VALUES = ['Boss', 'StoreManager', 'TeamLeader', 'Marketer', 'Designer', 'Pm', 'Finance']
const STATUS_OPTIONS: Array<{ value: EmployeeStatusFilter; label: string }> = [
  { value: 'Active', label: '在职' },
  { value: 'Suspended', label: '停用' },
  { value: 'Resigned', label: '已离职' },
  { value: 'all', label: '全部' }
]
const PAGE_SIZE = 20

const visible = ref(false)
const keyword = ref('')
const roleFilter = ref('')
const storeFilter = ref('')
const statusFilter = ref<EmployeeStatusFilter>(props.initialStatus)
const items = ref<EmployeeItem[]>([])
const stores = ref<EntityOption[]>([])
const selected = ref<EmployeeItem | null>(null)
const currentPage = ref(1)
const total = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')
const storeError = ref('')
const selectedResolveError = ref('')
let requestSeq = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined

const allowedRoleValues = computed(() => {
  const configured = props.roles
    .map((role) => Object.keys(ROLE_LABELS).find((candidate) => candidate.toLowerCase() === role.toLowerCase()))
    .filter((role): role is string => Boolean(role))
  return configured.length ? [...new Set(configured)] : DEFAULT_ROLE_VALUES
})
const showRoleFilter = computed(() => allowedRoleValues.value.length > 1)
const showStoreFilter = computed(() => !props.storeId && stores.value.length > 1)
const fieldLabel = computed(() => selected.value?.name || (props.modelValue ? '已选员工需重新确认' : props.placeholder))
const fieldDescription = computed(() => selected.value ? employeeDescription(selected.value) : '')

watch(() => props.modelValue, (id) => {
  if (!id) {
    selected.value = null
    selectedResolveError.value = ''
    return
  }
  if (selected.value?.id === id) return
  void resolveSelected(id)
}, { immediate: true })

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

function open(): void {
  if (props.disabled) return
  visible.value = true
  keyword.value = ''
  roleFilter.value = ''
  storeFilter.value = ''
  statusFilter.value = props.initialStatus
  void Promise.all([loadStores(), load(true)])
}

async function loadStores(): Promise<void> {
  storeError.value = ''
  if (props.storeId) {
    stores.value = []
    return
  }
  try {
    stores.value = await identityApi.stores()
  } catch {
    stores.value = []
    storeError.value = '门店筛选暂不可确认，已保留员工检索。'
  }
}

async function fetchPage(params: {
  current: number
  size: number
  keyword?: string
  role?: string
  status?: EmployeeStatusFilter | 'all'
  storeId?: string
  empId?: string
}) {
  if (props.source === 'payroll') return financeApi.employeePage(params)
  return identityApi.employeePage(params)
}

async function resolveSelected(id: string): Promise<void> {
  selectedResolveError.value = ''
  try {
    const result = await fetchPage({ current: 1, size: 1, empId: id, status: 'all' })
    selected.value = result.list.find((item) => item.id === id) ?? null
    if (!selected.value) selectedResolveError.value = '已选员工不在当前可见范围或已失效，请重新选择。'
  } catch {
    selected.value = null
    selectedResolveError.value = '已选员工暂不可确认，保留原值并允许重新选择。'
  }
}

async function load(reset = true): Promise<void> {
  const seq = ++requestSeq
  if (reset) {
    currentPage.value = 1
    items.value = []
    total.value = 0
    hasMore.value = false
  }
  if (reset) loading.value = true
  else loadingMore.value = true
  error.value = ''
  try {
    const result = await fetchPage({
      current: currentPage.value,
      size: PAGE_SIZE,
      keyword: keyword.value.trim() || undefined,
      role: roleFilter.value || props.roles.join(',') || undefined,
      status: statusFilter.value,
      storeId: props.storeId || storeFilter.value || undefined
    })
    if (seq !== requestSeq) return
    items.value = reset ? result.list : mergeEmployees(items.value, result.list)
    total.value = result.total
    hasMore.value = result.hasMore
    if (props.modelValue && !selected.value) {
      selected.value = result.list.find((item) => item.id === props.modelValue) ?? null
    }
  } catch (loadError) {
    if (seq !== requestSeq) return
    const message = loadError instanceof Error ? loadError.message : '员工数据暂不可确认'
    if (reset) error.value = message
    else {
      error.value = `${message}，已保留当前候选`
      currentPage.value = Math.max(1, currentPage.value - 1)
    }
  } finally {
    if (seq === requestSeq) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

function mergeEmployees(left: EmployeeItem[], right: EmployeeItem[]): EmployeeItem[] {
  const merged = new Map(left.map((item) => [item.id, item]))
  right.forEach((item) => merged.set(item.id, item))
  return [...merged.values()]
}

function scheduleSearch(): void {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void load(true) }, 300)
}

function selectRole(role: string): void {
  roleFilter.value = role
  void load(true)
}

function selectStatus(status: EmployeeStatusFilter): void {
  statusFilter.value = status
  void load(true)
}

function selectStore(id: string): void {
  storeFilter.value = id
  void load(true)
}

function resetFilters(): void {
  keyword.value = ''
  roleFilter.value = ''
  storeFilter.value = ''
  statusFilter.value = props.initialStatus
  void load(true)
}

function loadMore(): void {
  if (!hasMore.value || loading.value || loadingMore.value) return
  currentPage.value += 1
  void load(false)
}

function choose(employee: EmployeeItem): void {
  selected.value = employee
  selectedResolveError.value = ''
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
  if (props.disabled) return
  selected.value = null
  selectedResolveError.value = ''
  emit('update:modelValue', '')
  emit('change', null)
}

function roleLabel(role?: string): string {
  if (!role) return '角色待确认'
  const match = Object.entries(ROLE_LABELS).find(([key]) => key.toLowerCase() === role.toLowerCase())
  return match?.[1] ?? '角色待确认'
}

function statusLabel(employee: EmployeeItem): string {
  const status = String(employee.status ?? '').toLowerCase()
  if (status === 'active') return '在职'
  if (status === 'suspended') return '停用'
  if (status === 'resigned') return '已离职'
  return '状态待确认'
}

function statusTone(employee: EmployeeItem): StatusTone {
  const status = String(employee.status ?? '').toLowerCase()
  return status === 'active' ? 'done' : status === 'suspended' || status === 'resigned' ? 'closed' : 'muted'
}

function employeeDescription(employee: EmployeeItem): string {
  return [roleLabel(employee.role), employee.storeName || '门店待确认', employee.teamName || '未分团队'].join(' · ')
}

function employeeCanBeSelected(employee: EmployeeItem): boolean {
  return String(employee.status ?? '').toLowerCase() === 'active'
}
</script>

<template>
  <div class="employee-picker" :class="`employee-picker--${variant}`">
    <button
      type="button"
      class="employee-picker__field"
      :class="{
        'employee-picker__field--empty': !modelValue,
        'employee-picker__field--selected': Boolean(selected && modelValue),
        'employee-picker__field--disabled': disabled,
        'employee-picker__field--compact': variant === 'compact'
      }"
      :disabled="disabled"
      @click="open"
    >
      <span v-if="selected && modelValue && variant === 'compact'" class="employee-picker__selected-compact">
        <strong>{{ selected.name }}</strong>
        <StatusTag :tone="statusTone(selected)" :text="statusLabel(selected)" />
        <small>{{ roleLabel(selected.role) }} · {{ selected.storeName || '门店待确认' }}</small>
      </span>
      <span v-else-if="selected && modelValue" class="employee-picker__selected">
        <span class="employee-picker__selected-top">
          <span>当前员工</span>
          <StatusTag :tone="statusTone(selected)" :text="statusLabel(selected)" />
          <span class="employee-picker__selected-role">{{ roleLabel(selected.role) }}</span>
        </span>
        <strong>{{ selected.name }}</strong>
        <small>{{ selectedResolveError || employeeDescription(selected) }}</small>
        <span class="employee-picker__selected-facts">
          <span><small>岗位</small><b>{{ roleLabel(selected.role) }}</b></span>
          <span><small>门店</small><b>{{ selected.storeName || '待确认' }}</b></span>
          <span v-if="selected.teamName"><small>团队</small><b>{{ selected.teamName }}</b></span>
          <span><small>状态</small><b>{{ statusLabel(selected) }}</b></span>
        </span>
      </span>
      <span v-else class="employee-picker__copy">
        <strong>{{ fieldLabel }}</strong>
        <small v-if="selectedResolveError">{{ selectedResolveError }}</small>
        <small v-else-if="fieldDescription">{{ fieldDescription }}</small>
      </span>
      <span class="employee-picker__actions">
        <span v-if="clearable && modelValue && !disabled" aria-label="清除已选员工" @click.stop="clear">清除</span>
        <span aria-hidden="true">{{ disabled ? '已锁定' : '选择' }}</span>
      </span>
    </button>

    <el-dialog v-model="visible" :title="title" width="min(1000px, 96vw)" append-to-body destroy-on-close class="employee-picker__dialog">
      <div class="employee-picker__toolbar">
        <el-input
          v-model="keyword"
          clearable
          placeholder="搜索员工姓名或手机号"
          aria-label="搜索员工姓名或手机号"
          @input="scheduleSearch"
          @keyup.enter="load(true)"
          @clear="load(true)"
        />
        <div class="employee-picker__status" aria-label="员工状态筛选">
          <button
            v-for="option in STATUS_OPTIONS"
            :key="option.value"
            type="button"
            :class="{ active: statusFilter === option.value }"
            @click="selectStatus(option.value)"
          >{{ option.label }}</button>
        </div>
        <span>{{ total ? `共 ${total} 人` : '按条件检索' }}</span>
      </div>

      <div class="employee-picker__layout">
        <aside class="employee-picker__filters">
          <template v-if="showRoleFilter">
            <strong>岗位</strong>
            <button type="button" :class="{ active: !roleFilter }" @click="selectRole('')">全部可选岗位</button>
            <button
              v-for="role in allowedRoleValues"
              :key="role"
              type="button"
              :class="{ active: roleFilter === role }"
              @click="selectRole(role)"
            >{{ roleLabel(role) }}</button>
          </template>
          <template v-if="showStoreFilter">
            <strong>门店</strong>
            <button type="button" :class="{ active: !storeFilter }" @click="selectStore('')">全部门店</button>
            <button
              v-for="store in stores"
              :key="store.id"
              type="button"
              :class="{ active: storeFilter === store.id }"
              @click="selectStore(store.id)"
            >{{ store.name }}</button>
          </template>
          <p v-if="storeError" class="employee-picker__filter-error">{{ storeError }}</p>
          <button v-if="keyword || roleFilter || storeFilter || statusFilter !== initialStatus" type="button" class="employee-picker__reset" @click="resetFilters">重置筛选</button>
        </aside>

        <main class="employee-picker__results" aria-live="polite">
          <el-alert v-if="error" type="error" :closable="false" title="员工数据暂不可确认" show-icon>
            <template #default>
              <span>{{ error }}</span>
              <el-button size="small" plain @click="load(true)">重新加载</el-button>
            </template>
          </el-alert>
          <el-skeleton v-else-if="loading && !items.length" :rows="6" animated />
          <div v-else-if="!items.length" class="employee-picker__empty">
            <strong>{{ keyword || roleFilter || storeFilter ? '当前条件下没有员工' : '当前范围没有员工' }}</strong>
            <span>调整岗位、门店、状态或关键词后重试。</span>
          </div>
          <template v-else>
            <button
              v-for="employee in items"
              :key="employee.id"
              type="button"
              class="employee-picker__card"
              :class="{ active: employee.id === modelValue, disabled: !employeeCanBeSelected(employee) }"
              :disabled="!employeeCanBeSelected(employee)"
              @click="choose(employee)"
            >
              <span class="employee-picker__card-head">
                <strong>{{ employee.name }}</strong>
                <StatusTag :tone="statusTone(employee)" :text="statusLabel(employee)" />
              </span>
              <span class="employee-picker__card-role">{{ roleLabel(employee.role) }}</span>
              <span class="employee-picker__card-tags">
                <small>{{ employee.storeName || '门店待确认' }}</small>
                <small v-if="employee.teamName">团队：{{ employee.teamName }}</small>
              </span>
              <span class="employee-picker__card-foot">
                <small>{{ employeeCanBeSelected(employee) ? '可参与当前业务选择' : '非在职员工仅用于历史核对' }}</small>
                <b>{{ employee.id === modelValue ? '已选' : employeeCanBeSelected(employee) ? '选择员工' : '不可选择' }}</b>
              </span>
            </button>
            <div class="employee-picker__more">
              <el-button v-if="hasMore" :loading="loadingMore" plain @click="loadMore">加载更多</el-button>
              <span v-else>已显示全部 {{ total }} 人</span>
            </div>
          </template>
        </main>
      </div>

      <template #footer>
        <el-button @click="visible = false">关闭</el-button>
        <el-button v-if="clearable && modelValue" @click="clear(); visible = false">清除选择</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.employee-picker__field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
  width: 100%;
  min-height: 54px;
  padding: $space-2 $space-3;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-0;
  color: $text-primary;
  text-align: left;
  cursor: pointer;
}
.employee-picker__field:hover:not(:disabled),
.employee-picker__field:focus-visible {
  border-color: $brand-300;
  box-shadow: $shadow-focus;
}
.employee-picker__field--empty { color: $text-tertiary; }
.employee-picker__field--disabled { cursor: not-allowed; opacity: .72; }
.employee-picker__field--selected {
  min-height: 142px;
  align-items: stretch;
  background: linear-gradient(135deg, $brand-50 0%, $surface-0 76%);
}
.employee-picker__field--compact {
  min-height: 42px;
  padding: 5px $space-3;
}
.employee-picker__selected {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, .9fr);
  grid-template-areas: 'top top' 'name facts' 'desc facts';
  gap: $space-2 $space-5;
  width: 100%;
}
.employee-picker__selected-top {
  grid-area: top;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: $space-2;
}
.employee-picker__selected-top > span:first-child {
  color: $brand-600;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
}
.employee-picker__selected-role {
  padding: 2px 8px;
  color: $text-secondary;
  background: $surface-100;
  border-radius: $radius-pill;
  font-size: $font-caption;
}
.employee-picker__selected > strong { grid-area: name; font-size: $font-title; line-height: 1.4; }
.employee-picker__selected > small { grid-area: desc; color: $text-secondary; font-size: $font-caption; }
.employee-picker__selected-facts {
  grid-area: facts;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-2;
}
.employee-picker__selected-facts > span {
  padding: $space-2;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: rgba(255, 255, 255, .76);
}
.employee-picker__selected-facts small,
.employee-picker__selected-facts b { display: block; }
.employee-picker__selected-facts small { color: $text-tertiary; font-size: $font-caption; }
.employee-picker__selected-facts b { margin-top: 2px; font-size: $font-body-sm; }
.employee-picker__field--selected .employee-picker__actions {
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  align-self: stretch;
}
.employee-picker__selected-compact {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: $space-2;
}
.employee-picker__selected-compact strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: $font-body-sm;
}
.employee-picker__selected-compact small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: $text-tertiary;
  font-size: $font-caption;
}
.employee-picker__copy { min-width: 0; }
.employee-picker__copy strong,
.employee-picker__copy small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.employee-picker__copy strong { font-size: $font-body-sm; }
.employee-picker__copy small { margin-top: 3px; color: $text-secondary; font-size: $font-caption; }
.employee-picker__actions { display: flex; gap: $space-2; color: $brand-700; font-size: $font-caption; }
.employee-picker__actions span:first-child { color: $text-tertiary; cursor: pointer; }
.employee-picker__toolbar {
  display: flex;
  align-items: center;
  gap: $space-3;
  margin-bottom: $space-3;
}
.employee-picker__toolbar > span { margin-left: auto; color: $text-tertiary; font-size: $font-caption; white-space: nowrap; }
.employee-picker__status { display: flex; gap: 6px; }
.employee-picker__status button {
  padding: 6px 10px;
  border: 1px solid $border-color;
  border-radius: $radius-pill;
  background: $surface-0;
  color: $text-secondary;
  cursor: pointer;
  font-size: $font-caption;
}
.employee-picker__status button.active {
  border-color: $brand-300;
  background: $brand-50;
  color: $brand-700;
}
.employee-picker__layout { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: $space-4; min-height: 460px; }
.employee-picker__filters {
  padding: $space-3;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: linear-gradient(160deg, $brand-50 0%, $surface-0 82%);
  overflow: auto;
}
.employee-picker__filters strong {
  display: block;
  margin: $space-3 0 $space-2;
  color: $text-tertiary;
  font-size: $font-caption;
}
.employee-picker__filters strong:first-child { margin-top: 0; }
.employee-picker__filters button {
  width: 100%;
  padding: 7px $space-2;
  border: 0;
  border-radius: $radius-sm;
  background: transparent;
  color: $text-secondary;
  text-align: left;
  cursor: pointer;
}
.employee-picker__filters button:hover,
.employee-picker__filters button.active { background: $surface-0; color: $brand-700; }
.employee-picker__filters .employee-picker__reset { margin-top: $space-3; border: 1px dashed $border-color; color: $danger-500; text-align: center; }
.employee-picker__filter-error { margin: $space-2 0; color: $warning-700; font-size: $font-caption; line-height: 1.5; }
.employee-picker__results { min-width: 0; max-height: 540px; overflow: auto; }
.employee-picker__card {
  display: block;
  width: 100%;
  padding: $space-3 $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  color: $text-primary;
  text-align: left;
  cursor: pointer;
}
.employee-picker__card + .employee-picker__card { margin-top: $space-2; }
.employee-picker__card:hover:not(:disabled),
.employee-picker__card.active { border-color: $brand-300; background: $brand-50; }
.employee-picker__card.disabled { cursor: not-allowed; background: $surface-50; opacity: .72; }
.employee-picker__card-head,
.employee-picker__card-foot,
.employee-picker__card-tags { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.employee-picker__card-head strong { font-size: $font-card-title; }
.employee-picker__card-role { display: block; margin-top: $space-1; color: $brand-700; font-size: $font-caption; font-weight: $font-weight-semibold; }
.employee-picker__card-tags { justify-content: flex-start; flex-wrap: wrap; margin-top: $space-2; }
.employee-picker__card-tags small { padding: 2px 7px; border-radius: $radius-pill; background: $surface-50; color: $text-secondary; }
.employee-picker__card-foot { margin-top: $space-2; }
.employee-picker__card-foot small { color: $text-tertiary; }
.employee-picker__card-foot b { color: $brand-700; font-size: $font-caption; }
.employee-picker__empty { display: grid; gap: $space-2; padding: $space-8; color: $text-secondary; text-align: center; }
.employee-picker__more { display: flex; justify-content: center; padding: $space-3 0; }
.employee-picker__more span { color: $text-tertiary; font-size: $font-caption; }
@media (max-width: 900px) {
  .employee-picker__selected { grid-template-columns: 1fr; grid-template-areas: 'top' 'name' 'desc' 'facts'; }
  .employee-picker__layout { grid-template-columns: 1fr; }
  .employee-picker__toolbar { flex-wrap: wrap; }
  .employee-picker__toolbar > span { margin-left: 0; }
}
</style>
