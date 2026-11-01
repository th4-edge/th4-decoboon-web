import fs from 'node:fs'
import path from 'node:path'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { baseParse } from '@vue/compiler-dom'
import ts from 'typescript'

const root = process.cwd()
const srcRoot = path.join(root, 'src')
const exclusions = new Set([
  'src/views/designer/DesignerPlaceholderView.vue',
  'src/views/system/ComponentPreviewView.vue'
])

const rules = [
  [/待业务确认/, '研发状态泄漏'],
  [/服务端|前端|后端|接口|Provider|投影|状态机|回读|幂等|兜底|快照/, '实现细节语言'],
  [/业主端只读同频|业主端只读|只读同频|业主端展示/, '端边界语言'],
  [/兜底话术|不使用第一条兜底|默认第一条|空数组伪装|假数据|演示数据填充/, '测试防线文案'],
  [/(?:P0|P1|P2|G[1-9]|BR-\d+|DEC-\d+|GAP-\d+|T0[56]).*[\u3400-\u9fff]|[\u3400-\u9fff].*(?:P0|P1|P2|G[1-9]|BR-\d+|DEC-\d+|GAP-\d+|T0[56])/, '研发治理编号'],
  [/对象锚点|字段字典|对账矩阵|业务裁决/, '内部模型语言'],
  [/参数缺失|缺少[^\s，。；]{0,12}参数/, '技术错误直传'],
  [/建设中|正在建设中|待接入/, '未完成能力文案'],
  [/同频/, '内部产品术语'],
  [/(?:finance|project|customer|material|designer|company|statistic|content|auth)\.[a-z]/, '内部路由或模型标识']
]

const loginViewPath = path.join(srcRoot, 'views/auth/LoginView.vue')
const loginPresentationRules = [
  [/企业|装企|平台|产品|工作台|SaaS/i, '平台或管理概念泄漏'],
  [/本机只记住|不会保存密码/, '系统实现自述'],
  [/品牌标识与主题色来自|资料设置/, '品牌来源说明'],
  [/全角色|经营闭环|岗位权限|财务穿透/, '空泛卖点'],
  [/login__plan-|户型|平面图|<svg[\s>]/, '装饰性家装图片']
]

function inspectLoginPresentation(source) {
  return loginPresentationRules
    .filter(([pattern]) => pattern.test(source))
    .map(([, reason]) => reason)
}

const issues = []
const seen = new Set()
function check(file, text, line, kind) {
  const value = String(text || '').replace(/\s+/g, ' ').trim()
  if (!value || !/[\u3400-\u9fff]/.test(value)) return
  for (const [pattern, reason] of rules) {
    if (!pattern.test(value)) continue
    const key = `${file}\0${line}\0${value}`
    if (seen.has(key)) return
    seen.add(key)
    issues.push({ file, line, kind, reason, text: value })
    return
  }
}

function scanTs(file, source, lineOffset = 0) {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
      check(file, node.text, pos.line + 1 + lineOffset, ts.SyntaxKind[node.kind])
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
}

function scanExpressionLiterals(file, expression, line) {
  for (const match of expression.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) {
    if (match[2].includes('${')) continue
    check(file, match[2], line, 'template-expression')
  }
}

function walkTemplate(node, file, lineOffset) {
  if (!node || typeof node !== 'object') return
  const line = (node.loc?.start?.line ?? 1) + lineOffset
  if (node.type === 2) check(file, node.content, line, 'template-text')
  if (node.type === 1 && node.props) {
    for (const prop of node.props) {
      const staticValue = prop.value?.content
      if (typeof staticValue === 'string') check(file, staticValue, line, `attr:${prop.name}`)
      if (prop.exp?.content) scanExpressionLiterals(file, prop.exp.content, line)
    }
  }
  for (const child of node.children || []) walkTemplate(child, file, lineOffset)
  for (const branch of node.branches || []) walkTemplate(branch, file, lineOffset)
}

function scanFile(full) {
  const file = path.relative(root, full)
  if (exclusions.has(file)) return
  const source = fs.readFileSync(full, 'utf8')
  if (full.endsWith('.ts')) {
    scanTs(file, source)
    return
  }
  const { descriptor } = parseSfc(source, { filename: full })
  if (descriptor.template?.content) {
    try {
      const offset = (descriptor.template.loc.start.line || 1) - 1
      walkTemplate(baseParse(descriptor.template.content, { comments: false }), file, offset)
    } catch (error) {
      const fallback = descriptor.template.content.replace(/<!--[\s\S]*?-->/g, '')
      check(file, fallback, (descriptor.template.loc.start.line || 1) + 1, 'template-fallback')
    }
  }
  for (const block of [descriptor.script, descriptor.scriptSetup]) {
    if (!block?.content) continue
    scanTs(file, block.content, (block.loc.start.line || 1) - 1)
  }
}

function walkFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist'].includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkFiles(full)
    else if (/\.(vue|ts)$/.test(entry.name)) scanFile(full)
  }
}

function runLoginPresentationGate() {
  const source = fs.readFileSync(loginViewPath, 'utf8')
  for (const reason of inspectLoginPresentation(source)) {
    issues.push({ file: 'src/views/auth/LoginView.vue', line: 1, kind: 'login-presentation', reason, text: reason })
  }
}

if (process.argv.includes('--self-test')) {
  const bad = '企业工作台 本机只记住企业品牌和手机号，不会保存密码。 <svg class="login__plan-art"></svg>'
  const safe = '账号登录 项目经营 使用手机号和登录密码进入系统。'
  const badHits = inspectLoginPresentation(bad)
  const safeHits = inspectLoginPresentation(safe)
  if (badHits.length < 3 || safeHits.length) {
    console.error('登录页展示门禁负向验证失败')
    process.exit(1)
  }
  console.log('登录页展示门禁负向验证通过：平台概念、系统自述和装饰图片均可被拦截')
  process.exit(0)
}

walkFiles(srcRoot)
runLoginPresentationGate()
if (issues.length) {
  console.error(`客户端文案门禁未通过：${issues.length} 处研发型或登录页展示问题`)
  for (const issue of issues) console.error(`- ${issue.file}:${issue.line} [${issue.reason}] ${issue.text}`)
  process.exit(1)
}
console.log('客户端文案门禁通过：生产界面未发现研发型提示或登录页平台化/自述文案')
