import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const actionPath = path.join(root, 'docs/standards/business-action-policies.json')
const statePath = path.join(root, 'docs/standards/business-state-machines.json')
const conceptPath = path.join(root, 'docs/standards/business-concepts.json')
const reportOnly = process.argv.includes('--report')
const issues = []

for (const file of [actionPath, statePath, conceptPath]) {
  if (!fs.existsSync(file)) issues.push(`注册文件不存在：${path.relative(root, file)}`)
}

const actionRegistry = issues.length ? { actions: [] } : JSON.parse(fs.readFileSync(actionPath, 'utf8'))
const stateRegistry = issues.length ? { objects: [] } : JSON.parse(fs.readFileSync(statePath, 'utf8'))
const conceptRegistry = issues.length ? { concepts: [] } : JSON.parse(fs.readFileSync(conceptPath, 'utf8'))
const actions = Array.isArray(actionRegistry.actions) ? actionRegistry.actions : []
const objects = Array.isArray(stateRegistry.objects) ? stateRegistry.objects : []
const concepts = Array.isArray(conceptRegistry.concepts) ? conceptRegistry.concepts : []
const stateByKey = new Map(objects.map((item) => [item.key, item]))
const conceptKeys = new Set(concepts.map((item) => item.key))
const projectionScopes = new Set(stateRegistry.projectionScopes ?? [])
const actionKeys = new Set()
const required = [
  'key', 'label', 'object', 'provider', 'roles', 'scope', 'from', 'to',
  'preconditions', 'idempotency', 'confirmation', 'audit', 'reloadScopes',
  'moneyImpact', 'failureRecovery', 'decisionStatus', 'businessRefs'
]

function statusSet(objectKey) {
  const object = stateByKey.get(objectKey)
  return new Set((object?.statuses ?? []).map((item) => item.value))
}

function expand(values) {
  if (!values) return []
  const list = Array.isArray(values) ? values : [values]
  return list.flatMap((value) => String(value).split('|').map((item) => item.trim()).filter(Boolean))
}

for (const action of actions) {
  for (const field of required) {
    if (!(field in action)) issues.push(`动作 ${action.key ?? '(未命名)'} 缺少字段 ${field}`)
  }
  if (!action.key || actionKeys.has(action.key)) issues.push(`动作 key 缺失或重复：${action.key}`)
  actionKeys.add(action.key)
  if (!stateByKey.has(action.object) && !conceptKeys.has(action.object)) {
    issues.push(`动作 ${action.key} 的业务对象未登记：${action.object}`)
  }
  if (!Array.isArray(action.roles) || !action.roles.length) issues.push(`动作 ${action.key} 没有角色声明`)
  if (!Array.isArray(action.preconditions) || !action.preconditions.length) issues.push(`动作 ${action.key} 没有前置条件`)
  if (!Array.isArray(action.audit) || !action.audit.length) issues.push(`动作 ${action.key} 没有审计要求`)
  if (!Array.isArray(action.reloadScopes) || !action.reloadScopes.length) issues.push(`动作 ${action.key} 没有闭环刷新范围`)
  for (const scope of action.reloadScopes ?? []) {
    if (!stateByKey.has(scope) && !conceptKeys.has(scope) && !projectionScopes.has(scope)) {
      issues.push(`动作 ${action.key} reloadScope 未登记：${scope}`)
    }
  }
  if (!['frozen', 'pending_business_review'].includes(action.decisionStatus)) {
    issues.push(`动作 ${action.key} decisionStatus 非法：${action.decisionStatus}`)
  }
  if (action.decisionStatus === 'frozen') {
    const objectStatuses = statusSet(action.object)
    for (const status of expand(action.from)) {
      if (!objectStatuses.has(status)) issues.push(`动作 ${action.key} from 引用未注册状态：${status}`)
    }
    for (const status of expand(action.to)) {
      if (!objectStatuses.has(status)) issues.push(`动作 ${action.key} to 引用未注册状态：${status}`)
    }
    if (!action.idempotency) issues.push(`动作 ${action.key} frozen 但缺少幂等策略`)
    if (!action.failureRecovery) issues.push(`动作 ${action.key} frozen 但缺少失败恢复`)
  }
}

const wildcardPatterns = actions
  .filter((action) => action.key.includes('*'))
  .map((action) => ({ key: action.key, regex: new RegExp(`^${action.key.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`) }))

for (const object of objects) {
  for (const policy of object.actionPolicy ?? []) {
    const matched = actionKeys.has(policy) || wildcardPatterns.some((entry) => entry.key === policy || entry.regex.test(policy))
    if (!matched) issues.push(`状态机 ${object.key} 的动作未登记：${policy}`)
  }
}

for (const action of actions) {
  if (action.moneyImpact === true) {
    const accountingScopes = action.reloadScopes.filter((scope) => /receivable|payable|ledger|projectReport|cost|finance|contract|quote/.test(scope))
    if (!accountingScopes.length) issues.push(`金额动作 ${action.key} 未声明账务/金额闭环范围`)
  }
}

if (issues.length) {
  console[reportOnly ? 'log' : 'error']('业务动作与闭环检查发现问题：')
  for (const issue of issues) console[reportOnly ? 'log' : 'error'](`- ${issue}`)
  if (!reportOnly) process.exit(1)
} else {
  console.log('业务动作注册与服务端闭环范围检查通过。')
}
