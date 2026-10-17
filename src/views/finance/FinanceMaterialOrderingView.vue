<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ProviderError } from '@/core/http'
import { loadSheetEnums, materialSheetApi } from '@/domains/material/api'
import type { MaterialOrderSheet, MaterialOrderSheetItem } from '@/domains/material/model'
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import PanelCard from '@/components/PanelCard.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'

const UNIT_LABEL: Record<string, string> = {
  Area: '㎡', Sheet: '片', Block: '块', Plate: '樘', Set: '套',
  Count: '个', Metre: '米', Item: '项', Pcs: '台', Place: '处'
}

type OrderableLine = { itemId: string; name: string; location: string; quantity: string; unit: string; price: string }

const loading = ref(true)
const error = ref('')
const sheets = ref<MaterialOrderSheet[]>([])
const typeNames = ref<Record<string, string>>({})
const selected = ref<MaterialOrderSheet | null>(null)
const submitting = ref(false)
const supplierName = ref('')
const expectedAt = ref('')
const remark = ref('')
const lines = ref<OrderableLine[]>([])

/** 待下单：已提交请购/核价中；已进入采购的作业单只读（换材走增减项）。 */
const queue = computed(() => sheets.value.filter((sheet) =>
  ['submitted', 'pricing'].includes(sheet.status) || sheet.status === 'partiallyOrdered'))
const inPurchase = computed(() => sheets.value.filter((sheet) =>
  ['ordered', 'partiallyArrived', 'arrived', 'settled', 'closed'].includes(sheet.status)))

function typeName(code: string): string {
  return typeNames.value[code] || code
}

function unitLabel(unit?: string): string {
  return (unit && UNIT_LABEL[unit]) || unit || ''
}

/** 价格状态只做展示映射；真实状态来自服务端 sheet.priceState。 */
function priceStateLabel(state?: string): string {
  return ({
    priced: '已定价',
    unpriced: '未定价 · 成本待结算',
    mixed: '部分已结算 · 成本待结算',
    settled: '已结算'
  } as Record<string, string>)[state || ''] || ''
}

function remaining(item: MaterialOrderSheetItem): number {
  return Math.max(0, Number(item.quantity || 0) - Number(item.orderedQuantity || 0))
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const [list, enums] = await Promise.all([materialSheetApi.list({}), loadSheetEnums()])
    sheets.value = list
    typeNames.value = Object.fromEntries(enums.sheetTypes.map((item) => [item.code, item.name]))
  } catch (e) {
    error.value = e instanceof ProviderError ? e.message : '主材作业单暂不可确认'
  } finally {
    loading.value = false
  }
}

function openSheet(sheet: MaterialOrderSheet): void {
  selected.value = sheet
  supplierName.value = sheet.supplierName || ''
  expectedAt.value = sheet.deliverAt || ''
  remark.value = ''
  lines.value = sheet.items
    .filter((item) => remaining(item) > 0)
    .map((item) => ({
      itemId: item.id,
      name: item.materialName || '材料',
      location: item.locationName || item.spaceName || '未填安装位置',
      quantity: String(remaining(item)),
      unit: unitLabel(item.unit),
      price: ''
    }))
}

function closeSheet(): void {
  selected.value = null
  lines.value = []
}

