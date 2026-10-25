<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ProviderError } from '@/core/http'
import { materialSettlementApi } from '@/domains/material/api'
import type { MaterialSettlement, SettlementPreviewRow } from '@/domains/material/model'
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import PartnerPicker from '@/components/picker/PartnerPicker.vue'
import EmptyState from '@/components/EmptyState.vue'
import PanelCard from '@/components/PanelCard.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import MaterialAssistant from '@/components/material/MaterialAssistant.vue'
import { useStoreScopeStore } from '@/stores/storeScope'

/**
 * 主材采购结算工作台（财务；材料员与财务为同一角色，DEC-074）。
 *
 * <p>候选集按**供应商分组**呈现，避免用下拉承载远程业务对象（供应商选择器尚未纳入业务概念注册表）；
 * 结算按 DEC-073：同一采购明细只能结算一次（互斥），月结只结算尚未逐单结算的差额。</p>
 */
const scope = useStoreScopeStore()
const loading = ref(true)
const error = ref('')
const settlementError = ref('')
const rows = ref<SettlementPreviewRow[]>([])
const settlements = ref<MaterialSettlement[]>([])
const prices = ref<Record<string, string>>({})
const periods = ref<Record<string, string>>({})
const submitting = ref('')
const cancelling = ref('')
const showRule = ref(false)
/** 可选：按供应商筛选候选集（使用已登记的业务概念选择器 supplier）。 */
const supplierFilterId = ref('')

interface SupplierGroup {
  supplierId: string
  supplierName: string
  rows: SettlementPreviewRow[]
  orders: Array<{ orderId: string; orderNo: string; rows: SettlementPreviewRow[] }>
}

const groups = computed<SupplierGroup[]>(() => {
  const bySupplier = new Map<string, SupplierGroup>()
  rows.value.forEach((row) => {
    const supplierId = row.supplierId || ''
    if (!bySupplier.has(supplierId)) {
      bySupplier.set(supplierId, { supplierId, supplierName: row.supplierName || '供应商待确认', rows: [], orders: [] })
    }
    bySupplier.get(supplierId)!.rows.push(row)
  })
  bySupplier.forEach((group) => {
    const byOrder = new Map<string, { orderId: string; orderNo: string; rows: SettlementPreviewRow[] }>()
    group.rows.forEach((row) => {
      const orderId = row.purchaseOrderId || ''
      if (!byOrder.has(orderId)) {
        byOrder.set(orderId, { orderId, orderNo: row.purchaseNo || '采购单待确认', rows: [] })
      }
      byOrder.get(orderId)!.rows.push(row)
    })
    group.orders = Array.from(byOrder.values())
  })
  return Array.from(bySupplier.values())
})

const unpricedCount = computed(() => rows.value.filter((row) => row.unpriced).length)
const missingPriceCount = computed(() => rows.value.filter((row) => !priceOf(row)).length)

async function loadCandidates(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    rows.value = await materialSettlementApi.preview({
      supplierId: supplierFilterId.value || undefined,
      storeId: scope.requestStoreId ?? undefined
    })
    rows.value.forEach((row) => {
      if (prices.value[row.purchaseItemId] === undefined) {
        prices.value[row.purchaseItemId] = row.suggestedSettlementPrice == null ? '' : String(row.suggestedSettlementPrice)
      }
      if (row.supplierId && periods.value[row.supplierId] === undefined) {
        periods.value[row.supplierId] = new Date().toISOString().slice(0, 7)
      }
    })
  } catch (e) {
    error.value = e instanceof ProviderError ? e.message : '可结算明细暂不可确认'
  } finally {
    loading.value = false
  }
}

async function loadSettlements(): Promise<void> {
  settlementError.value = ''
  try {
    settlements.value = await materialSettlementApi.list(undefined, scope.requestStoreId ?? undefined)
  } catch (loadError) {
    settlementError.value = loadError instanceof ProviderError ? loadError.message : '结算单暂不可确认'
  }
}

async function reloadForStore(): Promise<void> {
  await Promise.all([loadCandidates(), loadSettlements()])
}

function priceOf(row: SettlementPreviewRow): string {
  return prices.value[row.purchaseItemId] ?? ''
}

function setPrice(row: SettlementPreviewRow, value: string): void {
  prices.value[row.purchaseItemId] = value
}

function periodOf(supplierId: string): string {
  return periods.value[supplierId] ?? ''
}

function itemsOf(list: SettlementPreviewRow[]) {
  return list.map((row) => ({
    purchaseItemId: row.purchaseItemId,
    quantity: row.quantity,
    settlementPrice: Number(priceOf(row) || 0)
  }))
}

