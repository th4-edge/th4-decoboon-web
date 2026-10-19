import { post } from '@/core/http'
import type { MetricDefinition, StoreDesignerPerformance, StoreMonthlyTarget, StoreProfitReport, StoreRecentItem, StoreReport } from './model'

type RawRecord = Record<string, unknown>

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

function metricOf(value: unknown): MetricDefinition {
  const raw = value && typeof value === 'object' ? value as RawRecord : {}
  return {
    key: text(raw.key),
    name: text(raw.name),
    userLabel: text(raw.userLabel),
    category: text(raw.category),
    definition: text(raw.definition),
    formula: text(raw.formula),
    source: text(raw.source),
    timeScope: text(raw.timeScope),
    dataScope: text(raw.dataScope),
    includes: text(raw.includes),
    excludes: text(raw.excludes),
    missingValue: text(raw.missingValue),
    example: text(raw.example),
    updatedAt: text(raw.updatedAt),
    status: text(raw.status)
  }
}

/**
 * 指标字典（口径说明）。
 * 只消费 App 已在使用的 Provider；页面只展示服务端口径，不做任何本地换算或改写。
 */
export async function metricDictionary(keys?: string[]): Promise<MetricDefinition[]> {
  const result = await post<unknown>('statistic/metric/dictionary', keys?.length ? { keys } : {})
  const list = Array.isArray(result) ? result : []
  return list.map(metricOf).filter((item) => item.key)
}

export const statisticApi = { metricDictionary, storeReport, storeTarget, saveStoreTarget, storeProfit }

function num(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isNaN(parsed) ? 0 : parsed
}

/** 服务端返回的中文名优先（状态/来源一律用服务端文案，前端不做本地映射）。 */
function enumName(value: unknown): string {
  if (typeof value === 'string') return value
  const raw = value && typeof value === 'object' ? value as RawRecord : {}
  return text(raw.name ?? raw.value ?? raw.key)
}

function designerPerformanceOf(value: unknown): StoreDesignerPerformance {
  const raw = value && typeof value === 'object' ? value as RawRecord : {}
  const designer = raw.designer && typeof raw.designer === 'object' ? raw.designer as RawRecord : {}
  return {
    designerId: text(designer.empId ?? designer.id),
    designerName: text(designer.name),
    customerCount: num(raw.customerCount),
    pendingMeasureCount: num(raw.pendingMeasureCount),
    quoteCount: num(raw.quoteCount),
    acceptedQuoteCount: num(raw.acceptedQuoteCount),
    pendingDecisionQuoteCount: num(raw.pendingDecisionQuoteCount),
    quoteAmount: num(raw.quoteAmount),
    signedAmount: num(raw.signedAmount),
    projectCount: num(raw.projectCount),
    ongoingProjectCount: num(raw.ongoingProjectCount),
    taskTodoCount: num(raw.taskTodoCount),
    taskOverdueCount: num(raw.taskOverdueCount),
    finalQuoteAcceptanceRate: num(raw.finalQuoteAcceptanceRate),
    firstQuoteAcceptanceRate: num(raw.firstQuoteAcceptanceRate)
  }
}

/** 最近项目/客户条目：只取可安全展示的字段——**不取 cost**（无成本完整性标记，禁止暗示利润）。 */
function recentItemOf(value: unknown): StoreRecentItem {
  const raw = value && typeof value === 'object' ? value as RawRecord : {}
  const customer = raw.customer && typeof raw.customer === 'object' ? raw.customer as RawRecord : {}
  const property = raw.property && typeof raw.property === 'object' ? raw.property as RawRecord : {}
  const amount = raw.contractAmount ?? raw.amount
  return {
    id: text(raw.projectId ?? raw.custId ?? raw.quoteId ?? raw.id),
    no: text(raw.no),
    name: text(raw.name) || text(customer.name),
    statusLabel: enumName(raw.status),
    extraLabel: text(raw.community ?? property.community ?? raw.addr ?? customer.community),
    amount: amount === undefined || amount === null ? null : num(amount),
    progress: raw.progress === undefined || raw.progress === null ? null : num(raw.progress),
    createdAt: text((raw.createTime && typeof raw.createTime === 'object' ? (raw.createTime as RawRecord).dateTime : raw.createTime))
  }
}

