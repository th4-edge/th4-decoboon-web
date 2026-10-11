<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import StatusTag from '@/components/StatusTag.vue'
import FileUploadField from '@/components/form/FileUploadField.vue'
import EmptyState from '@/components/EmptyState.vue'
import { projectApi } from '@/domains/project/api'
import type { ProjectBrief, ProjectStage, ProjectTask, StageStatus } from '@/domains/project/model'
import { acceptanceApi } from '@/domains/acceptance/api'
import type { Acceptance, AcceptanceRound, AcceptanceStatus } from '@/domains/acceptance/model'
import type { UploadedFile } from '@/domains/file/model'
import { formatDateTime } from '@/core/format'
import type { StatusTone } from '@/core/tone'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const backPath = computed(() => session.role === 'Pm' ? '/pm/workbench' : '/designer/projects')
/** 提交人按角色渲染：本工作区同时服务 Pm 与项目参与设计师（XA-20261011-018 修复：原本文案固定写「设计师」）。 */
const backLabel = computed(() => session.role === 'Pm' ? '← 返回项目推进' : '← 返回项目工地')
const submitterLabel = computed(() => session.role === 'Pm' ? '项目经理' : '项目参与设计师')
const projectId = computed(() => String(route.params.projectId ?? ''))
const requestedStageId = computed(() => String(route.query.stageId ?? ''))

const ACCEPTANCE_STATUS_META: Record<AcceptanceStatus, { label: string; tone: StatusTone }> = {
  pending: { label: '待业主确认', tone: 'pending' },
  confirmed: { label: '业主已确认', tone: 'done' },
  rejected: { label: '业主驳回', tone: 'blocked' }
}

const STAGE_STATUS_META: Record<StageStatus, { label: string; tone: StatusTone }> = {
  todo: { label: '待开始', tone: 'todo' },
  doing: { label: '进行中', tone: 'doing' },
  accepting: { label: '待验收', tone: 'pending' },
  done: { label: '已完成', tone: 'done' },
  cancelled: { label: '已取消', tone: 'closed' },
  notApplicable: { label: '本项不涉及', tone: 'closed' }
}

