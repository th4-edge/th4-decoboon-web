<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { useStoreScopeStore, ALL_STORES } from '@/stores/storeScope'
import NavIcon from '@/components/shell/NavIcon.vue'
import type { RoleNavGroupConfig, RoleNavItemConfig, RoleWorkbenchConfig } from '@/roles/workbenchConfig'

const props = defineProps<{
  config: RoleWorkbenchConfig
  badges?: Record<string, number>
}>()

const route = useRoute()
const router = useRouter()
const scope = useStoreScopeStore()
const navRef = ref<HTMLElement>()
const openGroupKey = ref('')

const GROUP_ICONS: Record<string, string> = {
  home: 'today.mainline',
  myCustomer: 'customer.followup',
  designQuote: 'designer.design',
  customer: 'customer.followup',
  business: 'finance.receivable',
  project: 'pm.project',
  operation: 'team.overview',
  delivery: 'pm.acceptance',
  material: 'pm.materialSelection',
  collab: 'designer.feedback',
  settle: 'finance.receivable',
  ledger: 'finance.ledger',
  voucher: 'designer.contract',
  catalog: 'designer.catalog',
  payroll: 'finance.expense',
  accounting: 'finance.projects',
  help: 'help'
}

function resolvePath(item: RoleNavItemConfig): string | null {
  if (item.path) return item.path
  if (item.key === 'today.mainline') return props.config.homePath
  if (import.meta.env.DEV) console.warn(`[RoleSideNav] 菜单项 ${item.key} 缺少显式 path，已拒绝渲染`)
  return null
}

/** 一次导航带上当前门店维度，避免 afterEach 二次 replace 和页面重复挂载。 */
function resolveTarget(item: RoleNavItemConfig): RouteLocationRaw | null {
  const path = resolvePath(item)
  if (!path) return null
  const storeId = scope.canSwitchStore ? scope.storeId : ''
  if (!storeId || storeId === ALL_STORES) return path
  const resolved = router.resolve(path)
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

function groupHasActiveItem(group: RoleNavGroupConfig): boolean {
  return group.items.some((item) => {
    const path = resolvePath(item)
    return Boolean(path && isActive(path))
  })
}

function groupIcon(key: string): string {
  return GROUP_ICONS[key] ?? 'fallback'
}

function isExpandable(group: RoleNavGroupConfig): boolean {
  return group.items.length > 1
}

function toggleGroup(group: RoleNavGroupConfig): void {
  if (!isExpandable(group)) return
  openGroupKey.value = openGroupKey.value === group.key ? '' : group.key
}

function syncActiveGroup(): void {
  const activeGroup = props.config.navGroups.find((group) => isExpandable(group) && groupHasActiveItem(group))
  if (activeGroup) openGroupKey.value = activeGroup.key
  void nextTick(() => {
    navRef.value?.querySelector<HTMLElement>('.role-nav__item--active')?.scrollIntoView({ block: 'nearest' })
  })
}

watch(
  () => [route.path, route.query.surface, props.config.role] as const,
  syncActiveGroup,
  { immediate: true }
)
</script>

<template>
  <nav ref="navRef" class="role-nav" :aria-label="`${config.roleLabel}导航`">
    <template v-for="group in config.navGroups" :key="group.key">
      <section
        v-if="group.key === 'today'"
        class="role-nav__root"
        aria-label="业务工作台"
      >
        <template v-for="item in group.items" :key="item.key">
          <router-link
            v-if="resolvePath(item)"
            class="role-nav__item role-nav__item--root"
            :class="{ 'role-nav__item--active': isActive(resolvePath(item) as string) }"
            :to="resolveTarget(item) as RouteLocationRaw"
          >
            <NavIcon :name="item.key" />
            <span>{{ resolveLabel(item) }}</span>
            <b v-if="badges?.[item.key] !== undefined" class="role-nav__badge">{{ badges[item.key] }}</b>
          </router-link>
        </template>
      </section>

      <section
        v-else-if="!isExpandable(group)"
        class="role-nav__single"
        :aria-label="group.label"
      >
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

      <section
        v-else
        class="role-nav__group"
        :class="{ 'role-nav__group--active': groupHasActiveItem(group), 'role-nav__group--open': openGroupKey === group.key }"
      >
        <button
          class="role-nav__group-toggle"
          type="button"
          :aria-expanded="openGroupKey === group.key"
          :aria-controls="`nav-group-${config.role}-${group.key}`"
          @click="toggleGroup(group)"
        >
          <NavIcon :name="groupIcon(group.key)" />
          <span>{{ group.label }}</span>
          <NavIcon class="role-nav__chevron" name="chevron-down" />
        </button>

        <div
          v-show="openGroupKey === group.key"
          :id="`nav-group-${config.role}-${group.key}`"
          class="role-nav__items"
        >
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
        </div>
      </section>
    </template>
  </nav>
</template>

<style scoped lang="scss">
.role-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
}