/** 单价留空＝未定价：形成暂估应付，成本保持不完整（利润 null），不得用 0 冒充。 */
async function submitOrder(): Promise<void> {
  const sheet = selected.value
  if (!sheet) return
  if (!supplierName.value.trim()) {
    ElMessage.warning('请填写供应商（需已在合作方建档）')
    return
  }
  if (!lines.value.length) {
    ElMessage.warning('没有可下单的材料行（可能已全部下单）')
    return
  }
  for (const line of lines.value) {
    if (Number(line.quantity || 0) <= 0) {
      ElMessage.warning(`「${line.name}」数量必须大于 0`)
      return
    }
  }
  const unpricedCount = lines.value.filter((line) => line.price.trim() === '').length
  submitting.value = true
  try {
    await materialSheetApi.order({
      sheetId: sheet.id,
      supplierName: supplierName.value.trim(),
      expectedAt: expectedAt.value || undefined,
      remark: remark.value.trim() || undefined,
      items: lines.value.map((line) => ({
        itemId: line.itemId,
        quantity: Number(line.quantity || 0),
        purchasePrice: line.price.trim() === '' ? null : Number(line.price)
      }))
    })
    ElMessage.success(unpricedCount > 0
      ? `已下单：${unpricedCount} 行未定价，形成暂估应付，成本待结算`
      : '已下单并形成应付')
    closeSheet()
    await load()
  } catch (e) {
    ElMessage.error(e instanceof ProviderError ? e.message : '下单失败')
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="mo">
    <header class="mo__head">
      <div>
        <h1 class="mo__title">主材下单</h1>
        <p class="mo__sub">按供应商成单：设计师提交请购后由材料员/财务下单；<strong>单价可留空＝未定价</strong>（形成暂估应付，成本待结算）</p>
      </div>
      <el-button :loading="loading" @click="load">刷新</el-button>
    </header>

    <SkeletonBlock v-if="loading" :rows="6" />
    <EmptyState v-else-if="error" :title="error" description="请稍后重试；失败时保留上一份数据不超过提示范围" />
    <template v-else>
      <PanelCard title="待下单" :subtitle="`共 ${queue.length} 张作业单`">
        <EmptyState v-if="!queue.length" title="当前没有待下单的主材作业单" description="设计师提交请购后会出现在这里" />
        <ul v-else class="mo__list">
          <li v-for="sheet in queue" :key="sheet.id" class="mo__row" @click="openSheet(sheet)">
            <div class="mo__row-main">
              <span class="mo__row-title">{{ typeName(sheet.sheetType) }} · {{ sheet.no }}</span>
              <span class="mo__row-meta">
                {{ sheet.projectName || '未关联项目' }}
                <template v-if="sheet.manufacturerName"> · 厂家 {{ sheet.manufacturerName }}</template>
                · {{ sheet.items.length }} 行
                <template v-if="sheet.deliverAt"> · 配送 {{ sheet.deliverAt }}</template>
                <span v-if="priceStateLabel(sheet.priceState)" class="mo__price-state" :class="`mo__price-state--${sheet.priceState}`">{{ priceStateLabel(sheet.priceState) }}</span>
              </span>
            </div>
            <BusinessStateTag object-key="materialOrderSheet" :status-key="sheet.status" />
          </li>
        </ul>
      </PanelCard>

      <PanelCard title="已进入采购" :subtitle="`共 ${inPurchase.length} 张作业单`">
        <EmptyState v-if="!inPurchase.length" title="还没有已下单的作业单" description="下单成功后作业单进入此分组，材料与数量锁定" />
        <ul v-else class="mo__list">
          <li v-for="sheet in inPurchase" :key="sheet.id" class="mo__row mo__row--readonly">
            <div class="mo__row-main">
              <span class="mo__row-title">{{ typeName(sheet.sheetType) }} · {{ sheet.no }}</span>
              <span class="mo__row-meta">
                {{ sheet.projectName || '未关联项目' }} · {{ sheet.items.length }} 行
                <span v-if="priceStateLabel(sheet.priceState)" class="mo__price-state" :class="`mo__price-state--${sheet.priceState}`">{{ priceStateLabel(sheet.priceState) }}</span>
              </span>
            </div>
            <BusinessStateTag object-key="materialOrderSheet" :status-key="sheet.status" />
          </li>
        </ul>
      </PanelCard>

      <PanelCard v-if="selected" :title="`下单 · ${typeName(selected.sheetType)} ${selected.no}`" subtitle="作业单对厂家，不含价格列；请填写本次执行数量与单价（可留空）">
        <div class="mo__form">
          <label class="mo__field">
            <span>供应商</span>
            <el-input v-model="supplierName" placeholder="需已在合作方建档（如：利家福）" />
          </label>
          <label class="mo__field">
            <span>要求到场</span>
            <el-date-picker v-model="expectedAt" type="date" value-format="YYYY-MM-DD" placeholder="可不填" />
          </label>
          <label class="mo__field mo__field--wide">
            <span>备注</span>
            <el-input v-model="remark" placeholder="本次下单说明（可不填）" />
          </label>
        </div>

        <table class="mo__table">
          <thead>
            <tr>
              <th>安装位置</th>
              <th>材料</th>
              <th>可下单量</th>
              <th>本次数量</th>
              <th>本次单价</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="line in lines" :key="line.itemId">
              <td>{{ line.location }}</td>
              <td>{{ line.name }}</td>
              <td class="mo__num">{{ line.quantity }} {{ line.unit }}</td>
              <td><el-input v-model="line.quantity" size="small" /></td>
              <td>
                <el-input v-model="line.price" size="small" placeholder="留空＝未定价" />
              </td>
            </tr>
          </tbody>
        </table>
        <p class="mo__hint">
          未定价行：系统按暂估应付记账，实际成本在结算价回填前保持不完整（项目利润显示「成本待结算」）；
          数量不得超过「净用量 + 损耗」，否则服务端直接拦截。
        </p>

        <div class="mo__actions">
          <el-button @click="closeSheet">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="submitOrder">确认下单</el-button>
        </div>
      </PanelCard>
    </template>
  </div>
</template>

<style scoped>
.mo { display: flex; flex-direction: column; gap: 16px; padding: 20px 24px 40px; }
.mo__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.mo__title { margin: 0; font-size: 20px; font-weight: 650; }
.mo__sub { margin: 4px 0 0; font-size: 13px; color: var(--text-secondary, #7a7a72); }
.mo__list { margin: 0; padding: 0; list-style: none; }
.mo__row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 8px; border-bottom: 1px solid var(--border-color, #ebebe6); cursor: pointer; }
.mo__row:hover { background: rgba(26, 26, 23, 0.03); }
.mo__row--readonly { cursor: default; }
.mo__row-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.mo__row-title { font-size: 14px; font-weight: 600; }
.mo__row-meta { font-size: 12px; color: var(--text-secondary, #7a7a72); }
.mo__price-state { display: inline-flex; align-items: center; margin-left: 8px; padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 650; vertical-align: 1px; }
.mo__price-state--unpriced, .mo__price-state--mixed { color: #a15c00; background: #fff3dc; }
.mo__price-state--priced, .mo__price-state--settled { color: #0b6b57; background: #e8f5f0; }
.mo__form { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.mo__field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-secondary, #7a7a72); }
.mo__field--wide { flex: 1 1 320px; }
.mo__table { width: 100%; border-collapse: collapse; font-size: 13px; }
.mo__table th, .mo__table td { padding: 8px 10px; border: 1px solid var(--border-color, #ebebe6); text-align: left; }
.mo__table th { background: #fafaf8; font-weight: 600; }
.mo__num { font-variant-numeric: tabular-nums; }
.mo__hint { margin: 12px 0 0; font-size: 12px; color: var(--text-secondary, #7a7a72); }
.mo__actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
</style>
