import { post } from '@/core/http'
import type { Company, CompanySetting, Employee, EmployeeInvite, EmployeeRole, PasswordLoginInput, SessionProfile } from './model'

export interface EntityOption {
  id: string
  name: string
  /** 门店维度控件：重名时用于区分。 */
  addr?: string
  /** 默认总店标记（「总店」标签）。 */
  defaultStore?: boolean
}

interface LoginToken {
  token: string
}

/** 员工密码登录：公开路由，不走登录态拦截。 */
export function passwordLogin(input: PasswordLoginInput): Promise<LoginToken> {
  return post<LoginToken>('auth/session/password-login', input)
}

/** 读取当前登录身份（企业/门店/团队/角色由服务端返回，前端不得改写）。 */
export function sessionInfo(): Promise<SessionProfile> {
  return post<SessionProfile>('auth/session/info', {})
}

/** 退出当前会话；失败也必须由调用方清理本地会话。 */
export function logout(): Promise<void> {
  return post<void>('auth/session/logout', {})
}

async function designers(): Promise<EntityOption[]> {
  const result = await post<unknown[]>('user/designer/list', {})
  return (Array.isArray(result) ? result : []).map((raw) => {
    const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    return { id: String(record.empId ?? record.id ?? ''), name: String(record.name ?? '') }
  }).filter((item) => item.id && item.name)
}

async function stores(): Promise<EntityOption[]> {
  const result = await post<unknown[]>('user/store/list', {})
  return (Array.isArray(result) ? result : []).map((raw) => {
    const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    return {
      id: String(record.storeId ?? record.id ?? ''),
      name: String(record.name ?? ''),
      addr: typeof record.addr === 'string' ? record.addr : undefined,
      defaultStore: record.defaultStore === true
    }
  }).filter((item) => item.id && item.name)
}

async function employeesByRole(role: string): Promise<EntityOption[]> {
  const result = await post<unknown>('user/employee/page', { current: 1, size: 500 })
  const rows = Array.isArray(result)
    ? result
    : (result && typeof result === 'object'
      ? ((result as Record<string, unknown>).content ?? (result as Record<string, unknown>).records ?? (result as Record<string, unknown>).list)
      : [])
  const list = Array.isArray(rows) ? rows : []
  return list.map((raw) => {
    const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    const roleRecord = record.role && typeof record.role === 'object' ? record.role as Record<string, unknown> : {}
    return {
      id: String(record.empId ?? record.id ?? ''),
      name: String(record.name ?? ''),
      role: String(roleRecord.value ?? roleRecord.key ?? record.role ?? '')
    }
  }).filter((item) => item.id && item.name && item.role === role)
    .map((item) => ({ id: item.id, name: item.name }))
}

export interface EmployeeOption { id: string; name: string; role: string; status: string }

/** 当前操作人可见范围内的在职员工（店长为本门店，候选不按岗位过滤）。 */
async function employeeDirectory(): Promise<EmployeeOption[]> {
  const result = await post<unknown>('user/employee/page', { current: 1, size: 500 })
  const rows = Array.isArray(result)
    ? result
    : (result && typeof result === 'object'
      ? ((result as Record<string, unknown>).content ?? (result as Record<string, unknown>).records ?? (result as Record<string, unknown>).list)
      : [])
  const list = Array.isArray(rows) ? rows : []
  return list.map((raw) => {
    const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    const roleRecord = record.role && typeof record.role === 'object' ? record.role as Record<string, unknown> : {}
    const statusRecord = record.status && typeof record.status === 'object' ? record.status as Record<string, unknown> : {}
    return {
      id: String(record.empId ?? record.id ?? ''),
      name: String(record.name ?? ''),
      role: String(roleRecord.value ?? roleRecord.key ?? record.role ?? ''),
      status: String(statusRecord.value ?? statusRecord.key ?? record.status ?? 'active').toLowerCase()
    }
  }).filter((item) => item.id && item.name && item.status === 'active')
}

/** 当前企业的身份与外对信息（BOSS/店长可读；写权限仅 BOSS）。 */
async function companyInfo(): Promise<Company> {
  return post<Company>('company/company/info', {})
}

/**
 * 更新企业信息。
 *
 * 只消费 App 已在使用的 `company/company/update`（不新开 API）；后端 `requireBoss` 强制仅企业负责人可写。
 * setting 采用字段级合并，未提交的字段不会被清空。
 */
async function updateCompany(input: {
  title?: string
  name?: string
  addr?: string
  setting?: CompanySetting
}): Promise<Company> {
  return post<Company>('company/company/update', input)
}

/**
 * 在职员工个人手机号（仅 BOSS 可读的 company/member/page）。
 * 用途：拦截「把员工个人手机号填成企业统一客服电话」——业主端不露出员工个人号（USER-DECISION-20261014-002 §四）。
 */
async function memberPhones(): Promise<string[]> {
  const result = await post<unknown>('company/member/page', { status: 'Active', current: 1, size: 200 })
  const rows = Array.isArray(result)
    ? result
    : (result && typeof result === 'object'
      ? ((result as Record<string, unknown>).content ?? (result as Record<string, unknown>).records ?? (result as Record<string, unknown>).list)
      : [])
  const list = Array.isArray(rows) ? rows : []
  return list
    .map((raw) => {
      const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
      return typeof record.telNo === 'string' ? record.telNo : ''
    })
    .filter(Boolean)
}