.role-nav__root,
.role-nav__single,
.role-nav__group {
  display: flex;
  flex-direction: column;
}

.role-nav__root {
  padding-bottom: $space-3;
  border-bottom: 1px solid $line-200;
}

.role-nav__single {
  padding-top: 2px;
}

.role-nav__group-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 36px;
  padding: 0 10px;
  border: 0;
  border-radius: $radius-sm;
  color: $text-secondary;
  background: transparent;
  font: inherit;
  font-size: $font-body-sm;
  text-align: left;
  cursor: pointer;
  transition: color $transition-fast, background $transition-fast;

  &:hover {
    color: $text-primary;
    background: $surface-50;
  }

  &:focus-visible {
    outline: 2px solid var(--zdq-brand-a46, #{$brand-300});
    outline-offset: 1px;
  }
}

.role-nav__group--active > .role-nav__group-toggle {
  color: $brand-700;
  background: $brand-50;
}

.role-nav__chevron {
  width: 15px;
  height: 15px;
  margin-left: auto;
  transition: transform $transition-fast;
}

.role-nav__group--open .role-nav__chevron {
  transform: rotate(180deg);
}

.role-nav__items {
  display: grid;
  gap: 2px;
  margin: 2px 0 6px 18px;
  padding-left: 8px;
  border-left: 1px solid $line-200;
  transform-origin: top;
  animation: nav-items-in $motion-enter-fast $motion-ease-out both;
}

@keyframes nav-items-in {
  from {
    opacity: 0;
    transform: translateY(-3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.role-nav__item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 38px;
  padding: 7px 10px;
  border-radius: $radius-sm;
  color: $text-secondary;
  font-size: $font-body-sm;
  line-height: 1.4;
  text-decoration: none;
  transition: color $transition-fast, background $transition-fast, transform $transition-fast;

  &::before {
    position: absolute;
    top: 9px;
    bottom: 9px;
    left: 0;
    width: 2px;
    border-radius: $radius-pill;
    background: $brand-500;
    content: '';
    opacity: 0;
    transform: scaleY(.5);
    transition: opacity $transition-fast, transform $transition-fast;
  }

  :deep(.nav-icon) {
    color: $text-tertiary;
  }

  &:hover {
    color: $text-primary;
    background: $surface-100;
    transform: translateX(1px);

    :deep(.nav-icon) { color: $text-secondary; }
  }

  &:focus-visible {
    outline: 2px solid var(--zdq-brand-a46, #{$brand-300});
    outline-offset: 1px;
  }
}

.role-nav__item--root {
  min-height: 42px;
  color: $text-primary;
  font-weight: $font-weight-medium;
}

.role-nav__item--active {
  color: $brand-700;
  background: $brand-50;
  font-weight: $font-weight-medium;

  &::before {
    opacity: 1;
    transform: scaleY(1);
  }

  :deep(.nav-icon) { color: $brand-600; }

  &:hover {
    color: $brand-700;
    background: $brand-50;

    :deep(.nav-icon) { color: $brand-600; }
  }
}

@media (prefers-reduced-motion: reduce) {
  .role-nav__item,
  .role-nav__item::before,
  .role-nav__chevron {
    transition-duration: .01ms !important;
  }

  .role-nav__items {
    animation: none;
  }
}

.role-nav__badge {
  min-width: 20px;
  height: 20px;
  margin-left: auto;
  padding: 0 6px;
  display: grid;
  place-items: center;
  border-radius: $radius-pill;
  color: $brand-700;
  background: $brand-100;
  font-size: $font-micro;
  font-variant-numeric: tabular-nums;
}
</style>
