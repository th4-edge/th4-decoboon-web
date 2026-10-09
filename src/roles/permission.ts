import type { DataScope, EmployeeRole } from '@/domains/identity/model'

/**
 * 角色级事实与默认范围矩阵。
 *
 * 注意：侧栏/一级二级导航不在这里维护。菜单的唯一来源是
 * `docs/standards/workbench-navigation.json`（工作台契约与校验源），
 * 避免出现「页面已建、菜单仍写建设中或指向死链接」的第二套导航（DEF-WEB-001）。
 */

export const ROLE_LABELS: Record<EmployeeRole, string> = {
  Boss: '企业负责人',
  StoreManager: '店长',
  TeamLeader: '团队负责人',
  Marketer: '业务员',
  Designer: '设计师',
  Pm: '项目经理',
  Finance: '财务'
}

export function isEmployeeRole(value: string | null | undefined): value is EmployeeRole {
  return !!value && value in ROLE_LABELS
}

export function roleLabel(role: EmployeeRole | null): string {
  return role ? ROLE_LABELS[role] : '未知角色'
}

/** 数据范围默认矩阵：BOSS=Company / 店长=Store / 团队负责人=Team / 普通员工=Self。 */
export function dataScopeOf(role: EmployeeRole | null): DataScope {
  switch (role) {
    case 'Boss':
    case 'Finance': return 'Company'
    case 'StoreManager': return 'Store'
    case 'TeamLeader': return 'Team'
    default: return 'Self'
  }
}

export function isManagementShell(role: EmployeeRole | null): boolean {
  return role === 'Boss'
}

/** 登录后首页：设计师/项目经理/财务进入各自岗位壳层，其余角色进入通用工作台。 */
export function homePathForRole(role: EmployeeRole | null): string {
  if (role === 'Designer') return '/designer/workbench'
  if (role === 'Pm') return '/pm/workbench'
  if (role === 'Finance') return '/finance/workbench'
  return '/workbench'
}
