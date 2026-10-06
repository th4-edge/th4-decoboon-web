import { post } from '@/core/http'
import type { PasswordLoginInput, SessionProfile } from './model'

export interface EntityOption { id: string; name: string }

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
    return { id: String(record.storeId ?? record.id ?? ''), name: String(record.name ?? '') }
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

export const identityApi = { passwordLogin, sessionInfo, logout, designers, stores, employeesByRole }
