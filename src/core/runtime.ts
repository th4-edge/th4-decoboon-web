/** 运行时配置：Token 键名、API 基址与构建版本的唯一来源。 */
export const runtime = {
  apiBase: import.meta.env.VITE_API_BASE || '/api/',
  tokenKey: 'decoboon-web.token',
  version: __WEB_VERSION__,
  releaseVersion: __WEB_RELEASE_VERSION__,
  buildId: __WEB_BUILD_ID__
} as const

export const REDIRECT_QUERY_KEY = 'redirect'
export const DEFAULT_AUTHENTICATED_PATH = '/workbench'
