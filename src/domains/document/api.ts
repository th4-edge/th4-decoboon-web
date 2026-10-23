import { post } from '@/core/http'
import { runtime } from '@/core/runtime'
import type { DocumentArchive, DocumentLayoutConfig, DocumentTemplateInfo, DocumentTemplateVersionInfo, VoucherDesignerConfig } from './model'

export type { DocumentArchive, DocumentLayoutConfig, DocumentTemplateInfo, DocumentTemplateVersionInfo, VoucherDesignerConfig } from './model'

type RawRecord = Record<string, unknown>

function documentUrl(value: string): string {
  if (!value || /^https?:\/\//i.test(value) || value.startsWith('/api/')) return value
  const base = runtime.apiBase.endsWith('/') ? runtime.apiBase : `${runtime.apiBase}/`
  return `${base}${value.startsWith('/') ? value.slice(1) : value}`
}

function valueOf(raw: unknown): string {
  if (typeof raw === 'string') return raw
  const record = raw && typeof raw === 'object' ? raw as RawRecord : {}
  return String(record.value ?? record.key ?? record.name ?? '')
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

function safeJson(text: string, fallback: unknown): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return fallback
  }
}

function recordValue(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value === 'string') {
    const parsed = safeJson(value, {})
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  }
  return {}
}

function versionOf(raw: RawRecord): DocumentTemplateVersionInfo {
  return {
    versionId: String(raw.versionId ?? ''),
    version: Number(raw.version ?? 0),
    name: String(raw.name ?? ''),
    presetCode: raw.presetCode == null ? undefined : String(raw.presetCode),
    status: valueOf(raw.status),
    publishedAt: raw.publishedAt ? String(raw.publishedAt) : undefined,
    createdAt: raw.createTime ? String(raw.createTime) : undefined
  }
}

const DEFAULT_LAYOUT_BLOCKS = [
  { key: 'company', visible: true, sort: 10 },
  { key: 'title', visible: true, sort: 20 },
  { key: 'meta', visible: true, sort: 30 },
  { key: 'amount', visible: true, sort: 40 },
  { key: 'detail', visible: true, sort: 50 },
  { key: 'sign', visible: true, sort: 60 },
  { key: 'footer', visible: true, sort: 70 }
]

function layoutOf(raw: unknown): DocumentLayoutConfig {
  const source = recordValue(raw)
  const blocks = Array.isArray(source.blocks)
    ? source.blocks.map((item) => recordValue(item)).map((item) => ({
        key: String(item.key ?? ''),
        visible: item.visible == null ? true : Boolean(item.visible),
        sort: Number(item.sort ?? 10)
      })).filter((item) => item.key)
    : DEFAULT_LAYOUT_BLOCKS
  return {
    pageSize: ['A3', 'A4', 'A5'].includes(String(source.pageSize)) ? String(source.pageSize) as 'A3' | 'A4' | 'A5' : 'A4',
    orientation: source.orientation === 'landscape' ? 'landscape' : 'portrait',
    marginMm: Number(source.marginMm ?? 12),
    blocks: blocks.length ? blocks : DEFAULT_LAYOUT_BLOCKS,
    signatures: Array.isArray(source.signatures) ? source.signatures.map(String) : ['制单', '审核', '领款/付款人'],
    footer: source.footer == null ? undefined : String(source.footer)
  }
}

export const DEFAULT_DESIGNER_CONFIG: VoucherDesignerConfig = {
  schemaVersion: 1,
  page: { widthMm: 210, heightMm: 297, orientation: 'portrait', marginMm: 12, gridSizeMm: 5 },
  elements: [],
  tables: [],
  print: { scale: 100, offsetXMm: 0, offsetYMm: 0 }
}

function designerOf(raw: unknown): VoucherDesignerConfig {
  const source = recordValue(raw)
  if (!Object.keys(source).length) return structuredClone(DEFAULT_DESIGNER_CONFIG)
  const page = recordValue(source.page)
  return {
    schemaVersion: Number(source.schemaVersion ?? 1),
    page: {
      widthMm: Number(page.widthMm ?? 210),
      heightMm: Number(page.heightMm ?? 297),
      orientation: page.orientation === 'landscape' ? 'landscape' : 'portrait',
      marginMm: Number(page.marginMm ?? 12),
      gridSizeMm: Number(page.gridSizeMm ?? 5)
    },
    elements: Array.isArray(source.elements) ? source.elements as VoucherDesignerConfig['elements'] : [],
    tables: Array.isArray(source.tables) ? source.tables as VoucherDesignerConfig['tables'] : [],
    print: {
      scale: Number(recordValue(source.print).scale ?? 100),
      offsetXMm: Number(recordValue(source.print).offsetXMm ?? 0),
      offsetYMm: Number(recordValue(source.print).offsetYMm ?? 0)
    }
  }
}

