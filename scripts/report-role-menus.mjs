/**
 * 导出各角色「当前生效」的静态菜单与首页场景清单，用于对齐、评审与验收对照。
 *
 * 背景：2026-10-11 用户裁决后，侧栏菜单与首页清单都已是**按角色静态化的唯一来源**
 * （`src/roles/workbenchConfig.ts` / `src/roles/workbenchHome.ts`），不再有注册表派生与回退。
 * 因此本脚本只做**只读呈现 + 可达性标注**，不再"生成可粘贴的配置"（那已是源文件本身）。
 *
 * 用法：node scripts/report-role-menus.mjs [role]
 *       npm run audit:menus            # 全部角色
 *       npm run audit:menus -- Designer
 */
import { loadStaticSources, flattenRolePaths, menuItemsOf, ROLES } from './lib/load-static-sources.mjs'

const only = process.argv[2]
const { routesByRole, configs, home } = loadStaticSources(process.cwd())
const roles = only ? ROLES.filter((role) => role === only) : ROLES
if (!roles.length) {
  console.error(`未知角色：${only}。可用：${ROLES.join(' / ')}`)
  process.exit(1)
}

for (const role of roles) {
  const config = configs[role]
  const paths = flattenRolePaths(routesByRole[role])
  const homeEntries = new Map((home[role] ?? []).map((entry) => [entry.key, entry]))
  const mark = (target) => (target && paths.has(String(target).split('?')[0]) ? '可达' : '不可达')

  console.log(`\n=== ${role} · ${config.roleLabel}（壳层：${config.shellTitle}，首页：${config.homePath}）===`)
  console.log(`静态路由集合：${paths.size} 条`)
  console.log('菜单（静态 TS 单源，src/roles/workbenchConfig.ts）：')
  for (const group of config.navGroups ?? []) {
    console.log(`  [${group.key}] ${group.label || '(无组名)'}`)
    for (const item of group.items ?? []) {
      const entry = homeEntries.get(item.key)
      console.log(`    - ${item.key}  ${item.label ?? '(缺 label)'}  ->  ${item.path ?? '(缺 path)'}  [${mark(item.path)}]${entry ? '' : '  （首页无对应卡片）'}`)
    }
  }
  console.log('首页场景卡片（静态清单，src/roles/workbenchHome.ts）：')
  for (const entry of home[role] ?? []) {
    const state = entry.decisionStatus === 'approved' ? (entry.to ? `进入 ${entry.to} [${mark(entry.to)}]` : '无可进入的落地页') : '待业务确认（不给入口）'
    console.log(`    - ${entry.priority}  ${entry.key}  ${entry.label}  ${state}`)
  }
}
