<script setup lang="ts">
/**
 * 业务员「我的客户」——业务员的核心工作面（App 侧对应：客户 Tab + 首页快捷「我的客户/登记客户」）。
 *
 * 能力边界（App `roles/permission.ts#marketer` 为准）：
 * - 写：写跟进 `follow/save`、安排量房 `measure`、新增/维护房屋 `property/*`、
 *   记录微信 `customer/wechat`、记录到店 `customer/visit`、休眠 `customer/dormant`、
 *   恢复 `customer/resume`、编辑客户基础资料 `customer/basic-update`、登记客户 `customer/customer/save`；
 * - 只读：本人客户的设计、报价、项目（跨业务员客户不返回，DEC-009 `Self` 范围）；
 * - **不做**：量房结论（指定设计师）、指派设计师（店长/团队长/负责人）、负责人变更、一切财务/成本/利润区块。
 *
 * 设计纪律：状态与中文一律取 `domains/crm/customerMeta.ts` 单一来源；阻断统一走 `notifyBlocked()`；
 * 动作成功后按 `reloadScopes` 回读（重新拉取客户事实），不用写响应覆盖页面。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ProviderError } from '@/core/http'
import { crmApi } from '@/domains/crm/api'
import type { Customer, CustomerFollow, CustomerStage } from '@/domains/crm/model'
import { CUSTOMER_STAGE_META } from '@/domains/crm/customerMeta'
import { DORMANT_REASONS, canManageDormantRole } from '@/domains/crm/dormant'
import { designApi } from '@/domains/design/api'
import type { DesignScheme } from '@/domains/design/model'
import { projectApi } from '@/domains/project/api'
import type { ProjectBrief } from '@/domains/project/model'
import PropertyPicker from '@/components/picker/PropertyPicker.vue'
import PropertyFormDrawer from '@/components/property/PropertyFormDrawer.vue'
import { propertyApi } from '@/domains/property/api'
import { propertyStatusMeta } from '@/domains/property/statusMeta'
import type { Property } from '@/domains/property/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import CustomerFollowFormDrawer from '@/components/customer/CustomerFollowFormDrawer.vue'
import CustomerCreateSheet from '@/components/customer/CustomerCreateSheet.vue'
import CustomerEditSheet from '@/components/customer/CustomerEditSheet.vue'
import CustomerLossDrawer from '@/components/customer/CustomerLossDrawer.vue'
import FollowImageGrid from '@/components/customer/FollowImageGrid.vue'
import { notifyBlocked } from '@/core/blockedNotice'
import { useSessionStore } from '@/stores/session'

const session = useSessionStore()
const route = useRoute()

function defaultMeasureAt(): string {
  const now = new Date(Date.now() + 60 * 60 * 1000)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:00:00`
}

/** 客户池筛选：全部 + 各阶段（阶段中文取 customerMeta 单一来源）。 */
const STAGE_FILTERS: Array<{ value: '' | CustomerStage; label: string }> = [
  { value: '', label: '全部' },
  { value: 'intention', label: CUSTOMER_STAGE_META.intention.label },
  { value: 'following', label: CUSTOMER_STAGE_META.following.label },
  { value: 'pendingMeasure', label: CUSTOMER_STAGE_META.pendingMeasure.label },
  { value: 'quote', label: CUSTOMER_STAGE_META.quote.label },
  { value: 'sign', label: CUSTOMER_STAGE_META.sign.label },
  { value: 'construction', label: CUSTOMER_STAGE_META.construction.label },
  { value: 'done', label: CUSTOMER_STAGE_META.done.label },
  { value: 'dormant', label: CUSTOMER_STAGE_META.dormant.label },
  { value: 'lost', label: CUSTOMER_STAGE_META.lost.label }
]

const customers = ref<Customer[]>([])
const keyword = ref('')
const stageFilter = ref<'' | CustomerStage>('')
const loading = ref(false)
const error = ref('')
const busy = ref(false)

