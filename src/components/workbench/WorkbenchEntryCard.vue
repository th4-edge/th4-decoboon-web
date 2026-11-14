<script setup lang="ts">
import StatusTag from '@/components/StatusTag.vue'
import type { HomeWorkbenchEntry } from '@/roles/workbenchHome'

/**
 * 场景工作台入口卡片。**只渲染传入的静态清单项**，不做角色过滤、不做落地页解析
 * （数据源 = `src/roles/workbenchHome.ts`，每角色一份静态清单）。
 */
defineProps<{
  entry: HomeWorkbenchEntry
  compact?: boolean
}>()
</script>

<template>
  <article class="workbench-card" :class="{ 'workbench-card--compact': compact }">
    <StatusTag
      v-if="entry.decisionStatus !== 'approved'"
      class="workbench-card__status"
      tone="pending"
      text="暂未开放"
    />
    <h3>{{ entry.label }}</h3>

    <router-link
      v-if="entry.decisionStatus === 'approved' && entry.to"
      class="workbench-card__link"
      :to="entry.to"
    >
      进入
    </router-link>
    <el-tooltip
      v-else
      content="该功能暂未开放，请先处理已开放的业务事项。"
      placement="top"
    >
      <span class="workbench-card__disabled">暂未开放</span>
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

.workbench-card__status { align-self: flex-start; }

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
