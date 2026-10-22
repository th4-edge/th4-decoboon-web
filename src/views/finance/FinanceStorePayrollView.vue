<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import { useFinanceScopeStore } from '@/stores/financeScope'
import { PAYROLL_ITEM_STATUS_META } from '@/domains/finance/meta'
import type { EmployeePayrollItem } from '@/domains/finance/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'

/**
 * 本店薪酬（BOSS、财务、店长按服务端数据范围查看）。
 * 口径与 App `store-payroll.vue` 一致：**仅显示本店员工工资构成**，数据范围由服务端按登录员工裁决。
 * 页面只读：工资单的生成/确认/发放在本店无关，且确认动作仅企业负责人可执行（DEC-046 APP-PAY-03/08）。
 */
const items = ref<EmployeePayrollItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')
const page = ref(1)
const total = ref(0)
const hasMore = ref(false)
const PAGE_SIZE = 50

onMounted(() => { void load(1) })
const scope = useFinanceScopeStore()
// P1-a2：切换门店维度后重新取数（全部门店不传参，绝不传状态值 '0'）
watch(() => scope.requestStoreId, () => { void load(1) })

async function load(target: number): Promise<void> {
  if (target === 1) loading.value = true
  else loadingMore.value = true
  error.value = ''
  try {
    const result = await financeApi.storePayrollItems({ current: target, size: PAGE_SIZE, storeId: scope.requestStoreId ?? undefined })
    items.value = target === 1 ? result.list : [...items.value, ...result.list]
    total.value = result.total
    hasMore.value = result.hasMore
    page.value = target
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '本店薪酬暂不可确认'
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">STORE PAYROLL · 本店薪酬</span>
        <h1>本店薪酬</h1>
        <p>仅显示本店员工的工资构成（应发、扣款、实发与工资项状态）。仅显示当前账号可查看的本店工资；工资单的确认动作仅企业负责人可执行。</p>
      </div>
      <div class="finance-actions">
        <span class="finance-page__count">共 {{ total }} 条</span>
        <el-button @click="load(1)">刷新</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default><el-button size="small" plain @click="load(1)">重新加载</el-button></template>
    </el-alert>

    <PanelCard title="本店工资明细" description="工资单确认后，本店员工明细按项目/企业归属展示。" flush>
      <SkeletonBlock v-if="loading && !items.length" variant="table" :rows="6" />
      <EmptyState
        v-else-if="!loading && !items.length"
        title="暂无本店工资记录"
        description="工资单确认后，本店员工明细会显示在这里。"
      />
      <template v-else>
        <el-table :data="items" stripe>
          <el-table-column label="员工 / 归属" min-width="220">
            <template #default="{ row }">
              <div class="finance-table__main">
                <span class="finance-table__title">{{ row.employee.name || '员工待确认' }}</span>
                <span class="finance-table__sub">{{ row.project?.name || '企业费用' }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="应发" width="150"><template #default="{ row }"><MoneyText :value="row.grossAmount" /></template></el-table-column>
          <el-table-column label="扣款" width="150"><template #default="{ row }"><MoneyText :value="row.deductionAmount" /></template></el-table-column>
          <el-table-column label="实发" width="150"><template #default="{ row }"><MoneyText :value="row.netAmount" size="lg" /></template></el-table-column>
          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <StatusTag :text="PAYROLL_ITEM_STATUS_META[row.status]?.label || '待确认'" :tone="PAYROLL_ITEM_STATUS_META[row.status]?.tone || 'todo'" />
            </template>
          </el-table-column>
        </el-table>
        <div v-if="hasMore" class="finance-more">
          <el-button :loading="loadingMore" @click="load(page + 1)">加载更多</el-button>
        </div>
      </template>
    </PanelCard>
  </div>
</template>

<style scoped lang="scss">
.finance-page__count { color: $text-tertiary; font-size: $font-caption; }
.finance-more { display: flex; justify-content: center; padding: $space-3 0; }
</style>
