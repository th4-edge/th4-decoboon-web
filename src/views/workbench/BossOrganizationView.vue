<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ProviderError } from '@/core/http'
import { bossApi } from '@/domains/boss/api'
import { identityApi } from '@/domains/identity/api'
import { EMPLOYEE_ROLE, EMPLOYEE_ROLES } from '@/domains/identity/model'
import type { Employee, EmployeeRole } from '@/domains/identity/model'
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
const members = ref<Employee[]>([])
const loading = ref(false)
const memberLoading = ref(false)
const error = ref('')
const memberError = ref('')
const inviteVisible = ref(false)
const inviteSaving = ref(false)
const inviteForm = ref({ inviteName: '', invitePhone: '', role: 'Finance' as EmployeeRole, storeId: '' })
type MemberStatus = 'Active' | 'Suspended' | 'Resigned'
const memberStatus = ref<MemberStatus>('Active')
const memberTabs: { value: MemberStatus; label: string }[] = [
  { value: 'Active', label: '在职' },
  { value: 'Suspended', label: '停用' },
  { value: 'Resigned', label: '离职' }
]
const editVisible = ref(false)
const editSaving = ref(false)
const editMember = ref<Employee | null>(null)
const editForm = ref({ role: 'Designer' as EmployeeRole, storeId: '' })
const manageRoles = computed(() => (session.role === 'Boss'
  ? (['StoreManager', 'Designer', 'Marketer', 'Pm', 'Finance'] as EmployeeRole[])
  : (['Designer', 'Marketer', 'Pm', 'Finance'] as EmployeeRole[])))
const canManageMembers = computed(() => session.role === 'Boss' || session.role === 'StoreManager')
const inviteRoles = computed(() => (session.role === 'Boss'
  ? (['StoreManager', 'Designer', 'Marketer', 'Pm', 'Finance'] as EmployeeRole[])
  : (['Designer', 'Marketer', 'Pm', 'Finance'] as EmployeeRole[])))
const restrictedMemberRoles = new Set<EmployeeRole>([EMPLOYEE_ROLE.STORE_MANAGER, EMPLOYEE_ROLE.TEAM_LEADER])

/**
 * 门店维度门控（`REQ-BIZ-20261013-001` §5-I5）：门店范围未对齐完成前不取数，
 * 避免「先用本地记忆取一次数、对齐后再改门店」导致的标题与数字不同源（I3）。
 */
watch(
  [() => scope.resolved, () => scope.requestStoreId],
  ([ready]) => { if (ready) { void load(); void loadMembers() } },
  { immediate: true }
)

async function loadMembers(): Promise<void> {
  if (!canManageMembers.value) return
  memberLoading.value = true
  memberError.value = ''
  try {
    members.value = await identityApi.memberPage({ status: memberStatus.value, storeId: scope.requestStoreId ?? undefined })
  } catch (loadError) {
    memberError.value = loadError instanceof ProviderError ? loadError.message : '成员与组织暂不可确认'
  } finally {
    memberLoading.value = false
  }
}

