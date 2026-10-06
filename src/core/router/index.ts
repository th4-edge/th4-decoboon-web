import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { setUnauthorizedHandler } from '@/core/http'
import { useSessionStore } from '@/stores/session'
import { DEFAULT_AUTHENTICATED_PATH, REDIRECT_QUERY_KEY, runtime } from '@/core/runtime'
import { homePathForRole } from '@/roles/permission'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
    title?: string
    roles?: string[]
  }
}

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
    path: '/designer',
    component: () => import('@/layouts/DesignerLayout.vue'),
    redirect: '/designer/workbench',
    meta: { requiresAuth: true, roles: ['Designer'] },
    children: [
      {
        path: 'workbench',
        name: 'designer-workbench',
        component: () => import('@/views/designer/DesignerWorkbenchView.vue'),
        meta: { title: '今日工作' }
      },
      {
        path: 'quotes',
        name: 'designer-quotes',
        component: () => import('@/views/designer/DesignerQuoteListView.vue'),
        meta: { title: '报价工作台' }
      },
      {
        path: 'quotes/:quoteId',
        name: 'designer-quote-workspace',
        component: () => import('@/views/designer/DesignerQuoteWorkspaceView.vue'),
        meta: { title: '报价工作区' }
      },
      {
        path: 'customers',
        name: 'designer-customers',
        component: () => import('@/views/designer/DesignerCustomersView.vue'),
        meta: { title: '客户与设计' }
      },
      {
        path: 'design',
        name: 'designer-design',
        component: () => import('@/views/designer/DesignerCustomersView.vue'),
        meta: { title: '设计与方案' }
      },
      {
        path: 'design/:designId',
        name: 'designer-design-workspace',
        component: () => import('@/views/designer/DesignerDesignWorkspaceView.vue'),
        meta: { title: '设计工作区' }
      },
      {
        path: 'contract',
        name: 'designer-contract',
        component: () => import('@/views/designer/DesignerContractHandoffView.vue'),
        meta: { title: '合同交接' }
      },
      {
        path: 'projects',
        name: 'designer-projects',
        component: () => import('@/views/designer/DesignerProjectsView.vue'),
        meta: { title: '项目工地' }
      },
      {
        path: 'projects/:projectId/materials',
        name: 'designer-project-materials',
        component: () => import('@/views/designer/DesignerMaterialSelectionView.vue'),
        meta: { title: '主材选材工作区' }
      },
      {
        path: 'catalog',
        name: 'designer-catalog',
        component: () => import('@/views/designer/DesignerCatalogView.vue'),
        meta: { title: '报价项目库' }
      },
      {
        path: 'performance',
        name: 'designer-performance',
        component: () => import('@/views/designer/DesignerPerformanceView.vue'),
        meta: { title: '我的业绩' }
      }
    ]
  },
  {
    path: '/forbidden',
    name: 'forbidden',
    component: () => import('@/views/system/ForbiddenView.vue'),
    meta: { requiresAuth: true, title: '无权访问' }
  },
  // 仅开发环境注册：基础组件渲染预览与报价工作区真实数据预览，生产构建不含这些路由。
  ...(import.meta.env.DEV
    ? [{
        path: '/__preview/components',
        name: 'component-preview',
        component: () => import('@/views/system/ComponentPreviewView.vue'),
        meta: { title: '组件预览' }
      }, {
        path: '/__preview/quote',
        name: 'quote-preview',
        component: () => import('@/views/designer/DesignerQuoteWorkspaceView.vue'),
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

function isDesignerArea(path: string): boolean {
  return path === '/designer' || path.startsWith('/designer/')
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

  if (session.isAuthenticated) {
    if (session.role === 'Designer' && to.path === '/workbench') {
      return { path: homePathForRole(session.role) }
    }
    if (session.role !== 'Designer' && isDesignerArea(to.path)) {
      return { name: 'forbidden' }
    }
    if (to.meta.roles && session.role && !to.meta.roles.includes(session.role)) {
      return { name: 'forbidden' }
    }
  }

  if (to.meta.guestOnly && session.isAuthenticated) {
    return { path: homePathForRole(session.role) }
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
