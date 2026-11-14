import type { RouteRecordRaw } from 'vue-router'
import type { EmployeeRole } from '@/domains/identity/model'
import { homePathForRole } from '@/roles/permission'

/**
 * 每角色的静态路由集合（用户 2026-10-11 架构裁决）。
 *
 * 规则：**每个角色沉淀自己的静态路由 + 静态菜单，运行时不参与任何角色判断。**
 * - 登录后按当前角色**只装载该角色的路由集合**（查表 = 数据分离，不是 if / 白名单）；
 * - 不再有 `meta.roles`、区域判断（`isDesignerArea` / `isFinanceArea`）或临时白名单（`STORE_MANAGER_DESIGNER_PATHS`）；
 * - 同一页面组件可被多角色共用：在**各角色集合里各自声明**即可；页面内部按角色渲染差异属于页面逻辑，不是准入逻辑；
 * - 真正的权限与数据范围兜底在**服务端**（Provider 层角色校验 + 数据范围裁剪）。
 */

type Leaf = RouteRecordRaw

const leaf = (
  path: string,
  name: string,
  component: Leaf['component'],
  title: string,
  extraMeta: Record<string, unknown> = {}
): Leaf =>
  // 单视图路由；RouteRecordRaw 是联合类型，这里显式收窄，避免 TS 无法从对象字面量判定分支。
  ({ path, name, component, meta: { title, ...extraMeta } } as RouteRecordRaw)

const shell: Leaf['component'] = () => import('@/layouts/RoleAreaShell.vue')

