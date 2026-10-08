import { post } from '@/core/http'
import type { DesignerBusinessWorkbenchReport, DesignerMeasureQuery, DesignerMeasureTask, WorkQueueItem } from './model'

/** 角色业务工作台只读聚合 Provider。 */
export function designerBusinessWorkbench(): Promise<DesignerBusinessWorkbenchReport> {
  return post<DesignerBusinessWorkbenchReport>('statistic/workbench/designer/report', {})
}

/** 设计师 Today Queue 独立 Provider。 */
export function designerWorkQueue(): Promise<WorkQueueItem[]> {
  return post<WorkQueueItem[]>('statistic/workbench/designer/queue/list', {})
}

/** 设计师待量房任务队列：客户 + 房屋级，状态和主行动由服务端返回。 */
export function designerMeasureTasks(query: DesignerMeasureQuery = {}): Promise<DesignerMeasureTask[]> {
  return post<DesignerMeasureTask[]>('statistic/designer/measure/list', {
    keyword: query.keyword?.trim() || undefined,
    state: query.state || undefined
  })
}

export const workbenchApi = {
  designerBusinessWorkbench,
  designerWorkQueue,
  designerMeasureTasks
}
