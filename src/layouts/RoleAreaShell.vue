<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NavIcon from '@/components/shell/NavIcon.vue'
import StoreScopePicker from '@/components/StoreScopePicker.vue'
import RoleSideNav from '@/components/shell/RoleSideNav.vue'
import { collabApi } from '@/domains/collab/api'
import { useWorkbenchShellStore } from '@/stores/workbench'
import { useSessionStore } from '@/stores/session'
import { workbenchConfigOf } from '@/roles/workbenchConfig'
import { runtime } from '@/core/runtime'
import CompanyBrandMark from '@/components/CompanyBrandMark.vue'

const session = useSessionStore()
const route = useRoute()
const router = useRouter()
const shellStore = useWorkbenchShellStore()

const mobileNavOpen = ref(false)
const unreadCount = ref(0)
const currentYear = new Date().getFullYear()

/** P1-a：已接入门店维度的财务页（其余财务页按数据范围取数，需在界面诚实标注，避免误读为已按门店收窄）。 */
const FINANCE_STORE_SCOPE_PATHS = [
  '/finance/workbench', '/finance/receivables', '/finance/receipts', '/finance/payables',
  '/finance/payments', '/finance/expenses', '/finance/ledger', '/finance/projects',
  // P1-a2：以下 6 页已补后端门店入参并接线（DEC-065 / DEC-070）
  '/finance/refunds', '/finance/employee-salaries', '/finance/compensation-schemes', '/finance/employee-commissions',
  '/finance/partners', '/finance/vouchers', '/finance/store-payroll', '/finance/design-reviews',
  '/finance/material-ordering', '/finance/material-settlement', '/finance/commission-adjustments', '/finance/payroll'
]
/** 企业级页面：与门店维度**无关**（凭证模板是公司级单据版式配置），不是「未接线」，不显示收窄提示。 */
const FINANCE_ENTERPRISE_PATHS = ['/finance/voucher-templates']
const showFinanceScopeNote = computed(() => route.path.startsWith('/finance')
  && !FINANCE_STORE_SCOPE_PATHS.some((path) => route.path === path || route.path.startsWith(`${path}/`))
  && !FINANCE_ENTERPRISE_PATHS.includes(route.path))
const showFinanceEnterpriseNote = computed(() => FINANCE_ENTERPRISE_PATHS.includes(route.path))

const config = computed(() => workbenchConfigOf(session.role))
const pageTitle = computed(() => String(route.meta.title ?? config.value.workbenchTitle))

async function loadUnread(): Promise<void> {
  try {
    unreadCount.value = await collabApi.unread()
  } catch {
    // 通知接口失败不阻断页面。
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
  if (command === 'attendance') {
    await router.push('/account/attendance')
    return
  }
  if (command === 'commissions') {
    await router.push('/account/commissions')
    return
  }
  if (command === 'messages') {
    openNotifications()
    return
  }
  if (command !== 'logout') return
  await session.logout()
  shellStore.clear()
  ElMessage.success('已退出登录')
  await router.replace({ name: 'login' })
}

watch(() => route.path, () => {
  mobileNavOpen.value = false
  window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }))
})

onMounted(() => {
  void loadUnread()
})
</script>

