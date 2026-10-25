<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import { usePayrollAccess } from '@/domains/finance/payrollAccess'
import { payrollSheetStatusLabel, payrollSheetStatusTone } from '@/domains/finance/meta'
import type { PayrollWorkbenchReport } from '@/domains/finance/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import { useStoreScopeStore } from '@/stores/storeScope'

/**
 * 薪酬工作台（对齐 App `payroll/workbench.vue`）。
 * 首问：**这个月的薪酬走到哪一步了**——待发应付、待确认考勤、各状态工资单数、待发提成与工资条发布数。
 * 口径纪律：金额与计数全部取服务端报告；未登记状态显示「待确认」，不使用默认值兜底（ANT-010）。
 */
const router = useRouter()
const route = useRoute()
const scope = useStoreScopeStore()
const { canWrite, readOnly, role } = usePayrollAccess()
const report = ref<PayrollWorkbenchReport | null>(null)
const period = ref(localMonth())
const loading = ref(false)
const error = ref('')

const PERIOD_RE = /^\d{4}-\d{2}$/

onMounted(() => {
  // 深链接恢复：静态清单落地页为 /finance/payroll，周期走 ?period=，刷新/分享后必须回到同一周期。
  const fromQuery = String(route.query.period ?? '')
  void load(PERIOD_RE.test(fromQuery) ? fromQuery : undefined)
})
watch(() => scope.requestStoreId, () => { void load() })

function localMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

async function load(next?: string): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const value = await financeApi.payrollWorkbench(next ?? period.value, scope.requestStoreId ?? undefined)
    report.value = value
    if (value.period) {
      period.value = value.period
      // 周期写回 URL，保证刷新/深链接可恢复（contextRecovery.deepLink）。
      if (String(route.query.period ?? '') !== value.period) {
        void router.replace({ query: { ...route.query, period: value.period } })
      }
    }
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '薪酬数据暂不可确认'
  } finally { loading.value = false }
}

/** 与 App 同口径：当前周期没有工资单、但存在历史最新工资单时，给出「最近一次」兜底入口。 */
const showLatestSheet = computed(() => {
  const value = report.value
  return Boolean(value?.latestSheetId) && !value?.currentPeriodHasSheet && value?.latestSheetPeriod !== value?.period
})

const pendingPaySheetCount = computed(() => (report.value?.confirmedSheetCount ?? 0) + (report.value?.partialPaidSheetCount ?? 0))
const isStoreScope = computed(() => role.value === 'StoreManager')

const stats = computed(() => [
  { key: 'attendance', label: '待确认考勤', value: String(report.value?.pendingAttendanceCount ?? 0), hint: '考勤未确认时工资单不能确认' },
  { key: 'draft', label: '工资单草稿', value: String(report.value?.draftSheetCount ?? 0), hint: '草稿可重新生成或删除' },
  { key: 'pending', label: '待发放工资单', value: String(pendingPaySheetCount.value), hint: '已确认 + 部分发放' },
  { key: 'payslip', label: '已发布工资条', value: String(report.value?.publishedPayslipCount ?? 0), hint: `待发布 ${report.value?.pendingPayslipCount ?? 0}` }
])

