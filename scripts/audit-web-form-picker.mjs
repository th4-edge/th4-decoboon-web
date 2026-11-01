import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const srcRoot = path.join(root, 'src')
const outputPath = path.join(root, 'docs/development/WEB-FORM-PICKER-INVENTORY.md')
const write = process.argv.includes('--write')
const check = process.argv.includes('--check')
const selfTest = process.argv.includes('--self-test')


const statusOverrides = {
  'src/components/QuoteSheetGrid.vue': '专业编辑网格',
  'src/components/finance/VoucherDesignerCanvas.vue': '专业编辑器（保留）',
  'src/components/finance/FinanceReceivableDrawer.vue': '已完成：应收收据',
  'src/components/finance/FinancePayableDrawer.vue': '已完成：应付单据',
  'src/components/finance/FinanceCollectionDrawer.vue': '已完成：收款单据',
  'src/components/finance/FinancePaymentDrawer.vue': '已完成：付款单据',
  'src/components/finance/FinanceLedgerDrawer.vue': '已完成：手工记账单',
  'src/components/finance/FinanceCommissionDrawer.vue': '已完成：提成单据',
  'src/components/finance/FinanceCompensationDrawer.vue': '已完成：薪酬单据',
  'src/components/finance/FinanceAttendanceDrawer.vue': '已完成：考勤单据',
  'src/views/finance/FinanceVoucherTemplatesView.vue': '已完成：快速版式实时结果',
  'src/components/picker/CustomerPicker.vue': '已完成：客户专用选择器',
  'src/components/picker/PropertyPicker.vue': '已完成：房屋专用选择器',
  'src/components/picker/ReceivablePicker.vue': '已完成：应收专用选择器',
  'src/components/picker/PayablePicker.vue': '已完成：应付专用选择器',
  'src/components/picker/EmployeePicker.vue': '已完成：员工专用选择器',
  'src/views/designer/DesignerQuoteWorkspaceView.vue': '已完成：专业工作区',
  'src/views/designer/DesignerDesignWorkspaceView.vue': '已完成：方案上下文与空间表单',
  'src/views/designer/DesignerMaterialSelectionView.vue': '字段编辑区',
  'src/views/designer/DesignerAcceptanceView.vue': '已完成：验收提交单',
  'src/views/designer/DesignerCustomersView.vue': '已完成：客户房屋上下文',
  'src/views/designer/DesignerCatalogView.vue': '已完成：只读筛选',
  'src/views/designer/DesignerProjectsView.vue': '已完成：项目列表筛选',
  'src/views/designer/DesignerContractChangesView.vue': '已完成',
  'src/views/auth/LoginView.vue': '已完成：轻量表单'
}

function batchOf(relative) {
  if (relative.includes('FinanceVoucherTemplates') || relative.includes('VoucherDesignerCanvas')) return '批次 A'
  if (relative.startsWith('src/components/finance/') || relative.startsWith('src/views/finance/') || relative.startsWith('src/components/picker/')) return '已完成/样板'
  if (relative.includes('DesignerContractChanges')) return '批次 A'
  if (relative.includes('DesignerCustomers') || relative.includes('DesignerDesignWorkspace') || relative.includes('DesignerMaterialSelection') || relative.includes('DesignerAcceptance')) return '批次 B'
  if (relative.includes('DesignerQuote') || relative.includes('DesignCatalogPicker') || relative.includes('DesignItemSheet') || relative.includes('QuoteSheetGrid')) return '批次 C'
  return '批次 D'
}

const patterns = {
  form: /<el-form(?:\s|>)/,
  formItem: /<el-form-item\b/,
  select: /<el-select\b/,
  nativeInput: /<input\b/,
  nativeSelect: /<select\b/,
  textarea: /<textarea\b/,
  dialog: /<el-dialog\b/,
  drawer: /<el-drawer\b/,
  specializedPicker: /<(ProjectPicker|EmployeePicker|EmployeePayablePicker|ReceiptPicker|PartnerPicker|CustomerPicker|PropertyPicker|ReceivablePicker|PayablePicker|WorkerPicker|LedgerCategoryPicker|DesignCatalogPicker)\b/,
  lowLevelPicker: /<RemoteSelectionShell\b/
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    return entry.isFile() && entry.name.endsWith('.vue') ? [full] : []
  })
}

function count(map, kind) {
  return map.get(kind)?.length ?? 0
}

function statusOf(map, relative) {
  if (relative.startsWith('src/components/picker/')) return '选择器参考实现'
  if (relative === 'src/views/designer/components/DesignCatalogPicker.vue') return '选择器参考实现'
  if (count(map, 'specializedPicker') > 0) return '已接入专用选择器'
  if (count(map, 'form') > 0) return '待审计/升级'
  if (count(map, 'select') > 0) return '筛选器审计'
  if (count(map, 'nativeSelect') > 0 || count(map, 'nativeInput') > 0 || count(map, 'textarea') > 0) return '原生控件审计'
  return '事件/展示'
}

