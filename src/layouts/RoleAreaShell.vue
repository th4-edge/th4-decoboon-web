<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NavIcon from '@/components/shell/NavIcon.vue'
import RoleSideNav from '@/components/shell/RoleSideNav.vue'
import { collabApi } from '@/domains/collab/api'
import { useWorkbenchShellStore } from '@/stores/workbench'
import { useSessionStore } from '@/stores/session'
import { workbenchConfigOf } from '@/roles/workbenchConfig'

const session = useSessionStore()
const route = useRoute()
const router = useRouter()
const shellStore = useWorkbenchShellStore()

const mobileNavOpen = ref(false)
const search = ref('')
const unreadCount = ref(0)

const config = computed(() => workbenchConfigOf(session.role))
const pageTitle = computed(() => String(route.meta.title ?? config.value.workbenchTitle))
function openSearch(): void {
  ElMessage.info('全局搜索将在后续批次接入')
}

async function loadUnread(): Promise<void> {
  try {
    unreadCount.value = await collabApi.unread()
  } catch {
    // 壳层未登录或通知接口失败时保留 0，不阻断页面。
  }
}

function openNotifications(): void {
  void router.push('/messages')
}

async function handleCommand(command: string): Promise<void> {
  if (command === 'profile') {
    await router.push('/account/profile')
    return
  }
  if (command === 'company') {
    await router.push('/account/company')
    return
  }
  if (command === 'payslips') {
    await router.push('/account/payslips')
    return
  }
  if (command !== 'logout') return
  await session.logout()
  shellStore.clear()
  ElMessage.success('已退出登录')
  await router.replace({ name: 'login' })
}

async function logout(): Promise<void> {
  await handleCommand('logout')
}

onMounted(() => {
  void loadUnread()
})
</script>

<template>
  <div class="role-frame">
    <aside class="role-frame__side">
      <div class="role-frame__brand">
        <span class="role-frame__brand-mark">装</span>
        <div>
          <strong>装得清</strong>
          <small>{{ config.shellTitle }}</small>
        </div>
      </div>


      <div class="role-frame__nav">
        <RoleSideNav :config="config" :badges="shellStore.badges" />
      </div>

      <button class="role-frame__logout" type="button" @click="logout">
        <NavIcon name="fallback" />
        退出登录
      </button>
    </aside>

    <div class="role-frame__body">
      <header class="role-frame__topbar">
        <div class="role-frame__topbar-left">
          <button class="role-frame__menu" type="button" aria-label="打开导航" @click="mobileNavOpen = true">
            <NavIcon name="today.mainline" />
          </button>
          <div class="role-frame__crumbs">
            <b>{{ config.shellTitle }}</b>
            <span class="sep">/</span>
            <span>{{ pageTitle }}</span>
          </div>
        </div>

        <label class="role-frame__search">
          <NavIcon name="customer.followup" />
          <input v-model="search" type="search" placeholder="搜索客户、项目、报价…" @keydown.enter="openSearch" />
          <kbd>⌘K</kbd>
        </label>

        <div class="role-frame__topbar-right">
          <button class="role-frame__icon-btn" type="button" aria-label="通知" @click="openNotifications">
            <NavIcon name="bell" />
            <i v-if="unreadCount > 0" aria-hidden="true" />
          </button>
          <span class="role-frame__role-tag">{{ config.roleLabel }} · {{ session.dataScopeName }}</span>
          <el-dropdown trigger="click" @command="handleCommand">
            <button class="role-frame__user" type="button">
              <span class="role-frame__avatar">{{ session.displayName.slice(-1) }}</span>
              <span class="role-frame__user-copy">
                <strong>{{ session.displayName }}</strong>
                <small>{{ config.roleLabel }} · {{ session.dataScopeName }}</small>
              </span>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">个人信息</el-dropdown-item>
                <el-dropdown-item command="company">企业信息</el-dropdown-item>
                <el-dropdown-item command="payslips">我的工资条</el-dropdown-item>
                <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main class="role-frame__main">
        <router-view />
      </main>
    </div>

    <el-drawer v-model="mobileNavOpen" direction="ltr" size="236px" :with-header="false" class="role-frame__drawer">
      <div class="role-frame__drawer-inner">
        <div class="role-frame__brand">
          <span class="role-frame__brand-mark">装</span>
          <div>
            <strong>装得清</strong>
            <small>{{ config.shellTitle }}</small>
          </div>
        </div>
        <div class="role-frame__nav">
          <RoleSideNav :config="config" :badges="shellStore.badges" />
        </div>
        <button class="role-frame__logout" type="button" @click="logout">
          <NavIcon name="fallback" />
          退出登录
        </button>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.role-frame {
  display: flex;
  min-height: 100vh;
  background: $bg-page;
}

.role-frame__side {
  position: sticky;
  top: 0;
  z-index: 50;
  width: $sidebar-width;
  height: 100vh;
  flex: 0 0 $sidebar-width;
  display: flex;
  flex-direction: column;
  min-height: 0;
  color: rgba(255, 255, 255, .72);
  background: $ink-950;
}

