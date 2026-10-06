import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const permissionPath = path.join(root, 'docs/standards/business-permission-policies.json')
const actionPath = path.join(root, 'docs/standards/business-action-policies.json')
const reportOnly = process.argv.includes('--report')
const issues = []
for (const file of [permissionPath, actionPath]) if (!fs.existsSync(file)) issues.push(`注册文件不存在：${path.relative(root, file)}`)
if (issues.length) {
  console.error(issues.join('\n'))
  process.exit(1)
}
const permissionRegistry = JSON.parse(fs.readFileSync(permissionPath, 'utf8'))
const actionRegistry = JSON.parse(fs.readFileSync(actionPath, 'utf8'))
const policies = Array.isArray(permissionRegistry.policies) ? permissionRegistry.policies : []
const actions = Array.isArray(actionRegistry.actions) ? actionRegistry.actions : []
const roles = new Set(permissionRegistry.roles ?? [])
const scopes = new Set(permissionRegistry.scopes ?? [])
const sensitivities = new Set(permissionRegistry.sensitivities ?? [])
const effects = new Set(['allow', 'deny', 'mask'])
const keys = new Set()
const required = ['key','label','object','roles','scope','provider','effect','conditions','sensitivity','businessRefs']
for (const policy of policies) {
  for (const field of required) if (!(field in policy)) issues.push(`权限 ${policy.key ?? '(未命名)'} 缺少字段 ${field}`)
  if (!policy.key || keys.has(policy.key)) issues.push(`权限 key 缺失或重复：${policy.key}`)
  keys.add(policy.key)
  for (const role of policy.roles ?? []) if (!roles.has(role)) issues.push(`权限 ${policy.key} 角色未登记：${role}`)
  for (const scope of policy.scope ?? []) if (!scopes.has(scope)) issues.push(`权限 ${policy.key} 数据范围未登记：${scope}`)
  if (!effects.has(policy.effect)) issues.push(`权限 ${policy.key} effect 非法：${policy.effect}`)
  if (!sensitivities.has(policy.sensitivity)) issues.push(`权限 ${policy.key} sensitivity 非法：${policy.sensitivity}`)
  if (!Array.isArray(policy.conditions) || !policy.conditions.length) issues.push(`权限 ${policy.key} 缺少条件`)
  if (!Array.isArray(policy.businessRefs) || !policy.businessRefs.length) issues.push(`权限 ${policy.key} 缺少业务规则引用`)
}
for (const action of actions) {
  for (const role of action.roles ?? []) if (!roles.has(role)) issues.push(`动作 ${action.key} 角色未在权限注册表登记：${role}`)
  for (const rawScope of action.scope ? String(action.scope).split('|') : []) {
    const scope = rawScope.trim()
    if (scope && !scopes.has(scope)) issues.push(`动作 ${action.key} 数据范围未在权限注册表登记：${scope}`)
  }
}
if (issues.length) {
  console[reportOnly ? 'log' : 'error']('业务权限注册检查发现问题：')
  for (const issue of issues) console[reportOnly ? 'log' : 'error'](`- ${issue}`)
  if (!reportOnly) process.exit(1)
} else {
  console.log('业务权限、角色、数据范围和动作角色检查通过。')
}
