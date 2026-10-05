<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { isManagementShell, navFor, roleLabel } from '@/roles/permission'

const session = useSessionStore()
const route = useRoute()
const router = useRouter()

const nav = computed(() => navFor(session.role))
const shellName = computed(() => (isManagementShell(session.role) ? '经营管控中心' : '岗位工作台'))
const activeMenu = computed(() => route.fullPath)

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
        <router-link
          v-for="item in nav"
          :key="item.key"
          class="nav__item"
          :class="{ 'nav__item--active': activeMenu === item.path }"
          :to="item.path"
        >
          <span class="nav__label">{{ item.label }}</span>
          <span v-if="item.planned" class="nav__badge">建设中</span>
        </router-link>
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

.nav__badge {
  font-size: $font-caption;
  color: $text-tertiary;
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
