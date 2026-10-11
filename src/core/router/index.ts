import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { setUnauthorizedHandler } from '@/core/http'
import { useSessionStore } from '@/stores/session'
import { REDIRECT_QUERY_KEY, runtime } from '@/core/runtime'
import { homePathForRole } from '@/roles/permission'
import { routesByRole } from '@/roles/routes'
import type { EmployeeRole } from '@/domains/identity/model'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
    title?: string
  }
}

/**
 * 路由装配：**按当前角色装载该角色的静态路由集合**（用户 2026-10-11 架构裁决 A）。
 *
 * - 每个角色一套静态路由（`src/roles/routes.ts`），运行时不写 `meta.roles`、不做区域判断、没有白名单补丁；
 * - 登录/切换角色（Boss 岗位视角）后重新装载集合；退出登录卸载为匿名集合（仅登录页与 404）；
 * - 越权 URL 落不到本角色集合 → 走 `/forbidden`；真正不存在的路径 → 404；
 * - 权限与数据范围的最终兜底在服务端（Provider 层角色校验 + 数据范围裁剪）。
 */

const anonymousRoutes: RouteRecordRaw[] = [
  { path: '/', redirect: '/login' },
  routesByRole.Finance.find((route) => route.path === '/login') as RouteRecordRaw,
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/system/NotFoundView.vue'), meta: { title: '页面不存在' } } as RouteRecordRaw
]

/** 登录页路径：任何情况下都不作为登录后的回跳目标，否则会自指成死循环。 */
const LOGIN_PATH = '/login'
/** 回跳参数长度上限：超过即判定为被污染的重定向套娃，直接丢弃。 */
const REDIRECT_TARGET_MAX_LENGTH = 512
/**
 * 纯净回跳目标——本文件唯一允许写入 `?redirect=` 的来源：
 * - 只保留同源路径 + 查询串，剥掉 hash 与 `//host` 形式的跳转；
 * - `fullPath` 自身指向登录页 / 已嵌套 `redirect` / 超长 → 说明正在被重定向套娃，丢弃回跳参数（返回 undefined）；
 * - 其余按原样保留，供登录后回跳。
 */
function sanitizeRedirectTarget(fullPath: string): string | undefined {
  const raw = (fullPath ?? '').trim()
  if (!raw) return undefined
  const withoutHash = raw.split('#')[0]
  // 只接受站内绝对路径；`//evil.com`、`http://...` 一律拒绝。
  if (!withoutHash.startsWith('/') || withoutHash.startsWith('//')) return undefined
  if (withoutHash.length > REDIRECT_TARGET_MAX_LENGTH) return undefined
  const [pathname, search = ''] = withoutHash.split('?')
  if (pathname === LOGIN_PATH) return undefined
  if (new URLSearchParams(search).has(REDIRECT_QUERY_KEY)) return undefined
  return withoutHash
}

const router = createRouter({ history: createWebHistory(), routes: [] })

let loadedRole: EmployeeRole | null | undefined
let disposers: Array<() => void> = []

/**
 * 全部角色已知路径的**段模式**（仅用于区分"越权"与"不存在"，不参与准入判断）。
 *
 * ⚠️ 必须做**整段全匹配**，不能用前缀：曾用前缀匹配 + 根路径 `/` 参与集合，
 * 导致 `/` 成为一切路径的前缀 → 任何不存在的 URL 都被判成"别的角色的页面"，
 * 全站 404 被伪装成「无权访问」（浏览器验收才暴露）。空路径与根路径一律不参与匹配。
 */
const knownPatterns: readonly string[][] = Array.from(
  new Set(Object.values(routesByRole).flatMap((routes) => collectPaths(routes)))
)
  .map((known) => known.split('/').filter(Boolean))
  // 排除空/根路径，以及 **catch-all 模式本身**（`/:pathMatch(.*)*`）——
  // 后者会让"任意单段路径"都被判成已知，404 又会被误判成越权。
  .filter((segments) => segments.length > 0
    && !segments.some((segment) => segment.includes(':pathMatch') || segment.includes('(.*)')))

