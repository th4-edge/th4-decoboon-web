import { post } from '@/core/http'
import { fileApi } from '@/domains/file/api'
import type { Acceptance, AcceptanceRound, AcceptanceStatus } from './model'

type RawRecord = Record<string, unknown>

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

function stringList(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map(str).filter(Boolean) : []
}

function normalizeStatus(raw: unknown): AcceptanceStatus {
  const value = enumValue(raw)
  if (value === 'Confirmed') return 'confirmed'
  if (value === 'Rejected') return 'rejected'
  return 'pending'
}

async function signAcceptance(acceptance: Acceptance): Promise<Acceptance> {
  if (!acceptance.images.length) return acceptance
  try {
    const signed = await fileApi.grantFiles('Acceptance', acceptance.id, acceptance.images)
    return { ...acceptance, images: signed }
  } catch {
    return acceptance
  }
}

async function normalizeAcceptance(raw: RawRecord): Promise<Acceptance> {
  const stage = recordOf(raw.stage)
  const submittedBy = recordOf(raw.submittedBy ?? raw.submitBy)
  const confirmedBy = recordOf(raw.confirmedBy)
  const acceptance: Acceptance = {
    id: str(raw.acceptanceId ?? raw.id),
    projectId: str(raw.projectId ?? recordOf(raw.project).projectId),
    stageId: str(raw.stageId ?? stage.stageId),
    stageName: str(stage.name) || undefined,
    submitByName: str(submittedBy.name) || undefined,
    status: normalizeStatus(raw.status),
    result: enumValue(raw.result) || 'Pending',
    content: str(raw.conclusion ?? raw.content) || undefined,
    issues: stringList(raw.issues),
    images: stringList(raw.evidenceUrls ?? raw.images),
    confirmedByName: str(confirmedBy.name) || undefined,
    confirmedAt: str(raw.confirmedAt) || undefined,
    createdAt: str(recordOf(raw.createTime).dateTime ?? raw.createTime ?? raw.createdAt) || undefined
  }
  return signAcceptance(acceptance)
}

export async function listAcceptances(projectId: string): Promise<Acceptance[]> {
  const raw = await post<unknown>('project/acceptance/page', { projectId })
  return Promise.all(pageRows(raw).map((row) => normalizeAcceptance(row)))
}

export async function acceptanceInfo(stageId: string): Promise<Acceptance | null> {
  const raw = await post<unknown>('project/acceptance/info', { stageId })
  if (!raw) return null
  return normalizeAcceptance(recordOf(raw))
}

export interface SubmitAcceptanceInput {
  stageId: string
  content: string
  issues?: string[]
  images?: string[]
}

export async function submitAcceptance(input: SubmitAcceptanceInput): Promise<Acceptance> {
  const raw = await post<unknown>('project/acceptance/save', {
    stageId: input.stageId,
    result: 'pass',
    content: input.content,
    issues: input.issues ?? [],
    images: (input.images ?? []).map((path) => fileApi.storagePath(path) || path)
  })
  return normalizeAcceptance(recordOf(raw))
}

export async function listAcceptanceRounds(acceptanceId: string): Promise<AcceptanceRound[]> {
  const raw = await post<unknown>('project/acceptance/round/page', { acceptanceId })
  return pageRows(raw).map((row) => ({
    id: str(row.roundId ?? row.id),
    acceptanceId: str(row.acceptanceId ?? recordOf(row.acceptance).acceptanceId),
    roundNo: num(row.roundNo),
    result: enumValue(row.result) || 'Pending',
    conclusion: str(row.conclusion) || undefined,
    issues: stringList(row.issues),
    rectificationNote: str(row.rectificationNote) || undefined,
    rectificationOwnerName: str(recordOf(row.rectificationOwner).name) || undefined,
    rectificationDueDate: str(row.rectificationDueDate) || undefined,
    submittedByName: str(recordOf(row.submittedBy).name) || undefined,
    confirmedByName: str(recordOf(row.confirmedBy).name) || undefined,
    submittedAt: str(row.submittedAt) || undefined,
    confirmedAt: str(row.confirmedAt) || undefined
  }))
}

export const acceptanceApi = { listAcceptances, acceptanceInfo, submitAcceptance, listAcceptanceRounds }
