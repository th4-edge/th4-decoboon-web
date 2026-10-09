<script setup lang="ts">
import { computed } from 'vue'
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import MoneyText from '@/components/MoneyText.vue'
import WorkbenchQuickAction from '@/components/workbench/WorkbenchQuickAction.vue'
import NavIcon from '@/components/shell/NavIcon.vue'
import type { ProjectBrief } from '@/domains/project/model'

const props = withDefaults(defineProps<{
  project: ProjectBrief | null
  nextProject?: ProjectBrief | null
}>(), {
  nextProject: null
})

const emit = defineEmits<{
  openMaterials: []
  openChanges: []
  createChanges: []
  openAcceptance: []
  openContract: []
  selectNext: [project: ProjectBrief]
}>()

const nextAction = computed(() => props.project?.businessStateView?.nextAction ?? null)
const blockedReasons = computed(() => {
  const values = [
    ...(nextAction.value?.blockedReasons ?? []),
    ...(props.project?.businessStateView?.blockedReasons ?? [])
  ]
  return [...new Set(values.filter(Boolean))]
})
const nextOwner = computed(() => nextAction.value?.ownerRole || props.project?.businessStateView?.nextOwner || '待业务确认')
const canOpenProjectWorkspaces = computed(() => Boolean(props.project?.id))
const receivableAmount = computed(() => Number(props.project?.receivableAmount ?? 0))
const receivedAmount = computed(() => Number(props.project?.receivedAmount ?? 0))
const outstandingAmount = computed(() => Math.max(receivableAmount.value - receivedAmount.value, 0))
const collectionPercent = computed(() => {
  if (receivableAmount.value <= 0) return 0
  return Math.max(0, Math.min(100, Math.round(receivedAmount.value / receivableAmount.value * 1000) / 10))
})
const collectionText = computed(() => receivableAmount.value <= 0 ? '待生成应收' : `${collectionPercent.value}%`)
</script>

<template>
  <aside class="guide" aria-label="项目状态与下一动作">
    <section class="guide__card guide__reason">
      <p class="guide__eyebrow">为什么现在关注</p>
      <template v-if="project">
        <strong>{{ nextAction?.label || '待业务确认' }}</strong>
        <p>{{ nextAction?.hint || '服务端未返回当前项目下一步，暂不能由前端推断。' }}</p>
        <dl>
          <div><dt>当前主责</dt><dd>{{ nextOwner }}</dd></div>
          <div v-if="nextAction?.toStatus"><dt>完成后状态</dt><dd><BusinessStateTag object-key="project" :server-value="nextAction.toStatus" /></dd></div>
          <div v-if="project.managerName"><dt>项目经理</dt><dd>{{ project.managerName }}</dd></div>
        </dl>
        <div v-if="blockedReasons.length" class="guide__blocked">
          <span>阻断 / 风险</span>
          <p v-for="reason in blockedReasons" :key="reason">{{ reason }}</p>
        </div>
      </template>
      <p v-else>请先从左侧选择项目；未选择项目时不展示或执行任何项目动作。</p>
    </section>

    <section class="guide__card guide__primary">
      <p class="guide__eyebrow">设计师当前主行动</p>
      <strong>打开主材选材</strong>
      <p>进入当前项目的主材选材工作区，按合同范围逐项核对和现场代录；是否可编辑由选材工作区按服务端门禁裁决。</p>
      <button
        type="button"
        class="guide__primary-button"
        :disabled="!canOpenProjectWorkspaces"
        @click="emit('openMaterials')"
      >
        <NavIcon name="pm.materialSelection" />
        打开主材选材
      </button>
    </section>

    <section class="guide__card guide__change">
      <div class="guide__change-main">
        <strong>新增增减项</strong>
        <small>客户确认后形成变更单</small>
      </div>
      <button
        type="button"
        class="guide__change-button"
        :disabled="!canOpenProjectWorkspaces"
        @click="emit('createChanges')"
      >
        <NavIcon name="pm.change" />
        新增
      </button>
      <button
        type="button"
        class="guide__change-link"
        :disabled="!canOpenProjectWorkspaces"
        @click="emit('openChanges')"
      >
        历史
      </button>
    </section>

    <section class="guide__card guide__money">
      <p class="guide__eyebrow">资金进度</p>
      <template v-if="project">
        <dl>
          <div><dt>合同金额</dt><dd><MoneyText :value="project.contractAmount" size="sm" /></dd></div>
          <div><dt>已收款</dt><dd class="guide__money-ok"><MoneyText :value="receivedAmount" size="sm" /></dd></div>
          <div><dt>应收工程款</dt><dd><MoneyText :value="receivableAmount" size="sm" /></dd></div>
          <div><dt>待收工程款</dt><dd><MoneyText :value="outstandingAmount" size="sm" /></dd></div>
        </dl>
        <div class="guide__money-meter" aria-hidden="true"><i :style="{ width: `${collectionPercent}%` }" /></div>
        <small class="guide__money-rate">回款进度 {{ collectionText }}</small>
      </template>
      <p v-else>选择项目后显示应收与已收进度。</p>
    </section>

    <section class="guide__card">
      <header class="guide__section-head">
        <div><strong>其他项目工作区</strong><small>次级入口，不替代当前唯一主行动</small></div>
      </header>
      <div class="guide__actions">
        <WorkbenchQuickAction
          title="处理增减项"
          hint="现场新增、减少与客户确认记录"
          tone="record"
          :disabled="!canOpenProjectWorkspaces"
          @click="emit('openChanges')"
        >
          <template #icon><NavIcon name="pm.change" /></template>
        </WorkbenchQuickAction>
        <WorkbenchQuickAction
          title="查看阶段验收"
          hint="验收提交、驳回与业主确认事实"
          tone="outline"
          :disabled="!canOpenProjectWorkspaces"
          @click="emit('openAcceptance')"
        >
          <template #icon><NavIcon name="pm.acceptance" /></template>
        </WorkbenchQuickAction>
        <WorkbenchQuickAction
          title="回到合同签约"
          hint="查看方案、报价和合同交接上下文"
          tone="outline"
          @click="emit('openContract')"
        >
          <template #icon><NavIcon name="designer.contract" /></template>
        </WorkbenchQuickAction>
      </div>
    </section>

    <section class="guide__card guide__handoff">
      <p class="guide__eyebrow">下一接棒</p>
      <template v-if="project">
        <strong>{{ nextOwner }}</strong>
        <p>项目当前推进点由服务端状态视图指定责任人；设计师不代替项目经理推进开工、任务节点或业主验收。</p>
      </template>
      <p v-else>选择项目后显示下一责任人。</p>
      <button
        v-if="nextProject"
        type="button"
        class="guide__next"
        @click="emit('selectNext', nextProject)"
      >
        查看下一项 · {{ nextProject.name || '项目待命名' }}
      </button>
    </section>
  </aside>
