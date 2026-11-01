import type { EmployeeRole } from '@/domains/identity/model'
import { roleLabel } from '@/roles/permission'

export interface RoleNavItemConfig {
  key: string
  label?: string
  path?: string
}

export interface RoleNavGroupConfig {
  key: string
  label: string
  items: RoleNavItemConfig[]
}

export interface RoleWorkbenchConfig {
  role: EmployeeRole
  roleLabel: string
  shellTitle: string
  homePath: string
  workbenchTitle: string
  workbenchSubtitle: string
  navGroups: RoleNavGroupConfig[]
}

const item = (key: string, label?: string, path?: string): RoleNavItemConfig => ({ key, label, path })
const group = (key: string, label: string, items: RoleNavItemConfig[]): RoleNavGroupConfig => ({ key, label, items })

export const ROLE_WORKBENCH_CONFIGS: Record<EmployeeRole, RoleWorkbenchConfig> = {
  Boss: {
    role: 'Boss',
    roleLabel: roleLabel('Boss'),
    shellTitle: '经营管控中心',
    homePath: '/workbench',
    workbenchTitle: '业务工作台',
    workbenchSubtitle: '全局经营结论、风险、组织与资金总览。',
    navGroups: [
      group('today', '业务工作台', [item('today.mainline', '业务工作台', '/workbench')]),
      group('customer', '客户经营', [
        item('customer.followup', '客户经营', '/workbench/customers'),
        item('designer.followup', '待我跟进', '/designer/followup'),
        item('designer.measure', '待我量房', '/designer/measure'),
        item('designer.design', '设计方案', '/workbench/design-reviews')
      ]),
      group('business', '商务财务', [
        item('designer.quote', '待我谈单', '/designer/quotes'),
        item('designer.contract', '待我签约', '/designer/contract'),
        item('finance.receivable', '待我收款', '/finance/receivables'),
        item('finance.payable', '待我付款', '/finance/payables'),
        item('finance.expense', '费用与报销', '/finance/expenses'),
        item('finance.ledger', '资金台账', '/finance/ledger'),
        item('finance.voucher', '收付凭证', '/finance/vouchers'),
        item('finance.voucherTemplate', '凭证模板', '/finance/voucher-templates')
      ]),
      group('project', '项目工地', [
        item('pm.project', '项目推进', '/designer/projects'),
        item('pm.execution', '施工排期与现场留证', '/workbench/project-execution'),
        item('store.carryover', '业务承接', '/workbench/store-carryover'),
        item('pm.materialSelection', '主材选材', '/workbench/material-selection'),
        item('pm.materialSheet', '主材作业单', '/workbench/material-sheets'),
        item('pm.change', '增减项', '/workbench/contract-changes'),
        item('designer.feedback', '客户意见投诉', '/workbench/customer-feedback'),
        item('pm.acceptance', '整改跟进', '/workbench/rectification')
      ]),
      group('enterpriseOperation', '企业运营', [
        item('operation.suppliers', '供应商档案', '/workbench/suppliers')
      ]),
      group('operation', '经营分析', [
        item('boss.organization', '成员与组织', '/workbench/organization'),
        item('boss.risk', '待我处置风险', '/workbench/risk')
      ]),
      group('help', '帮助与说明', [
        item('business.blueprint', '材料业务说明', '/business-blueprints')
      ])
    ]
  },
  StoreManager: {
    role: 'StoreManager',
    roleLabel: roleLabel('StoreManager'),
    shellTitle: '门店经营工作台',
    homePath: '/workbench',
    workbenchTitle: '业务工作台',
    workbenchSubtitle: '本店客户、设计报价、项目履约与经营风险总览。',
    navGroups: [
      // 菜单信息架构冻结稿：docs/product/storemanager/WEB-STOREMANAGER-MENU-FROZEN.md
      // D1：移除「项目推进 → /workbench?surface=project」——页面不消费 surface（死参数），店长也无门店项目队列页，不留死链。
      // D4：「能否进入」决定入口可见性，只读能力（财务/薪酬）也要可发现（EXP-021）。
      group('today', '今日', [item('today.mainline', '业务工作台', '/workbench')]),
      group('customer', '本店客户', [
        item('customer.followup', '本店客户', '/workbench/customers'),
        // 2026-10-17：店长查看本店设计方案入口；实际编辑能力仍由服务端角色与数据范围决定。
        item('designer.design', '本店设计方案', '/workbench/design-reviews'),
        item('designer.catalog', '报价项目库', '/designer/catalog'),
        item('designer.templates', '方案模版', '/designer/templates'),
        item('designer.quote', '待我谈单', '/designer/quotes'),
        item('designer.contract', '待我签约', '/designer/contract')
      ]),
      group('delivery', '本店履约', [
        item('pm.execution', '施工排期与现场留证', '/workbench/project-execution'),
        item('store.carryover', '本店业务承接', '/workbench/store-carryover'),
        item('pm.materialSelection', '主材选材', '/workbench/material-selection'),
        item('pm.materialSheet', '主材作业单', '/workbench/material-sheets'),
        item('pm.change', '增减项', '/workbench/contract-changes'),
        item('pm.acceptance', '整改跟进', '/workbench/rectification'),
        item('designer.feedback', '客户意见投诉', '/workbench/customer-feedback')
      ]),
      group('business', '本店经营', [
        item('boss.organization', '成员与组织', '/workbench/organization'),
        item('store.overview', '本店经营结果', '/workbench/store-overview'),
        item('boss.risk', '待我处置风险', '/workbench/risk'),
        item('finance.expense', '费用与报销', '/finance/expenses'),
        item('finance.ledger', '资金台账', '/finance/ledger'),
        item('finance.compensationSchemes', '薪酬方案（只读）', '/finance/compensation-schemes'),
        item('finance.storePayroll', '本店薪酬（只读）', '/finance/store-payroll'),
        item('finance.payroll', '薪酬与考勤（只读）', '/finance/payroll')
      ]),
      group('enterpriseOperation', '企业运营', [
        item('operation.suppliers', '供应商档案', '/workbench/suppliers')
      ]),
      group('help', '帮助与说明', [
        item('business.blueprint', '材料业务说明', '/business-blueprints')
      ])
    ]
  },
  // DEC-082：TeamLeader 仅保留历史数据解码，不再装载 Web 菜单。
  TeamLeader: {
    role: 'TeamLeader',
    roleLabel: roleLabel('TeamLeader'),
    shellTitle: '角色已冻结',
    homePath: '/forbidden',
    workbenchTitle: '角色已冻结',
    workbenchSubtitle: '请联系企业负责人改为其他岗位。',
    navGroups: []
  },
  Marketer: {
    role: 'Marketer',
    roleLabel: roleLabel('Marketer'),
    shellTitle: '客户经营工作台',
    homePath: '/workbench',
    workbenchTitle: '业务工作台',
    workbenchSubtitle: '我的客户、跟进、量房与客户转化总览。',
    // 菜单信息架构冻结稿：docs/product/marketer/WEB-MARKETER-MENU-FROZEN.md
    // 对齐 App 侧业务员可达面（src/roles/catalog.ts 的 ROLE_ACTIONS.marketer + guard.ts）。
    // 本轮只挂**已存在且有承载页面**的项；未建页面见冻结稿「实施状态」，建好即挂（不留死链）。
    navGroups: [
      group('today', '今日', [item('today.mainline', '业务工作台', '/workbench')]),
      group('customer', '客户经营', [
        item('customer.followup', '我的客户', '/workbench/my-customers'),
        item('customer.measure', '我的量房', '/workbench/measure')
      ]),
      group('delivery', '项目履约', [
        item('pm.project', '签约后流转', '/workbench/my-projects'),
        item('designer.feedback', '客户意见投诉（只读）', '/workbench/customer-feedback')
      ]),
      group('operation', '经营与工具', [
        item('marketer.performance', '我的业绩', '/workbench/my-performance'),
        item('finance.expense', '费用与报销', '/finance/expenses')
      ])
    ]
  },
  /**
   * 设计师菜单（冻结稿 WEB-DESIGNER-MENU-FROZEN）
   * 结构：业务工作台置顶 + 4 个业务域；命名一律场景语言，禁止模块 CRUD 命名。
   * 选材与增减项已按用户要求提升为“项目交付”独立菜单；验收整改仍保留项目页内工作区，待后续逐项实现。
   * AI 效果图依赖方案上下文，作为设计工作区内的动作，不占菜单项。
   */
  Designer: {
    role: 'Designer',
    roleLabel: roleLabel('Designer'),
    shellTitle: '设计师工作台',
    homePath: '/designer/workbench',
    workbenchTitle: '业务工作台',
    workbenchSubtitle: '先看工作总量、业务趋势与阶段分布，再进入对应场景工作台处理具体对象。',
    navGroups: [
      group('home', '', [item('today.mainline', '业务工作台', '/designer/workbench')]),
      // 「我的客户」为设计师一级入口；「客户与设计」保留为推进工作区（由 360 主行动与待我量房进入），不再单独占菜单项。
      group('myCustomer', '', [item('customer.followup', '我的客户', '/designer/my-customers')]),
      group('customer', '客户经营', [
        item('designer.followup', '待我跟进', '/designer/followup'),
        item('designer.measure', '待我量房', '/designer/measure')
      ]),
      group('designQuote', '方案报价', [
        item('designer.design', '待我设计', '/designer/design'),
        item('designer.quote', '待我谈单', '/designer/quotes'),
        item('designer.contract', '待我签约', '/designer/contract')
      ]),
      group('project', '项目交付', [
        item('pm.project', '项目工地', '/designer/projects'),
        item('pm.execution', '施工排期与现场留证', '/workbench/project-execution'),
        item('pm.materialSelection', '主材选材', '/workbench/material-selection'),
        item('pm.materialSheet', '主材作业单', '/workbench/material-sheets'),
        item('pm.change', '增减项', '/workbench/contract-changes'),
        item('designer.feedback', '客户意见投诉', '/workbench/customer-feedback'),
        item('pm.acceptance', '整改跟进', '/workbench/rectification')
      ]),
      group('operation', '经营与工具', [
        item('designer.performance', '我的业绩', '/designer/performance'),
        item('designer.catalog', '报价项目库', '/designer/catalog'),
        item('designer.template', '方案模版', '/designer/templates'),
        item('finance.expense', '费用与报销', '/finance/expenses')
      ])
    ]
  },
  Pm: {
    role: 'Pm',
    roleLabel: roleLabel('Pm'),
    shellTitle: '项目经理工作台',
    homePath: '/pm/workbench',
    workbenchTitle: '业务工作台',
    workbenchSubtitle: '在管项目、阶段任务、材料、增减项与验收/整改总览。',
    // 菜单信息架构冻结稿：docs/product/pm/WEB-PM-MENU-FROZEN.md
    // 「主材选材」本期不挂菜单：Pm 的静态路由集合里没有主材选材（原 meta.roles / 注册表 roles 也不含 Pm），
    // 与后端 materialplans/update（Boss/Pm/Finance）冲突，先裁决 GAP-WEB-019，避免新增死链。
    navGroups: [
      group('today', '今日', [item('today.mainline', '业务工作台', '/workbench')]),
      group('delivery', '项目履约', [
        item('pm.project', '项目推进', '/pm/workbench'),
        item('pm.execution', '施工排期与现场留证', '/workbench/project-execution'),
        item('pm.acceptance', '待我验收/整改', '/workbench/rectification')
      ]),
      group('material', '材料与变更', [
        item('pm.materialSheet', '主材作业单', '/workbench/material-sheets'),
        item('pm.change', '增减项', '/workbench/contract-changes')
      ]),
      group('enterpriseOperation', '企业运营', [
        item('operation.suppliers', '供应商档案', '/workbench/suppliers')
      ]),
      group('collab', '履约协同', [
        item('finance.expense', '费用与报销', '/finance/expenses'),
        item('designer.feedback', '客户意见投诉', '/workbench/customer-feedback')
      ])
    ]
  },
  Finance: {
    role: 'Finance',
    roleLabel: roleLabel('Finance'),
    shellTitle: '财务工作台',
    homePath: '/finance/workbench',
    workbenchTitle: '业务工作台',
    workbenchSubtitle: '收款、付款、资金、台账凭证与风险总览。',
    // 菜单信息架构冻结稿：docs/product/finance/WEB-FINANCE-MENU-FROZEN.md
    // 按「钱的两条腿（收/付）+ 归档」组织；凭证与模板页原先在 7 个角色菜单中均无入口，本次补齐。
    // 不新增未注册菜单 key；不增删任何 meta.roles。
    navGroups: [
      group('today', '今日', [item('today.mainline', '业务工作台', '/finance/workbench')]),
      group('customer', '客户', [
        item('customer.followup', '客户', '/workbench/customers')
      ]),
      group('settle', '资金收付', [
        item('finance.receivable', '待我收款', '/finance/receivables'),
        item('finance.receipts', '收款记录', '/finance/receipts'),
        item('finance.payable', '待我付款', '/finance/payables'),
        item('finance.expense', '费用与报销', '/finance/expenses'),
        item('finance.payments', '付款记录', '/finance/payments'),
        item('finance.salaries', '工人工资', '/finance/salaries')
      ]),
      group('ledger', '往来与账本', [
        item('finance.partners', '供应商往来', '/finance/partners'),
        item('finance.ledger', '资金台账', '/finance/ledger'),
        item('finance.refunds', '客户退款', '/finance/refunds')
      ]),
      group('voucher', '凭证与归档', [
        item('finance.voucher', '收付凭证', '/finance/vouchers'),
        item('finance.voucherTemplate', '凭证模板', '/finance/voucher-templates')
      ]),
      group('catalog', '报价与成本', [
        item('finance.quotes', '报价', '/finance/quotes'),
        item('designer.catalog', '报价项目库', '/designer/catalog'),
        item('pm.materialSheet', '主材作业单', '/workbench/material-sheets')
      ]),
      group('enterpriseOperation', '企业运营', [
        item('operation.suppliers', '供应商档案', '/workbench/suppliers')
      ]),
      group('payroll', '薪酬', [
        item('finance.payroll', '薪酬工作台', '/finance/payroll'),
        item('finance.compensationSchemes', '薪酬方案', '/finance/compensation-schemes'),
        item('finance.employeeSalaries', '员工工资', '/finance/employee-salaries'),
        item('finance.employeeCommissions', '员工提成', '/finance/employee-commissions'),
        item('finance.commissionAdjustments', '提成负向调整', '/finance/commission-adjustments'),
        item('finance.storePayroll', '本店薪酬', '/finance/store-payroll')
      ]),
      group('accounting', '项目核算', [
        item('finance.projects', '项目账本', '/finance/projects'),
        item('designer.design', '设计方案与报价', '/finance/design-reviews')
      ]),
      group('help', '帮助与说明', [
        item('business.blueprint', '材料业务说明', '/business-blueprints')
      ])
    ]
  }
}

export function workbenchConfigOf(role: EmployeeRole | null): RoleWorkbenchConfig {
  return role ? ROLE_WORKBENCH_CONFIGS[role] : ROLE_WORKBENCH_CONFIGS.Marketer
}