/** 确认结算：逐单（单一采购单）或月结（供应商 + 期间，按采购下单月份）。 */
async function settle(group: SupplierGroup, scope: 'PerPurchaseOrder' | 'Monthly', list: SettlementPreviewRow[], orderId?: string): Promise<void> {
  if (!group.supplierId) {
    ElMessage.warning('该明细供应商待确认，请先在合作方建档后重试')
    return
  }
  const items = itemsOf(list)
  if (!items.length) {
    ElMessage.warning('没有可结算的明细')
    return
  }
  if (items.some((item) => item.settlementPrice <= 0)) {
    ElMessage.warning('每行都要填结算价（未定价明细必须按对账结果填）')
    return
  }
  const period = periodOf(group.supplierId)
  if (scope === 'Monthly' && !period) {
    ElMessage.warning('月结需要填写期间（如 2026-10）')
    return
  }
  submitting.value = `${group.supplierId}-${orderId || 'monthly'}`
  try {
    await materialSettlementApi.confirm({
      supplierId: group.supplierId,
      scope,
      period: scope === 'Monthly' ? period : undefined,
      items
    })
    ElMessage.success('结算已确认：结算价回填、应付修正、实际成本补齐')
    await Promise.all([loadCandidates(), loadSettlements()])
  } catch (e) {
    ElMessage.error(e instanceof ProviderError ? e.message : '结算失败')
  } finally {
    submitting.value = ''
  }
}

/** 撤销结算（纠错）：结算头留痕，采购/应付/成本冲回未结算状态。 */
async function cancelSettlement(settlement: MaterialSettlement): Promise<void> {
  try {
    const { value } = await ElMessageBox.prompt(
      '撤销为纠错动作：采购价与价格状态回退、应付回暂估、已补记的实际成本差额冲回。请填写原因。',
      '撤销结算',
      { confirmButtonText: '确认撤销', cancelButtonText: '取消', inputPlaceholder: '如：对账口径有误' }
    )
    cancelling.value = settlement.id
    await materialSettlementApi.cancel({ settlementId: settlement.id, reason: value || undefined })
    ElMessage.success('已撤销结算：成本回到「成本待结算」，可重新结算')
    await Promise.all([loadCandidates(), loadSettlements()])
  } catch (e) {
    if (e instanceof ProviderError) ElMessage.error(e.message)
  } finally {
    cancelling.value = ''
  }
}

onMounted(async () => {
  await reloadForStore()
})
watch(() => scope.requestStoreId, () => { void reloadForStore() })
</script>

<template>
  <div class="ms">
    <header class="ms__head">
      <div>
        <h1 class="ms__title">主材采购结算</h1>
        <p class="ms__sub">先填结算价，再按采购单或供应商确认。</p>
      </div>
      <div class="ms__head-actions">
        <PartnerPicker v-model="supplierFilterId" @change="loadCandidates" />
        <el-button :loading="loading" @click="loadCandidates">刷新候选</el-button>
      </div>
    </header>

    <SkeletonBlock v-if="loading" :rows="5" />
    <EmptyState v-else-if="error" :title="error" description="请稍后重试" />
    <template v-else>
      <div class="ms__summary" aria-label="结算概览">
        <div><strong>{{ rows.length }}</strong><span>行可结算</span></div>
        <div><strong>{{ unpricedCount }}</strong><span>行未定价</span></div>
        <div><strong>{{ missingPriceCount }}</strong><span>行待填结算价</span></div>
        <div><strong>{{ groups.length }}</strong><span>家供应商</span></div>
      </div>
      <div class="ms__rule">
        <button type="button" class="ms__rule-toggle" @click="showRule = !showRule">{{ showRule ? '收起规则' : '结算规则' }}</button>
        <p v-if="showRule">同一采购明细只能结算一次；月结只结算尚未逐单结算的差额。未定价或部分结算的行保持「成本待结算」，项目利润不参与计算。</p>
      </div>

      <PanelCard
        title="可结算采购明细"
        :subtitle="`按供应商分组 · 共 ${rows.length} 行${unpricedCount ? `（其中 ${unpricedCount} 行未定价，必须填结算价）` : ''}`"
      >
        <EmptyState v-if="!groups.length" title="当前没有可结算的采购明细" description="已结算明细不会重复出现（互斥 + 月结补充）" />
        <section v-for="group in groups" :key="group.supplierId || 'unknown'" class="ms__group">
          <div class="ms__group-head">
            <strong>{{ group.supplierName }}</strong>
            <span class="ms__group-meta">{{ group.rows.length }} 行 · {{ group.orders.length }} 张采购单</span>
            <label class="ms__period">
              月结期间
              <el-input
                :model-value="periodOf(group.supplierId)"
                size="small"
                style="width: 140px"
                placeholder="2026-10"
                @update:model-value="(value: string) => (periods[group.supplierId] = value)"
              />
            </label>
            <el-button
              size="small"
              :loading="submitting === `${group.supplierId}-monthly`"
              @click="settle(group, 'Monthly', group.rows)"
            >
              月结该供应商
            </el-button>
          </div>

          <table class="ms__table">
            <thead>
              <tr>
                <th>材料</th>
                <th>采购单</th>
                <th>数量</th>
                <th>已到场</th>
                <th>采购价</th>
                <th>结算价</th>
                <th style="width: 120px">逐单结算</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in group.rows" :key="row.purchaseItemId">
                <td>
                  {{ row.materialName || '材料' }}
                  <span v-if="row.unpriced" class="ms__tag-unpriced">未定价</span>
                </td>
                <td>{{ row.purchaseNo || '—' }}</td>
                <td class="ms__num">{{ row.quantity }}</td>
                <td class="ms__num">{{ row.receivedQuantity }}</td>
                <td class="ms__num">{{ row.unpriced ? '未定价' : row.purchasePrice.toFixed(2) }}</td>
                <td>
                  <el-input
                    :model-value="priceOf(row)"
                    size="small"
                    placeholder="按对账填结算价"
                    @update:model-value="(value: string) => setPrice(row, value)"
                  />
                </td>
                <td>
                  <el-button
                    v-if="row === group.rows.find((item) => item.purchaseOrderId === row.purchaseOrderId)"
                    type="primary"
                    size="small"
                    :loading="submitting === `${group.supplierId}-${row.purchaseOrderId}`"
                    @click="settle(group, 'PerPurchaseOrder', group.orders.find((order) => order.orderId === row.purchaseOrderId)?.rows || [], row.purchaseOrderId)"
                  >
                    结算本单
                  </el-button>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </PanelCard>

      <PanelCard title="结算单" subtitle="撤销为纠错：结算头留痕，采购 / 应付 / 成本回到未结算">
        <el-alert v-if="settlementError" type="error" :closable="false" :title="settlementError" show-icon>
          <template #default><el-button size="small" plain @click="loadSettlements">重新加载</el-button></template>
        </el-alert>
        <EmptyState v-else-if="!settlements.length" title="还没有结算单" description="确认结算后会出现在这里" />
        <ul v-else class="ms__list">
          <li v-for="item in settlements" :key="item.id" class="ms__row">
            <div class="ms__row-main">
              <span class="ms__row-title">
                {{ item.no }} · {{ item.scope === 'monthly' ? `月结 ${item.period || ''}` : '逐单结算' }}
              </span>
              <span class="ms__row-meta">
                {{ item.supplierName || '供应商待确认' }} · 金额 {{ item.totalAmount.toFixed(2) }}
                <template v-if="item.cancelReason"> · 撤销原因：{{ item.cancelReason }}</template>
              </span>
            </div>
            <div class="ms__row-actions">
              <BusinessStateTag object-key="materialSettlement" :status-key="item.status" />
              <el-button
                v-if="item.status === 'confirmed'"
                size="small"
                :loading="cancelling === item.id"
                @click="cancelSettlement(item)"
              >
                撤销
              </el-button>
            </div>
          </li>
        </ul>
      </PanelCard>
    </template>

    <MaterialAssistant
      context-type="settlement"
      context-title="主材采购结算工作台"
      context-subtitle="按供应商/采购单结算 · 结算价是实际成本唯一来源"
    />
  </div>
