import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const failures = []
const expect = (condition, message) => { if (!condition) failures.push(message) }

const theme = read('src/core/brandTheme.ts')
const app = read('src/App.vue')
const tokens = read('src/styles/tokens.scss')
const element = read('src/styles/element-theme.scss')
const account = read('src/views/account/AccountCenterView.vue')
const presets = read('src/core/brandPresets.ts')
const login = read('src/views/auth/LoginView.vue')
const lastLogin = read('src/core/lastLogin.ts')
const shell = read('src/layouts/RoleAreaShell.vue')
const brandLogo = read('src/components/BrandLogo.vue')
const indexHtml = read('index.html')
const router = read('src/core/router/index.ts')

expect(theme.includes('deriveBrandTheme') && theme.includes('accessibleAction') && theme.includes('--zdq-brand-500')
  && theme.includes('--zdq-brand-hover') && theme.includes('--zdq-brand-active')
  && theme.includes('--zdq-brand-feedback-bg') && theme.includes('--zdq-brand-chart-primary'),
  'Web 未从企业品牌色派生完整交互色、提示色或图表色')
expect(theme.includes("DEFAULT_WEB_BRAND_COLOR = '#2F7D5A'") && tokens.includes('#2f7d5a'),
  'Web 原有产品品牌色未保留')
expect(app.includes('applyCompanyWebBrand') && app.includes('session.company?.color'),
  'Web 未在会话企业变化时应用品牌主题')
expect(tokens.includes('var(--zdq-brand-500') && tokens.includes('var(--zdq-brand-50'),
  'Web 品牌 Token 未改为运行时 CSS Variables')
expect(element.includes('--el-color-primary: #{$brand-500}') && element.includes('var(--zdq-brand-300'),
  'Element Plus 主色未跟随企业品牌色')
expect(element.includes('--el-color-success: #{$success-500}') && element.includes('--el-color-warning: #{$warning-500}')
  && element.includes('--el-color-danger: #{$danger-500}') && element.includes('--el-color-info: #{$info-500}'),
  'Element Plus 业务语义色未保持固定')
expect(account.includes('el-color-picker') && account.includes('applyCustomColor') && account.includes('brand-theme-preview'),
  '企业信息页缺少自定义颜色、主题预览或派生色阶')
expect(account.includes('companyBrandPresetViews') && account.includes('brand-color-option__tones'),
  '企业信息页推荐主题未展示完整色阶或业务气质')
expect(account.includes('applyCompanyWebBrand({ name: form.name || form.title') && account.includes('applyCompanyWebBrand'),
  '点击品牌色没有实时切换 Web 主题')
expect(!account.includes('brandPrimary') && !account.includes('custodianCredit') && !account.includes('叙事主品牌') && !account.includes('记录存证署名'),
  'Web 企业信息页仍保留无业务意义的对外署名设置')
expect(['装得清默认', '青瓷', '松石墨绿', '岩蓝', '赤陶', '胡桃', '黛紫', '云序紫', '墨灰'].every((label) => presets.includes(label))
  && presets.includes('#5B5CE2')
  && !presets.includes('#2563EB') && !presets.includes('#7C3AED'),
  'Web 可选品牌主题缺少 Figma 靛紫，或仍包含高饱和科技蓝/亮紫')

const presetValues = Array.from(presets.matchAll(/value: '(#[0-9A-Fa-f]{6})'/g), (match) => match[1])
function channel(value) {
  const normalized = value / 255
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
}
function luminance(hex) {
  const values = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))
  return 0.2126 * channel(values[0]) + 0.7152 * channel(values[1]) + 0.0722 * channel(values[2])
}
function whiteContrast(hex) {
  return 1.05 / (luminance(hex) + 0.05)
}
expect(presetValues.length === 8 && presetValues.every((hex) => whiteContrast(hex) >= 4.5),
  'Web 推荐企业主题基色与白字对比度未全部达到 4.5:1')
expect(lastLogin.includes("'zdq.web.last-login.v1'") && lastLogin.includes('phone') && lastLogin.includes('company') && !lastLogin.includes('password') && !lastLogin.includes('token'),
  'Web 登录记忆缓存范围不安全或字段不完整')
expect(login.includes('readLastLogin') && login.includes('applyCompanyWebBrand(rememberedCompany') && login.includes('<CompanyBrandMark'),
  'Web 登录页未恢复上次装企Logo/品牌色/手机号')
expect(login.includes('const pageTitle = computed') && login.includes('? `登录${rememberedCompany.value.name}`') && login.includes('{{ pageTitle }}') && !login.includes('上次登录'),
  'Web 登录标题未融入装企名称或仍显示冗余上次企业卡片')
expect(!login.includes('login__platform-note') && login.includes('? `登录${rememberedCompany.value.name}`'),
  '装企登录态仍出现装得清文案或浏览器标题')
expect(login.includes('小程序「我的 → 账号密码」设置或修改') && !login.includes('忘记密码请联系'),
  'Web 登录提示未说明可从小程序设置密码或仍保留错误文案')
expect(login.includes('login__trade-path') && !login.includes('login__plan-') && !login.includes('<svg'),
  'Web 登录页仍存在装饰性家装图片或缺少项目流程')
expect(login.includes('login__path-track') && login.includes('login-brand-seal') && login.includes('login-draw-vertical'),
  'Web 登录页缺少一次性入场、主线绘制或品牌落位动效')
expect(login.includes('prefers-reduced-motion: reduce') && !login.includes('infinite') && !login.includes('pointermove'),
  'Web 登录页动效未尊重减少动态效果，或存在循环/鼠标跟随装饰')
expect(brandLogo.includes('/brand/logo-mark-white.png') && brandLogo.includes('/brand/logo-mark-color.png') && shell.includes('<CompanyBrandMark'),
  'Web 首次登录未使用官方Logo或登录后未切换企业Logo')
expect(!login.includes('login__mark') && !shell.includes('>装</span>') && !login.includes('企业') && !login.includes('工作台'),
  'Web 仍存在文字生成的装得清Logo')
expect(indexHtml.includes('data-company-favicon="true"') && indexHtml.includes('/brand/logo-mark-color.svg?v='),
  'Web favicon 未使用可动态切换的官方Logo入口')
expect(fs.existsSync(path.join(root, 'public/favicon.ico')) && fs.existsSync(path.join(root, 'public/brand/apple-touch-icon.png')),
  'Web favicon.ico 或 Apple Touch Icon 缺失')
expect(theme.includes('applyCompanyFavicon') && theme.includes('generatedEnterpriseFavicon') && theme.includes('company?.logo'),
  'Web favicon 未同步企业Logo或企业首字占位')
expect(router.includes('session.isAuthenticated ? session.companyName'), '登录后浏览器标题未使用装企名称')
const expectedHashes = {
  'public/brand/logo-mark-white.png': '12ade1524dfe4cd4b11d06593beff4ead19179a0288cb5f8765f08c3d2ffc997',
  'public/brand/logo-mark-color.png': '1115517a138f1998c54cc71619b74bb7aa84af1193b0eb791c08d5db6bc75577'
}
for (const [file, expected] of Object.entries(expectedHashes)) {
  const hash = createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')
  expect(hash === expected, `Web 品牌Logo资产哈希不一致: ${file}`)
}

if (failures.length) {
  console.error('Web 品牌主题契约校验失败：')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Web 品牌主题契约校验通过：Company.color → 派生色阶 → Element Plus / 页面主题 → 会话即时切换')
