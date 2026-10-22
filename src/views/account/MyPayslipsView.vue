<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import { PAYSLIP_STATUS_META } from '@/domains/finance/meta'
import type { Payslip } from '@/domains/finance/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'

/**
 * 我的工资条（员工自助）。
 * 口径与 App `my-payroll.vue` 一致：**仅展示实际发放完成的工资条** —— 未发放的工资单对员工不可见。
 * 数据范围由服务端按登录员工裁决，页面不自算、不缓存他人数据。
 */
const payslips = ref<Payslip[]>([])
const detail = ref<Payslip | null>(null)
const detailVisible = ref(false)
const loading = ref(false)
const loadingDetail = ref(false)
const error = ref('')

onMounted(() => { void load() })

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const page = await financeApi.myPayslips({ current: 1, size: 100 })
    payslips.value = page.list
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '薪酬数据暂不可确认'
  } finally { loading.value = false }
}

async function open(item: Payslip): Promise<void> {
  detail.value = item
  detailVisible.value = true
  loadingDetail.value = true
  try {
    detail.value = await financeApi.myPayslipDetail(item.id)
  } catch {
    // 明细读取失败时保留列表事实，不伪造明细
  } finally { loadingDetail.value = false }
}
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">MY PAYSLIP · 我的薪酬</span>
        <h1>我的工资条</h1>
        <p>仅展示<strong>实际发放完成</strong>的工资条：未发放的工资单对员工不可见。金额按已确认工资单的实发口径展示。</p>
      </div>
      <div class="finance-actions">
        <el-button @click="load">刷新</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default><el-button size="small" plain @click="load">重新加载</el-button></template>
    </el-alert>

    <PanelCard title="已发放工资条" description="按工资周期倒序，点击查看应发、扣款与实发构成。" flush>
      <SkeletonBlock v-if="loading && !payslips.length" variant="table" :rows="5" />
      <EmptyState
        v-else-if="!loading && !payslips.length"
        title="暂无已发放工资条"
        description="工资单确认并发放完成后，工资条才会在这里出现。"
      />
      <el-table v-else :data="payslips" stripe highlight-current-row @row-click="open">
        <el-table-column prop="period" label="工资周期" width="140" />
        <el-table-column label="应发" width="160"><template #default="{ row }"><MoneyText :value="row.grossAmount" /></template></el-table-column>
        <el-table-column label="扣款" width="160"><template #default="{ row }"><MoneyText :value="row.deductionAmount" /></template></el-table-column>
        <el-table-column label="实发" width="160"><template #default="{ row }"><MoneyText :value="row.netAmount" size="lg" /></template></el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <StatusTag
              :text="row.status ? (PAYSLIP_STATUS_META[row.status]?.label || '待确认') : '待确认'"
              :tone="row.status ? (PAYSLIP_STATUS_META[row.status]?.tone || 'todo') : 'todo'"
            />
          </template>
        </el-table-column>
        <el-table-column label="发布时间" min-width="160"><template #default="{ row }">{{ row.publishedAt || '—' }}</template></el-table-column>
      </el-table>
    </PanelCard>

    <el-dialog v-model="detailVisible" title="工资条明细" width="560px">
      <SkeletonBlock v-if="loadingDetail" variant="card" :rows="3" />
      <template v-else-if="detail">
        <p class="payslip-detail__period">{{ detail.period }} · 实发工资</p>
        <dl class="payslip-detail__list">
          <div><dt>应发</dt><dd><MoneyText :value="detail.grossAmount" /></dd></div>
          <div><dt>扣款</dt><dd><MoneyText :value="detail.deductionAmount" /></dd></div>
          <div class="payslip-detail__net"><dt>实发</dt><dd><MoneyText :value="detail.netAmount" size="lg" /></dd></div>
        </dl>
        <p class="payslip-detail__hint">{{ detail.publishedAt ? `发布时间 ${detail.publishedAt}` : '发布时间待确认' }}</p>
      </template>
      <EmptyState v-else title="工资条明细暂不可确认" description="请关闭后重新打开该工资条。" />
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.payslip-detail__period { margin: 0 0 $space-3; color: $text-secondary; font-size: $font-body-sm; }
.payslip-detail__list { display: grid; gap: $space-2; margin: 0; }
.payslip-detail__list div { display: flex; align-items: center; justify-content: space-between; gap: $space-3; }
.payslip-detail__list dt { color: $text-tertiary; font-size: $font-caption; }
.payslip-detail__list dd { margin: 0; }
.payslip-detail__net { padding-top: $space-2; border-top: 1px solid $border-color; }
.payslip-detail__hint { margin: $space-3 0 0; color: $text-tertiary; font-size: $font-caption; }
</style>
