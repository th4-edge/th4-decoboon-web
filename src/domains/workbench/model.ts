export type WorkbenchKind = 'aggregate' | 'queue' | 'object' | 'workspace'
export type WorkbenchPriority = 'P0' | 'P1' | 'P2'
export type WorkbenchDecisionStatus = 'approved' | 'pending_business_review'

export interface WorkbenchInboundState {
  object: string
  statuses: string[]
}

export interface WorkbenchEntry {
  key: string
  label: string
  domain: string
  group: string
  kind: WorkbenchKind
  roles: string[]
  entryScenario: string
  inboundStates: WorkbenchInboundState[]
  objectAnchor: string
  mainline: string
  currentWorkSurface: string
  mainAction: string
  actionPolicyKeys: string[]
  handoff: string
  handoffTo: string[]
  priority: WorkbenchPriority
  deepLink: string
  emptyState: string
  exceptionState: string
  contextRecovery: {
    deepLink: boolean
    preserveFilters: boolean
    preserveScroll: boolean
    preserveDraft: boolean
    returnToSource: boolean
  }
  unsavedChangesGuard: boolean
  unsavedChangesReason?: string
  reloadScopes: string[]
  decisionStatus: WorkbenchDecisionStatus
  businessRefs: string[]
  notes?: string
}

export interface WorkbenchDomain {
  key: string
  label: string
  order: number
}

export interface WorkbenchGroup {
  key: string
  label: string
  domain: string
  order: number
}

export interface WorkbenchRegistry {
  version: number
  updated: string
  sources: string[]
  domains: WorkbenchDomain[]
  groups: WorkbenchGroup[]
  workbenches: WorkbenchEntry[]
}
