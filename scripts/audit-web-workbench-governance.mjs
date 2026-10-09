import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const args = process.argv.slice(2)
const reportOnly = args.includes('--report')
const menuReport = args.includes('--menu-report')
const modeArg = args.find((arg) => arg.startsWith('--mode='))
const mode = modeArg ? modeArg.split('=')[1] : 'all'
const issues = []
const warnings = []

function readJson(relative, fallback) {
  const absolute = path.join(root, relative)
  if (!fs.existsSync(absolute)) {
    issues.push(`注册文件不存在：${relative}`)
    return fallback
  }
  try {
    return JSON.parse(fs.readFileSync(absolute, 'utf8'))
  } catch (error) {
    issues.push(`注册文件不是合法 JSON：${relative}；${error.message}`)
    return fallback
  }
}

const registry = readJson('docs/standards/workbench-navigation.json', {})
const stateRegistry = readJson('docs/standards/business-state-machines.json', { objects: [] })
const conceptRegistry = readJson('docs/standards/business-concepts.json', { concepts: [] })
const actionRegistry = readJson('docs/standards/business-action-policies.json', { actions: [] })

const domains = Array.isArray(registry.domains) ? registry.domains : []
const groups = Array.isArray(registry.groups) ? registry.groups : []
const workbenches = Array.isArray(registry.workbenches) ? registry.workbenches : []
const stateObjects = Array.isArray(stateRegistry.objects) ? stateRegistry.objects : []
const concepts = Array.isArray(conceptRegistry.concepts) ? conceptRegistry.concepts : []
const actions = Array.isArray(actionRegistry.actions) ? actionRegistry.actions : []

const validRoles = new Set(['Boss', 'StoreManager', 'TeamLeader', 'Marketer', 'Designer', 'Pm', 'Finance'])
const validKinds = new Set(['aggregate', 'queue', 'object', 'workspace'])
const validPriorities = new Set(['P0', 'P1', 'P2'])
const validDecisionStatuses = new Set(['approved', 'pending_business_review'])
const requiredDomainKeys = ['today', 'customer', 'project', 'finance', 'operation', 'more']
const requiredRegistryFields = ['version', 'updated', 'sources', 'domains', 'groups', 'workbenches']
const requiredWorkbenchFields = [
  'key', 'label', 'domain', 'group', 'kind', 'roles', 'entryScenario', 'inboundStates',
  'objectAnchor', 'mainline', 'currentWorkSurface', 'mainAction', 'actionPolicyKeys',
  'handoff', 'handoffTo', 'priority', 'deepLink', 'emptyState', 'exceptionState',
  'contextRecovery', 'unsavedChangesGuard', 'reloadScopes', 'decisionStatus', 'businessRefs'
]

const domainKeys = new Set(domains.map((item) => item.key))
const groupByKey = new Map(groups.map((item) => [item.key, item]))
const groupKeys = new Set(groups.map((item) => item.key))
const workbenchKeys = new Set(workbenches.map((item) => item.key))
const stateByKey = new Map(stateObjects.map((item) => [item.key, item]))
const conceptKeys = new Set(concepts.map((item) => item.key))
const actionKeys = new Set(actions.map((item) => item.key))
const wildcardPatterns = actions
  .filter((item) => String(item.key).includes('*'))
  .map((item) => ({
    key: item.key,
    regex: new RegExp(`^${String(item.key).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`)
  }))

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0
}

function actionKeyExists(key) {
  return actionKeys.has(key) || wildcardPatterns.some((entry) => entry.key === key || entry.regex.test(key))
}

