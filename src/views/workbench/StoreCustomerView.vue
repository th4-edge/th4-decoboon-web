<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'

const ROLE_LABELS: Record<string, string> = {
  Boss: '企业负责人', StoreManager: '店长', TeamLeader: '团队负责人',
  Marketer: '业务员', Designer: '设计师', Pm: '项目经理', Finance: '财务'
}

const STAGE_LABEL: Record<string, string> = {
  intention: '待首联', following: '跟进中', pendingMeasure: '待量房', quote: '方案报价',
  sign: '已签约', construction: '施工中', done: '已完工', lost: '已流失'
}

const customers = ref<Customer[]>([])
const directory = ref<EmployeeOption[]>([])
const keyword = ref('')
const loading = ref(false)
const error = ref('')
const busy = ref(false)

const transferVisible = ref(false)
const assignVisible = ref(false)
const activeCustomer = ref<Customer | null>(null)
const ownerId = ref('')
const designerId = ref('')
const propertyId = ref('')
const propertyFormVisible = ref(false)
const propertyFormEditing = ref<Property | null>(null)
const propertyPickerKey = ref(0)

const ownerOptions = computed(() =>
  directory.value.map((item) => ({ value: item.id, label: `${item.name} · ${ROLE_LABELS[item.role] ?? item.role}` })))
const designerOptions = computed(() =>
  directory.value.map((item) => ({ value: item.id, label: `${item.name} · ${ROLE_LABELS[item.role] ?? item.role}` })))

onMounted(() => { void load() })

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    customers.value = await crmApi.pageCustomers({ keyword: keyword.value.trim() || undefined, size: 200 })
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '本店客户暂不可确认'
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

function openTransfer(value: unknown): void {
  activeCustomer.value = value as Customer
  ownerId.value = ''
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

async function submitTransfer(): Promise<void> {
  const customer = activeCustomer.value
  if (!customer) return
  if (!ownerId.value) { ElMessage.warning('请选择新的负责人'); return }
  if (busy.value) return
  busy.value = true
  try {
    await crmApi.changeOwner({ customerId: customer.id, ownerId: ownerId.value })
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
    ElMessage.warning('请先选择客户')
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
    ElMessage.warning('请先选择房屋')
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
        <span class="finance-eyebrow">STORE CUSTOMER · 本店客户</span>
        <h1>本店客户</h1>
        <p>按门店数据范围查看客户，转交本店负责人或指派设计承接人员；候选人不限制岗位，跨门店对象不返回。</p>
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
      <EmptyState v-else-if="!loading && !customers.length" title="当前没有本店客户" description="本店客户建档或跟进后，这里会出现可转交和指派的客户。" />
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
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <div class="finance-actions">
              <el-button link type="primary" :disabled="isLostStage(row.stage)" @click.stop="openTransfer(row)">转交负责人</el-button>
              <el-button link :disabled="isLostStage(row.stage)" @click.stop="openAssign(row)">指派设计师</el-button>
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
      <p class="finance-drawer__hint" style="margin-top: 8px">店长只能转交给本门店在职人员。</p>
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
    <PropertyFormDrawer
      v-model="propertyFormVisible"
      :customer-id="activeCustomer?.id ?? ''"
      :customer-name="activeCustomer?.name ?? ''"
      :property="propertyFormEditing"
      @saved="onPropertySaved"
    />

</template>
