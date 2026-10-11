import fs from 'node:fs'
import path from 'node:path'

/**
 * 枚举中文投影门禁（补充 audit-business-concepts / audit-business-states 的盲区）。
 *
 * 背景：既有门禁只识别模板里 `.status/.role/.type/.direction` 四种后缀的裸插值，
 * 以及 *-concepts.json 注册表内已登记概念；对「表单绑定字段后缀」「dataScope」等
 * 命中不到。本脚本做两件事：
 *   1. 模板文本插值中，字段后缀命中枚举命名但未经过 label/META/LABELS 投影 → 报错；
 *   2. 列出「有枚举取值但全仓无中文映射」的类型 → 仅提示（非展示枚举可不映射）。
 *
 * 用法：node scripts/audit-business-enums.mjs [--report]
 */

const root = process.cwd()
const reportOnly = process.argv.includes('--report')
const srcDir = path.join(root, 'src')

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, acc)
    else if (/\.(vue|ts)$/.test(entry.name)) acc.push(full)
  }
  return acc
}
const files = fs.existsSync(srcDir) ? walk(srcDir) : []
const read = (file) => fs.readFileSync(file, 'utf8')
const relative = (file) => path.relative(root, file)

/** 枚举命名后缀：字段尾部命中即视为「可能是枚举」。 */
const ENUM_FIELD = /(status|role|type|direction|kind|mode|stage|level|source|origin|scope|category|priority|category|decision|way|method|state)$/i

/** 已知的中文投影入口写法：命中即认为已投影。 */
const PROJECTED = /\.label\b|LABELS|META|optionLabel|roleLabel|statusMeta|stateMeta|Meta\(|Name\b|Text\b|format[A-Z]|\.name\b|_LABELS|_META/

/** 已知非枚举的字段白名单（后端自由文本或已中文串），命中即跳过。 */
const ALLOWLIST = new Set([
  'mainAction', 'ownerRole', 'ownerRoleName', 'actionText',
  // 后端返回的自由文本分类名（`quote-sheet.ts` / `formula-guide.ts` 均声明为 string，非枚举）
  'category', 'source'
])
/** 显式承认的例外：`X ?? x` 兜底写法——已映射但保留原值兜底，仅提示不报错。 */
const FALLBACK_ALLOWED = [
  'src/views/finance/FinanceProjectView.vue'
]
const fallbacks = []

// ---------- 1) 模板裸枚举插值 ----------
const bareIssues = []
for (const file of files) {
  if (!file.endsWith('.vue')) continue
  const source = read(file)
  const tplStart = source.indexOf('<template>')
  const tplEnd = source.indexOf('</template>')
  if (tplStart < 0 || tplEnd < 0) continue
  const template = source.slice(tplStart, tplEnd)
  const lineOf = (index) => source.slice(0, index).split('\n').length

  for (const match of template.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
    const expression = match[1].trim()
    if (PROJECTED.test(expression)) continue
    // 只取表达式里最后一个属性名（忽略函数调用与索引）
    const field = expression
      .replace(/\?\./g, '.')
      .split('.')
      .pop()
      .replace(/\(.*/, '')
      .replace(/\[.*/, '')
      .trim()
    if (!field || ALLOWLIST.has(field)) continue
    if (!ENUM_FIELD.test(field)) continue
    // 形如 funcName(xx) 的纯函数调用（无属性链）不算字段
    if (!expression.includes('.')) continue
    const line = `${relative(file)}:${lineOf(match.index)}  直接渲染疑似枚举 {{ ${expression} }}`
    if (FALLBACK_ALLOWED.includes(relative(file)) && /\?\?|\|\|/.test(expression)) { fallbacks.push(line); continue }
    bareIssues.push(line)
  }
}

// ---------- 2) 无中文映射的枚举类型 ----------
const enums = new Map()
const enumRe = /export type ([A-Za-z0-9_]+)\s*=\s*((?:'[^']*'\s*\|\s*)*'[^']*')/g
for (const file of files) {
  if (!file.endsWith('.ts')) continue
  const source = read(file)
  let m
  while ((m = enumRe.exec(source))) {
    enums.set(m[1], {
      file: relative(file),
      values: [...m[2].matchAll(/'([^']*)'/g)].map((x) => x[1])
    })
  }
}
const HAN = /[\u4e00-\u9fff]/
function mappedValues(typeName) {
  const covered = new Set()
  for (const file of files) {
    const source = read(file)
    const blockRe = new RegExp(`Record<\\s*${typeName}\\s*,[^=]*=\\s*\\{`, 'g')
    let m
    while ((m = blockRe.exec(source))) {
      const braceAt = source.indexOf('{', m.index + m[0].length - 1)
      let depth = 0
      let i = braceAt
      for (; i < source.length; i++) {
        if (source[i] === '{') depth++
        else if (source[i] === '}') {
          depth--
          if (depth === 0) break
        }
      }
      const block = source.slice(braceAt, i + 1)
      for (const km of block.matchAll(/['"]?([A-Za-z0-9_]+)['"]?\s*:\s*([^\n]+)/g)) {
        if (HAN.test(km[2])) covered.add(km[1])
      }
    }
  }
  return covered
}
const unmapped = []
for (const [name, info] of [...enums].sort()) {
  const covered = mappedValues(name)
  const missing = info.values.filter((v) => !covered.has(v))
  if (missing.length) unmapped.push(`${name} (${info.file}) 未映射: ${missing.join(', ')}`)
}

// ---------- 输出 ----------
const issues = [...bareIssues]
console.log(`枚举类型总数：${enums.size}；模板裸枚举展示问题：${bareIssues.length}`)
if (bareIssues.length) {
  console[reportOnly ? 'log' : 'error']('模板中直接渲染疑似枚举（必须使用 *_META/_LABELS 中文映射）：')
  for (const issue of bareIssues) console[reportOnly ? 'log' : 'error'](`- ${issue}`)
}
if (fallbacks.length) {
  console.log('提示（已映射 + 原值兜底，保留观察）：')
  for (const item of fallbacks) console.log(`- ${item}`)
}
if (unmapped.length) {
  console.log('提示（非报错）：以下枚举未发现中文映射，需确认是否为不展示的内部枚举：')
  for (const item of unmapped) console.log(`- ${item}`)
}
if (issues.length && !reportOnly) process.exit(1)
if (!issues.length) console.log('枚举中文投影检查通过。')
