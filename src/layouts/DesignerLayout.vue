<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { roleLabel } from '@/roles/permission'

interface DesignerNavItem {
  key: string
  label: string
  path: string
  mark: string
}

const session = useSessionStore()
const route = useRoute()
const router = useRouter()

const isBossShell = computed(() => session.role === 'Boss')
const shellLabel = computed(() => (isBossShell.value ? 'BOSS 设计与报价工作台' : '设计师工作台'))

const menus: readonly DesignerNavItem[] = [
  { key: 'workbench', label: '业务工作台', path: '/designer/workbench', mark: '今' },
  { key: 'quotes', label: '报价工作台', path: '/designer/quotes', mark: '报' },
  { key: 'customers', label: '客户与设计', path: '/designer/customers', mark: '客' },
  { key: 'contract', label: '合同交接', path: '/designer/contract', mark: '签' },
  { key: 'projects', label: '项目工地', path: '/designer/projects', mark: '项' },
  { key: 'catalog', label: '报价项目库', path: '/designer/catalog', mark: '库' },
  { key: 'performance', label: '我的业绩', path: '/designer/performance', mark: '绩' }
]

const activeKey = computed(() => {
  if (route.path.startsWith('/designer/quotes')) return 'quotes'
  if (route.path.startsWith('/designer/customers') || route.path.startsWith('/designer/design')) return 'customers'
  if (route.path.startsWith('/designer/contract')) return 'contract'
  if (route.path.startsWith('/designer/projects')) return 'projects'
  if (route.path.startsWith('/designer/catalog')) return 'catalog'
  if (route.path.startsWith('/designer/performance')) return 'performance'
  return 'workbench'
})

async function logout(): Promise<void> {
  await session.logout()
  ElMessage.success('已退出登录')
  await router.replace({ name: 'login' })
}

function go(path: string): void {
  void router.push(path)
}
</script>

<template>
  <div class="designer-shell">
    <aside class="designer-side">
      <div class="designer-brand">
        <span class="designer-brand__mark" aria-hidden="true">装</span>
        <div>
          <strong>装得清</strong>
          <small>{{ shellLabel }}</small>
        </div>
      </div>

      <div class="designer-user">
        <span class="designer-user__avatar" aria-hidden="true">{{ session.displayName.slice(-1) }}</span>
        <div class="designer-user__meta">
          <strong>{{ session.displayName }}</strong>
          <small>{{ roleLabel(session.role) }} · {{ session.dataScope }}</small>
        </div>
      </div>

      <nav class="designer-nav" aria-label="设计师导航">
        <button
          v-for="item in menus"
          :key="item.key"
          type="button"
          :class="{ active: activeKey === item.key }"
          @click="go(item.path)"
        >
          <span class="designer-nav__mark" aria-hidden="true">{{ item.mark }}</span>
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <button class="designer-logout" type="button" @click="logout">退出登录</button>
    </aside>

    <main class="designer-main">
      <header class="designer-topbar">
        <div>
          <p class="designer-topbar__eyebrow">{{ isBossShell ? 'BOSS · 设计与报价主链' : 'DESIGNER · 方案报价主链' }}</p>
          <h1>{{ route.meta.title || '设计师工作台' }}</h1>
        </div>
        <div class="designer-topbar__facts">
          <span>{{ session.companyName }}</span>
          <b>{{ session.employee?.store?.name || '未分门店' }}</b>
        </div>
      </header>

      <section class="designer-content">
        <router-view />
      </section>
    </main>
  </div>
</template>

<style scoped lang="scss">
.designer-shell {
  display: grid;
  grid-template-columns: $sidebar-width minmax(0, 1fr);
  min-height: 100vh;
  background: $bg-page;
}

.designer-side {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: $space-4 $space-3;
  color: $surface-0;
  background: linear-gradient(180deg, $brand-900 0%, $brand-800 100%);
}

.designer-brand {
  display: flex;
  align-items: center;
  gap: $space-3;
  padding: $space-2 $space-2 $space-4;
  border-bottom: 1px solid rgba(255, 255, 255, .12);

  strong,
  small { display: block; }
  strong { font-size: $font-card-title; }
  small { margin-top: 2px; color: rgba(255, 255, 255, .62); font-size: $font-caption; }
}

.designer-brand__mark {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: $radius-sm;
  background: rgba(255, 255, 255, .14);
  font-size: $font-card-title;
  font-weight: $font-weight-bold;
}

.designer-user {
  display: flex;
  align-items: center;
  gap: $space-3;
  padding: $space-3;
  border-radius: $radius-md;
  background: rgba(255, 255, 255, .07);
}

.designer-user__avatar {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: $radius-sm;
  background: $brand-500;
  font-weight: $font-weight-bold;
}

.designer-user__meta {
  min-width: 0;

  strong,
  small { display: block; }
  strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  small { margin-top: 2px; color: rgba(255, 255, 255, .62); font-size: $font-caption; }
}

.designer-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: $space-1;
  overflow: auto;
}

.designer-nav button,
.designer-logout {
  display: flex;
  align-items: center;
  gap: $space-3;
  width: 100%;
  min-height: 42px;
  padding: 0 $space-3;
  color: rgba(255, 255, 255, .74);
  background: transparent;
  border: 0;
  border-radius: $radius-sm;
  text-align: left;
  cursor: pointer;
  transition: background $transition-fast, color $transition-fast;
}

.designer-nav button:hover,
.designer-logout:hover {
  color: $surface-0;
  background: rgba(255, 255, 255, .09);
}

.designer-nav button.active {
  color: $surface-0;
  background: rgba(47, 125, 90, .46);
  box-shadow: inset 3px 0 0 $brand-300;
  font-weight: $font-weight-semibold;
}

.designer-nav__mark {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: $radius-xs;
  background: rgba(255, 255, 255, .09);
  font-size: $font-caption;
}

.designer-logout {
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, .12);
}

.designer-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.designer-topbar {
  height: $topbar-height;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-4;
  padding: 0 $space-6;
  background: $surface-0;
  border-bottom: 1px solid $border-color;

  h1 {
    margin: 2px 0 0;
    font-size: $font-h1;
  }
}

.designer-topbar__eyebrow {
  margin: 0;
  color: $text-tertiary;
  font-size: $font-caption;
  letter-spacing: .08em;
}

.designer-topbar__facts {
  text-align: right;
  color: $text-secondary;
  font-size: $font-body-sm;

  span,
  b { display: block; }
  b { margin-top: 2px; color: $text-primary; }
}

.designer-content {
  flex: 1;
  min-height: 0;
  overflow: auto;

  :deep(.qw) {
    height: calc(100vh - #{$topbar-height});
  }
}

@media (max-width: 1024px) {
  .designer-shell { grid-template-columns: $sidebar-collapsed-width minmax(0, 1fr); }
  .designer-brand div,
  .designer-user__meta,
  .designer-nav button > span:last-child { display: none; }
  .designer-brand,
  .designer-user,
  .designer-nav button { justify-content: center; }
  .designer-nav__mark { background: transparent; }
}
</style>
