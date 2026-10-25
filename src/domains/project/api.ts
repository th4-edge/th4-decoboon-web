import { post } from '@/core/http'
import { normalizeBusinessStateView } from '@/domains/business-state/api'
import type { AcceptanceBrief, ProjectBrief, ProjectBusinessOrigin, ProjectFactNode, ProjectFactSourceGap, ProjectFactStage, ProjectFactTrace, ProjectFactVisibility, ProjectStage, ProjectStatus, ProjectTask, ProjectTaskNode, SiteReport, StageAcceptanceMode, StageStatus } from './model'
import { fileApi } from '@/domains/file/api'
import type { PrivateFileScope } from '@/domains/file/model'

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

const FACT_STAGE: Record<string, ProjectFactStage> = {
  Source: 'source',
  PreSale: 'preSale',
  Signing: 'signing',
  Fulfillment: 'fulfillment',
  Change: 'change',
  Acceptance: 'acceptance',
  Finance: 'finance',
  AfterSales: 'afterSales'
}

const FACT_STAGE_LABEL: Record<ProjectFactStage, string> = {
  source: '来源',
  preSale: '售前',
  signing: '签约',
  fulfillment: '履约',
  change: '变更',
  acceptance: '验收',
  finance: '财务',
  afterSales: '售后'
}

