<script setup lang="ts">
import { computed } from 'vue'
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import WorkbenchState from '@/components/workbench/WorkbenchState.vue'
import DesignerProjectMediaGrid from './DesignerProjectMediaGrid.vue'
import { formatDateTime } from '@/core/format'
import type { AcceptanceBrief, SiteReport } from '@/domains/project/model'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

const props = withDefaults(defineProps<{
  reports: SiteReport[]
  acceptances: AcceptanceBrief[]
  selectedStageId?: string
  selectedStageName?: string
  reportState?: LoadState
  acceptanceState?: LoadState
}>(), {
  selectedStageId: '',
  selectedStageName: '',
  reportState: 'idle',
  acceptanceState: 'idle'
})

const emit = defineEmits<{ retry: [] }>()

const sortedReports = computed(() => [...props.reports]
  .sort((left, right) => String(right.reportAt ?? '').localeCompare(String(left.reportAt ?? ''))))
const stageReports = computed(() => sortedReports.value.filter((report) => report.stageId === props.selectedStageId))
const visibleReports = computed(() => (stageReports.value.length ? stageReports.value : sortedReports.value).slice(0, 2))
const reportScope = computed(() => stageReports.value.length ? '当前阶段' : '最近项目动态')

const stageAcceptances = computed(() => props.acceptances
  .filter((acceptance) => acceptance.stageId === props.selectedStageId)
  .sort((left, right) => String(right.confirmedAt || right.createdAt || '').localeCompare(String(left.confirmedAt || left.createdAt || ''))))
const visibleAcceptance = computed(() => stageAcceptances.value[0] ?? [...props.acceptances]
  .sort((left, right) => String(right.confirmedAt || right.createdAt || '').localeCompare(String(left.confirmedAt || left.createdAt || '')))[0] ?? null)
const acceptanceScope = computed(() => stageAcceptances.value.length
  ? props.selectedStageName || '当前阶段'
  : '最近项目验收')

function authorInitial(name?: string): string {
  return (name || '记').trim().slice(0, 1)
}
</script>

<template>
  <section class="activity" aria-labelledby="project-activity-title">
    <header class="activity__head">
      <div>
        <h3 id="project-activity-title">现场动态与验收记录</h3>
        <p>按发生顺序核对现场留证与阶段验收；设计师只读，不代替项目经理发布或代替业主确认。</p>
      </div>
      <button type="button" @click="emit('retry')">刷新</button>
    </header>

    <div class="activity__stack">
      <section class="activity__section" aria-labelledby="project-report-title">
        <header class="activity__section-head">
          <div class="activity__section-title">
            <span class="activity__section-mark activity__section-mark--report" aria-hidden="true">动</span>
            <div>
              <h4 id="project-report-title">现场动态</h4>
              <p>{{ reportScope }}</p>
            </div>
          </div>
          <span v-if="visibleReports.length" class="activity__count">{{ visibleReports.length }} 条</span>
        </header>

        <WorkbenchState
          v-if="reportState === 'loading'"
          title="现场动态加载中"
          description="正在读取现场记录。"
          min-height="120px"
        />
        <WorkbenchState
          v-else-if="reportState === 'error'"
          variant="error"
          title="现场动态暂不可确认"
          description="现场记录读取失败，不能据此判断现场是否已有留证。"
          action-text="重新加载"
          min-height="120px"
          @action="emit('retry')"
        />
        <WorkbenchState
          v-else-if="!visibleReports.length"
          title="暂无现场动态"
          description="现场动态由项目经理或授权现场人员记录；空列表不代表尚未开工。"
          min-height="120px"
        />
        <div v-else class="activity__reports">
          <article v-for="report in visibleReports" :key="report.id" class="activity__report">
            <span class="activity__report-accent" aria-hidden="true" />
            <header class="activity__report-author">
              <span class="activity__report-avatar">{{ authorInitial(report.authorName) }}</span>
              <div>
                <strong>{{ report.authorName || '记录人待确认' }}</strong>
                <small>{{ formatDateTime(report.reportAt) }}</small>
              </div>
            </header>
            <div class="activity__report-body">
              <h5>{{ report.title || '现场记录' }}</h5>
              <p>{{ report.content || '现场内容待补充' }}</p>
              <DesignerProjectMediaGrid
                :media="report.images || []"
                :unavailable="report.mediaUnavailable"
              />
            </div>
            <footer>
              <span>{{ reportScope }}</span>
              <span>现场记录</span>
            </footer>
          </article>
        </div>
      </section>

      <section class="activity__section" aria-labelledby="project-acceptance-title">
        <header class="activity__section-head">
          <div class="activity__section-title">
            <span class="activity__section-mark activity__section-mark--acceptance" aria-hidden="true">验</span>
            <div>
              <h4 id="project-acceptance-title">验收记录</h4>
              <p>{{ acceptanceScope }}</p>
            </div>
          </div>
          <BusinessStateTag
            v-if="visibleAcceptance"
            object-key="acceptance"
            :server-value="visibleAcceptance.status"
          />
        </header>

        <WorkbenchState
          v-if="acceptanceState === 'loading'"
          title="验收记录加载中"
          description="正在读取阶段验收记录。"
          min-height="120px"
        />
        <WorkbenchState
          v-else-if="acceptanceState === 'error'"
          variant="error"
          title="验收记录暂不可确认"
          description="验收记录读取失败，不能判断当前阶段是否已提交验收。"
          action-text="重新加载"
          min-height="120px"
          @action="emit('retry')"
        />
        <WorkbenchState
          v-else-if="!visibleAcceptance"
          title="暂无验收记录"
          description="验收由项目经理提交、业主本人确认；当前暂无验收记录。"
          min-height="120px"
        />
        <div v-else class="activity__acceptance">
          <div class="activity__acceptance-main">
            <span>验收结论</span>
            <p>{{ visibleAcceptance.content || '验收说明待补充' }}</p>
          </div>
          <dl class="activity__acceptance-meta">
            <div><dt>记录时间</dt><dd>{{ formatDateTime(visibleAcceptance.createdAt) }}</dd></div>
            <div><dt>业主确认</dt><dd>{{ visibleAcceptance.confirmedAt ? formatDateTime(visibleAcceptance.confirmedAt) : '待确认' }}</dd></div>
            <div v-if="visibleAcceptance.issues.length" class="activity__acceptance-issue">
              <dt>问题 / 整改</dt>
              <dd>{{ visibleAcceptance.issues.join('；') }}</dd>
            </div>
          </dl>
          <div v-if="visibleAcceptance.evidenceUrls?.length || visibleAcceptance.mediaUnavailable" class="activity__acceptance-media">
            <span>验收现场影像</span>
            <DesignerProjectMediaGrid
              :media="visibleAcceptance.evidenceUrls || []"
              :unavailable="visibleAcceptance.mediaUnavailable"
            />
          </div>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped lang="scss">