/** 路由叶子目录：按名字引用，供各角色集合按需组合（每项只定义一次，组件懒加载不变）。 */
const L = {
  // —— 共享 ——
  // guestOnly 必须保留：未登录命中 /login 时守卫据此放行，否则会把 /login 再次当作受保护页重定向到 /login?redirect=/login?...，形成无限重定向并卡死页面。
  login: leaf('/login', 'login', () => import('@/views/auth/LoginView.vue'), '登录', { guestOnly: true }),
  forbidden: { path: '/forbidden', name: 'forbidden', component: () => import('@/views/system/ForbiddenView.vue'), meta: { requiresAuth: true, title: '无权访问' } } as Leaf,
  accountProfile: leaf('profile', 'account-profile', () => import('@/views/account/AccountCenterView.vue'), '个人信息'),
  accountCompany: leaf('company', 'account-company', () => import('@/views/account/AccountCenterView.vue'), '企业信息'),
  accountPayslips: leaf('payslips', 'account-payslips', () => import('@/views/account/MyPayslipsView.vue'), '我的工资条'),
  accountAttendance: leaf('attendance', 'account-attendance', () => import('@/views/account/MyAttendanceView.vue'), '我的考勤'),
  accountCommissions: leaf('commissions', 'account-commissions', () => import('@/views/account/MyCommissionsView.vue'), '我的提成'),
  messages: leaf('', 'messages', () => import('@/views/notice/NotificationCenterView.vue'), '消息通知'),
  businessBlueprints: leaf('', 'business-blueprints', () => import('@/views/blueprint/BusinessBlueprintCenterView.vue'), '材料业务说明'),
  componentPreview: leaf('/__preview/components', 'component-preview', () => import('@/views/system/ComponentPreviewView.vue'), '组件预览'),
  quotePreview: leaf('/__preview/quote', 'quote-preview', () => import('@/views/designer/DesignerQuoteWorkspaceView.vue'), '报价真实数据预览'),

  // —— /workbench 子路由 ——
  wbHome: leaf('', 'workbench-home', () => import('@/views/workbench/WorkbenchHomeView.vue'), '工作台'),
  wbBossHome: leaf('', 'workbench-boss-home', () => import('@/views/workbench/BossWorkbenchHomeView.vue'), '经营总览'),
  wbBossOverview: leaf('overview', 'workbench-boss-overview', () => import('@/views/workbench/BossOverviewView.vue'), '经营分析'),
  wbBossOrganization: leaf('organization', 'workbench-boss-organization', () => import('@/views/workbench/BossOrganizationView.vue'), '成员与组织'),
  wbMarketerCustomers: leaf('my-customers', 'workbench-marketer-customers', () => import('@/views/workbench/MarketerCustomerView.vue'), '我的客户'),
  // 业务员「我的预约量房」：消费 App 已在用的 statistic/boss/measure/report（非新开接口）。
  wbMarketerMeasure: leaf('measure', 'workbench-marketer-measure', () => import('@/views/workbench/MarketerMeasureView.vue'), '我的预约量房'),
  // 业务员「我的业绩」：消费 App 已在用的 statistic/marketer/report（非新开接口）。
  wbMarketerPerformance: leaf('my-performance', 'workbench-marketer-performance', () => import('@/views/workbench/MarketerPerformanceView.vue'), '我的业绩'),
  // 业务员「签约后流转」：本人客户项目的只读进度面（info + stages + tasks，App 同范围）。
  wbMarketerProjects: leaf('my-projects', 'workbench-marketer-projects', () => import('@/views/workbench/MarketerProjectsView.vue'), '签约后流转'),
  wbStoreCustomers: leaf('customers', 'workbench-store-customers', () => import('@/views/workbench/StoreCustomerView.vue'), '客户'),
  wbCustomer360: leaf('customers/:customerId', 'workbench-customer-360', () => import('@/views/workbench/StoreCustomerView.vue'), '客户 360'),
  wbStoreOverview: leaf('store-overview', 'workbench-store-overview', () => import('@/views/workbench/StoreOverviewView.vue'), '门店经营概览'),
  wbStoreCarryover: leaf('store-carryover', 'workbench-store-carryover', () => import('@/views/workbench/StoreCarryoverView.vue'), '本店业务承接'),
  wbProjectExecution: leaf('project-execution', 'workbench-project-execution', () => import('@/views/workbench/ProjectExecutionView.vue'), '施工排期与现场留证'),
  wbRisk: leaf('risk', 'workbench-risk', () => import('@/views/workbench/RiskQueueView.vue'), '风险队列'),
  wbSuppliers: leaf('suppliers', 'workbench-suppliers', () => import('@/views/supply/SupplierManagementView.vue'), '供应商档案'),
  wbSupplierDetail: leaf('suppliers/:partnerId', 'workbench-supplier-detail', () => import('@/views/supply/SupplierDetailView.vue'), '供应商详情'),
  wbRectification: leaf('rectification', 'workbench-rectification', () => import('@/views/designer/DesignerRectificationFollowUpView.vue'), '整改跟进'),
  wbCustomerFeedback: leaf('customer-feedback', 'workbench-customer-feedback', () => import('@/views/designer/DesignerCustomerFeedbackView.vue'), '客户意见投诉'),
  wbContractChanges: leaf('contract-changes', 'workbench-contract-changes', () => import('@/views/designer/DesignerContractChangeBoardView.vue'), '增减项'),
  wbMaterialSelectionBoard: leaf('material-selection', 'workbench-material-selection-board', () => import('@/views/designer/DesignerMaterialSelectionBoardView.vue'), '主材选材'),
  wbMaterialOrderSheets: leaf('material-sheets', 'workbench-material-order-sheets', () => import('@/views/material/MaterialOrderSheetsView.vue'), '主材作业单'),
  wbMaterialSelection: leaf('materials/:projectId', 'workbench-material-selection', () => import('@/views/designer/DesignerMaterialSelectionView.vue'), '主材选材工作区'),

  // —— /designer 子路由 ——
  dsWorkbench: leaf('workbench', 'designer-workbench', () => import('@/views/designer/DesignerWorkbenchView.vue'), '业务工作台'),
  dsQuotes: leaf('quotes', 'designer-quotes', () => import('@/views/designer/DesignerQuoteQueueView.vue'), '待我谈单'),
  dsQuoteHistory: leaf('quote-history', 'designer-quote-history', () => import('@/views/designer/DesignerQuoteHistoryView.vue'), '报价历史'),
  dsQuoteWorkspace: leaf('quotes/:quoteId', 'designer-quote-workspace', () => import('@/views/designer/DesignerQuoteWorkspaceView.vue'), '报价工作区'),
  dsMyCustomers: leaf('my-customers', 'designer-my-customers', () => import('@/views/designer/DesignerMyCustomersView.vue'), '我的客户'),
  dsCustomer360: {
    path: 'my-customers/:customerId',
    name: 'designer-customer-360',
    redirect: (to: any) => ({ name: 'workbench-customer-360', params: { customerId: String(to.params.customerId ?? '') }, query: to.query })
  },
  dsFollowup: leaf('followup', 'designer-followup', () => import('@/views/designer/DesignerFollowUpTasksView.vue'), '待我跟进'),
  dsMeasure: leaf('measure', 'designer-measure', () => import('@/views/designer/DesignerMeasureTasksView.vue'), '待我量房'),
  dsCustomers: leaf('customers', 'designer-customers', () => import('@/views/designer/DesignerCustomersView.vue'), '客户与设计'),
  dsDesign: leaf('design', 'designer-design', () => import('@/views/designer/DesignerCustomersView.vue'), '待我设计'),
  dsDesignWorkspace: leaf('design/:designId', 'designer-design-workspace', () => import('@/views/designer/DesignerDesignWorkspaceView.vue'), '设计工作区'),
  dsContract: leaf('contract', 'designer-contract', () => import('@/views/designer/DesignerContractHandoffView.vue'), '待我签约'),
  dsProjects: leaf('projects', 'designer-projects', () => import('@/views/designer/DesignerProjectsView.vue'), '项目工地'),
  dsProjectContract: leaf('projects/:projectId/contract', 'designer-project-contract', () => import('@/views/designer/DesignerProjectContractView.vue'), '项目合同档案'),
  dsProjectMaterials: leaf('projects/:projectId/materials', 'designer-project-materials', () => import('@/views/designer/DesignerMaterialSelectionView.vue'), '主材选材工作区'),
  dsProjectChanges: leaf('projects/:projectId/changes', 'designer-project-changes', () => import('@/views/designer/DesignerContractChangesView.vue'), '增减项工作区'),
  dsProjectAcceptance: leaf('projects/:projectId/acceptance', 'designer-project-acceptance', () => import('@/views/designer/DesignerAcceptanceView.vue'), '阶段验收工作区'),
  dsCatalog: leaf('catalog', 'designer-catalog', () => import('@/views/designer/DesignerCatalogView.vue'), '报价项目库'),
  wbDesignReviews: leaf('design-reviews', 'workbench-design-reviews', () => import('@/views/designer/DesignReviewView.vue'), '设计方案运营查看'),
  wbDesignReviewDetail: leaf('design-reviews/:designId', 'workbench-design-review-detail', () => import('@/views/designer/DesignReviewDetailView.vue'), '设计方案运营详情'),
  fnDesignReviews: leaf('design-reviews', 'finance-design-reviews', () => import('@/views/designer/DesignReviewView.vue'), '设计方案与报价查看'),
  fnDesignReviewDetail: leaf('design-reviews/:designId', 'finance-design-review-detail', () => import('@/views/designer/DesignReviewDetailView.vue'), '设计方案与报价详情'),
  dsTemplates: leaf('templates', 'designer-templates', () => import('@/views/designer/DesignerTemplateLibraryView.vue'), '方案模版'),
  dsTemplateEditor: leaf('templates/:templateId', 'designer-template-editor', () => import('@/views/designer/DesignerTemplateEditorView.vue'), '方案模版编辑'),
  dsPerformance: leaf('performance', 'designer-performance', () => import('@/views/designer/DesignerPerformanceView.vue'), '我的业绩'),
  dsFeedbackRedirect: { path: 'feedback', name: 'designer-feedback', redirect: '/workbench/customer-feedback' } as Leaf,

  // —— /pm 子路由 ——
  pmWorkbench: leaf('workbench', 'pm-workbench', () => import('@/views/pm/PmWorkbenchView.vue'), '业务工作台'),
  pmProjectAcceptance: leaf('projects/:projectId/acceptance', 'pm-project-acceptance', () => import('@/views/designer/DesignerAcceptanceView.vue'), '阶段验收工作区'),

  // —— /finance 子路由 ——
  fnWorkbench: leaf('workbench', 'finance-workbench', () => import('@/views/finance/FinanceWorkbenchView.vue'), '财务工作台'),
  fnReceivables: leaf('receivables', 'finance-receivables', () => import('@/views/finance/FinanceReceivablesView.vue'), '应收计划'),
  fnReceipts: leaf('receipts', 'finance-receipts', () => import('@/views/finance/FinanceReceiptsView.vue'), '收款记录'),
  fnRefunds: leaf('refunds', 'finance-refunds', () => import('@/views/finance/FinanceRefundsView.vue'), '客户退款'),
  fnEmployeeSalaries: leaf('employee-salaries', 'finance-employee-salaries', () => import('@/views/finance/FinanceEmployeeSalariesView.vue'), '员工工资'),
  fnCompensationSchemes: leaf('compensation-schemes', 'finance-compensation-schemes', () => import('@/views/finance/FinanceCompensationSchemesView.vue'), '薪酬方案'),
  fnEmployeeCommissions: leaf('employee-commissions', 'finance-employee-commissions', () => import('@/views/finance/FinanceEmployeeCommissionsView.vue'), '员工提成'),
  fnPayables: leaf('payables', 'finance-payables', () => import('@/views/finance/FinancePayablesView.vue'), '应付账款'),
  fnExpenses: leaf('expenses', 'finance-expenses', () => import('@/views/finance/FinanceExpensesView.vue'), '费用与报销'),
  fnSalaries: {
    ...leaf('salaries', 'finance-salaries', () => import('@/views/finance/FinancePayablesView.vue'), '工人工资'),
    props: { salaryMode: true }
  } as Leaf,
  fnPayments: leaf('payments', 'finance-payments', () => import('@/views/finance/FinancePaymentsView.vue'), '付款记录'),
  fnPartners: leaf('partners', 'finance-partners', () => import('@/views/finance/FinancePartnersView.vue'), '供应商往来'),
  fnMaterialOrdering: leaf('material-ordering', 'finance-material-ordering', () => import('@/views/finance/FinanceMaterialOrderingView.vue'), '主材下单'),
  fnMaterialSettlement: leaf('material-settlement', 'finance-material-settlement', () => import('@/views/finance/FinanceMaterialSettlementView.vue'), '主材结算'),
  fnLedger: leaf('ledger', 'finance-ledger', () => import('@/views/finance/FinanceLedgerView.vue'), '资金台账'),
  fnCommissionAdjustments: leaf('commission-adjustments', 'finance-commission-adjustments', () => import('@/views/finance/FinanceCommissionAdjustmentsView.vue'), '提成负向调整'),
  fnProjects: leaf('projects', 'finance-projects', () => import('@/views/finance/FinanceProjectsView.vue'), '项目账本'),
  fnProject: leaf('projects/:projectId', 'finance-project', () => import('@/views/finance/FinanceProjectView.vue'), '项目核算'),
  fnVouchers: leaf('vouchers', 'finance-vouchers', () => import('@/views/finance/FinanceVouchersView.vue'), '收付凭证'),
  fnPayroll: leaf('payroll', 'finance-payroll', () => import('@/views/finance/FinancePayrollWorkbenchView.vue'), '薪酬工作台'),
  fnStorePayroll: leaf('store-payroll', 'finance-store-payroll', () => import('@/views/finance/FinanceStorePayrollView.vue'), '本店薪酬'),
  fnVoucherTemplates: leaf('voucher-templates', 'finance-voucher-templates', () => import('@/views/finance/FinanceVoucherTemplatesView.vue'), '凭证模板'),
  fnQuotes: leaf('quotes', 'finance-quotes', () => import('@/views/finance/FinanceQuotesView.vue'), '报价'),
  fnQuoteDetail: leaf('quotes/:quoteId', 'finance-quote-detail', () => import('@/views/finance/FinanceQuoteDetailView.vue'), '报价详情')
}

