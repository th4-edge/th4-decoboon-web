import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const reportOnly = process.argv.includes('--report')
const issues = []
const files = {
  concepts: 'docs/standards/business-concepts.json',
  states: 'docs/standards/business-state-machines.json',
  actions: 'docs/standards/business-action-policies.json',
  pageStates: 'docs/standards/business-page-states.json',
  fieldFormats: 'docs/standards/business-field-formats.json',
  pageTasks: 'docs/standards/business-page-tasks.json',
  componentBehaviors: 'docs/standards/business-component-behaviors.json',
  acceptanceScenarios: 'docs/standards/business-acceptance-scenarios.json'
}
const registry = {}
for (const [key, relative] of Object.entries(files)) {
  const absolute = path.join(root, relative)
  if (!fs.existsSync(absolute)) {
    issues.push(`注册文件不存在：${relative}`)
    registry[key] = {}
  } else {
    registry[key] = JSON.parse(fs.readFileSync(absolute, 'utf8'))
  }
}

const concepts = registry.concepts.concepts ?? []
const states = registry.states.objects ?? []
const actions = registry.actions.actions ?? []
const pageStates = registry.pageStates.states ?? []
const formats = registry.fieldFormats.formats ?? []
const tasks = registry.pageTasks.tasks ?? []
const components = registry.componentBehaviors.components ?? []
const scenarios = registry.acceptanceScenarios.scenarios ?? []

const conceptKeys = new Set(concepts.map((item) => item.key))
const stateKeys = new Set(states.map((item) => item.key))
const actionKeys = new Set(actions.map((item) => item.key))
const scenarioKeys = new Set(scenarios.map((item) => item.key))
const scenarioTypes = new Set(scenarios.map((item) => item.type))

const requiredPageStates = ['loading','empty','error','unauthorized','expired','partial','stale','success']
for (const key of requiredPageStates) if (!pageStates.some((item) => item.key === key)) issues.push(`页面状态缺少：${key}`)
const requiredFormats = ['money','percent','quantity','date','datetime','enum','status','longText','phone','idCardMasked','bankCardMasked','transactionNo','durationMs','boolean']
for (const key of requiredFormats) if (!formats.some((item) => item.key === key)) issues.push(`字段格式缺少：${key}`)

for (const task of tasks) {
  for (const field of ['key','page','role','object','currentFact','nextAction','actionPolicyKeys','ownerRole','blockers','emptyReason','stateMachineKey','acceptanceScenarios']) {
    if (!(field in task)) issues.push(`页面任务 ${task.key ?? '(未命名)'} 缺少字段 ${field}`)
  }
  if (!conceptKeys.has(task.object) && !stateKeys.has(task.object)) issues.push(`页面任务 ${task.key} 对象未登记：${task.object}`)
  if (!stateKeys.has(task.stateMachineKey)) issues.push(`页面任务 ${task.key} 状态机未登记：${task.stateMachineKey}`)
  for (const actionKey of task.actionPolicyKeys ?? []) if (!actionKeys.has(actionKey)) issues.push(`页面任务 ${task.key} 动作未登记：${actionKey}`)
  for (const scenarioRef of task.acceptanceScenarios ?? []) {
    if (!scenarioKeys.has(scenarioRef) && !scenarioTypes.has(scenarioRef)) {
      issues.push(`页面任务 ${task.key} 验收场景未登记：${scenarioRef}`)
    }
  }
}

for (const component of components) {
  for (const field of ['key','label','loading','error','retry','clear','contextChange','stale','expired','failureRecovery','accessibility','localCache']) {
    if (!(field in component)) issues.push(`组件行为 ${component.key ?? '(未命名)'} 缺少字段 ${field}`)
  }
}

const requiredScenarioTypes = ['normal','rejection','unauthorized','concurrent','closure']
for (const type of requiredScenarioTypes) if (!scenarios.some((item) => item.type === type)) issues.push(`验收场景缺少类型：${type}`)
for (const scenario of scenarios) {
  for (const field of ['key','title','type','actionPolicyKey','preconditions','steps','assertions','reloadScopes','evidence','cleanup','productionWrite']) {
    if (!(field in scenario)) issues.push(`验收场景 ${scenario.key ?? '(未命名)'} 缺少字段 ${field}`)
  }
  if (!actionKeys.has(scenario.actionPolicyKey)) issues.push(`验收场景 ${scenario.key} 动作未登记：${scenario.actionPolicyKey}`)
  if (!Array.isArray(scenario.reloadScopes) || !scenario.reloadScopes.length) issues.push(`验收场景 ${scenario.key} 缺少关联回读范围`)
}

if (issues.length) {
  console[reportOnly ? 'log' : 'error']('业务页面系统检查发现问题：')
  for (const issue of issues) console[reportOnly ? 'log' : 'error'](`- ${issue}`)
  if (!reportOnly) process.exit(1)
} else {
  console.log('页面状态、字段格式、页面任务、组件行为和验收场景注册检查通过。')
}
