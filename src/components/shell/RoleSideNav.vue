<script setup lang="ts">
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { useStoreScopeStore } from '@/stores/storeScope'
import NavIcon from '@/components/shell/NavIcon.vue'
import type { RoleNavItemConfig, RoleWorkbenchConfig } from '@/roles/workbenchConfig'

const props = defineProps<{
  config: RoleWorkbenchConfig
  badges?: Record<string, number>
}>()

const route = useRoute()
const router = useRouter()
const scope = useStoreScopeStore()

function resolvePath(item: RoleNavItemConfig): string | null {
  if (item.path) return item.path
  if (item.key === 'today.mainline') return props.config.homePath
  if (import.meta.env.DEV) console.warn(`[RoleSideNav] 菜单项 ${item.key} 缺少显式 path，已拒绝渲染`)
  return null
}

/**
 * 菜单跳转必须一次带上当前门店维度。
 *
 * 门店上下文由 `store-scope` 在全局 `router.afterEach` 中对齐；若菜单先跳到不带
 * `?storeId=` 的地址，就会再触发一次 `router.replace` 补参数，表现为“点一次菜单、
 * 页面内容重载两次”。这里在 RouterLink 生成 `to` 时直接合并当前 `storeId`，并保留
 * 菜单自身已有的 query（如 `surface`），确保一次导航到位。
 */
function resolveTarget(item: RoleNavItemConfig): RouteLocationRaw | null {
  const path = resolvePath(item)
  if (!path) return null
  const storeId = scope.storeId
  if (!storeId) return path
  const resolved = router.resolve(path)
  // 菜单目标显式指定了门店时不覆盖；否则继承统一 storeScope 状态。
  if (resolved.query.storeId !== undefined) return path
  return {
    path: resolved.path,
    query: { ...resolved.query, storeId },
    hash: resolved.hash
  }
}

function resolveLabel(item: RoleNavItemConfig): string {
  if (item.label) return item.label
  if (item.key === 'today.mainline') return '业务工作台'
  if (import.meta.env.DEV) console.warn(`[RoleSideNav] 菜单项 ${item.key} 缺少显式 label`)
  return item.key
}

function isActive(path: string): boolean {
  const resolved = router.resolve(path)
  const target = resolved.path
  const pathMatched = route.path === target || route.path.startsWith(`${target}/`)
  if (!pathMatched) return false
  if (target === props.config.homePath) return route.path === target
  const targetSurface = typeof resolved.query.surface === 'string' ? resolved.query.surface : ''
  const routeSurface = typeof route.query.surface === 'string' ? route.query.surface : ''
  if (targetSurface || routeSurface) return targetSurface === routeSurface
  return true
}
</script>

<template>
  <nav class="role-nav" aria-label="角色工作台导航">
    <section
      v-for="group in config.navGroups"
      :key="group.key"
      class="role-nav__group"
      :class="{ 'role-nav__group--bare': !group.label }"
    >
      <p v-if="group.label" class="role-nav__group-title">{{ group.label }}</p>
      <template v-for="item in group.items" :key="item.key">
        <router-link
          v-if="resolvePath(item)"
          class="role-nav__item"
          :class="{ 'role-nav__item--active': isActive(resolvePath(item) as string) }"
          :to="resolveTarget(item) as RouteLocationRaw"
        >
          <NavIcon :name="item.key" />
          <span>{{ resolveLabel(item) }}</span>
          <b v-if="badges?.[item.key] !== undefined" class="role-nav__badge">{{ badges[item.key] }}</b>
        </router-link>
      </template>
    </section>
  </nav>
</template>

<style scoped lang="scss">
.role-nav {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.role-nav__group {
  margin-top: 16px;

  &:first-child { margin-top: 4px; }
}

.role-nav__group-title {
  margin: 0;
  padding: 0 12px 7px;
  color: rgba(143, 167, 156, .95);
  font-size: 11px;
  font-weight: $font-weight-semibold;
  letter-spacing: .14em;
}

.role-nav__item {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 1px;
  padding: 9px 12px;
  border: 0;
  border-radius: $radius-sm;
  color: rgba(185, 203, 194, .96);
  font-size: $font-caption;
  text-decoration: none;
  transition: background $transition-fast, color $transition-fast;

  &:hover {
    color: $surface-0;
    background: rgba(255, 255, 255, .08);
  }

  &:focus-visible {
    outline: 2px solid $brand-300;
    outline-offset: 2px;
  }
}

.role-nav__item--active {
  color: $surface-0;
  background: $brand-500;
  font-weight: $font-weight-semibold;
  box-shadow: 0 2px 8px rgba(26, 26, 23, .18);

  &:hover { background: $brand-500; }
}

.role-nav__badge {
  min-width: 19px;
  height: 19px;
  margin-left: auto;
  padding: 0 6px;
  display: grid;
  place-items: center;
  border-radius: $radius-pill;
  background: rgba(255, 255, 255, .13);
  color: rgba(234, 243, 238, .95);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
</style>