.role-frame__brand {
  display: flex;
  align-items: center;
  gap: $space-3;
  padding: 20px 20px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, .07);

  strong,
  small { display: block; }
  strong { color: $surface-0; font-size: $font-body; letter-spacing: .01em; }
  small { margin-top: 1px; color: rgba(255, 255, 255, .56); font-size: 11px; }
}

.role-frame__brand-mark {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: $radius-md;
  color: $surface-0;
  background: $brand-500;
  font-size: $font-card-title;
  font-weight: $font-weight-bold;
}

.role-frame__scope {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: $space-4 $space-3 0;
  padding: $space-3;
  border: 1px solid rgba(255, 255, 255, .09);
  border-radius: $radius-md;
  background: rgba(255, 255, 255, .05);

  span,
  small { color: rgba(255, 255, 255, .5); font-size: 11px; }
  strong {
    overflow: hidden;
    color: $surface-0;
    font-size: $font-caption;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.role-frame__nav {
  flex: 1;
  min-height: 0;
  margin-top: $space-3;
  padding: 0 $space-3 $space-4;
  overflow-y: auto;
}

.role-frame__logout {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  padding: 13px 20px;
  border-left: 0;
  border-right: 0;
  border-bottom: 0;
  border-top: 1px solid rgba(255, 255, 255, .07);
  color: rgba(255, 255, 255, .5);
  background: transparent;
  font: inherit;
  font-size: $font-body-sm;
  text-align: left;

  &:hover { color: $surface-0; }
}

.role-frame__body {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.role-frame__topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  height: $topbar-height;
  flex: 0 0 $topbar-height;
  display: flex;
  align-items: center;
  gap: $space-5;
  padding: 0 24px;
  border-bottom: 1px solid $border-color;
  background: rgba(255, 255, 255, .94);
  backdrop-filter: blur(10px);
}

.role-frame__topbar-left {
  display: flex;
  align-items: center;
  gap: $space-3;
  min-width: 0;
}

.role-frame__menu {
  display: none;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 0;
  border-radius: $radius-sm;
  color: $text-secondary;
  background: transparent;
  font: inherit;

  &:hover { background: $surface-100; }
}

.role-frame__crumbs {
  display: flex;
  align-items: center;
  gap: $space-2;
  min-width: 0;
  color: $text-tertiary;
  font-size: $font-caption;
  white-space: nowrap;

  b {
    color: $text-primary;
    font-weight: $font-weight-medium;
  }

  .sep { color: $text-tertiary; }
}

.role-frame__search {
  display: flex;
  align-items: center;
  gap: $space-2;
  width: min(340px, 30vw);
  height: 36px;
  padding: 0 $space-3;
  border: 1px solid transparent;
  border-radius: $radius-sm;
  color: $text-tertiary;
  background: $surface-50;
  transition: background $transition-fast, border-color $transition-fast, box-shadow $transition-fast;

  &:focus-within {
    color: $text-secondary;
    background: $surface-0;
    border-color: $brand-300;
    box-shadow: 0 0 0 3px $brand-50;
  }

  input {
    min-width: 0;
    flex: 1;
    border: 0;
    outline: 0;
    color: $text-primary;
    background: transparent;
    font: inherit;
  }

  kbd {
    padding: 1px 6px;
    border: 1px solid $border-color;
    border-radius: $radius-xs;
    color: $text-tertiary;
    background: $surface-0;
    font-size: 11px;
  }
}

.role-frame__topbar-right {
  display: flex;
  align-items: center;
  gap: $space-3;
  margin-left: auto;
}

.role-frame__icon-btn {
  position: relative;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: $radius-sm;
  color: $text-secondary;
  background: transparent;
  font: inherit;

  &:hover { color: $text-primary; background: $surface-50; }

  i {
    position: absolute;
    top: 7px;
    right: 8px;
    width: 7px;
    height: 7px;
    border: 2px solid $surface-0;
    border-radius: 50%;
    background: $danger-500;
  }
}

.role-frame__role-tag {
  padding: 3px 8px;
  border-radius: $radius-pill;
  color: $brand-700;
  background: $brand-50;
  font-size: 11px;
  white-space: nowrap;
}

.role-frame__user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px 4px 4px;
  border: 0;
  border-radius: $radius-md;
  background: transparent;
  font: inherit;

  &:hover { background: $surface-50; }
}

.role-frame__avatar {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: $radius-md;
  color: $surface-0;
  background: linear-gradient(135deg, $brand-500, $brand-700);
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
}

.role-frame__user-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
  text-align: left;

  strong { color: $text-primary; font-size: $font-caption; line-height: 1.3; }
  small { color: $text-secondary; font-size: 11px; line-height: 1.3; }
}

.role-frame__main {
  flex: 1;
  min-width: 0;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: $space-8 $space-8 56px;
}

.role-frame__drawer-inner {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  color: rgba(255, 255, 255, .72);
  background: $ink-950;
}




@media (max-width: 1024px) {
  .role-frame__side { display: none; }
  .role-frame__menu { display: grid; }
  .role-frame__search { display: none; }
}

@media (max-width: 720px) {
  .role-frame__topbar { padding: 0 $space-4; gap: $space-3; }
  .role-frame__role-tag { display: none; }
  .role-frame__main { padding: 20px 16px 40px; }
}
</style>
