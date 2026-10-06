import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const registryPath = path.join(root, 'docs/standards/business-concepts.json')
const reportOnly = process.argv.includes('--report')

if (!fs.existsSync(registryPath)) {
  console.error('业务概念注册表不存在：docs/standards/business-concepts.json')
  process.exit(1)
}

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
const concepts = Array.isArray(registry.concepts) ? registry.concepts : []
const issues = []
const requiredFields = [
  'key', 'label', 'source', 'status', 'picker', 'selectedSummary',
  'identityFields', 'displayFields', 'enumSets', 'dependencies',
  'clearRules', 'businessRefs', 'testCases'
]

const keys = new Set()
for (const concept of concepts) {
  for (const field of requiredFields) {
    if (!(field in concept)) issues.push(`概念 ${concept.key ?? '(未命名)'} 缺少字段 ${field}`)
  }
  if (!concept.key || keys.has(concept.key)) issues.push(`概念 key 缺失或重复：${concept.key}`)
  keys.add(concept.key)
  if (concept.picker && !fs.existsSync(path.join(root, concept.picker))) {
    issues.push(`概念 ${concept.key} 的选择器文件不存在：${concept.picker}`)
  }
  if (concept.status === 'implemented' && !concept.picker) {
    issues.push(`概念 ${concept.key} 标记 implemented 但没有 picker`)
  }
  if (concept.status === 'implemented' && concept.selectedSummary === 'none') {
    issues.push(`概念 ${concept.key} 标记 implemented 但没有已选回显`)
  }
}

const registeredPickers = new Set(concepts.map((item) => item.picker).filter(Boolean))
const pickerDirs = [
  'src/components/picker',
  'src/views/designer/components'
]
for (const dir of pickerDirs) {
  const absolute = path.join(root, dir)
  if (!fs.existsSync(absolute)) continue
  for (const name of fs.readdirSync(absolute)) {
    if (!name.endsWith('Picker.vue')) continue
    const relative = path.join(dir, name).split(path.sep).join('/')
    if (!registeredPickers.has(relative)) issues.push(`选择器未登记到业务概念注册表：${relative}`)
  }
}

const conceptAliases = {
  project: ['projectId', 'project'],
  customer: ['customerId', 'customer'],
  property: ['propertyId', 'property'],
  employee: ['empId', 'employeeId', 'employee'],
  worker: ['workerId', 'worker'],
  supplier: ['supplierId', 'partnerId', 'supplier', 'partner'],
  receivable: ['receivableId', 'receivable'],
  payable: ['payableId', 'payable'],
  contractChange: ['changeId', 'contractChangeId', 'contractChange'],
  catalogItem: ['catalogItemId', 'catalogItem'],
  ledgerCategory: ['ledgerCategoryId', 'accountCategoryId', 'categoryNodeId']
}

const scanRoots = [
  'src/components/picker',
  'src/components/finance',
  'src/views/finance',
  'src/views/designer'
]

function walk(dir) {
  const absolute = path.join(root, dir)
  if (!fs.existsSync(absolute)) return []
  const result = []
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = path.join(dir, entry.name).split(path.sep).join('/')
    if (entry.isDirectory()) result.push(...walk(relative))
    if (entry.isFile() && entry.name.endsWith('.vue')) result.push(relative)
  }
  return result
}

const vueFiles = [...new Set(scanRoots.flatMap(walk))]
for (const relative of vueFiles) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8')
  for (const [concept, aliases] of Object.entries(conceptAliases)) {
    for (const alias of aliases) {
      const pattern = new RegExp(`<el-select[^>]*v-model="[^"]*(?:${alias})`, 'i')
      if (pattern.test(source)) issues.push(`${relative}: ${concept} 疑似使用 el-select 承载远程业务对象（${alias}）`)
    }
  }
  const mustachePattern = /{{\s*([^}]+?)\s*}}/g
  for (const match of source.matchAll(mustachePattern)) {
    const expression = match[1].trim()
    if (!/^[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*\.(status|role|type|direction)$/.test(expression)) continue
    issues.push(`${relative}: 检测到直接渲染业务枚举（${expression}），必须使用 *_META/_LABELS 中文映射`)
  }
}

if (issues.length) {
  console[reportOnly ? 'log' : 'error']('业务概念检查发现问题：')
  for (const issue of issues) console[reportOnly ? 'log' : 'error'](`- ${issue}`)
  if (!reportOnly) process.exit(1)
} else {
  console.log('业务概念注册、选择器和枚举展示检查通过。')
}
