<script setup lang="ts">
import { computed } from 'vue'
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import WorkbenchState from '@/components/workbench/WorkbenchState.vue'
import { formatDateTime } from '@/core/format'
import type { ProjectStage, ProjectTask } from '@/domains/project/model'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

const props = withDefaults(defineProps<{
  stages: ProjectStage[]
  tasks: ProjectTask[]
  selectedStageId: string
  stageState?: LoadState
  taskState?: LoadState
}>(), {
  stageState: 'idle',
  taskState: 'idle'
})

const emit = defineEmits<{
  selectStage: [stageId: string]
  retry: []
}>()

const sortedStages = computed(() => [...props.stages].sort((left, right) => left.sort - right.sort))
const selectedStage = computed(() => sortedStages.value.find((stage) => stage.id === props.selectedStageId) ?? null)
const selectedTasks = computed(() => props.tasks
  .filter((task) => task.stageId === props.selectedStageId)
  .sort((left, right) => String(left.plannedStart ?? '').localeCompare(String(right.plannedStart ?? '')) || left.name.localeCompare(right.name, 'zh-CN')))

const taskSummary = computed(() => {
  const counts = { total: selectedTasks.value.length, doing: 0, accepting: 0, done: 0 }
  for (const task of selectedTasks.value) {
    const status = task.status.toLowerCase()
    if (status === 'doing') counts.doing += 1
    else if (status === 'accepting') counts.accepting += 1
    else if (status === 'done') counts.done += 1
  }
  return counts
})

function dateRange(stage: ProjectStage): string {
  if (!stage.plannedStart && !stage.plannedEnd) return '计划日期待补充'
  return `${dateText(stage.plannedStart)} → ${dateText(stage.plannedEnd)}`
}

function dateText(value?: string): string {
  if (!value) return '待补充'
  const text = formatDateTime(value)
  return text === '暂不可确认' ? text : text.slice(0, 10)
}
</script>

<template>
  <section class="stage-work" aria-labelledby="project-stage-title">
    <header class="stage-work__head">
      <div>
        <h3 id="project-stage-title">施工阶段与当前工作面</h3>
        <p>这里展示项目当前阶段和任务进度；设计师只核对设计落地，不代替项目经理推进开工、完工或验收。</p>
      </div>
      <span v-if="selectedStage">当前查看：{{ selectedStage.name }}</span>
    </header>

    <WorkbenchState
      v-if="stageState === 'loading'"
      title="阶段信息加载中"
      description="正在读取项目阶段，请稍候。"
      min-height="180px"
    />
    <WorkbenchState
      v-else-if="stageState === 'error'"
      variant="error"
      title="阶段信息暂不可确认"
      description="项目阶段读取失败，当前不能判断施工推进位置。"
      action-text="重新加载"
      min-height="180px"
      @action="emit('retry')"
    />
    <WorkbenchState
      v-else-if="!sortedStages.length"
      title="当前项目暂无阶段"
      description="合同生效并完成项目立项后会生成施工阶段；请刷新确认项目是否已进入施工。"
      action-text="刷新"
      min-height="180px"
      @action="emit('retry')"
    />
    <div v-else class="stage-work__track" role="list" aria-label="项目阶段">
      <button
        v-for="stage in sortedStages"
        :key="stage.id"
        type="button"
        class="stage-work__stage"
        :class="{ active: stage.id === selectedStageId, done: stage.status === 'done' }"
        :aria-pressed="stage.id === selectedStageId"
        @click="emit('selectStage', stage.id)"
      >
        <span class="stage-work__stage-top">
          <small>阶段 {{ stage.sort }}</small>
          <BusinessStateTag object-key="projectStage" :server-value="stage.status" />
        </span>
        <strong>{{ stage.name }}</strong>
        <span>{{ stage.progress }}%</span>
        <small>{{ dateRange(stage) }}</small>
      </button>
    </div>

    <div v-if="selectedStage && stageState === 'ready'" class="stage-work__surface">
      <header class="stage-work__surface-head">
        <div>
          <h4>{{ selectedStage.name }} · 任务记录</h4>
          <p>任务由项目经理现场推进；设计师只读核对设计落地情况。</p>
        </div>
        <div class="stage-work__summary">
          <span><b>{{ taskSummary.total }}</b> 项任务</span>
          <span><b>{{ taskSummary.doing }}</b> 进行中</span>
          <span><b>{{ taskSummary.accepting }}</b> 待确认</span>
          <span><b>{{ taskSummary.done }}</b> 已完成</span>
        </div>
      </header>

      <WorkbenchState
        v-if="taskState === 'loading'"
        title="任务记录加载中"
        description="正在读取当前阶段任务。"
        min-height="160px"
      />
      <WorkbenchState
        v-else-if="taskState === 'error'"
        variant="error"
        title="任务记录暂不可确认"
        description="任务读取失败，不能判断当前阶段是否有未完成任务。"
        action-text="重新加载"
        min-height="160px"
        @action="emit('retry')"
      />
      <WorkbenchState
        v-else-if="!selectedTasks.length"
        title="当前阶段暂无任务"
        description="任务可能尚未编排，也可能暂时读取失败，请刷新后查看。"
        action-text="刷新"
        min-height="160px"
        @action="emit('retry')"
      />
      <div v-else class="stage-work__table-wrap">
        <div class="stage-work__table">
          <div class="stage-work__row stage-work__row--head">
            <span>任务</span><span>状态</span><span>进度</span><span>负责人</span><span>计划</span>
          </div>
          <div v-for="task in selectedTasks" :key="task.id" class="stage-work__row">
            <span class="stage-work__task-name">
              <strong>{{ task.name }}</strong>
              <small>{{ task.quantity || '—' }} {{ task.unit || '' }}</small>
            </span>
            <span><BusinessStateTag object-key="projectTask" :server-value="task.status" /></span>
            <span>{{ task.progress }}%</span>
            <span>{{ task.ownerName || '负责人待确认' }}</span>
            <span>{{ dateText(task.plannedStart) }} → {{ dateText(task.plannedEnd) }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.stage-work {
  overflow: hidden;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
  box-shadow: $shadow-card;
}

.stage-work__head,
.stage-work__surface-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;
  padding: 12px $space-3;
  border-bottom: 1px solid $border-color;
}

