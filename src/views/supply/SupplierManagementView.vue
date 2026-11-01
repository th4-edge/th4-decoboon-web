<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '@/components/EmptyState.vue'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StatusTag from '@/components/StatusTag.vue'
import SupplierFormDrawer from '@/components/supply/SupplierFormDrawer.vue'
import { supplyApi } from '@/domains/supply/api'
import type { SupplierPartner, SupplierPartnerStatus, SupplierPartnerType } from '@/domains/supply/model'
import { useSessionStore } from '@/stores/session'

const session = useSessionStore()
const router = useRouter()
const items = ref<SupplierPartner[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(false)
const error = ref('')
const createOpen = ref(false)

const filters = reactive<{
  keyword: string
  type: SupplierPartnerType | 'all'
  status: SupplierPartnerStatus | 'all'
}>({
  keyword: '',
  type: 'all',
  status: 'all'
})

const canWrite = computed(() => ['Boss', 'StoreManager', 'Finance'].includes(session.role ?? ''))
const typeOptions: Array<{ value: SupplierPartnerType; label: string }> = [
  { value: 'supplier', label: '材料供应商' },
  { value: 'factory', label: '厂家' },
  { value: 'laborTeam', label: '劳务班组' },
  { value: 'installer', label: '安装服务' },
  { value: 'logistics', label: '物流' },
  { value: 'service', label: '其他服务' }
]
const statusOptions: Array<{ value: SupplierPartnerStatus; label: string }> = [
  { value: 'active', label: '合作中' },
  { value: 'disabled', label: '已停用' }
]

onMounted(loadList)

function rowPartner(row: unknown): SupplierPartner {
  return row as SupplierPartner
}

function typeLabel(type: SupplierPartnerType): string {
  return typeOptions.find((item) => item.value === type)?.label ?? '供应商'
}

function statusLabel(status: SupplierPartnerStatus): string {
  return status === 'disabled' ? '已停用' : '合作中'
}

function statusTone(status: SupplierPartnerStatus): 'idle' | 'done' {
  return status === 'disabled' ? 'idle' : 'done'
}

function settlementLabel(row: Pick<SupplierPartner, 'settlementMode' | 'settlementDays' | 'cutoffDay' | 'settlementTerms'>): string {
  if (row.settlementMode === 'MonthlyCutoff') return `每月 ${row.cutoffDay || '—'} 日对账`
  if (row.settlementMode === 'ReceiptDays') return `收货后 ${row.settlementDays ?? 0} 天`
  return row.settlementTerms || '按约定结算'
}

async function loadList(target = page.value): Promise<void> {
  loading.value = true
  error.value = ''
  page.value = target
  try {
    const result = await supplyApi.partnerPage({
      keyword: filters.keyword.trim() || undefined,
      type: filters.type === 'all' ? undefined : filters.type,
      status: filters.status,
      current: target,
      size: pageSize
    })
    items.value = result.list
    total.value = result.total
  } catch (loadError) {
    items.value = []
    total.value = 0
    error.value = loadError instanceof Error ? loadError.message : '供应商档案暂不可确认'
  } finally {
    loading.value = false
  }
}

function applyFilters(): void {
  void loadList(1)
}

function clearFilters(): void {
  filters.keyword = ''
  filters.type = 'all'
  filters.status = 'all'
  void loadList(1)
}

function openDetail(row: SupplierPartner): void {
  void router.push(`/workbench/suppliers/${row.id}`)
}

function onCreated(): void {
  void loadList(1)
}
</script>

<template>
  <div class="supplier-page">
    <header class="supplier-page__head">
      <div>
        <h1>供应商档案</h1>
        <p>维护合作方的基础资料和付款码；采购、应付和付款继续读取同一份供应商事实。</p>
      </div>
      <div class="supplier-page__actions">
        <el-button @click="loadList()">刷新</el-button>
        <el-button v-if="canWrite" type="primary" @click="createOpen = true">新增供应商</el-button>
      </div>
    </header>

    <PanelCard flush>
      <div class="supplier-toolbar">
        <el-input
          v-model="filters.keyword"
          clearable
          placeholder="搜索名称、联系人、电话、品牌或地址"
          class="supplier-toolbar__search"
          @keyup.enter="applyFilters"
          @clear="applyFilters"
        />
        <el-select v-model="filters.type" class="supplier-toolbar__select">
          <el-option label="全部类型" value="all" />
          <el-option v-for="item in typeOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="filters.status" class="supplier-toolbar__select">
          <el-option label="全部状态" value="all" />
          <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-button type="primary" plain @click="applyFilters">查询</el-button>
        <el-button text @click="clearFilters">清除</el-button>
        <span class="supplier-toolbar__count">当前数据范围 {{ total }} 家</span>
      </div>

      <el-alert v-if="error" type="error" :closable="false" show-icon :title="error">
        <template #default><el-button size="small" plain @click="loadList()">重新加载</el-button></template>
      </el-alert>

      <SkeletonBlock v-if="loading" variant="table" :rows="6" class="supplier-content" />
      <EmptyState
        v-else-if="!error && !items.length"
        class="supplier-content"
        :title="filters.keyword || filters.type !== 'all' || filters.status !== 'all' ? '没有匹配的供应商' : '暂无供应商档案'"
        :description="filters.keyword || filters.type !== 'all' || filters.status !== 'all' ? '调整搜索或筛选条件后重试。' : canWrite ? '先新增供应商档案，采购下单时才能按真实合作方建立应付。' : '当前数据范围内还没有可查看的供应商。'"
      />
      <el-table v-else-if="!error" :data="items" stripe class="supplier-content" @row-click="openDetail">
        <el-table-column prop="name" label="供应商" min-width="190">
          <template #default="{ row }">
            <button class="supplier-name" type="button" @click.stop="openDetail(rowPartner(row))">{{ row.name }}</button>
            <small>{{ row.addr || '地址未维护' }}</small>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="120">
          <template #default="{ row }">{{ typeLabel(row.type) }}</template>
        </el-table-column>
        <el-table-column label="合作状态" width="110">
          <template #default="{ row }"><StatusTag :text="statusLabel(row.status)" :tone="statusTone(row.status)" /></template>
        </el-table-column>
        <el-table-column label="联系人" min-width="150">
          <template #default="{ row }">
            <span>{{ row.contactName || '未维护' }}</span>
            <small>{{ row.telNo || '电话未维护' }}</small>
          </template>
        </el-table-column>
        <el-table-column label="供货品牌" min-width="160">
          <template #default="{ row }">{{ row.brands.length ? row.brands.join('、') : '未维护' }}</template>
        </el-table-column>
        <el-table-column label="结算账期" min-width="130">
          <template #default="{ row }">{{ settlementLabel(rowPartner(row)) }}</template>
        </el-table-column>
        <el-table-column label="付款码" width="90" align="center">
          <template #default="{ row }">{{ row.paymentCodeImages.length ? `${row.paymentCodeImages.length} 张` : '未上传' }}</template>
        </el-table-column>
        <el-table-column label="未付余额" min-width="130" align="right">
          <template #default="{ row }"><MoneyText :value="row.outstandingAmount" /></template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }"><el-button link type="primary" @click.stop="openDetail(rowPartner(row))">查看</el-button></template>
        </el-table-column>
      </el-table>

      <div v-if="total > pageSize" class="supplier-pagination">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          @current-change="loadList"
        />
      </div>
    </PanelCard>

    <SupplierFormDrawer v-if="canWrite" v-model="createOpen" mode="create" @saved="onCreated" />
  </div>
</template>

<style scoped lang="scss">
.supplier-page { display: flex; flex-direction: column; gap: $space-4; }
.supplier-page__head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-4; }
.supplier-page__head h1 { margin: 0; color: $text-primary; font-size: $font-display; }
.supplier-page__head p { margin: $space-2 0 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
.supplier-page__actions { display: flex; gap: $space-2; flex-shrink: 0; }
.supplier-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: $space-2; padding: $space-4; border-bottom: 1px solid $border-color; }
.supplier-toolbar__search { width: min(360px, 100%); }
.supplier-toolbar__select { width: 132px; }
.supplier-toolbar__count { margin-left: auto; color: $text-tertiary; font-size: $font-caption; }
.supplier-content { margin: $space-4; }
.supplier-name { display: block; padding: 0; border: 0; color: $brand-700; background: transparent; font: inherit; font-weight: $font-weight-semibold; text-align: left; cursor: pointer; }
.supplier-name + small, .el-table small { display: block; margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }
.supplier-pagination { display: flex; justify-content: flex-end; padding: 0 $space-4 $space-4; }
@media (max-width: 900px) {
  .supplier-page__head { flex-direction: column; }
  .supplier-page__actions { width: 100%; }
  .supplier-toolbar__count { width: 100%; margin-left: 0; }
}
</style>
