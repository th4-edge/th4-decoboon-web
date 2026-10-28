/** 企业员工角色：与后端 EmployeeRole 枚举一一对应，禁止新增重复角色。 */
export type EmployeeRole =
  | 'Boss'
  | 'StoreManager'
  | 'TeamLeader'
  | 'Marketer'
  | 'Designer'
  | 'Pm'
  | 'Finance'

export const EMPLOYEE_ROLE = {
  BOSS: 'Boss',
  STORE_MANAGER: 'StoreManager',
  TEAM_LEADER: 'TeamLeader',
  MARKETER: 'Marketer',
  DESIGNER: 'Designer',
  PM: 'Pm',
  FINANCE: 'Finance'
} as const satisfies Record<string, EmployeeRole>

export const EMPLOYEE_ROLES: readonly EmployeeRole[] = [
  'Boss', 'StoreManager', 'TeamLeader', 'Marketer', 'Designer', 'Pm', 'Finance'
]

/** Provider 枚举序列化形态。 */
export interface EnumValue {
  key: string
  value: string
  name: string
}

/**
 * 企业配置（后端 Setting 投影）。
 *
 * 事实来源：后端迁移 113「企业品牌与署名配置」、迁移 114「企业对外信息」。
 * 后 6 项属「服务主体知情权」范围（USER-DECISION-20261014-002）：由企业自行填写并审核发布，
 * 平台不代填、不推算、不背书；业主端「服务方」区块直接消费这 6 项。
 */
export interface CompanySetting {
  /** 启用多门店（只读消费） */
  enableStore?: boolean
  /** 叙事主品牌：Company=装企（默认）/ Platform=平台 */
  brandPrimary?: 'Company' | 'Platform'
  /** 是否显示「记录存证与保管 · 装得清」署名（默认关闭） */
  custodianCredit?: boolean
  /** 服务区域 */
  serviceArea?: string
  /** 企业统一客服电话（非员工个人号码） */
  serviceTel?: string
  /** 售后专线 */
  afterSaleTel?: string
  /** 统一社会信用代码 */
  uscc?: string
  /** 资质 */
  qualification?: string
  /** 一句话简介 */
  intro?: string
}

export interface Company {
  comId: string
  name: string
  title?: string
  logo?: string
  color?: string
  addr?: string
  setting?: CompanySetting
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

/** 员工邀请管理投影；不接受客户端自行推导角色或门店。 */
export interface EmployeeInvite {
  inviteId: string
  inviteName?: string
  telNo?: string
  role?: EnumValue | null
  status?: EnumValue | null
  store?: Store | null
  team?: Team | null
  expireTime?: string
  createTime?: { dateTime?: string } | string
  reusedPending?: boolean
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
