export interface BlueprintRuntimePayload {
  id: string
  title: string
  version: string
  status: string
  lastReviewedCommit?: string
  sourceRefCount: number
  viewerRole?: string
  costVisible: boolean
  blueprintJson: string
}

export interface BlueprintObjectRef {
  id: string
  name: string
  meaning: string
  keyFields: string[]
  sources: string[]
}

export interface BlueprintStage {
  id: string
  no: string
  name: string
  roles: string[]
  trigger: string
  system: string
  output: string
  accounting: string
  exceptions: string[]
  sources: string[]
}

export interface BlueprintField {
  object: string
  field: string
  label: string
  meaning: string
  owner: string
  impact: string
  sources?: string[]
}

export interface BlueprintRule {
  id: string
  text: string
  refs: string[]
}

export interface BlueprintCheck {
  id: string
  label: string
  severity: string
  scope: string
  condition: string
  nextAction: string
  refs: string[]
  implementation?: string
}

export interface BlueprintException {
  id: string
  text: string
  refs: string[]
}

export interface BlueprintMetric {
  id: string
  label: string
  meaning: string
}

export interface BlueprintUiBinding {
  surface: string
  route: string
  objectType: string
  blueprintNode: string
  roles: string[]
  entry: string
}

export interface BlueprintAgentTool {
  name: string
  provider: string
  readOnly: boolean
  scope: string
}

export interface BlueprintGap {
  id: string
  label: string
  status: string
  currentImplementation: string
  whyNotClosed: string
  refs: string[]
}

export interface MaterialBlueprintDocument {
  id: string
  title: string
  version: string
  status: string
  sourceRefs: string[]
  audience: string[]
  layers: string[]
  objects: BlueprintObjectRef[]
  stages: BlueprintStage[]
  fields: BlueprintField[]
  rules: BlueprintRule[]
  checks: BlueprintCheck[]
  exceptions: BlueprintException[]
  metrics: BlueprintMetric[]
  uiBindings: BlueprintUiBinding[]
  agentTools: BlueprintAgentTool[]
  lastReviewedCommit?: string
  gaps: BlueprintGap[]
}

export interface MaterialHealthIssue {
  id: string
  label: string
  severity: string
  count: number
  nextAction: string
  evidence: string
  refs: string[]
}

export interface MaterialHealthRow {
  planId: string
  spaceName?: string
  category?: string
  materialName?: string
  status?: string
  statusName?: string
  selectionStatus?: string
  selectionStatusName?: string
  quantity?: number
  orderedQuantity?: number
  receivedQuantity?: number
  requiredAt?: string
  supplierName?: string
  purchaseNo?: string
  delayed: boolean
  nextAction?: string
}

export interface MaterialHealthReport {
  projectId: string
  projectNo?: string
  projectName?: string
  projectStatusName?: string
  propertyAddress?: string
  customerName?: string
  designerName?: string
  managerName?: string
  hasMaterialPlan: boolean
  totalItems: number
  selectedItems: number
  unselectedItems: number
  readyToOrder: number
  partiallyOrdered: number
  pendingArrival: number
  partiallyArrived: number
  arrived: number
  delayed: number
  purchaseCount: number
  unpricedPurchaseCount: number
  missingSupplierCount: number
  costComplete: boolean
  costIncompleteCount: number
  materialCost: number
  estimatedCost: number
  actualCost: number
  profitAmount?: number
  costLabel: string
  stageKey: string
  stageLabel: string
  stageSummary: string
  nextAction: string
  settlementStatus: string
  issues: MaterialHealthIssue[]
  rows: MaterialHealthRow[]
}
