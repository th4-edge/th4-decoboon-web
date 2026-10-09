/**
 * 工作台注册表（`docs/standards/workbench-navigation.json`）的读取与解析。
 *
 * 职责边界（2026-10-09 口径，见 `docs/standards/GAP台账.md` GAP-WEB-004）：
 * - **注册表 = 契约与校验源**：登记 key / 角色 / 对象锚点 / 主行动 / 深链接 / 交接，由 `check:workbenches` 校验。
 * - **菜单渲染源 = `src/roles/workbenchConfig.ts`**：各角色实际展示的侧栏菜单由手写配置决定，
 *   未登记的 key 通过 `resolveWorkbenchLink` 回落到注册表深链接。
 * 两条来源必须保持一致，由 `scripts/audit-web-workbench-governance.mjs` 的一致性检查兜底。
 * 原 `sidebarNavForRole()`（注册表派生菜单）已随死代码 `WorkbenchLayout.vue` 一并下线。
 */
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
  if (entry.key === 'pm.acceptance') return '/workbench/rectification?projectId={projectId}&stageId={stageId}'
  if (entry.key === 'pm.materialSelection') {
    if (role === 'Designer' || role === 'Boss' || role === 'StoreManager' || role === 'Finance') {
      return '/workbench/material-selection?projectId={projectId}'
    }
  }
  if (entry.key === 'pm.change' && (role === 'Designer' || role === 'Boss' || role === 'StoreManager')) {
    return '/workbench/contract-changes?projectId={projectId}'
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
