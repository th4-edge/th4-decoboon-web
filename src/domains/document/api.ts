import { post } from '@/core/http'
import { runtime } from '@/core/runtime'

export interface DocumentArchive {
  documentId: string
  type: string
  audience: string
  businessNo: string
  templateVersion: number
  path: string
  sha256: string
  fileName: string
  contentType: string
  size: number
  generatedAt?: string
  status: string
  url: string
  urlExpiresAt?: string
}

type RawRecord = Record<string, unknown>

function valueOf(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const record = raw as RawRecord
    return String(record.value ?? record.key ?? record.name ?? '')
  }
  return ''
}

function documentUrl(value: string): string {
  if (!value || /^https?:\/\//i.test(value) || value.startsWith('/api/')) return value
  const base = runtime.apiBase.endsWith('/') ? runtime.apiBase : `${runtime.apiBase}/`
  return `${base}${value.startsWith('/') ? value.slice(1) : value}`
}

function normalize(raw: RawRecord): DocumentArchive {
  return {
    documentId: String(raw.documentId ?? raw.id ?? ''),
    type: valueOf(raw.type),
    audience: valueOf(raw.audience),
    businessNo: String(raw.businessNo ?? ''),
    templateVersion: Number(raw.templateVersion ?? 0),
    path: String(raw.path ?? ''),
    sha256: String(raw.sha256 ?? ''),
    fileName: String(raw.fileName ?? ''),
    contentType: String(raw.contentType ?? 'application/pdf'),
    size: Number(raw.size ?? 0),
    generatedAt: raw.generatedAt ? String(raw.generatedAt) : undefined,
    status: valueOf(raw.status),
    url: documentUrl(String(raw.url ?? '')),
    urlExpiresAt: raw.urlExpiresAt ? String(raw.urlExpiresAt) : undefined
  }
}

/** 生成与 App 一致的客户版报价 PDF；由后端生成，Web 不自行拼装文档。 */
export async function buildQuotePdf(quoteId: string): Promise<DocumentArchive> {
  return normalize(await post<RawRecord>('document/quote/build', { quoteId }))
}

export const documentApi = { buildQuotePdf }