function collectPaths(routes: RouteRecordRaw[], parent = ''): string[] {
  const out: string[] = []
  for (const route of routes) {
    const full = [parent, route.path].filter(Boolean).join('/').replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'
    out.push(full)
    if (route.children?.length) out.push(...collectPaths(route.children, full))
  }
  return out
}

function isKnownToSomeRole(path: string): boolean {
  const segments = path.split('/').filter(Boolean)
  if (!segments.length) return false
  return knownPatterns.some(
    (known) => known.length === segments.length
      && known.every((segment, index) => segment.startsWith(':') || segment === segments[index])
  )
}

function loadRoleRoutes(role: EmployeeRole | null): void {
  for (const dispose of disposers) dispose()
  disposers = []
  const records = role ? routesByRole[role] : anonymousRoutes
  for (const record of records) disposers.push(router.addRoute(record))
  loadedRole = role
}

router.beforeEach(async (to) => {
  const session = useSessionStore()
  const hasToken = Boolean(localStorage.getItem(runtime.tokenKey))

  /**
   * 启动/刷新会话水合（**回归修复**）：`isAuthenticated = Boolean(token && profile)`，
   * 而 `profile` 只在内存 —— 硬加载（刷新 / 直接打开 URL）后必须先用 localStorage 里的 token
   * 拉一次 `session/info`，否则守卫会一直认为"未登录"，把任何刷新都弹回 `/login`。
   * 2026-10-11 按角色静态化重写守卫时丢掉了这段，属自引入回归（浏览器刷新才暴露，门禁不覆盖）。
   */
  if (hasToken && !session.ready) {
    try {
      await session.loadProfile()
    } catch {
      // token 失效：清理本地会话，交给下面的未登录分支带 redirect 回登录页。
      session.clear()
    }
  }

  // 角色变化（登录 / 退出 / Boss 岗位视角切换）→ 重装该角色的路由集合，然后重新解析本次导航。
  if (loadedRole !== (session.role ?? null)) {
    loadRoleRoutes(session.role ?? null)
    return { path: to.fullPath, replace: true }
  }

  if (!session.isAuthenticated) {
    if (to.meta.guestOnly) return true
    return { name: 'login', query: withRedirect(to.fullPath) }
  }

  if (to.meta.guestOnly) return { path: homePathForRole(session.role) }

  // 已登录但该路径不在本角色集合里：属于别的角色的集合 → 无权访问；完全不存在 → 404。
  if (to.name === 'not-found') {
    return isKnownToSomeRole(to.path) ? { name: 'forbidden' } : true
  }

  return true
})

router.afterEach((to) => {
  const base = '装得清 · 企业工作台'
  const title = to.meta.title ? String(to.meta.title) : ''
  document.title = title ? `${title} | ${base}` : base
})

/**
 * 组装跳转登录页的 query：仅当回跳目标纯净（见 `sanitizeRedirectTarget`）时才带上 `redirect`。
 * 目标为根路径或不可信时回落到「未登录默认首页」，始终给出确定的回跳地址。
 */
function withRedirect(fullPath: string): Record<string, string> {
  const clean = sanitizeRedirectTarget(fullPath)
  if (clean && clean !== '/') return { [REDIRECT_QUERY_KEY]: clean }
  return { [REDIRECT_QUERY_KEY]: homePathForRole(null) }
}

// http 层遇到 401/token 失效时只做清理与跳转，不反向依赖 router。
setUnauthorizedHandler(() => {
  const session = useSessionStore()
  session.clear()
  loadRoleRoutes(null)
  if (router.currentRoute.value.name === 'login') return
  void router.replace({ name: 'login', query: withRedirect(router.currentRoute.value.fullPath) })
})

export default router
