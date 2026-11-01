<script setup lang="ts">
/**
 * 业务员「我的预约量房」——App 侧对应 `customer/pages/measure-workbench`（业务员标题「我的预约量房」）。
 *
 * 能力边界（App `roles/permission.ts#marketer`）：
 * - 能：查看本人客户的量房事项、去**预约/调整量房**（`customer/customer/measure`，`Self`）；
 * - 不能：录量房结论（指定设计师）、指派/改派设计师（店长/团队长/负责人）→ 本页「待派单」只展示与提示，不给越权动作。
 *
 * 数据来源：`statistic/boss/measure/report`（**App 已在用**，非新开接口）；服务端按登录角色裁剪范围，
 * 业务员得到本人客户，因此本页**不做分组面板**（App 也只有跨业务员看板角色才显示分组）。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ProviderError } from '@/core/http'
import { workbenchApi } from '@/domains/workbench/api'
import type { MeasureAppointmentItem, MeasureAppointmentReport } from '@/domains/workbench/model'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'

type FilterKey = 'all' | 'notScheduled' | 'scheduled' | 'unassigned' | 'overdue4h' | 'completed'

const router = useRouter()
const report = ref<MeasureAppointmentReport | null>(null)
const loading = ref(false)
const error = ref('')
const filter = ref<FilterKey>('all')

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'notScheduled', label: '未预约' },
  { key: 'scheduled', label: '已预约' },
  { key: 'unassigned', label: '待派单' },
  { key: 'overdue4h', label: '逾期' },
  { key: 'completed', label: '已完成' }
]

/** 与 App `measure-workbench` 的 `overdue()` 同口径：预约后 4 小时未完成即逾期。 */
function overdue(item: MeasureAppointmentItem): boolean {
  if (!item.scheduledAt || item.completedAt) return false
  return new Date(item.scheduledAt.replace(' ', 'T')).getTime() + 4 * 3600 * 1000 < Date.now()
}

/** 与 App `matchesFilter()` 同口径（服务端 derivedState 为准，前端只做筛选）。 */
function matchesFilter(item: MeasureAppointmentItem, key: FilterKey): boolean {
  if (key === 'all') return true
  if (key === 'notScheduled') return item.derivedState === 'NotScheduled'
  if (key === 'unassigned') return Boolean(item.scheduledAt) && !item.completedAt && !item.designerId
  if (key === 'scheduled') return Boolean(item.scheduledAt) && !item.completedAt
  if (key === 'overdue4h') return item.derivedState === 'Overdue' || (item.derivedState === 'Unassigned' && overdue(item))
  if (key === 'completed') return Boolean(item.completedAt)
  return true
}

const items = computed(() => (report.value?.items ?? []).filter((item) => matchesFilter(item, filter.value)))
const counts = computed(() => {
  const list = report.value?.items ?? []
  return {
    all: list.length,
    notScheduled: list.filter((item) => matchesFilter(item, 'notScheduled')).length,
    scheduled: list.filter((item) => matchesFilter(item, 'scheduled')).length,
    unassigned: list.filter((item) => matchesFilter(item, 'unassigned')).length,
    overdue4h: list.filter((item) => matchesFilter(item, 'overdue4h')).length,
    completed: list.filter((item) => matchesFilter(item, 'completed')).length
  }
})

const summary = computed(() => {
  const data = report.value
  if (!data) return []
  return [
    { label: '量房事项', value: data.itemCount },
    { label: '今日预约', value: data.todayCount },
    { label: '已预约未完成', value: data.scheduledCount },
    { label: '待派单', value: data.unassignedCount, hint: '设计师指派由店长/负责人执行' },
    { label: '预约逾期', value: data.overdue4hCount, danger: data.overdue4hCount > 0 },
    { label: '已完成', value: data.completedCount },
    { label: '风险事项', value: data.riskCount, danger: data.riskCount > 0 }
  ]
})

function addressText(value: unknown): string {
  const item = value as MeasureAppointmentItem
  return item.address || [item.community, item.building, item.roomNo].filter(Boolean).join(' ') || '地址待补充'
}

function timeText(value: unknown): string {
  const item = value as MeasureAppointmentItem
  if (item.completedAt) return `完成 ${item.completedAt.slice(5, 16)}`
  if (item.scheduledAt) return `预约 ${item.scheduledAt.slice(5, 16)}`
  return '尚未预约量房'
}

function riskTone(value: unknown): 'blocked' | 'pending' | 'done' | 'info' {
  if (value === 'Danger') return 'blocked'
  if (value === 'Warning') return 'pending'
  if (value === 'Unknown') return 'info'
  return 'done'
}

function stateTone(value: unknown): 'todo' | 'doing' | 'done' | 'blocked' | 'info' {
  const item = value as MeasureAppointmentItem
  if (item.derivedState === 'NotScheduled') return 'todo'
  if (item.derivedState === 'Overdue' || item.riskLevel === 'Danger') return 'blocked'
  if (item.completedAt) return 'done'
  return 'doing'
}

