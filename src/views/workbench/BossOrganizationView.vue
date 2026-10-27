<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ProviderError } from '@/core/http'
import { bossApi } from '@/domains/boss/api'
import { identityApi } from '@/domains/identity/api'
import type { EmployeeInvite, EmployeeRole } from '@/domains/identity/model'
import type { OrganizationReport } from '@/domains/boss/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import { useStoreScopeStore } from '@/stores/storeScope'
import { useSessionStore } from '@/stores/session'
import { roleLabel } from '@/roles/permission'

const scope = useStoreScopeStore()
const session = useSessionStore()
const report = ref<OrganizationReport | null>(null)
const loading = ref(false)
const error = ref('')
const pendingInvites = ref<EmployeeInvite[]>([])
const pendingInviteLoading = ref(false)
const pendingInviteError = ref('')
const cancellingInviteId = ref('')
const inviteVisible = ref(false)
const inviteSaving = ref(false)
const inviteForm = ref({ inviteName: '', invitePhone: '', role: 'Marketer' as EmployeeRole, storeId: '' })
const stores = ref<Array<{ id: string; name: string; defaultStore?: boolean }>>([])
const canManageInvites = computed(() => session.role === 'Boss' || session.role === 'StoreManager')
const inviteRoles = computed<EmployeeRole[]>(() => session.role === 'Boss'
  ? ['StoreManager', 'Designer', 'Marketer', 'Pm', 'Finance']
  : ['Designer', 'Marketer', 'Pm', 'Finance'])

/**
 * 门店维度门控（`REQ-BIZ-20261013-001` §5-I5）：门店范围未对齐完成前不取数，
 * 避免「先用本地记忆取一次数、对齐后再改门店」导致的标题与数字不同源（I3）。
 */
watch(
  [() => scope.resolved, () => scope.requestStoreId],
  ([ready]) => {
    if (!ready) return
    void load()
    if (canManageInvites.value) {
      void loadPendingInvites()
      void loadStores()
    }
  },
  { immediate: true }
)

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    report.value = await bossApi.organizationReport(scope.requestStoreId ?? undefined)
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '组织效能暂不可确认'
  } finally {
    loading.value = false
  }
}

function percent(value: number): string { return `${value.toFixed(1)}%` }

async function loadStores(): Promise<void> {
  try {
    stores.value = await identityApi.stores()
  } catch {
    stores.value = []
  }
}

async function loadPendingInvites(): Promise<void> {
  if (!canManageInvites.value) return
  pendingInviteLoading.value = true
  pendingInviteError.value = ''
  try {
    pendingInvites.value = await identityApi.pendingInvites()
  } catch (loadError) {
    pendingInviteError.value = loadError instanceof ProviderError ? loadError.message : '待接受邀请暂不可确认'
  } finally {
    pendingInviteLoading.value = false
  }
}

function maskPhone(phone?: string): string {
  return phone && phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone || '手机号待确认'
}

function inviteRoleName(value: unknown): string {
  const invite = value as EmployeeInvite
  const role = invite.role?.value
  return role && inviteRoles.value.includes(role as EmployeeRole) ? roleLabel(role as EmployeeRole) : '岗位待确认'
}

function inviteExpireText(value?: string): string {
  if (!value) return '有效期待确认'
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return '有效期待确认'
  return `有效至 ${date.getMonth() + 1}月${date.getDate()}日`
}

function openInvite(): void {
  inviteForm.value = {
    inviteName: '',
    invitePhone: '',
    role: inviteRoles.value[0] || 'Marketer',
    storeId: stores.value.find((store) => store.defaultStore)?.id || stores.value[0]?.id || ''
  }
  inviteVisible.value = true
}

async function submitInvite(): Promise<void> {
  if (!inviteForm.value.inviteName.trim()) {
    ElMessage.warning('请填写被邀请人姓名')
    return
  }
  if (!/^1\d{10}$/.test(inviteForm.value.invitePhone)) {
    ElMessage.warning('请输入正确手机号')
    return
  }
  if (inviteForm.value.role === 'Finance' && session.role === 'Boss' && !inviteForm.value.storeId) {
    ElMessage.warning('邀请财务必须选择归属门店')
    return
  }
  inviteSaving.value = true
  try {
    const invite = await identityApi.createInvite({
      inviteName: inviteForm.value.inviteName.trim(),
      invitePhone: inviteForm.value.invitePhone,
      role: inviteForm.value.role,
      storeId: inviteForm.value.role === 'Finance' ? inviteForm.value.storeId || undefined : undefined
    })
    ElMessage.success(invite.reusedPending ? '该员工已有待接受邀请，已展示原邀请' : '邀请已创建，请在企业微信小程序中分享邀请卡片')
    inviteVisible.value = false
    await loadPendingInvites()
  } catch (saveError) {
    ElMessage.error(saveError instanceof ProviderError ? saveError.message : '邀请创建失败')
  } finally {
    inviteSaving.value = false
  }
}

