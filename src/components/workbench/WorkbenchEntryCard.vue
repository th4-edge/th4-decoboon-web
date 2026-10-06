<script setup lang="ts">
import { computed } from 'vue'
import StatusTag from '@/components/StatusTag.vue'
import { domainLabelOf, groupOf, resolveWorkbenchLink } from '@/domains/workbench/navigation'
import type { WorkbenchEntry } from '@/domains/workbench/model'

const props = withDefaults(defineProps<{
  entry: WorkbenchEntry
  compact?: boolean
}>(), { compact: false })

const link = computed(() => resolveWorkbenchLink(props.entry))
</script>

<template>
  <article class="workbench-card" :class="{ 'workbench-card--compact': compact }">
    <div class="workbench-card__top">
      <span class="workbench-card__domain">{{ domainLabelOf(entry) }} · {{ groupOf(entry)?.label ?? entry.group }}</span>
      <StatusTag
        :tone="entry.decisionStatus === 'approved' ? 'done' : 'pending'"
        :text="entry.decisionStatus === 'approved' ? entry.priority : '待业务确认'"
      />
    </div>

    <h3>{{ entry.label }}</h3>
    <p class="workbench-card__scenario">{{ entry.entryScenario }}</p>

    <dl class="workbench-card__facts">
      <div>
        <dt>对象锚点</dt>
        <dd>{{ entry.objectAnchor }}</dd>
      </div>
      <div>
        <dt>当前任务</dt>
        <dd>{{ entry.mainAction }}</dd>
      </div>
      <div>
        <dt>完成后</dt>
        <dd>{{ entry.handoff }}</dd>
      </div>
    </dl>

    <router-link
      v-if="entry.decisionStatus === 'approved' && link"
      class="workbench-card__link"
      :to="link"
    >
      进入工作台
    </router-link>
    <el-tooltip
      v-else
      content="该工作台的动作策略或对象入口尚未通过业务裁决，暂不可进入执行。"
      placement="top"
    >
      <span class="workbench-card__disabled">待业务确认</span>
    </el-tooltip>
  </article>
</template>

<style scoped lang="scss">
.workbench-card {
  display: flex;
  flex-direction: column;
  gap: $space-3;
  min-width: 0;
  padding: $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  box-shadow: $shadow-card;

  h3 {
    margin: 0;
    font-size: $font-card-title;
  }
}

.workbench-card--compact {
  box-shadow: none;
  background: $surface-50;
}

.workbench-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;
}

.workbench-card__domain {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: $font-caption;
  color: $text-tertiary;
}

.workbench-card__scenario {
  min-height: 42px;
  margin: 0;
  font-size: $font-body-sm;
  color: $text-secondary;
  line-height: 1.65;
}

.workbench-card__facts {
  display: flex;
  flex-direction: column;
  gap: $space-2;
  margin: 0;

  div {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr);
    gap: $space-2;
  }

  dt {
    font-size: $font-caption;
    color: $text-tertiary;
  }

  dd {
    margin: 0;
    min-width: 0;
    font-size: $font-caption;
    color: $text-primary;
    line-height: 1.5;
  }
}

.workbench-card__link,
.workbench-card__disabled {
  margin-top: auto;
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: $radius-sm;
  font-size: $font-body-sm;
}

.workbench-card__link {
  border: 1px solid $brand-500;
  color: $brand-600;
  text-decoration: none;

  &:hover { background: $brand-50; }
  &:focus-visible { outline: 2px solid $brand-500; outline-offset: 2px; }
}

.workbench-card__disabled {
  border: 1px solid $border-color;
  color: $text-tertiary;
  background: $surface-50;
  cursor: not-allowed;
}
</style>