<template>
  <div class="role-frame">
    <aside class="role-frame__side">
      <div class="role-frame__brand">
        <CompanyBrandMark :name="session.companyName" :logo="session.company?.logo || ''" :color="session.company?.color || ''" :size="36" />
        <div class="role-frame__brand-copy">
          <strong>{{ session.companyName }}</strong>
          <small>{{ config.shellTitle }}</small>
        </div>
      </div>

      <div class="role-frame__nav">
        <RoleSideNav :config="config" :badges="shellStore.badges" />
      </div>
    </aside>

    <div class="role-frame__body">
      <header class="role-frame__topbar">
        <div class="role-frame__topbar-left">
          <button class="role-frame__menu" type="button" aria-label="打开导航" @click="mobileNavOpen = true">
            <NavIcon name="today.mainline" />
          </button>
          <nav class="role-frame__crumbs" aria-label="面包屑">
            <router-link :to="config.homePath">{{ config.shellTitle }}</router-link>
            <span class="sep">/</span>
            <span aria-current="page">{{ pageTitle }}</span>
          </nav>
        </div>

        <div class="role-frame__topbar-right">
          <StoreScopePicker />
          <small v-if="showFinanceScopeNote" class="role-frame__scope-note">本页按数据范围取数，暂不随门店维度收窄</small>
          <small v-else-if="showFinanceEnterpriseNote" class="role-frame__scope-note">本页为全局配置，与门店维度无关</small>
          <button
            class="role-frame__icon-btn"
            type="button"
            :aria-label="unreadCount > 0 ? `通知，${unreadCount} 条未读` : '通知'"
            @click="openNotifications"
          >
            <NavIcon name="bell" />
            <span v-if="unreadCount > 0" class="role-frame__notice-badge" aria-hidden="true">
              {{ unreadCount > 99 ? '99+' : unreadCount }}
            </span>
          </button>
          <el-dropdown
            trigger="click"
            placement="bottom-end"
            popper-class="role-frame__account-popover"
            @command="handleCommand"
          >
            <button class="role-frame__user" type="button" aria-label="打开账号菜单" aria-haspopup="menu">
              <span class="role-frame__avatar">{{ session.displayName.slice(-1) }}</span>
              <span class="role-frame__user-copy">
                <strong>{{ session.displayName }}</strong>
                <small>{{ config.roleLabel }} · {{ session.dataScopeName }}</small>
              </span>
              <NavIcon class="role-frame__user-chevron" name="chevron-down" />
            </button>
            <template #dropdown>
              <div class="role-frame__account-menu">
                <div class="role-frame__account-summary">
                  <span class="role-frame__avatar role-frame__avatar--large">{{ session.displayName.slice(-1) }}</span>
                  <span>
                    <strong>{{ session.displayName }}</strong>
                    <small>{{ session.companyName }}</small>
                    <em>{{ config.roleLabel }} · {{ session.dataScopeName }}</em>
                  </span>
                </div>
                <el-dropdown-menu>
                  <el-dropdown-item command="profile">
                    <span class="role-frame__account-item"><NavIcon name="user" /><span>个人信息</span></span>
                  </el-dropdown-item>
                  <el-dropdown-item command="company">
                    <span class="role-frame__account-item"><NavIcon name="building" /><span>企业信息</span></span>
                  </el-dropdown-item>
                  <el-dropdown-item command="payslips">
                    <span class="role-frame__account-item"><NavIcon name="wallet" /><span>我的工资条</span></span>
                  </el-dropdown-item>
                  <el-dropdown-item command="attendance">
                    <span class="role-frame__account-item"><NavIcon name="today.mainline" /><span>我的考勤</span></span>
                  </el-dropdown-item>
                  <el-dropdown-item command="commissions">
                    <span class="role-frame__account-item"><NavIcon name="chart" /><span>我的提成</span></span>
                  </el-dropdown-item>
                  <el-dropdown-item command="messages">
                    <span class="role-frame__account-item">
                      <NavIcon name="mail" />
                      <span>消息通知</span>
                      <b v-if="unreadCount > 0">{{ unreadCount > 99 ? '99+' : unreadCount }}</b>
                    </span>
                  </el-dropdown-item>
                  <el-dropdown-item divided command="logout">
                    <span class="role-frame__account-item role-frame__account-item--danger"><NavIcon name="logout" /><span>退出登录</span></span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </div>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main class="role-frame__main">
        <div class="role-frame__container">
          <div class="role-frame__page-stage">
            <router-view v-slot="{ Component }">
              <transition name="page-shift" mode="out-in">
                <component :is="Component" :key="route.path" />
              </transition>
            </router-view>
          </div>
        </div>
      </main>

      <footer class="role-frame__footer">
        <div class="role-frame__container role-frame__footer-inner">
          <span>© {{ currentYear }} {{ session.companyName }}</span>
          <span :title="`build ${runtime.buildId}`">版本 {{ runtime.version }}</span>
        </div>
      </footer>
    </div>

    <el-drawer v-model="mobileNavOpen" direction="ltr" size="280px" :with-header="false" class="role-frame__drawer">
      <div class="role-frame__drawer-inner">
        <div class="role-frame__drawer-head">
          <div class="role-frame__brand">
            <CompanyBrandMark :name="session.companyName" :logo="session.company?.logo || ''" :color="session.company?.color || ''" :size="36" />
            <div class="role-frame__brand-copy">
              <strong>{{ session.companyName }}</strong>
              <small>{{ config.shellTitle }}</small>
            </div>
          </div>
          <button class="role-frame__drawer-close" type="button" @click="mobileNavOpen = false">关闭</button>
        </div>
        <div class="role-frame__nav">
          <RoleSideNav :config="config" :badges="shellStore.badges" />
        </div>
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
  border-right: 1px solid $line-200;
  background: $surface-0;
}

