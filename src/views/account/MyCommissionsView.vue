<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import { EMPLOYEE_COMMISSION_STATUS_META } from '@/domains/finance/meta'
import type { EmployeeCommissionItem, EmployeeCommissionStatus } from '@/domains/finance/model'
import EmptyState from '@/components/EmptyState.vue'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StatusTag from '@/components/StatusTag.vue'

/**
 * 我的提成（员工自助只读）。
 * 与 App `my-commission.vue` 共用 payroll/commission/page|info；服务端固定本人范围。
 */
const rows = ref<EmployeeCommissionItem[]>([])
const detail = ref<EmployeeCommissionItem | null>(null)
const detailVisible = ref(false)
const loading = ref(false)
const loadingDetail = ref(false)
const error = ref('')
const page = ref(1)
const pageSize = 20
const total = ref(0)

onMounted(() => { void load() })

function statusMeta(status: EmployeeCommissionStatus) {
  return EMPLOYEE_COMMISSION_STATUS_META[status] ?? EMPLOYEE_COMMISSION_STATUS_META.pendingAccrual
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const result = await financeApi.myEmployeeCommissions({ current: page.value, size: pageSize })
    rows.value = result.list
    total.value = result.total
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '提成暂不可确认'
  } finally {
    loading.value = false
  }
}

async function open(row: EmployeeCommissionItem): Promise<void> {
  detail.value = row
  detailVisible.value = true
  loadingDetail.value = true
  try {
    detail.value = await financeApi.myEmployeeCommissionInfo(row.id)
  } catch {
    // 保留列表事实；详情读取失败时不伪造金额或状态。
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
        <h1>我的提成</h1>
        <p>仅查看本人项目提成。提成由企业按主合同签约额计提，客户回款后按规则释放，本人不在此页操作。</p>
      </div>
      <div class="finance-actions">
        <el-button @click="load">刷新</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default><el-button size="small" plain @click="load">重新加载</el-button></template>
    </el-alert>

    <PanelCard title="本人提成" description="查看提成金额、释放与发放进度，点击记录查看完整构成。" flush>
      <SkeletonBlock v-if="loading && !rows.length" variant="table" :rows="4" />
      <EmptyState v-else-if="!loading && !rows.length" title="暂无本人提成" description="企业计提本人项目提成后，可在这里查看。" />
      <el-table v-else :data="rows" stripe highlight-current-row @row-click="open">
        <el-table-column label="项目" min-width="210">
          <template #default="{ row }">{{ row.project?.name || '企业提成' }}</template>
        </el-table-column>
        <el-table-column label="签约额" width="140"><template #default="{ row }"><MoneyText :value="row.contractAmount" /></template></el-table-column>
        <el-table-column label="比例" width="90"><template #default="{ row }">{{ row.manualRate }}%</template></el-table-column>
        <el-table-column label="提成金额" width="140"><template #default="{ row }"><MoneyText :value="row.commissionAmount" /></template></el-table-column>
        <el-table-column label="已释放" width="140"><template #default="{ row }"><MoneyText :value="row.releasedAmount" /></template></el-table-column>
        <el-table-column label="已发放" width="140"><template #default="{ row }"><MoneyText :value="row.paidAmount" /></template></el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <StatusTag :text="statusMeta(row.status).label" :tone="statusMeta(row.status).tone" />
          </template>
        </el-table-column>
      </el-table>
      <div v-if="total > pageSize" class="finance-pagination">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="load" />
      </div>
    </PanelCard>

    <el-dialog v-model="detailVisible" title="我的提成明细" width="580px">
      <SkeletonBlock v-if="loadingDetail" variant="card" :rows="3" />
      <template v-else-if="detail">
        <div class="commission-detail">
          <header>
            <div>
              <strong>{{ detail.project?.name || '企业提成' }}</strong>
              <span>主合同签约额 <MoneyText :value="detail.contractAmount" /> · {{ detail.manualRate }}%</span>
            </div>
            <StatusTag :text="statusMeta(detail.status).label" :tone="statusMeta(detail.status).tone" />
          </header>
          <dl>
            <div><dt>提成金额</dt><dd><MoneyText :value="detail.commissionAmount" /></dd></div>
            <div><dt>已计提</dt><dd><MoneyText :value="detail.accruedAmount" /></dd></div>
            <div><dt>已释放</dt><dd><MoneyText :value="detail.releasedAmount" /></dd></div>
            <div><dt>已发放</dt><dd><MoneyText :value="detail.paidAmount" /></dd></div>
            <div v-if="detail.remark" class="commission-detail__wide"><dt>备注</dt><dd>{{ detail.remark }}</dd></div>
          </dl>
        </div>
      </template>
      <EmptyState v-else title="提成明细暂不可确认" description="请关闭后重新打开该记录。" />
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.commission-detail header { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-4; padding-bottom: $space-3; border-bottom: 1px solid $border-color; }
.commission-detail header strong { display: block; color: $text-primary; font-size: $font-card-title; }
.commission-detail header span { display: block; margin-top: $space-1; color: $text-tertiary; font-size: $font-caption; }
.commission-detail dl { display: grid; grid-template-columns: 1fr 1fr; gap: $space-3; margin: $space-4 0 0; }
.commission-detail dl div { display: flex; justify-content: space-between; gap: $space-3; padding: $space-2 0; border-bottom: 1px dashed $border-color; }
.commission-detail dt { color: $text-tertiary; font-size: $font-caption; }
.commission-detail dd { margin: 0; color: $text-primary; font-weight: 600; }
.commission-detail__wide { grid-column: 1 / -1; }
</style>