const createOpen = ref(false)
const editOpen = ref(false)
const followVisible = ref(false)
const measureVisible = ref(false)
const detailVisible = ref(false)
const wechatVisible = ref(false)
const dormantVisible = ref(false)
const lossVisible = ref(false)
const lossMode = ref<'mark' | 'restore'>('mark')

const activeCustomer = ref<Customer | null>(null)

const propertyId = ref('')
const propertyFormVisible = ref(false)
const propertyFormEditing = ref<Property | null>(null)
const propertyPickerKey = ref(0)
const measureAt = ref('')

const wechatNo = ref('')
const dormantForm = ref<{ reasonCode: string; reasonText: string }>({ reasonCode: '', reasonText: '' })

const follows = ref<CustomerFollow[]>([])
const schemes = ref<DesignScheme[]>([])
const projects = ref<ProjectBrief[]>([])
const properties = ref<Property[]>([])
const detailLoading = ref(false)

const canManageDormant = computed(() => canManageDormantRole(session.role))
const canManageLoss = computed(() => canManageDormantRole(session.role))
/** App 同口径：已签约/施工中/已完工/已流失/已休眠 不允许再设休眠。 */
const canSetDormant = computed(() => Boolean(
  activeCustomer.value
  && canManageDormant.value
  && !['sign', 'construction', 'done', 'lost', 'dormant'].includes(activeCustomer.value.stage)
))
const canResumeDormant = computed(() => Boolean(activeCustomer.value && canManageDormant.value && activeCustomer.value.stage === 'dormant'))
const canMeasure = computed(() => Boolean(activeCustomer.value && ['following', 'pendingMeasure'].includes(activeCustomer.value.stage)))
const canFollow = computed(() => Boolean(activeCustomer.value && activeCustomer.value.stage !== 'dormant'))

/**
 * 深链接消费（多起点进入同一对象）：
 * 「我的预约量房」等上游页面会带 `?customerId=…&action=measure` 进入本页，
 * 本页必须**真的选中该客户**并（如指定）直接打开量房弹窗——否则就是死参数（EXP-013）。
 * 客户不在本人范围内时给出明确说明，而不是静默什么都不做（业务员只能看本人客户，DEC-009）。
 */
async function consumeQuery(): Promise<void> {
  // 阶段筛选也要消费：「我的业绩」等页面会用 ?stage=following 带人进来（不留死参数）。
  const stage = String(route.query.stage ?? '')
  if (stage && stage !== stageFilter.value) {
    const known = STAGE_FILTERS.some((item) => item.value === stage)
    if (known) {
      stageFilter.value = stage as '' | CustomerStage
      await load()
    }
  }
  const customerId = String(route.query.customerId ?? '')
  if (!customerId) return
  const target = customers.value.find((item) => item.id === customerId)
  if (!target) {
    ElMessage.warning('该客户不在您的客户范围内：业务员只能查看本人负责的客户。')
    return
  }
  activeCustomer.value = target
  if (String(route.query.action ?? '') === 'measure') openMeasure(target)
  else await openDetail(target)
}

onMounted(async () => {
  await load()
  await consumeQuery()
})

watch(() => route.query.customerId, () => { void consumeQuery() })

function stageLabel(stage: string): string {
  return CUSTOMER_STAGE_META[stage as CustomerStage]?.label ?? stage
}
function stageTone(stage: string): 'closed' | 'doing' | 'muted' | 'todo' {
  const tone = CUSTOMER_STAGE_META[stage as CustomerStage]?.tone
  return tone === 'closed' || tone === 'muted' || tone === 'todo' ? tone : 'doing'
}
function isLost(stage: string): boolean { return stage === 'lost' }
function isDormant(stage: string): boolean { return stage === 'dormant' }

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    customers.value = await crmApi.pageCustomers({
      keyword: keyword.value.trim() || undefined,
      stage: stageFilter.value || undefined,
      size: 200
    })
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '我的客户暂不可确认'
  } finally {
    loading.value = false
  }
}