/** /workbench 区域：指定角色首页 + 该角色可见的子工作面。 */
const workbenchAreaWithHome = (home: Leaf, ...children: Leaf[]): Leaf => ({
  path: '/workbench',
  // 与原路由保持同名（历史上有 name: 'workbench'；代码中无人按名跳转，保留以免外部深链接语义变化）
  name: 'workbench',
  component: shell,
  meta: { requiresAuth: true },
  children: [home, ...children]
})

const workbenchArea = (...children: Leaf[]): Leaf => workbenchAreaWithHome(L.wbHome, ...children)

/** /designer 区域：该区域路由集合（各角色按需组装，不再靠 meta.roles 判断）。 */
const designerArea = (...children: Leaf[]): Leaf => ({
  path: '/designer',
  component: shell,
  meta: { requiresAuth: true },
  children
})

/** /pm 区域。 */
const pmArea = (...children: Leaf[]): Leaf => ({
  path: '/pm',
  component: shell,
  redirect: '/pm/workbench',
  meta: { requiresAuth: true },
  children
})

/** /finance 区域。 */
const financeArea = (...children: Leaf[]): Leaf => ({
  path: '/finance',
  component: shell,
  redirect: '/finance/workbench',
  meta: { requiresAuth: true },
  children
})

/** 账户与消息（全员共享，但仍是各自集合内的一份声明）。 */
const accountArea: Leaf = {
  path: '/account',
  component: shell,
  meta: { requiresAuth: true },
  children: [L.accountProfile, L.accountCompany, L.accountAttendance, L.accountCommissions, L.accountPayslips]
}
const messagesArea: Leaf = { path: '/messages', component: shell, meta: { requiresAuth: true }, children: [L.messages] }
const blueprintArea: Leaf = { path: '/business-blueprints', component: shell, meta: { requiresAuth: true }, children: [L.businessBlueprints] }

