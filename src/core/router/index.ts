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
      ,
      {
        path: 'my-customers',
        name: 'workbench-marketer-customers',
        component: () => import('@/views/workbench/MarketerCustomerView.vue'),
        meta: { title: '我的客户', roles: ['Boss', 'Marketer'] }
      },
      {
        path: 'team-overview',
        name: 'workbench-team-overview',
        component: () => import('@/views/workbench/TeamOverviewView.vue'),
        meta: { title: '团队经营概览', roles: ['Boss', 'TeamLeader'] }
      },
      {
        path: 'team-customers',
        name: 'workbench-team-customers',
        component: () => import('@/views/workbench/TeamCustomerView.vue'),
        meta: { title: '本团队客户', roles: ['Boss', 'TeamLeader'] }
      },
      {
        path: 'customers',
        name: 'workbench-store-customers',
        component: () => import('@/views/workbench/StoreCustomerView.vue'),
        meta: { title: '本店客户', roles: ['Boss', 'StoreManager'] }
      },
      {
        path: 'risk',
        name: 'workbench-risk',
        component: () => import('@/views/workbench/RiskQueueView.vue'),
        meta: { title: '风险队列', roles: ['Boss', 'Finance', 'StoreManager'] }
      },
      {
        path: 'materials/:projectId',
        name: 'workbench-material-selection',
        component: () => import('@/views/designer/DesignerMaterialSelectionView.vue'),
        meta: { title: '主材选材工作区', roles: ['Designer', 'Boss', 'StoreManager', 'Finance'] }
      }
    ]
  },
  {
    path: '/designer',
    component: () => import('@/layouts/DesignerLayout.vue'),
    redirect: '/designer/workbench',
    meta: { requiresAuth: true, roles: ['Designer', 'Boss'] },
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
        path: 'projects/:projectId/changes',
        name: 'designer-project-changes',
        component: () => import('@/views/designer/DesignerContractChangesView.vue'),
        meta: { title: '增减项工作区' }
      },
      {
        path: 'projects/:projectId/acceptance',
        name: 'designer-project-acceptance',
        component: () => import('@/views/designer/DesignerAcceptanceView.vue'),
        meta: { title: '阶段验收工作区' }
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
    path: '/pm',
    component: () => import('@/layouts/PmLayout.vue'),
    redirect: '/pm/workbench',
    meta: { requiresAuth: true, roles: ['Pm', 'Boss'] },
    children: [
      {
        path: 'workbench',
        name: 'pm-workbench',
        component: () => import('@/views/pm/PmWorkbenchView.vue'),
        meta: { title: '今日工作' }
      }
      ,
      {
        path: 'projects/:projectId/acceptance',
        name: 'pm-project-acceptance',
        component: () => import('@/views/designer/DesignerAcceptanceView.vue'),
        meta: { title: '阶段验收工作区', roles: ['Pm', 'Designer', 'Boss'] }
      }
    ]
  },
  {
    path: '/finance',
    component: () => import('@/layouts/FinanceLayout.vue'),
    redirect: '/finance/workbench',
    meta: { requiresAuth: true, roles: ['Finance', 'Boss', 'StoreManager'] },
    children: [
      {
        path: 'workbench',
        name: 'finance-workbench',
        component: () => import('@/views/finance/FinanceWorkbenchView.vue'),
        meta: { title: '财务工作台' }
      },
      {
        path: 'receivables',
        name: 'finance-receivables',
        component: () => import('@/views/finance/FinanceReceivablesView.vue'),
        meta: { title: '应收计划' }
      },
      {
        path: 'receipts',
        name: 'finance-receipts',
        component: () => import('@/views/finance/FinanceReceiptsView.vue'),
        meta: { title: '收款记录' }
      },
      {
        path: 'refunds',
        name: 'finance-refunds',
        component: () => import('@/views/finance/FinanceRefundsView.vue'),
        meta: { title: '客户退款' }
      },
      {
        path: 'employee-salaries',
        name: 'finance-employee-salaries',
        component: () => import('@/views/finance/FinanceEmployeeSalariesView.vue'),
        meta: { title: '员工工资' }
      },
      {
        path: 'employee-commissions',
        name: 'finance-employee-commissions',
        component: () => import('@/views/finance/FinanceEmployeeCommissionsView.vue'),
        meta: { title: '员工提成' }
      },
      {
        path: 'payables',
        name: 'finance-payables',
        component: () => import('@/views/finance/FinancePayablesView.vue'),
        meta: { title: '应付账款' }
      },
      {
        path: 'salaries',
        name: 'finance-salaries',
        component: () => import('@/views/finance/FinancePayablesView.vue'),
        props: { salaryMode: true },
        meta: { title: '工人工资' }
      },
      {
        path: 'payments',
        name: 'finance-payments',
        component: () => import('@/views/finance/FinancePaymentsView.vue'),
        meta: { title: '付款记录' }
      },
      {
        path: 'partners',
        name: 'finance-partners',
        component: () => import('@/views/finance/FinancePartnersView.vue'),
        meta: { title: '供应商往来' }
      },
      {
        path: 'ledger',
        name: 'finance-ledger',
        component: () => import('@/views/finance/FinanceLedgerView.vue'),
        meta: { title: '资金台账' }
      },
      {
        path: 'commission-adjustments',
        name: 'finance-commission-adjustments',
        component: () => import('@/views/finance/FinanceCommissionAdjustmentsView.vue'),
        meta: { title: '提成负向调整' }
      },
      {
        path: 'projects',
        name: 'finance-projects',
        component: () => import('@/views/finance/FinanceProjectsView.vue'),
        meta: { title: '项目账本' }
      },
      {
        path: 'projects/:projectId',
        name: 'finance-project',
        component: () => import('@/views/finance/FinanceProjectView.vue'),
        meta: { title: '项目核算' }
      },
      {
        path: 'vouchers',
        name: 'finance-vouchers',
        component: () => import('@/views/finance/FinanceVouchersView.vue'),
        meta: { title: '收付凭证' }
      },
      {
        path: 'voucher-templates',
        name: 'finance-voucher-templates',
        component: () => import('@/views/finance/FinanceVoucherTemplatesView.vue'),
        meta: { title: '凭证模板' }
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
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

function redirectTarget(fullPath: string): string {
  return fullPath.startsWith('/login') ? DEFAULT_AUTHENTICATED_PATH : fullPath
}

function isDesignerArea(path: string): boolean {
  return path === '/designer' || path.startsWith('/designer/')
}

function isFinanceArea(path: string): boolean {
  return path === '/finance' || path.startsWith('/finance/')
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
    if (session.role === 'Finance' && to.path === '/workbench') {
      return { path: homePathForRole(session.role) }
    }
    if (!['Designer', 'Boss'].includes(session.role ?? '') && isDesignerArea(to.path)) {
      return { name: 'forbidden' }
    }
    if (!['Finance', 'Boss', 'StoreManager'].includes(session.role ?? '') && isFinanceArea(to.path)) {
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