.activity {
  overflow: hidden;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
  box-shadow: $shadow-card;
}

.activity__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
  padding: 12px;
  border-bottom: 1px solid $border-color;
}

.activity__head h3 { margin: 0; color: $text-primary; font-size: $font-title; }
.activity__head p { max-width: 420px; margin: 4px 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.55; }
.activity__head button { flex: 0 0 auto; padding: 7px 10px; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; color: $text-secondary; font: inherit; font-size: $font-caption; cursor: pointer; }
.activity__head button:hover { border-color: $brand-300; background: $brand-50; color: $brand-700; }

.activity__stack { display: flex; flex-direction: column; max-height: 252px; overflow: auto; }
.activity__section { min-width: 0; padding: 12px; }
.activity__section + .activity__section { border-top: 1px solid $border-color; }

.activity__section-head { display: flex; align-items: center; justify-content: space-between; gap: $space-3; margin-bottom: 10px; }
.activity__section-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
.activity__section-title > div { min-width: 0; }
.activity__section-mark { display: grid; place-items: center; width: 28px; height: 28px; flex: 0 0 auto; border-radius: $radius-sm; font-size: $font-caption; font-weight: $font-weight-bold; }
.activity__section-mark--report { color: $brand-700; background: $brand-50; }
.activity__section-mark--acceptance { color: $success-500; background: $success-50; }
.activity__section-head h4 { margin: 0; color: $text-primary; font-size: $font-body; }
.activity__section-head p { margin: 2px 0 0; overflow: hidden; color: $text-tertiary; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; }
.activity__count { color: $text-tertiary; font-size: $font-caption; }

.activity__reports { display: flex; flex-direction: column; gap: 8px; }
.activity__report { position: relative; padding: 10px 10px 10px 14px; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-50; }
.activity__report-accent { position: absolute; left: 0; top: 12px; bottom: 12px; width: 3px; border-radius: 0 $radius-pill $radius-pill 0; background: $brand-500; }
.activity__report-author { display: flex; align-items: center; gap: 8px; }
.activity__report-avatar { display: grid; place-items: center; width: 30px; height: 30px; flex: 0 0 auto; border-radius: 50%; background: $brand-100; color: $brand-700; font-size: $font-caption; font-weight: $font-weight-bold; }
.activity__report-author strong,
.activity__report-author small { display: block; }
.activity__report-author strong { color: $brand-700; font-size: $font-body-sm; }
.activity__report-author small { margin-top: 2px; color: $text-tertiary; font-size: $font-caption; }
.activity__report-body { margin-top: 8px; }
.activity__report-body h5 { margin: 0; color: $text-primary; font-size: $font-body-sm; }
.activity__report-body p { display: -webkit-box; overflow: hidden; margin: 4px 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.activity__report footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; padding-top: 7px; border-top: 1px solid $border-color; color: $text-tertiary; font-size: $font-caption; }

.activity__acceptance { overflow: hidden; border: 1px solid $success-50; border-radius: $radius-md; }
.activity__acceptance-main { padding: 10px 12px; background: linear-gradient(135deg, $success-50, $surface-0 80%); }
.activity__acceptance-main > span { color: $success-500; font-size: $font-caption; font-weight: $font-weight-semibold; }
.activity__acceptance-main p { margin: 4px 0 0; color: $text-primary; font-size: $font-body-sm; line-height: 1.6; }
.activity__acceptance-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 12px; margin: 0; padding: 10px 12px; }
.activity__acceptance-meta div { min-width: 0; }
.activity__acceptance-meta dt { color: $text-tertiary; font-size: $font-caption; }
.activity__acceptance-meta dd { margin: 2px 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.55; }
.activity__acceptance-issue { grid-column: 1 / -1; padding-top: 8px; border-top: 1px solid $border-color; }
.activity__acceptance-issue dd { color: $warning-700; }
.activity__acceptance-media { grid-column: 1 / -1; padding: 10px 12px 0; border-top: 1px solid $border-color; }
.activity__acceptance-media > span { color: $text-tertiary; font-size: $font-caption; }

@media (max-width: 1024px) {
  .activity__head { align-items: flex-start; flex-direction: column; }
  .activity__stack { max-height: none; }
}
</style>