/** 门店经营报告（只读聚合；服务端按登录员工的门店数据范围裁剪）。 */
export async function storeReport(storeId?: string | null): Promise<StoreReport> {
  // 门店维度只传真实门店 ID；「全部门店」不传（绝不把状态值 '0' 当门店 ID，DEC-067 BOSS-STORE-10）。
  const scope = storeId && storeId !== '0' ? { storeId } : {}
  const raw = (await post<unknown>('statistic/store/report', scope)) as RawRecord
  const list = (value: unknown): unknown[] => Array.isArray(value) ? value : []
  const scopeRaw = (raw.storeScope && typeof raw.storeScope === 'object' ? raw.storeScope : {}) as RawRecord
  return {
    storeScope: {
      scopeType: text(scopeRaw.scopeType) === 'Store' ? 'Store' : 'AllStores',
      storeId: scopeRaw.storeId == null ? undefined : String(scopeRaw.storeId),
      storeName: scopeRaw.storeName == null ? undefined : text(scopeRaw.storeName),
      unassignedCount: num(scopeRaw.unassignedCount)
    },
    storeName: text(raw.storeName),
    memberCount: num(raw.memberCount),
    designerCount: num(raw.designerCount),
    marketerCount: num(raw.marketerCount),
    projectManagerCount: num(raw.projectManagerCount),
    unassignedDesignerCount: num(raw.unassignedDesignerCount),
    customerCount: num(raw.customerCount),
    newCustomerCount: num(raw.newCustomerCount),
    followingCustomerCount: num(raw.followingCustomerCount),
    dormantCustomerCount: num(raw.dormantCustomerCount),
    pendingMeasureCount: num(raw.pendingMeasureCount),
    quoteCount: num(raw.quoteCount),
    pendingQuoteCount: num(raw.pendingQuoteCount),
    acceptedQuoteCount: num(raw.acceptedQuoteCount),
    submittedQuoteCount: num(raw.submittedQuoteCount),
    pendingDecisionQuoteCount: num(raw.pendingDecisionQuoteCount),
    quoteAmount: num(raw.quoteAmount),
    signedAmount: num(raw.signedAmount),
    conversionRate: num(raw.conversionRate),
    finalQuoteAcceptanceRate: num(raw.finalQuoteAcceptanceRate),
    firstQuoteAcceptanceRate: num(raw.firstQuoteAcceptanceRate),
    projectCount: num(raw.projectCount),
    preparingProjectCount: num(raw.preparingProjectCount),
    ongoingProjectCount: num(raw.ongoingProjectCount),
    acceptingProjectCount: num(raw.acceptingProjectCount),
    suspendedProjectCount: num(raw.suspendedProjectCount),
    finishedProjectCount: num(raw.finishedProjectCount),
    taskTodoCount: num(raw.taskTodoCount),
    taskOverdueCount: num(raw.taskOverdueCount),
    reportCount: num(raw.reportCount),
    designerPerformances: list(raw.designerPerformances).map(designerPerformanceOf),
    recentProjects: list(raw.recentProjects).map(recentItemOf),
    recentCustomers: list(raw.recentCustomers).map(recentItemOf)
  }
}

/** 门店月度目标：店长锁定本店；BOSS 可传 storeId 读取任一门店。 */
export async function storeTarget(month: string, storeId?: string | null): Promise<StoreMonthlyTarget> {
  const raw = (await post<unknown>('statistic/target/info', {
    month: `${month.slice(0, 7)}-01`,
    ...(storeId && storeId !== '0' ? { storeId } : {})
  })) as RawRecord
  const store = raw.store && typeof raw.store === 'object' ? raw.store as RawRecord : {}
  return {
    targetId: raw.targetId == null ? undefined : String(raw.targetId),
    storeId: store.storeId == null ? undefined : String(store.storeId),
    storeName: store.name == null ? undefined : text(store.name),
    targetMonth: text(raw.targetMonth),
    signedAmount: num(raw.signedAmount),
    receivedAmount: num(raw.receivedAmount),
    grossProfit: num(raw.grossProfit),
    activeProjectCount: num(raw.activeProjectCount)
  }
}

/** 保存门店月度目标：店长只能保存本店；BOSS 传 storeId 保存门店目标。 */
export async function saveStoreTarget(input: StoreMonthlyTarget, storeId?: string | null): Promise<StoreMonthlyTarget> {
  const raw = (await post<unknown>('statistic/target/save', {
    month: `${input.targetMonth.slice(0, 7)}-01`,
    signedAmount: input.signedAmount,
    receivedAmount: input.receivedAmount,
    grossProfit: input.grossProfit,
    activeProjectCount: input.activeProjectCount,
    ...(storeId && storeId !== '0' ? { storeId } : {})
  })) as RawRecord
  const store = raw.store && typeof raw.store === 'object' ? raw.store as RawRecord : {}
  return {
    targetId: raw.targetId == null ? undefined : String(raw.targetId),
    storeId: store.storeId == null ? undefined : String(store.storeId),
    storeName: store.name == null ? undefined : text(store.name),
    targetMonth: text(raw.targetMonth),
    signedAmount: num(raw.signedAmount),
    receivedAmount: num(raw.receivedAmount),
    grossProfit: num(raw.grossProfit),
    activeProjectCount: num(raw.activeProjectCount)
  }
}

/** 门店经营利润（参考）：店长/门店财务锁定本店；BOSS 必须传 storeId。 */
export async function storeProfit(storeId?: string | null): Promise<StoreProfitReport> {
  const raw = (await post<unknown>('statistic/store/profit/report', {
    ...(storeId && storeId !== '0' ? { storeId } : {})
  })) as RawRecord
  const nullableNum = (value: unknown): number | null => value === null || value === undefined ? null : num(value)
  return {
    storeId: text(raw.storeId),
    storeName: text(raw.storeName),
    periodLabel: text(raw.periodLabel) || '累计',
    projectGrossProfit: nullableNum(raw.projectGrossProfit),
    otherIncome: num(raw.otherIncome),
    directCompanyExpense: num(raw.directCompanyExpense),
    storeProfit: nullableNum(raw.storeProfit),
    costComplete: raw.costComplete === true,
    profitWarning: raw.profitWarning == null ? undefined : text(raw.profitWarning),
    unallocatedNote: text(raw.unallocatedNote) || '未分摊总部/公共费用'
  }
}