function enumText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return String(record.value ?? record.key ?? fallback)
  }
  return fallback
}

function enumName(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return String(record.name ?? record.value ?? record.key ?? '')
  }
  return ''
}

function inviteRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[]
  if (!raw || typeof raw !== 'object') return []
  const record = raw as Record<string, unknown>
  for (const key of ['content', 'items', 'records', 'list']) {
    if (Array.isArray(record[key])) return record[key] as Record<string, unknown>[]
  }
  return []
}

function normalizeEmployeeInvite(raw: Record<string, unknown>): EmployeeInvite {
  const store = raw.store && typeof raw.store === 'object' ? raw.store as Record<string, unknown> : null
  const team = raw.team && typeof raw.team === 'object' ? raw.team as Record<string, unknown> : null
  return {
    inviteId: String(raw.inviteId ?? raw.id ?? ''),
    inviteName: typeof raw.inviteName === 'string' ? raw.inviteName : undefined,
    telNo: typeof raw.telNo === 'string' ? raw.telNo : undefined,
    role: raw.role ? { key: enumName(raw.role), value: enumName(raw.role), name: enumName(raw.role) } : null,
    status: raw.status ? { key: enumName(raw.status), value: enumName(raw.status), name: enumName(raw.status) } : null,
    store: store ? { storeId: String(store.storeId ?? ''), name: String(store.name ?? ''), defaultStore: store.defaultStore === true } : null,
    team: team ? { teamId: String(team.teamId ?? ''), name: String(team.name ?? '') } : null,
    expireTime: typeof raw.expireTime === 'string' ? raw.expireTime : undefined,
    createTime: raw.createTime as EmployeeInvite['createTime'],
    reusedPending: raw.reusedPending === true
  }
}

/** 企业成员列表：组织与门店范围由服务端强制。 */
async function memberPage(params: { status?: string; storeId?: string; current?: number; size?: number } = {}): Promise<Employee[]> {
  const result = await post<unknown>('company/member/page', { status: 'Active', current: 1, size: 200, ...params })
  const rows = Array.isArray(result)
    ? result
    : (result && typeof result === 'object'
      ? ((result as Record<string, unknown>).content ?? (result as Record<string, unknown>).records ?? (result as Record<string, unknown>).list)
      : [])
  return (Array.isArray(rows) ? rows : []).map((raw) => {
    const record = raw as Record<string, unknown>
    return {
      empId: String(record.empId ?? record.id ?? ''),
      name: String(record.name ?? ''),
      telNo: typeof record.telNo === 'string' ? record.telNo : undefined,
      role: record.role && typeof record.role === 'object'
        ? { key: enumText(record.role), value: enumText(record.role), name: String((record.role as Record<string, unknown>).name ?? '') }
        : null,
      status: record.status && typeof record.status === 'object'
        ? { key: enumText(record.status), value: enumText(record.status), name: String((record.status as Record<string, unknown>).name ?? '') }
        : null,
      store: record.store && typeof record.store === 'object'
        ? {
            storeId: String((record.store as Record<string, unknown>).storeId ?? ''),
            name: String((record.store as Record<string, unknown>).name ?? ''),
            defaultStore: (record.store as Record<string, unknown>).defaultStore === true
          }
        : null,
      team: record.team && typeof record.team === 'object'
        ? {
            teamId: String((record.team as Record<string, unknown>).teamId ?? ''),
            name: String((record.team as Record<string, unknown>).name ?? '')
          }
        : null
    }
  })
}

/** 调整成员岗位/门店。跨店调整财务仅 BOSS；服务端兜底。 */
async function updateMember(empId: string, role: EmployeeRole, storeId?: string): Promise<void> {
  await post('company/member/update', { empId, role, storeId: storeId || undefined })
}

/** 创建员工邀请。BOSS 邀请财务时必须传目标门店；重复待接受邀请由服务端幂等返回。 */
async function createInvite(input: { inviteName: string; invitePhone: string; role: EmployeeRole; storeId?: string }): Promise<EmployeeInvite> {
  return normalizeEmployeeInvite(await post<Record<string, unknown>>('invite/invitation/save', input))
}

async function pendingInvites(): Promise<EmployeeInvite[]> {
  const now = Date.now()
  return inviteRows(await post<unknown>('invite/invitation/page', { current: 1, size: 200 }))
    .map(normalizeEmployeeInvite)
    .filter((invite) => enumName(invite.status).toLowerCase() === 'pending')
    .filter((invite) => {
      if (!invite.expireTime) return true
      const expiresAt = new Date(invite.expireTime.replace(' ', 'T')).getTime()
      return Number.isNaN(expiresAt) || expiresAt > now
    })
}

async function cancelInvite(inviteId: string): Promise<void> {
  await post('invite/invitation/cancel', { inviteId, reason: '管理员取消邀请' })
}

async function suspendMember(empId: string): Promise<void> {
  await post('company/member/suspend', { empId })
}

async function resumeMember(empId: string): Promise<void> {
  await post('company/member/resume', { empId })
}

async function resignMember(empId: string, reason: string, forceHandover = false): Promise<void> {
  await post('company/member/resign', { empId, reason, forceHandover })
}

export const identityApi = { passwordLogin, sessionInfo, logout, designers, stores, employeesByRole, employeeDirectory, companyInfo, updateCompany, memberPhones, memberPage, updateMember, createInvite, pendingInvites, cancelInvite, suspendMember, resumeMember, resignMember }
