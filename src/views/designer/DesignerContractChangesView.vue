<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import MoneyText from '@/components/MoneyText.vue'
import { projectApi } from '@/domains/project/api'
import type { ProjectBrief } from '@/domains/project/model'
import { contractApi } from '@/domains/contract/api'
import type { Contract, ContractChange, ContractChangeStatus, ContractChangeType } from '@/domains/contract/model'
import { fileApi } from '@/domains/file/api'
import type { UploadedFile } from '@/domains/file/model'
import { formatDateTime } from '@/core/format'
import type { StatusTone } from '@/core/tone'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => String(route.params.projectId ?? ''))

const STATUS_META: Record<ContractChangeStatus, { label: string; tone: StatusTone }> = {
  pending: { label: '待审批', tone: 'pending' },
  approved: { label: '待客户签认', tone: 'progress' },
  customerConfirmed: { label: '客户已确认', tone: 'done' },
  rejected: { label: '已驳回', tone: 'blocked' },
  cancelled: { label: '已取消', tone: 'closed' }
}

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: '合同草稿',
  pendingSign: '待签署',
  signed: '已签署',
  effective: '已生效',
  changing: '变更中',
  active: '履约中',
  changed: '已变更',
  completed: '已完工',
  closed: '已关闭',
  settled: '已结算',
  terminated: '已终止',
  void: '已作废'
}

const TYPE_LABELS: Record<ContractChangeType, string> = {
  add: '新增',
  remove: '减少',
  replace: '替换',
  quantity: '工程量调整',
  price: '价格调整'
}

type FilterKey = 'all' | ContractChangeStatus
const activeFilter = ref<FilterKey>('all')
const project = ref<ProjectBrief | null>(null)
const contract = ref<Contract | null>(null)
const changes = ref<ContractChange[]>([])
const selectedId = ref('')
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const actionError = ref('')
const uploading = ref(false)

const createVisible = ref(false)
const confirmVisible = ref(false)
const createForm = reactive<{ type: ContractChangeType; amount: number; reason: string }>({ type: 'add', amount: 0, reason: '' })
const createEvidence = ref<UploadedFile[]>([])
const createEvidenceInput = ref<HTMLInputElement | null>(null)
const confirmSignature = ref<UploadedFile | null>(null)
const confirmEvidence = ref<UploadedFile[]>([])
const signatureInput = ref<HTMLInputElement | null>(null)
const confirmEvidenceInput = ref<HTMLInputElement | null>(null)

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待审批' },
  { key: 'approved', label: '待客户签认' },
  { key: 'customerConfirmed', label: '客户已确认' },
  { key: 'rejected', label: '已驳回' }
]

const selectedChange = computed(() => changes.value.find((change) => change.id === selectedId.value) ?? changes.value[0] ?? null)
const filteredChanges = computed(() => changes.value.filter((change) => activeFilter.value === 'all' || change.status === activeFilter.value))
const canConfirm = computed(() => selectedChange.value?.status === 'approved' && !selectedChange.value.customerConfirmed)

function selectChange(change: ContractChange): void {
  selectedId.value = change.id
}

function openCreate(): void {
  createForm.type = 'add'
  createForm.amount = 0
  createForm.reason = ''
  createEvidence.value = []
  createVisible.value = true
}

function openConfirm(): void {
  confirmSignature.value = null
  confirmEvidence.value = []
  confirmVisible.value = true
}

async function uploadFiles(event: Event, target: 'createEvidence' | 'confirmEvidence' | 'signature'): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (!files.length) return
  uploading.value = true
  actionError.value = ''
  try {
    for (const file of files) {
      const uploaded = await fileApi.uploadFile('ContractChange', file)
      if (target === 'createEvidence') createEvidence.value.push(uploaded)
      if (target === 'confirmEvidence') confirmEvidence.value.push(uploaded)
      if (target === 'signature') confirmSignature.value = uploaded
    }
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '文件上传失败'
  } finally {
    uploading.value = false
    input.value = ''
  }
}

