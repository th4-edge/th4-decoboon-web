<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { roleLabel } from '@/roles/permission'

interface PmNavItem { key: string; label: string; path: string; mark: string }

const session = useSessionStore()
const route = useRoute()
const router = useRouter()

const shellLabel = computed(() => session.role === 'Boss' ? 'BOSS 项目履约工作台' : '项目经理工作台')
const menus: readonly PmNavItem[] = [
  { key: 'workbench', label: '今日工作', path: '/pm/workbench', mark: '今' },
  { key: 'projects', label: '项目工地', path: '/pm/workbench?surface=projects', mark: '项' },
  { key: 'materials', label: '待我选材', path: '/pm/workbench?surface=materials', mark: '材' },
  { key: 'changes', label: '待我处理增减项', path: '/pm/workbench?surface=changes', mark: '变' },
  { key: 'acceptance', label: '待我验收/整改', path: '/pm/workbench?surface=acceptance', mark: '验' }
]

const activeKey = computed(() => {
  const surface = String(route.query.surface ?? '')
  if (surface === 'materials') return 'materials'
  if (surface === 'changes') return 'changes'
  if (surface === 'acceptance') return 'acceptance'
  if (surface === 'projects') return 'projects'
  return 'workbench'
})

async function logout(): Promise<void> {
  await session.logout()
  ElMessage.success('已退出登录')
  await router.replace({ name: 'login' })
}
</script>

<template>
  <div class="pm-shell">
    <aside class="pm-side">
      <div class="pm-brand">
        <span class="pm-brand__mark" aria-hidden="true">装</span>
        <div><strong>装得清</strong><small>{{ shellLabel }}</small></div>
      </div>
      <div class="pm-user">
        <span class="pm-user__avatar" aria-hidden="true">{{ session.displayName.slice(-1) }}</span>
        <div class="pm-user__meta">
          <strong>{{ session.displayName }}</strong>
          <small>{{ roleLabel(session.role) }} · {{ session.dataScope }}</small>
        </div>
      </div>
      <nav class="pm-nav" aria-label="项目经理导航">
        <button
          v-for="item in menus"
          :key="item.key"
          type="button"
          :class="{ active: activeKey === item.key }"
          @click="router.push(item.path)"
        >
          <span class="pm-nav__mark" aria-hidden="true">{{ item.mark }}</span>
          <span>{{ item.label }}</span>
        </button>
      </nav>
      <button class="pm-logout" type="button" @click="logout">退出登录</button>
    </aside>

    <main class="pm-main">
      <header class="pm-topbar">
        <div>
          <p>{{ session.role === 'Boss' ? 'BOSS · 项目履约主链' : 'PM · 项目履约主链' }}</p>
          <h1>{{ route.meta.title || '项目经理工作台' }}</h1>
        </div>
        <div class="pm-topbar__facts">
          <span>{{ session.companyName }}</span>
          <b>{{ session.employee?.store?.name || '未分门店' }}</b>
        </div>
      </header>
      <section class="pm-content"><router-view /></section>
    </main>
  </div>
</template>

<style scoped lang="scss">
.pm-shell { display: grid; grid-template-columns: $sidebar-width minmax(0, 1fr); min-height: 100vh; background: $bg-page; }
.pm-side { position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; gap: $space-4; padding: $space-4 $space-3; color: $surface-0; background: linear-gradient(180deg, $brand-900 0%, $brand-800 100%); }
.pm-brand { display: flex; align-items: center; gap: $space-3; padding: $space-2 $space-2 $space-4; border-bottom: 1px solid rgba(255,255,255,.12); strong, small { display: block; } strong { font-size: $font-card-title; } small { margin-top: 2px; color: rgba(255,255,255,.62); font-size: $font-caption; } }
.pm-brand__mark { width: 38px; height: 38px; display: grid; place-items: center; border-radius: $radius-sm; background: rgba(255,255,255,.14); font-size: $font-card-title; font-weight: $font-weight-bold; }
.pm-user { display: flex; align-items: center; gap: $space-3; padding: $space-3; border-radius: $radius-md; background: rgba(255,255,255,.07); }
.pm-user__avatar { width: 34px; height: 34px; display: grid; place-items: center; border-radius: $radius-sm; background: $brand-500; font-weight: $font-weight-bold; }
.pm-user__meta { min-width: 0; strong, small { display: block; } strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } small { margin-top: 2px; color: rgba(255,255,255,.62); font-size: $font-caption; } }
.pm-nav { flex: 1; display: flex; flex-direction: column; gap: $space-1; overflow: auto; }
.pm-nav button, .pm-logout { display: flex; align-items: center; gap: $space-3; width: 100%; min-height: 42px; padding: 0 $space-3; color: rgba(255,255,255,.74); background: transparent; border: 0; border-radius: $radius-sm; text-align: left; cursor: pointer; transition: background $transition-fast, color $transition-fast; }
.pm-nav button:hover, .pm-logout:hover { color: $surface-0; background: rgba(255,255,255,.09); }
.pm-nav button.active { color: $surface-0; background: rgba(47,125,90,.46); box-shadow: inset 3px 0 0 $brand-300; font-weight: $font-weight-semibold; }
.pm-nav__mark { width: 24px; height: 24px; display: grid; place-items: center; border-radius: $radius-xs; background: rgba(255,255,255,.09); font-size: $font-caption; }
.pm-logout { justify-content: center; border: 1px solid rgba(255,255,255,.12); }
.pm-main { min-width: 0; display: flex; flex-direction: column; }
.pm-topbar { height: $topbar-height; flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; gap: $space-4; padding: 0 $space-6; background: $surface-0; border-bottom: 1px solid $border-color; h1 { margin: 2px 0 0; font-size: $font-h1; } p { margin: 0; color: $text-tertiary; font-size: $font-caption; letter-spacing: .08em; } }
.pm-topbar__facts { display: flex; align-items: center; gap: $space-3; color: $text-secondary; font-size: $font-body-sm; b { color: $text-primary; } }
.pm-content { flex: 1; min-width: 0; padding: $space-5; }
@media (max-width: 1024px) { .pm-shell { grid-template-columns: 76px minmax(0,1fr); } .pm-brand div, .pm-user__meta, .pm-nav button > span:last-child, .pm-logout { display: none; } .pm-side { align-items: center; } .pm-nav button { justify-content: center; } }
</style>
