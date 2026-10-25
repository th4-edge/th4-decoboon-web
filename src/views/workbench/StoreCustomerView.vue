<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ProviderError } from '@/core/http'
import { crmApi } from '@/domains/crm/api'
import type { Customer } from '@/domains/crm/model'
import { identityApi, type EmployeeOption } from '@/domains/identity/api'
import PropertyPicker from '@/components/picker/PropertyPicker.vue'
import PropertyFormDrawer from '@/components/property/PropertyFormDrawer.vue'
import { propertyApi } from '@/domains/property/api'
import type { Property } from '@/domains/property/model'
import MoneyText from '@/components/MoneyText.vue'
import CustomerLossDrawer from '@/components/customer/CustomerLossDrawer.vue'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import { notifyBlocked } from '@/core/blockedNotice'
import { useSessionStore } from '@/stores/session'
import { useStoreScopeStore } from '@/stores/storeScope'
import type { StoreScopeInfo } from '@/domains/crm/model'

const ROLE_LABELS: Record<string, string> = {
  Boss: '企业负责人', StoreManager: '店长', TeamLeader: '团队负责人',
  Marketer: '业务员', Designer: '设计师', Pm: '项目经理', Finance: '财务'
}

const STAGE_LABEL: Record<string, string> = {
  intention: '待首联', following: '跟进中', pendingMeasure: '待量房', quote: '方案报价',
  sign: '已签约', construction: '施工中', done: '已完工', lost: '已流失'
}

const session = useSessionStore()
const scope = useStoreScopeStore()
const router = useRouter()
/**
 * 企业负责人（数据范围=企业）打开的是**全企业客户**，页面按门店维度收窄；
 * 店长（数据范围=门店）看本店客户，服务端固定本店、页面不传参（`DESIGN-BIZ-20261013-003` P0D-01）。
 */
const isCompanyScope = computed(() => session.dataScope === 'Company')
const pageTitle = computed(() => (isCompanyScope.value ? '全部客户' : '本店客户'))
const pageEyebrow = computed(() => (isCompanyScope.value ? 'ALL CUSTOMER · 全部客户' : 'STORE CUSTOMER · 本店客户'))

const customers = ref<Customer[]>([])
const directory = ref<EmployeeOption[]>([])
const keyword = ref('')
const loading = ref(false)
const error = ref('')
const busy = ref(false)
const lossVisible = ref(false)
const lossMode = ref<'mark' | 'restore'>('mark')
const canManageLoss = computed(() => ['Boss', 'StoreManager', 'Finance'].includes(session.role ?? ''))

const transferVisible = ref(false)
const assignVisible = ref(false)
const activeCustomer = ref<Customer | null>(null)
const ownerId = ref('')
const ownerReason = ref('')
const designerId = ref('')
const propertyId = ref('')
const propertyFormVisible = ref(false)
const propertyFormEditing = ref<Property | null>(null)
const propertyPickerKey = ref(0)

const ownerOptions = computed(() =>
  directory.value.map((item) => ({ value: item.id, label: `${item.name} · ${ROLE_LABELS[item.role] ?? item.role}` })))
const designerOptions = computed(() =>
  directory.value.map((item) => ({ value: item.id, label: `${item.name} · ${ROLE_LABELS[item.role] ?? item.role}` })))

/**
 * 门店维度门控（`REQ-BIZ-20261013-001` §5-I5）：门店范围对齐完成前不取数；
 * 对齐完成后按当前门店取数，门店切换重新取数。
 */
watch(
  [() => scope.resolved, () => scope.requestStoreId],
  ([ready]) => { if (ready) void load() },
  { immediate: true }
)

/**
 * 全部门店视图下「未归属门店」条数：**优先取服务端范围标注的全量口径**
 * （`customer/customer/overview` 的 `storeScope.unassignedCount`）；接口不可用时降级为本页计数，
 * 不静默显示 0（口径自证）。
 */
const serverScope = ref<StoreScopeInfo | null>(null)
const unassignedCount = computed(() => serverScope.value?.unassignedCount
  ?? customers.value.filter((item) => !item.store).length)
const showUnassigned = computed(() => isCompanyScope.value && !scope.requestStoreId && unassignedCount.value > 0)

/** 空态文案按范围区分（不得用 `—` 掩盖「没有数据」）。 */
const emptyTitle = computed(() => {
  if (!isCompanyScope.value) return '当前没有本店客户'
  return scope.requestStoreId ? '该门店暂无客户' : '暂无客户'
})
const emptyDescription = computed(() => (isCompanyScope.value
  ? '客户建档或跟进后，这里会出现可按门店筛选、可转交和指派的客户。'
  : '本店客户建档或跟进后，这里会出现可转交和指派的客户。'))

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    customers.value = await crmApi.pageCustomers({
      keyword: keyword.value.trim() || undefined,
      size: 200,
      // 全部门店 → 不传（`null`）；只有真实门店 ID 才传给服务端（门店范围角色一律不传）。
      storeId: isCompanyScope.value ? scope.requestStoreId : null
    })
    if (isCompanyScope.value) {
      // 范围标注失败不阻断主流程：降级为本页计数（见 unassignedCount）
      serverScope.value = await crmApi.customerOverviewScope(scope.requestStoreId).catch(() => null)
    } else {
      serverScope.value = null
    }
  } catch (loadError) {
    error.value = loadError instanceof ProviderError
      ? loadError.message
      : (isCompanyScope.value ? '全部客户暂不可确认' : '本店客户暂不可确认')
  } finally {
    loading.value = false
  }
}

