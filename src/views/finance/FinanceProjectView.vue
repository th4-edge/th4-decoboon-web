<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import { useFinanceAccess } from '@/domains/finance/access'
import { PROJECT_STATUS_LABEL, RECEIVABLE_STATUS_META, PAYABLE_STATUS_META, SETTLEMENT_STATUS_META, DIRECTION_META } from '@/domains/finance/meta'
import type { FinanceProjectReport, Ledger, Payable, Receivable } from '@/domains/finance/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import CostIncompleteValue from '@/components/CostIncompleteValue.vue'
import FinanceReceivableDrawer from '@/components/finance/FinanceReceivableDrawer.vue'
import FinanceCollectionDrawer from '@/components/finance/FinanceCollectionDrawer.vue'
import FinancePayableDrawer from '@/components/finance/FinancePayableDrawer.vue'
import FinancePaymentDrawer from '@/components/finance/FinancePaymentDrawer.vue'
import FinanceLedgerDrawer from '@/components/finance/FinanceLedgerDrawer.vue'

const route = useRoute()
const router = useRouter()
const { canWrite, canCorrect, readOnly } = useFinanceAccess()
const projectId = computed(() => String(route.params.projectId ?? ''))
const report = ref<FinanceProjectReport | null>(null)
const loading = ref(false)
const error = ref('')
const activeTab = ref('overview')
const receivableDrawer = ref(false)
const collectionDrawer = ref(false)
const payableDrawer = ref(false)
const paymentDrawer = ref(false)
const ledgerDrawer = ref(false)
const editingReceivable = ref<Receivable | null>(null)
const collecting = ref<Receivable | null>(null)
const editingPayable = ref<Payable | null>(null)
const paying = ref<Payable | null>(null)
const editingLedger = ref<Ledger | null>(null)
const actionBusy = ref(false)

const costRows = computed(() => report.value ? [
  { label: '材料成本', value: report.value.materialCost },
  { label: '人工成本', value: report.value.laborCost },
  { label: '项目款', value: report.value.projectCost },
  { label: '费用分摊', value: report.value.expenseAllocation }
] : [])

onMounted(load)

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    report.value = await financeApi.projectReport(projectId.value)
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '项目财务暂不可确认'
  } finally {
    loading.value = false
  }
}

async function generateSettlement(): Promise<void> {
  actionBusy.value = true
  try {
    await financeApi.saveSettlement(projectId.value, report.value?.settlement?.remark)
    ElMessage.success('项目结算已重算')
    await load()
  } catch (actionError) {
    ElMessage.error(actionError instanceof ProviderError ? actionError.message : '结算生成失败，暂不可确认')
  } finally {
    actionBusy.value = false
  }
}

async function confirmAction(message: string, title: string, confirmButtonText: string): Promise<boolean> {
  try {
    await ElMessageBox.confirm(message, title, {
      type: 'warning',
      confirmButtonText,
      cancelButtonText: '取消'
    })
    return true
  } catch {
    return false
  }
}

async function confirmSettlement(): Promise<void> {
  const settlement = report.value?.settlement
  if (!settlement) return
  if (!await confirmAction('确认后结算金额冻结；如需调整需先重算并重新确认。', '确认项目结算', '确认结算')) return
  actionBusy.value = true
  try {
    await financeApi.updateSettlement(settlement.id, 'confirmed')
    ElMessage.success('项目结算已确认')
    await load()
  } catch (actionError) {
    ElMessage.error(actionError instanceof ProviderError ? actionError.message : '结算确认失败，暂不可确认')
  } finally {
    actionBusy.value = false
  }
}

async function closeSettlement(): Promise<void> {
  const settlement = report.value?.settlement
  if (!settlement) return
  if (!await confirmAction('关闭前系统将校验应收、应付是否全部结清，并同步项目为已结算。', '关闭项目结算', '关闭结算')) return
  actionBusy.value = true
  try {
    await financeApi.updateSettlement(settlement.id, 'closed')
    ElMessage.success('项目结算已关闭')
    await load()
  } catch (actionError) {
    ElMessage.error(actionError instanceof ProviderError ? actionError.message : '关闭结算失败，暂不可确认')
  } finally {
    actionBusy.value = false
  }
}

async function releaseRetention(): Promise<void> {
  const settlement = report.value?.settlement
  if (!settlement) return
  if (!await confirmAction('确认质保期已到并完成质保金释放？', '释放质保金', '确认释放')) return
  actionBusy.value = true
  try {
    await financeApi.releaseRetention(settlement.id)
    ElMessage.success('质保金已释放')
    await load()
  } catch (actionError) {
    ElMessage.error(actionError instanceof ProviderError ? actionError.message : '质保金释放失败，暂不可确认')
  } finally {
    actionBusy.value = false
  }
}

