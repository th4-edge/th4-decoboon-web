import { post } from '@/core/http'
import type { AcceptanceBrief, ProjectBrief, ProjectBusinessOrigin, ProjectStage, ProjectStatus, ProjectTask, SiteReport, StageStatus } from './model'

type RawRecord = Record<string, unknown>

const PROJECT_STATUS: Record<string, ProjectStatus> = {
  Preparing: 'preparing',
  Ongoing: 'ongoing',
  Suspended: 'suspended',
  Accepting: 'accepting',
  Finished: 'finished',
  Settled: 'settled'
}

const UNIT_NAMES: Record<string, string> = {
  Area: '㎡',
  Count: '个',
  Item: '项',
  Place: '处',
  Set: '套',
  House: '户',
  Metre: 'm',
  Centimeter: 'cm',
  Step: '步',
  Plate: '樘',
  Block: '块',
  Root: '根',
  Hole: '扇',
  Pcs: '台',
  Stick: '支',
  Grid: '格',
  Sheet: '片'
}

const STAGE_STATUS: Record<string, StageStatus> = {
  Todo: 'todo',
  Doing: 'doing',
  Accepting: 'accepting',
  Done: 'done',
  Cancelled: 'cancelled'
}

function str(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isNaN(parsed) ? 0 : parsed
}

function enumValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const record = raw as RawRecord
    return str(record.value ?? record.key ?? record.name)
  }
  return ''
}

function recordOf(raw: unknown): RawRecord {
  return raw && typeof raw === 'object' ? raw as RawRecord : {}
}

function pageRows(raw: unknown): RawRecord[] {
  if (Array.isArray(raw)) return raw as RawRecord[]
  const record = recordOf(raw)
  for (const key of ['content', 'list', 'records']) {
    if (Array.isArray(record[key])) return record[key] as RawRecord[]
  }
  return []
}

function normalizeProject(raw: RawRecord): ProjectBrief {
  const quote = recordOf(raw.quote)
  const customer = recordOf(raw.customer)
  const property = recordOf(raw.property)
  const designer = recordOf(raw.designer)
  const manager = recordOf(raw.manager)
  return {
    id: str(raw.projectId ?? raw.id),
    no: str(raw.no),
    name: str(raw.name),
    status: PROJECT_STATUS[enumValue(raw.status)] ?? 'preparing',
    progress: num(raw.progress),
    currentStageName: str(recordOf(raw.currentStage).name ?? raw.currentStageName) || undefined,
    quoteId: str(quote.quoteId ?? quote.id ?? raw.quoteId) || undefined,
    customerId: str(customer.custId ?? customer.id ?? raw.customerId) || undefined,
    customerName: str(customer.name) || undefined,
    designerId: str(designer.empId ?? designer.id) || undefined,
    managerId: str(manager.empId ?? manager.id) || undefined,
    designerName: str(designer.name) || undefined,
    managerName: str(manager.name) || undefined,
    businessOrigin: enumValue(raw.businessOrigin).toLowerCase() === 'carryover' ? 'carryover' : enumValue(raw.businessOrigin).toLowerCase() === 'new' ? 'new' : undefined,
    propertyId: str(property.propertyId ?? property.id ?? raw.propertyId) || undefined,
    propertyName: str(property.community ?? property.address) || undefined,
    community: str(raw.community ?? property.community) || undefined,
    address: str(raw.address ?? raw.siteAddr ?? property.address) || undefined,
    area: num(raw.area),
    contractAmount: num(raw.contractAmount),
    startDate: str(raw.startDate) || undefined,
    planEndDate: str(raw.planEndDate) || undefined,
    createdAt: str(recordOf(raw.createTime).dateTime ?? raw.createTime ?? raw.createdAt) || undefined
  }
}

function normalizeStage(raw: RawRecord): ProjectStage {
  return {
    id: str(raw.stageId ?? raw.id),
    projectId: str(raw.projectId ?? recordOf(raw.project).projectId),
    name: str(raw.name),
    sort: num(raw.sort),
    weight: num(raw.weight),
    status: STAGE_STATUS[enumValue(raw.status)] ?? 'todo',
    progress: num(raw.progress),
    plannedStart: str(raw.plannedStart) || undefined,
    plannedEnd: str(raw.plannedEnd) || undefined,
    actualStart: str(raw.actualStart) || undefined,
    actualEnd: str(raw.actualEnd) || undefined
  }
}

