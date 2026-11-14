/**
 * Web 工作台治理门禁（按角色静态化版）。
 *
 * 每个角色维护静态路由、静态菜单和静态首页清单；本门禁直接读取三份代码源并交叉校验。
 *
 * ## 三份静态源（唯一来源，不查表、不回落）
 * - `src/roles/routes.ts`
 * - `src/roles/workbenchConfig.ts`
 * - `src/roles/workbenchHome.ts`
 *
 * ## 两个模式的分工（不重叠）
 * - `--mode=workbenches`（check:workbenches）：静态清单**自洽**——角色覆盖、key/label 唯一、
 *   priority/decisionStatus 合法、未裁决项不得指向可达路径、菜单与首页清单的差异只报 INFO、
 *   以及**结构自检**（每个角色的 homePath 必须落在它自己的静态路由集合里，防 routes.ts 结构漂移）。
 * - `--mode=workspaces`（check:workspaces）：静态**可达性**——菜单项 `path` 与首页卡片 `to`
 *   必须在该角色的静态路由集合内解析到真实记录；否则就是死链（EXP-013 / EXP-022）。
 *
 * 用法：node scripts/audit-web-workbench-governance.mjs --mode=workbenches|workspaces|all [--report] [--menu-report]
 */
import { loadStaticSources, flattenRolePaths, menuItemsOf, ROLES, LOCKED_ROLES } from './lib/load-static-sources.mjs'
import fs from 'node:fs'

const args = process.argv.slice(2)
const reportOnly = args.includes('--report')
const menuReport = args.includes('--menu-report')
const modeArg = args.find((arg) => arg.startsWith('--mode='))
const mode = modeArg ? modeArg.split('=')[1] : 'all'
const issues = []
const warnings = []
const infos = []

const validPriorities = new Set(['P0', 'P1', 'P2'])
const validDecisions = new Set(['approved', 'pending_business_review'])
/** 首页清单里允许不挂菜单的 key（工作台首页自身、全局搜索、员工自助入口）。 */
const HOME_ONLY_KEYS = new Set(['today.mainline', 'more.search'])

let sources = null
try {
  sources = loadStaticSources(process.cwd())
} catch (error) {
  issues.push(`无法加载静态源：${error.message}`)
}

/** 每角色：菜单项（key/label/path）与首页卡片（key/label/to/priority/decision）。 */
const menuByRole = new Map()
const homeByRole = new Map()
const pathsByRole = new Map()

if (sources) {
  // DEC-082：冻结角色只保留历史值解码，不得重新获得 Web 首页、菜单或业务路由。
  const frozen = sources.configs?.TeamLeader
  const frozenHome = sources.home?.TeamLeader
  const frozenPaths = flattenRolePaths(sources.routesByRole?.TeamLeader)
  if (!frozen || frozen.homePath !== '/forbidden' || menuItemsOf(frozen).length) {
    issues.push('冻结角色 TeamLeader 不得装载 Web 业务菜单或工作台首页')
  }
  if (!Array.isArray(frozenHome) || frozenHome.length) {
    issues.push('冻结角色 TeamLeader 不得保留 Web 首页场景入口')
  }
  if ([...frozenPaths].some((path) => path === '/workbench' || path.startsWith('/workbench/'))) {
    issues.push('冻结角色 TeamLeader 不得装载 /workbench 业务路由')
  }
}

const bossOrganization = fs.readFileSync('src/views/workbench/BossOrganizationView.vue', 'utf8')
if (bossOrganization.includes("'TeamLeader'")) {
  issues.push('冻结角色 TeamLeader 不得出现在 Web 邀请或改岗选项中')
}