function removeCreateEvidence(path: string): void {
  createEvidence.value = createEvidence.value.filter((file) => file.path !== path)
}

function removeConfirmEvidence(path: string): void {
  confirmEvidence.value = confirmEvidence.value.filter((file) => file.path !== path)
}

async function load(): Promise<void> {
  if (!projectId.value) {
    error.value = '缺少项目编号'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const [projectResult, contractResult, changeResult] = await Promise.all([
      projectApi.projectInfo(projectId.value),
      contractApi.contractByProject(projectId.value),
      contractApi.listContractChanges(projectId.value)
    ])
    project.value = projectResult
    contract.value = contractResult
    changes.value = changeResult
    if (!selectedId.value && changes.value.length) selectedId.value = changes.value[0].id
  } catch (err) {
    error.value = err instanceof Error ? err.message : '增减项工作区暂不可确认'
  } finally {
    loading.value = false
  }
}

async function createChange(): Promise<void> {
  if (!contract.value || !createForm.reason.trim() || createForm.amount === 0) {
    actionError.value = '请填写变更原因和不为 0 的金额'
    return
  }
  saving.value = true
  actionError.value = ''
  try {
    await contractApi.saveContractChange({
      contractId: contract.value.id,
      reason: createForm.reason.trim(),
      type: createForm.type,
      amount: createForm.amount,
      evidenceImages: createEvidence.value.map((file) => file.path)
    })
    createVisible.value = false
    await load()
    ElMessage.success('增减项已发起，等待内部审批')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '增减项发起失败'
  } finally {
    saving.value = false
  }
}

