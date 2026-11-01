import { post } from '@/core/http'
import { fileApi } from '@/domains/file/api'
import { useSessionStore } from '@/stores/session'
import type {
  SettlementMode,
  SupplierPartner,
  SupplierPartnerPage,
  SupplierPartnerStatus,
  SupplierPartnerType
} from './model'

type RawRecord = Record<string, unknown>

const TYPE_FROM_API: Record<string, SupplierPartnerType> = {
  Supplier: 'supplier',
  Factory: 'factory',
  LaborTeam: 'laborTeam',
  Installer: 'installer',
  Logistics: 'logistics',
  Service: 'service'
}
const TYPE_TO_API: Record<SupplierPartnerType, string> = {
  supplier: 'Supplier',
  factory: 'Factory',
  laborTeam: 'LaborTeam',
  installer: 'Installer',
  logistics: 'Logistics',
  service: 'Service'
}
const STATUS_FROM_API: Record<string, SupplierPartnerStatus> = {
  Active: 'active',
  Disabled: 'disabled'
}
const STATUS_TO_API: Record<SupplierPartnerStatus, string> = {
  active: 'Active',
  disabled: 'Disabled'
}

function recordOf(value: unknown): RawRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RawRecord : {}
}

function text(value: unknown): string {
  return value == null ? '' : String(value)
}

function optionalText(value: unknown): string | undefined {
  const result = text(value).trim()
  return result || undefined
}

function numberValue(value: unknown): number {
  const result = Number(value)
  return Number.isFinite(result) ? result : 0
}

function enumValue(value: unknown): string {
  if (typeof value === 'string') return value
  const raw = recordOf(value)
  return text(raw.value ?? raw.key)
}

function normalizePartner(value: unknown): SupplierPartner {
  const raw = recordOf(value)
  return {
    id: text(raw.partnerId ?? raw.id),
    type: TYPE_FROM_API[enumValue(raw.type)] ?? 'supplier',
    name: text(raw.name),
    contactName: optionalText(raw.contactName),
    telNo: optionalText(raw.telNo),
    taxNo: optionalText(raw.taxNo),
    addr: optionalText(raw.addr),
    brands: Array.isArray(raw.brands) ? raw.brands.map((item) => text(item)).filter(Boolean) : [],
    paymentCodeImages: Array.isArray(raw.paymentCodeImages) ? raw.paymentCodeImages.map((item) => text(item)).filter(Boolean) : [],
    settlementTerms: optionalText(raw.settlementTerms),
    settlementMode: (enumValue(raw.settlementMode) || undefined) as SettlementMode | undefined,
    settlementDays: raw.settlementDays == null ? undefined : numberValue(raw.settlementDays),
    cutoffDay: raw.cutoffDay == null ? undefined : numberValue(raw.cutoffDay),
    bankName: optionalText(raw.bankName),
    bankAccount: optionalText(raw.bankAccount),
    remark: optionalText(raw.remark),
    status: STATUS_FROM_API[enumValue(raw.status)] ?? 'active',
    payableAmount: numberValue(raw.payableAmount),
    paidAmount: numberValue(raw.paidAmount),
    outstandingAmount: numberValue(raw.outstandingAmount),
    createdAt: optionalText(raw.createTime)
  }
}

function pageOf(value: unknown, current: number, size: number): SupplierPartnerPage {
  if (Array.isArray(value)) {
    const list = value.map(normalizePartner)
    return { list, total: list.length, current, size, hasMore: false }
  }
  const raw = recordOf(value)
  const rows = Array.isArray(raw.content)
    ? raw.content
    : Array.isArray(raw.list)
      ? raw.list
      : Array.isArray(raw.records)
        ? raw.records
        : []
  const list = rows.map(normalizePartner)
  const total = Math.max(0, numberValue(raw.totalElements ?? raw.total ?? list.length))
  return { list, total, current, size, hasMore: current * size < total }
}

/** 与 App 共用 partner/save|update|page，不建立 Web 专用供应商接口。 */
function partnerPayload(input: Partial<SupplierPartner>) {
  return {
    type: input.type ? TYPE_TO_API[input.type] : undefined,
    name: input.name?.trim(),
    contactName: input.contactName?.trim() || undefined,
    telNo: input.telNo?.trim() || undefined,
    taxNo: input.taxNo?.trim() || undefined,
    addr: input.addr?.trim() || undefined,
    brands: input.brands ?? [],
    paymentCodeImages: input.paymentCodeImages?.map((path) => fileApi.storagePath(path) || path) ?? [],
    bankName: input.bankName?.trim() || undefined,
    bankAccount: input.bankAccount?.trim() || undefined,
    settlementTerms: input.settlementTerms?.trim() || undefined,
    settlementMode: input.settlementMode || undefined,
    settlementDays: input.settlementDays || undefined,
    cutoffDay: input.cutoffDay || undefined,
    status: input.status ? STATUS_TO_API[input.status] : undefined,
    remark: input.remark?.trim() || undefined
  }
}

export const supplyApi = {
  partnerPage: async (params: {
    type?: SupplierPartnerType
    status?: SupplierPartnerStatus | 'all'
    keyword?: string
    partnerId?: string
    current?: number
    size?: number
    includePaymentCodeUrls?: boolean
  } = {}): Promise<SupplierPartnerPage> => {
    const current = Math.max(1, Math.trunc(params.current ?? 1))
    const size = Math.min(50, Math.max(1, Math.trunc(params.size ?? 20)))
    const raw = await post<unknown>('partner/page', {
      type: params.type ? TYPE_TO_API[params.type] : undefined,
      status: params.status && params.status !== 'all' ? STATUS_TO_API[params.status] : undefined,
      keyword: params.keyword?.trim() || undefined,
      partnerId: params.partnerId,
      current,
      size
    })
    const page = pageOf(raw, current, size)
    const session = useSessionStore()
    const canViewPaymentCodes = ['Boss', 'StoreManager', 'Finance'].includes(session.role ?? '')
    if (!params.includePaymentCodeUrls || !canViewPaymentCodes) return page
    const list = await Promise.all(page.list.map(async (partner) => {
      if (!partner.paymentCodeImages.length) return partner
      return {
        ...partner,
        paymentCodeImageUrls: await fileApi.grantFiles('Partner', partner.id, partner.paymentCodeImages)
      }
    }))
    return { ...page, list }
  },

  partnerSave: async (input: Partial<SupplierPartner>): Promise<SupplierPartner> =>
    normalizePartner(await post<unknown>('partner/save', partnerPayload(input))),

  partnerUpdate: async (input: Partial<SupplierPartner> & { id: string }): Promise<SupplierPartner> =>
    normalizePartner(await post<unknown>('partner/update', {
      ...partnerPayload(input),
      partnerId: input.id
    }))
}
