<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ProviderError } from '@/core/http'
import { formatDateTime, todayLocalDate } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import { usePayrollAccess } from '@/domains/finance/payrollAccess'
import type { EmployeeCompensationScheme } from '@/domains/finance/model'
import { useFinanceScopeStore } from '@/stores/financeScope'
import type { StatusTone } from '@/core/tone'
import { isEmployeeRole, roleLabel } from '@/roles/permission'
import PanelCard from '@/components/PanelCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StatusTag from '@/components/StatusTag.vue'
import MoneyText from '@/components/MoneyText.vue'
import FinanceCompensationDrawer from '@/components/finance/FinanceCompensationDrawer.vue'

type DrawerMode = 'create' | 'edit' | 'successor'

const { canWrite, readOnly } = usePayrollAccess()
const scope = useFinanceScopeStore()
const rows = ref<EmployeeCompensationScheme[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const current = ref(1)
const size = ref(20)
const keyword = ref('')
const status = ref('')
const effectiveMonth = ref('')
const drawerVisible = ref(false)
const drawerMode = ref<DrawerMode>('create')
const drawerScheme = ref<EmployeeCompensationScheme | null>(null)

const statusOptions = [
  { label: '生效', value: 'Active' },
  { label: '失效', value: 'Expired' },
  { label: '草稿', value: 'Draft' }
]
const statusCount = computed(() => {
  const locked = rows.value.filter((item) => item.locked).length
  return `${rows.value.length} 条本页方案 · ${locked} 条已锁定`
})

onMounted(() => { void load() })
watch(() => scope.requestStoreId, () => { current.value = 1; void load() })

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const result = await financeApi.employeeCompensations({
      current: current.value,
      size: size.value,
      storeId: scope.requestStoreId ?? undefined,
      keyword: keyword.value.trim() || undefined,
      status: status.value || undefined,
      effectiveMonth: effectiveMonth.value || undefined
    })
    rows.value = result.list
    total.value = result.total
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '薪酬方案暂不可确认'
  } finally {
    loading.value = false
  }
}

function applyFilters(): void {
  current.value = 1
  void load()
}

function openCreate(): void {
  drawerMode.value = 'create'
  drawerScheme.value = null
  drawerVisible.value = true
}

function openEdit(row: unknown): void {
  const item = row as EmployeeCompensationScheme
  if (!canWrite.value || item.locked) return
  drawerMode.value = 'edit'
  drawerScheme.value = item
  drawerVisible.value = true
}

function openSuccessor(row: unknown): void {
  const item = row as EmployeeCompensationScheme
  if (!canWrite.value) return
  drawerMode.value = 'successor'
  drawerScheme.value = item
  drawerVisible.value = true
}

async function terminate(row: unknown): Promise<void> {
  const item = row as EmployeeCompensationScheme
  if (!canWrite.value || item.locked) return
  let effectiveTo = ''
  try {
    const result = await ElMessageBox.prompt(
      `终止后该方案从失效日期起不再匹配。失效日期不得早于 ${item.effectiveFrom}。`,
      `终止 ${item.employee.name} 的薪酬方案`,
      {
        confirmButtonText: '确认终止',
        cancelButtonText: '取消',
        inputValue: todayLocalDate(),
        inputPlaceholder: 'YYYY-MM-DD',
        inputValidator: (value: string) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '请输入 YYYY-MM-DD 格式日期'
          return value >= item.effectiveFrom || `失效日期不能早于 ${item.effectiveFrom}`
        }
      }
    )
    effectiveTo = result.value
  } catch {
    return
  }
  try {
    await financeApi.updateEmployeeCompensation({ schemeId: item.id, effectiveTo })
    ElMessage.success('薪酬方案已终止')
    await load()
  } catch (terminateError) {
    ElMessage.error(terminateError instanceof ProviderError ? terminateError.message : '终止失败，暂不可确认')
  }
}

