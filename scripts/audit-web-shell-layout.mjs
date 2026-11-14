import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const shell = read('src/layouts/RoleAreaShell.vue')
const nav = read('src/components/shell/RoleSideNav.vue')
const config = read('src/roles/workbenchConfig.ts')
const routes = read('src/roles/routes.ts')
const forbidden = read('src/views/system/ForbiddenView.vue')
const notFound = read('src/views/system/NotFoundView.vue')
const tokens = read('src/styles/tokens.scss')
const globalStyles = read('src/styles/index.scss')
const failures = []
const expect = (condition, message) => { if (!condition) failures.push(message) }

expect(shell.includes('<aside') && shell.includes('<header') && shell.includes('<main') && !shell.includes('<footer'),
  'Web 壳层必须保持 Sidebar / Header / Main 三块，不允许 Shell 级 Footer')
expect(shell.includes('data-scroll-container="main"') && shell.includes('ref="contentRef"'),
  'Web 内容区必须提供唯一、可定位的滚动容器')
expect(shell.includes('<router-view') && !shell.includes('window.location') && !shell.includes('location.href'),
  '页面内容必须通过 router-view 装载，禁止整页 location 跳转')
expect(shell.includes('workbenchConfigOf(session.role)') && shell.includes('RoleSideNav'),
  '壳层菜单必须由当前角色配置驱动')
expect(!shell.includes('role-frame--boss'), '全局 Layout 不允许角色专用壳层变体')
expect(tokens.includes('$sidebar-width: 222px') && tokens.includes('$topbar-height: 70px'),
  '全局 Layout 必须使用 Figma 主壳层尺寸 222 / 70')
expect(tokens.includes('$content-max-width: 1660px') && tokens.includes('$content-gutter: 34px'),
  '全局 Layout 必须使用 Figma 内容宽度 1660 与左右边距 34')
expect(globalStyles.includes('height: 100%') && globalStyles.includes('overflow: hidden'),
  'html/body/#app 必须锁定视口高度并禁止外层滚动')
expect(shell.includes('.role-frame__container') && shell.includes('overflow-y: auto') && shell.includes('height: 100%'),
  'Container 必须是唯一纵向滚动区')
expect(nav.includes('<router-link') && nav.includes('resolveTarget') && !nav.includes('window.location') && !nav.includes('location.href'),
  '菜单必须使用 RouterLink 完成无刷新导航')
expect(nav.includes('openGroupKey') && nav.includes('role-nav__group-toggle') && nav.includes('v-show="openGroupKey === group.key"'),
  '侧栏菜单必须保持分组单项展开，避免全部菜单同时铺开')
expect(config.includes('Record<EmployeeRole, RoleWorkbenchConfig>') && config.includes('workbenchConfigOf'),
  '角色菜单静态配置不完整')
expect(config.includes("homePathForRole('Boss')") && config.includes("homePathForRole('Designer')"),
  '角色首页路径必须由 homePathForRole 单一来源派生')
const roleNames = ['Designer','Boss','StoreManager','TeamLeader','Marketer','Pm','Finance']
for (const role of roleNames) {
  const start = routes.indexOf(`  ${role}: [`)
  if (start < 0) continue
  const next = roleNames.map((name) => routes.indexOf(`  ${name}: [`, start + 1)).filter((index) => index > start)
  const end = next.length ? Math.min(...next) : routes.indexOf('\n}', start)
  const block = routes.slice(start, end)
  const counts = new Map()
  for (const match of block.matchAll(/L\.([A-Za-z0-9_]+)/g)) counts.set(match[1], (counts.get(match[1]) ?? 0) + 1)
  const duplicates = [...counts].filter(([, count]) => count > 1).map(([name]) => name)
  expect(duplicates.length === 0, `${role} 路由存在重复引用：${duplicates.join(', ')}`)
}
expect(!forbidden.includes("router.replace('/workbench')") && forbidden.includes('homePathForRole(session.role)'),
  '403 页面必须返回当前角色真实首页')
expect(!notFound.includes("router.replace('/workbench')") && notFound.includes('homePathForRole(session.role)'),
  '404 页面必须返回当前角色真实首页')

if (failures.length) {
  console.error('Web 标准壳层门禁失败：')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Web 标准壳层门禁通过：222/70 Viewport Layout → 唯一 Container 滚动 → RouterLink 无刷新导航')