const FINANCE_CHILDREN: Leaf[] = [
  L.fnWorkbench, L.fnReceivables, L.fnReceipts, L.fnRefunds, L.fnEmployeeSalaries, L.fnCompensationSchemes, L.fnEmployeeCommissions,
  L.fnPayables, L.fnExpenses, L.fnSalaries, L.fnPayments, L.fnPartners, L.fnLedger, L.fnCommissionAdjustments,
  L.fnProjects, L.fnProject, L.fnVouchers, L.fnPayroll, L.fnStorePayroll, L.fnVoucherTemplates,
  L.fnMaterialOrdering, L.fnMaterialSettlement
]

const DESIGNER_FULL: Leaf[] = [
  L.dsWorkbench, L.dsQuotes, L.dsQuoteHistory, L.dsQuoteWorkspace, L.dsMyCustomers, L.dsCustomer360, L.dsFollowup, L.dsMeasure,
  L.dsCustomers, L.dsDesign, L.dsDesignWorkspace, L.dsContract, L.dsProjects, L.dsProjectContract, L.dsProjectMaterials,
  L.dsProjectChanges, L.dsProjectAcceptance, L.dsCatalog, L.dsTemplates, L.dsTemplateEditor, L.dsPerformance,
  L.dsFeedbackRedirect
]