function onCustomerCreated(): void {
  createOpen.value = false
  ElMessage.success('客户已登记，归入您的客户池')
  void load()
}

function openCreate(): void { createOpen.value = true }

function openEdit(value: unknown): void {
  activeCustomer.value = value as Customer
  editOpen.value = true
}

function onCustomerSaved(): void {
  editOpen.value = false
  ElMessage.success('客户资料已更新')
  void load()
  if (detailVisible.value) void openDetail(activeCustomer.value)
}

function openFollow(value: unknown): void {
  const customer = value as Customer
  if (isDormant(customer.stage)) {
    notifyBlocked({
      title: '该客户已休眠',
      message: '休眠客户不写跟进：先「恢复」客户，再记录新的跟进记录。'
    })
    return
  }
  activeCustomer.value = customer
  followVisible.value = true
}

function openCreateProperty(): void {
  if (!activeCustomer.value?.id) {
    notifyBlocked({
      title: '请先选择客户',
      message: '建立房屋需要绑定具体客户：先在左侧客户列表选择一位客户，再建立房屋档案。'
    })
    return
  }
  propertyFormEditing.value = null
  propertyFormVisible.value = true
}

function openEditProperty(property: Property): void {
  propertyFormEditing.value = property
  propertyFormVisible.value = true
}

async function openEditSelectedProperty(): Promise<void> {
  if (!propertyId.value) {
    notifyBlocked({
      title: '请先选择房屋',
      message: '先在上方选择本次要处理的房屋，再编辑房屋资料。'
    })
    return
  }
  try {
    const detail = await propertyApi.getProperty(activeCustomer.value?.id ?? '', propertyId.value)
    if (!detail) {
      ElMessage.error('未读取到房屋档案，请刷新后重试')
      return
    }
    openEditProperty(detail)
  } catch {
    ElMessage.error('房屋档案读取失败，请稍后重试')
  }
}

function openEditFromDetail(value: unknown): void {
  const property = value as Property
  propertyId.value = property.id
  openEditProperty(property)
}

async function onPropertySaved(property: Property): Promise<void> {
  propertyPickerKey.value += 1
  if (property.id) propertyId.value = property.id
  if (detailVisible.value && activeCustomer.value) await loadDetailFacts(activeCustomer.value)
}

function openMeasure(value: unknown): void {
  const customer = value as Customer
  if (isDormant(customer.stage)) {
    notifyBlocked({
      title: '该客户已休眠',
      message: '休眠客户不安排量房：先「恢复」客户，再约定量房时间。'
    })
    return
  }
  activeCustomer.value = customer
  propertyId.value = ''
  measureAt.value = defaultMeasureAt()
  measureVisible.value = true
}

async function loadDetailFacts(customer: Customer): Promise<void> {
  const [followRows, schemeRows, projectRows, propertyRows] = await Promise.all([
    crmApi.customerFollows(customer.id),
    designApi.listSchemes(customer.id).catch(() => [] as DesignScheme[]),
    projectApi.listProjects({ size: 200 }).catch(() => [] as ProjectBrief[]),
    propertyApi.listProperties(customer.id).catch(() => [] as Property[])
  ])
  follows.value = followRows
  schemes.value = schemeRows
  projects.value = projectRows.filter((item) => item.customerId === customer.id)
  properties.value = propertyRows
}

async function openDetail(value: unknown): Promise<void> {
  const customer = value as Customer
  activeCustomer.value = customer
  detailVisible.value = true
  detailLoading.value = true
  follows.value = []
  schemes.value = []
  projects.value = []
  properties.value = []
  try {
    await loadDetailFacts(customer)
  } catch (loadError) {
    ElMessage.error(loadError instanceof ProviderError ? loadError.message : '客户详情暂不可确认')
  } finally {
    detailLoading.value = false
  }
}

