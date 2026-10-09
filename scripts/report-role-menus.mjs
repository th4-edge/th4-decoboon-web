/**
 * 导出各角色「当前生效」的侧栏菜单，输出可直接粘贴回 `src/roles/workbenchConfig.ts` 的静态配置。
 *
 * 背景：菜单正从「注册表派生」迁移为「静态 TS 单源」（见 GAP-WEB-013）。
 * 迁移期 `RoleSideNav` 对缺 label/path 的菜单项会回退查询注册表；
 * 本脚本把回退结果**固化**成显式值，供逐角色重写菜单时作为初稿。
 *
 * 用法：node scripts/report-role-menus.mjs [role]
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const registry = JSON.parse(fs.readFileSync(path.join(root, 'docs/standards/workbench-navigation.json'), 'utf8'))
const source = fs.readFileSync(path.join(root, 'src/roles/workbenchConfig.ts'), 'utf8')

const ROLES = ['Boss', 'StoreManager', 'TeamLeader', 'Marketer', 'Designer', 'Pm', 'Finance']
const entryByKey = new Map(registry.workbenches.map((w) => [w.key, w]))

/** 与 src/domains/workbench/navigation.ts 的 roleDeepLinkOf 保持一致（脚本内不引 TS）。 */
function roleDeepLinkOf(entry, role) {
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

function resolveWorkbenchLink(entry, role) {
  const raw = roleDeepLinkOf(entry, role)
  if (!raw) return null
  const [rawPath, rawQuery = ''] = raw.split('?')
  const baseSegments = []
  for (const segment of rawPath.split('/').filter(Boolean)) {
    if (segment.includes('{')) break
    baseSegments.push(segment)
  }
  const resolvedPath = baseSegments.length ? `/${baseSegments.join('/')}` : '/'
  const params = new URLSearchParams()
  for (const [key, value] of new URLSearchParams(rawQuery)) {
    if (!value.includes('{')) params.append(key, value)
  }
  const query = params.toString()
  return query ? `${resolvedPath}?${query}` : resolvedPath
}

const roleStarts = []
for (const role of ROLES) {
  const match = new RegExp(`\\n  ${role}: \\{`).exec(source)
  if (match) roleStarts.push([role, match.index])
}
roleStarts.sort((a, b) => a[1] - b[1])

const only = process.argv[2]
const lines = []
for (let i = 0; i < roleStarts.length; i += 1) {
  const [role, start] = roleStarts[i]
  if (only && role !== only) continue
  const end = i + 1 < roleStarts.length ? roleStarts[i + 1][1] : source.length
  const block = source.slice(start, end)

  lines.push(`\n=== ${role} ===`)
  const groupRe = /group\('([^']+)', '([^']*)', \[([\s\S]*?)\]\)/g
  let gm
  while ((gm = groupRe.exec(block)) !== null) {
    const [, groupKey, groupLabel, body] = gm
    const items = Array.from(body.matchAll(/item\('([^']+)'(?:, '([^']*)')?(?:, '([^']*)')?\)/g))
    lines.push(`  group('${groupKey}', '${groupLabel}', [`)
    for (const [, key, label, itemPath] of items) {
      const entry = entryByKey.get(key)
      const finalLabel = label || entry?.label || key
      const finalPath = itemPath || (entry ? resolveWorkbenchLink(entry, role) : null) || '(未解析)'
      const flag = (!label || !itemPath) ? '  // ← 迁移期回退自注册表' : ''
      lines.push(`    item('${key}', '${finalLabel}', '${finalPath}'),${flag}`)
    }
    lines.push('  ]),')
  }
}
console.log(lines.join('\n'))
