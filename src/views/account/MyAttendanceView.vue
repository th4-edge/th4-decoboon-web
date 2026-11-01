<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import { EMPLOYEE_ATTENDANCE_STATUS_META } from '@/domains/finance/meta'
import type { EmployeeAttendanceStatus, EmployeeAttendanceSummary } from '@/domains/finance/model'
import EmptyState from '@/components/EmptyState.vue'
import PanelCard from '@/components/PanelCard.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StatusTag from '@/components/StatusTag.vue'

/**
 * 我的考勤（员工自助只读）。
 * 与 App `my-attendance.vue` 共用 attendance/summary/page|info；服务端固定本人范围。
 */
const month = ref(localMonth())
const rows = ref<EmployeeAttendanceSummary[]>([])
const detail = ref<EmployeeAttendanceSummary | null>(null)
const detailVisible = ref(false)
const loading = ref(false)
const loadingDetail = ref(false)
const error = ref('')

function localMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function attendanceStatusMeta(status: EmployeeAttendanceStatus) {
  return EMPLOYEE_ATTENDANCE_STATUS_META[status] ?? EMPLOYEE_ATTENDANCE_STATUS_META.draft
}

onMounted(() => { void load() })

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    rows.value = (await financeApi.myEmployeeAttendances({ month: month.value, current: 1, size: 20 })).list
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '考勤暂不可确认'
  } finally {
    loading.value = false
  }
}

async function open(row: EmployeeAttendanceSummary): Promise<void> {
  detail.value = row
  detailVisible.value = true
  loadingDetail.value = true
  try {
    detail.value = await financeApi.myEmployeeAttendanceInfo(row.id)
  } catch {
    // 保留列表事实；详情读取失败时不伪造记录。
  } finally {
    loadingDetail.value = false
  }
}
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">我的薪酬</span>
        <h1>我的考勤</h1>
        <p>仅查看本人月度出勤与确认结果。考勤由企业薪酬负责人录入，本人不在此页编辑或确认。</p>
      </div>
      <div class="finance-actions">
        <el-date-picker v-model="month" type="month" value-format="YYYY-MM" format="YYYY年MM月" placeholder="选择月份" @change="load" />
        <el-button @click="load">刷新</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default><el-button size="small" plain @click="load">重新加载</el-button></template>
    </el-alert>

    <PanelCard title="本人月度考勤" description="点击记录查看应出勤、异常天数、确认人和确认时间。" flush>
      <SkeletonBlock v-if="loading && !rows.length" variant="table" :rows="4" />
      <EmptyState v-else-if="!loading && !rows.length" title="本月暂无本人考勤" description="企业负责人录入并确认后，可在这里查看。" />
      <el-table v-else :data="rows" stripe highlight-current-row @row-click="open">
        <el-table-column prop="payrollMonth" label="工资月份" width="130" />
        <el-table-column prop="scheduledDays" label="应出勤" width="100" />
        <el-table-column prop="normalDays" label="正常出勤" width="110" />
        <el-table-column prop="personalLeaveDays" label="事假" width="90" />
        <el-table-column prop="sickLeaveDays" label="病假" width="90" />
        <el-table-column prop="absenceDays" label="旷工" width="90" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <StatusTag :text="attendanceStatusMeta(row.status).label" :tone="attendanceStatusMeta(row.status).tone" />
          </template>
        </el-table-column>
        <el-table-column label="确认信息" min-width="220">
          <template #default="{ row }">{{ row.confirmedBy?.name || '确认人待确认' }} · {{ row.confirmedAt || '确认时间待确认' }}</template>
        </el-table-column>
      </el-table>
    </PanelCard>

    <el-dialog v-model="detailVisible" title="我的考勤明细" width="560px">
      <SkeletonBlock v-if="loadingDetail" variant="card" :rows="3" />
      <template v-else-if="detail">
        <div class="attendance-detail">
          <header>
            <div>
              <strong>{{ detail.payrollMonth }}</strong>
              <span>本人月度考勤</span>
            </div>
            <StatusTag :text="attendanceStatusMeta(detail.status).label" :tone="attendanceStatusMeta(detail.status).tone" />
          </header>
          <dl>
            <div><dt>应出勤</dt><dd>{{ detail.scheduledDays }} 天</dd></div>
            <div><dt>正常出勤</dt><dd>{{ detail.normalDays }} 天</dd></div>
            <div><dt>事假</dt><dd>{{ detail.personalLeaveDays }} 天</dd></div>
            <div><dt>病假</dt><dd>{{ detail.sickLeaveDays }} 天</dd></div>
            <div><dt>旷工</dt><dd>{{ detail.absenceDays }} 天</dd></div>
            <div><dt>外勤</dt><dd>{{ detail.externalDays }} 天</dd></div>
            <div><dt>年假</dt><dd>{{ detail.annualLeaveDays }} 天</dd></div>
            <div><dt>调休</dt><dd>{{ detail.compLeaveDays }} 天</dd></div>
            <div><dt>确认人</dt><dd>{{ detail.confirmedBy?.name || '待确认' }}</dd></div>
            <div><dt>确认时间</dt><dd>{{ detail.confirmedAt || '待确认' }}</dd></div>
            <div v-if="detail.remark" class="attendance-detail__wide"><dt>备注</dt><dd>{{ detail.remark }}</dd></div>
          </dl>
        </div>
      </template>
      <EmptyState v-else title="考勤明细暂不可确认" description="请关闭后重新打开该记录。" />
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.attendance-detail header { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-4; padding-bottom: $space-3; border-bottom: 1px solid $border-color; }
.attendance-detail header strong { display: block; color: $text-primary; font-size: $font-card-title; }
.attendance-detail header span { display: block; margin-top: $space-1; color: $text-tertiary; font-size: $font-caption; }
.attendance-detail dl { display: grid; grid-template-columns: 1fr 1fr; gap: $space-3; margin: $space-4 0 0; }
.attendance-detail dl div { display: flex; justify-content: space-between; gap: $space-3; padding: $space-2 0; border-bottom: 1px dashed $border-color; }
.attendance-detail dt { color: $text-tertiary; font-size: $font-caption; }
.attendance-detail dd { margin: 0; color: $text-primary; font-weight: 600; }
.attendance-detail__wide { grid-column: 1 / -1; }
</style>
