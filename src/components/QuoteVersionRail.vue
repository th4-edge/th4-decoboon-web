<script setup lang="ts">
import { computed } from 'vue'
import StatusTag from '@/components/StatusTag.vue'
import MoneyText from '@/components/MoneyText.vue'
import { QUOTE_STATUS_META } from '@/domains/trade/meta'
import type { Quote } from '@/domains/trade/model'

/**
 * 版本轨道：当前版本 + 历史版本（只读）+ 改版重报入口。
 *
 * 口径（后端为准，Web 不自造版本号）：
 * - Draft 可编辑；Submitted / Accepted / Converted 只读；
 * - Rejected 必须走「改版重报」由服务端生成新 Draft 版本；
 * - 历史版本永久只读。
 */
const props = withDefaults(defineProps<{
  currentId: string
  versions: Quote[]
  loading?: boolean
  error?: string
  /** 当前有未保存修改 → 切换必须拦截 */
  hasUnsaved?: boolean
  switching?: boolean
}>(), { loading: false, error: '', hasUnsaved: false, switching: false })

const emit = defineEmits<{
  switch: [quoteId: string]
  rebase: []
}>()

const current = computed(() => props.versions.find((v) => v.id === props.currentId) ?? null)

/** 只有被驳回的版本才能改版重报（服务端同样校验）。 */
const canRebase = computed(() => current.value?.status === 'rejected')

function onSelect(quote: Quote): void {
  if (quote.id === props.currentId || props.switching) return
  emit('switch', quote.id)
}
</script>

<template>
  <aside class="vrail">
    <header class="vrail__head">
      <h2 class="vrail__title">版本轨道</h2>
      <span class="vrail__count">{{ versions.length }} 个版本</span>
    </header>

    <el-alert v-if="hasUnsaved" class="vrail__warn" type="warning" :closable="false"
      title="有未保存修改" description="切换版本前会提示，不会静默丢弃。" />

    <div v-if="loading" class="vrail__hint">历史版本加载中…</div>
    <el-alert v-else-if="error" type="warning" :closable="false" :title="error" />

    <template v-else>
      <div v-if="current" class="vrail__current">
        <div class="vrail__row">
          <strong>V{{ current.version }} · 当前版本</strong>
          <StatusTag :tone="QUOTE_STATUS_META[current.status].tone" :text="QUOTE_STATUS_META[current.status].label" />
        </div>
        <p class="vrail__no">{{ current.no }}</p>
        <div class="vrail__meta">
          <MoneyText :value="current.amount" size="sm" />
          <span>{{ current.createdAt || '创建时间暂不可确认' }}</span>
        </div>
        <el-button v-if="canRebase" class="vrail__rebase" type="primary" plain size="small"
          :disabled="hasUnsaved" @click="emit('rebase')">
          改版重报（生成新版本）
        </el-button>
        <p v-if="canRebase && hasUnsaved" class="vrail__hint">请先保存或放弃当前修改，再改版重报</p>
      </div>

      <div class="vrail__list">
        <span class="vrail__list-title">历史版本（只读）</span>
        <button v-for="item in versions" :key="item.id" type="button" class="vrail__item"
          :class="{ 'is-active': item.id === currentId }" :disabled="switching"
          @click="onSelect(item)">
          <span class="vrail__item-main">
            <b>V{{ item.version }}</b>
            <StatusTag :tone="QUOTE_STATUS_META[item.status].tone" :text="QUOTE_STATUS_META[item.status].label" :dot="false" />
          </span>
          <span class="vrail__item-sub">{{ item.no }} · {{ item.createdAt || '—' }}</span>
          <span class="vrail__item-amount"><MoneyText :value="item.amount" size="sm" /></span>
        </button>
      </div>
    </template>
  </aside>
</template>

<style scoped lang="scss">
.vrail {
  display: flex;
  flex-direction: column;
  gap: $space-3;
  min-width: 0;
  min-height: 0;
  padding: $space-3;
  background: $surface-0;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  box-shadow: $shadow-card;
  overflow: auto;
}

.vrail__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: $space-2;
}

.vrail__title { margin: 0; font-size: $font-body-sm; font-weight: $font-weight-semibold; }
.vrail__count { font-size: $font-caption; color: $text-tertiary; }
.vrail__warn { margin: 0; }
.vrail__hint { margin: 0; font-size: $font-caption; color: $text-secondary; }

.vrail__current {
  display: flex;
  flex-direction: column;
  gap: $space-2;
  padding: $space-3;
  border-radius: $radius-sm;
  background: $brand-50;
  border: 1px solid $brand-100;
}

.vrail__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;

  strong { font-size: $font-body-sm; }
}

.vrail__no { margin: 0; font-size: $font-caption; color: $text-secondary; }

.vrail__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;
  font-size: $font-caption;
  color: $text-secondary;
}

.vrail__rebase { align-self: flex-start; }

.vrail__list {
  display: flex;
  flex-direction: column;
  gap: $space-1;
}

.vrail__list-title { font-size: $font-caption; color: $text-tertiary; }

.vrail__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: $space-2;
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: $radius-sm;
  cursor: pointer;

  &:hover:not(:disabled) { background: $bg-hover; }
  &.is-active { background: $bg-active; border-color: $brand-100; }
  &:disabled { cursor: default; }
}

.vrail__item-main {
  display: flex;
  align-items: center;
  gap: $space-2;
  font-size: $font-body-sm;
}

.vrail__item-sub { font-size: $font-caption; color: $text-tertiary; }
.vrail__item-amount { font-size: $font-caption; }
</style>
