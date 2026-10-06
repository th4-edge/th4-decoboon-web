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
export function resolveWorkbenchLink(entry: WorkbenchEntry): string | null {
  if (!entry.deepLink) return null
  const [rawPath, rawQuery = ''] = entry.deepLink.split('?')
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
