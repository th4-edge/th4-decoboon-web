import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const scanRoots = ['src/views', 'src/layouts', 'src/components']
const exclusions = new Set([
  'src/views/system/ComponentPreviewView.vue',
  // 凭证模板设计与打印载体允许保留法定/套打所需的凭证号字段。
  'src/views/finance/FinanceVoucherTemplatesView.vue',
  'src/components/finance/VoucherDesignerCanvas.vue'
])

const visibleNumberLabel = /(?:员工|企业|客户|报价|合同|项目|方案|费用|凭证|邀请|房屋|变更单|单据|排行)?(?:编号|工号|单号)/
const technicalDate = /YYYY|HH:mm|LocalDateTime|value-format|\bGB\s*\d+/i
const idProperties = /\b(?:empId|comId|customerId|projectId|quoteId|contractId|expenseId|voucherId|inviteId|quoteNo|contractNo|expenseNo|voucherNo|projectNo|businessNo)\b/
const objectNumberAccess = /\{\{[^}]*\??\.no\b[^}]*\}\}|\b(?:quoteNo|contractNo|expenseNo|voucherNo|projectNo|businessNo)\b/
const visibleAttribute = /(?:placeholder|label|title|description|text|subtitle|document-title|aria-label)\s*=\s*["'][^"']*["']/

function isComment(line) {
  const value = line.trim()
  return !value || value.startsWith('//') || value.startsWith('/*') || value.startsWith('*') || value.startsWith('<!--') || value.startsWith('--')
}

function inspect(line) {
  const reasons = []
  if (technicalDate.test(line)) return reasons
  if (visibleNumberLabel.test(line)) reasons.push('用户可见编号')
  if (/\{\{[^}]*\}\}/.test(line) && (idProperties.test(line) || objectNumberAccess.test(line))) reasons.push('模板直接输出内部主键或业务号')
  if (visibleAttribute.test(line) && visibleNumberLabel.test(line)) reasons.push('可见属性要求用户理解编号')
  return [...new Set(reasons)]
}

function scan() {
  const issues = []
  for (const scanRoot of scanRoots) {
    const walk = (dir) => {
      for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
        const file = path.join(dir, entry.name).replaceAll(path.sep, '/')
        if (entry.isDirectory()) walk(file)
        else if (entry.name.endsWith('.vue') && !exclusions.has(file)) {
          fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/).forEach((line, index) => {
            if (isComment(line)) return
            const reasons = inspect(line)
            if (reasons.length) issues.push({ file, line: index + 1, reasons, text: line.trim() })
          })
        }
      }
    }
    walk(scanRoot)
  }
  return issues
}

function selfTest() {
  const bad = [
    '<div><dt>员工编号</dt><dd>{{ employee.empId }}</dd></div>',
    '<input placeholder="搜索报价编号" />',
    '<small>{{ project.no }}</small>',
    'ElMessage.success(`凭证 ${voucher.voucherNo} 已生成`)'
  ].join('\n')
  const safe = [
    '<strong>{{ customer.name }}</strong>',
    '<small>{{ project.address || \'地址待补充\' }}</small>',
    '<input placeholder="搜索客户、房屋或地址" />',
    '<div><dt>统一社会信用代码</dt><dd>{{ company.setting.uscc }}</dd></div>'
  ].join('\n')
  const badHits = bad.split('\n').flatMap(inspect)
  const safeHits = safe.split('\n').flatMap(inspect)
  if (badHits.length < 4 || safeHits.length) {
    console.error('内部编号暴露门禁负向验证失败')
    process.exit(1)
  }
  console.log('内部编号暴露门禁负向验证通过：员工编号、搜索编号、项目号和凭证号均可被识别')
}

if (process.argv.includes('--self-test')) {
  selfTest()
  process.exit(0)
}

const issues = scan()
if (issues.length) {
  console.error(`内部编号暴露门禁未通过：${issues.length} 处`)
  for (const issue of issues) {
    console.error(`- ${issue.file}:${issue.line} [${issue.reasons.join(' / ')}] ${issue.text}`)
  }
  process.exit(1)
}
console.log('内部编号暴露门禁通过：用户界面未发现内部主键、系统业务号或编号搜索提示')