if (sources) {
  for (const role of ROLES) {
    if (!sources.configs?.[role]) {
      issues.push(`静态菜单缺失角色：${role}（src/roles/workbenchConfig.ts）`)
      continue
    }
    menuByRole.set(role, menuItemsOf(sources.configs[role]))

    if (!sources.home?.[role]) issues.push(`静态首页清单缺失角色：${role}（src/roles/workbenchHome.ts）`)
    homeByRole.set(role, sources.home?.[role] ?? [])

    if (!sources.routesByRole?.[role]) {
      issues.push(`静态路由缺失角色：${role}（src/roles/routes.ts）`)
      continue
    }
    const paths = flattenRolePaths(sources.routesByRole[role])
    // 自检：解析失败必须响亮失败，不能因为「集合为空」把所有可达性检查静默放过。
    if (paths.size < 5) {
      issues.push(`静态路由解析异常：${role} 只解析出 ${paths.size} 条路径，疑似 routes.ts 结构变化导致门禁失效。`)
    }
    // 交叉自检：菜单声明的 homePath 必须在该角色静态路由集合内（拿静态菜单当独立参照物，防 routes.ts 结构漂移）。
    const homePath = sources.configs[role].homePath
    if (typeof homePath === 'string' && !paths.has(homePath)) {
      issues.push(`静态路由与静态菜单不一致：${role} 的 homePath ${homePath} 不在其静态路由集合内（routes.ts 结构变化或菜单写错）。`)
    }
    pathsByRole.set(role, paths)
  }
}

/** 1) 首页清单结构与自洽（角色内）。 */
function validateHomeEntry(role, entry, seenKeys, seenLabels) {
  const name = entry.key ?? '(未命名)'
  if (typeof entry.key !== 'string' || !entry.key.trim()) issues.push(`${role} 首页清单存在空 key`)
  if (seenKeys.has(entry.key)) issues.push(`${role} 首页清单 key 重复：${entry.key}`)
  seenKeys.add(entry.key)
  if (seenLabels.has(entry.label)) issues.push(`${role} 首页清单 label 重复：${entry.label}（${seenLabels.get(entry.label)} / ${name}）`)
  seenLabels.set(entry.label, name)
  for (const field of ['label', 'domainLabel', 'groupLabel', 'scenario', 'objectAnchor', 'mainAction', 'handoff']) {
    if (typeof entry[field] !== 'string' || !entry[field].trim()) issues.push(`${role} 首页卡片 ${name} 缺少 ${field}`)
  }
  if (!validPriorities.has(entry.priority)) issues.push(`${role} 首页卡片 ${name} priority 非法：${entry.priority}`)
  if (!validDecisions.has(entry.decisionStatus)) issues.push(`${role} 首页卡片 ${name} decisionStatus 非法：${entry.decisionStatus}`)
  if (entry.to !== null && (typeof entry.to !== 'string' || !entry.to.startsWith('/'))) {
    issues.push(`${role} 首页卡片 ${name} 的 to 必须以 / 开头或为 null，当前：${entry.to}`)
  }
  if (entry.decisionStatus !== 'approved' && entry.to !== null && pathsByRole.get(role)?.has(String(entry.to).split('?')[0])) {
    issues.push(`${role} 首页卡片 ${name} 裁决状态为 ${entry.decisionStatus}，却指向可达路径 ${entry.to}；未裁决项不得把路径写成数据（应写 null + 注释）。`)
  }
  if (String(entry.label).includes('管理')) {
    issues.push(`${role} 首页卡片 ${name} 使用了模块式命名「管理」：${entry.label}（违反 DEC-034 / BR-030）`)
  }
}

/** 2) 静态菜单/首页清单差异（同一 key 在两侧都应存在；差异只报 INFO）。 */
function reportMenuConsistency(role) {
  const menuKeys = new Set(menuByRole.get(role).map((item) => item.key))
  const homeKeys = new Set(homeByRole.get(role).map((entry) => entry.key))
  const findings = []
  for (const key of homeKeys) if (!menuKeys.has(key) && !HOME_ONLY_KEYS.has(key)) findings.push(`首页有 ${key}、菜单无`)
  for (const key of menuKeys) if (!homeKeys.has(key)) findings.push(`菜单有 ${key}、首页无`)
  for (const item of menuByRole.get(role)) {
    if (typeof item.label !== 'string' || !item.label.trim()) issues.push(`${role} 菜单项 ${item.key} 缺 label（必须静态显式）`)
    if (typeof item.path !== 'string' || !item.path.startsWith('/')) issues.push(`${role} 菜单项 ${item.key} 缺显式 path（必须静态显式）`)
  }
  if (!findings.length) return
  // 菜单覆盖到页面级（比卡片多），首页卡片带场景说明（含「我的工资条」这类自助入口）——两者刻意不同，
  // 所以这里只报**信息**不报告警：常驻的预期告警会训练人忽略告警（ANT-011）。
  infos.push(`INFO  ${role} 菜单/首页清单差异：${findings.length} 项（预期形态差；明细用 --menu-report）`)
  if (menuReport) for (const finding of findings) infos.push(`  ${role} 明细：${finding}`)
}