async function registerCustomerConfirmation(): Promise<void> {
  const change = selectedChange.value
  if (!change || !canConfirm.value) return
  saving.value = true
  actionError.value = ''
  try {
    await contractApi.customerConfirmContractChange(change.id, {
      signatureUrl: confirmSignature.value?.path,
      evidenceImages: confirmEvidence.value.map((file) => file.path)
    })
    confirmVisible.value = false
    await load()
    ElMessage.success('客户签认已登记')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '客户签认登记失败'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="cw">
    <header class="cw__head">
      <div>
        <el-button link @click="router.push('/designer/projects')">← 返回项目工地</el-button>
        <p class="cw__eyebrow">CONTRACT CHANGE</p>
        <h2>增减项工作区</h2>
        <p v-if="project">{{ project.name }} · {{ project.customerName || '客户待补充' }} · {{ project.propertyName || project.community || '房屋待补充' }}</p>
        <p>设计师可以发起增减项、查看审批和客户签认事实；审批由 Boss / 财务完成，客户签认按现场签认登记，不允许伪造客户自助确认。</p>
      </div>
      <el-button type="primary" :disabled="!contract" @click="openCreate">发起增减项</el-button>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <el-alert v-if="actionError" type="warning" :closable="false" :title="actionError" show-icon />

    <div class="cw__layout">
      <aside class="cw__queue">
        <div class="cw__panel-head"><strong>增减项队列</strong><span>{{ filteredChanges.length }} 条</span></div>
        <div class="cw__filters">
          <button v-for="filter in filters" :key="filter.key" type="button" :class="{ active: activeFilter === filter.key }" @click="activeFilter = filter.key">{{ filter.label }}</button>
        </div>
        <div v-if="loading && !changes.length" class="cw__loading"><el-skeleton :rows="6" animated /></div>
        <EmptyState v-else-if="!filteredChanges.length" title="当前筛选下没有增减项" description="施工过程中形成的合同增减项会出现在这里。" />
        <button v-for="change in filteredChanges" v-else :key="change.id" type="button" class="cw__item" :class="{ active: change.id === selectedChange?.id }" @click="selectChange(change)">
          <span class="cw__item-top"><strong>{{ change.no || '增减项' }}</strong><StatusTag :tone="STATUS_META[change.status].tone" :text="STATUS_META[change.status].label" /></span>
          <span>{{ change.reason || '原因待补充' }}</span>
          <span class="cw__item-foot"><MoneyText :value="change.amount" delta /><small>{{ TYPE_LABELS[change.type] }}</small></span>
        </button>
      </aside>

      <main class="cw__main">
        <template v-if="selectedChange">
          <section class="cw__identity">
            <div>
              <p class="cw__eyebrow">CHANGE OBJECT</p>
              <h3>{{ selectedChange.no || '增减项' }}</h3>
              <p>{{ TYPE_LABELS[selectedChange.type] }} · {{ selectedChange.reason || '原因待补充' }}</p>
            </div>
            <div class="cw__amount"><span>金额变化</span><MoneyText :value="selectedChange.amount" delta size="lg" /></div>
          </section>

          <section class="cw__facts">
            <div><span>状态</span><StatusTag :tone="STATUS_META[selectedChange.status].tone" :text="STATUS_META[selectedChange.status].label" /></div>
            <div><span>发起人</span><b>{{ selectedChange.requestedByName || '当前设计师' }}</b></div>
            <div><span>审批人</span><b>{{ selectedChange.approvedByName || '待审批' }}</b></div>
            <div><span>审批时间</span><b>{{ formatDateTime(selectedChange.approvedAt) }}</b></div>
            <div><span>客户签认</span><b>{{ selectedChange.customerConfirmed ? formatDateTime(selectedChange.customerConfirmedAt) : '待现场签认' }}</b></div>
            <div><span>合同当前金额</span><MoneyText :value="contract?.currentAmount" /></div>
          </section>

          <section class="cw__detail">
            <div class="cw__section-head"><div><h4>审批结论</h4><p>设计师只读审批意见，不能代替 Boss / 财务审批。</p></div></div>
            <p>{{ selectedChange.conclusion || '暂无审批意见' }}</p>
          </section>

          <section class="cw__detail">
            <div class="cw__section-head"><div><h4>签认证据</h4><p>客户不登录小程序；合同变更按现场签认 + 照片证据登记。</p></div></div>
            <div v-if="selectedChange.signatureUrl || selectedChange.evidenceImages.length" class="cw__evidence">
              <a v-if="selectedChange.signatureUrl" :href="selectedChange.signatureUrl" target="_blank" rel="noopener">查看客户签认</a>
              <a v-for="url in selectedChange.evidenceImages" :key="url" :href="url" target="_blank" rel="noopener">查看签认照片</a>
            </div>
            <EmptyState v-else title="暂无签认证据" description="审批通过后，由授权内部角色现场取得客户签认并上传证据。" />
          </section>
        </template>
        <EmptyState v-else title="请选择一条增减项" description="增减项只展示当前项目合同下的变更事实。" />
      </main>

      <aside class="cw__context">
        <section class="cw__panel">
          <div class="cw__panel-head"><strong>合同事实</strong></div>
          <dl v-if="contract" class="cw__contract">
            <div><dt>合同编号</dt><dd>{{ contract.no }}</dd></div>
            <div><dt>合同状态</dt><dd>{{ CONTRACT_STATUS_LABELS[contract.status] || contract.status }}</dd></div>
            <div><dt>当前金额</dt><dd><MoneyText :value="contract.currentAmount" /></dd></div>
            <div><dt>签署时间</dt><dd>{{ formatDateTime(contract.signedAt) }}</dd></div>
          </dl>
          <EmptyState v-else title="合同暂不可确认" description="合同生效并建立项目后才可发起合同增减项。" />
        </section>
        <section class="cw__panel">
          <div class="cw__panel-head"><strong>当前动作</strong></div>
          <el-button v-if="canConfirm" type="primary" @click="openConfirm">登记客户签认</el-button>
          <el-button v-else disabled>等待审批 / 签认</el-button>
          <p>客户签认必须保留签名和照片证据；无证据不得登记为客户已确认。</p>
        </section>
        <section class="cw__panel">
          <div class="cw__panel-head"><strong>责任边界</strong></div>
          <ul>
            <li>设计师可发起增减项，不可审批</li>
            <li>审批由 Boss / 财务完成</li>
            <li>合同变更审批通过后，客户现场签认并留证</li>
            <li>签认后由服务端统一重算任务、材料、应收、成本和利润</li>
            <li>不展示成本变化明细，避免越权</li>
          </ul>
        </section>
      </aside>
    </div>

    <el-dialog v-model="createVisible" title="发起增减项" width="640px" append-to-body>
      <el-form label-width="96px">
        <el-form-item label="变更类型"><el-select v-model="createForm.type" style="width: 100%"><el-option v-for="(label, value) in TYPE_LABELS" :key="value" :label="label" :value="value" /></el-select></el-form-item>
        <el-form-item label="金额变化"><el-input-number v-model="createForm.amount" :precision="2" :step="100" style="width: 100%" /></el-form-item>
        <el-form-item label="变更原因"><el-input v-model="createForm.reason" type="textarea" :rows="4" maxlength="500" show-word-limit /></el-form-item>
        <el-form-item label="现场证据">
          <div class="cw__upload">
            <el-button size="small" :loading="uploading" @click="createEvidenceInput?.click()">上传证据</el-button>
            <input ref="createEvidenceInput" type="file" accept="image/*,.pdf" multiple hidden @change="uploadFiles($event, 'createEvidence')" />
            <div v-if="createEvidence.length" class="cw__upload-list">
              <span v-for="file in createEvidence" :key="file.path"><a :href="file.url" target="_blank" rel="noopener">{{ file.name || '证据' }}</a><button type="button" @click="removeCreateEvidence(file.path)">移除</button></span>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="createVisible = false">取消</el-button><el-button type="primary" :loading="saving" :disabled="!createForm.reason.trim() || createForm.amount === 0" @click="createChange">提交审批</el-button></template>
    </el-dialog>

    <el-dialog v-model="confirmVisible" title="登记客户现场签认" width="640px" append-to-body>
      <el-alert type="warning" :closable="false" title="客户不登录小程序；必须上传客户签名和现场照片，无证据不得登记为已确认。" show-icon />
      <el-form label-width="96px">
        <el-form-item label="客户签名">
          <div class="cw__upload">
            <el-button size="small" :loading="uploading" @click="signatureInput?.click()">上传签名</el-button>
            <input ref="signatureInput" type="file" accept="image/*" hidden @change="uploadFiles($event, 'signature')" />
            <a v-if="confirmSignature" :href="confirmSignature.url" target="_blank" rel="noopener">{{ confirmSignature.name || '客户签名' }}</a>
          </div>
        </el-form-item>
        <el-form-item label="现场照片">
          <div class="cw__upload">
            <el-button size="small" :loading="uploading" @click="confirmEvidenceInput?.click()">上传照片</el-button>
            <input ref="confirmEvidenceInput" type="file" accept="image/*" multiple hidden @change="uploadFiles($event, 'confirmEvidence')" />
            <div v-if="confirmEvidence.length" class="cw__upload-list">
              <span v-for="file in confirmEvidence" :key="file.path"><a :href="file.url" target="_blank" rel="noopener">{{ file.name || '现场照片' }}</a><button type="button" @click="removeConfirmEvidence(file.path)">移除</button></span>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="confirmVisible = false">取消</el-button><el-button type="primary" :loading="saving" :disabled="!confirmSignature" @click="registerCustomerConfirmation">确认登记</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.cw {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: $space-5;
}

.cw__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;

  h2 { margin: $space-1 0; font-size: $font-display; }
  p { margin: 0; max-width: 840px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
}

.cw__eyebrow {
  color: $brand-600 !important;
  font-size: $font-caption !important;
  font-weight: $font-weight-semibold;
  letter-spacing: .1em;
}

.cw__layout {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr) 320px;
  gap: $space-4;
  align-items: start;
}

.cw__queue,
.cw__main,
.cw__context {
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  box-shadow: $shadow-card;
  overflow: hidden;
}

.cw__queue,
.cw__context { position: sticky; top: $space-4; max-height: calc(100vh - #{$topbar-height} - #{$space-8}); overflow: auto; }

.cw__panel-head,
.cw__section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-3;
  padding: $space-4;
  border-bottom: 1px solid $border-color;

  h4 { margin: 0 0 $space-1; font-size: $font-title; }
  p { margin: 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
}

.cw__panel-head span { color: $text-tertiary; font-size: $font-caption; }

.cw__filters { display: flex; flex-wrap: wrap; gap: $space-1; padding: $space-3 $space-4; border-bottom: 1px solid $border-color; }
.cw__filters button { padding: 4px 8px; border: 1px solid $border-color; border-radius: $radius-pill; background: $surface-0; color: $text-secondary; font-size: $font-caption; cursor: pointer; }
.cw__filters button.active { border-color: $brand-300; background: $brand-50; color: $brand-700; font-weight: $font-weight-semibold; }

.cw__item {
  width: 100%;
  padding: $space-3 $space-4;
  border: 0;
  border-bottom: 1px solid $border-color;
  background: transparent;
  text-align: left;
  cursor: pointer;

  &:hover,
  &.active { background: $brand-50; }
  > span { display: block; margin-top: $space-1; color: $text-secondary; font-size: $font-caption; }
}

.cw__item-top,
.cw__item-foot { display: flex !important; align-items: center; justify-content: space-between; gap: $space-2; }
.cw__item-top strong { color: $text-primary; font-size: $font-body-sm; }
.cw__item-foot small { color: $brand-700; }

.cw__identity {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;
  padding: $space-5;
  border-bottom: 1px solid $border-color;
  background: linear-gradient(135deg, $brand-50 0%, $surface-0 72%);

  h3 { margin: $space-1 0; font-size: $font-h1; }
  p { margin: 0; color: $text-secondary; font-size: $font-body-sm; }
}

.cw__amount { text-align: right; span { display: block; color: $text-secondary; font-size: $font-caption; } }

.cw__facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $space-3;
  padding: $space-4;
  border-bottom: 1px solid $border-color;

  div { padding: $space-3; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-50; }
  span { display: block; color: $text-secondary; font-size: $font-caption; }
  b { display: block; margin-top: 3px; font-size: $font-body-sm; }
}

.cw__detail { padding: $space-4; border-bottom: 1px solid $border-color; }
.cw__detail > p { margin: 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }

.cw__evidence { display: flex; flex-wrap: wrap; gap: $space-2; }
.cw__evidence a { color: $brand-700; font-size: $font-caption; text-decoration: underline; }

.cw__contract { margin: 0; padding: $space-4; }
.cw__contract div { display: flex; justify-content: space-between; gap: $space-3; padding: $space-2 0; border-bottom: 1px solid $border-color; }
.cw__contract dt { color: $text-secondary; font-size: $font-caption; }
.cw__contract dd { margin: 0; font-size: $font-body-sm; text-align: right; }

.cw__panel { padding: $space-4; border-bottom: 1px solid $border-color; }
.cw__panel ul { margin: 0; padding: 0; list-style: none; }
.cw__panel li { padding: $space-2 0; border-bottom: 1px solid $border-color; color: $text-secondary; font-size: $font-body-sm; line-height: 1.6; }
.cw__panel p { margin: $space-3 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.cw__panel .el-button { width: 100%; }

.cw__upload { display: flex; flex-direction: column; gap: $space-2; width: 100%; }
.cw__upload-list { display: flex; flex-direction: column; gap: $space-1; }
.cw__upload-list span { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.cw__upload-list a { color: $brand-700; font-size: $font-caption; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cw__upload-list button { border: 0; background: transparent; color: $danger-500; font-size: $font-caption; cursor: pointer; }
.cw__upload > a { color: $brand-700; font-size: $font-caption; text-decoration: underline; }

.cw__loading { padding: $space-5; }

@media (max-width: 1280px) {
  .cw__layout { grid-template-columns: 280px minmax(0, 1fr); }
  .cw__context { grid-column: 1 / -1; position: static; max-height: none; }
}

@media (max-width: 1024px) {
  .cw__head { flex-direction: column; }
  .cw__layout { grid-template-columns: 1fr; }
  .cw__queue { position: static; max-height: none; }
  .cw__facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