async function submitMeasure(): Promise<void> {
  const customer = activeCustomer.value
  if (!customer) return
  if (!propertyId.value) { ElMessage.warning('请选择房屋'); return }
  if (!measureAt.value) { ElMessage.warning('请选择量房时间'); return }
  if (busy.value) return
  busy.value = true
  try {
    await crmApi.scheduleMeasure(customer.id, propertyId.value, measureAt.value.replace('T', ' '))
    ElMessage.success('已安排量房')
    measureVisible.value = false
    await load()
    if (detailVisible.value) await loadDetailFacts(customer)
  } catch (actionError) {
    ElMessage.error(actionError instanceof ProviderError ? actionError.message : '安排量房失败，暂不可确认')
  } finally {
    busy.value = false
  }
}

function openWechat(value: unknown): void {
  const customer = value as Customer
  activeCustomer.value = customer
  wechatNo.value = customer.wechatNo ?? ''
  wechatVisible.value = true
}

async function submitWechat(): Promise<void> {
  const customer = activeCustomer.value
  if (!customer || busy.value) return
  if (wechatNo.value.trim().length > 64) { ElMessage.warning('微信号不超过 64 个字符'); return }
  busy.value = true
  try {
    await crmApi.recordWechat(customer.id, wechatNo.value.trim() || undefined)
    ElMessage.success('已记录微信')
    wechatVisible.value = false
    await load()
    if (detailVisible.value) await loadDetailFacts(customer)
  } catch (actionError) {
    ElMessage.error(actionError instanceof ProviderError ? actionError.message : '记录微信失败，暂不可确认')
  } finally {
    busy.value = false
  }
}

async function submitVisit(value: unknown): Promise<void> {
  const customer = value as Customer
  if (!customer || busy.value) return
  try {
    await ElMessageBox.confirm(
      `确认登记「${customer.name}」本次到店？到店次数按实际登记累计，不会重复计算。`,
      '记录到店',
      { type: 'info', confirmButtonText: '确认记录' }
    )
  } catch {
    return
  }
  busy.value = true
  try {
    await crmApi.recordVisit(customer.id)
    ElMessage.success('已记录到店')
    await load()
    if (detailVisible.value) await loadDetailFacts(customer)
  } catch (actionError) {
    ElMessage.error(actionError instanceof ProviderError ? actionError.message : '记录到店失败，暂不可确认')
  } finally {
    busy.value = false
  }
}

function openDormant(value: unknown): void {
  const customer = value as Customer
  if (!canManageDormant.value) {
    notifyBlocked({ title: '当前角色不能设置休眠', message: '休眠/恢复由业务员、设计师、店长或企业负责人执行。' })
    return
  }
  activeCustomer.value = customer
  dormantForm.value = { reasonCode: '', reasonText: '' }
  dormantVisible.value = true
}