/** 多起点进入同一客户对象：统一打开客户 360 独立页面。 */
function openCustomer(value: unknown): void {
  const item = value as MeasureAppointmentItem
  void router.push(`/workbench/customers/${item.customerId}`)
}

/** 主行动：去「我的客户」页对同一客户发起/调整量房（复用该页已有的房屋选择与时间校验）。 */
function goScheduleMeasure(value: unknown): void {
  const item = value as MeasureAppointmentItem
  void router.push({ path: '/workbench/my-customers', query: { customerId: item.customerId, action: 'measure' } })
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    report.value = await workbenchApi.measureAppointmentReport()
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '量房事项暂不可确认'
  } finally {
    loading.value = false
  }
}

onMounted(() => { void load() })
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">我的预约量房</span>
        <h1>我的预约量房</h1>
        <p>只列出本人客户的量房事项：预约、逾期、待派单与已完成。录量房结论由指定设计师执行，指派设计师由店长或企业负责人执行——这两件事不在业务员范围。</p>
      </div>
      <div class="finance-actions">
        <el-button @click="load">刷新</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default><el-button size="small" plain @click="load">重新加载</el-button></template>
    </el-alert>

    <PanelCard v-if="report" flush>
      <div class="measure-summary">
        <div v-for="item in summary" :key="item.label" class="measure-summary__item">
          <span class="measure-summary__label">{{ item.label }}</span>
          <strong class="measure-summary__value" :class="{ 'measure-summary__value--danger': item.danger }">{{ item.value }}</strong>
          <small v-if="item.hint" class="measure-summary__hint">{{ item.hint }}</small>
        </div>
      </div>

      <div class="measure-filters" role="tablist" aria-label="量房事项筛选">
        <el-radio-group v-model="filter" size="small">
          <el-radio-button v-for="item in FILTERS" :key="item.key" :value="item.key">
            {{ item.label }}（{{ counts[item.key] }}）
          </el-radio-button>
        </el-radio-group>
        <span v-if="report.asOf" class="measure-asof">数据截至 {{ report.asOf }}</span>
      </div>

      <SkeletonBlock v-if="loading && !report.items.length" variant="table" :rows="6" />
      <EmptyState
        v-else-if="!items.length"
        :title="filter === 'all' ? '暂时没有量房事项' : '该筛选下没有量房事项'"
        :description="filter === 'all' ? '客户进入待量房并按约时间后，这里会出现量房事项。' : '切换其它筛选项查看。'"
      />
      <el-table v-else :data="items" stripe>
        <el-table-column label="客户" min-width="180">
          <template #default="{ row }">
            <div class="finance-table__main">
              <span class="finance-table__title">{{ row.customerName }}</span>
              <span class="finance-table__sub">{{ row.telNo || '未填电话' }} · {{ row.sourceName || '来源待补' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="房屋" min-width="200">
          <template #default="{ row }">
            <div class="finance-table__main">
              <span class="finance-table__title">{{ addressText(row) }}</span>
              <span class="finance-table__sub">
                {{ row.propertyStatusName || '房屋状态待补' }}<template v-if="row.area"> · {{ row.area }}㎡</template>
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="量房状态" width="130">
          <template #default="{ row }"><StatusTag :text="row.derivedStateName" :tone="stateTone(row)" /></template>
        </el-table-column>
        <el-table-column label="预约时间" width="150">
          <template #default="{ row }">{{ timeText(row) }}</template>
        </el-table-column>
        <el-table-column label="设计师" width="120">
          <template #default="{ row }">{{ row.designerName || '待派单' }}</template>
        </el-table-column>
        <el-table-column label="风险" width="100">
          <template #default="{ row }">
            <StatusTag v-if="row.riskLevel !== 'Normal'" :text="row.riskLevel === 'Danger' ? '高风险' : row.riskLevel === 'Warning' ? '需关注' : '待确认'" :tone="riskTone(row.riskLevel)" />
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="系统建议" min-width="180">
          <template #default="{ row }">{{ row.nextAction || '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <div class="finance-actions">
              <el-button v-if="!row.completedAt" link type="primary" @click.stop="goScheduleMeasure(row)">{{ row.scheduledAt ? '调整量房' : '预约量房' }}</el-button>
              <el-button link @click.stop="openCustomer(row)">查看客户</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </PanelCard>

    <SkeletonBlock v-else-if="loading" variant="table" :rows="6" />
  </div>
</template>

<style scoped lang="scss">
.measure-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: $space-3;
  padding: $space-4;
  border-bottom: 1px solid $border-color;
}

.measure-summary__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.measure-summary__label {
  font-size: $font-caption;
  color: $text-secondary;
}

.measure-summary__value {
  font-size: $font-title;
}

.measure-summary__value--danger {
  color: $danger-500;
}

.measure-summary__hint {
  font-size: $font-caption;
  color: $text-tertiary;
}

.measure-filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
  padding: $space-3 $space-4;
  border-bottom: 1px solid $border-color;
  overflow-x: auto;
}

.measure-asof {
  flex-shrink: 0;
  font-size: $font-caption;
  color: $text-tertiary;
}
</style>
