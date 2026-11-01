<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '@/components/EmptyState.vue'
import NavIcon from '@/components/shell/NavIcon.vue'
import PageHeader from '@/components/shell/PageHeader.vue'
import { collabApi } from '@/domains/collab/api'
import type { Notice, NoticeType } from '@/domains/collab/model'
import { formatDateTime } from '@/core/format'
import { useSessionStore } from '@/stores/session'

const router = useRouter()
const session = useSessionStore()
const notices = ref<Notice[]>([])
const loading = ref(false)
const markingAll = ref(false)
const error = ref('')
const unreadCount = ref(0)
const activeTab = ref<'all' | 'unread'>('all')
const typeFilter = ref<'all' | NoticeType>('all')

const TYPE_ORDER: NoticeType[] = ['customer', 'project', 'quote', 'task', 'overdue', 'accept', 'invite', 'dynamic', 'system']
const typeLabels: Record<NoticeType, string> = {
  customer: '客户',
  project: '项目',
  quote: '报价',
  task: '任务',
  overdue: '逾期',
  dynamic: '动态',
  accept: '验收',
  system: '系统',
  invite: '邀请'
}

const typeOptions = computed(() => {
  const present = new Set(notices.value.map((notice) => notice.type))
  return TYPE_ORDER.filter((type) => present.has(type)).map((type) => ({ key: type, label: typeLabels[type] }))
})

const filtered = computed(() => notices.value.filter((notice) => {
  if (activeTab.value === 'unread' && notice.read) return false
  if (typeFilter.value !== 'all' && notice.type !== typeFilter.value) return false
  return true
}))

const hasActiveFilters = computed(() => activeTab.value !== 'all' || typeFilter.value !== 'all')

function noticeIcon(type: NoticeType): string {
  if (type === 'customer') return 'customer.followup'
  if (type === 'project') return 'pm.project'
  if (type === 'quote') return 'designer.quote'
  if (type === 'task' || type === 'overdue') return 'boss.risk'
  if (type === 'accept') return 'pm.acceptance'
  if (type === 'invite') return 'user'
  if (type === 'system') return 'help'
  return 'bell'
}

function noticeRoute(notice: Notice): string | null {
  if (session.role === 'Designer') {
    if (notice.quoteId) return `/designer/quotes/${notice.quoteId}`
    if (notice.customerId) return `/workbench/customers/${notice.customerId}`
    if (notice.projectId) return '/designer/projects'
  }
  if (session.role === 'Pm' && notice.projectId) return `/pm/workbench?projectId=${notice.projectId}`
  if (notice.customerId || notice.projectId) return '/workbench'
  return null
}

function clearFilters(): void {
  activeTab.value = 'all'
  typeFilter.value = 'all'
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const [list, unread] = await Promise.all([collabApi.notices(), collabApi.unread()])
    notices.value = list
    unreadCount.value = unread
  } catch (err) {
    error.value = err instanceof Error ? err.message : '消息暂不可确认，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function markRead(notice: Notice): Promise<void> {
  if (notice.read) return
  try {
    await collabApi.read(notice.id)
    notice.read = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  } catch {
    ElMessage.warning('标记已读失败，请稍后重试')
  }
}

async function openNotice(notice: Notice): Promise<void> {
  await markRead(notice)
  const route = noticeRoute(notice)
  if (route) await router.push(route)
}

