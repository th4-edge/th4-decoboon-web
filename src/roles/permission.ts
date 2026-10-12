import type { DataScope, EmployeeRole } from '@/domains/identity/model'

/**
 * 角色级事实与默认范围矩阵。
 *
 * 注意：侧栏/一级二级导航不在这里维护。按角色静态化后的唯一来源是
 * 静态菜单 `src/roles/workbenchConfig.ts` + 静态路由 `src/roles/routes.ts`
 * + 静态首页清单 `src/roles/workbenchHome.ts`（均不参与运行时判断），
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

/**
 * 数据范围中文投影（唯一来源）。
 *
 * `DataScope` 取值是 PascalCase 英文（`Company/Store/Team/Self`），**禁止直接落屏**；
 * 任何展示位都必须经过本映射或 `session.dataScopeName`（规范 §5 枚举与中文映射强制规则）。
 */
export const DATA_SCOPE_LABELS: Record<DataScope, string> = {
  Company: '全公司',
  Store: '本门店',
  Team: '本团队',
  Self: '仅本人'
}

export function isEmployeeRole(value: string | null | undefined): value is EmployeeRole {
  return !!value && value in ROLE_LABELS
}

export function roleLabel(role: EmployeeRole | null): string {
  return role ? ROLE_LABELS[role] : '未知角色'
}

/** 数据范围默认矩阵：BOSS=Company / 店长=Store / 团队负责人=Team / 普通员工=Self。 */
/**
 * 角色数据范围。
 *
 * DEC-065：`Finance` 数据范围收窄为「归属门店」；归属**默认总店**的财务即「总部财务」，
 * 仍为企业范围（承载跨店汇总、合并与公司经营利润）。其余角色不受影响。
 */
export function dataScopeOf(role: EmployeeRole | null, store?: { defaultStore?: boolean } | null): DataScope {
  switch (role) {
    case 'Boss': return 'Company'
    case 'Finance': return store?.defaultStore ? 'Company' : 'Store'
    case 'StoreManager': return 'Store'
    case 'TeamLeader': return 'Team'
    default: return 'Self'
  }
}

/** 数据范围展示名：仅供 UI 使用，逻辑判断仍请使用 `dataScopeOf`。 */
export function dataScopeLabel(scope: DataScope | null | undefined): string {
  return scope ? DATA_SCOPE_LABELS[scope] : '未确定'
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