/** 3) 静态可达性：每个入口的落地页必须在**同角色**静态路由集合内。 */
function validateReachability(role) {
  const paths = pathsByRole.get(role)
  if (!paths) return
  const check = (origin, key, target) => {
    if (typeof target !== 'string' || !target.startsWith('/')) {
      issues.push(`${role} ${origin} ${key} 的落地页非法：${target}`)
      return
    }
    const base = target.split('?')[0]
    if (!paths.has(base)) {
      issues.push(`${role} ${origin} ${key} 指向本角色不可达的路径 ${base}（死链）：静态路由集合里没有这条记录。`)
    }
  }
  for (const item of menuByRole.get(role)) check('菜单项', item.key, item.path)
  for (const entry of homeByRole.get(role)) {
    if (entry.decisionStatus === 'approved' && entry.to) check('首页卡片', entry.key, entry.to)
  }
}

/** 4) 角色覆盖：每个角色都要有非空清单、至少一个可进入的入口，以及非空静态路由集合。 */
function validateRoleCoverage(role) {
  const home = homeByRole.get(role)
  if (!Array.isArray(home) || !home.length) {
    issues.push(`角色缺少首页场景入口：${role}`)
  } else if (!home.some((entry) => entry.decisionStatus === 'approved' && entry.to)) {
    issues.push(`角色首页没有任何可进入的入口：${role}（全部未裁决或落地页为空）`)
  }
  if (!menuByRole.get(role)?.length) issues.push(`角色缺少静态菜单：${role}`)
  if (!pathsByRole.get(role)?.size) issues.push(`角色静态路由集合为空：${role}（无法判定可达性）`)
}

// 锁定角色守卫：Web 页面锁定不做，内容数量变化要提示（缺陷修复通常不改变数量）。
if (sources && (mode === 'workbenches' || mode === 'all')) {
  for (const [role, base] of Object.entries(LOCKED_ROLES)) {
    const menuCount = menuByRole.get(role)?.length ?? 0
    const homeCount = homeByRole.get(role)?.length ?? 0
    if (menuCount !== base.menu || homeCount !== base.home) {
      warnings.push(
        `锁定角色 ${role} 的 Web 内容发生变化（菜单项 ${base.menu} → ${menuCount}，首页卡片 ${base.home} → ${homeCount}）。`
        + `${base.reason}；如属缺陷修复请同步更新 scripts/lib/load-static-sources.mjs 的基线，否则视为越界开发。`
      )
    }
  }
}

if (sources) {
  for (const role of ROLES) {
    if (mode === 'workbenches' || mode === 'all') {
      const seenKeys = new Set()
      const seenLabels = new Map()
      for (const entry of homeByRole.get(role) ?? []) validateHomeEntry(role, entry, seenKeys, seenLabels)
      if (menuByRole.has(role) && homeByRole.has(role)) reportMenuConsistency(role)
      validateRoleCoverage(role)
    }
    if (mode === 'workspaces' || mode === 'all') validateReachability(role)
  }
}

if (issues.length) {
  const title = mode === 'workbenches'
    ? '工作台静态清单检查发现问题：'
    : mode === 'workspaces'
      ? '对象工作空间可达性检查发现问题：'
      : 'Web 工作台治理检查发现问题：'
  console[reportOnly ? 'log' : 'error'](title)
  for (const issue of issues) console[reportOnly ? 'log' : 'error'](`- ${issue}`)
  if (!reportOnly) process.exit(1)
} else {
  const title = mode === 'workbenches'
    ? '工作台静态清单检查通过。'
    : mode === 'workspaces'
      ? '对象工作空间可达性检查通过。'
      : 'Web 工作台治理检查通过。'
  console.log(title)
}
for (const info of infos) console.log(info)
for (const warning of warnings) console.log(`WARN  ${warning}`)
