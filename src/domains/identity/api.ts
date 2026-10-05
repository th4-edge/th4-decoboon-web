import { post } from '@/core/http'
import type { PasswordLoginInput, SessionProfile } from './model'

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

export const identityApi = { passwordLogin, sessionInfo, logout }
