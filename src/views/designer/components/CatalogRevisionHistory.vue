<script setup lang="ts">
import { ref, watch } from 'vue'
import { formatDateTime } from '@/core/format'
import { catalogApi } from '@/domains/catalog/api'
import type { CatalogRevision } from '@/domains/catalog/model'

const props = defineProps<{ itemId: string }>()

const revisions = ref<CatalogRevision[]>([])
const loading = ref(false)
const error = ref('')
let requestSeq = 0

const CHANGE_LABELS: Record<CatalogRevision['changeType'], string> = {
  Create: '新增',
  Update: '更新',
  Disable: '停用',
  Enable: '启用',
  Delete: '删除'
}

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  revisions.value = []
  try {
    const rows = await catalogApi.pageCatalogRevisions(props.itemId, 1, 50)
    if (seq === requestSeq) revisions.value = rows
  } catch (err) {
    if (seq !== requestSeq) return
    error.value = err instanceof Error ? err.message : '变更历史暂不可确认，请稍后重试'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function summary(row: CatalogRevision): string {
  if (!row.snapshotJson) return '当前角色可查看变更时间与操作人'
  try {
    const snapshot = JSON.parse(row.snapshotJson) as Record<string, unknown>
    return [snapshot.code, snapshot.name, snapshot.category].filter(Boolean).join(' · ') || '变更内容已留存'
  } catch {
    return '变更内容已留存'
  }
}

watch(() => props.itemId, load, { immediate: true })
</script>

<template>
  <section class="revision-history" aria-live="polite">
    <header>
      <div>
        <h4>变更历史</h4>
        <p>每次有效修改都会留下变更记录；历史报价继续使用当时确认的金额与成本。</p>
      </div>
      <button type="button" :disabled="loading" @click="load">刷新</button>
    </header>

    <el-skeleton v-if="loading" :rows="3" animated />
    <div v-else-if="error" class="revision-history__error">
      <span>{{ error }}</span>
      <button type="button" @click="load">重新加载</button>
    </div>
    <p v-else-if="!revisions.length" class="revision-history__empty">当前项目暂无修订记录</p>
    <ol v-else class="revision-history__list">
      <li v-for="row in revisions" :key="row.id">
        <div class="revision-history__head">
          <strong>R{{ row.revision }}</strong>
          <span>{{ CHANGE_LABELS[row.changeType] }}</span>
          <time>{{ formatDateTime(row.changedAt) }}</time>
        </div>
        <p>{{ summary(row) }}</p>
        <small>操作人：{{ row.changedBy?.name || '历史操作人不可确认' }}</small>
      </li>
    </ol>
  </section>
</template>

<style scoped lang="scss">
.revision-history {
  margin-top: $space-4;
  padding-top: $space-4;
  border-top: 1px solid $border-color;
}

.revision-history header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-3;
  margin-bottom: $space-3;

  h4 {
    margin: 0;
    color: $text-primary;
    font-size: $font-body;
  }

  p {
    margin: $space-1 0 0;
    color: $text-secondary;
    font-size: $font-caption;
    line-height: 1.6;
  }

  button {
    flex-shrink: 0;
    min-height: 30px;
    padding: 0 $space-3;
    border: 1px solid $border-color;
    border-radius: $radius-sm;
    color: $text-secondary;
    background: $surface-0;
    font: inherit;
    cursor: pointer;
  }
}

.revision-history__list {
  display: grid;
  gap: $space-2;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    padding: $space-3;
    border: 1px solid $border-color;
    border-radius: $radius-sm;
    background: $surface-50;
  }

  p {
    margin: $space-2 0 $space-1;
    color: $text-secondary;
    font-size: $font-body-sm;
    line-height: 1.6;
  }

  small {
    color: $text-secondary;
    font-size: $font-caption;
  }
}

.revision-history__head {
  display: flex;
  align-items: center;
  gap: $space-2;

  strong {
    color: $brand-700;
    font-size: $font-body;
  }

  span {
    padding: 1px $space-2;
    border-radius: $radius-pill;
    color: $brand-700;
    background: $brand-50;
    font-size: $font-caption;
  }

  time {
    margin-left: auto;
    color: $text-secondary;
    font-size: $font-caption;
    font-variant-numeric: tabular-nums;
  }
}

.revision-history__error,
.revision-history__empty {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
  margin: 0;
  padding: $space-3;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  color: $warning-700;
  background: $surface-50;
  font-size: $font-body-sm;
}

.revision-history__error button {
  border: 0;
  color: $brand-700;
  background: transparent;
  font: inherit;
  cursor: pointer;
}
</style>
