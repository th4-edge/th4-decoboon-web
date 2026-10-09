import { post } from '@/core/http'
import type { DesignerBusinessWorkbenchReport, DesignerDesignTask, DesignerMeasureQuery, DesignerMeasureTask, WorkQueueItem } from './model'

/** 角色业务工作台只读聚合 Provider。 */
export function designerBusinessWorkbench(): Promise<DesignerBusinessWorkbenchReport> {
  return post<DesignerBusinessWorkbenchReport>('statistic/workbench/designer/report', {})
}

/** 设计师 Today Queue 独立 Provider。 */
export function designerWorkQueue(): Promise<WorkQueueItem[]> {
  return post<WorkQueueItem[]>('statistic/workbench/designer/queue/list', {})
}

type RawRecord = Record<string, unknown>

function str(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

function num(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

function normalizeDesignerDesignTask(raw: RawRecord): DesignerDesignTask {
  return {
    customerId: str(raw.custId ?? raw.customerId),
    propertyId: str(raw.propertyId),
    customerName: str(raw.customerName),
    telNo: str(raw.telNo) || undefined,
    community: str(raw.community) || undefined,
    address: str(raw.addr ?? raw.address) || undefined,
    area: num(raw.area),
    customerStatus: str(raw.customerStatus) || undefined,
    customerStatusName: str(raw.customerStatusName) || undefined,
    measureAt: str(raw.measureAt) || undefined,
    pendingMeasureAt: str(raw.pendingMeasureAt) || undefined,
    designStatus: raw.designStatus === 'Doing' || raw.designStatus === 'Done' ? raw.designStatus : 'Pending',
    designStatusName: str(raw.designStatusName) || '待设计',
    schemeCount: num(raw.schemeCount) ?? 0,
    hasRequirement: raw.hasRequirement === true,
    lastDesignAt: str(raw.lastDesignAt) || undefined,
    stayDays: num(raw.stayDays) ?? 0
  }
}

/** 设计师待量房任务队列：客户 + 房屋级，状态和主行动由服务端返回。 */
export function designerMeasureTasks(query: DesignerMeasureQuery = {}): Promise<DesignerMeasureTask[]> {
  return post<DesignerMeasureTask[]>('statistic/designer/measure/list', {
    keyword: query.keyword?.trim() || undefined,
    state: query.state || undefined
  })
}

/** 设计师设计工作台：复用 App 已有客户 + 房屋级 Provider，Web 仅做展示分组。 */
export async function designerDesignTasks(): Promise<DesignerDesignTask[]> {
  const raw = await post<unknown[]>('statistic/workbench/design/page', {})
  return (Array.isArray(raw) ? raw : []).map((item) => normalizeDesignerDesignTask(item as RawRecord))
}

export const workbenchApi = {
  designerBusinessWorkbench,
  designerWorkQueue,
  designerMeasureTasks,
  designerDesignTasks
}
