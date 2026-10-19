import { computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import type { EmployeeRole } from '@/domains/identity/model'

/** 财务写动作角色：Boss / Finance / StoreManager（店长限本店）。 */
// DEC-065 FIN-STORE-06：店长在本店范围内与门店财务一致，可执行记账写动作。
const FINANCE_WRITE_ROLES: readonly EmployeeRole[] = ['Boss', 'Finance', 'StoreManager']

/**
 * 财务写权限。
 *
 * - `canWrite`：可执行应收/应付/收付款/台账等写动作（Boss/Finance）。
 * - `canCorrect`：可作废/更正/冲正重记手工流水（Boss 全企业 / 店长本店，DEC-075）。
 * - `readOnly`：店长等只读角色的统一判定，用于裁剪写按钮。
 *
 * 前端只做入口裁剪；越权仍由后端 Provider 兜底拒绝。
 */
export function useFinanceAccess() {
  const session = useSessionStore()
  const role = computed<EmployeeRole | null>(() => session.role ?? null)
  const canWrite = computed(() => !!role.value && FINANCE_WRITE_ROLES.includes(role.value))
  const canCorrect = computed(() => role.value === 'Boss' || role.value === 'StoreManager')
  const readOnly = computed(() => !canWrite.value)
  return { role, canWrite, canCorrect, readOnly }
}
