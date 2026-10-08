<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import NavIcon from '@/components/shell/NavIcon.vue'
import { collabApi } from '@/domains/collab/api'
import type { Notice } from '@/domains/collab/model'
import { formatDateTime } from '@/core/format'
import { useSessionStore } from '@/stores/session'

const router = useRouter()
const session = useSessionStore()
const notices = ref<Notice[]>([])
const loading = ref(false)
const error = ref('')
const unreadCount = ref(0)
const activeTab = ref<'all' | 'unread'>('all')
const typeFilter = ref('all')

const typeLabels: Record<string, string> = {
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
  const keys = new Set(notices.value.map((notice) => notice.type))
  return [
    { key: 'all', label: '全部类型' },
    ...Array.from(keys).map((key) => ({ key, label: typeLabels[key] ?? '其他' }))
  ]
})

const filtered = computed(() => notices.value.filter((notice) => {
  if (activeTab.value === 'unread' && notice.read) return false
  if (typeFilter.value !== 'all' && notice.type !== typeFilter.value) return false
  return true
}))

function noticeIcon(type: string): string {
  if (type === 'customer') return 'customer.followup'
  if (type === 'project') return 'pm.project'
  if (type === 'quote') return 'designer.quote'
  if (type === 'task' || type === 'overdue') return 'boss.risk'
  if (type === 'accept') return 'pm.acceptance'
  return 'bell'
}

function noticeRoute(notice: Notice): string | null {
  if (session.role === 'Designer') {
    if (notice.quoteId) return `/designer/quotes/${notice.quoteId}`
    if (notice.customerId) return `/designer/customers?activeCustomerId=${notice.customerId}`
    if (notice.projectId) return '/designer/projects'
  }
  if (session.role === 'Pm' && notice.projectId) return `/pm/workbench?projectId=${notice.projectId}`
  if (notice.customerId || notice.projectId) return '/workbench'
  return null
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
  const unread = notices.value.filter((notice) => !notice.read)
  await Promise.all(unread.map(async (notice) => {
    try {
      await collabApi.read(notice.id)
      notice.read = true
    } catch {
      // 单条失败保留未读，刷新后按服务端事实恢复。
    }
  }))
  unreadCount.value = notices.value.filter((notice) => !notice.read).length
}

onMounted(load)
</script>

<template>
  <div class="notification-page">
    <div class="page-head">
      <div class="title-zone">
        <h1>消息通知</h1>
        <div class="sub">集中查看客户、项目、报价、任务和系统通知，点击消息进入对应对象。</div>
      </div>
      <div class="meta">
        <span class="unread-pill"><b>{{ unreadCount }}</b> 条未读</span>
        <button type="button" class="refresh-btn" :class="{ spin: loading }" @click="load">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 1 1-2.6-6.3M21 3v6h-6" />
          </svg>
          刷新
        </button>
      </div>
    </div>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default><el-button size="small" plain @click="load">重新加载</el-button></template>
    </el-alert>

    <div class="notification-page__layout">
      <aside class="notification-filters">
        <section>
          <h3>消息状态</h3>
          <button type="button" :class="{ active: activeTab === 'all' }" @click="activeTab = 'all'">
            全部消息 <b>{{ notices.length }}</b>
          </button>
          <button type="button" :class="{ active: activeTab === 'unread' }" @click="activeTab = 'unread'">
            未读消息 <b>{{ unreadCount }}</b>
          </button>
        </section>
        <section>
          <h3>消息类型</h3>
          <button
            v-for="item in typeOptions"
            :key="item.key"
            type="button"
            :class="{ active: typeFilter === item.key }"
            @click="typeFilter = item.key"
          >
            {{ item.label }}
          </button>
        </section>
        <button v-if="unreadCount > 0" type="button" class="notification-filters__read-all" @click="markAllRead">
          全部标为已读
        </button>
      </aside>

      <section class="notification-list-card">
        <div v-if="loading" class="notification-state">
          <el-skeleton :rows="6" animated />
        </div>
        <div v-else-if="!filtered.length" class="notification-state">
          当前没有符合筛选条件的消息
        </div>
        <div v-else class="notification-list">
          <button
            v-for="notice in filtered"
            :key="notice.id"
            type="button"
            class="notification-item"
            :class="{ 'notification-item--unread': !notice.read }"
            @click="openNotice(notice)"
          >
            <span class="notification-item__icon" :class="`notification-item__icon--${notice.type}`">
              <NavIcon :name="noticeIcon(notice.type)" />
            </span>
            <span class="notification-item__main">
              <span class="notification-item__top">
                <b>{{ typeLabels[notice.type] ?? '通知' }}</b>
                <small>{{ formatDateTime(notice.createdAt) }}</small>
              </span>
              <strong>{{ notice.title }}</strong>
              <span class="notification-item__content">{{ notice.content }}</span>
            </span>
            <i v-if="!notice.read" class="notification-item__dot" aria-label="未读" />
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.notification-page {
  display: flex;
  flex-direction: column;
}

