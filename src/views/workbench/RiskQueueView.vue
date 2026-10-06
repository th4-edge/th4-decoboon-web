<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ProviderError } from '@/core/http'
import { riskApi } from '@/domains/risk/api'
import type { RiskCenterReport, RiskItemView, RiskLogView } from '@/domains/risk/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import EmployeePicker from '@/components/picker/EmployeePicker.vue'
import type { StatusTone } from '@/core/tone'

const report = ref<RiskCenterReport | null>(null)
const loading = ref(false)
const error = ref('')
const busy = ref(false)

const selected = ref<RiskItemView | null>(null)
const assignVisible = ref(false)
const recordVisible = ref(false)
const closeVisible = ref(false)
const reopenVisible = ref(false)
const logsVisible = ref(false)

const assigneeId = ref('')
const noteText = ref('')
const closeResult = ref('')
const reopenReason = ref('')
const logs = ref<RiskLogView[]>([])
const logsLoading = ref(false)

const items = computed(() => report.value?.items ?? [])
const typeDistribution = computed(() => (report.value?.typeDistribution ?? []).filter((item) => item.count > 0))

onMounted(() => { void load() })

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    report.value = await riskApi.report()
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '风险队列暂不可确认'
  } finally {
    loading.value = false
  }
}

function levelTone(level: string): StatusTone {
  if (level === 'High') return 'alert'
  if (level === 'Medium') return 'pending'
  return 'info'
}

function urgencyTone(value: unknown): StatusTone {
  const item = value as RiskItemView
  const tone = item.dueTone !== 'normal' ? item.dueTone : item.timeTone
  if (tone === 'danger') return 'alert'
  if (tone === 'warn') return 'pending'
  return 'info'
}

function isOpen(value: unknown): boolean {
  const item = value as RiskItemView
  return item.status !== 'Closed' && item.status !== 'Void'
}

function resetForms(): void {
  assigneeId.value = ''
  noteText.value = ''
  closeResult.value = ''
  reopenReason.value = ''
}

function openAssign(value: unknown): void { selected.value = value as RiskItemView; resetForms(); assignVisible.value = true }
function openRecord(value: unknown): void { selected.value = value as RiskItemView; resetForms(); recordVisible.value = true }
function openClose(value: unknown): void { selected.value = value as RiskItemView; resetForms(); closeVisible.value = true }
function openReopen(value: unknown): void { selected.value = value as RiskItemView; resetForms(); reopenVisible.value = true }

async function openLogs(value: unknown): Promise<void> {
  const item = value as RiskItemView
  if (!item.riskId) return
  selected.value = item
  logs.value = []
  logsVisible.value = true
  logsLoading.value = true
  try {
    logs.value = await riskApi.logs(item.riskId)
  } catch (loadError) {
    ElMessage.error(loadError instanceof ProviderError ? loadError.message : '处置时间线暂不可确认')
  } finally {
    logsLoading.value = false
  }
}

async function run(action: () => Promise<void>, successText: string, onDone: () => void): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    await action()
    ElMessage.success(successText)
    onDone()
    await load()
  } catch (actionError) {
    ElMessage.error(actionError instanceof ProviderError ? actionError.message : '操作失败，暂不可确认')
  } finally {
    busy.value = false
  }
}

function claimRisk(value: unknown): void {
  const item = value as RiskItemView
  if (!item.riskId) return
  void run(() => riskApi.claim(item.riskId as string), '已认领该风险', () => {})
}

function submitAssign(): void {
  const item = selected.value
  if (!item?.riskId) return
  if (!assigneeId.value) { ElMessage.warning('请选择受理人'); return }
  void run(() => riskApi.assign(item.riskId as string, assigneeId.value, noteText.value.trim() || undefined), '已指派受理人', () => { assignVisible.value = false })
}

function submitRecord(): void {
  const item = selected.value
  if (!item?.riskId) return
  if (!noteText.value.trim()) { ElMessage.warning('请填写处置说明'); return }
  void run(() => riskApi.record(item.riskId as string, noteText.value.trim()), '已登记处置记录', () => { recordVisible.value = false })
}

function submitClose(): void {
  const item = selected.value
  if (!item?.riskId) return
  if (!closeResult.value.trim()) { ElMessage.warning('请填写处置结果'); return }
  void run(() => riskApi.close(item.riskId as string, closeResult.value.trim()), '已关闭风险', () => { closeVisible.value = false })
}