async function submitDormant(): Promise<void> {
  const customer = activeCustomer.value
  if (!customer || busy.value) return
  if (!dormantForm.value.reasonCode) { ElMessage.warning('请选择休眠原因'); return }
  const reasonLabel = DORMANT_REASONS.find((item) => item.value === dormantForm.value.reasonCode)?.label ?? ''
  if (dormantForm.value.reasonCode === 'Other' && !dormantForm.value.reasonText.trim()) {
    ElMessage.warning('选择「其他」时必须填写原因说明')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认将「${customer.name}」设为休眠？原因：${reasonLabel}。休眠后不写跟进、不安排量房，需先恢复。`,
      '设置休眠客户',
      { type: 'warning', confirmButtonText: '确认休眠' }
    )
  } catch {
    return
  }
  busy.value = true
  try {
    await crmApi.setDormant(
      customer.id,
      dormantForm.value.reasonCode,
      dormantForm.value.reasonText.trim() || undefined,
      customer.stage
    )
    ElMessage.success('客户已休眠')
    dormantVisible.value = false
    await load()
    if (detailVisible.value) await loadDetailFacts(customer)
  } catch (actionError) {
    ElMessage.error(actionError instanceof ProviderError ? actionError.message : '设置休眠失败，暂不可确认')
  } finally {
    busy.value = false
  }
}

/** 是否已过约定跟进时间（展示层判断；到期口径由服务端事实给出，前端不做业务裁决）。 */
function isFollowOverdue(value: unknown): boolean {
  const customer = value as Customer
  if (!customer.nextFollowAt) return false
  return new Date(customer.nextFollowAt.replace(' ', 'T')).getTime() < Date.now()
}

/**
 * 表格行「更多」菜单分发（与详情抽屉动作共用同一批处理函数）。 */
function handleRowCommand(cmd: string, row: unknown): void {
  if (cmd === 'wechat') openWechat(row)
  else if (cmd === 'visit') void submitVisit(row)
  else if (cmd === 'edit') openEdit(row)
  else if (cmd === 'dormant') openDormant(row)
  else if (cmd === 'resume') void resumeRow(row)
  else if (cmd === 'loss') openLoss(row, 'mark')
  else if (cmd === 'restoreLost') openLoss(row, 'restore')
}

/** 流失/恢复共用受控抽屉；服务端按当前登录角色、数据范围和客户状态再次裁决。 */
function openLoss(value: unknown, mode: 'mark' | 'restore'): void {
  if (!canManageLoss.value) {
    notifyBlocked({ title: '当前角色不能操作客户流失', message: '流失/恢复由业务员、设计师、店长、企业负责人或财务执行。' })
    return
  }
  activeCustomer.value = value as Customer
  lossMode.value = mode
  lossVisible.value = true
}

async function onLossUpdated(): Promise<void> {
  await load()
  if (detailVisible.value && activeCustomer.value) await loadDetailFacts(activeCustomer.value)
}

/** 行内「恢复客户」：先选中该行客户，再走与详情抽屉相同的恢复流程。 */
async function resumeRow(value: unknown): Promise<void> {
  activeCustomer.value = value as Customer
  await submitResume()
}

async function submitResume(): Promise<void> {
  const customer = activeCustomer.value
  if (!customer || busy.value) return
  if (!canResumeDormant.value) {
    notifyBlocked({ title: '该客户不是休眠状态', message: '只有休眠中的客户可以恢复。' })
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认恢复「${customer.name}」？恢复后的阶段按原业务状态自动确定。`,
      '恢复休眠客户',
      { type: 'info', confirmButtonText: '确认恢复' }
    )
  } catch {
    return
  }
  busy.value = true
  try {
    await crmApi.resumeDormant(customer.id)
    ElMessage.success('客户已恢复')
    await load()
    if (detailVisible.value) await loadDetailFacts(customer)
  } catch (actionError) {
    ElMessage.error(actionError instanceof ProviderError ? actionError.message : '恢复失败，暂不可确认')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">MY CUSTOMER · 我的客户</span>
        <h1>我的客户</h1>
        <p>按本人客户归属查看，写跟进、安排量房、登记微信与到店、维护房屋与客户资料；本人客户的设计与项目为只读，跨业务员客户不返回。</p>
      </div>
      <div class="finance-actions">
        <el-input v-model="keyword" clearable placeholder="搜索客户 / 小区" style="width: 220px" @keyup.enter="load" @clear="load" />
        <el-button type="primary" @click="openCreate">登记客户</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default><el-button size="small" plain @click="load">重新加载</el-button></template>
    </el-alert>

    <PanelCard flush>
      <div class="marketer-pool" role="tablist" aria-label="客户池筛选">
        <el-radio-group v-model="stageFilter" size="small" @change="load">
          <el-radio-button v-for="item in STAGE_FILTERS" :key="item.value || 'all'" :value="item.value">{{ item.label }}</el-radio-button>
        </el-radio-group>
      </div>

      <SkeletonBlock v-if="loading && !customers.length" variant="table" :rows="6" />
      <EmptyState
        v-else-if="!loading && !customers.length"
        :title="stageFilter ? '该阶段暂时没有客户' : '当前没有分配给您的客户'"
        :description="stageFilter ? '切换到「全部」查看其它阶段的客户。' : '客户建档并归属到您后，这里会出现跟进入口。'"
      />
      <el-table v-else :data="customers" stripe>
        <el-table-column label="客户" min-width="220">
          <template #default="{ row }">
            <div class="finance-table__main">
              <span class="finance-table__title">{{ row.name }}</span>
              <span class="finance-table__sub">{{ row.community || '未填小区' }} · {{ row.phone }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="阶段" width="110">
          <template #default="{ row }"><StatusTag :text="stageLabel(row.stage)" :tone="stageTone(row.stage)" /></template>
        </el-table-column>
        <el-table-column label="微信 / 到店" width="130">
          <template #default="{ row }">
            <span class="finance-table__sub">{{ row.wechatAdded ? '已加微信' : '未加微信' }} · 到店 {{ row.visitCount || 0 }} 次</span>
          </template>
        </el-table-column>
        <el-table-column label="设计师" width="120">
          <template #default="{ row }">{{ row.designerName || '未指派' }}</template>
        </el-table-column>
        <el-table-column label="预算" width="120" align="right">
          <template #default="{ row }"><MoneyText v-if="row.budget" :value="row.budget" /><span v-else>—</span></template>
        </el-table-column>
        <el-table-column label="最近跟进" width="150">
          <template #default="{ row }">{{ row.lastFollowAt || '—' }}</template>
        </el-table-column>
        <el-table-column label="下次跟进" width="170">
          <template #default="{ row }">
            <span v-if="!row.nextFollowAt">未安排</span>
            <span v-else :class="{ 'marketer-due--overdue': isFollowOverdue(row) }">
              {{ row.nextFollowAt }}<template v-if="isFollowOverdue(row)"> · 已到期</template>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <div class="finance-actions">
              <el-button link type="primary" :disabled="isLost(row.stage) || isDormant(row.stage)" @click.stop="openFollow(row)">写跟进</el-button>
              <el-button link :disabled="isDormant(row.stage)" @click.stop="openMeasure(row)">安排量房</el-button>
              <el-button link @click.stop="openDetail(row)">详情</el-button>
              <el-dropdown trigger="click" @command="(cmd: string) => handleRowCommand(cmd, row)">
                <el-button link>更多</el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="wechat">记录微信</el-dropdown-item>
                    <el-dropdown-item command="visit">记录到店</el-dropdown-item>
                    <el-dropdown-item command="edit">编辑资料</el-dropdown-item>
                    <el-dropdown-item v-if="!isDormant(row.stage)" command="dormant" :disabled="['sign', 'construction', 'done', 'lost'].includes(row.stage)">设置休眠</el-dropdown-item>
                    <el-dropdown-item v-else command="resume">恢复休眠客户</el-dropdown-item>
                    <el-dropdown-item v-if="row.partialLoss && row.lossId" command="restoreLost">恢复已流失房屋</el-dropdown-item>
                    <el-dropdown-item v-if="!isLost(row.stage)" command="loss" :disabled="['sign', 'construction', 'done'].includes(row.stage)">标记流失</el-dropdown-item>
                    <el-dropdown-item v-if="isLost(row.stage)" command="restoreLost" :disabled="!row.lossId">恢复流失客户</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </PanelCard>

    <CustomerLossDrawer
      v-model="lossVisible"
      :customer="activeCustomer"
      :property-id="propertyId || activeCustomer?.lossPropertyId"
      :property-name="properties.find((item) => item.id === (propertyId || activeCustomer?.lossPropertyId))?.community || activeCustomer?.lossPropertyName"
      :mode="lossMode"
      @updated="onLossUpdated"
    />

    <CustomerCreateSheet :open="createOpen" @close="createOpen = false" @created="onCustomerCreated" />
    <CustomerEditSheet :open="editOpen" :customer="activeCustomer" @close="editOpen = false" @saved="onCustomerSaved" />
    <CustomerFollowFormDrawer v-model="followVisible" :customer="activeCustomer" @saved="load" />
    <PropertyFormDrawer
      v-model="propertyFormVisible"
      :customer-id="activeCustomer?.id ?? ''"
      :customer-name="activeCustomer?.name ?? ''"
      :property="propertyFormEditing"
      @saved="onPropertySaved"
    />

    <el-dialog v-model="measureVisible" title="安排量房" width="460px" destroy-on-close>
      <p class="finance-drawer__hint">{{ activeCustomer?.name }} · 量房前必须先建立并选择房屋档案。</p>
      <PropertyPicker :key="propertyPickerKey" v-model="propertyId" :customer-id="activeCustomer?.id ?? ''" title="选择量房房屋" placeholder="选择本次量房的房屋" />
      <el-button size="small" style="margin-top: 8px" @click="openCreateProperty">新增房屋</el-button>
      <el-button size="small" style="margin-top: 8px" :disabled="!propertyId" @click="openEditSelectedProperty">维护当前房屋</el-button>
      <el-date-picker v-model="measureAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="量房时间（晚于当前）" style="width: 100%; margin-top: 12px" />
      <template #footer>
        <el-button @click="measureVisible = false">取消</el-button>
        <el-button type="primary" :loading="busy" :disabled="!canMeasure" @click="submitMeasure">确认安排</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="wechatVisible" title="记录客户微信" width="420px" destroy-on-close>
      <p class="finance-drawer__hint">{{ activeCustomer?.name }} · 只记录「已加微信」这一事实；微信号可留空，有值时不超过 64 个字符。</p>
      <el-input v-model="wechatNo" maxlength="64" show-word-limit placeholder="微信号（可留空）" />
      <template #footer>
        <el-button @click="wechatVisible = false">取消</el-button>
        <el-button type="primary" :loading="busy" @click="submitWechat">确认记录</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="dormantVisible" title="设置休眠客户" width="460px" destroy-on-close>
      <p class="finance-drawer__hint">{{ activeCustomer?.name }} · 休眠后不写跟进、不安排量房；有未来量房预约不阻断休眠，预约记录继续保留。</p>
      <el-select v-model="dormantForm.reasonCode" placeholder="选择休眠原因" style="width: 100%">
        <el-option v-for="item in DORMANT_REASONS" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-input
        v-if="dormantForm.reasonCode === 'Other'"
        v-model="dormantForm.reasonText"
        type="textarea"
        :rows="3"
        maxlength="200"
        show-word-limit
        placeholder="请填写休眠原因说明"
        style="margin-top: 8px"
      />
      <template #footer>
        <el-button @click="dormantVisible = false">取消</el-button>
        <el-button type="primary" :loading="busy" @click="submitDormant">设置休眠</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" title="客户详情" size="620px">
      <SkeletonBlock v-if="detailLoading" variant="table" :rows="5" />
      <template v-else>
        <div class="marketer-detail__head">
          <div>
            <h3>{{ activeCustomer?.name }}</h3>
            <p class="finance-table__sub">
              <StatusTag :text="stageLabel(activeCustomer?.stage ?? '')" :tone="stageTone(activeCustomer?.stage ?? '')" />
              · 设计师 {{ activeCustomer?.designerName || '未指派' }} · 负责人 {{ activeCustomer?.ownerName || '—' }}
            </p>
          </div>
          <div class="finance-actions">
            <el-button size="small" type="primary" :disabled="!canFollow || isLost(activeCustomer?.stage ?? '')" @click="openFollow(activeCustomer)">写跟进</el-button>
            <el-button size="small" @click="openEdit(activeCustomer)">编辑资料</el-button>
            <el-button size="small" @click="openWechat(activeCustomer)">记录微信</el-button>
            <el-button size="small" @click="submitVisit(activeCustomer)">记录到店</el-button>
            <el-button v-if="!isDormant(activeCustomer?.stage ?? '')" size="small" :disabled="!canSetDormant" @click="openDormant(activeCustomer)">设置休眠</el-button>
            <el-button v-else size="small" :disabled="!canResumeDormant" @click="submitResume">恢复休眠客户</el-button>
            <el-button v-if="activeCustomer?.partialLoss && activeCustomer?.lossId" size="small" :disabled="!canManageLoss" @click="openLoss(activeCustomer, 'restore')">恢复已流失房屋</el-button>
            <el-button v-if="activeCustomer?.stage !== 'lost'" size="small" :disabled="!canManageLoss || ['sign', 'construction', 'done'].includes(activeCustomer?.stage ?? '')" @click="openLoss(activeCustomer, 'mark')">标记流失</el-button>
            <el-button v-if="activeCustomer?.stage === 'lost'" size="small" :disabled="!canManageLoss || !activeCustomer?.lossId" @click="openLoss(activeCustomer, 'restore')">恢复流失客户</el-button>
          </div>
        </div>

        <h4>房屋档案</h4>
        <EmptyState v-if="!properties.length" title="暂无房屋" description="安排量房前必须先建立房屋档案。" />
        <el-table v-else :data="properties" stripe size="small">
          <el-table-column prop="name" label="房屋" min-width="150" />
          <el-table-column prop="area" label="面积" width="80" align="right" />
          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <StatusTag :text="propertyStatusMeta(row.status).label" :tone="propertyStatusMeta(row.status).tone" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="90"><template #default="{ row }"><el-button link type="primary" @click="openEditFromDetail(row)">维护</el-button></template></el-table-column>
        </el-table>
        <el-button size="small" style="margin-top: 8px" @click="openCreateProperty">新增房屋</el-button>
        <el-button size="small" style="margin-top: 8px" :disabled="!activeCustomer || isDormant(activeCustomer.stage)" @click="openMeasure(activeCustomer)">安排量房</el-button>

        <h4 style="margin-top: 16px">设计（只读）</h4>
        <EmptyState v-if="!schemes.length" title="暂无设计" description="设计师保存方案后，这里会出现只读进展。" />
        <el-table v-else :data="schemes" stripe size="small">
          <el-table-column prop="name" label="方案" min-width="150" />
          <el-table-column prop="version" label="版本" width="70" />
          <el-table-column label="状态" width="110"><template #default="{ row }"><StatusTag :text="String(row.status)" tone="info" /></template></el-table-column>
        </el-table>

        <h4 style="margin-top: 16px">项目（只读）</h4>
        <EmptyState v-if="!projects.length" title="暂无项目" description="客户签约立项后，这里会出现只读进度。" />
        <el-table v-else :data="projects" stripe size="small">
          <el-table-column prop="name" label="项目" min-width="170" />
          <el-table-column prop="progress" label="进度" width="80" align="right" />
          <el-table-column label="当前阶段" min-width="120"><template #default="{ row }">{{ row.currentStageName || '—' }}</template></el-table-column>
        </el-table>

        <h4 style="margin-top: 16px">跟进记录</h4>
        <EmptyState v-if="!follows.length" title="暂无跟进记录" description="保存跟进后，这里会出现留痕。" />
        <el-timeline v-else>
          <el-timeline-item v-for="item in follows" :key="item.id" :timestamp="item.createdAt || ''" placement="top">
            <strong>{{ item.way }}</strong>
            <p class="finance-table__sub">{{ item.empName || '' }}</p>
            <p>{{ item.content }}</p>
            <FollowImageGrid v-if="item.images?.length" :follow="item" />
          </el-timeline-item>
        </el-timeline>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.marketer-pool {
  padding: $space-3 $space-4;
  border-bottom: 1px solid $border-color;
  overflow-x: auto;
}

.marketer-due--overdue {
  color: $danger-500;
  font-weight: $font-weight-semibold;
}

.marketer-detail__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-3;
  flex-wrap: wrap;

  h3 { margin: 0 0 $space-1; }
}
</style>
