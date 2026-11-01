<!--
  停用（2026-10-09）：本文件已无任何路由/组件引用，属死代码。
  角色壳层实际使用 `src/layouts/RoleAreaShell.vue` + `src/components/shell/RoleSideNav.vue`。
  它依赖的注册表派生导航（`sidebarNavForRole`）与当前生效的 `roles/workbenchConfig.ts` 是两套菜单来源，
  治理口径见 `docs/product/designer/WEB-DESIGNER-MENU-INFORMATION-ARCHITECTURE.md`。
  保留于 `_停用/` 以便追溯，不再参与构建。
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { isManagementShell, roleLabel } from '@/roles/permission'
import { sidebarNavForRole, type SidebarNavGroup } from '@/domains/workbench/navigation'

const session = useSessionStore()
const route = useRoute()
const router = useRouter()

const shellName = computed(() => (isManagementShell(session.role) ? '经营管控中心' : '岗位工作台'))

/**
 * 侧栏导航只消费工作台注册表（DEC-034 / BR-030）。
 * 404 兜底路由与当前角色无权进入的路由不得出现在侧栏，避免「可见但点了被拒」。
 */
function isUsable(path: string): boolean {
  const resolved = router.resolve(path)
  if (!resolved.matched.length) return false
  if (resolved.matched.some((record) => record.path.includes(':pathMatch'))) return false
  const required = resolved.meta?.roles as string[] | undefined
  return !required || (!!session.role && required.includes(session.role))
}

const nav = computed<SidebarNavGroup[]>(() =>
  sidebarNavForRole(session.role)
    .map((group) => ({ ...group, items: group.items.filter((item) => isUsable(item.path)) }))
    .filter((group) => group.items.length > 0)
)

function firstItem(group: SidebarNavGroup) {
  return group.items[0]
}

function isActive(path: string): boolean {
  const target = path.split('?')[0]
  if (target === '/workbench') return route.path === '/workbench'
  return route.path === target || route.path.startsWith(`${target}/`)
}

async function handleLogout(): Promise<void> {
  await session.logout()
  ElMessage.success('已退出登录')
  await router.replace({ name: 'login' })
}
</script>

<template>
  <div class="shell">
    <aside class="shell__side">
      <div class="brand">
        <div class="brand__mark" aria-hidden="true">装</div>
        <div class="brand__text">
          <strong>装得清</strong>
          <span>{{ shellName }}</span>
        </div>
      </div>

      <div class="scope">
        <span class="scope__label">当前角色 · {{ roleLabel(session.role) }}</span>
        <strong class="scope__value">{{ session.companyName }} · {{ session.store?.name ?? '—' }}</strong>
        <span class="scope__scope">{{ session.dataScope }} 数据范围</span>
      </div>

      <nav class="nav" aria-label="工作台导航">
        <template v-for="group in nav" :key="group.key">
          <router-link
            v-if="group.items.length === 1"
            class="nav__item"
            :class="{ 'nav__item--active': isActive(firstItem(group).path) }"
            :to="firstItem(group).path"
          >
            <span class="nav__label">{{ firstItem(group).label }}</span>
          </router-link>
          <template v-else>
            <p class="nav__group">{{ group.label }}</p>
            <router-link
              v-for="item in group.items"
              :key="item.key"
              class="nav__item"
              :class="{ 'nav__item--active': isActive(item.path) }"
              :to="item.path"
            >
              <span class="nav__label">{{ item.label }}</span>
            </router-link>
          </template>
        </template>
      </nav>
    </aside>

    <div class="shell__body">
      <header class="topbar">
        <div class="topbar__crumbs">
          <router-link class="topbar__link" to="/workbench">工作台</router-link>
          <span class="topbar__sep">/</span>
          <span>{{ shellName }}</span>
        </div>
        <div class="topbar__identity">
          <el-tag size="small" type="info" effect="plain">{{ session.dataScope }} · {{ session.companyName }}</el-tag>
          <el-avatar :size="30">{{ session.displayName.slice(0, 1) }}</el-avatar>
          <div class="topbar__who">
            <strong>{{ session.displayName }}</strong>
            <span>{{ roleLabel(session.role) }}</span>
          </div>
          <el-button text @click="handleLogout">退出登录</el-button>
        </div>
      </header>

      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped lang="scss">
.shell {
  display: flex;
  min-height: 100vh;
  background: $bg-page;
}

.shell__side {
  width: $sidebar-width;
  flex: 0 0 $sidebar-width;
  display: flex;
  flex-direction: column;
  gap: $space-5;
  padding: $space-5 $space-4;
  background: $surface-0;
  border-right: 1px solid $border-color;
}

.brand {
  display: flex;
  align-items: center;
  gap: $space-3;
}

.brand__mark {
  width: 40px;
  height: 40px;
  border-radius: $radius-md;
  background: $brand-500;
  color: $surface-0;
  display: grid;
  place-items: center;
  font-size: $font-title;
  font-weight: $font-weight-bold;
}

.brand__text {
  display: flex;
  flex-direction: column;
  line-height: 1.35;

  strong { font-size: $font-card-title; }
  span { font-size: $font-caption; color: $text-secondary; }
}

.scope {
  display: flex;
  flex-direction: column;
  gap: $space-1;
  padding: $space-3;
  border-radius: $radius-md;
  background: $brand-50;

  &__label { font-size: $font-caption; color: $text-secondary; }
  &__value { font-size: $font-body-sm; }
  &__scope { font-size: $font-caption; color: $brand-600; }
}

.nav {
  display: flex;
  flex-direction: column;
  gap: $space-1;
}

.nav__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $space-3;
  border-radius: $radius-sm;
  color: $text-primary;
  text-decoration: none;
  font-size: $font-body-sm;
  transition: background $transition-fast;

  &:hover { background: $bg-hover; }
}

.nav__item--active {
  background: $bg-active;
  color: $brand-700;
  font-weight: $font-weight-medium;
}

.nav__group {
  margin: $space-3 0 0;
  padding: 0 $space-3;
  font-size: $font-caption;
  font-weight: $font-weight-medium;
  color: $text-tertiary;
  letter-spacing: .04em;
}

.shell__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.topbar {
  height: $topbar-height;
  flex: 0 0 $topbar-height;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 $space-6;
  background: $surface-0;
  border-bottom: 1px solid $border-color;
}

.topbar__crumbs {
  display: flex;
  align-items: center;
  gap: $space-2;
  font-size: $font-body-sm;
  color: $text-secondary;
}

.topbar__link { color: $text-secondary; text-decoration: none; }
.topbar__sep { color: $text-tertiary; }

.topbar__identity {
  display: flex;
  align-items: center;
  gap: $space-3;
}

.topbar__who {
  display: flex;
  flex-direction: column;
  line-height: 1.3;

  strong { font-size: $font-body-sm; }
  span { font-size: $font-caption; color: $text-secondary; }
}

.content {
  flex: 1;
  min-width: 0;
  padding: $space-6;
}
</style>