/** 共享部分：登录、无权、账户、消息、404（每个角色集合都含一份）。 */
const sharedOf = (role: EmployeeRole, extra: Leaf[] = []): Leaf[] => [
  { path: '/', redirect: homePathForRole(role) },
  L.login,
  L.forbidden,
  accountArea,
  messagesArea,
  ...extra,
  ...(import.meta.env.DEV ? [L.componentPreview, L.quotePreview] : []),
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/system/NotFoundView.vue'), meta: { title: '页面不存在' } } as Leaf
]

/**
 * 角色 → 静态路由集合。
 * 归属来源：原 `meta.roles` 声明 + 组级默认 + 店长在设计域的历史白名单，**逐条平移，不新增权限**。
 */
export const routesByRole: Record<EmployeeRole, RouteRecordRaw[]> = {
  Designer: [
    ...sharedOf('Designer'),
    workbenchArea(L.wbCustomer360, L.wbProjectExecution, L.wbRectification, L.wbCustomerFeedback, L.wbContractChanges, L.wbMaterialSelectionBoard, L.wbMaterialSelection),
    designerArea(...DESIGNER_FULL),
    pmArea(L.pmProjectAcceptance),
    financeArea(L.fnExpenses)
  ],
  Boss: [
    ...sharedOf('Boss', [blueprintArea]),
    workbenchAreaWithHome(
      L.wbBossHome,
      L.wbBossOverview, L.wbBossOrganization, L.wbMarketerCustomers, L.wbCustomer360,
      L.wbStoreCustomers, L.wbStoreOverview, L.wbStoreCarryover, L.wbRisk, L.wbSuppliers, L.wbSupplierDetail, L.wbRectification, L.wbCustomerFeedback,
      L.wbProjectExecution, L.wbContractChanges, L.wbMaterialSelectionBoard, L.wbMaterialSelection, L.wbMaterialOrderSheets,
      L.wbDesignReviews, L.wbDesignReviewDetail
    ),
    designerArea(...DESIGNER_FULL),
    pmArea(L.pmWorkbench, L.pmProjectAcceptance),
    financeArea(...FINANCE_CHILDREN)
  ],
  StoreManager: [
    ...sharedOf('StoreManager', [blueprintArea]),
    workbenchArea(
      L.wbBossOrganization, L.wbStoreCustomers, L.wbCustomer360, L.wbStoreOverview, L.wbStoreCarryover, L.wbRisk, L.wbSuppliers, L.wbSupplierDetail, L.wbRectification, L.wbCustomerFeedback,
      L.wbProjectExecution, L.wbContractChanges, L.wbMaterialSelectionBoard, L.wbMaterialSelection, L.wbMaterialOrderSheets,
      L.wbDesignReviews, L.wbDesignReviewDetail
    ),
    // 2026-10-17：店长查看本店设计方案；后端设计查询仍按 Store 数据范围裁剪。
    designerArea(
      L.dsCustomers, L.dsDesign, L.dsDesignWorkspace,
      L.dsCatalog, L.dsTemplates, L.dsTemplateEditor,
      L.dsQuotes, L.dsQuoteHistory, L.dsQuoteWorkspace, L.dsContract, L.dsProjects,
      L.dsProjectMaterials, L.dsProjectChanges, L.dsProjectAcceptance
    ),
    pmArea(L.pmWorkbench),
    financeArea(...FINANCE_CHILDREN)
  ],
  // DEC-082：TeamLeader 只保留历史数据解码，不装载任何角色业务路由。
  TeamLeader: [...sharedOf('TeamLeader')],
  // 业务员：App 侧可达面的 Web 落地（capability view:feedback）。
  // 客户意见投诉页对非处置角色（Designer/Pm/Boss/StoreManager 之外）天然只读 → 业务员**只读查看**，
  // 「受理/回复/关闭」动作是否开放待 GAP-WEB-015 裁决，不在本轮断言。
  Marketer: [
    ...sharedOf('Marketer'),
    workbenchArea(L.wbMarketerCustomers, L.wbCustomer360, L.wbMarketerMeasure, L.wbMarketerPerformance, L.wbMarketerProjects, L.wbCustomerFeedback),
    financeArea(L.fnExpenses)
  ],
  Pm: [
    ...sharedOf('Pm'),
    workbenchArea(L.wbCustomer360, L.wbProjectExecution, L.wbRectification, L.wbCustomerFeedback, L.wbContractChanges, L.wbSuppliers, L.wbSupplierDetail),
    pmArea(L.pmWorkbench, L.pmProjectAcceptance),
    financeArea(L.fnExpenses)
  ],
  Finance: [
    ...sharedOf('Finance', [blueprintArea]),
    workbenchArea(L.wbStoreCustomers, L.wbCustomer360, L.wbRisk, L.wbSuppliers, L.wbSupplierDetail, L.wbRectification, L.wbCustomerFeedback, L.wbContractChanges),
    designerArea(L.dsCatalog),
    financeArea(...FINANCE_CHILDREN, L.fnDesignReviews, L.fnDesignReviewDetail, L.fnQuotes, L.fnQuoteDetail)
  ]
}