async function cancelPendingInvite(value: unknown): Promise<void> {
  const invite = value as EmployeeInvite
  if (cancellingInviteId.value) return
  try {
    await ElMessageBox.confirm(
      `确定取消「${invite.inviteName || maskPhone(invite.telNo)}」的待接受邀请？取消后需重新创建。`,
      '取消邀请',
      { type: 'warning', confirmButtonText: '取消邀请', cancelButtonText: '保留邀请' }
    )
    cancellingInviteId.value = invite.inviteId
    await identityApi.cancelInvite(invite.inviteId)
    ElMessage.success('邀请已取消')
    await loadPendingInvites()
  } catch (actionError) {
    if (actionError !== 'cancel' && actionError !== 'close') {
      ElMessage.error(actionError instanceof ProviderError ? actionError.message : '取消邀请失败')
    }
  } finally {
    cancellingInviteId.value = ''
  }
}
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">ORGANIZATION · 组织效能</span>
        <h1>组织效能<span class="scope-chip">{{ scope.activeStoreName }}</span>
        <span
          v-if="report?.storeScope?.scopeType === 'AllStores' && report?.storeScope?.unassignedCount > 0"
          class="scope-chip scope-chip--warn"
        >含未归属门店 {{ report.storeScope.unassignedCount }} 条</span></h1>
        <p>本月人均产出、订单与角色产能，以及设计师/业务员/项目经理排行；样本不足时按系统标记提示。</p>
      </div>
      <div class="finance-actions">
        <el-button v-if="canManageInvites" type="primary" @click="openInvite">邀请员工</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
    </header>

    <PanelCard v-if="canManageInvites" title="待接受邀请" description="邀请创建后可从 App 邀请员工页重新分享；Web 可核对并取消邀请。">
      <template #extra><el-button :loading="pendingInviteLoading" @click="loadPendingInvites">刷新</el-button></template>
      <el-alert v-if="pendingInviteError" type="error" :closable="false" :title="pendingInviteError" show-icon>
        <template #default><el-button size="small" plain @click="loadPendingInvites">重新加载</el-button></template>
      </el-alert>
      <el-table v-loading="pendingInviteLoading" :data="pendingInvites" stripe empty-text="暂无待接受邀请">
        <el-table-column prop="inviteName" label="姓名" min-width="120" />
        <el-table-column label="手机号" min-width="130"><template #default="{ row }">{{ maskPhone(row.telNo) }}</template></el-table-column>
        <el-table-column label="岗位" width="110"><template #default="{ row }">{{ inviteRoleName(row) }}</template></el-table-column>
        <el-table-column label="归属门店" min-width="140"><template #default="{ row }">{{ row.store?.name || '门店待确认' }}</template></el-table-column>
        <el-table-column label="有效期" min-width="130"><template #default="{ row }">{{ inviteExpireText(row.expireTime) }}</template></el-table-column>
        <el-table-column label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <span class="member-readonly">请在 App 重新分享</span>
            <el-button size="small" plain type="danger" :loading="cancellingInviteId === row.inviteId" @click="cancelPendingInvite(row)">取消</el-button>
          </template>
        </el-table-column>
      </el-table>
    </PanelCard>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default><el-button size="small" plain @click="load">重新加载</el-button></template>
    </el-alert>

    <SkeletonBlock v-if="loading && !report" variant="card" :rows="4" />

    <template v-else-if="report">
      <el-alert v-if="!report.sampleSufficient" type="warning" :closable="false" show-icon title="样本不足" description="本月数据量较小，比率类指标仅供参考。" />

      <section class="finance-kpis">
        <article class="finance-kpi"><span>在职人数</span><strong>{{ report.headcount }}</strong><small>新增 {{ report.newHires }}</small></article>
        <article class="finance-kpi"><span>本月签约额</span><strong><MoneyText :value="report.signedAmount" size="lg" /></strong><small>新项目 {{ report.newProjectCount }}</small></article>
        <article class="finance-kpi"><span>人均产出</span><strong><MoneyText :value="report.perCapitaOutput" size="lg" /></strong><small>签约额 / 在职人数</small></article>
        <article class="finance-kpi"><span>人均订单</span><strong>{{ report.perCapitaOrders.toFixed(2) }}</strong><small>订单 / 在职人数</small></article>
      </section>

      <PanelCard title="角色产能" description="按角色统计在职人数与核心指标。">
        <EmptyState v-if="!report.roleCapacities.length" title="暂无角色产能数据" description="角色与在职员工就绪后展示。" />
        <el-table v-else :data="report.roleCapacities" stripe>
          <el-table-column prop="label" label="角色" min-width="130" />
          <el-table-column prop="count" label="人数" width="90" align="right" />
          <el-table-column prop="metricLabel" label="核心指标" min-width="150" />
          <el-table-column label="指标值" width="140" align="right"><template #default="{ row }">{{ row.metricValue.toFixed(2) }}</template></el-table-column>
        </el-table>
      </PanelCard>

      <PanelCard title="设计师排行" description="按报价与接受情况。">
        <EmptyState v-if="!report.designerRanking.length" title="暂无设计师数据" description="设计师产生报价后进入排行。" />
        <el-table v-else :data="report.designerRanking" stripe>
          <el-table-column prop="name" label="设计师" min-width="130" />
          <el-table-column prop="quoteCount" label="报价" width="90" align="right" />
          <el-table-column prop="acceptedQuoteCount" label="接受" width="90" align="right" />
          <el-table-column label="转化率" width="110" align="right"><template #default="{ row }">{{ percent(row.designerConversionRate) }}</template></el-table-column>
        </el-table>
      </PanelCard>

      <PanelCard title="业务员排行" description="按客户与签约情况。">
        <EmptyState v-if="!report.marketerRanking.length" title="暂无业务员数据" description="业务员建立客户后进入排行。" />
        <el-table v-else :data="report.marketerRanking" stripe>
          <el-table-column prop="name" label="业务员" min-width="130" />
          <el-table-column prop="customerCount" label="客户" width="90" align="right" />
          <el-table-column prop="signedCustomerCount" label="签约客户" width="110" align="right" />
          <el-table-column label="签约率" width="110" align="right"><template #default="{ row }">{{ percent(row.marketerSignRate) }}</template></el-table-column>
        </el-table>
      </PanelCard>

      <PanelCard title="项目经理排行" description="按交付与准时情况。">
        <EmptyState v-if="!report.pmRanking.length" title="暂无项目经理数据" description="项目经理交付项目后进入排行。" />
        <el-table v-else :data="report.pmRanking" stripe>
          <el-table-column prop="name" label="项目经理" min-width="130" />
          <el-table-column prop="deliveredProjectCount" label="已交付" width="110" align="right" />
          <el-table-column prop="onTimeProjectCount" label="准时" width="100" align="right" />
          <el-table-column label="准时率" width="110" align="right"><template #default="{ row }">{{ percent(row.pmOnTimeDeliveryRate) }}</template></el-table-column>
          <el-table-column prop="acceptanceCount" label="验收" width="90" align="right" />
        </el-table>
      </PanelCard>

      <div><StatusTag :text="report.sampleSufficient ? '样本充分' : '样本不足'" :tone="report.sampleSufficient ? 'done' : 'pending'" /></div>
    </template>

    <el-dialog v-model="inviteVisible" title="邀请员工" width="480px">
      <el-form label-position="top">
        <el-form-item label="姓名"><el-input v-model="inviteForm.inviteName" maxlength="15" /></el-form-item>
        <el-form-item label="手机号"><el-input v-model="inviteForm.invitePhone" maxlength="11" /></el-form-item>
        <el-form-item label="岗位">
          <el-select v-model="inviteForm.role" style="width: 100%">
            <el-option v-for="role in inviteRoles" :key="role" :label="roleLabel(role)" :value="role" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="inviteForm.role === 'Finance' && session.role === 'Boss'" label="归属门店" required>
          <el-select v-model="inviteForm.storeId" placeholder="请选择门店" style="width: 100%">
            <el-option v-for="store in stores" :key="store.id" :label="store.name" :value="store.id" />
          </el-select>
        </el-form-item>
        <el-alert v-if="inviteForm.role === 'Finance'" type="info" :closable="false" show-icon title="选择默认总店即邀请总部财务；选择普通门店即邀请门店财务。" />
      </el-form>
      <template #footer>
        <el-button @click="inviteVisible = false">取消</el-button>
        <el-button type="primary" :loading="inviteSaving" @click="submitInvite">创建邀请</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.scope-chip--warn {
  background: var(--fill-warn, #fef3c7);
  color: var(--warn-1, #b45309);
}
.scope-chip {
  margin-left: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--fill-1, #eef2ff);
  color: var(--brand-1, #2563eb);
  font-size: 12px;
  font-weight: 500;
  vertical-align: middle;
}
.member-readonly {
  margin-right: 8px;
  color: var(--text-3, #6b7280);
  font-size: 12px;
}
</style>