function submitReopen(): void {
  const item = selected.value
  if (!item?.riskId) return
  if (!reopenReason.value.trim()) { ElMessage.warning('请填写重开原因'); return }
  void run(() => riskApi.reopen(item.riskId as string, reopenReason.value.trim()), '已重开风险', () => { reopenVisible.value = false })
}
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">RISK CENTER · 风险与待办处置</span>
        <h1>风险队列</h1>
        <p>按当前数据范围汇总逾期、停工、材料超领与变更异常；处置按服务端状态机留痕，完成后回读队列。</p>
      </div>
      <div class="finance-actions">
        <el-button @click="load">刷新队列</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default>
        <el-button size="small" plain @click="load">重新加载</el-button>
      </template>
    </el-alert>

    <section class="finance-kpis">
      <article class="finance-kpi">
        <span>风险总数</span>
        <strong>{{ report?.totalCount ?? 0 }}</strong>
        <small>当前数据范围</small>
      </article>
      <article class="finance-kpi">
        <span>高风险</span>
        <strong>{{ report?.highCount ?? 0 }}</strong>
        <small>优先处置</small>
      </article>
      <article class="finance-kpi">
        <span>中风险</span>
        <strong>{{ report?.mediumCount ?? 0 }}</strong>
        <small>按到期处理</small>
      </article>
      <article class="finance-kpi">
        <span>低风险</span>
        <strong>{{ report?.lowCount ?? 0 }}</strong>
        <small>跟进观察</small>
      </article>
    </section>

    <PanelCard v-if="typeDistribution.length" title="风险类型" description="按类型分栏，跨类统一排序未裁决。">
      <div class="finance-actions" style="justify-content: flex-start">
        <el-tag v-for="type in typeDistribution" :key="type.key" :type="type.highCount ? 'danger' : 'info'" effect="plain">
          {{ type.label }} · {{ type.count }}<template v-if="type.highCount">（高 {{ type.highCount }}）</template>
        </el-tag>
      </div>
    </PanelCard>

    <PanelCard flush>
      <SkeletonBlock v-if="loading && !items.length" variant="table" :rows="6" />
      <EmptyState v-else-if="!loading && !items.length" title="当前没有待处置风险" description="出现逾期、停工、材料超领或变更异常后，这里会形成风险处置单。" />
      <el-table v-else :data="items" stripe>
        <el-table-column label="级别" width="90">
          <template #default="{ row }"><StatusTag :text="row.levelLabel" :tone="levelTone(row.level)" /></template>
        </el-table-column>
        <el-table-column label="风险" min-width="260">
          <template #default="{ row }">
            <div class="finance-table__main">
              <span class="finance-table__title">{{ row.title }}</span>
              <span class="finance-table__sub">{{ row.typeLabel }} · {{ row.message }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="项目 / 客户" min-width="200">
          <template #default="{ row }">
            <div class="finance-table__main">
              <span class="finance-table__title">{{ row.projectName || '—' }}</span>
              <span class="finance-table__sub">{{ row.customerName || '—' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="责任人" width="120">
          <template #default="{ row }">{{ row.disposerName || row.ownerName || '—' }}</template>
        </el-table-column>
        <el-table-column label="涉及金额" width="140" align="right">
          <template #default="{ row }"><MoneyText :value="row.amount" /></template>
        </el-table-column>
        <el-table-column label="时效" width="130">
          <template #default="{ row }"><StatusTag :text="row.dueText || row.timeText" :tone="urgencyTone(row)" /></template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }"><StatusTag :text="row.statusLabel" :tone="isOpen(row) ? 'doing' : 'closed'" /></template>
        </el-table-column>
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <div class="finance-actions">
              <el-button link type="primary" :disabled="!row.riskId" @click.stop="openLogs(row)">时间线</el-button>
              <template v-if="isOpen(row)">
                <el-button link type="primary" :disabled="!row.riskId" @click.stop="claimRisk(row)">认领</el-button>
                <el-button link :disabled="!row.riskId" @click.stop="openAssign(row)">指派</el-button>
                <el-button link :disabled="!row.riskId" @click.stop="openRecord(row)">处置</el-button>
                <el-button link type="success" :disabled="!row.riskId" @click.stop="openClose(row)">关闭</el-button>
              </template>
              <el-button v-else link type="warning" :disabled="!row.riskId" @click.stop="openReopen(row)">重开</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </PanelCard>

    <el-dialog v-model="assignVisible" title="指派受理人" width="460px" destroy-on-close>
      <p class="finance-drawer__hint">{{ selected?.title }}</p>
      <EmployeePicker v-model="assigneeId" placeholder="选择受理人" />
      <el-input v-model="noteText" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="指派说明（选填）" style="margin-top: 12px" />
      <template #footer>
        <el-button @click="assignVisible = false">取消</el-button>
        <el-button type="primary" :loading="busy" @click="submitAssign">确认指派</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="recordVisible" title="写处置记录" width="460px" destroy-on-close>
      <p class="finance-drawer__hint">{{ selected?.title }}</p>
      <el-input v-model="noteText" type="textarea" :rows="4" maxlength="500" show-word-limit placeholder="处置说明" />
      <template #footer>
        <el-button @click="recordVisible = false">取消</el-button>
        <el-button type="primary" :loading="busy" @click="submitRecord">保存记录</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="closeVisible" title="关闭风险" width="460px" destroy-on-close>
      <p class="finance-drawer__hint">关闭必须填写处置结果；关闭后仍可重开。</p>
      <el-input v-model="closeResult" type="textarea" :rows="4" maxlength="500" show-word-limit placeholder="处置结果" />
      <template #footer>
        <el-button @click="closeVisible = false">取消</el-button>
        <el-button type="success" :loading="busy" @click="submitClose">确认关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="reopenVisible" title="重开风险" width="460px" destroy-on-close>
      <p class="finance-drawer__hint">重开必须填写原因，将保留历史处置留痕。</p>
      <el-input v-model="reopenReason" type="textarea" :rows="4" maxlength="500" show-word-limit placeholder="重开原因" />
      <template #footer>
        <el-button @click="reopenVisible = false">取消</el-button>
        <el-button type="warning" :loading="busy" @click="submitReopen">确认重开</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="logsVisible" title="处置时间线" size="480px">
      <SkeletonBlock v-if="logsLoading" variant="table" :rows="4" />
      <EmptyState v-else-if="!logs.length" title="暂无处置记录" description="认领、指派、处置或关闭后，这里会出现留痕。" />
      <el-timeline v-else>
        <el-timeline-item v-for="log in logs" :key="log.logId" :timestamp="log.occurredAt" placement="top">
          <strong>{{ log.actionLabel }}</strong>
          <p class="finance-table__sub">{{ log.operatorName }} · {{ log.fromStatusLabel }} → {{ log.toStatusLabel }}</p>
          <p v-if="log.note">{{ log.note }}</p>
        </el-timeline-item>
      </el-timeline>
    </el-drawer>
  </div>
</template>