function normalizeTask(raw: RawRecord): ProjectTask {
  const owner = recordOf(raw.owner)
  return {
    id: str(raw.taskId ?? raw.id),
    projectId: str(raw.projectId ?? recordOf(raw.project).projectId),
    stageId: str(raw.stageId ?? recordOf(raw.stage).stageId),
    name: str(raw.name),
    status: enumValue(raw.status) || 'Todo',
    quantity: num(raw.quantity),
    unit: (UNIT_NAMES[enumValue(raw.unit)] ?? str(raw.unit)) || undefined,
    progress: num(raw.progress),
    ownerName: str(owner.name) || undefined,
    plannedStart: str(raw.plannedStart) || undefined,
    plannedEnd: str(raw.plannedEnd) || undefined
  }
}

function normalizeReport(raw: RawRecord): SiteReport {
  const author = recordOf(raw.author ?? raw.emp ?? raw.submittedBy)
  const createTime = recordOf(raw.createTime)
  return {
    id: str(raw.reportId ?? raw.id),
    projectId: str(raw.projectId ?? recordOf(raw.project).projectId),
    stageId: str(raw.stageId ?? recordOf(raw.stage).stageId) || undefined,
    title: str(raw.title) || '现场记录',
    content: str(raw.content ?? raw.remark),
    reportAt: str(raw.reportAt ?? raw.reportDate ?? createTime.dateTime ?? raw.createTime) || undefined,
    authorName: str(author.name) || undefined
  }
}

function normalizeAcceptance(raw: RawRecord): AcceptanceBrief {
  const issues = Array.isArray(raw.issues) ? raw.issues.map(str).filter(Boolean) : []
  return {
    id: str(raw.acceptanceId ?? raw.id),
    projectId: str(raw.projectId ?? recordOf(raw.project).projectId),
    stageId: str(raw.stageId ?? recordOf(raw.stage).stageId),
    status: enumValue(raw.status) || 'Pending',
    result: enumValue(raw.result) || 'Pending',
    content: str(raw.content ?? raw.conclusion) || undefined,
    issues,
    createdAt: str(raw.createdAt ?? recordOf(raw.createTime).dateTime) || undefined,
    confirmedAt: str(raw.confirmedAt ?? raw.confirmAt) || undefined
  }
}

export interface ProjectPageQuery {
  keyword?: string
  status?: ProjectStatus
  statuses?: ProjectStatus[]
  designerId?: string
  managerId?: string
  storeId?: string
  businessOrigin?: ProjectBusinessOrigin
  current?: number
  size?: number
}

export interface ProjectPageData {
  list: ProjectBrief[]
  total: number
  hasMore: boolean
}

export async function pageProjects(query: ProjectPageQuery = {}): Promise<ProjectPageData> {
  const current = query.current ?? 1
  const size = query.size ?? 200
  const raw = await post<unknown>('project/project/page', {
    current,
    size,
    keyword: query.keyword?.trim() || undefined,
    status: query.status ? Object.entries(PROJECT_STATUS).find(([, value]) => value === query.status)?.[0] : undefined,
    statuses: query.statuses?.length
      ? query.statuses.map((value) => Object.entries(PROJECT_STATUS).find(([, item]) => item === value)?.[0]).filter(Boolean)
      : undefined,
    designerId: query.designerId || undefined,
    managerId: query.managerId || undefined,
    storeId: query.storeId || undefined,
    businessOrigin: query.businessOrigin
      ? { new: 'New', carryover: 'Carryover' }[query.businessOrigin]
      : undefined
  })
  const list = pageRows(raw).map(normalizeProject)
  const record = recordOf(raw)
  const total = Number(record.totalElements ?? record.total ?? list.length)
  return { list, total, hasMore: current * size < total }
}

export async function listProjects(query: ProjectPageQuery = {}): Promise<ProjectBrief[]> {
  return (await pageProjects(query)).list
}

export async function projectInfo(projectId: string): Promise<ProjectBrief> {
  return normalizeProject(recordOf(await post<unknown>('project/project/info', { projectId })))
}

export async function listStages(projectId: string): Promise<ProjectStage[]> {
  const raw = await post<unknown>('project/stage/page', { projectId })
  return pageRows(raw).map(normalizeStage)
}

export async function listTasks(projectId: string): Promise<ProjectTask[]> {
  const raw = await post<unknown>('project/task/page', { projectId })
  return pageRows(raw).map(normalizeTask)
}

export async function listReports(projectId: string): Promise<SiteReport[]> {
  const raw = await post<unknown>('project/report/page', { projectId })
  return pageRows(raw).map(normalizeReport)
}

export async function listAcceptances(projectId: string): Promise<AcceptanceBrief[]> {
  const raw = await post<unknown>('project/acceptance/page', { projectId })
  return pageRows(raw).map(normalizeAcceptance)
}

export const projectApi = { listProjects, pageProjects, projectInfo, listStages, listTasks, listReports, listAcceptances }
