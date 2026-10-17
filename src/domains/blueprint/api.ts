import { post } from '@/core/http'
import type {
  BlueprintRuntimePayload,
  MaterialBlueprintDocument,
  MaterialHealthIssue,
  MaterialHealthReport,
  MaterialHealthRow
} from './model'

type RawRecord = Record<string, unknown>

function recordOf(raw: unknown): RawRecord {
  return raw && typeof raw === 'object' ? raw as RawRecord : {}
}

function listOf<T = RawRecord>(raw: unknown): T[] {
  return Array.isArray(raw) ? raw as T[] : []
}

function text(raw: unknown): string {
  return raw === null || raw === undefined ? '' : String(raw)
}

function optionalText(raw: unknown): string | undefined {
  const value = text(raw).trim()
  return value || undefined
}

function num(raw: unknown): number {
  const value = Number(raw ?? 0)
  return Number.isNaN(value) ? 0 : value
}

function bool(raw: unknown): boolean {
  return raw === true
}

function strings(raw: unknown): string[] {
  return listOf(raw).map(text).filter(Boolean)
}

function healthIssueOf(raw: unknown): MaterialHealthIssue {
  const row = recordOf(raw)
  return {
    id: text(row.id),
    label: text(row.label),
    severity: text(row.severity),
    count: num(row.count),
    nextAction: text(row.nextAction),
    evidence: text(row.evidence),
    refs: strings(row.refs)
  }
}

function healthRowOf(raw: unknown): MaterialHealthRow {
  const row = recordOf(raw)
  return {
    planId: text(row.planId),
    spaceName: optionalText(row.spaceName),
    category: optionalText(row.category),
    materialName: optionalText(row.materialName),
    status: optionalText(row.status),
    statusName: optionalText(row.statusName),
    selectionStatus: optionalText(row.selectionStatus),
    selectionStatusName: optionalText(row.selectionStatusName),
    quantity: row.quantity == null ? undefined : num(row.quantity),
    orderedQuantity: row.orderedQuantity == null ? undefined : num(row.orderedQuantity),
    receivedQuantity: row.receivedQuantity == null ? undefined : num(row.receivedQuantity),
    requiredAt: optionalText(row.requiredAt),
    supplierName: optionalText(row.supplierName),
    purchaseNo: optionalText(row.purchaseNo),
    delayed: bool(row.delayed),
    nextAction: optionalText(row.nextAction)
  }
}

function healthReportOf(raw: unknown): MaterialHealthReport {
  const row = recordOf(raw)
  return {
    projectId: text(row.projectId),
    projectNo: optionalText(row.projectNo),
    projectName: optionalText(row.projectName),
    projectStatusName: optionalText(row.projectStatusName),
    propertyAddress: optionalText(row.propertyAddress),
    customerName: optionalText(row.customerName),
    designerName: optionalText(row.designerName),
    managerName: optionalText(row.managerName),
    hasMaterialPlan: bool(row.hasMaterialPlan),
    totalItems: num(row.totalItems),
    selectedItems: num(row.selectedItems),
    unselectedItems: num(row.unselectedItems),
    readyToOrder: num(row.readyToOrder),
    partiallyOrdered: num(row.partiallyOrdered),
    pendingArrival: num(row.pendingArrival),
    partiallyArrived: num(row.partiallyArrived),
    arrived: num(row.arrived),
    delayed: num(row.delayed),
    purchaseCount: num(row.purchaseCount),
    unpricedPurchaseCount: num(row.unpricedPurchaseCount),
    missingSupplierCount: num(row.missingSupplierCount),
    costComplete: bool(row.costComplete),
    costIncompleteCount: num(row.costIncompleteCount),
    materialCost: num(row.materialCost),
    estimatedCost: num(row.estimatedCost),
    actualCost: num(row.actualCost),
    profitAmount: row.profitAmount == null ? undefined : num(row.profitAmount),
    costLabel: text(row.costLabel),
    stageKey: text(row.stageKey),
    stageLabel: text(row.stageLabel),
    stageSummary: text(row.stageSummary),
    nextAction: text(row.nextAction),
    settlementStatus: text(row.settlementStatus),
    issues: listOf(row.issues).map(healthIssueOf),
    rows: listOf(row.rows).map(healthRowOf)
  }
}

export const blueprintApi = {
  runtime: async (blueprintId = 'material.end-to-end'): Promise<{
    runtime: BlueprintRuntimePayload
    blueprint: MaterialBlueprintDocument
  }> => {
    const raw = recordOf(await post<unknown>('blueprint/runtime/info', { blueprintId }))
    const runtime: BlueprintRuntimePayload = {
      id: text(raw.id),
      title: text(raw.title),
      version: text(raw.version),
      status: text(raw.status),
      lastReviewedCommit: optionalText(raw.lastReviewedCommit),
      sourceRefCount: num(raw.sourceRefCount),
      viewerRole: optionalText(raw.viewerRole),
      costVisible: bool(raw.costVisible),
      blueprintJson: text(raw.blueprintJson)
    }
    const blueprint = JSON.parse(runtime.blueprintJson) as MaterialBlueprintDocument
    return { runtime, blueprint }
  },

  check: async (projectId: string): Promise<MaterialHealthReport> =>
    healthReportOf(await post<unknown>('blueprint/check/report', { projectId }))
}
