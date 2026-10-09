import type { EmployeeRole } from '@/domains/identity/model'

/** App/Web 共用休眠原因字典；值与后端 CustomerDormantReason 一致。 */
export const DORMANT_REASONS = [
  { value: 'PlanPostponed', label: '装修计划延期' },
  { value: 'BudgetUndecided', label: '预算或方案未定' },
  { value: 'DecisionPending', label: '决策未确定' },
  { value: 'CustomerRequestedPause', label: '客户要求暂缓联系' },
  { value: 'ContactUnreachable', label: '长期无法有效联系' },
  { value: 'LeadPendingVerification', label: '线索待核实' },
  { value: 'Other', label: '其他' }
] as const

/** 本轮业务要求：设计师范畴也可操作；服务端仍按客户可见范围和状态门禁裁决。 */
export function canManageDormantRole(role: EmployeeRole | null | undefined): boolean {
  return role === 'Boss' || role === 'StoreManager' || role === 'Marketer' || role === 'Designer'
}
