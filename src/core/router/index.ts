import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { setUnauthorizedHandler } from '@/core/http'
import { useSessionStore } from '@/stores/session'
import { DEFAULT_AUTHENTICATED_PATH, REDIRECT_QUERY_KEY, runtime } from '@/core/runtime'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: DEFAULT_AUTHENTICATED_PATH },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/auth/LoginView.vue'),
    meta: { guestOnly: true, title: '登录企业工作台' }
  },
  {
    path: '/workbench',
    name: 'workbench',
    component: () => import('@/layouts/WorkbenchLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'workbench-home',
        component: () => import('@/views/workbench/WorkbenchHomeView.vue'),
        meta: { title: '工作台' }
      }
    ]
  },
  {
    path: '/forbidden',
    name: 'forbidden',
    component: () => import('@/views/system/ForbiddenView.vue'),
    meta: { requiresAuth: true, title: '无权访问' }
  },
  // 仅开发环境注册：基础组件渲染预览（G3 证据用），生产构建不含该路由。
  ...(import.meta.env.DEV
    ? [{
        path: '/__preview/components',
        name: 'component-preview',
        component: () => import('@/views/system/ComponentPreviewView.vue'),
        meta: { title: '组件预览' }
      }, {
        path: '/__preview/quote',
        name: 'quote-preview',
        component: () => import('@/views/system/QuotePreviewView.vue'),
        meta: { title: '报价真实数据预览' }
      } as RouteRecordRaw]
    : []),
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/system/NotFoundView.vue'),
    meta: { title: '页面不存在' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

function redirectTarget(fullPath: string): string {
  return fullPath.startsWith('/login') ? DEFAULT_AUTHENTICATED_PATH : fullPath
}

router.beforeEach(async (to) => {
  const session = useSessionStore()
  const hasToken = Boolean(localStorage.getItem(runtime.tokenKey))

  if (to.meta.requiresAuth && !hasToken) {
    return { name: 'login', query: { [REDIRECT_QUERY_KEY]: redirectTarget(to.fullPath) } }
  }

  if (hasToken && !session.ready) {
    try {
      await session.loadProfile()
    } catch {
      session.clear()
      if (to.meta.requiresAuth) {
        return { name: 'login', query: { [REDIRECT_QUERY_KEY]: redirectTarget(to.fullPath) } }
      }
    }
  }

  if (to.meta.guestOnly && session.isAuthenticated) {
    return { path: DEFAULT_AUTHENTICATED_PATH }
  }

  return true
})

router.afterEach((to) => {
  const base = '装得清 · 企业工作台'
  document.title = to.meta.title ? `${String(to.meta.title)} | ${base}` : base
})

// http 层遇到 401/token 失效时只做清理与跳转，不反向依赖 router。
setUnauthorizedHandler(() => {
  const session = useSessionStore()
  session.clear()
  const redirect = redirectTarget(router.currentRoute.value.fullPath)
  if (router.currentRoute.value.name === 'login') return
  void router.replace({ name: 'login', query: { [REDIRECT_QUERY_KEY]: redirect } })
})

export default router