.role-frame__brand {
  display: flex;
  align-items: center;
  gap: $space-3;
  min-width: 0;
  padding: 18px 18px 16px;
}

.role-frame__brand-copy {
  display: grid;
  min-width: 0;
  gap: 2px;

  strong {
    overflow: hidden;
    color: $text-primary;
    font-size: $font-body;
    font-weight: $font-weight-medium;
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    overflow: hidden;
    color: $text-secondary;
    font-size: $font-caption;
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.role-frame__side > .role-frame__brand {
  border-bottom: 1px solid $line-200;
}

.role-frame__nav {
  flex: 1;
  min-height: 0;
  padding: $space-3 10px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: $line-200 transparent;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { border-radius: $radius-pill; background: $line-200; }
}

.role-frame__body {
  min-width: 0;
  min-height: 100vh;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.role-frame__topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  min-height: $topbar-height;
  flex: 0 0 $topbar-height;
  display: flex;
  align-items: center;
  gap: $space-5;
  padding: 0 $space-8;
  border-bottom: 1px solid $line-200;
  background: rgba(255, 255, 255, .96);
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
  cursor: pointer;

  &:hover { color: $text-primary; background: $surface-100; }
  &:focus-visible { outline: 2px solid var(--zdq-brand-a46, #{$brand-300}); outline-offset: 2px; }
}

.role-frame__crumbs {
  display: flex;
  align-items: center;
  gap: $space-2;
  min-width: 0;
  overflow: hidden;
  color: $text-tertiary;
  font-size: $font-body-sm;
  white-space: nowrap;

  a {
    color: $text-secondary;
    text-decoration: none;

    &:hover { color: $brand-700; }
    &:focus-visible { outline: 2px solid var(--zdq-brand-a46, #{$brand-300}); outline-offset: 2px; }
  }

  span:last-child {
    overflow: hidden;
    color: $text-primary;
    font-weight: $font-weight-medium;
    text-overflow: ellipsis;
  }

  .sep { color: $line-200; }
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
  cursor: pointer;

  &:hover { color: $text-primary; background: $surface-100; }
  &:focus-visible { outline: 2px solid var(--zdq-brand-a46, #{$brand-300}); outline-offset: 2px; }

}

.role-frame__notice-badge {
  position: absolute;
  top: 3px;
  right: 2px;
  min-width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  padding: 0 4px;
  border: 2px solid $surface-0;
  border-radius: $radius-pill;
  color: $surface-0;
  background: $danger-500;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.role-frame__account-menu {
  width: 248px;
  overflow: hidden;
}

.role-frame__account-summary {
  display: flex;
  align-items: flex-start;
  gap: $space-3;
  padding: $space-4;
  border-bottom: 1px solid $line-200;
  background: $surface-50;

  > span:last-child {
    min-width: 0;
    display: grid;
    gap: 2px;
  }

  strong,
  small,
  em {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong { color: $text-primary; font-size: $font-body-sm; font-weight: $font-weight-semibold; }
  small { color: $text-secondary; font-size: $font-caption; }
  em { color: $text-tertiary; font-size: $font-caption; font-style: normal; }
}

.role-frame__avatar--large {
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
}

.role-frame__account-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: $space-3;
  color: $text-secondary;
  font-size: $font-body-sm;

  :deep(.nav-icon) { width: 16px; height: 16px; color: $text-tertiary; }

  b {
    min-width: 20px;
    margin-left: auto;
    padding: 1px 6px;
    border-radius: $radius-pill;
    color: $brand-700;
    background: $brand-50;
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
}

.role-frame__account-item--danger {
  color: $danger-500;
  :deep(.nav-icon) { color: $danger-500; }
}

.role-frame__user {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 3px 8px 3px 4px;
  border: 0;
  border-radius: $radius-md;
  background: transparent;
  font: inherit;
  cursor: pointer;

  transition: color $transition-fast, background $transition-fast;

  &:hover { background: $surface-100; }
  &:focus-visible { outline: 2px solid var(--zdq-brand-a46, #{$brand-300}); outline-offset: 2px; }
}

.role-frame__avatar {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: $radius-md;
  color: var(--zdq-brand-on-primary, $surface-0);
  background: $brand-500;
  font-size: $font-caption;
  font-weight: $font-weight-medium;
}

.role-frame__user-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
  text-align: left;

  strong { color: $text-primary; font-size: $font-caption; font-weight: $font-weight-medium; line-height: 1.35; }
  small { color: $text-secondary; font-size: $font-micro; line-height: 1.35; }
}

.role-frame__user-chevron {
  width: 14px;
  height: 14px;
  color: $text-tertiary;
}

.role-frame__main {
  flex: 1;
  min-width: 0;
  width: 100%;
}

.role-frame__container {
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  padding-right: $space-8;
  padding-left: $space-8;
}

.role-frame__main > .role-frame__container {
  padding-top: $space-6;
  padding-bottom: $space-10;
}

.role-frame__page-stage {
  width: 100%;
  min-height: calc(100vh - #{$topbar-height} - 96px);
}

.role-frame__footer {
  margin-top: auto;
  border-top: 1px solid $line-200;
  background: $surface-0;
}

.role-frame__footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-4;
  min-height: 56px;
  color: $text-tertiary;
  font-size: $font-caption;
}

.role-frame__drawer-inner {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: $surface-0;
}

.role-frame__drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
  border-bottom: 1px solid $line-200;
}

.role-frame__drawer-head .role-frame__brand {
  flex: 1;
  border-bottom: 0;
}

.role-frame__drawer-close {
  margin-right: $space-3;
  padding: 6px 8px;
  border: 0;
  border-radius: $radius-sm;
  color: $text-secondary;
  background: transparent;
  font: inherit;
  font-size: $font-caption;
  cursor: pointer;

  &:hover { color: $text-primary; background: $surface-100; }
}

@media (max-width: 1024px) {
  .role-frame__side { display: none; }
  .role-frame__menu { display: grid; }
}

@media (max-width: 720px) {
  .role-frame__topbar { padding: 0 $space-4; gap: $space-3; }
  .role-frame__user-copy,
  .role-frame__user-chevron { display: none; }
  .role-frame__container { padding-right: $space-4; padding-left: $space-4; }
  .role-frame__main > .role-frame__container { padding-top: $space-5; padding-bottom: $space-8; }
  .role-frame__footer-inner { min-height: 52px; }
}
</style>

<style scoped>
.role-frame__scope-note {
  max-width: 220px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 1.3;
}
</style>


<style>
.role-frame__account-popover.el-popper {
  min-width: 248px;
  padding: 0;
  overflow: hidden;
  border-color: var(--th4-border-color);
  border-radius: 12px;
  box-shadow: 0 18px 40px rgba(26, 26, 23, .16), 0 4px 12px rgba(26, 26, 23, .06);
}

.role-frame__account-popover .el-dropdown-menu {
  padding: 6px;
  background: transparent;
}

.role-frame__account-popover .el-dropdown-menu__item {
  min-height: 38px;
  padding: 0 10px;
  border-radius: 8px;
  color: var(--th4-text-secondary);
  font-size: 13px;
}

.role-frame__account-popover .el-dropdown-menu__item:not(.is-disabled):focus,
.role-frame__account-popover .el-dropdown-menu__item:not(.is-disabled):hover {
  color: var(--th4-text-primary);
  background: var(--th4-surface-50);
}

.role-frame__account-popover .el-dropdown-menu__item--divided {
  margin-top: 6px;
  border-top-color: var(--th4-border-color);
}

.page-shift-enter-active,
.page-shift-leave-active {
  transition: opacity var(--th4-motion-enter-fast) var(--th4-motion-ease-out), transform var(--th4-motion-enter-fast) var(--th4-motion-ease-out);
}

.page-shift-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.page-shift-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}

@media (prefers-reduced-motion: reduce) {
  .page-shift-enter-active,
  .page-shift-leave-active {
    transition-duration: .01ms !important;
  }
}
</style>