async function loadDirectory(): Promise<void> {
  if (directory.value.length) return
  try {
    directory.value = await identityApi.employeeDirectory()
  } catch (loadError) {
    ElMessage.error(loadError instanceof ProviderError ? loadError.message : '员工范围暂不可确认')
  }
}

function stageLabel(stage: string): string { return STAGE_LABEL[stage] ?? stage }
function isLostStage(stage: string): boolean { return stage === 'lost' }

function openLoss(value: unknown, mode: 'mark' | 'restore'): void {
  activeCustomer.value = value as Customer
  lossMode.value = mode
  lossVisible.value = true
}

async function onLossUpdated(): Promise<void> {
  await load()
}

function openTransfer(value: unknown): void {
  activeCustomer.value = value as Customer
  ownerId.value = ''
  ownerReason.value = ''
  void loadDirectory()
  transferVisible.value = true
}

function openAssign(value: unknown): void {
  activeCustomer.value = value as Customer
  designerId.value = ''
  propertyId.value = ''
  void loadDirectory()
  assignVisible.value = true
}

function openDesign(value: unknown): void {
  const customer = value as Customer
  if (!customer.id) return
  void router.push({ path: '/designer/customers', query: { customerId: customer.id } })
}

async function submitTransfer(): Promise<void> {
  const customer = activeCustomer.value
  if (!customer) return
  if (!ownerId.value) { ElMessage.warning('请选择新的负责人'); return }
  if (!ownerReason.value.trim()) { ElMessage.warning('请填写负责人变更原因'); return }
  if (busy.value) return
  busy.value = true
  try {
    await crmApi.changeOwner({ customerId: customer.id, ownerId: ownerId.value, reason: ownerReason.value.trim() })
    ElMessage.success('已转交客户负责人')
    transferVisible.value = false
    await load()
  } catch (actionError) {
    ElMessage.error(actionError instanceof ProviderError ? actionError.message : '转交失败，暂不可确认')
  } finally {
    busy.value = false
  }
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

async function onPropertySaved(property: Property): Promise<void> {
  propertyPickerKey.value += 1
  if (property.id) propertyId.value = property.id
}

async function submitAssign(): Promise<void> {
  const customer = activeCustomer.value
  if (!customer) return
  if (!designerId.value) { ElMessage.warning('请选择设计师'); return }
  if (busy.value) return
  busy.value = true
  try {
    await crmApi.assignDesigner({ customerId: customer.id, designerId: designerId.value, propertyId: propertyId.value || undefined })
    ElMessage.success('已指派设计师')
    assignVisible.value = false
    await load()
  } catch (actionError) {
    ElMessage.error(actionError instanceof ProviderError ? actionError.message : '指派失败，暂不可确认')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">{{ pageEyebrow }}</span>
        <h1>
          {{ pageTitle }}
          <span class="store-customer__scope">{{ scope.activeStoreName }}</span>
          <span v-if="showUnassigned" class="store-customer__unassigned">含未归属门店 {{ unassignedCount }} 条</span>
        </h1>
        <p v-if="isCompanyScope">按门店维度查看全企业客户（门店维度只收窄查看范围，不改变权限）；未归属门店的客户在全部门店视图下显式标注。</p>
        <p v-else>按门店数据范围查看客户，转交本店负责人或指派设计承接人员；候选人不限制岗位，跨门店对象不返回。</p>
      </div>
      <div class="finance-actions">
        <el-input v-model="keyword" clearable placeholder="搜索客户 / 小区" style="width: 220px" @keyup.enter="load" @clear="load" />
        <el-button @click="load">刷新</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default><el-button size="small" plain @click="load">重新加载</el-button></template>
    </el-alert>

    <PanelCard flush>
      <SkeletonBlock v-if="loading && !customers.length" variant="table" :rows="6" />
      <EmptyState v-else-if="!loading && !customers.length" :title="emptyTitle" :description="emptyDescription" />
      <el-table v-else :data="customers" stripe>
        <el-table-column label="客户" min-width="220">
          <template #default="{ row }">
            <div class="finance-table__main">
              <span class="finance-table__title">{{ row.name }}</span>
              <span class="finance-table__sub">{{ row.community || '未填小区' }} · {{ row.phone }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column v-if="isCompanyScope" label="归属门店" width="130">
          <template #default="{ row }">
            <span v-if="row.store?.name">{{ row.store.name }}</span>
            <span v-else class="store-customer__unassigned">未归属门店</span>
          </template>
        </el-table-column>
        <el-table-column label="阶段" width="110">
          <template #default="{ row }"><StatusTag :text="stageLabel(row.stage)" :tone="isLostStage(row.stage) ? 'closed' : 'doing'" /></template>
        </el-table-column>
        <el-table-column label="负责人" width="140">
          <template #default="{ row }">{{ row.ownerName || '—' }}</template>
        </el-table-column>
        <el-table-column label="设计师" width="140">
          <template #default="{ row }">{{ row.designerName || '未指派' }}</template>
        </el-table-column>
        <el-table-column label="预算" width="140" align="right">
          <template #default="{ row }"><MoneyText v-if="row.budget" :value="row.budget" /><span v-else>—</span></template>
        </el-table-column>
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <div class="finance-actions">
              <el-button link type="primary" @click.stop="openDesign(row)">查看方案</el-button>
              <el-button link type="primary" :disabled="isLostStage(row.stage)" @click.stop="openTransfer(row)">转交负责人</el-button>
              <el-button link :disabled="isLostStage(row.stage)" @click.stop="openAssign(row)">指派设计师</el-button>
              <el-button v-if="row.partialLoss && row.lossId" link type="danger" :disabled="!canManageLoss" @click.stop="openLoss(row, 'restore')">恢复已流失房屋</el-button>
              <el-button v-if="!isLostStage(row.stage)" link type="danger" :disabled="!canManageLoss || ['sign', 'construction', 'done'].includes(row.stage)" @click.stop="openLoss(row, 'mark')">标记流失</el-button>
              <el-button v-if="isLostStage(row.stage)" link type="danger" :disabled="!canManageLoss || !row.lossId" @click.stop="openLoss(row, 'restore')">恢复流失</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </PanelCard>

    <el-dialog v-model="transferVisible" title="转交客户负责人" width="460px" destroy-on-close>
      <p class="finance-drawer__hint">{{ activeCustomer?.name }} · 当前负责人 {{ activeCustomer?.ownerName || '—' }}</p>
      <el-select v-model="ownerId" filterable placeholder="选择本店在职员工" style="width: 100%">
        <el-option v-for="option in ownerOptions" :key="option.value" :label="option.label" :value="option.value" />
      </el-select>
      <el-input
        v-model="ownerReason"
        type="textarea"
        :rows="3"
        maxlength="200"
        show-word-limit
        placeholder="请说明本次负责人变更原因"
        style="margin-top: 12px"
      />
      <p class="finance-drawer__hint" style="margin-top: 8px">店长只能转交给本门店在职人员；原因会写入客户变更日志。</p>
      <p class="finance-drawer__hint" style="margin-top: 4px">
        本次变更仅影响<strong>后续新建</strong>的房屋 / 报价 / 项目 / 单据的门店归属；历史对象的门店保持不变。
      </p>
      <template #footer>
        <el-button @click="transferVisible = false">取消</el-button>
        <el-button type="primary" :loading="busy" @click="submitTransfer">确认转交</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="assignVisible" title="指派客户设计师" width="460px" destroy-on-close>
      <p class="finance-drawer__hint">{{ activeCustomer?.name }} · 当前设计师 {{ activeCustomer?.designerName || '未指派' }}</p>
      <PropertyPicker :key="propertyPickerKey" v-model="propertyId" :customer-id="activeCustomer?.id ?? ''" title="选择 activeProperty" placeholder="选择本次指派对应的房屋" />
      <el-button size="small" style="margin-top: 8px" @click="openCreateProperty">新增房屋</el-button>
      <el-button size="small" style="margin-top: 8px" :disabled="!propertyId" @click="openEditSelectedProperty">维护当前房屋</el-button>
      <el-select v-model="designerId" filterable placeholder="选择本店在职员工" style="width: 100%; margin-top: 12px">
        <el-option v-for="option in designerOptions" :key="option.value" :label="option.label" :value="option.value" />
      </el-select>
      <template #footer>
        <el-button @click="assignVisible = false">取消</el-button>
        <el-button type="primary" :loading="busy" @click="submitAssign">确认指派</el-button>
      </template>
    </el-dialog>
  </div>
    <CustomerLossDrawer
      v-model="lossVisible"
      :customer="activeCustomer"
      :mode="lossMode"
      @updated="onLossUpdated"
    />

    <PropertyFormDrawer
      v-model="propertyFormVisible"
      :customer-id="activeCustomer?.id ?? ''"
      :customer-name="activeCustomer?.name ?? ''"
      :property="propertyFormEditing"
      @saved="onPropertySaved"
    />

</template>

<style scoped>
.store-customer__scope {
  margin-left: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--fill-1, #eef2ff);
  color: var(--brand-1, #2563eb);
  font-size: 12px;
  font-weight: 500;
  vertical-align: middle;
}
.store-customer__unassigned {
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--fill-warn, #fef3c7);
  color: var(--warn-1, #b45309);
  font-size: 12px;
  font-weight: 500;
  vertical-align: middle;
}
</style>