async function load(): Promise<void> {
  // 组织效能报告是 BOSS 专属经营视图；店长共用本页时只加载其权限范围内的成员事实。
  if (session.role !== 'Boss') {
    report.value = null
    error.value = ''
    loading.value = false
    return
  }
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
function memberRole(member: unknown): EmployeeRole {
  const value = (member as Employee).role?.value
  return (value && EMPLOYEE_ROLES.includes(value as EmployeeRole))
    ? value as EmployeeRole
    : 'Marketer'
}
function memberRoleName(member: unknown): string { return roleLabel(memberRole(member)) }
function isFinance(member: unknown): boolean { return memberRole(member) === 'Finance' }
function memberStatusValue(member: unknown): string {
  const value = (member as Employee).status?.value
  return value || 'Active'
}
function memberStatusName(member: unknown): string {
  return ({ Active: '在职', Suspended: '停用', Resigned: '已离职' } as Record<string, string>)[memberStatusValue(member)] || '状态待确认'
}
function isSelf(member: unknown): boolean { return (member as Employee).empId === session.employee?.empId }
function canManageRow(member: unknown): boolean {
  const row = member as Employee
  if (isSelf(row) || memberRole(row) === EMPLOYEE_ROLE.BOSS) return false
  if (session.role === 'Boss') return true
  return session.role === 'StoreManager' && !restrictedMemberRoles.has(memberRole(row))
}
function canEditRow(member: unknown): boolean {
  return canManageRow(member) && memberStatusValue(member) !== 'Resigned'
}
function openEdit(member: unknown): void {
  const row = member as Employee
  editMember.value = row
  editForm.value = { role: memberRole(row), storeId: row.store?.storeId || '' }
  editVisible.value = true
}
async function submitEdit(): Promise<void> {
  if (!editMember.value) return
  editSaving.value = true
  try {
    await identityApi.updateMember(editMember.value.empId, editForm.value.role,
      session.role === 'Boss' ? editForm.value.storeId || undefined : undefined)
    ElMessage.success('成员岗位与门店已更新')
    editVisible.value = false
    await Promise.all([loadMembers(), load()])
  } catch (saveError) {
    ElMessage.error(saveError instanceof ProviderError ? saveError.message : '成员调整失败')
  } finally {
    editSaving.value = false
  }
}
async function suspendMember(member: unknown): Promise<void> {
  const row = member as Employee
  try {
    await ElMessageBox.confirm(`确认停用 ${row.name}？停用后立即失去企业数据访问权限。`, '停用员工', { type: 'warning' })
    await identityApi.suspendMember(row.empId)
    ElMessage.success('员工已停用')
    await Promise.all([loadMembers(), load()])
  } catch (actionError) {
    if (actionError !== 'cancel' && actionError !== 'close') {
      ElMessage.error(actionError instanceof ProviderError ? actionError.message : '停用失败')
    }
  }
}
async function resumeMember(member: unknown): Promise<void> {
  const row = member as Employee
  try {
    await ElMessageBox.confirm(`确认恢复 ${row.name}？系统将重新校验门店状态和企业席位容量。`, '恢复员工', { type: 'warning' })
    await identityApi.resumeMember(row.empId)
    ElMessage.success('员工已恢复')
    await Promise.all([loadMembers(), load()])
  } catch (actionError) {
    if (actionError !== 'cancel' && actionError !== 'close') {
      ElMessage.error(actionError instanceof ProviderError ? actionError.message : '恢复失败')
    }
  }
}
async function resignMember(member: unknown): Promise<void> {
  const row = member as Employee
  try {
    const result = await ElMessageBox.prompt(`办理 ${row.name} 的离职。历史归属保留，员工将立即失去企业访问权限。`, '办理离职', {
      inputPlaceholder: '填写离职原因',
      inputValidator: (value) => Boolean(value?.trim()) || '请填写离职原因'
    })
    const reason = String(result.value || '').trim()
    try {
      await identityApi.resignMember(row.empId, reason, false)
      ElMessage.success('员工已离职')
    } catch (firstError) {
      await ElMessageBox.confirm('该员工仍有未交接责任。确认强制离职并保留历史归属？', '存在未交接责任', { type: 'warning' })
      await identityApi.resignMember(row.empId, `${reason}（确认强制离职）`, true)
      ElMessage.success('员工已强制离职')
    }
    await Promise.all([loadMembers(), load()])
  } catch (actionError) {
    if (actionError !== 'cancel' && actionError !== 'close') {
      ElMessage.error(actionError instanceof ProviderError ? actionError.message : '离职失败')
    }
  }
}
function switchMemberStatus(status: string | number | boolean | undefined): void {
  if (status == null || !memberTabs.some(tab => tab.value === status)) return
  const next = status as MemberStatus
  if (memberStatus.value === next) return
  memberStatus.value = next
  void loadMembers()
}
function openInvite(): void {
  inviteForm.value = { inviteName: '', invitePhone: '', role: 'Finance', storeId: '' }
  inviteVisible.value = true
}
async function submitInvite(): Promise<void> {
  if (!inviteForm.value.inviteName.trim()) { ElMessage.warning('请填写被邀请人姓名'); return }
  if (!/^1\d{10}$/.test(inviteForm.value.invitePhone)) { ElMessage.warning('请输入正确手机号'); return }
  if (inviteForm.value.role === 'Finance' && session.role === 'Boss' && !inviteForm.value.storeId) {
    ElMessage.warning('邀请财务必须选择归属门店')
    return
  }
  inviteSaving.value = true
  try {
    await identityApi.createInvite({
      inviteName: inviteForm.value.inviteName.trim(),
      invitePhone: inviteForm.value.invitePhone,
      role: inviteForm.value.role,
      storeId: inviteForm.value.role === 'Finance' ? inviteForm.value.storeId || undefined : undefined
    })
    ElMessage.success('邀请已创建')
    inviteVisible.value = false
    await loadMembers()
  } catch (saveError) {
    ElMessage.error(saveError instanceof ProviderError ? saveError.message : '邀请创建失败')
  } finally {
    inviteSaving.value = false
  }
}
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">ORGANIZATION · 成员与组织</span>
        <h1>成员与组织<span class="scope-chip">{{ scope.activeStoreName }}</span>
        <span
          v-if="report?.storeScope?.scopeType === 'AllStores' && report?.storeScope?.unassignedCount > 0"
          class="scope-chip scope-chip--warn"
        >含未归属门店 {{ report.storeScope.unassignedCount }} 条</span></h1>
        <p>维护员工岗位、门店和状态，并查看本范围的人均产出、角色产能和人员排行。</p>
      </div>
      <div class="finance-actions"><el-button @click="load">刷新</el-button></div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default><el-button size="small" plain @click="load">重新加载</el-button></template>
    </el-alert>

    <SkeletonBlock v-if="loading && !report" variant="card" :rows="4" />

    <PanelCard v-if="canManageMembers" title="成员与组织" description="BOSS 可管理全企业员工；店长只能管理本店非负责人、非店长员工。岗位与门店调整不回溯历史业务归属。">
      <template #extra><el-button type="primary" @click="openInvite">邀请员工</el-button></template>
      <div class="member-toolbar">
        <el-radio-group :model-value="memberStatus" size="small" @change="switchMemberStatus">
          <el-radio-button v-for="tab in memberTabs" :key="tab.value" :value="tab.value">{{ tab.label }}</el-radio-button>
        </el-radio-group>
        <span>{{ members.length }} 人</span>
      </div>
      <el-alert v-if="memberError" type="error" :closable="false" :title="memberError" show-icon>
        <template #default><el-button size="small" plain @click="loadMembers">重新加载</el-button></template>
      </el-alert>
      <el-table v-loading="memberLoading" :data="members" stripe empty-text="暂无可确认成员">
        <el-table-column prop="name" label="姓名" min-width="120" />
        <el-table-column label="岗位" width="110"><template #default="{ row }">{{ memberRoleName(row) }}</template></el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">{{ memberStatusName(row) }}</template>
        </el-table-column>
        <el-table-column label="所属门店" min-width="150">
          <template #default="{ row }">{{ row.store?.name || '未分配门店' }}</template>
        </el-table-column>
        <el-table-column prop="telNo" label="手机号" min-width="130" />
        <el-table-column label="范围身份" width="120">
          <template #default="{ row }">{{ isFinance(row) ? (row.store?.defaultStore ? '总部财务' : '门店财务') : memberRoleName(row) }}</template>
        </el-table-column>
        <el-table-column label="操作" min-width="250" fixed="right">
          <template #default="{ row }">
            <div class="member-actions">
              <el-button v-if="canEditRow(row)" size="small" plain @click="openEdit(row)">调整</el-button>
              <el-button v-if="canManageRow(row) && memberStatusValue(row) === 'Active'" size="small" plain type="warning" @click="suspendMember(row)">停用</el-button>
              <el-button v-if="canManageRow(row) && memberStatusValue(row) === 'Suspended'" size="small" plain type="success" @click="resumeMember(row)">恢复</el-button>
              <el-button v-if="canManageRow(row) && memberStatusValue(row) !== 'Resigned'" size="small" plain type="danger" @click="resignMember(row)">离职</el-button>
              <span v-if="memberStatusValue(row) === 'Resigned'" class="member-readonly">仅可查看</span>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </PanelCard>

    <template v-if="report">
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

    <el-dialog v-model="editVisible" title="调整成员" width="480px">
      <el-form label-position="top" @submit.prevent>
        <el-form-item label="员工"><el-input :model-value="editMember?.name" disabled /></el-form-item>
        <el-form-item label="岗位">
          <el-select v-model="editForm.role" style="width: 100%">
            <el-option v-for="role in manageRoles" :key="role" :label="roleLabel(role)" :value="role" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="session.role === 'Boss'" label="门店">
          <el-select v-model="editForm.storeId" style="width: 100%" placeholder="请选择门店">
            <el-option v-for="store in scope.stores" :key="store.id" :label="store.name" :value="store.id" />
          </el-select>
        </el-form-item>
        <el-alert type="info" :closable="false" show-icon title="调整只影响后续组织归属，历史客户、合同、项目和财务单据门店不回溯。" />
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSaving" @click="submitEdit">保存调整</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="inviteVisible" title="邀请员工" width="480px">
      <el-form label-position="top" @submit.prevent>
        <el-form-item label="姓名"><el-input v-model="inviteForm.inviteName" maxlength="15" /></el-form-item>
        <el-form-item label="手机号"><el-input v-model="inviteForm.invitePhone" maxlength="11" /></el-form-item>
        <el-form-item label="岗位">
          <el-select v-model="inviteForm.role" style="width: 100%">
            <el-option v-for="role in inviteRoles" :key="role" :label="roleLabel(role)" :value="role" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="inviteForm.role === 'Finance'" label="目标门店" required>
          <el-select
            v-model="inviteForm.storeId"
            style="width: 100%"
            :disabled="session.role !== 'Boss'"
            :placeholder="session.role === 'Boss' ? '必须选择目标门店' : session.store?.name || '本店'"
          >
            <el-option v-for="store in scope.stores" :key="store.id" :label="store.name" :value="store.id" />
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
.member-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.member-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.member-readonly { color: var(--el-text-color-secondary); font-size: 12px; }
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
</style>