.stage-work__head h3,
.stage-work__surface-head h4 { margin: 0; color: $text-primary; }
.stage-work__head h3 { font-size: $font-title; }
.stage-work__surface-head h4 { font-size: $font-body; }
.stage-work__head p,
.stage-work__surface-head p { margin: 4px 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.stage-work__head > span { color: $brand-700; font-size: $font-caption; font-weight: $font-weight-semibold; }

.stage-work__track {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(145px, 1fr);
  gap: $space-2;
  padding: 12px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
}

.stage-work__stage {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  min-height: 80px;
  padding: 8px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-50;
  color: $text-secondary;
  text-align: left;
  cursor: pointer;
}

.stage-work__stage:hover { border-color: $brand-300; background: $brand-50; }
.stage-work__stage.active { border-color: $brand-500; background: $brand-50; box-shadow: inset 0 0 0 1px $brand-200; }
.stage-work__stage.done { opacity: .78; }
.stage-work__stage-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.stage-work__stage strong { overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
.stage-work__stage > span:not(.stage-work__stage-top) { color: $brand-700; font-weight: $font-weight-semibold; font-size: $font-body-sm; }
.stage-work__stage small { color: $text-tertiary; font-size: $font-caption; }
.stage-work__stage-top small { flex: 0 0 auto; }

.stage-work__surface { border-top: 1px solid $border-color; }
.stage-work__summary { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px 12px; color: $text-secondary; font-size: $font-caption; }
.stage-work__summary b { color: $text-primary; font-variant-numeric: tabular-nums; }

.stage-work__table-wrap { overflow-x: auto; }
.stage-work__table { min-width: 760px; }
.stage-work__row {
  display: grid;
  grid-template-columns: minmax(240px, 1.7fr) 104px 72px 120px 180px;
  align-items: center;
  gap: $space-2;
  min-height: 48px;
  padding: 0 12px;
  border-bottom: 1px solid $border-color;
  color: $text-secondary;
  font-size: $font-body-sm;
}
.stage-work__row:last-child { border-bottom: 0; }
.stage-work__row--head { min-height: 36px; background: $surface-50; color: $text-tertiary; font-size: $font-caption; font-weight: $font-weight-semibold; }
.stage-work__row > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stage-work__task-name strong,
.stage-work__task-name small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stage-work__task-name strong { color: $text-primary; }
.stage-work__task-name small { margin-top: 2px; color: $text-tertiary; font-size: $font-caption; }

@media (max-width: 1280px) {
  .stage-work__track { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 1024px) {
  .stage-work__head,
  .stage-work__surface-head { flex-direction: column; }
  .stage-work__summary { justify-content: flex-start; }
  .stage-work__track { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 680px) {
  .stage-work__track { grid-template-columns: 1fr; }
}
</style>
