import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import { runtime } from './runtime'

/** th4 Provider 统一响应信封。 */
export interface ProviderEnvelope<T> {
  success: boolean
  data: T
  errorCode?: { code: string; message: string; system?: boolean }
}

/** 业务错误：code 为 Provider 的 errorCode.code。 */
export class ProviderError extends Error {
  readonly code: string
  readonly system: boolean

  constructor(message: string, code = 'UNKNOWN', system = false) {
    super(message)
    this.name = 'ProviderError'
    this.code = code
    this.system = system
  }
}

const client = axios.create({
  baseURL: runtime.apiBase,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' }
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(runtime.tokenKey)
  if (token) config.headers.set('token', token)
  return config
})

const AUTH_FAILURE_CODES = new Set(['401', 'tokenIsUndefined', 'tokenInvalid', 'tokenExpired'])

export function isAuthFailure(code: string): boolean {
  return AUTH_FAILURE_CODES.has(code)
}

type UnauthorizedHandler = () => void
let onUnauthorized: UnauthorizedHandler = () => {}
/** 由 router 引导层注入：避免 http 层直接依赖 router。 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  onUnauthorized = handler
}

function toProviderError(error: AxiosError<ProviderEnvelope<unknown>>): ProviderError {
  if (error.code === 'ECONNABORTED') return new ProviderError('请求超时，请稍后重试', 'TIMEOUT', true)
  if (!error.response) return new ProviderError('网络异常，请检查网络后重试', 'NETWORK', true)
  const envelope = error.response.data
  const code = envelope?.errorCode?.code ?? String(error.response.status)
  const message = envelope?.errorCode?.message ?? '请求失败，请稍后重试'
  return new ProviderError(message, code, envelope?.errorCode?.system ?? false)
}

async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await client.request<ProviderEnvelope<T>>(config)
    const envelope = response.data
    if (!envelope || envelope.success !== true) {
      const code = envelope?.errorCode?.code ?? 'UNKNOWN'
      const error = new ProviderError(envelope?.errorCode?.message ?? '请求失败', code, envelope?.errorCode?.system ?? false)
      if (isAuthFailure(code)) onUnauthorized()
      throw error
    }
    return envelope.data
  } catch (error) {
    if (error instanceof ProviderError) throw error
    if (error instanceof AxiosError) {
      const providerError = toProviderError(error)
      if (isAuthFailure(providerError.code)) onUnauthorized()
      throw providerError
    }
    throw new ProviderError('未知错误', 'UNKNOWN', true)
  }
}

export function get<T>(uri: string, params?: Record<string, unknown>): Promise<T> {
  return request<T>({ url: uri, method: 'GET', params })
}

export function post<T>(uri: string, data: unknown = {}): Promise<T> {
  return request<T>({ url: uri, method: 'POST', data })
}

export function put<T>(uri: string, data: unknown = {}): Promise<T> {
  return request<T>({ url: uri, method: 'PUT', data })
}