function validateRegistryShape() {
  for (const field of requiredRegistryFields) {
    if (!(field in registry)) issues.push(`工作台注册表缺少字段：${field}`)
  }
  if (registry.version !== 1) issues.push(`工作台注册表 version 必须为 1，当前为 ${registry.version}`)
  if (!isNonEmptyString(registry.updated)) issues.push('工作台注册表 updated 必须为 YYYY-MM-DD')
  if (!isNonEmptyArray(registry.sources)) issues.push('工作台注册表 sources 不能为空')

  const domainOrders = new Set()
  for (const domain of domains) {
    if (!isNonEmptyString(domain.key)) issues.push('domain.key 缺失')
    if (!isNonEmptyString(domain.label)) issues.push(`domain ${domain.key} label 缺失`)
    if (!Number.isInteger(domain.order) || domain.order < 0) issues.push(`domain ${domain.key} order 非法`)
    if (domainOrders.has(domain.order)) issues.push(`domain order 重复：${domain.order}`)
    domainOrders.add(domain.order)
  }
  for (const key of requiredDomainKeys) {
    if (!domainKeys.has(key)) issues.push(`一级领域缺少：${key}`)
  }
  if (domains.length > 7) issues.push(`一级领域超过 7 项：${domains.length}`)

  const groupOrders = new Set()
  for (const group of groups) {
    if (!isNonEmptyString(group.key)) issues.push('group.key 缺失')
    if (!isNonEmptyString(group.label)) issues.push(`group ${group.key} label 缺失`)
    if (!domainKeys.has(group.domain)) issues.push(`group ${group.key} domain 未登记：${group.domain}`)
    if (!Number.isInteger(group.order) || group.order < 0) issues.push(`group ${group.key} order 非法`)
    const orderKey = `${group.domain}:${group.order}`
    if (groupOrders.has(orderKey)) issues.push(`group order 重复：${orderKey}`)
    groupOrders.add(orderKey)
  }
}

function validateNavigation(workbench) {
  for (const field of ['key', 'label', 'domain', 'group', 'kind', 'entryScenario', 'priority', 'deepLink', 'emptyState', 'exceptionState', 'handoff', 'decisionStatus']) {
    if (!(field in workbench)) issues.push(`工作台 ${workbench.key ?? '(未命名)'} 缺少字段 ${field}`)
  }
  if (!isNonEmptyString(workbench.key)) issues.push('工作台 key 缺失')
  if (!isNonEmptyString(workbench.label)) issues.push(`工作台 ${workbench.key} label 缺失`)
  if (!domainKeys.has(workbench.domain)) issues.push(`工作台 ${workbench.key} domain 未登记：${workbench.domain}`)
  const group = groupByKey.get(workbench.group)
  if (!group) issues.push(`工作台 ${workbench.key} group 未登记：${workbench.group}`)
  else if (group.domain !== workbench.domain) issues.push(`工作台 ${workbench.key} group=${workbench.group} 不属于 domain=${workbench.domain}`)
  if (!validKinds.has(workbench.kind)) issues.push(`工作台 ${workbench.key} kind 非法：${workbench.kind}`)
  if (!validPriorities.has(workbench.priority)) issues.push(`工作台 ${workbench.key} priority 非法：${workbench.priority}`)
  if (!validDecisionStatuses.has(workbench.decisionStatus)) issues.push(`工作台 ${workbench.key} decisionStatus 非法：${workbench.decisionStatus}`)
  if (!Array.isArray(workbench.roles) || !workbench.roles.length) issues.push(`工作台 ${workbench.key} roles 不能为空`)
  for (const role of workbench.roles ?? []) if (!validRoles.has(role)) issues.push(`工作台 ${workbench.key} 角色未登记：${role}`)
  if (!isNonEmptyString(workbench.entryScenario)) issues.push(`工作台 ${workbench.key} entryScenario 缺失`)
  if (!isNonEmptyString(workbench.deepLink) || !workbench.deepLink.startsWith('/')) issues.push(`工作台 ${workbench.key} deepLink 必须为 / 开头`)
  if (!isNonEmptyString(workbench.emptyState)) issues.push(`工作台 ${workbench.key} emptyState 缺失`)
  if (!isNonEmptyString(workbench.exceptionState)) issues.push(`工作台 ${workbench.key} exceptionState 缺失`)
  if (!isNonEmptyString(workbench.handoff)) issues.push(`工作台 ${workbench.key} handoff 缺失`)
  if (!Array.isArray(workbench.handoffTo)) issues.push(`工作台 ${workbench.key} handoffTo 必须为数组`)
  for (const target of workbench.handoffTo ?? []) {
    if (!workbenchKeys.has(target)) issues.push(`工作台 ${workbench.key} handoffTo 未登记：${target}`)
  }
  if (String(workbench.label).includes('管理') && !isNonEmptyString(workbench.labelException)) {
    issues.push(`工作台 ${workbench.key} label 不得使用模块式“管理”命名：${workbench.label}`)
  }
  if (!Array.isArray(workbench.businessRefs) || !workbench.businessRefs.length) {
    issues.push(`工作台 ${workbench.key} businessRefs 不能为空`)
  } else {
    if (!workbench.businessRefs.includes('DEC-034') && !workbench.businessRefs.includes('BR-030')) {
      issues.push(`工作台 ${workbench.key} businessRefs 必须引用 DEC-034 或 BR-030`)
    }
    if (!workbench.businessRefs.some((ref) => String(ref).startsWith('BR-') || String(ref).startsWith('SCN-'))) {
      issues.push(`工作台 ${workbench.key} businessRefs 至少引用一个 BR-* 或 SCN-*`)
    }
  }
}

