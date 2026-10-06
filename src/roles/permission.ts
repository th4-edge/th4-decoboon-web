import type { DataScope, EmployeeRole } from '@/domains/identity/model'

export interface NavItem {
  key: string
  label: string
  path: string
  /** true = V3 尚未实现该页，菜单可见但进入占位；禁止伪装成已完成。 */
  planned?: boolean
}

export const ROLE_LABELS: Record<EmployeeRole, string> = {
  Boss: '企业负责人',
  StoreManager: '店长',
  TeamLeader: '团队负责人',
  Marketer: '业务员',
  Designer: '设计师',
  Pm: '项目经理',
  Finance: '财务'
}

/** Boss 经营管控层一级导航（V1 架构冻结，V3 沿用）。 */
const MANAGEMENT_NAV: readonly NavItem[] = [
  { key: 'overview', label: '经营总览', path: '/workbench', planned: true },
  { key: 'business', label: '业务分析', path: '/workbench?nav=business', planned: true },
  { key: 'projects', label: '项目监管', path: '/workbench?nav=projects', planned: true },
  { key: 'finance', label: '财务经营', path: '/workbench?nav=finance', planned: true },
  { key: 'organization', label: '组织效能', path: '/workbench?nav=organization', planned: true },
  { key: 'risk', label: '风险中心', path: '/workbench?nav=risk', planned: true }
]

/** 员工岗位执行层一级导航，按角色能力过滤。 */
const EXECUTION_NAV: readonly NavItem[] = [
  { key: 'today', label: '今日主线', path: '/workbench', planned: true },
  { key: 'customer', label: '客户与设计', path: '/workbench?nav=customer', planned: true },
  { key: 'trade', label: '报价与合同', path: '/workbench?nav=trade', planned: true },
  { key: 'project', label: '项目工地', path: '/workbench?nav=project', planned: true },
  { key: 'finance', label: '商务财务', path: '/workbench?nav=finance', planned: true }
]

/** 角色可用的员工导航域；Boss 走经营管控层。 */
const ROLE_NAV_KEYS: Record<EmployeeRole, readonly string[]> = {
  Boss: [],
  StoreManager: ['today', 'customer', 'trade', 'project', 'finance'],
  TeamLeader: ['today', 'customer', 'trade', 'project'],
  Marketer: ['today', 'customer', 'trade'],
  Designer: ['today', 'customer', 'trade'],
  Pm: ['today', 'project'],
  Finance: ['today', 'trade', 'finance']
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
    case 'Boss': return 'Company'
    case 'StoreManager': return 'Store'
    case 'TeamLeader': return 'Team'
    default: return 'Self'
  }
}

export function isManagementShell(role: EmployeeRole | null): boolean {
  return role === 'Boss'
}

export function navFor(role: EmployeeRole | null): NavItem[] {
  if (!role) return []
  if (isManagementShell(role)) return MANAGEMENT_NAV.map((item) => ({ ...item }))
  const allowed = ROLE_NAV_KEYS[role]
  return EXECUTION_NAV.filter((item) => allowed.includes(item.key)).map((item) => ({ ...item }))
}

/** 登录后首页：设计师进入专属壳层，其余角色继续进入通用工作台。 */
export function homePathForRole(role: EmployeeRole | null): string {
  return role === 'Designer' ? '/designer/workbench' : '/workbench'
}
