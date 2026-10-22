<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ProviderError } from '@/core/http'
import { carryoverApi } from '@/domains/carryover/api'
import type { CarryoverBatch, CarryoverProject } from '@/domains/carryover/model'
import EmptyState from '@/components/EmptyState.vue'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'

/**
 * 店长在跑项目承接代确认（DEC-076）。
 *
 * 店长只能处理本店项目；确认顺序：项目范围（Boss）→ 期初财务（Finance）→ 当前工地（Pm）→ 生成项目。
 * 这里使用单一主行动完成本店代确认；服务端仍逐项校验门店范围、待补齐事项和幂等。
 */
const batch = ref<CarryoverBatch | null>(null)
const projects = ref<CarryoverProject[]>([])
const loading = ref(false)
const error = ref('')
const busyId = ref('')
const actionError = ref('')
const success = ref('')

const hasBatch = computed(() => !!batch.value?.id)
const pendingCount = computed(() => projects.value.filter((item) => !['Applied', 'Locked', 'Cancelled'].includes(item.status)).length)
const completedCount = computed(() => projects.value.filter((item) => ['Applied', 'Locked'].includes(item.status)).length)

onMounted(() => { void load() })

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const info = await carryoverApi.batchInfo()
    batch.value = info.id ? info : null
    projects.value = info.id ? await carryoverApi.page() : []
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '承接状态暂不可确认'
  } finally {
    loading.value = false
  }
}

function statusLabel(status: string): string {
  return ({
    Draft: '待补齐',
    Ready: '待确认',
    Confirmed: '可承接',
    Applied: '已承接',
    Locked: '已续营',
    Cancelled: '已取消'
  } as Record<string, string>)[status] || status
}

function canConfirm(item: CarryoverProject): boolean {
  return item.carryoverReady && !['Applied', 'Locked', 'Cancelled'].includes(item.status)
}

async function confirmAndBuild(item: CarryoverProject): Promise<void> {
  if (!canConfirm(item)) return
  busyId.value = item.id
  actionError.value = ''
  success.value = ''
  try {
    await carryoverApi.confirm(item.id, 'Boss', '本店店长代确认项目范围')
    await carryoverApi.confirm(item.id, 'Finance', '本店店长代确认期初应收、应付与成本状态')
    await carryoverApi.confirm(item.id, 'Pm', '本店店长代确认当前工地状态')
    await carryoverApi.build(item.id)
    success.value = `${item.customerName || item.contractNo} 已承接，可在项目与财务继续经营`
    await load()
  } catch (confirmError) {
    actionError.value = confirmError instanceof ProviderError ? confirmError.message : '承接代确认失败，请检查待补齐事项'
  } finally {
    busyId.value = ''
  }
}
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">STORE CARRYOVER · 本店业务承接</span>
        <h1>在跑项目承接</h1>
        <p>企业负责人建立承接任务后，店长可在<b>本店范围</b>内代确认项目范围、期初财务和当前工地；确认完整后生成项目。</p>
      </div>
      <div class="finance-actions">
        <el-button @click="load">刷新</el-button>
      </div>
    </header>

    <div v-if="loading" class="finance-stack"><SkeletonBlock variant="card" :rows="4" /></div>
    <EmptyState v-else-if="error" title="承接状态暂不可确认" :description="error" />
    <EmptyState v-else-if="!hasBatch" title="尚未建立业务承接任务" description="请企业负责人先在业务承接中建立批次并录入在跑项目。" />
    <template v-else>
      <section class="finance-kpis">
        <article class="finance-kpi"><span>待处理</span><strong>{{ pendingCount }}</strong><small>本店待确认/待承接</small></article>
        <article class="finance-kpi"><span>已完成</span><strong>{{ completedCount }}</strong><small>已承接/已续营</small></article>
        <article class="finance-kpi"><span>接管日期</span><strong class="store-carryover__date">{{ batch?.asOfDate || '未设置' }}</strong><small>企业负责人建立批次时确定</small></article>
      </section>

      <p v-if="success" class="store-carryover__success">{{ success }}</p>
      <p v-if="actionError" class="store-carryover__error">{{ actionError }}</p>

      <PanelCard title="本店在跑项目" description="只显示本店范围；待补齐事项会在保存时核对，重复操作不会产生重复记录。" flush>
        <EmptyState v-if="!projects.length" title="暂无本店在跑项目" description="由企业负责人录入后在此代确认。" />
        <el-table v-else :data="projects" stripe>
          <el-table-column label="客户 / 项目" min-width="220">
            <template #default="{ row }">
              <div class="store-carryover__name">{{ row.customerName || '未命名客户' }}</div>
              <div class="store-carryover__sub">{{ row.community || row.address }} · {{ row.contractNo || '无合同号' }}</div>
            </template>
          </el-table-column>
          <el-table-column label="当前合同额" width="140" align="right">
            <template #default="{ row }"><MoneyText :value="row.currentAmount" /></template>
          </el-table-column>
          <el-table-column label="未收" width="130" align="right">
            <template #default="{ row }"><MoneyText :value="row.receivableOutstanding" /></template>
          </el-table-column>
          <el-table-column label="未付" width="130" align="right">
            <template #default="{ row }"><MoneyText :value="row.payableOutstanding" /></template>
          </el-table-column>
          <el-table-column label="成本" width="110">
            <template #default="{ row }">{{ row.costStatus === 'Complete' ? '已确认' : row.costStatus === 'TotalOnly' ? '仅总额' : '待确认' }}</template>
          </el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="{ row }">{{ statusLabel(row.status) }}</template>
          </el-table-column>
          <el-table-column label="待补齐" min-width="220">
            <template #default="{ row }">
              <span v-if="!row.validationBlockers.length" class="store-carryover__ok">已具备承接条件</span>
              <span v-else class="store-carryover__blockers">{{ row.validationBlockers.join('、') }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="canConfirm(row as CarryoverProject)"
                type="primary"
                size="small"
                :loading="busyId === row.id"
                @click="confirmAndBuild(row as CarryoverProject)"
              >代确认并承接</el-button>
              <span v-else-if="row.projectId" class="store-carryover__sub">已生成项目</span>
              <span v-else class="store-carryover__sub">待补齐</span>
            </template>
          </el-table-column>
        </el-table>
      </PanelCard>
    </template>
  </div>
</template>

<style scoped lang="scss">
.store-carryover__date { font-size: $font-title; }
.store-carryover__name { color: $text-primary; font-weight: $font-weight-semibold; }
.store-carryover__sub { color: $text-secondary; font-size: $font-caption; }
.store-carryover__ok { color: $text-secondary; font-size: $font-body-sm; font-weight: $font-weight-semibold; }
.store-carryover__blockers { color: $warning-700; font-size: $font-body-sm; }
.store-carryover__success { margin: 0 0 $space-4; padding: $space-3 $space-4; border-radius: $radius-sm; background: $success-50; color: $success-500; font-size: $font-body-sm; }
.store-carryover__error { margin: 0 0 $space-4; padding: $space-3 $space-4; border-radius: $radius-sm; background: $danger-50; color: $danger-500; font-size: $font-body-sm; }
</style>
