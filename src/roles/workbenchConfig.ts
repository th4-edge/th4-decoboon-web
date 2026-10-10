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
        item('customer.followup', '客户跟进', '/designer/customers'),
        item('designer.followup', '待我跟进', '/designer/followup'),
        item('designer.measure', '待我量房', '/designer/measure'),
        item('designer.design', '待我设计', '/designer/design')
      ]),
      group('business', '商务财务', [
        item('designer.quote', '待我谈单', '/designer/quotes'),
        item('designer.contract', '待我签约', '/designer/contract'),
        item('finance.receivable', '待我收款', '/finance/receivables'),
        item('finance.payable', '待我付款', '/finance/payables'),
        item('finance.ledger', '资金台账与凭证', '/finance/ledger')
      ]),
      group('project', '项目工地', [
        item('pm.project', '项目推进', '/designer/projects'),
        item('pm.materialSelection', '主材选材', '/workbench/material-selection'),
        item('pm.change', '增减项', '/workbench/contract-changes'),
        item('designer.feedback', '客户意见投诉', '/workbench/customer-feedback'),
        item('pm.acceptance', '整改跟进', '/workbench/rectification')
      ]),
      group('operation', '经营分析', [
        item('team.overview', '团队经营概览', '/workbench/team-overview'),
        item('boss.risk', '待我处置风险', '/workbench/risk')
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
      group('today', '业务工作台', [item('today.mainline', '业务工作台', '/workbench')]),
      group('customer', '客户经营', [
        item('customer.followup', '客户跟进', '/workbench/customers'),
        item('designer.quote', '待我谈单', '/designer/quotes'),
        item('designer.contract', '待我签约', '/designer/contract')
      ]),
      group('project', '项目工地', [
        item('pm.project', '项目推进', '/workbench?surface=project'),
        item('pm.materialSelection', '主材选材', '/workbench/material-selection'),
        item('pm.change', '增减项', '/workbench/contract-changes'),
        item('designer.feedback', '客户意见投诉', '/workbench/customer-feedback'),
        item('pm.acceptance', '整改跟进', '/workbench/rectification')
      ]),
      group('business', '商务财务', [
        item('finance.ledger', '资金台账与凭证', '/finance/ledger')
      ]),
      group('operation', '经营风险', [
        item('boss.risk', '待我处置风险', '/workbench/risk')
      ])
    ]
  },
  TeamLeader: {
    role: 'TeamLeader',
    roleLabel: roleLabel('TeamLeader'),
    shellTitle: '团队经营工作台',
    homePath: '/workbench',
    workbenchTitle: '业务工作台',
    workbenchSubtitle: '团队客户、转化、项目推进与风险总览。',
    navGroups: [
      group('today', '业务工作台', [item('today.mainline', '业务工作台', '/workbench')]),
      group('customer', '客户经营', [
        item('customer.followup', '客户跟进', '/workbench/team-customers')
      ]),
      group('operation', '经营分析', [
        item('team.overview', '团队经营概览', '/workbench/team-overview'),
        item('boss.risk', '待我处置风险', '/workbench/risk')
      ])
    ]
  },
  Marketer: {
    role: 'Marketer',
    roleLabel: roleLabel('Marketer'),
    shellTitle: '客户经营工作台',
    homePath: '/workbench',
    workbenchTitle: '业务工作台',
    workbenchSubtitle: '我的客户、跟进、量房与客户转化总览。',
    navGroups: [
      group('today', '业务工作台', [item('today.mainline', '业务工作台', '/workbench')]),
      group('customer', '客户经营', [
        item('customer.followup', '客户跟进', '/workbench/my-customers'),
        item('designer.measure', '待我量房', '/workbench/my-customers?surface=measure')
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
        item('pm.materialSelection', '主材选材', '/workbench/material-selection'),
        item('pm.change', '增减项', '/workbench/contract-changes'),
        item('designer.feedback', '客户意见投诉', '/workbench/customer-feedback'),
        item('pm.acceptance', '整改跟进', '/workbench/rectification')
      ]),
      group('operation', '经营与工具', [
        item('designer.performance', '我的业绩', '/designer/performance'),
        item('designer.catalog', '报价项目库', '/designer/catalog'),
        item('designer.template', '方案模版', '/designer/templates')
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
    navGroups: [
      group('today', '今日', [item('today.mainline', '业务工作台', '/workbench')]),
      group('project', '项目工地', [
        item('pm.project', '项目推进', '/pm/workbench'),
        item('pm.change', '增减项', '/pm/workbench?surface=changes'),
        item('designer.feedback', '客户意见投诉', '/workbench/customer-feedback'),
        item('pm.acceptance', '整改跟进', '/workbench/rectification')
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
    navGroups: [
      group('today', '今日', [item('today.mainline', '业务工作台', '/workbench')]),
      group('finance', '商务财务', [
        item('finance.receivable', '待我收款', '/finance/receivables'),
        item('finance.payable', '待我付款', '/finance/payables'),
        item('finance.ledger', '资金台账与凭证', '/finance/ledger')
      ]),
      group('project', '项目工地', [
        item('pm.materialSelection', '主材选材', '/workbench/material-selection'),
        item('designer.feedback', '客户意见投诉', '/workbench/customer-feedback'),
        item('pm.acceptance', '整改跟进', '/workbench/rectification')
      ])
    ]
  }
}

export function workbenchConfigOf(role: EmployeeRole | null): RoleWorkbenchConfig {
  return role ? ROLE_WORKBENCH_CONFIGS[role] : ROLE_WORKBENCH_CONFIGS.Marketer
}