</template>

<style scoped>
.ms { display: flex; flex-direction: column; gap: 16px; padding: 20px 24px 40px; }
.ms__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.ms__head-actions { display: flex; align-items: center; gap: 8px; }
.ms__summary { display: flex; gap: 28px; padding: 14px 18px; border: 1px solid var(--border-color, #ebebe6); border-radius: 10px; background: var(--surface-50, #fafaf8); }
.ms__summary div { display: flex; align-items: baseline; gap: 6px; }
.ms__summary strong { font-size: 20px; font-variant-numeric: tabular-nums; }
.ms__summary span { font-size: 12px; color: var(--text-secondary, #7a7a72); }
.ms__rule-toggle { padding: 0; border: 0; background: none; color: var(--brand-primary, #2f7d5a); font-size: 12px; cursor: pointer; }
.ms__rule p { margin: 6px 0 0; padding: 10px 12px; border-radius: 8px; background: var(--surface-50, #fafaf8); font-size: 12px; line-height: 1.6; color: var(--text-secondary, #7a7a72); }
.ms__title { margin: 0; font-size: 20px; font-weight: 650; }
.ms__sub { margin: 4px 0 0; font-size: 13px; color: var(--text-secondary, #7a7a72); }
.ms__group { margin-bottom: 20px; }
.ms__group-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; font-size: 14px; }
.ms__group-meta { font-size: 12px; color: var(--text-secondary, #7a7a72); }
.ms__period { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary, #7a7a72); }
.ms__table { width: 100%; border-collapse: collapse; font-size: 13px; }
.ms__table th, .ms__table td { padding: 8px 10px; border: 1px solid var(--border-color, #ebebe6); text-align: left; }
.ms__table th { background: #fafaf8; font-weight: 600; }
.ms__num { font-variant-numeric: tabular-nums; }
.ms__tag-unpriced { margin-left: 6px; padding: 1px 6px; border-radius: 4px; background: #fdf4e3; color: #8a5a00; font-size: 11px; }
.ms__list { margin: 0; padding: 0; list-style: none; }
.ms__row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 8px; border-bottom: 1px solid var(--border-color, #ebebe6); }
.ms__row-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ms__row-title { font-size: 14px; font-weight: 600; }
.ms__row-meta { font-size: 12px; color: var(--text-secondary, #7a7a72); }
.ms__row-actions { display: flex; align-items: center; gap: 8px; }
</style>
