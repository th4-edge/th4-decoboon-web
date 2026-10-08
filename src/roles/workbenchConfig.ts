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
      group('today', '业务工作台', [item('today.mainline')]),
      group('customer', '客户经营', [item('customer.followup'), item('designer.measure'), item('designer.design')]),
      group('business', '商务财务', [item('designer.quote'), item('designer.contract'), item('finance.receivable'), item('finance.payable'), item('finance.ledger')]),
      group('project', '项目工地', [item('pm.project'), item('pm.materialSelection'), item('pm.change'), item('pm.acceptance')]),
      group('operation', '经营分析', [item('team.overview'), item('boss.risk')])
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
      group('today', '业务工作台', [item('today.mainline')]),
      group('customer', '客户经营', [item('customer.followup'), item('designer.quote'), item('designer.contract')]),
      group('project', '项目工地', [item('pm.project'), item('pm.materialSelection'), item('pm.change')]),
      group('business', '商务财务', [item('finance.ledger')]),
      group('operation', '经营风险', [item('boss.risk')])
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
      group('today', '业务工作台', [item('today.mainline')]),
      group('customer', '客户经营', [item('customer.followup')]),
      group('operation', '经营分析', [item('team.overview'), item('boss.risk')])
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
      group('today', '业务工作台', [item('today.mainline')]),
      group('customer', '客户经营', [item('customer.followup'), item('designer.measure')])
    ]
  },
  /**
   * 设计师菜单（冻结稿 WEB-DESIGNER-MENU-FROZEN）
   * 结构：业务工作台置顶 + 4 个业务域；命名一律场景语言，禁止模块 CRUD 命名。
   * 选材 / 增减项 / 验收整改按裁决下沉到「项目工地」页内工作台，不占菜单项。
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
      group('customer', '客户经营', [
        // 「客户与设计」保留为推进工作区（由 360 主行动与待我量房/客户诉求进入），不再单独占菜单项。
        item('customer.followup', '我的客户', '/designer/my-customers'),
        item('designer.measure', '待我量房', '/designer/customers?surface=measure'),
        item('designer.requirement', '客户诉求', '/designer/customers?surface=requirement')
      ]),
      group('designQuote', '方案报价', [
        item('designer.design', '待我设计', '/designer/design'),
        item('designer.quote', '待我报价', '/designer/quotes'),
        item('designer.contract', '合同签约', '/designer/contract')
      ]),
      group('project', '项目交付', [
        item('pm.project', '项目工地', '/designer/projects')
      ]),
      group('operation', '经营与工具', [
        item('designer.performance', '我的业绩', '/designer/performance'),
        item('designer.catalog', '报价项目库', '/designer/catalog'),
        item('designer.template', '方案模版', '/designer/templates'),
        item('designer.feedback', '客户意见投诉', '/designer/feedback')
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
      group('today', '今日', [item('today.mainline', '业务工作台')]),
      group('project', '项目工地', [item('pm.project', '项目推进'), item('pm.change'), item('pm.acceptance')])
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
      group('today', '今日', [item('today.mainline', '业务工作台')]),
      group('finance', '商务财务', [item('finance.receivable'), item('finance.payable'), item('finance.ledger')]),
      group('project', '项目工地', [item('pm.materialSelection')])
    ]
  }
}

export function workbenchConfigOf(role: EmployeeRole | null): RoleWorkbenchConfig {
  return role ? ROLE_WORKBENCH_CONFIGS[role] : ROLE_WORKBENCH_CONFIGS.Marketer
}