function validateWorkspace(workbench) {
  for (const field of ['key', 'objectAnchor', 'mainline', 'currentWorkSurface', 'mainAction', 'actionPolicyKeys', 'contextRecovery', 'unsavedChangesGuard', 'reloadScopes']) {
    if (!(field in workbench)) issues.push(`工作台 ${workbench.key ?? '(未命名)'} 缺少对象工作空间字段 ${field}`)
  }
  if (!isNonEmptyString(workbench.objectAnchor)) issues.push(`工作台 ${workbench.key} objectAnchor 缺失`)
  if (!isNonEmptyString(workbench.mainline)) issues.push(`工作台 ${workbench.key} mainline 缺失`)
  if (!isNonEmptyString(workbench.currentWorkSurface)) issues.push(`工作台 ${workbench.key} currentWorkSurface 缺失`)
  if (!isNonEmptyString(workbench.mainAction)) issues.push(`工作台 ${workbench.key} mainAction 缺失`)
  if (!Array.isArray(workbench.actionPolicyKeys)) issues.push(`工作台 ${workbench.key} actionPolicyKeys 必须为数组`)
  for (const actionKey of workbench.actionPolicyKeys ?? []) {
    if (!actionKeyExists(actionKey)) issues.push(`工作台 ${workbench.key} actionPolicyKey 未登记：${actionKey}`)
  }
  if (workbench.kind !== 'aggregate' && !isNonEmptyArray(workbench.actionPolicyKeys)) {
    warnings.push(`工作台 ${workbench.key} 没有已登记动作；实现前必须补齐动作注册或显示待业务确认`)
  }
  if (!workbench.contextRecovery || typeof workbench.contextRecovery !== 'object') {
    issues.push(`工作台 ${workbench.key} contextRecovery 缺失`)
  } else {
    for (const key of ['deepLink', 'preserveFilters', 'preserveScroll', 'preserveDraft', 'returnToSource']) {
      if (typeof workbench.contextRecovery[key] !== 'boolean') issues.push(`工作台 ${workbench.key} contextRecovery.${key} 必须为布尔值`)
    }
    for (const key of ['deepLink', 'preserveFilters', 'preserveScroll', 'returnToSource']) {
      if (workbench.contextRecovery[key] !== true) issues.push(`工作台 ${workbench.key} contextRecovery.${key} 必须为 true`)
    }
  }
  if (typeof workbench.unsavedChangesGuard !== 'boolean') {
    issues.push(`工作台 ${workbench.key} unsavedChangesGuard 必须为布尔值`)
  } else if (workbench.unsavedChangesGuard === false && !isNonEmptyString(workbench.unsavedChangesReason)) {
    issues.push(`工作台 ${workbench.key} unsavedChangesGuard=false 时必须说明 unsavedChangesReason`)
  }
  if (!Array.isArray(workbench.reloadScopes)) issues.push(`工作台 ${workbench.key} reloadScopes 必须为数组`)
  if (workbench.kind !== 'aggregate' && !isNonEmptyArray(workbench.reloadScopes)) {
    issues.push(`工作台 ${workbench.key} reloadScopes 不能为空`)
  }
  if (workbench.kind !== 'aggregate' && (!Array.isArray(workbench.inboundStates) || !workbench.inboundStates.length)) {
    issues.push(`工作台 ${workbench.key} inboundStates 不能为空`)
  }
  for (const inbound of workbench.inboundStates ?? []) {
    if (!isNonEmptyString(inbound.object)) {
      issues.push(`工作台 ${workbench.key} inboundStates.object 缺失`)
      continue
    }
    if (!Array.isArray(inbound.statuses) || !inbound.statuses.length) {
      issues.push(`工作台 ${workbench.key} inboundStates.${inbound.object}.statuses 不能为空`)
      continue
    }
    const stateObject = stateByKey.get(inbound.object)
    if (!stateObject) {
      if (!conceptKeys.has(inbound.object)) {
        issues.push(`工作台 ${workbench.key} inboundStates 对象未登记：${inbound.object}`)
      } else if (workbench.decisionStatus !== 'pending_business_review') {
        warnings.push(`工作台 ${workbench.key} inboundStates 对象 ${inbound.object} 只有概念登记、没有状态机；实现前需业务确认`)
      }
      continue
    }
    const statuses = new Set((stateObject.statuses ?? []).map((item) => item.value))
    for (const status of inbound.statuses) {
      if (!statuses.has(status)) issues.push(`工作台 ${workbench.key} inboundStates 状态未登记：${inbound.object}.${status}`)
    }
  }
}

