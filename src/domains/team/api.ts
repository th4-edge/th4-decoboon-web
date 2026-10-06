import { post } from '@/core/http'
import type { TeamLeaderReport, TeamMemberPerformance, TeamRecentCustomer } from './model'

function text(value: unknown): string { return typeof value === 'string' ? value : value == null ? '' : String(value) }
function numberValue(value: unknown): number { return typeof value === 'number' ? value : Number(value ?? 0) || 0 }
function listOf(value: unknown): unknown[] { return Array.isArray(value) ? value : [] }
function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}
function enumText(value: unknown): string {
  const record = recordOf(value)
  return text(record.name ?? record.value ?? record.key)
}

function memberOf(raw: unknown): TeamMemberPerformance {
  const item = recordOf(raw)
  const employee = recordOf(item.employee)
  return {
    empId: text(employee.empId), name: text(employee.name), role: enumText(employee.role),
    customerCount: numberValue(item.customerCount),
    followOverdueCount: numberValue(item.followOverdueCount),
    quoteCount: numberValue(item.quoteCount), quoteAmount: numberValue(item.quoteAmount),
    signedAmount: numberValue(item.signedAmount), projectCount: numberValue(item.projectCount),
    taskTodoCount: numberValue(item.taskTodoCount), taskOverdueCount: numberValue(item.taskOverdueCount)
  }
}

function customerOf(raw: unknown): TeamRecentCustomer {
  const item = recordOf(raw)
  return {
    id: text(item.custId ?? item.id), name: text(item.name), community: text(item.community),
    status: enumText(item.status),
    ownerName: text(recordOf(item.owner).name), designerName: text(recordOf(item.designer).name)
  }
}

/** 只映射已授权字段；cost 等受限字段不进入前端模型（GAP-026）。 */
function reportOf(raw: unknown): TeamLeaderReport {
  const item = recordOf(raw)
  return {
    teamName: text(item.teamName),
    memberCount: numberValue(item.memberCount),
    marketerCount: numberValue(item.marketerCount),
    designerCount: numberValue(item.designerCount),
    projectManagerCount: numberValue(item.projectManagerCount),
    customerCount: numberValue(item.customerCount),
    followingCustomerCount: numberValue(item.followingCustomerCount),
    pendingMeasureCount: numberValue(item.pendingMeasureCount),
    unassignedDesignerCount: numberValue(item.unassignedDesignerCount),
    followDueCount: numberValue(item.followDueCount),
    followOverdueCount: numberValue(item.followOverdueCount),
    quoteCount: numberValue(item.quoteCount),
    pendingQuoteCount: numberValue(item.pendingQuoteCount),
    acceptedQuoteCount: numberValue(item.acceptedQuoteCount),
    quoteAmount: numberValue(item.quoteAmount),
    acceptedQuoteAmount: numberValue(item.acceptedQuoteAmount),
    signedAmount: numberValue(item.signedAmount),
    conversionRate: numberValue(item.conversionRate),
    projectCount: numberValue(item.projectCount),
    preparingProjectCount: numberValue(item.preparingProjectCount),
    ongoingProjectCount: numberValue(item.ongoingProjectCount),
    acceptingProjectCount: numberValue(item.acceptingProjectCount),
    suspendedProjectCount: numberValue(item.suspendedProjectCount),
    finishedProjectCount: numberValue(item.finishedProjectCount),
    taskTodoCount: numberValue(item.taskTodoCount),
    taskOverdueCount: numberValue(item.taskOverdueCount),
    reportCount: numberValue(item.reportCount),
    noticeUnreadCount: numberValue(item.noticeUnreadCount),
    memberPerformances: listOf(item.memberPerformances).map(memberOf),
    recentCustomers: listOf(item.recentCustomers).map(customerOf)
  }
}

export const teamApi = {
  report: async (): Promise<TeamLeaderReport> => reportOf(await post<unknown>('statistic/team-leader/report', {}))
}
