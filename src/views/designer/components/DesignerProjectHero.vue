<script setup lang="ts">
import { computed } from 'vue'
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import MoneyText from '@/components/MoneyText.vue'
import ObjectHeroCard from '@/components/workbench/ObjectHeroCard.vue'
import HeroFocusItem from '@/components/workbench/HeroFocusItem.vue'
import StatusTag from '@/components/StatusTag.vue'
import { formatDateTime } from '@/core/format'
import { isStatusTone, type StatusTone } from '@/core/tone'
import type { ProjectBrief, ProjectStage } from '@/domains/project/model'

const props = withDefaults(defineProps<{
  project: ProjectBrief
  stage?: ProjectStage | null
  loading?: boolean
}>(), {
  stage: null,
  loading: false
})

const locationText = computed(() => {
  const project = props.project
  const location = project.propertyName || project.community || project.address
  return [project.customerName, location].filter(Boolean).join(' · ') || '客户与房屋待补充'
})

const projectTitle = computed(() => props.project.name || '项目待命名')
const projectInitial = computed(() => projectTitle.value.slice(0, 1) || '项')
const progressPercent = computed(() => Math.max(0, Math.min(100, Number(props.project.progress) || 0)))
const receivableAmount = computed(() => Number(props.project.receivableAmount ?? 0))
const receivedAmount = computed(() => Number(props.project.receivedAmount ?? 0))
const collectionPercent = computed(() => {
  if (receivableAmount.value <= 0) return 0
  return Math.max(0, Math.min(100, Math.round(receivedAmount.value / receivableAmount.value * 1000) / 10))
})
const collectionText = computed(() => receivableAmount.value <= 0 ? '待生成应收' : `${collectionPercent.value}%`)

const focusFields = computed(() => {
  const labels = props.project.businessStateView?.derivedLabels ?? []
  const allowedKeys = new Set(['currentStage', 'progress', 'risk'])
  return labels
    .filter((item) => allowedKeys.has(item.key) && item.label)
    .slice(0, 4)
    .map((item) => ({
      key: item.key,
      label: focusLabel(item.key),
      value: item.label,
      note: focusNote(item.key),
      tone: item.tone && isStatusTone(item.tone) ? item.tone as StatusTone : undefined
    }))
})

function focusLabel(key: string): string {
  if (key === 'currentStage') return '当前阶段'
  if (key === 'progress') return '项目进度'
  if (key === 'risk') return '项目风险'
  return '项目信息'
}

function focusNote(key: string): string {
  if (key === 'currentStage') return '阶段名称暂不可确认'
  if (key === 'progress') return '项目级进度，不代表当前任务完成'
  if (key === 'risk') return '风险等级来自项目状态视图'
  return '状态待确认'
}

function dateText(value?: string): string {
  if (!value) return '暂不可确认'
  const text = formatDateTime(value)
  return text === '暂不可确认' ? text : text.slice(0, 10)
}
</script>

<template>
  <ObjectHeroCard>
    <template #avatar>{{ projectInitial }}</template>
    <template #title>
      <strong>{{ projectTitle }}</strong>
      <BusinessStateTag object-key="project" :server-value="project.businessStateView?.status || project.status" size="md" />
      <StatusTag
        v-if="project.businessOrigin === 'carryover'"
        text="接管项目"
        tone="special"
        :dot="false"
      />
    </template>
    <template #subtitle>
      {{ locationText || '项目地址待补充' }}
    </template>
    <template #chips>
      <span v-if="project.managerName" class="hero-chip">项目经理 {{ project.managerName }}</span>
      <span v-else class="hero-chip hero-chip--muted">项目经理待指派</span>
      <span v-if="stage" class="hero-chip">当前阶段 {{ stage.name }}</span>
      <span class="hero-chip">计划完工 {{ dateText(project.planEndDate) }}</span>
    </template>

    <template #focus>
      <HeroFocusItem
        v-for="item in focusFields"
        :key="item.key"
        :label="item.label"
        :value="item.value"
        :note="item.note"
        :tone="item.tone"
      />
      <HeroFocusItem
        v-if="!focusFields.length"
        label="项目下一步"
        value="状态待确认"
        note="阶段关注信息暂不可确认"
        tone="pending"
      />
    </template>

    <template #facts>
      <div><small>建筑面积</small><b>{{ project.area ? `${project.area}㎡` : '暂不可确认' }}</b></div>
      <div><small>合同金额</small><b><MoneyText :value="project.contractAmount" size="sm" /></b></div>
      <div class="hero-meter">
        <span class="hero-meter__head"><small>整体施工进度</small><b>{{ progressPercent }}%</b></span>
        <span class="hero-meter__track"><i :style="{ width: `${progressPercent}%` }" /></span>
      </div>
      <div class="hero-meter">
        <span class="hero-meter__head"><small>回款进度</small><b>{{ collectionText }}</b></span>
        <span class="hero-meter__track hero-meter__track--payment"><i :style="{ width: `${collectionPercent}%` }" /></span>
        <span class="hero-meter__amount">
          <MoneyText :value="receivedAmount" size="sm" /> / <MoneyText :value="receivableAmount" size="sm" />
        </span>
      </div>
    </template>

  </ObjectHeroCard>
</template>

<style scoped lang="scss">
.hero-chip {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 3px 8px;
  border: 1px solid $brand-100;
  border-radius: $radius-pill;
  background: rgba(255, 255, 255, .72);
  color: $text-secondary;
  font-size: $font-caption;
}

.hero-chip--muted { color: $text-tertiary; }

.hero-meter { min-width: 0; }
.hero-meter__head { display: flex; align-items: baseline; justify-content: space-between; gap: 4px; }
.hero-meter__head small { color: $text-tertiary; font-size: $font-caption; }
.hero-meter__head b { color: $brand-700; font-size: $font-body-sm; font-variant-numeric: tabular-nums; white-space: nowrap; }
.hero-meter__track { display: block; height: 6px; margin-top: 5px; overflow: hidden; border-radius: $radius-pill; background: $surface-100; }
.hero-meter__track i { display: block; height: 100%; border-radius: inherit; background: $brand-500; }
.hero-meter__track--payment i { background: $success-500; }
.hero-meter__amount { display: flex; align-items: center; justify-content: flex-end; gap: 2px; margin-top: 4px; color: $text-tertiary; font-size: $font-caption; font-variant-numeric: tabular-nums; white-space: nowrap; }

@media (min-width: 1200px) {
  :deep(.ohero__focus) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

</style>