function validateDesignContract(workbench) {
  // 《WEB-工作台设计构建规范》非阻断项：登记缺失先告警，存量按批次补齐。
  if (workbench.kind === 'aggregate') return
  if (!Array.isArray(workbench.contextKeys) || !workbench.contextKeys.length) {
    warnings.push(`工作台 ${workbench.key} 未登记 contextKeys（上下文键）；按《WEB-工作台设计构建规范》§9.1 建议补齐`)
  }
  if (workbench.kind === 'queue' || workbench.kind === 'object' || workbench.kind === 'workspace') {
    if (!isNonEmptyString(workbench.stageFocusSource)) {
      warnings.push(`工作台 ${workbench.key} 未声明 stageFocusSource（当前阶段关注来源）；未裁决前页面只能显示待业务确认`)
    }
    if (!Array.isArray(workbench.primaryActionByState) || !workbench.primaryActionByState.length) {
      warnings.push(`工作台 ${workbench.key} 未登记 primaryActionByState（状态→主行动）；实现前必须补齐或显示待业务确认`)
    }
  }
}


/**
 * 菜单一致性（GAP-WEB-013）：菜单渲染源 = src/roles/workbenchConfig.ts，
 * 注册表 = 契约与校验源。两者漂移会造成「注册了但进不去」或「进了但没登记」。
 * 先以告警输出，收敛后转 issue。
 */
const MENU_NOT_IN_MENU_ALLOW = new Set(['more.search'])

