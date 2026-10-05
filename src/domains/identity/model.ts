/** 企业员工角色：与后端 EmployeeRole 枚举一一对应，禁止新增重复角色。 */
export type EmployeeRole =
  | 'Boss'
  | 'StoreManager'
  | 'TeamLeader'
  | 'Marketer'
  | 'Designer'
  | 'Pm'
  | 'Finance'

export const EMPLOYEE_ROLES: readonly EmployeeRole[] = [
  'Boss', 'StoreManager', 'TeamLeader', 'Marketer', 'Designer', 'Pm', 'Finance'
]

/** Provider 枚举序列化形态。 */
export interface EnumValue {
  key: string
  value: string
  name: string
}

export interface Company {
  comId: string
  name: string
  title?: string
  logo?: string
  color?: string
  addr?: string
  setting?: Record<string, unknown>
}

export interface Store {
  storeId: string
  name: string
  defaultStore?: boolean
}

export interface Team {
  teamId: string
  name: string
  color?: string
}

export interface Employee {
  empId: string
  name: string
  telNo?: string
  avatarUrl?: string
  role?: EnumValue | null
  status?: EnumValue | null
  store?: Store | null
  team?: Team | null
  company?: Company | null
  joinedAt?: string
  createTime?: { dateTime?: string } | string
}

/** auth/session/info 返回的会话身份。 */
export interface SessionProfile {
  creId: string
  employee: Employee
  phone?: string
  status?: EnumValue | null
  sessionType?: EnumValue | null
  mustChangePassword?: boolean
  passwordSet?: boolean
}

/** 当前会话的数据范围：由服务端角色推导，前端不得自行放大。 */
export type DataScope = 'Company' | 'Store' | 'Team' | 'Self'

export interface PasswordLoginInput {
  phone: string
  password: string
}
