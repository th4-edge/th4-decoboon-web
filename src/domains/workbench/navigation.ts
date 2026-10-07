import registryData from '../../../docs/standards/workbench-navigation.json'
import type { WorkbenchEntry, WorkbenchGroup, WorkbenchRegistry } from './model'

export const workbenchRegistry = registryData as WorkbenchRegistry

export function workbenchesForRole(role: string | null | undefined): WorkbenchEntry[] {
  if (!role) return []
  return workbenchRegistry.workbenches
    .filter((item) => item.key !== 'today.mainline' && item.roles.includes(role))
    .sort((a, b) => a.priority.localeCompare(b.priority) || a.label.localeCompare(b.label, 'zh-CN'))
}

export function groupOf(entry: WorkbenchEntry): WorkbenchGroup | undefined {
  return workbenchRegistry.groups.find((group) => group.key === entry.group)
}

export function domainLabelOf(entry: WorkbenchEntry): string {
  return workbenchRegistry.domains.find((domain) => domain.key === entry.domain)?.label ?? entry.domain
}

/**
 * 只解析不依赖运行时对象的深链接。
 * 带 {objectId} 的路径先退到基础工作台/列表，避免用空参数或第一条对象伪装进入。
 */
export function resolveWorkbenchLink(entry: WorkbenchEntry, role?: string | null): string | null {
  const roleDeepLink = roleDeepLinkOf(entry, role)
  if (!roleDeepLink) return null
  const [rawPath, rawQuery = ''] = roleDeepLink.split('?')
  const baseSegments: string[] = []
  for (const segment of rawPath.split('/').filter(Boolean)) {
    if (segment.includes('{')) break
    baseSegments.push(segment)
  }
  const path = baseSegments.length ? `/${baseSegments.join('/')}` : '/'
  const params = new URLSearchParams()
  for (const [key, value] of new URLSearchParams(rawQuery)) {
    if (!value.includes('{')) params.append(key, value)
  }
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

function roleDeepLinkOf(entry: WorkbenchEntry, role?: string | null): string {
  if (entry.key === 'pm.acceptance' && role === 'Designer') return '/designer/projects/{projectId}/acceptance'
  if (entry.key === 'pm.materialSelection') {
    if (role === 'Designer') return '/designer/projects/{projectId}/materials'
    if (role === 'Boss' || role === 'StoreManager' || role === 'Finance') return '/workbench/materials/{projectId}'
  }
  if (role === 'Pm' && entry.key.startsWith('pm.')) {
    if (entry.key === 'pm.project') return '/pm/workbench?projectId={projectId}'
    const surface = entry.key === 'pm.materialSelection' ? 'materials' : entry.key === 'pm.change' ? 'changes' : 'acceptance'
    return `/pm/workbench?surface=${surface}&projectId={projectId}`
  }
  if (role === 'Designer' && entry.key === 'pm.project') return '/designer/projects'
  if (role === 'StoreManager' && entry.key === 'customer.followup') return '/workbench/customers'
  if (role === 'TeamLeader' && entry.key === 'customer.followup') return '/workbench/team-customers'
  if (role === 'Marketer' && entry.key === 'customer.followup') return '/workbench/my-customers'
  if (role === 'Marketer' && entry.key === 'designer.measure') return '/workbench/my-customers?surface=measure'
  if (role === 'StoreManager' && entry.key.startsWith('pm.')) return '/workbench?surface=project'
  return entry.deepLink
}

export interface SidebarNavItem {
  key: string
  label: string
  path: string
}

export interface SidebarNavGroup {
  key: string
  label: string
  items: SidebarNavItem[]
}

/**
 * 侧栏导航（一级领域 + 二级场景工作台）的唯一来源是工作台注册表。
 *
 * DEC-034 / BR-030：菜单按角色与场景配置，一级导航不超过 7 项，
 * 二级是场景工作台（待我量房 / 待我收款 …），禁止模块 CRUD 命名。
 *
 * 壳层只负责渲染，不得再维护第二套静态菜单；否则会出现
 * 「页面已按批次建好、侧栏仍写着建设中或指向死链接」的偏差（DEF-WEB-001）。
 */
export function sidebarNavForRole(role: string | null | undefined): SidebarNavGroup[] {
  if (!role) return []
  const groupOrder = new Map(workbenchRegistry.groups.map((group) => [group.key, group.order]))
  const seenPaths = new Set<string>()
  const groups: SidebarNavGroup[] = []

  for (const domain of [...workbenchRegistry.domains].sort((a, b) => a.order - b.order)) {
    const items: SidebarNavItem[] = []
    const entries = workbenchRegistry.workbenches
      .filter((entry) => entry.domain === domain.key && entry.roles.includes(role))
      .sort((a, b) =>
        a.priority.localeCompare(b.priority) ||
        (groupOrder.get(a.group) ?? 0) - (groupOrder.get(b.group) ?? 0) ||
        a.label.localeCompare(b.label, 'zh-CN')
      )

    for (const entry of entries) {
      const path = resolveWorkbenchLink(entry, role)
      // 同一路径只保留优先级最高的一项，避免注册表里多个工作台落到同一个无动作页面。
      if (!path || seenPaths.has(path.split('?')[0])) continue
      seenPaths.add(path.split('?')[0])
      items.push({ key: entry.key, label: entry.label, path })
    }

    if (items.length) groups.push({ key: domain.key, label: domain.label, items })
  }

  return groups
}
