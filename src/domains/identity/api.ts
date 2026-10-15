import { post } from '@/core/http'
import type { Company, CompanySetting, PasswordLoginInput, SessionProfile } from './model'

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

export const identityApi = { passwordLogin, sessionInfo, logout, designers, stores, employeesByRole, employeeDirectory, companyInfo, updateCompany, memberPhones }
