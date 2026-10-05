/** 运行时配置：Token 键名与 API 基址的唯一来源。 */
export const runtime = {
  apiBase: import.meta.env.VITE_API_BASE || '/api/',
  tokenKey: 'decoboon-web-v3.token'
} as const

export const REDIRECT_QUERY_KEY = 'redirect'
export const DEFAULT_AUTHENTICATED_PATH = '/workbench'