async function remove(row: unknown): Promise<void> {
  const item = row as EmployeeCompensationScheme
  if (!canWrite.value || item.locked) return
  try {
    await ElMessageBox.confirm(
      `确认删除 ${item.employee.name} 的薪酬方案？仅未形成考勤、提成或工资事实的方案可以删除，删除后不可恢复。`,
      '删除薪酬方案',
      { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  try {
    await financeApi.deleteEmployeeCompensation(item.id)
    ElMessage.success('薪酬方案已删除')
    await load()
  } catch (removeError) {
    ElMessage.error(removeError instanceof ProviderError ? removeError.message : '删除失败，暂不可确认')
  }
}

function onDrawerSaved(): void {
  drawerVisible.value = false
  void load()
}

function statusMeta(value: EmployeeCompensationScheme['status']): { label: string; tone: StatusTone } {
  if (value === 'active') return { label: '生效', tone: 'done' }
  if (value === 'expired') return { label: '失效', tone: 'muted' }
  return { label: '草稿', tone: 'todo' }
}

function effectiveRange(row: unknown): string {
  const item = row as EmployeeCompensationScheme
  return `${item.effectiveFrom || '待确认'} 至 ${item.effectiveTo || '长期'}`
}

function actorName(row: unknown): string {
  const item = row as EmployeeCompensationScheme
  return item.createdBy?.name || '创建人待确认'
}

function employeeRoleText(row: unknown): string {
  const role = (row as EmployeeCompensationScheme).employee.role
  return isEmployeeRole(role) ? roleLabel(role) : '岗位待确认'
}
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">薪酬方案</span>
        <h1>薪酬方案</h1>
        <p>维护员工月固定工资和月应出勤天数。方案形成考勤、提成或工资事实后自动锁定，调薪通过新增后续方案承接，历史工资事实不回写。</p>
      </div>
      <div class="finance-actions">
        <el-button @click="load">刷新</el-button>
        <el-button v-if="readOnly" plain disabled>本店只读</el-button>
        <el-button v-if="canWrite" type="primary" @click="openCreate">新增方案</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default><el-button size="small" plain @click="load">重新加载</el-button></template>
    </el-alert>

    <PanelCard flush>
      <div class="finance-toolbar">
        <div class="finance-filters">
          <el-input v-model="keyword" clearable placeholder="搜索员工姓名" style="width: 190px" @keyup.enter="applyFilters" @clear="applyFilters" />
          <el-select v-model="status" clearable placeholder="方案状态" style="width: 130px" @change="applyFilters">
            <el-option v-for="option in statusOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
          <el-date-picker v-model="effectiveMonth" type="month" value-format="YYYY-MM" placeholder="生效月份" style="width: 150px" @change="applyFilters" />
          <el-button @click="applyFilters">查询</el-button>
        </div>
        <div class="finance-toolbar__spacer" />
        <span class="finance-toolbar__result">{{ statusCount }}</span>
      </div>

      <SkeletonBlock v-if="loading && !rows.length" variant="table" :rows="6" />
      <EmptyState v-else-if="!loading && !rows.length" title="暂无薪酬方案" description="先为员工建立月固定工资和应出勤天数方案。" />
      <el-table v-else v-loading="loading" :data="rows" stripe>
        <el-table-column label="员工 / 岗位" min-width="180">
          <template #default="{ row }">
            <div class="finance-table__main">
              <span class="finance-table__title">{{ row.employee.name }}</span>
              <span class="finance-table__sub">{{ employeeRoleText(row) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="门店 / 团队" min-width="170">
          <template #default="{ row }">
            <div class="finance-table__main">
              <span class="finance-table__title">{{ row.employee.storeName || '门店待确认' }}</span>
              <span class="finance-table__sub">{{ row.employee.teamName || '未分团队' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="月固定工资" width="130">
          <template #default="{ row }"><MoneyText :value="row.baseSalary" /></template>
        </el-table-column>
        <el-table-column label="月应出勤" width="100">
          <template #default="{ row }">{{ row.scheduledDays }} 天</template>
        </el-table-column>
        <el-table-column label="有效期" min-width="210">
          <template #default="{ row }">{{ effectiveRange(row) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <div class="comp-scheme__tags">
              <StatusTag :text="statusMeta(row.status).label" :tone="statusMeta(row.status).tone" />
              <StatusTag v-if="row.locked" text="已锁定" tone="alert" />
            </div>
          </template>
        </el-table-column>
        <el-table-column label="创建 / 更新" min-width="170">
          <template #default="{ row }">
            <div class="finance-table__main">
              <span class="finance-table__title">{{ actorName(row) }}</span>
              <span class="finance-table__sub">{{ formatDateTime(row.updatedAt || row.createdAt) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <div class="comp-scheme__actions">
              <el-button v-if="canWrite" link type="primary" @click="openSuccessor(row)">新增后续方案</el-button>
              <template v-if="canWrite && !row.locked">
                <el-button link @click="openEdit(row)">编辑</el-button>
                <el-button link @click="terminate(row)">终止</el-button>
                <el-button link type="danger" @click="remove(row)">删除</el-button>
              </template>
              <span v-else-if="row.locked" class="comp-scheme__locked">事实已锁定</span>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="total > size" class="comp-scheme__pager">
        <el-pagination
          v-model:current-page="current"
          v-model:page-size="size"
          :page-sizes="[20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next"
          @current-change="load"
          @size-change="applyFilters"
        />
      </div>
    </PanelCard>

    <FinanceCompensationDrawer
      v-model:visible="drawerVisible"
      :scheme="drawerScheme"
      :mode="drawerMode"
      :store-id="scope.requestStoreId ?? undefined"
      @saved="onDrawerSaved"
    />
  </div>
</template>

<style scoped lang="scss">
.comp-scheme__tags,
.comp-scheme__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: $space-1;
}

.comp-scheme__actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.comp-scheme__locked {
  color: $text-tertiary;
  font-size: $font-caption;
}

.comp-scheme__pager {
  display: flex;
  justify-content: flex-end;
  padding: $space-3 $space-4;
  border-top: 1px solid $border-color;
}
</style>