</template>

<style scoped lang="scss">
.guide { display: flex; flex-direction: column; gap: $space-3; min-width: 0; }
.guide__card { padding: $space-4; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; box-shadow: $shadow-card; }
.guide__eyebrow { margin: 0 0 $space-2; color: $brand-600; font-size: $font-caption; font-weight: $font-weight-semibold; letter-spacing: .08em; }
.guide__reason > strong,
.guide__primary > strong,
.guide__handoff > strong { display: block; color: $text-primary; font-size: $font-title; }
.guide__card > p:not(.guide__eyebrow) { margin: $space-2 0 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.65; }

.guide__reason dl { display: grid; gap: $space-2; margin: $space-3 0 0; }
.guide__money dl { display: grid; gap: $space-2; margin: 0 0 $space-3; }
.guide__money dl div { display: flex; align-items: center; justify-content: space-between; gap: $space-3; }
.guide__money dt { color: $text-tertiary; font-size: $font-caption; }
.guide__money dd { margin: 0; color: $text-primary; font-size: $font-caption; }
.guide__money-ok { color: $success-500; }
.guide__money-meter { height: 8px; overflow: hidden; border-radius: $radius-pill; background: $surface-100; }
.guide__money-meter i { display: block; height: 100%; border-radius: inherit; background: $success-500; }
.guide__money-rate { display: block; margin-top: 6px; color: $text-secondary; font-size: $font-caption; }

.guide__reason dl div { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; padding-top: $space-2; border-top: 1px solid $border-color; }
.guide__reason dt { color: $text-tertiary; font-size: $font-caption; }
.guide__reason dd { margin: 0; color: $text-primary; font-size: $font-caption; text-align: right; }
.guide__blocked { margin-top: $space-3; padding: $space-2 $space-3; border: 1px solid $warning-200; border-radius: $radius-sm; background: $warning-50; }
.guide__blocked span { color: $warning-700; font-size: $font-caption; font-weight: $font-weight-semibold; }
.guide__blocked p { margin: 4px 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.55; }

.guide__primary { border-color: $brand-300; background: linear-gradient(135deg, $brand-50, $surface-0 75%); }
.guide__primary-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 44px;
  margin-top: $space-3;
  border: 0;
  border-radius: $radius-sm;
  background: $brand-600;
  color: $surface-0;
  font: inherit;
  font-size: $font-body-sm;
  font-weight: $font-weight-semibold;
  cursor: pointer;
}
.guide__primary-button:hover { background: $brand-700; }
.guide__primary-button:disabled { cursor: not-allowed; opacity: .55; }
.guide__primary-button :deep(svg) { width: 17px; height: 17px; margin-right: 7px; }

.guide__change { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 6px; padding: 10px 12px; border-color: $warning-200; background: linear-gradient(135deg, $warning-50, $surface-0 78%); }
.guide__change-main { min-width: 0; }
.guide__change-main strong,
.guide__change-main small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.guide__change-main strong { color: $text-primary; font-size: $font-body-sm; }
.guide__change-main small { margin-top: 2px; color: $text-tertiary; font-size: $font-caption; }
.guide__change-button,
.guide__change-link { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-height: 34px; padding: 0 8px; border-radius: $radius-sm; font: inherit; font-size: $font-caption; white-space: nowrap; cursor: pointer; }
.guide__change-button { border: 1px solid $warning-200; background: $surface-0; color: $warning-700; font-weight: $font-weight-semibold; }
.guide__change-button:hover { border-color: $warning-500; background: $warning-50; }
.guide__change-link { border: 0; background: transparent; color: $text-secondary; }
.guide__change-link:hover { color: $brand-700; }
.guide__change-button:disabled,
.guide__change-link:disabled { cursor: not-allowed; opacity: .55; }

.guide__section-head { margin-bottom: $space-3; }
.guide__section-head div { display: flex; flex-direction: column; gap: 3px; }
.guide__section-head strong { color: $text-primary; font-size: $font-body; }
.guide__section-head small { color: $text-tertiary; font-size: $font-caption; }
.guide__actions { display: grid; gap: $space-2; }

.guide__next {
  width: 100%;
  min-height: 38px;
  margin-top: $space-3;
  padding: 0 10px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-0;
  color: $brand-700;
  font: inherit;
  font-size: $font-caption;
  cursor: pointer;
}
.guide__next:hover { border-color: $brand-300; background: $brand-50; }
</style>
