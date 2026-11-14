import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const scanRoots = ['src/views', 'src/layouts', 'src/components']
const exclusions = new Set([
  'src/views/system/ComponentPreviewView.vue'
])
const buzzwords = /一站式|全链路|生态闭环|数智化|智慧经营|AI驱动|洞察一切|降本增效|经营管控中心|数字化经营|智能经营/
const explanatory = /从.{1,30}(?:到|至).{1,30}[，,].*(?:掌握|实时|全面|轻松)|(?:当前|页面|系统|本页).{0,24}(?:只用于|用于说明|会自动|会显示|会更新|可以看到)|当前只切换工作面/
const uppercasePhrase = /\b[A-Z]{2,}(?:\s+[A-Z0-9]{2,}){1,}\b/
const uppercaseWithSeparator = /\b[A-Z]{2,}\s*·\s*(?:[A-Z]{2,}|\p{Script=Han})/u
const eyebrowClass = /class="[^"]*(?:eyebrow|kicker)[^"]*"/
const technicalDate = /YYYY|HH:mm|LocalDateTime|value-format|\bGB\s*\d+/i

function linesOf(file) {
  return fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/)
}

function visibleText(line) {
  return line
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^[^'"`]*['"`]/, '')
    .replace(/['"`][^'"`]*$/, '')
    .trim()
}

function literalVisibleText(line) {
  return visibleText(line).replace(/\{\{[\s\S]*?\}\}/g, '').trim()
}

function inspectText(text) {
  const reasons = []
  if (buzzwords.test(text)) reasons.push('空泛营销词')
  if (explanatory.test(text)) reasons.push('解释界面本身的冗余描述')
  if (technicalDate.test(text)) return reasons
  if (uppercasePhrase.test(text) || uppercaseWithSeparator.test(text)) reasons.push('英文眉题或装饰性英文短语')
  return reasons
}

function scan() {
  const issues = []
  for (const scanRoot of scanRoots) {
    const walk = (dir) => {
      for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
        const file = path.join(dir, entry.name).replaceAll(path.sep, '/')
        if (entry.isDirectory()) walk(file)
        else if (/\.(vue|ts|scss)$/.test(entry.name) && !exclusions.has(file)) {
          linesOf(file).forEach((line, index) => {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('<!--')) return
            const visible = visibleText(trimmed)
            const reasons = inspectText(visible || trimmed)
            if (eyebrowClass.test(line) && /[A-Za-z]{2,}/.test(literalVisibleText(line)) && !technicalDate.test(literalVisibleText(line))) {
              if (!reasons.includes('英文眉题或装饰性英文短语')) reasons.push('英文眉题或装饰性英文短语')
            }
            if (reasons.length) issues.push({ file, line: index + 1, reasons, text: trimmed })
          })
        }
      }
    }
    walk(scanRoot)
  }
  return issues
}

function assertSharedDescriptionPolicy() {
  const panel = fs.readFileSync(path.join(root, 'src/components/PanelCard.vue'), 'utf8')
  const pageHeader = fs.readFileSync(path.join(root, 'src/components/shell/PageHeader.vue'), 'utf8')
  const workbenchCard = fs.readFileSync(path.join(root, 'src/components/workbench/WorkbenchEntryCard.vue'), 'utf8')
  const failures = []
  if (panel.includes('{{ description }}')) failures.push('PanelCard 仍在渲染 description')
  if (pageHeader.includes('{{ summary }}')) failures.push('PageHeader 仍在渲染 summary')
  if (workbenchCard.includes('{{ entry.mainAction }}')) failures.push('工作台入口卡仍在渲染说明动作')
  if (failures.length) {
    console.error('AI 味门禁未通过：')
    failures.forEach((failure) => console.error(`- ${failure}`))
    process.exit(1)
  }
}

function selfTest() {
  const bad = [
    '<p class="section__eyebrow">PROJECT INSIGHT · 项目洞察</p>',
    '协同平台，一站式赋能装企实现全链路数字化升级。',
    '<p>从线索到签约，实时掌握每个机会。</p>',
    '<span>CHANGE DOCUMENT</span>'
  ].join('\n')
  const safe = [
    '<p>今日待处理</p>',
    '<span>量房时间：2026-10-29 18:20</span>',
    '<p>客户、项目与款项按当前账号权限展示。</p>'
  ].join('\n')
  const badHits = bad.split('\n').flatMap(inspectText)
  const safeHits = safe.split('\n').flatMap(inspectText)
  if (badHits.length < 4 || safeHits.length) {
    console.error('AI 味门禁负向验证失败')
    process.exit(1)
  }
  console.log('AI 味门禁负向验证通过：英文眉题、营销空话与解释界面本身的冗余描述均可被识别')
}

if (process.argv.includes('--self-test')) {
  selfTest()
  process.exit(0)
}

assertSharedDescriptionPolicy()
const issues = scan()
if (issues.length) {
  console.error(`AI 味门禁未通过：${issues.length} 处`)
  for (const issue of issues) {
    console.error(`- ${issue.file}:${issue.line} [${issue.reasons.join(' / ')}] ${issue.text}`)
  }
  process.exit(1)
}
console.log('AI 味门禁通过：生产界面未发现英文眉题、营销空话或装饰性英文短语')