const project = ref<ProjectBrief | null>(null)
const stages = ref<ProjectStage[]>([])
const tasks = ref<ProjectTask[]>([])
const acceptances = ref<Acceptance[]>([])
const selectedStageId = ref('')
const rounds = ref<AcceptanceRound[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const actionError = ref('')
const submitVisible = ref(false)
const evidenceFiles = ref<UploadedFile[]>([])
const rectificationFiles = ref<UploadedFile[]>([])

const submitForm = reactive({ content: '', issuesText: '', rectificationNote: '' })

const selectedStage = computed(() => stages.value.find((stage) => stage.id === selectedStageId.value) ?? stages.value[0] ?? null)
const selectedAcceptance = computed(() => selectedStage.value ? acceptances.value.find((item) => item.stageId === selectedStage.value?.id) ?? null : null)
const selectedStageTasks = computed(() => selectedStage.value ? tasks.value.filter((task) => task.stageId === selectedStage.value?.id) : [])
const unfinishedTaskCount = computed(() => selectedStageTasks.value.filter((task) => task.status !== 'Done').length)
const submitBlockReason = computed(() => {
  if (!selectedStage.value) return '请先选择施工阶段。'
  if (selectedAcceptance.value?.status === 'pending') return '该阶段已有待业主确认的验收单，不能重复提交。'
  if (selectedAcceptance.value?.status === 'confirmed') return '该阶段验收已通过，不能再次提交。'
  if (selectedStageTasks.value.length === 0) return '该阶段尚无施工任务，不能提交验收。请先由项目经理建立并完成施工任务。'
  if (unfinishedTaskCount.value > 0) return `该阶段仍有 ${unfinishedTaskCount.value} 项施工任务未完成，不能提交验收。`
  return ''
})
const canSubmit = computed(() => {
  if (!selectedStage.value) return false
  if (selectedAcceptance.value && selectedAcceptance.value.status !== 'rejected') return false
  return submitBlockReason.value === ''
})
const isResubmit = computed(() => selectedAcceptance.value?.status === 'rejected')
const submitIssueCount = computed(() => submitForm.issuesText.split('\n').map((item) => item.trim()).filter(Boolean).length)
const submitEvidenceCount = computed(() => evidenceFiles.value.length + (isResubmit.value ? rectificationFiles.value.length : 0))
const submitRoundLabel = computed(() => isResubmit.value ? `第 ${rounds.value.length + 1} 轮复验` : '第 1 轮 · 首次提交')
const submitReady = computed(() => Boolean(
  submitForm.content.trim()
  && evidenceFiles.value.length
  && (!isResubmit.value || (submitForm.rectificationNote.trim() && rectificationFiles.value.length))
))

async function load(): Promise<void> {
  if (!projectId.value) {
    error.value = '缺少项目编号'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const [projectResult, stageResult, taskResult, acceptanceResult] = await Promise.all([
      projectApi.projectInfo(projectId.value),
      projectApi.listStages(projectId.value),
      projectApi.listTasks(projectId.value),
      acceptanceApi.listAcceptances(projectId.value)
    ])
    project.value = projectResult
    stages.value = stageResult
    tasks.value = taskResult
    acceptances.value = acceptanceResult
    if (!selectedStageId.value && requestedStageId.value && stages.value.some((stage) => stage.id === requestedStageId.value)) {
      selectedStageId.value = requestedStageId.value
    }
    await loadRounds()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '验收工作区暂不可确认'
  } finally {
    loading.value = false
  }
}

async function loadRounds(): Promise<void> {
  rounds.value = []
  if (!selectedAcceptance.value?.id) return
  try {
    rounds.value = await acceptanceApi.listAcceptanceRounds(selectedAcceptance.value.id)
  } catch {
    rounds.value = []
  }
}

function selectStage(stage: ProjectStage): void {
  selectedStageId.value = stage.id
  void loadRounds()
}

function openSubmit(): void {
  if (!canSubmit.value) {
    actionError.value = submitBlockReason.value || '当前阶段不能提交验收'
    return
  }
  submitForm.content = ''
  submitForm.issuesText = ''
  submitForm.rectificationNote = ''
  evidenceFiles.value = []
  rectificationFiles.value = []
  submitVisible.value = true
}

async function submit(): Promise<void> {
  const stage = selectedStage.value
  if (!stage) {
    actionError.value = '请选择施工阶段'
    return
  }
  if (!canSubmit.value) {
    actionError.value = submitBlockReason.value || '当前阶段不能提交验收'
    return
  }
  if (!submitForm.content.trim()) {
    actionError.value = '请填写验收说明'
    return
  }
  if (!evidenceFiles.value.length) {
    actionError.value = '请上传现场照片或视频'
    return
  }
  if (selectedAcceptance.value?.status === 'rejected' && (!submitForm.rectificationNote.trim() || !rectificationFiles.value.length)) {
    actionError.value = '提交复验必须填写整改说明并上传整改后照片'
    return
  }
  saving.value = true
  actionError.value = ''
  try {
    await acceptanceApi.submitAcceptance({
      stageId: stage.id,
      content: submitForm.content.trim(),
      issues: submitForm.issuesText.split('\n').map((item) => item.trim()).filter(Boolean),
      images: evidenceFiles.value.map((file) => file.path),
      rectificationNote: submitForm.rectificationNote,
      rectificationImages: rectificationFiles.value.map((file) => file.path)
    })
    submitVisible.value = false
    await load()
    ElMessage.success('阶段验收已提交，等待业主本人确认')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '验收提交失败'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="aw">
    <header class="aw__head">
      <div>
        <el-button link @click="router.push(backPath)">{{ backLabel }}</el-button>
        <p class="aw__eyebrow">STAGE ACCEPTANCE</p>
        <h2>阶段验收工作区</h2>
        <p v-if="project">{{ project.name }} · {{ project.customerName || '客户待补充' }} · {{ project.propertyName || project.community || '房屋待补充' }}</p>
        <p>项目经理或具备项目参与资格的设计师可提交阶段验收、上传现场证据和查看整改轮次；确认或驳回必须由业主本人执行，员工不得代录。</p>
      </div>
      <el-button type="primary" :disabled="!canSubmit" @click="openSubmit">提交阶段验收</el-button>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <el-alert v-if="actionError" type="warning" :closable="false" :title="actionError" show-icon />

    <div class="aw__layout">
      <aside class="aw__stages">
        <div class="aw__panel-head"><strong>施工阶段</strong><span>{{ stages.length }} 个</span></div>
        <div v-if="loading && !stages.length" class="aw__loading"><el-skeleton :rows="6" animated /></div>
        <EmptyState v-else-if="!stages.length" title="暂无施工阶段" description="项目阶段生成后可在这里提交验收。" />
        <button v-for="stage in [...stages].sort((a, b) => a.sort - b.sort)" v-else :key="stage.id" type="button" class="aw__stage" :class="{ active: stage.id === selectedStage?.id }" @click="selectStage(stage)">
          <span class="aw__stage-top"><strong>{{ stage.name }}</strong><StatusTag :tone="STAGE_STATUS_META[stage.status].tone" :text="STAGE_STATUS_META[stage.status].label" /></span>
          <span>{{ stage.progress }}% · {{ stage.weight }}% 权重</span>
          <span v-if="acceptances.find((item) => item.stageId === stage.id)" class="aw__stage-acceptance">验收：{{ ACCEPTANCE_STATUS_META[acceptances.find((item) => item.stageId === stage.id)?.status ?? 'pending'].label }}</span>
          <span v-else class="aw__stage-acceptance">尚未提交验收</span>
        </button>
      </aside>

      <main class="aw__main">
        <template v-if="selectedStage">
          <section class="aw__identity">
            <div>
              <p class="aw__eyebrow">CURRENT STAGE</p>
              <h3>{{ selectedStage.name }} <StatusTag :tone="STAGE_STATUS_META[selectedStage.status].tone" :text="STAGE_STATUS_META[selectedStage.status].label" /></h3>
              <p>{{ selectedStage.progress }}% 进度 · 计划 {{ selectedStage.plannedStart?.slice(0, 10) || '—' }} → {{ selectedStage.plannedEnd?.slice(0, 10) || '—' }}</p>
            </div>
            <StatusTag v-if="selectedAcceptance" :tone="ACCEPTANCE_STATUS_META[selectedAcceptance.status].tone" :text="ACCEPTANCE_STATUS_META[selectedAcceptance.status].label" />
          </section>

          <section v-if="selectedAcceptance" class="aw__acceptance">
            <div class="aw__section-head"><div><h4>当前验收单</h4><p>提交后等待业主本人确认或驳回。</p></div><span>{{ formatDateTime(selectedAcceptance.createdAt) }}</span></div>
            <dl class="aw__facts">
              <div><dt>提交人</dt><dd>{{ selectedAcceptance.submitByName || '提交人待确认' }}</dd></div>
              <div><dt>验收结论</dt><dd>{{ selectedAcceptance.content || '验收说明待补充' }}</dd></div>
              <div><dt>业主确认</dt><dd>{{ selectedAcceptance.confirmedByName ? `${selectedAcceptance.confirmedByName} · ${formatDateTime(selectedAcceptance.confirmedAt)}` : '待业主本人确认' }}</dd></div>
              <div><dt>问题清单</dt><dd>{{ selectedAcceptance.issues.length ? selectedAcceptance.issues.join('；') : '无' }}</dd></div>
            </dl>
            <div v-if="selectedAcceptance.images.length" class="aw__evidence">
              <strong>验收证据</strong>
              <div><a v-for="url in selectedAcceptance.images" :key="url" :href="url" target="_blank" rel="noopener">查看现场证据</a></div>
            </div>
          </section>
          <EmptyState
            v-else
            :title="canSubmit ? '当前阶段尚未提交验收' : '暂不能提交验收'"
            :description="canSubmit ? `施工任务完成后，${submitterLabel}可提交验收并上传现场证据。` : submitBlockReason"
            :action-text="canSubmit ? '提交验收' : ''"
            @action="openSubmit"
          />

          <section class="aw__rounds">
            <div class="aw__section-head"><div><h4>验收与整改轮次</h4><p>历史轮次只追加、不覆盖；员工不得代业主确认。</p></div><span>{{ rounds.length }} 轮</span></div>
            <EmptyState v-if="!rounds.length" title="暂无验收轮次" description="首次提交验收后会形成第 1 轮记录。" />
            <div v-else class="aw__round-list">
              <article v-for="round in rounds" :key="round.id">
                <div><strong>第 {{ round.roundNo }} 轮 · {{ round.result }}</strong><span>{{ formatDateTime(round.confirmedAt || round.submittedAt) }}</span></div>
                <p>{{ round.conclusion || '结论待补充' }}</p>
                <small v-if="round.issues.length">问题：{{ round.issues.join('；') }}</small>
                <small v-if="round.rectificationNote">整改：{{ round.rectificationNote }}</small>
              </article>
            </div>
          </section>
        </template>
        <EmptyState v-else title="请选择一个施工阶段" description="验收工作区按当前项目阶段展示验收事实。" />
      </main>

      <aside class="aw__context">
        <section class="aw__panel">
          <div class="aw__panel-head"><strong>验收边界</strong></div>
          <ul>
            <li>项目经理或项目参与设计师可提交验收，不可确认或驳回</li>
            <li>确认或驳回仅业主本人执行</li>
            <li>员工不得代业主确认或代录通过</li>
            <li>阶段驳回后整改、复验，每轮追加留痕</li>
            <li>验收和整改不改变金额、成本、应收、应付和利润</li>
          </ul>
        </section>
        <section class="aw__panel">
          <div class="aw__panel-head"><strong>当前下一步</strong></div>
          <p v-if="selectedAcceptance">{{ selectedAcceptance.status === 'pending' ? '等待业主本人确认或驳回。' : selectedAcceptance.status === 'confirmed' ? '阶段验收已确认，进入下一阶段。' : '按业主驳回问题整改后提交复验。' }}</p>
          <p v-else-if="!canSubmit">{{ submitBlockReason }}</p>
          <p v-else>阶段任务已全部完成，可以提交阶段验收并上传现场证据。</p>
          <el-button v-if="canSubmit" type="primary" @click="openSubmit">{{ selectedAcceptance?.status === 'rejected' ? '提交复验' : '提交阶段验收' }}</el-button>
        </section>
      </aside>
    </div>

    <el-dialog v-model="submitVisible" :title="isResubmit ? '提交复验' : '提交阶段验收'" width="min(980px, 96vw)" append-to-body class="aw__submit-dialog">
      <div class="aw__submit-context">
        <div>
          <span>项目</span>
          <strong>{{ project?.name || '项目待确认' }}</strong>
          <small>{{ project?.no || '项目编号待确认' }}</small>
        </div>
        <div>
          <span>客户与房屋</span>
          <strong>{{ project?.customerName || '客户待补充' }}</strong>
          <small>{{ project?.propertyName || project?.community || project?.address || '房屋待补充' }}</small>
        </div>
        <div>
          <span>验收阶段</span>
          <strong>{{ selectedStage?.name || '阶段待确认' }}</strong>
          <small>{{ selectedStage?.progress ?? 0 }}% · {{ selectedStageTasks.length }} 项任务 · {{ unfinishedTaskCount }} 项未完成</small>
        </div>
      </div>

      <div class="aw__submit-layout">
        <section class="aw__submit-paper">
          <header>
            <span>{{ isResubmit ? '阶段验收整改复验单' : '阶段验收提交单' }}</span>
            <strong>{{ selectedStage?.name }} · {{ submitRoundLabel }}</strong>
          </header>
          <el-form label-position="top">
            <el-form-item label="验收说明" required><el-input v-model="submitForm.content" type="textarea" :rows="4" maxlength="500" show-word-limit /></el-form-item>
            <el-form-item label="问题清单"><el-input v-model="submitForm.issuesText" type="textarea" :rows="3" placeholder="一行一个问题；没有可不填" /></el-form-item>
            <el-form-item label="现场证据" required>
              <FileUploadField
                v-model="evidenceFiles"
                business-type="Acceptance"
                :project-id="projectId"
                label="验收证据"
                hint="照片可点击预览；视频以文件形式打开"
                accept="image/*,video/*"
                :max="12"
                @error="actionError = $event"
              />
            </el-form-item>
            <template v-if="isResubmit">
              <el-form-item label="整改说明" required><el-input v-model="submitForm.rectificationNote" type="textarea" :rows="3" maxlength="500" show-word-limit /></el-form-item>
              <el-form-item label="整改后照片" required>
                <FileUploadField
                  v-model="rectificationFiles"
                  business-type="Acceptance"
                  :project-id="projectId"
                  label="整改后照片"
                  hint="点击缩略图可放大预览"
                  accept="image/*"
                  :max="12"
                  @error="actionError = $event"
                />
              </el-form-item>
            </template>
          </el-form>
        </section>

        <aside class="aw__submit-preview">
          <span>提交结果</span>
          <h4>待业主确认</h4>
          <dl>
            <div><dt>验收轮次</dt><dd>{{ submitRoundLabel }}</dd></div>
            <div><dt>问题清单</dt><dd>{{ submitIssueCount }} 项</dd></div>
            <div><dt>证据材料</dt><dd>{{ submitEvidenceCount }} 份</dd></div>
            <div><dt>提交人</dt><dd>当前登录员工</dd></div>
          </dl>
          <p>员工只提交验收事实。确认或驳回必须由业主本人在授权会话中执行，员工不得代确认、代驳回或代录通过。</p>
          <div class="aw__submit-checklist">
            <span :class="{ 'is-ready': submitForm.content.trim() }">{{ submitForm.content.trim() ? '✓' : '○' }} 验收说明</span>
            <span :class="{ 'is-ready': evidenceFiles.length }">{{ evidenceFiles.length ? '✓' : '○' }} 现场证据</span>
            <span v-if="isResubmit" :class="{ 'is-ready': submitForm.rectificationNote.trim() && rectificationFiles.length }">{{ submitForm.rectificationNote.trim() && rectificationFiles.length ? '✓' : '○' }} 整改复验证据</span>
          </div>
        </aside>
      </div>
      <template #footer><el-button @click="submitVisible = false">取消</el-button><el-button type="primary" :loading="saving" :disabled="!submitReady" @click="submit">提交验收</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.aw {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: $space-5;
}

.aw__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;

  h2 { margin: $space-1 0; font-size: $font-display; }
  p { margin: 0; max-width: 840px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
}

.aw__eyebrow {
  color: $brand-600 !important;
  font-size: $font-caption !important;
  font-weight: $font-weight-semibold;
  letter-spacing: .1em;
}

.aw__layout {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr) 320px;
  gap: $space-4;
  align-items: start;
}

.aw__stages,
.aw__main,
.aw__context {
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  box-shadow: $shadow-card;
  overflow: hidden;
}

.aw__stages,
.aw__context { position: sticky; top: $space-4; max-height: calc(100vh - #{$topbar-height} - #{$space-8}); overflow: auto; }

.aw__panel-head,
.aw__section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-3;
  padding: $space-4;
  border-bottom: 1px solid $border-color;

  h4 { margin: 0 0 $space-1; font-size: $font-title; }
  p { margin: 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
  span { color: $text-tertiary; font-size: $font-caption; }
}

.aw__stage {
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

.aw__stage-top { display: flex !important; align-items: center; justify-content: space-between; gap: $space-2; }
.aw__stage-top strong { color: $text-primary; font-size: $font-body-sm; }
.aw__stage-acceptance { color: $brand-700 !important; }

.aw__identity {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;
  padding: $space-5;
  border-bottom: 1px solid $border-color;
  background: linear-gradient(135deg, $brand-50 0%, $surface-0 72%);

  h3 { display: flex; align-items: center; gap: $space-2; margin: $space-1 0; font-size: $font-h1; }
  p { margin: 0; color: $text-secondary; font-size: $font-body-sm; }
}

.aw__acceptance { padding-bottom: $space-4; border-bottom: 1px solid $border-color; }
.aw__facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-3; margin: 0; padding: $space-4; }
.aw__facts div { padding: $space-3; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-50; }
.aw__facts dt { color: $text-secondary; font-size: $font-caption; }
.aw__facts dd { margin: 3px 0 0; font-size: $font-body-sm; }

.aw__evidence { padding: 0 $space-4 $space-4; }
.aw__evidence strong { display: block; margin-bottom: $space-2; font-size: $font-body-sm; }
.aw__evidence div { display: flex; flex-wrap: wrap; gap: $space-2; }
.aw__evidence a { color: $brand-700; font-size: $font-caption; text-decoration: underline; }

.aw__rounds { padding: 0; }
.aw__round-list { display: flex; flex-direction: column; gap: $space-3; padding: $space-4; }
.aw__round-list article { padding: $space-3; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-50; }
.aw__round-list article > div { display: flex; align-items: center; justify-content: space-between; gap: $space-3; }
.aw__round-list p { margin: $space-2 0; color: $text-secondary; font-size: $font-body-sm; }
.aw__round-list small { display: block; color: $text-secondary; font-size: $font-caption; }

.aw__panel { padding: $space-4; border-bottom: 1px solid $border-color; }
.aw__panel ul { margin: 0; padding: 0; list-style: none; }
.aw__panel li { padding: $space-2 0; border-bottom: 1px solid $border-color; color: $text-secondary; font-size: $font-body-sm; line-height: 1.6; }
.aw__panel p { margin: 0 0 $space-3; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
.aw__panel .el-button { width: 100%; }

.aw__upload { display: flex; flex-direction: column; gap: $space-2; width: 100%; }
.aw__upload-list { display: flex; flex-direction: column; gap: $space-1; }
.aw__upload-list span { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.aw__upload-list a { color: $brand-700; font-size: $font-caption; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aw__upload-list button { border: 0; background: transparent; color: $danger-500; font-size: $font-caption; cursor: pointer; }

.aw__loading { padding: $space-5; }

.aw__submit-context {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $space-3;
  margin-bottom: $space-4;
}

.aw__submit-context > div {
  min-width: 0;
  padding: $space-3 $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: linear-gradient(135deg, $brand-50 0%, $surface-0 78%);
}

.aw__submit-context span,
.aw__submit-context strong,
.aw__submit-context small { display: block; }
.aw__submit-context span { color: $text-tertiary; font-size: $font-caption; }
.aw__submit-context strong { margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: $font-body-sm; }
.aw__submit-context small { margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: $text-secondary; font-size: $font-caption; }

.aw__submit-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: $space-4;
  align-items: stretch;
}

.aw__submit-paper,
.aw__submit-preview {
  padding: $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-md;
}

.aw__submit-paper { background: linear-gradient(150deg, $surface-0 0%, $brand-50 100%); }
.aw__submit-paper > header {
  padding-bottom: $space-4;
  margin-bottom: $space-4;
  border-bottom: 1px solid $border-color;
}
.aw__submit-paper > header span,
.aw__submit-paper > header strong { display: block; }
.aw__submit-paper > header span { color: $text-tertiary; font-size: $font-caption; letter-spacing: .08em; }
.aw__submit-paper > header strong { margin-top: $space-2; font-size: $font-title; }

.aw__submit-preview { background: linear-gradient(160deg, $surface-0 0%, $surface-50 100%); }
.aw__submit-preview > span { color: $text-tertiary; font-size: $font-caption; letter-spacing: .08em; }
.aw__submit-preview h4 { margin: $space-2 0 $space-3; color: $brand-700; font-size: $font-title; }
.aw__submit-preview dl { margin: 0; }
.aw__submit-preview dl > div { display: flex; justify-content: space-between; gap: $space-2; padding: $space-2 0; border-bottom: 1px solid $border-color; }
.aw__submit-preview dt { color: $text-secondary; font-size: $font-caption; }
.aw__submit-preview dd { margin: 0; font-size: $font-caption; text-align: right; }
.aw__submit-preview > p { margin: $space-4 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.7; }
.aw__submit-checklist { display: flex; flex-direction: column; gap: $space-2; padding-top: $space-4; margin-top: $space-4; border-top: 1px solid $border-color; }
.aw__submit-checklist span { color: $text-tertiary; font-size: $font-caption; }
.aw__submit-checklist span.is-ready { color: $success-500; font-weight: $font-weight-semibold; }

@media (max-width: 900px) {
  .aw__submit-context,
  .aw__submit-layout { grid-template-columns: 1fr; }
}

@media (max-width: 1280px) {
  .aw__layout { grid-template-columns: 280px minmax(0, 1fr); }
  .aw__context { grid-column: 1 / -1; position: static; max-height: none; }
}

@media (max-width: 1024px) {
  .aw__head { flex-direction: column; }
  .aw__layout { grid-template-columns: 1fr; }
  .aw__stages { position: static; max-height: none; }
  .aw__facts { grid-template-columns: 1fr; }
}
</style>