.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: $space-5;
  margin-bottom: $space-6;

  h1 {
    margin: 0;
    color: $text-primary;
    font-size: $font-display;
    font-weight: $font-weight-bold;
    letter-spacing: -.02em;
  }
}

.title-zone .sub {
  margin-top: 6px;
  color: $text-secondary;
  font-size: $font-body-sm;
}

.meta {
  display: flex;
  align-items: center;
  gap: $space-3;
  flex-wrap: wrap;
}

.unread-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: $radius-pill;
  color: $brand-700;
  background: $brand-50;
  font-size: $font-caption;

  b { font-size: $font-body; }
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  color: $text-secondary;
  background: $surface-0;
  font: inherit;
  font-size: $font-caption;
  cursor: pointer;

  &:hover { color: $brand-600; border-color: $brand-300; background: $brand-50; }
  svg { width: 13px; height: 13px; }
}

.refresh-btn.spin svg { animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.notification-page__layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: $space-5;
  align-items: start;
}

.notification-filters {
  position: sticky;
  top: 88px;
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
  box-shadow: $shadow-card;

  h3 {
    margin: 0 0 $space-2;
    color: $text-tertiary;
    font-size: 11px;
    font-weight: $font-weight-semibold;
    letter-spacing: .1em;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  button {
    min-height: 36px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-2;
    padding: 0 $space-3;
    border: 0;
    border-radius: $radius-sm;
    color: $text-secondary;
    background: transparent;
    font: inherit;
    font-size: $font-body-sm;
    text-align: left;
    cursor: pointer;

    &:hover { color: $brand-600; background: $brand-50; }
    &.active { color: $brand-700; background: $brand-50; font-weight: $font-weight-semibold; }
    b { color: $text-tertiary; font-size: $font-caption; }
  }
}

.notification-filters__read-all {
  justify-content: center !important;
  border: 1px solid $brand-200 !important;
  color: $brand-600 !important;
  background: $surface-0 !important;
}

.notification-list-card {
  min-height: 420px;
  overflow: hidden;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
  box-shadow: $shadow-card;
}

.notification-state {
  min-height: 420px;
  display: grid;
  place-items: center;
  padding: $space-6;
  color: $text-tertiary;
  font-size: $font-body-sm;
}

.notification-list {
  display: flex;
  flex-direction: column;
}

.notification-item {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 8px;
  gap: $space-3;
  align-items: start;
  padding: $space-4 $space-5;
  border: 0;
  border-bottom: 1px solid $border-color;
  color: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background .15s, border-color .15s;

  &:last-child { border-bottom: 0; }
  &:hover { background: $surface-50; }
  &:focus-visible { outline: 2px solid $brand-500; outline-offset: -2px; }
}

.notification-item--unread { background: $brand-50; }

.notification-item__icon {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: $radius-md;
  color: $brand-600;
  background: $brand-50;

  svg { width: 20px; height: 20px; }
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
  gap: 3px;
}

.notification-item__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;

  b { color: $brand-600; font-size: 11px; }
  small { color: $text-tertiary; font-size: 11px; }
}

.notification-item strong {
  color: $text-primary;
  font-size: $font-body-sm;
  font-weight: $font-weight-medium;
}

.notification-item__content {
  color: $text-secondary;
  font-size: $font-caption;
  line-height: 1.6;
}

.notification-item__dot {
  width: 8px;
  height: 8px;
  margin-top: 7px;
  border-radius: $radius-pill;
  background: $danger-500;
}

@media (max-width: 1200px) {
  .notification-page__layout { grid-template-columns: 1fr; }
  .notification-filters { position: static; }
}

@media (max-width: 720px) {
  .page-head { align-items: flex-start; flex-direction: column; }
  .notification-item { grid-template-columns: 40px minmax(0, 1fr) 8px; padding: $space-4; }
}
</style>