async function markAllRead(): Promise<void> {
  if (markingAll.value) return
  const unread = notices.value.filter((notice) => !notice.read)
  if (!unread.length) return
  markingAll.value = true
  try {
    await Promise.all(unread.map(async (notice) => {
      try {
        await collabApi.read(notice.id)
        notice.read = true
      } catch {
        // 单条失败保留未读，刷新后按服务端事实恢复。
      }
    }))
    unreadCount.value = notices.value.filter((notice) => !notice.read).length
  } finally {
    markingAll.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="notification-page">
    <PageHeader
      title="消息通知"
      summary="按业务类型和未读状态查看消息，点击消息进入对应对象。"
    >
      <template #actions>
        <button class="notification-action" type="button" :disabled="loading" @click="load">
          <NavIcon name="refresh" />
          <span>{{ loading ? '刷新中' : '刷新' }}</span>
        </button>
        <button
          v-if="unreadCount > 0"
          class="notification-action notification-action--primary"
          type="button"
          :disabled="markingAll"
          @click="markAllRead"
        >
          <NavIcon name="check-all" />
          <span>{{ markingAll ? '处理中' : '全部已读' }}</span>
        </button>
      </template>
    </PageHeader>

    <div v-if="error" class="notification-error" role="alert">
      <div>
        <strong>消息暂不可确认</strong>
        <span>{{ error }}</span>
      </div>
      <button type="button" @click="load">重新加载</button>
    </div>

    <section class="notification-workspace" aria-label="消息列表">
      <header class="notification-toolbar">
        <div class="notification-tabs" role="group" aria-label="消息状态">
          <button
            type="button"
            :class="{ active: activeTab === 'all' }"
            :aria-pressed="activeTab === 'all'"
            @click="activeTab = 'all'"
          >
            全部
            <b>{{ notices.length }}</b>
          </button>
          <button
            type="button"
            :class="{ active: activeTab === 'unread' }"
            :aria-pressed="activeTab === 'unread'"
            @click="activeTab = 'unread'"
          >
            未读
            <b>{{ unreadCount }}</b>
          </button>
        </div>

        <div class="notification-toolbar__right">
          <span class="notification-count">{{ filtered.length }} 条</span>
          <el-select v-model="typeFilter" class="notification-type-select" aria-label="筛选消息类型">
            <el-option label="全部类型" value="all" />
            <el-option v-for="item in typeOptions" :key="item.key" :label="item.label" :value="item.key" />
          </el-select>
        </div>
      </header>

      <div v-if="loading && !notices.length" class="notification-state" aria-busy="true" aria-live="polite">
        <el-skeleton :rows="7" animated />
      </div>

      <EmptyState
        v-else-if="!filtered.length"
        :title="hasActiveFilters ? '当前筛选下没有消息' : '还没有收到消息'"
        :description="hasActiveFilters ? '清除筛选后可查看全部消息，也可以刷新获取最新状态。' : '业务事项产生通知后会出现在这里。'"
        :action-text="hasActiveFilters ? '清除筛选' : '刷新消息'"
        @action="hasActiveFilters ? clearFilters() : load()"
      />

      <div v-else class="notification-list" :class="{ 'notification-list--refreshing': loading }">
        <button
          v-for="notice in filtered"
          :key="notice.id"
          type="button"
          class="notification-item"
          :class="{ 'notification-item--unread': !notice.read }"
          :aria-label="`${notice.read ? '已读' : '未读'}${typeLabels[notice.type]}消息：${notice.title}`"
          @click="openNotice(notice)"
        >
          <span class="notification-item__icon" :class="`notification-item__icon--${notice.type}`">
            <NavIcon :name="noticeIcon(notice.type)" />
          </span>

          <span class="notification-item__main">
            <span class="notification-item__meta">
              <span class="notification-item__type">{{ typeLabels[notice.type] }}</span>
              <span v-if="!notice.read" class="notification-item__unread">未读</span>
              <time v-if="notice.createdAt" :datetime="notice.createdAt">{{ formatDateTime(notice.createdAt) }}</time>
            </span>
            <strong>{{ notice.title }}</strong>
            <span class="notification-item__content">{{ notice.content }}</span>
          </span>

          <NavIcon class="notification-item__arrow" name="chevron-right" />
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.notification-page {
  display: flex;
  flex-direction: column;
  gap: $space-5;
}

.notification-action {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 $space-3;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  color: $text-secondary;
  background: $surface-0;
  font: inherit;
  font-size: $font-caption;
  cursor: pointer;
  transition: color $transition-fast, border-color $transition-fast, background $transition-fast;

  &:hover:not(:disabled) {
    color: $brand-700;
    border-color: $brand-300;
    background: $brand-50;
  }

  &:focus-visible {
    outline: 2px solid $brand-500;
    outline-offset: 2px;
  }

  &:disabled { cursor: default; opacity: .6; }
}

.notification-action--primary {
  border-color: $brand-200;
  color: $brand-700;
  background: $brand-50;
}

.notification-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-4;
  padding: $space-3 $space-4;
  border: 1px solid $danger-200;
  border-radius: $radius-md;
  background: $danger-50;

  > div { display: grid; gap: 2px; min-width: 0; }
  strong { color: $text-primary; font-size: $font-body-sm; font-weight: $font-weight-semibold; }
  span { color: $danger-500; font-size: $font-caption; line-height: 1.55; }

  button {
    flex: none;
    min-height: 32px;
    padding: 0 $space-3;
    border: 1px solid $danger-200;
    border-radius: $radius-sm;
    color: $danger-500;
    background: $surface-0;
    font: inherit;
    font-size: $font-caption;
    cursor: pointer;
  }
}

.notification-workspace {
  overflow: hidden;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
  box-shadow: $shadow-card;
}

.notification-toolbar {
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-4;
  padding: $space-3 $space-5;
  border-bottom: 1px solid $border-color;
}

.notification-tabs {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: $radius-sm;
  background: $surface-100;

  button {
    min-height: 32px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 $space-3;
    border: 0;
    border-radius: $radius-xs;
    color: $text-secondary;
    background: transparent;
    font: inherit;
    font-size: $font-caption;
    cursor: pointer;
    transition: color $transition-fast, background $transition-fast, box-shadow $transition-fast;

    b {
      color: $text-tertiary;
      font-size: $font-caption;
      font-variant-numeric: tabular-nums;
      font-weight: $font-weight-medium;
    }

    &:hover { color: $text-primary; }

    &.active {
      color: $text-primary;
      background: $surface-0;
      box-shadow: $shadow-card;

      b { color: $brand-700; }
    }

    &:focus-visible {
      outline: 2px solid $brand-500;
      outline-offset: 1px;
    }
  }
}

.notification-toolbar__right {
  display: flex;
  align-items: center;
  gap: $space-3;
}

.notification-count {
  color: $text-tertiary;
  font-size: $font-caption;
  font-variant-numeric: tabular-nums;
}

.notification-type-select {
  width: 132px;
}

.notification-state {
  min-height: 420px;
  display: grid;
  place-items: center;
  padding: $space-6;
}

.notification-list {
  display: flex;
  flex-direction: column;
  transition: opacity $transition-fast;
}

.notification-list--refreshing { opacity: .62; }

.notification-item {
  position: relative;
  min-height: 92px;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 18px;
  align-items: start;
  gap: $space-3;
  width: 100%;
  padding: $space-4 $space-5;
  border: 0;
  border-bottom: 1px solid $border-color;
  color: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background $transition-fast;

  &:last-child { border-bottom: 0; }
  &:hover { background: $surface-50; }
  &:focus-visible { outline: 2px solid $brand-500; outline-offset: -2px; }

  &::before {
    position: absolute;
    top: $space-4;
    bottom: $space-4;
    left: 0;
    width: 3px;
    border-radius: 0 $radius-xs $radius-xs 0;
    background: $brand-500;
    content: '';
    opacity: 0;
  }
}

.notification-item--unread {
  background: $brand-50;

  &::before { opacity: 1; }
  &:hover { background: $brand-100; }
}

.notification-item__icon {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: $radius-md;
  color: $brand-600;
  background: $brand-50;

  :deep(.nav-icon) { width: 19px; height: 19px; }
}

.notification-item__icon--project { color: $status-progress; background: $status-progress-soft; }
.notification-item__icon--quote { color: $status-info; background: $status-info-soft; }
.notification-item__icon--overdue,
.notification-item__icon--task { color: $status-blocked; background: $status-blocked-soft; }
.notification-item__icon--accept { color: $status-done; background: $status-done-soft; }

.notification-item__main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.notification-item__meta {
  display: flex;
  align-items: center;
  gap: $space-2;
  min-height: 18px;

  time {
    margin-left: auto;
    color: $text-tertiary;
    font-size: $font-caption;
    font-variant-numeric: tabular-nums;
  }
}

.notification-item__type {
  color: $brand-700;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
}

.notification-item__unread {
  color: $danger-500;
  font-size: $font-caption;
  font-weight: $font-weight-medium;
}

.notification-item strong {
  overflow: hidden;
  color: $text-primary;
  font-size: $font-body-sm;
  font-weight: $font-weight-medium;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-item__content {
  display: -webkit-box;
  overflow: hidden;
  color: $text-secondary;
  font-size: $font-caption;
  line-height: 1.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.notification-item__arrow {
  width: 16px;
  height: 16px;
  margin-top: 13px;
  color: $text-tertiary;
  transition: color $transition-fast, transform $transition-fast;
}

.notification-item:hover .notification-item__arrow {
  color: $brand-600;
  transform: translateX(2px);
}

@media (max-width: 720px) {
  .notification-toolbar {
    align-items: stretch;
    flex-direction: column;
    padding: $space-3 $space-4;
  }

  .notification-toolbar__right {
    justify-content: space-between;
  }

  .notification-type-select { width: 150px; }
  .notification-error { align-items: flex-start; flex-direction: column; }
  .notification-item { grid-template-columns: 38px minmax(0, 1fr) 16px; padding: $space-4; }
  .notification-item__icon { width: 38px; height: 38px; }
}

@media (prefers-reduced-motion: reduce) {
  .notification-action,
  .notification-tabs button,
  .notification-item,
  .notification-item__arrow {
    transition-duration: .01ms !important;
  }
}
</style>
