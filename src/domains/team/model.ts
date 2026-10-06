/**
 * 团队负责人经营概览（只读）。
 *
 * 严格遵循 GAP-026：不携带成本、利润、毛利率、应付、付款、现金流、工资、提成字段。
 * 报告接口原始载荷含 recentQuotes/recentProjects 的 cost，这里在 API 映射层显式剔除，
 * 保证受限字段不进入前端模型。
 */
export interface TeamLeaderReport {
  teamName: string
  memberCount: number
  marketerCount: number
  designerCount: number
  projectManagerCount: number
  customerCount: number
  followingCustomerCount: number
  pendingMeasureCount: number
  unassignedDesignerCount: number
  followDueCount: number
  followOverdueCount: number
  quoteCount: number
  pendingQuoteCount: number
  acceptedQuoteCount: number
  quoteAmount: number
  acceptedQuoteAmount: number
  signedAmount: number
  conversionRate: number
  projectCount: number
  preparingProjectCount: number
  ongoingProjectCount: number
  acceptingProjectCount: number
  suspendedProjectCount: number
  finishedProjectCount: number
  taskTodoCount: number
  taskOverdueCount: number
  reportCount: number
  noticeUnreadCount: number
  memberPerformances: TeamMemberPerformance[]
  recentCustomers: TeamRecentCustomer[]
}

export interface TeamMemberPerformance {
  empId: string
  name: string
  role: string
  customerCount: number
  followOverdueCount: number
  quoteCount: number
  quoteAmount: number
  signedAmount: number
  projectCount: number
  taskTodoCount: number
  taskOverdueCount: number
}

export interface TeamRecentCustomer {
  id: string
  name: string
  community: string
  status: string
  ownerName: string
  designerName: string
}

export interface TeamCustomerPageItem {
  id: string
  name: string
  phone: string
  community: string
  status: string
  ownerName: string
  designerId?: string
  designerName?: string
}
