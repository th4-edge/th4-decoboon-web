import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { runtime } from '@/core/runtime'
import { identityApi } from '@/domains/identity/api'
import type { EmployeeRole, PasswordLoginInput, SessionProfile } from '@/domains/identity/model'
import { dataScopeLabel, dataScopeOf, isEmployeeRole, roleLabel } from '@/roles/permission'

export const useSessionStore = defineStore('session', () => {
  const token = ref<string>(localStorage.getItem(runtime.tokenKey) ?? '')
  const profile = ref<SessionProfile | null>(null)
  const loading = ref(false)
  const ready = ref(false)

  const isAuthenticated = computed(() => Boolean(token.value && profile.value))
  const employee = computed(() => profile.value?.employee ?? null)
  const company = computed(() => employee.value?.company ?? null)
  const store = computed(() => employee.value?.store ?? null)
  const role = computed<EmployeeRole | null>(() => {
    const raw = employee.value?.role?.value
    return isEmployeeRole(raw) ? raw : null
  })
  const roleName = computed(() => roleLabel(role.value))
  const dataScope = computed(() => dataScopeOf(role.value))
  /** 数据范围展示名（中文投影）；逻辑判断请继续使用 dataScope。 */
  const dataScopeName = computed(() => dataScopeLabel(dataScope.value))
  const displayName = computed(() => employee.value?.name ?? '员工')
  const companyName = computed(() => company.value?.title ?? company.value?.name ?? '装得清')

  function persistToken(value: string): void {
    token.value = value
    if (value) localStorage.setItem(runtime.tokenKey, value)
    else localStorage.removeItem(runtime.tokenKey)
  }

  async function loadProfile(): Promise<void> {
    if (!token.value) throw new Error('缺少登录令牌')
    const result = await identityApi.sessionInfo()
    profile.value = result
    ready.value = true
  }

  async function login(input: PasswordLoginInput): Promise<void> {
    loading.value = true
    try {
      const result = await identityApi.passwordLogin(input)
      persistToken(result.token)
      await loadProfile()
    } finally {
      loading.value = false
    }
  }

  async function logout(): Promise<void> {
    try {
      if (token.value) await identityApi.logout()
    } catch {
      // 退出接口失败也必须清理本地会话。
    } finally {
      clear()
    }
  }

  function clear(): void {
    persistToken('')
    profile.value = null
    ready.value = false
  }

  return {
    token, profile, loading, ready,
    isAuthenticated, employee, company, store, role, roleName, dataScope, dataScopeName, displayName, companyName,
    login, loadProfile, logout, clear
  }
})
