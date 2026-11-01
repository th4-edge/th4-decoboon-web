import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const shell = read('src/layouts/RoleAreaShell.vue')
const nav = read('src/components/shell/RoleSideNav.vue')
const config = read('src/roles/workbenchConfig.ts')
const failures = []
const expect = (condition, message) => { if (!condition) failures.push(message) }

expect(shell.includes('<aside') && shell.includes('<header') && shell.includes('<main') && shell.includes('<footer'),
  'Web 壳层必须包含 aside/header/main/footer 标准结构')
expect(shell.includes('role-frame__container') && shell.includes('role-frame__footer-inner'),
  'Web 壳层缺少统一 content container 或 footer container')
expect(shell.includes('<router-view') && !shell.includes('window.location') && !shell.includes('location.href'),
  '页面内容必须通过 router-view 装载，禁止整页 location 跳转')
expect(shell.includes('workbenchConfigOf(session.role)') && shell.includes('RoleSideNav'),
  '壳层菜单必须由当前角色配置驱动')
expect(nav.includes('<router-link') && nav.includes('resolveTarget') && !nav.includes('window.location') && !nav.includes('location.href'),
  '菜单必须使用 RouterLink 完成无刷新导航')
expect(nav.includes('openGroupKey') && nav.includes('role-nav__group-toggle') && nav.includes('v-show="openGroupKey === group.key"'),
  '侧栏菜单必须保持分组单项展开，避免全部菜单同时铺开')
expect(config.includes('Record<EmployeeRole, RoleWorkbenchConfig>') && config.includes('workbenchConfigOf'),
  '角色菜单静态配置不完整')

if (failures.length) {
  console.error('Web 标准壳层门禁失败：')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Web 标准壳层门禁通过：角色菜单 → Layout/Header/Container/Footer → RouterLink 无刷新导航')