function openReceivableEdit(value: unknown): void {
  const item = value as Receivable
  editingReceivable.value = item
  receivableDrawer.value = true
}

function openCollection(value: unknown): void {
  collecting.value = value as Receivable
  collectionDrawer.value = true
}

function openPayment(value: unknown): void {
  paying.value = value as Payable
  paymentDrawer.value = true
}

function openPayableEdit(value: unknown): void {
  const item = value as Payable
  editingPayable.value = item
  payableDrawer.value = true
}

function canCorrectLedger(value: unknown): boolean {
  const item = value as Ledger
  return canCorrect.value && item.source === 'manual' && !item.correctionGroupId
}

function openLedgerEdit(value: unknown): void {
  const item = value as Ledger
  if (!canCorrectLedger(item)) return
  editingLedger.value = item
  ledgerDrawer.value = true
}

function receivableStatusMeta(value: unknown) {
  const item = value as Receivable
  return RECEIVABLE_STATUS_META[item.status]
}

function payableStatusMeta(value: unknown) {
  const item = value as Payable
  return PAYABLE_STATUS_META[item.status]
}

function directionMeta(value: unknown) {
  const item = value as Ledger
  return DIRECTION_META[item.direction]
}
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <button class="finance-back" type="button" @click="router.push('/finance/projects')">← 返回项目账本</button>
        <span class="finance-eyebrow">PROJECT · 项目核算工作区</span>
        <h1>{{ report?.project.name || '项目财务' }}</h1>
        <p v-if="report">{{ report.project.no }} · {{ report.project.address || '地址未填' }} · {{ PROJECT_STATUS_LABEL[report.project.status] ?? report.project.status }}</p>
      </div>
      <div class="finance-actions">
        <el-button @click="load">刷新</el-button>
        <el-button type="primary" :disabled="!report" @click="activeTab = 'settlement'">进入结算</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />

    <SkeletonBlock v-if="loading && !report" variant="card" :rows="8" />

    <template v-else-if="report">
      <section class="finance-kpis">
        <article class="finance-kpi">
          <span>合同金额</span>
          <strong><MoneyText :value="report.contractAmount" size="lg" /></strong>
          <small>合同收入基线</small>
        </article>
        <article class="finance-kpi">
          <span>累计回款</span>
          <strong><MoneyText :value="report.receivedAmount" size="lg" /></strong>
          <small>回款率 {{ report.collectionRate }}%</small>
        </article>
        <article class="finance-kpi">
          <span>实际成本</span>
          <strong><MoneyText :value="report.actualCost" size="lg" /></strong>
          <small>预计成本 {{ report.estimatedCost.toFixed(2) }}</small>
        </article>
        <article class="finance-kpi">
          <span>项目毛利</span>
          <strong>
            <CostIncompleteValue v-if="!report.costComplete" :hint="`${report.costIncompleteCount} 项成本未完整`" />
            <MoneyText v-else :value="report.profitAmount" size="lg" />
          </strong>
          <small v-if="report.costComplete">毛利率 {{ report.grossMargin ?? '暂不可确认' }}{{ typeof report.grossMargin === 'number' ? '%' : '' }}</small>
          <small v-else>不显示伪利润</small>
        </article>
      </section>

      <div class="finance-project-tabs">
        <div class="finance-project-summary">
          <div class="finance-project-summary__item"><span>应收账款</span><strong><MoneyText :value="report.receivableAmount" /></strong></div>
          <div class="finance-project-summary__item"><span>应付账款</span><strong><MoneyText :value="report.payableAmount" /></strong></div>
          <div class="finance-project-summary__item"><span>待收金额</span><strong><MoneyText :value="report.outstandingAmount" /></strong></div>
          <div class="finance-project-summary__item"><span>未付金额</span><strong><MoneyText :value="report.unpaidAmount" /></strong></div>
        </div>
        <el-tabs v-model="activeTab">
          <el-tab-pane label="总览与成本" name="overview">
            <div class="finance-grid-2">
              <PanelCard title="项目成本构成" description="成本来自服务端统一项目成本上下文。">
                <el-table :data="costRows" show-header>
                  <el-table-column prop="label" label="成本项" min-width="140" />
                  <el-table-column label="金额" align="right" width="160">
                    <template #default="{ row }"><MoneyText :value="row.value" /></template>
                  </el-table-column>
                </el-table>
              </PanelCard>
              <PanelCard title="资金与结算状态" description="核销与结算状态由后端推进。">
                <div class="finance-settlement__facts">
                  <div class="finance-settlement__fact"><span>应收状态</span><strong>{{ report.receivableCleared ? '已结清' : '未结清' }}</strong></div>
                  <div class="finance-settlement__fact"><span>应付状态</span><strong>{{ report.payableCleared ? '已结清' : '未结清' }}</strong></div>
                  <div class="finance-settlement__fact"><span>结算状态</span><strong>{{ report.settlement ? SETTLEMENT_STATUS_META[report.settlement.status].label : '未生成' }}</strong></div>
                </div>
              </PanelCard>
            </div>
          </el-tab-pane>

          <el-tab-pane label="应收与收款" name="receivable">
            <div class="finance-actions" style="justify-content: flex-start; margin-bottom: 16px;">
              <el-button v-if="canWrite" type="primary" plain @click="editingReceivable = null; receivableDrawer = true">新增应收节点</el-button>
              <el-button v-if="canWrite" @click="collectionDrawer = true">登记项目收款</el-button>
              <el-button v-if="readOnly" plain disabled>本店财务只读</el-button>
            </div>
            <EmptyState v-if="!report.receivables.length" title="暂无应收节点" description="从项目合同资金计划创建应收后，才能登记收款核销。" />
            <el-table v-else :data="report.receivables" stripe>
              <el-table-column prop="name" label="应收节点" min-width="180" />
              <el-table-column label="状态" width="110">
                <template #default="{ row }"><StatusTag :text="receivableStatusMeta(row).label" :tone="receivableStatusMeta(row).tone" /></template>
              </el-table-column>
              <el-table-column prop="dueDate" label="到期日" width="120" />
              <el-table-column label="已收 / 应收" min-width="160" align="right">
                <template #default="{ row }">¥{{ row.receivedAmount.toFixed(2) }} / ¥{{ row.amount.toFixed(2) }}</template>
              </el-table-column>
              <el-table-column label="待收" width="140" align="right">
                <template #default="{ row }"><MoneyText :value="row.outstandingAmount" /></template>
              </el-table-column>
              <el-table-column label="操作" width="180">
                <template #default="{ row }">
                  <el-button v-if="canWrite" link type="primary" @click="openReceivableEdit(row)">编辑</el-button>
                  <el-button v-if="canWrite" link type="success" :disabled="!row.outstandingAmount" @click="openCollection(row)">收款</el-button>
                  <span v-if="readOnly">—</span>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="应付与付款" name="payable">
            <div class="finance-actions" style="justify-content: flex-start; margin-bottom: 16px;">
              <el-button v-if="canWrite" type="primary" plain @click="editingPayable = null; payableDrawer = true">新增应付成本</el-button>
              <el-button v-if="canWrite" @click="paymentDrawer = true">安排项目付款</el-button>
              <el-button v-if="readOnly" plain disabled>本店财务只读</el-button>
            </div>
            <EmptyState v-if="!report.payables.length" title="暂无应付账款" description="采购、项目费用或工资来源形成应付后，才能安排付款。" />
            <el-table v-else :data="report.payables" stripe>
              <el-table-column prop="name" label="应付事项" min-width="180" />
              <el-table-column label="状态" width="110">
                <template #default="{ row }"><StatusTag :text="payableStatusMeta(row).label" :tone="payableStatusMeta(row).tone" /></template>
              </el-table-column>
              <el-table-column prop="dueDate" label="到期日" width="120" />
              <el-table-column label="已付 / 应付" min-width="160" align="right">
                <template #default="{ row }">¥{{ row.paidAmount.toFixed(2) }} / ¥{{ row.amount.toFixed(2) }}</template>
              </el-table-column>
              <el-table-column label="未付" width="140" align="right">
                <template #default="{ row }"><MoneyText :value="row.outstandingAmount" /></template>
              </el-table-column>
              <el-table-column label="操作" width="180">
                <template #default="{ row }">
                  <el-button v-if="canWrite" link type="primary" @click="openPayableEdit(row)">编辑</el-button>
                  <el-button v-if="canWrite" link type="success" :disabled="!row.outstandingAmount" @click="openPayment(row)">付款</el-button>
                  <span v-if="readOnly">—</span>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="资金台账" name="ledger">
            <div class="finance-actions" style="justify-content: flex-start; margin-bottom: 16px;">
              <el-button v-if="canWrite" type="primary" plain @click="editingLedger = null; ledgerDrawer = true">手工记账</el-button>
              <el-button @click="router.push(`/finance/ledger?projectId=${projectId}`)">打开资金台账</el-button>
            </div>
            <EmptyState v-if="!report.recentLedgers.length" title="暂无项目资金流水" description="登记项目收款、付款或手工记账后，这里会形成资金事实。" />
            <el-table v-else :data="report.recentLedgers" stripe>
              <el-table-column prop="occurredAt" label="日期" width="120" />
              <el-table-column label="方向" width="90">
                <template #default="{ row }"><StatusTag :text="directionMeta(row).label" :tone="directionMeta(row).tone" /></template>
              </el-table-column>
              <el-table-column prop="summary" label="摘要" min-width="200" show-overflow-tooltip />
              <el-table-column prop="category" label="分类" min-width="120" />
              <el-table-column label="金额" width="150" align="right">
                <template #default="{ row }"><MoneyText :value="row.direction === 'income' ? row.amount : -row.amount" delta /></template>
              </el-table-column>
              <el-table-column label="操作" width="100">
                <template #default="{ row }"><el-button v-if="canCorrectLedger(row)" link type="primary" @click="openLedgerEdit(row)">更正</el-button><span v-else>—</span></template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="项目结算" name="settlement">
            <div class="finance-settlement">
              <PanelCard title="结算金额与状态" description="确认后冻结结算金额；关闭前需应收应付全部结清。">
                <div v-if="report.settlement" class="finance-settlement__facts">
                  <div class="finance-settlement__fact"><span>结算状态</span><strong>{{ SETTLEMENT_STATUS_META[report.settlement.status].label }}</strong></div>
                  <div class="finance-settlement__fact"><span>最终金额</span><strong><MoneyText :value="report.settlement.finalAmount" /></strong></div>
                  <div class="finance-settlement__fact"><span>质保金</span><strong><MoneyText :value="report.settlement.retentionAmount" /></strong></div>
                  <div class="finance-settlement__fact"><span>结算成本</span><strong><MoneyText :value="report.settlement.totalCost" /></strong></div>
                  <div class="finance-settlement__fact"><span>结算利润</span><strong>
                    <CostIncompleteValue v-if="!report.settlement.costComplete" />
                    <MoneyText v-else :value="report.settlement.profitAmount" />
                  </strong></div>
                  <div class="finance-settlement__fact"><span>毛利率</span><strong>{{ report.settlement.grossMargin ?? '暂不可确认' }}</strong></div>
                </div>
                <EmptyState v-else title="尚未生成项目结算" description="确认项目完成并具备结算条件后，可重算并生成结算。" />
              </PanelCard>

              <PanelCard title="结算动作" description="页面只提交动作，状态与金额由服务端裁决。">
                <div class="finance-settlement-actions">
                  <el-button v-if="canWrite" type="primary" :loading="actionBusy" @click="generateSettlement">{{ report.settlement ? '重算结算' : '生成结算' }}</el-button>
                  <el-button v-if="canWrite && report.settlement?.status === 'draft'" :loading="actionBusy" @click="confirmSettlement">确认结算</el-button>
                  <el-button v-if="canWrite && report.settlement?.status === 'confirmed'" type="danger" plain :loading="actionBusy" @click="closeSettlement">关闭结算</el-button>
                  <el-button v-if="canWrite && report.settlement?.status === 'retentionPending'" type="warning" plain :loading="actionBusy" @click="releaseRetention">释放质保金</el-button>
                  <span v-if="readOnly">本店财务只读，结算动作不可用。</span>
                </div>
                <p class="finance-drawer__hint" style="margin-top:16px;">不满足应收应付结清、成本完整性或状态条件时，服务端会拒绝并返回恢复路径。</p>
              </PanelCard>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </template>

    <FinanceReceivableDrawer v-model:visible="receivableDrawer" :project-id="projectId" :item="editingReceivable" @saved="load" />
    <FinanceCollectionDrawer v-model:visible="collectionDrawer" :project-id="projectId" :receivable-id="collecting?.id" @saved="load" />
    <FinancePayableDrawer v-model:visible="payableDrawer" :project-id="projectId" :item="editingPayable" @saved="load" />
    <FinancePaymentDrawer v-model:visible="paymentDrawer" :project-id="projectId" :payable-id="paying?.id" @saved="load" />
    <FinanceLedgerDrawer v-model:visible="ledgerDrawer" :project-id="projectId" :item="editingLedger" @saved="load" />
  </div>
</template>

<style scoped lang="scss">
.finance-back {
  display: inline-flex;
  margin-bottom: $space-3;
  padding: 0;
  color: $brand-600;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.finance-settlement-actions {
  display: flex;
  flex-wrap: wrap;
  gap: $space-2;
}
</style>