const EMPLOYEE_FIELD = /(?:^|\.)(ownerId|designerId|managerId|supportId|assigneeId|employeeId|empId)$/i
const EMPLOYEE_HINT = /(员工|负责人|设计师|项目经理|支持人|受理人|责任人)/
const REMOTE_FINANCE_FIELD = /(?:^|\.)(receiptId|receivableId|payableId)$/i
const FINANCE_OBJECT_HINT = /(原收款|收款记录|待发应付|应收节点|应付单)/

function auditSource(relative, source) {
  const issues = []
  for (const match of source.matchAll(/<el-select\b[\s\S]*?>/g)) {
    const tag = match[0]
    const model = (tag.match(/v-model(?::[\w-]+)?="([^"]+)"/) ?? [])[1] ?? ''
    const placeholder = (tag.match(/placeholder="([^"]+)"/) ?? [])[1] ?? ''
    const fixedEnumModel = /(?:^|\.)(role|status|type|scope|kind)$/i.test(model)
    if (EMPLOYEE_FIELD.test(model) || (!fixedEnumModel && EMPLOYEE_HINT.test(placeholder))) {
      issues.push(`检测到疑似用 el-select 承载员工对象：${model || placeholder || '未识别字段'}`)
    }
    if (REMOTE_FINANCE_FIELD.test(model) || FINANCE_OBJECT_HINT.test(placeholder)) {
      issues.push(`检测到疑似用 el-select 承载财务业务对象：${model || placeholder || '未识别字段'}`)
    }
  }
  if (/<ProjectPicker\b/.test(source) && /<el-form-item[^>]*label="(项目|所属项目|关联项目)"/.test(source)) {
    issues.push('项目选择器仍包在重复的外部项目 label 中')
  }
  for (const match of source.matchAll(/<EmployeePicker\b[\s\S]*?\/?>/g)) {
    if (!/\bsource\s*=/.test(match[0])) {
      issues.push('EmployeePicker 未声明 source，无法保证使用正确的员工目录或薪酬 Provider')
    }
  }
  if (relative.endsWith('components/picker/EmployeePicker.vue')) {
    if (/employeeOptions|fetchAllRows|size:\s*200/.test(source)) {
      issues.push('员工专用选择器仍存在全量加载或固定 size:200')
    }
    if (!/employeePage/.test(source)) {
      issues.push('员工专用选择器未接入服务端分页')
    }
  }
  if (relative.endsWith('domains/identity/api.ts') && (/employeesByRole/.test(source) || /user\/designer\/list/.test(source) || /fetchAllRows\(['"]user\/employee\/page/.test(source))) {
    issues.push('身份域仍暴露员工/设计师全量读取入口')
  }
  if (relative.endsWith('FinanceEmployeePaymentDrawer.vue')) {
    if (/employeePayables|size:\s*200/.test(source)) issues.push('员工薪酬发放仍全量加载应付')
    if (/<el-select\b[\s\S]*?v-model="selectedId"/.test(source)) issues.push('员工薪酬发放仍用下拉承载待发应付')
  }
  if (relative.endsWith('FinanceRefundDrawer.vue') && /receipts\([^)]*size:\s*200/.test(source)) {
    issues.push('退款抽屉仍全量加载原收款')
  }
  if (/OptionTiles/.test(source)) {
    issues.push('检测到已废弃的大尺寸 OptionTiles')
  }
  return issues
}

const rowAudit = (relative, source) => auditSource(relative, source)

if (selfTest) {
  const fixtures = [
    ['negative-owner.vue', '<el-select v-model="ownerId" filterable />', true],
    ['negative-designer.vue', '<el-select\n  v-model="form.designerId"\n  filterable\n/>', true],
    ['negative-manager.vue', '<el-select v-model="form.managerId" />', true],
    ['negative-receipt.vue', '<el-select v-model="form.receiptId" placeholder="选择原收款" />', true],
    ['negative-payable.vue', '<el-select v-model="form.payableId" placeholder="选择待发应付" />', true],
    ['src/components/finance/FinanceEmployeePaymentDrawer.vue', '<el-select v-model="selectedId" />', true],
    ['src/components/picker/EmployeePicker.vue', '<script>fetchAllRows("user/employee/page")</script>', true],
    ['negative-employee-picker-no-source.vue', '<EmployeePicker v-model="ownerId" />', true],
    ['src/domains/identity/api.ts', "fetchAllRows('user/employee/page')", true],
    ['positive-enum.vue', '<el-select v-model="status" />', false],
    ['positive-role-enum.vue', '<el-select v-model="form.role" placeholder="选择员工岗位" />', false],
    ['positive-account-enum.vue', '<el-select v-model="form.account" placeholder="付款账户" />', false],
    ['positive-picker.vue', '<EmployeePicker v-model="ownerId" source="directory" />', false]
  ]
  let failed = false
  for (const [name, source, expected] of fixtures) {
    const issues = rowAudit(`src/${name}`, source)
    const actual = issues.length > 0
    if (actual !== expected) {
      failed = true
      console.error(`负向自测失败：${name} 预期 ${expected ? '拦截' : '放行'}，实际 ${actual ? '拦截' : '放行'}`)
    }
  }
  if (failed) process.exit(1)
  console.log('表单与选择器门禁负向自测通过。')
  process.exit(0)
}

const rows = []
for (const full of walk(srcRoot)) {
  const relative = path.relative(root, full).split(path.sep).join('/')
  const source = fs.readFileSync(full, 'utf8')
  const lines = source.split(/\r?\n/)
  const map = new Map()
  lines.forEach((line, index) => {
    for (const [kind, pattern] of Object.entries(patterns)) {
      if (pattern.test(line)) {
        map.set(kind, [...(map.get(kind) ?? []), { line: index + 1, text: line.trim().slice(0, 180) }])
      }
    }
  })
  if ([...map.keys()].length === 0) continue
  rows.push({
    relative,
    map,
    status: statusOverrides[relative] ?? statusOf(map, relative),
    batch: batchOf(relative),
    issues: rowAudit(relative, source)
  })
}

const summary = {
  files: rows.length,
  forms: rows.reduce((sum, row) => sum + count(row.map, 'form'), 0),
  formItems: rows.reduce((sum, row) => sum + count(row.map, 'formItem'), 0),
  selects: rows.reduce((sum, row) => sum + count(row.map, 'select'), 0),
  nativeSelects: rows.reduce((sum, row) => sum + count(row.map, 'nativeSelect'), 0),
  nativeInputs: rows.reduce((sum, row) => sum + count(row.map, 'nativeInput'), 0),
  dialogs: rows.reduce((sum, row) => sum + count(row.map, 'dialog'), 0),
  drawers: rows.reduce((sum, row) => sum + count(row.map, 'drawer'), 0),
  specializedPickers: rows.reduce((sum, row) => sum + count(row.map, 'specializedPicker'), 0)
}

const lines = [
  '# Web 表单与选择器全量清单',
  '',
  '> 由 `node scripts/audit-web-form-picker.mjs --write` 生成。',
  '> 执行规范：`docs/standards/WEB-业务选择器与表单设计规范.md`。',
  '',
  '## 汇总',
  '',
  `- 涉及文件：${summary.files}`,
  `- 表单：${summary.forms}`,
  `- 表单项：${summary.formItems}`,
  `- 普通 select：${summary.selects}`,
  `- 原生 select：${summary.nativeSelects}`,
  `- 原生 input/textarea：${summary.nativeInputs + rows.reduce((sum, row) => sum + count(row.map, 'textarea'), 0)}`,
  `- Dialog：${summary.dialogs}`,
  `- Drawer：${summary.drawers}`,
  `- 专用选择器引用：${summary.specializedPickers}`,
  `- 风险标记：${rows.reduce((sum, row) => sum + row.issues.length, 0)}`,
  '',
  '## 风险标记',
  '',
  ...(rows.some((row) => row.issues.length)
    ? rows.filter((row) => row.issues.length).flatMap((row) => [`- \`${row.relative}\``, ...row.issues.map((issue) => `  - ${issue}`)])
    : ['- 未发现静态高风险模式。']),
  '',
  '## 文件清单',
  '',
  '| 文件 | 批次 | 表单 | 表单项 | Select | 原生选择/输入 | Dialog | Drawer | 专用选择器 | 状态 |',
  '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ...rows.map((row) => `| \`${row.relative}\` | ${row.batch} | ${count(row.map, 'form')} | ${count(row.map, 'formItem')} | ${count(row.map, 'select')} | ${count(row.map, 'nativeSelect') + count(row.map, 'nativeInput') + count(row.map, 'textarea')} | ${count(row.map, 'dialog')} | ${count(row.map, 'drawer')} | ${count(row.map, 'specializedPicker')} | ${row.status} |`),
  '',
  '## 明细',
  ''
]

for (const row of rows) {
  lines.push(`### ${row.relative}`, '', `状态：${row.status}`, '')
  for (const [kind, hits] of row.map.entries()) {
    lines.push(`#### ${kind}`, '')
    for (const hit of hits) lines.push(`- L${hit.line}: \`${hit.text.replaceAll('`', '\\`')}\``)
    lines.push('')
  }
}

const markdown = `${lines.join('\n').trim()}\n`
if (write) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, markdown)
  console.log(`已生成 ${path.relative(root, outputPath)}`)
} else if (!check) {
  process.stdout.write(markdown)
}

if (check) {
  const failed = rows.filter((row) => row.issues.length)
  if (failed.length) {
    console.error('表单与选择器静态检查失败：')
    for (const row of failed) for (const issue of row.issues) console.error(`- ${row.relative}: ${issue}`)
    process.exit(1)
  }
  console.log('表单与选择器静态检查通过。')
}
