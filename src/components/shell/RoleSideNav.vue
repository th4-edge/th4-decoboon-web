<script setup lang="ts">
import { useRoute } from 'vue-router'
import NavIcon from '@/components/shell/NavIcon.vue'
import { workbenchRegistry, resolveWorkbenchLink } from '@/domains/workbench/navigation'
import type { RoleNavItemConfig, RoleWorkbenchConfig } from '@/roles/workbenchConfig'

const props = defineProps<{
  config: RoleWorkbenchConfig
  badges?: Record<string, number>
}>()

const route = useRoute()

function resolvePath(item: RoleNavItemConfig): string | null {
  if (item.path) return item.path
  if (item.key === 'today.mainline') return props.config.homePath
  const entry = workbenchRegistry.workbenches.find((candidate) => candidate.key === item.key)
  if (!entry) return null
  return resolveWorkbenchLink(entry, props.config.role)
}

function resolveLabel(item: RoleNavItemConfig): string {
  if (item.label) return item.label
  if (item.key === 'today.mainline') return '业务工作台'
  return workbenchRegistry.workbenches.find((candidate) => candidate.key === item.key)?.label ?? item.key
}

function isActive(path: string): boolean {
  const target = path.split('?')[0]
  if (target === props.config.homePath) return route.path === target
  return route.path === target || route.path.startsWith(`${target}/`)
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
          :to="resolvePath(item) as string"
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