function templateOf(raw: RawRecord): DocumentTemplateInfo {
  const style = recordValue(raw.styleConfig)
  return {
    templateId: raw.templateId == null ? undefined : String(raw.templateId),
    type: valueOf(raw.type),
    scope: valueOf(raw.scope),
    name: String(raw.name ?? ''),
    version: Number(raw.version ?? 1),
    fieldConfig: recordValue(raw.fieldConfig) as Record<string, boolean>,
    styleConfig: {
      primaryColor: String(style.primaryColor ?? '#2f7d5a'),
      fontSize: Number(style.fontSize ?? 12),
      rowSpacing: Number(style.rowSpacing ?? 2)
    },
    presetCode: raw.presetCode == null ? undefined : String(raw.presetCode),
    presetNote: raw.presetNote == null ? undefined : String(raw.presetNote),
    publishedVersion: Number(raw.publishedVersion ?? 0),
    publishedAt: raw.publishedAt ? String(raw.publishedAt) : undefined,
    layoutConfig: layoutOf(raw.layoutConfig),
    designerConfig: designerOf(raw.designerConfig)
  }
}

export const documentApi = {
  buildQuote: async (quoteId: string, version: number, groupMode: 'REGION' | 'TYPE'): Promise<DocumentArchive> =>
    normalize(await post<RawRecord>('document/quote/build', { quoteId, version, groupMode })),

  quoteRecords: async (quoteId: string): Promise<DocumentArchive[]> => {
    const result = await post<RawRecord[]>('document/record/page', { quoteId })
    return Array.isArray(result) ? result.map(normalize) : []
  },

  buildContract: async (contractId: string): Promise<DocumentArchive> =>
    normalize(await post<RawRecord>('document/contract/build', { contractId })),

  contractRecords: async (contractId: string): Promise<DocumentArchive[]> => {
    const result = await post<RawRecord[]>('document/contract/records', { contractId })
    return Array.isArray(result) ? result.map(normalize) : []
  },

  reprint: async (documentId: string, reason: string): Promise<DocumentArchive> =>
    normalize(await post<RawRecord>('document/reprint/save', { documentId, reason }))
}

export const templateApi = {
  templates: async (): Promise<DocumentTemplateInfo[]> => {
    const result = await post<RawRecord[]>('document/template/page', {})
    return Array.isArray(result) ? result.map(templateOf) : []
  },

  presets: async (): Promise<DocumentTemplateInfo[]> => {
    const result = await post<RawRecord[]>('document/baseline/list', {})
    return Array.isArray(result) ? result.map(templateOf) : []
  },

  saveTemplate: async (input: {
    type: string
    presetCode?: string
    name: string
    fieldConfig: Record<string, boolean>
    styleConfig: DocumentTemplateInfo['styleConfig']
    layoutConfig?: DocumentLayoutConfig
    designerConfig?: VoucherDesignerConfig
  }): Promise<DocumentTemplateInfo> =>
    templateOf(await post<RawRecord>('document/template/save', {
      type: input.type,
      presetCode: input.presetCode,
      name: input.name,
      fieldConfig: JSON.stringify(input.fieldConfig),
      styleConfig: JSON.stringify(input.styleConfig),
      layoutConfig: JSON.stringify(input.layoutConfig ?? layoutOf(undefined)),
      designerConfig: JSON.stringify(input.designerConfig ?? DEFAULT_DESIGNER_CONFIG)
    })),

  publishTemplate: async (templateId: string): Promise<DocumentTemplateInfo> =>
    templateOf(await post<RawRecord>('document/template/publish', { templateId })),

  disableTemplate: async (templateId: string): Promise<DocumentTemplateInfo> =>
    templateOf(await post<RawRecord>('document/template/disable', { templateId })),

  templateVersions: async (templateId: string): Promise<DocumentTemplateVersionInfo[]> => {
    const result = await post<RawRecord[]>('document/template-version/page', { templateId })
    return Array.isArray(result) ? result.map(versionOf) : []
  }
}

/** 报价单 PDF 构建别名：保持设计师工作区既有调用契约。 */
export async function buildQuotePdf(quoteId: string, version: number, groupMode: 'REGION' | 'TYPE'): Promise<DocumentArchive> {
  return documentApi.buildQuote(quoteId, version, groupMode)
}