function open(path: string): void { void router.push(path) }
function openLatestSheet(): void {
  if (!report.value?.latestSheetId) return
  void router.push('/finance/employee-salaries')
}
function openAllSheets(): void { void router.push('/finance/employee-salaries') }
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">PAYROLL · 员工薪酬</span>
        <h1>薪酬工作台</h1>
        <p>回答一句话：<strong>这个月的薪酬走到哪一步了</strong>。金额与计数全部取业务报告；工资条在<strong>发放完成后</strong>才对员工可见。</p>
      </div>
      <div class="finance-actions">
        <el-date-picker v-model="period" type="month" value-format="YYYY-MM" style="width:130px" @change="load()" />
        <el-button @click="load()">刷新</el-button>
        <el-button v-if="readOnly" plain disabled>本店财务只读</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default><el-button size="small" plain @click="load()">重新加载</el-button></template>
    </el-alert>

    <SkeletonBlock v-if="loading && !report" variant="card" :rows="4" />

    <template v-else-if="report">
      <section class="finance-hero" aria-label="薪酬摘要">
        <div class="finance-hero__lead">
          <span>{{ report.period }} 待发员工薪酬</span>
          <strong><MoneyText :value="report.pendingEmployeePayableAmount" size="lg" /></strong>
          <small>工资与提成分别结算、分别发放；待发金额按应付金额计算。</small>
        </div>
        <div class="finance-metric">
          <span>已释放未发提成</span>
          <strong><MoneyText :value="report.releasedUnpaidCommissionAmount" size="lg" /></strong>
          <small>提成不并入工资单确认</small>
        </div>
        <div class="finance-metric">
          <span>待发布工资条</span>
          <strong>{{ report.pendingPayslipCount }}</strong>
          <small>发放完成后自动发布</small>
        </div>
        <div class="finance-metric">
          <span>本周期工资单</span>
          <strong>{{ report.currentPeriodHasSheet ? '已生成' : '未生成' }}</strong>
          <small>已发放 {{ report.paidSheetCount }} 张</small>
        </div>
      </section>

      <PanelCard v-if="showLatestSheet" title="当前周期暂无工资单" :description="`最近一次：${report.latestSheetPeriod || '—'} · 实发 ${report.latestSheetTotalNetAmount}`">
        <template #extra>
          <div class="finance-actions">
            <StatusTag :text="payrollSheetStatusLabel(report.latestSheetStatus || '')" :tone="payrollSheetStatusTone(report.latestSheetStatus || '')" />
            <el-button size="small" type="primary" plain @click="openLatestSheet">查看最近工资单</el-button>
            <el-button size="small" @click="openAllSheets">全部工资单</el-button>
          </div>
        </template>
        <p class="payroll-hint">本月还没有工资单。可先确认月度考勤与薪酬方案，再在「员工工资」页生成工资单草稿；不会自动补建。</p>
      </PanelCard>

      <section class="finance-kpis" aria-label="薪酬进度">
        <article v-for="stat in stats" :key="stat.key" class="finance-kpi">
          <span>{{ stat.label }}</span>
          <strong>{{ stat.value }}</strong>
          <small>{{ stat.hint }}</small>
        </article>
      </section>

      <PanelCard title="薪酬入口" description="Web 侧把考勤、薪酬方案与员工发放收在「员工工资」页内统一承接；可进入的范围由当前账号权限与数据范围裁决。" flush>
        <div class="finance-list">
          <div class="finance-list__row">
            <div class="finance-list__main static">
              <strong>员工工资</strong>
              <span>生成工资单、确认前置校验、月度考勤、薪酬方案、员工发放</span>
            </div>
            <el-button size="small" type="primary" plain @click="open('/finance/employee-salaries')">进入</el-button>
          </div>
          <div class="finance-list__row">
            <div class="finance-list__main static">
              <strong>员工提成</strong>
              <span>提成明细与新增；提成与工资独立结算、独立发放</span>
            </div>
            <el-button size="small" type="primary" plain @click="open('/finance/employee-commissions')">进入</el-button>
          </div>
          <div class="finance-list__row">
            <div class="finance-list__main static">
              <strong>提成负向调整</strong>
              <span>退款冲减、离职调整、跨期调整进入下期工资</span>
            </div>
            <el-button size="small" type="primary" plain @click="open('/finance/commission-adjustments')">进入</el-button>
          </div>
          <div v-if="isStoreScope" class="finance-list__row">
            <div class="finance-list__main static">
              <strong>本店薪酬</strong>
              <span>仅查看本店员工工资构成（只读）</span>
            </div>
            <el-button size="small" type="primary" plain @click="open('/finance/store-payroll')">进入</el-button>
          </div>
        </div>
      </PanelCard>

      <el-alert
        v-if="!canWrite"
        type="info"
        :closable="false"
        show-icon
        title="当前角色只读：可查看薪酬报告与工资单，写动作（生成/确认/发放）按当前账号权限执行"
      />
    </template>
  </div>
</template>

<style scoped lang="scss">
.payroll-hint { margin: 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
.finance-list__main.static { cursor: default; }
</style>
