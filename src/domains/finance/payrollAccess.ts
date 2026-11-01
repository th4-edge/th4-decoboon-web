import { computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import type { EmployeeRole } from '@/domains/identity/model'

/** 薪酬方案/复核写权限：仅 BOSS、财务；店长不获得制单类写权限。 */
const PAYROLL_WRITE_ROLES: readonly EmployeeRole[] = ['Boss', 'Finance']
const PAYROLL_READ_ROLES: readonly EmployeeRole[] = ['Boss', 'Finance', 'StoreManager']
const PAYROLL_CONFIRM_ROLES: readonly EmployeeRole[] = ['Boss', 'StoreManager']
/** DEC-098：财务可删 Draft；总部/门店边界由会话数据范围与服务端再次强制。 */
const PAYROLL_DELETE_DRAFT_ROLES: readonly EmployeeRole[] = ['Boss', 'Finance', 'StoreManager']
const PAYROLL_PAY_ROLES: readonly EmployeeRole[] = ['Boss', 'Finance', 'StoreManager']

export function usePayrollAccess() {
  const session = useSessionStore()
  const role = computed<EmployeeRole | null>(() => session.role ?? null)
  const canWrite = computed(() => !!role.value && PAYROLL_WRITE_ROLES.includes(role.value))
  const canRead = computed(() => !!role.value && PAYROLL_READ_ROLES.includes(role.value))
  const canEditAttendance = computed(() => canRead.value)
  const canSubmitReview = computed(() => canWrite.value)
  const canReturn = computed(() => !!role.value && PAYROLL_CONFIRM_ROLES.includes(role.value))
  const canConfirm = computed(() => !!role.value && PAYROLL_CONFIRM_ROLES.includes(role.value))
  const canDeleteDraft = computed(() => !!role.value && PAYROLL_DELETE_DRAFT_ROLES.includes(role.value))
  const canPay = computed(() => !!role.value && PAYROLL_PAY_ROLES.includes(role.value))
  const readOnly = computed(() => canRead.value && !canWrite.value && !canConfirm.value && !canPay.value)
  return { role, canWrite, canRead, canEditAttendance, canSubmitReview, canReturn, canConfirm, canDeleteDraft, canPay, readOnly }
}
