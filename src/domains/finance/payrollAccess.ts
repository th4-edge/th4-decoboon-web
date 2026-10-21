import { computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import type { EmployeeRole } from '@/domains/identity/model'

/** 薪酬方案写权限：仅 BOSS、财务；店长为只读。 */
const PAYROLL_WRITE_ROLES: readonly EmployeeRole[] = ['Boss', 'Finance']
const PAYROLL_READ_ROLES: readonly EmployeeRole[] = ['Boss', 'Finance', 'StoreManager']

export function usePayrollAccess() {
  const session = useSessionStore()
  const role = computed<EmployeeRole | null>(() => session.role ?? null)
  const canWrite = computed(() => !!role.value && PAYROLL_WRITE_ROLES.includes(role.value))
  const canRead = computed(() => !!role.value && PAYROLL_READ_ROLES.includes(role.value))
  const readOnly = computed(() => canRead.value && !canWrite.value)
  return { role, canWrite, canRead, readOnly }
}