const STAGE_STATUS: Record<string, StageStatus> = {
  Todo: 'todo',
  Doing: 'doing',
  Accepting: 'accepting',
  Done: 'done',
  Cancelled: 'cancelled',
  // GAP-039 / DEC-057：空阶段可被判为「本项不涉及」，必须与「待开始」区分展示。
  NotApplicable: 'notApplicable'
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

function enumLabel(raw: unknown): string {
  const record = recordOf(raw)
  return record.name == null ? '' : String(record.name)
}

function numberOrNull(value: unknown): number | null {
  return value == null || value === '' ? null : Number(value)
}

function requiredFactText(raw: RawRecord, field: string, label: string): string {
  const value = raw[field]
  if (value === null || value === undefined || String(value).trim() === '') {
    throw new Error(`项目事实${label}暂不可确认`)
  }
  return String(value)
}

function requiredFactStage(raw: RawRecord): ProjectFactStage {
  const stage = FACT_STAGE[enumValue(raw.stage)]
  if (!stage) throw new Error('项目事实阶段暂不可确认')
  return stage
}

function requiredFactVersion(raw: RawRecord): number {
  const version = Number(raw.version)
  if (!Number.isInteger(version) || version < 1) throw new Error('项目事实版本暂不可确认')
  return version
}

function requiredFactType(raw: RawRecord): string {
  const factType = enumValue(raw.factType)
  if (!factType) throw new Error('项目事实类型暂不可确认')
  return factType
}

function normalizeFactNode(raw: RawRecord): ProjectFactNode {
  const stage = requiredFactStage(raw)
  if (typeof raw.current !== 'boolean') throw new Error('项目事实当前状态暂不可确认')
  const visibilityValue = enumValue(raw.visibility)
  if (visibilityValue !== 'OwnerVisible' && visibilityValue !== 'Internal') {
    throw new Error('项目事实可见性暂不可确认')
  }
  const visibility: ProjectFactVisibility = visibilityValue === 'OwnerVisible' ? 'ownerVisible' : 'internal'
  return {
    nodeId: requiredFactText(raw, 'nodeId', '节点 ID'),
    nodeKey: requiredFactText(raw, 'nodeKey', '节点键'),
    stage,
    stageName: enumLabel(raw.stage) || FACT_STAGE_LABEL[stage],
    factType: requiredFactType(raw),
    factTypeName: enumLabel(raw.factType),
    objectType: requiredFactText(raw, 'objectType', '对象类型'),
    objectId: requiredFactText(raw, 'objectId', '对象 ID'),
    projectId: requiredFactText(raw, 'projectId', '项目'),
    version: requiredFactVersion(raw),
    current: raw.current,
    status: raw.status == null ? undefined : str(raw.status),
    statusName: raw.statusName == null ? undefined : str(raw.statusName),
    businessTime: str(raw.businessTime) || undefined,
    recordedAt: str(raw.recordedAt) || undefined,
    actorName: raw.actorName == null ? undefined : str(raw.actorName),
    title: raw.title == null ? undefined : str(raw.title),
    summary: raw.summary == null ? undefined : str(raw.summary),
    sourceLabel: raw.sourceLabel == null ? undefined : str(raw.sourceLabel),
    amount: numberOrNull(raw.amount),
    quantity: numberOrNull(raw.quantity),
    progress: numberOrNull(raw.progress),
    costComplete: raw.costComplete == null ? null : raw.costComplete === true,
    profitAmount: numberOrNull(raw.profitAmount),
    grossMargin: numberOrNull(raw.grossMargin),
    uncertainty: raw.uncertainty == null ? undefined : str(raw.uncertainty),
    parentNodeId: raw.parentNodeId == null ? undefined : str(raw.parentNodeId),
    relations: (Array.isArray(raw.relations) ? raw.relations : []).map((item) => {
      const relation = recordOf(item)
      return {
        relationType: requiredFactText(relation, 'relationType', '关系类型'),
        objectType: requiredFactText(relation, 'objectType', '关系对象类型'),
        objectId: requiredFactText(relation, 'objectId', '关系对象 ID'),
        version: requiredFactVersion(relation)
      }
    }),
    visibility,
    navigationPath: raw.navigationPath == null ? undefined : str(raw.navigationPath),
    returnPath: raw.returnPath == null ? undefined : str(raw.returnPath),
    returnAnchor: raw.returnAnchor == null ? undefined : str(raw.returnAnchor)
  }
}

function normalizeFactGap(raw: RawRecord): ProjectFactSourceGap {
  const stage = requiredFactStage(raw)
  if (typeof raw.required !== 'boolean') throw new Error('项目事实缺口级别暂不可确认')
  return {
    nodeKey: requiredFactText(raw, 'nodeKey', '缺口节点键'),
    stage,
    stageName: enumLabel(raw.stage) || FACT_STAGE_LABEL[stage],
    factType: requiredFactType(raw),
    factTypeName: enumLabel(raw.factType),
    label: requiredFactText(raw, 'label', '缺口名称'),
    reason: requiredFactText(raw, 'reason', '缺口原因'),
    required: raw.required
  }
}

export function normalizeProjectFactTrace(raw: RawRecord): ProjectFactTrace {
  const projectId = requiredFactText(raw, 'projectId', '项目')
  if (!Array.isArray(raw.nodes)) throw new Error('项目事实节点暂不可确认')
  if (!Array.isArray(raw.sourceGaps)) throw new Error('项目事实缺口暂不可确认')
  const nodes = raw.nodes.map((item) => normalizeFactNode(recordOf(item)))
  if (nodes.some((node) => node.projectId !== projectId)) throw new Error('项目事实项目绑定暂不可确认')
  return {
    projectId,
    projectNo: raw.projectNo == null ? undefined : str(raw.projectNo),
    projectName: raw.projectName == null ? undefined : str(raw.projectName),
    defaultViewMode: String(enumValue(raw.defaultViewMode) || 'PHASE').toUpperCase() as ProjectFactTrace['defaultViewMode'],
    asOf: raw.asOf == null ? undefined : str(raw.asOf),
    nodes,
    sourceGaps: raw.sourceGaps.map((item) => normalizeFactGap(recordOf(item)))
  }
}

function normalizeProject(raw: RawRecord): ProjectBrief {
  const quote = recordOf(raw.quote)
  const customer = recordOf(raw.customer)
  const property = recordOf(raw.property)
  const designer = recordOf(raw.designer)
  const manager = recordOf(raw.manager)
  const support = recordOf(raw.support)
  return {
    id: str(raw.projectId ?? raw.id),
    no: str(raw.no),
    name: str(raw.name),
    status: PROJECT_STATUS[enumValue(raw.status)] ?? 'preparing',
    businessStateView: normalizeBusinessStateView(raw.businessStateView),
    progress: num(raw.progress),
    currentStageName: str(recordOf(raw.currentStage).name ?? raw.currentStageName) || undefined,
    quoteId: str(quote.quoteId ?? quote.id ?? raw.quoteId) || undefined,
    customerId: str(customer.custId ?? customer.id ?? raw.customerId) || undefined,
    customerName: str(customer.name) || undefined,
    designerId: str(designer.empId ?? designer.id) || undefined,
    managerId: str(manager.empId ?? manager.id) || undefined,
    designerName: str(designer.name) || undefined,
    managerName: str(manager.name) || undefined,
    supportId: str(support.empId ?? support.id) || undefined,
    supportName: str(support.name) || undefined,
    businessOrigin: enumValue(raw.businessOrigin).toLowerCase() === 'carryover' ? 'carryover' : enumValue(raw.businessOrigin).toLowerCase() === 'new' ? 'new' : undefined,
    propertyId: str(property.propertyId ?? property.id ?? raw.propertyId) || undefined,
    propertyName: str(property.community ?? property.address) || undefined,
    community: str(raw.community ?? property.community) || undefined,
    address: str(raw.address ?? raw.siteAddr ?? property.address) || undefined,
    area: num(raw.area),
    contractAmount: num(raw.contractAmount),
    receivableAmount: raw.receivableAmount == null ? undefined : num(raw.receivableAmount),
    receivedAmount: raw.receivedAmount == null ? undefined : num(raw.receivedAmount),
    startDate: str(raw.startDate) || undefined,
    planEndDate: str(raw.planEndDate) || undefined,
    expectedEndDate: str(raw.expectedEndDate) || undefined,
    createdAt: str(recordOf(raw.createTime).dateTime ?? raw.createTime ?? raw.createdAt) || undefined,
    factTrace: raw.factTrace ? normalizeProjectFactTrace(recordOf(raw.factTrace)) : undefined
  }
}

function acceptanceModeOf(value: unknown): StageAcceptanceMode | undefined {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : null
  const text = String(record?.key ?? record?.value ?? value ?? '')
  return ['None', 'ConstructionDone', 'AcceptanceDone'].includes(text)
    ? text as StageAcceptanceMode
    : undefined
}

function normalizeStage(raw: RawRecord): ProjectStage {
  return {
    id: str(raw.stageId ?? raw.id),
    projectId: str(raw.projectId ?? recordOf(raw.project).projectId),
    name: str(raw.name),
    sort: num(raw.sort),
    weight: num(raw.weight),
    acceptanceMode: acceptanceModeOf(raw.acceptanceMode),
    status: STAGE_STATUS[enumValue(raw.status)] ?? 'todo',
    progress: num(raw.progress),
    plannedStart: str(raw.plannedStart) || undefined,
    plannedEnd: str(raw.plannedEnd) || undefined,
    actualStart: str(raw.actualStart) || undefined,
    actualEnd: str(raw.actualEnd) || undefined,
    notApplicableReason: str(raw.notApplicableReason) || undefined
  }
}

function normalizeTask(raw: RawRecord): ProjectTask {
  const owner = recordOf(raw.owner)
  const nodes = Array.isArray(raw.nodes) ? raw.nodes.map(normalizeTaskNode) : []
  return {
    id: str(raw.taskId ?? raw.id),
    projectId: str(raw.projectId ?? recordOf(raw.project).projectId),
    stageId: str(raw.stageId ?? recordOf(raw.stage).stageId),
    name: str(raw.name),
    status: enumValue(raw.status) || 'Todo',
    quantity: num(raw.quantity),
    unit: (UNIT_NAMES[enumValue(raw.unit)] ?? str(raw.unit)) || undefined,
    progress: num(raw.progress),
    ownerId: str(owner.empId ?? raw.ownerId) || undefined,
    ownerName: str(owner.name) || undefined,
    priority: str(raw.priority) || undefined,
    conceal: raw.conceal === true,
    remark: str(raw.remark) || undefined,
    plannedStart: str(raw.plannedStart) || undefined,
    plannedEnd: str(raw.plannedEnd) || undefined,
    actualStart: str(raw.actualStart) || undefined,
    actualEnd: str(raw.actualEnd) || undefined,
    evidenceUrls: Array.isArray(raw.evidenceUrls) ? raw.evidenceUrls.map(str).filter(Boolean) : [],
    nodes
  }
}

function normalizeTaskNode(raw: unknown): ProjectTaskNode {
  const record = recordOf(raw)
  const confirmedBy = recordOf(record.confirmedBy)
  const createTime = recordOf(record.createTime)
  return {
    id: str(record.nodeId ?? record.id),
    key: enumValue(record.nodeKey) || str(record.key),
    note: str(record.note) || undefined,
    confirmedByName: str(confirmedBy.name) || undefined,
    confirmedAt: str(createTime.dateTime ?? record.createTime ?? record.confirmedAt) || undefined
  }
}

interface GrantedMedia {
  urls: string[]
  unavailable: boolean
}

async function grantMedia(scope: PrivateFileScope, businessId: string, rawPaths: unknown): Promise<GrantedMedia> {
  const paths = Array.isArray(rawPaths) ? rawPaths.map(str).filter(Boolean) : []
  if (!paths.length) return { urls: [], unavailable: false }
  if (!businessId) return { urls: paths, unavailable: false }
  try {
    return { urls: await fileApi.grantFiles(scope, businessId, paths), unavailable: false }
  } catch {
    return { urls: [], unavailable: true }
  }
}

async function normalizeReport(raw: RawRecord): Promise<SiteReport> {
  const author = recordOf(raw.author ?? raw.emp ?? raw.submittedBy)
  const createTime = recordOf(raw.createTime)
  const id = str(raw.reportId ?? raw.id)
  const media = await grantMedia('Report', id, raw.images)
  return {
    id,
    projectId: str(raw.projectId ?? recordOf(raw.project).projectId),
    stageId: str(raw.stageId ?? recordOf(raw.stage).stageId) || undefined,
    taskId: str(raw.taskId ?? recordOf(raw.task).taskId) || undefined,
    type: enumValue(raw.type) || undefined,
    title: str(raw.title) || '现场记录',
    content: str(raw.content ?? raw.remark),
    reportAt: str(raw.reportAt ?? raw.reportDate ?? createTime.dateTime ?? raw.createTime) || undefined,
    authorName: str(author.name) || undefined,
    visibleToCustomer: raw.visibleToCustomer === true,
    images: media.urls,
    mediaUnavailable: media.unavailable
  }
}

async function normalizeAcceptance(raw: RawRecord): Promise<AcceptanceBrief> {
  const issues = Array.isArray(raw.issues) ? raw.issues.map(str).filter(Boolean) : []
  const id = str(raw.acceptanceId ?? raw.id)
  const media = await grantMedia('Acceptance', id, raw.evidenceUrls ?? raw.images)
  return {
    id,
    projectId: str(raw.projectId ?? recordOf(raw.project).projectId),
    stageId: str(raw.stageId ?? recordOf(raw.stage).stageId),
    status: enumValue(raw.status) || 'Pending',
    result: enumValue(raw.result) || 'Pending',
    content: str(raw.content ?? raw.conclusion) || undefined,
    issues,
    evidenceUrls: media.urls,
    mediaUnavailable: media.unavailable,
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

export async function taskInfo(taskId: string): Promise<ProjectTask> {
  return normalizeTask(recordOf(await post<unknown>('project/task/info', { taskId })))
}

export interface TaskScheduleInput {
  taskId: string
  projectId: string
  stageId: string
  plannedStart?: string
  plannedEnd?: string
  ownerId?: string
  priority?: string
  remark?: string
}

/** 调整已有合同施工任务的阶段、计划日期、责任人与备注；任务不能手工新增或删除。 */
export async function saveTaskSchedule(input: TaskScheduleInput): Promise<ProjectTask> {
  const raw = await post<unknown>('project/task/save', {
    taskId: input.taskId,
    projectId: input.projectId,
    stageId: input.stageId,
    plannedStart: input.plannedStart || undefined,
    plannedEnd: input.plannedEnd || undefined,
    ownerId: input.ownerId || undefined,
    priority: input.priority?.trim() || undefined,
    remark: input.remark?.trim() || undefined
  })
  return normalizeTask(recordOf(raw))
}

export type TaskNodeKey = 'Start' | 'Conceal' | 'Finish'

/** 三类施工节点留证；媒体必须使用 Task 文件范围上传后的存储路径。 */
export async function confirmTaskNode(input: {
  taskId: string
  key: TaskNodeKey
  note?: string
  paths: string[]
}): Promise<ProjectTaskNode> {
  return normalizeTaskNode(await post<unknown>('project/task-node/save', {
    taskId: input.taskId,
    key: input.key,
    note: input.note?.trim() || undefined,
    medias: input.paths.map((path) => ({ url: fileApi.storagePath(path) || path }))
  }))
}

export async function listReports(projectId: string): Promise<SiteReport[]> {
  const raw = await post<unknown>('project/report/page', { projectId })
  return Promise.all(pageRows(raw).map(normalizeReport))
}

export async function saveProjectReport(input: {
  projectId: string
  stageId?: string
  taskId?: string
  title: string
  content: string
  paths: string[]
  visibleToCustomer: boolean
}): Promise<SiteReport> {
  const raw = await post<unknown>('project/report/save', {
    projectId: input.projectId,
    stageId: input.stageId || undefined,
    taskId: input.taskId || undefined,
    type: 'Progress',
    title: input.title.trim(),
    content: input.content.trim(),
    images: input.paths.map((path) => fileApi.storagePath(path) || path),
    visibleToCustomer: input.visibleToCustomer
  })
  return normalizeReport(recordOf(raw))
}

export async function listAcceptances(projectId: string): Promise<AcceptanceBrief[]> {
  const raw = await post<unknown>('project/acceptance/page', { projectId })
  return Promise.all(pageRows(raw).map(normalizeAcceptance))
}

export async function updateTaskStatus(taskId: string, action: 'start' | 'finish' | 'done' | 'reopen', evidenceUrls?: string[]): Promise<ProjectTask> {
  const raw = await post<unknown>('project/task/update', {
    taskId,
    action,
    evidenceUrls: evidenceUrls?.length ? evidenceUrls : undefined
  })
  return normalizeTask(recordOf(raw))
}

export async function openStage(stageId: string, content?: string): Promise<ProjectStage> {
  const raw = await post<unknown>('project/stage/update', {
    stageId,
    status: 'Doing',
    content: content?.trim() || undefined
  })
  return normalizeStage(recordOf(raw))
}

/**
 * 判定阶段「本项不涉及」（GAP-039 / DEC-057）。
 * 企业负责人、店长（本门店数据范围）或项目经理可执行；空阶段无合同施工行时使用。
 */
export async function markStageNotApplicable(stageId: string, reason?: string): Promise<ProjectStage> {
  const raw = await post<unknown>('project/stage/update', {
    stageId,
    status: 'NotApplicable',
    reason: reason?.trim() || undefined
  })
  return normalizeStage(recordOf(raw))
}

/**
 * 撤销「本项不涉及」判定，阶段回到「待开始」，随后可正常开工。
 * 依据后端 `project/stage/update` 的 `Todo + NotApplicable` 独立分支（GAP-039 / DEC-057）。
 */
export async function restoreStageApplicable(stageId: string): Promise<ProjectStage> {
  const raw = await post<unknown>('project/stage/update', { stageId, status: 'Todo' })
  return normalizeStage(recordOf(raw))
}

export interface UpdateProjectMembersInput {
  projectId: string
  /** 项目经理：必须是本企业「项目经理」或「企业负责人」角色的在职员工。 */
  managerId?: string
  /** 项目设计师：本企业在职员工。 */
  designerId?: string
  /** 履约负责人：必须是「财务」或「企业负责人」角色。 */
  supportId?: string
  startDate?: string
  planEndDate?: string
}

/**
 * 指派/更换项目成员与合同基准日期（企业负责人或本门店店长）。
 * 依据后端 `project/project/update` 的 `requireMemberEditor` 门禁；项目经理不得改合同基准日期。
 * 变更会由后端写入一条「项目成员调整」对内动态并立即生效。
 */
export async function updateProjectMembers(input: UpdateProjectMembersInput): Promise<ProjectBrief> {
  const raw = await post<unknown>('project/project/update', {
    projectId: input.projectId,
    managerId: input.managerId || undefined,
    designerId: input.designerId || undefined,
    supportId: input.supportId || undefined,
    startDate: input.startDate || undefined,
    planEndDate: input.planEndDate || undefined
  })
  return normalizeProject(recordOf(raw))
}

export const projectApi = { listProjects, pageProjects, projectInfo, listStages, listTasks, taskInfo, saveTaskSchedule, confirmTaskNode, listReports, saveProjectReport, listAcceptances, updateTaskStatus, openStage, markStageNotApplicable, restoreStageApplicable, updateProjectMembers }