function validateMenuCoverage() {
  const configPath = 'src/roles/workbenchConfig.ts'
  const absolute = path.join(root, configPath)
  if (!fs.existsSync(absolute)) {
    warnings.push(`菜单一致性检查跳过：未找到 ${configPath}`)
    return
  }
  const source = fs.readFileSync(absolute, 'utf8')
  const roleBlocks = new Map()
  const starts = []
  for (const role of validRoles) {
    const match = new RegExp(`\\n  ${role}: \\{`).exec(source)
    if (match) starts.push([role, match.index])
  }
  starts.sort((a, b) => a[1] - b[1])
  for (let i = 0; i < starts.length; i += 1) {
    const [role, start] = starts[i]
    const end = i + 1 < starts.length ? starts[i + 1][1] : source.length
    roleBlocks.set(role, source.slice(start, end))
  }

  const findings = []
  for (const role of validRoles) {
    const block = roleBlocks.get(role)
    if (!block) continue
    const menuKeys = new Set(Array.from(block.matchAll(/item\('([^']+)'/g)).map((m) => m[1]))
    const registryKeys = new Set(
      workbenches.filter((w) => (w.roles ?? []).includes(role) && w.key !== 'today.mainline').map((w) => w.key)
    )
    for (const key of registryKeys) {
      if (menuKeys.has(key) || MENU_NOT_IN_MENU_ALLOW.has(key)) continue
      findings.push(`${role} 注册表有 ${key}、菜单无`)
    }
    for (const key of menuKeys) {
      if (key === 'today.mainline' || registryKeys.has(key)) continue
      findings.push(`${role} 菜单有 ${key}、注册表无（违反 §9.1）`)
    }
  }

  // 菜单正逐角色重建为静态 TS（GAP-WEB-013），迁移期只汇总一条，避免刷屏。
  if (!findings.length) return
  warnings.push(`菜单/注册表一致性：${findings.length} 项待收敛（迁移期预期，见 GAP-WEB-013${menuReport ? '；明细如下' : '；明细用 --menu-report'}）`)
  if (menuReport) {
    for (const item of findings) warnings.push(`  菜单一致性明细：${item}`)
  }
}

validateRegistryShape()

if (mode === 'workbenches' || mode === 'all') validateMenuCoverage()

const seenKeys = new Set()
const seenLabels = new Map()
for (const workbench of workbenches) {
  if (seenKeys.has(workbench.key)) issues.push(`工作台 key 重复：${workbench.key}`)
  seenKeys.add(workbench.key)
  const labelKey = `${workbench.domain}:${workbench.label}`
  if (seenLabels.has(labelKey)) issues.push(`同一领域内工作台 label 重复：${labelKey}`)
  seenLabels.set(labelKey, workbench.key)
  if (mode === 'workbenches' || mode === 'all') validateNavigation(workbench)
  if (mode === 'workspaces' || mode === 'all') validateWorkspace(workbench)
  if (mode === 'workbenches' || mode === 'all') validateDesignContract(workbench)
}

for (const role of validRoles) {
  if (!workbenches.some((workbench) => (workbench.roles ?? []).includes(role))) {
    issues.push(`角色缺少工作台入口：${role}`)
  }
}
for (const domain of requiredDomainKeys) {
  if (!workbenches.some((workbench) => workbench.domain === domain)) {
    issues.push(`一级领域没有工作台：${domain}`)
  }
}
if (!workbenches.some((workbench) => workbench.domain === 'today' && workbench.kind === 'aggregate')) {
  issues.push('必须存在今日主线聚合工作台')
}

if (issues.length) {
  const title = mode === 'workbenches' ? '工作台导航检查发现问题：' : mode === 'workspaces' ? '对象工作空间契约检查发现问题：' : 'Web 工作台治理检查发现问题：'
  console[reportOnly ? 'log' : 'error'](title)
  for (const issue of issues) console[reportOnly ? 'log' : 'error'](`- ${issue}`)
  if (!reportOnly) process.exit(1)
} else {
  const title = mode === 'workbenches' ? '工作台导航注册检查通过。' : mode === 'workspaces' ? '对象工作空间契约检查通过。' : 'Web 工作台与对象工作空间治理检查通过。'
  console.log(title)
}
if (warnings.length) {
  for (const warning of warnings) console.log(`WARN  ${warning}`)
}
