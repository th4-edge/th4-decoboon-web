import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const statePath = path.join(root, 'docs/standards/business-state-machines.json')
const conceptPath = path.join(root, 'docs/standards/business-concepts.json')
const reportOnly = process.argv.includes('--report')
const issues = []

for (const file of [statePath, conceptPath]) {
  if (!fs.existsSync(file)) issues.push(`注册文件不存在：${path.relative(root, file)}`)
}

const stateRegistry = issues.length ? { objects: [] } : JSON.parse(fs.readFileSync(statePath, 'utf8'))
const conceptRegistry = issues.length ? { concepts: [] } : JSON.parse(fs.readFileSync(conceptPath, 'utf8'))
const objects = Array.isArray(stateRegistry.objects) ? stateRegistry.objects : []
const concepts = Array.isArray(conceptRegistry.concepts) ? conceptRegistry.concepts : []
const keys = new Set()

for (const object of objects) {
  if (!object.key || keys.has(object.key)) issues.push(`状态机 key 缺失或重复：${object.key}`)
  keys.add(object.key)
  if (!object.label) issues.push(`状态机 ${object.key} 缺少 label`)
  if (!object.source) issues.push(`状态机 ${object.key} 缺少 source`)
  if (!Array.isArray(object.statuses) || !object.statuses.length) {
    issues.push(`状态机 ${object.key} 没有状态定义`)
    continue
  }
  const statusValues = new Set()
  for (const status of object.statuses) {
    if (!status.value || statusValues.has(status.value)) issues.push(`状态机 ${object.key} 状态值缺失或重复：${status.value}`)
    statusValues.add(status.value)
    if (!status.label) issues.push(`状态机 ${object.key}.${status.value} 缺少中文 label`)
    if (!status.tone) issues.push(`状态机 ${object.key}.${status.value} 缺少 tone`)
    if (!Array.isArray(status.serverValues) || !status.serverValues.length) {
      issues.push(`状态机 ${object.key}.${status.value} 缺少 serverValues`)
    }
  }
  for (const transition of object.transitions ?? []) {
    if (!transition.from?.every((value) => statusValues.has(value))) issues.push(`状态机 ${object.key} transition.from 引用未注册状态`)
    if (transition.to && !statusValues.has(transition.to)) issues.push(`状态机 ${object.key} transition.to 引用未注册状态`)
    if (!transition.action) issues.push(`状态机 ${object.key} 存在无 action 的 transition`)
  }
  if (object.transitionStatus === 'frozen' && !(object.transitions ?? []).length) {
    issues.push(`状态机 ${object.key} 标记 frozen 但没有 transition`)
  }
}

const requiredStateKeys = [
  'customer', 'property', 'project', 'design', 'quote', 'contract',
  'contractChange', 'receivable', 'payable', 'acceptance',
  'projectStage', 'projectTask'
]
for (const key of requiredStateKeys) {
  if (!keys.has(key)) issues.push(`缺少必备状态机：${key}`)
}

for (const concept of concepts) {
  const enumSets = concept.enumSets ?? []
  const stateRelated = enumSets.some((name) => /Status|Stage|State/.test(name))
  if (stateRelated && !keys.has(concept.key) && concept.stateMachineStatus !== 'pending_business_review') {
    issues.push(`业务概念 ${concept.key} 含状态枚举但未登记状态机`)
  }
}

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

for (const relative of ['src/views', 'src/components'].flatMap(walk)) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8')
  for (const match of source.matchAll(/{{\s*([^}]+?)\s*}}/g)) {
    const expression = match[1].trim()
    if (!/^[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*\.(status|stage|state)$/.test(expression)) continue
    issues.push(`${relative}: 直接展示裸状态（${expression}），必须使用状态 META 或 BusinessStateView`)
  }
}

if (issues.length) {
  console[reportOnly ? 'log' : 'error']('业务状态机检查发现问题：')
  for (const issue of issues) console[reportOnly ? 'log' : 'error'](`- ${issue}`)
  if (!reportOnly) process.exit(1)
} else {
  console.log('业务状态机注册、状态中文和裸状态展示检查通过。')
}
