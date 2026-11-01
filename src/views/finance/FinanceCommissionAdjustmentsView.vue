<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import type { CommissionAdjustment, CommissionAdjustmentStatus, CommissionAdjustmentType } from '@/domains/finance/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import { useStoreScopeStore } from '@/stores/storeScope'

const scope = useStoreScopeStore()
const items = ref<CommissionAdjustment[]>([])
const loading = ref(false)
const error = ref('')
const total = ref(0)
const typeLabel: Record<CommissionAdjustmentType, string> = { refund: '退款冲减', resignation: '离职调整', crossPeriod: '跨期调整' }
const statusLabel: Record<CommissionAdjustmentStatus, string> = { pending: '待下期抵扣', included: '已入工资单', cancelled: '已取消' }
const statusType: Record<CommissionAdjustmentStatus, 'warning' | 'success' | 'info'> = { pending: 'warning', included: 'success', cancelled: 'info' }

onMounted(() => { void load() })
watch(() => scope.requestStoreId, () => { void load() })
async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const result = await financeApi.commissionAdjustments({ current: 1, size: 200, storeId: scope.requestStoreId ?? undefined })
    items.value = result.list
    total.value = result.total
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '负向调整暂不可确认'
  } finally { loading.value = false }
}

function adjustmentTypeLabel(value: unknown): string { return typeLabel[(value as CommissionAdjustment).type] }
function adjustmentStatusLabel(value: unknown): string { return statusLabel[(value as CommissionAdjustment).status] }
function adjustmentStatusType(value: unknown): 'warning' | 'success' | 'info' { return statusType[(value as CommissionAdjustment).status] }
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles"><span class="finance-eyebrow">提成负向调整</span><h1>提成负向调整</h1><p>退款、离职和跨期形成的负向金额，不反改已发放历史，统一进入下期工资抵扣。</p></div>
      <div class="finance-actions"><el-button @click="load">刷新</el-button></div>
    </header>
    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <PanelCard flush>
      <SkeletonBlock v-if="loading && !items.length" variant="table" :rows="6" />
      <EmptyState v-else-if="!loading && !items.length" title="暂无负向调整" description="客户退款、离职或跨期形成调整后会在这里展示。" />
      <el-table v-else :data="items" stripe>
        <el-table-column label="员工 / 项目" min-width="240"><template #default="{ row }"><div class="finance-table__main"><span class="finance-table__title">{{ row.employee.name }}</span><span class="finance-table__sub">{{ row.project?.name || '企业调整' }}</span></div></template></el-table-column>
        <el-table-column label="类型" width="120"><template #default="{ row }">{{ adjustmentTypeLabel(row) }}</template></el-table-column>
        <el-table-column label="状态" width="140"><template #default="{ row }"><el-tag :type="adjustmentStatusType(row)">{{ adjustmentStatusLabel(row) }}</el-tag></template></el-table-column>
        <el-table-column label="应抵扣" width="150"><template #default="{ row }"><MoneyText :value="-row.deductionAmount" delta /></template></el-table-column>
        <el-table-column label="已抵扣" width="150"><template #default="{ row }"><MoneyText :value="row.appliedAmount" /></template></el-table-column>
        <el-table-column prop="occurredAt" label="发生日期" width="130" />
        <el-table-column prop="remark" label="说明" min-width="200" show-overflow-tooltip />
      </el-table>
    </PanelCard>
  </div>
</template>
