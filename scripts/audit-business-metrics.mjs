import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const file = path.join(root, 'docs/standards/business-metric-definitions.json')
const reportOnly = process.argv.includes('--report')
const issues = []
const warnings = []
if (!fs.existsSync(file)) {
  console.error('指标注册表不存在：docs/standards/business-metric-definitions.json')
  process.exit(1)
}
const registry = JSON.parse(fs.readFileSync(file, 'utf8'))
const metrics = Array.isArray(registry.metrics) ? registry.metrics : []
const keys = new Set()
const required = ['key','label','decisionStatus','implementationStatus','formula','numerator','denominator','unit','aggregation','window','dimensions','filters','exclusions','missingValue','display','source','businessRefs']
const units = new Set(['amount','percent','count','ratio','boolean','duration'])
const decisions = new Set(['draft','pending_business_review','approved','frozen'])
const implementations = new Set(['implemented','mismatch','pending'])

for (const metric of metrics) {
  for (const field of required) if (!(field in metric)) issues.push(`指标 ${metric.key ?? '(未命名)'} 缺少字段 ${field}`)
  if (!metric.key || keys.has(metric.key)) issues.push(`指标 key 缺失或重复：${metric.key}`)
  keys.add(metric.key)
  if (!units.has(metric.unit)) issues.push(`指标 ${metric.key} unit 非法：${metric.unit}`)
  if (!decisions.has(metric.decisionStatus)) issues.push(`指标 ${metric.key} decisionStatus 非法：${metric.decisionStatus}`)
  if (!implementations.has(metric.implementationStatus)) issues.push(`指标 ${metric.key} implementationStatus 非法：${metric.implementationStatus}`)
  if (!metric.formula) issues.push(`指标 ${metric.key} 缺少公式/口径说明`)
  if (!metric.missingValue) issues.push(`指标 ${metric.key} 缺少缺失值规则`)
  if (!metric.source) issues.push(`指标 ${metric.key} 缺少来源`)
  if (!Array.isArray(metric.businessRefs) || !metric.businessRefs.length) issues.push(`指标 ${metric.key} 缺少业务规则引用`)
  if (metric.unit === 'percent' && metric.numerator === undefined) issues.push(`指标 ${metric.key} 百分比指标缺少分子`)
  if (metric.unit === 'percent' && metric.denominator === undefined) issues.push(`指标 ${metric.key} 百分比指标缺少分母`)
  if (/profit|margin/i.test(metric.key) && !/costComplete|成本未完整/.test(metric.missingValue)) {
    issues.push(`利润指标 ${metric.key} 缺失值必须声明成本完整性规则`)
  }
  if (metric.implementationStatus === 'mismatch') warnings.push(`${metric.key} 当前实现与正式口径不一致：${metric.implementationNote ?? '需补充差异说明'}`)
}

if (warnings.length) {
  console.log('指标实现差异（不阻断注册检查，但不得对外作为正式结果）：')
  for (const warning of warnings) console.log(`- ${warning}`)
}

if (issues.length) {
  console[reportOnly ? 'log' : 'error']('业务指标注册检查发现问题：')
  for (const issue of issues) console[reportOnly ? 'log' : 'error'](`- ${issue}`)
  if (!reportOnly) process.exit(1)
} else {
  console.log('业务指标注册、缺失值口径和业务规则引用检查通过。')
}
