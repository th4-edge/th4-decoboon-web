import { isStatusTone, type StatusTone } from '@/core/tone'
import stateRegistryJson from '../../../docs/standards/business-state-machines.json'

interface RawStatus {
  value: string
  serverValues?: string[]
  label: string
  tone: string
}

interface RawStateObject {
  key: string
  label: string
  statuses?: RawStatus[]
  businessRefs?: string[]
}

interface RawStateRegistry {
  objects?: RawStateObject[]
}

export interface ResolvedBusinessStatus {
  objectKey: string
  statusKey: string
  label: string
  tone: StatusTone
  serverValues: string[]
  businessRefs: string[]
}

const registry = stateRegistryJson as unknown as RawStateRegistry
const stateObjects = registry.objects ?? []

function asTone(value: string | undefined): StatusTone {
  return value && isStatusTone(value) ? value : 'info'
}

export function resolveBusinessStatus(
  objectKey: string | undefined,
  statusKeyOrServerValue: string | undefined
): ResolvedBusinessStatus | null {
  if (!objectKey || !statusKeyOrServerValue) return null
  const object = stateObjects.find((item) => item.key === objectKey)
  const status = object?.statuses?.find((item) =>
    item.value === statusKeyOrServerValue || item.serverValues?.includes(statusKeyOrServerValue)
  )
  if (!object || !status) return null
  return {
    objectKey,
    statusKey: status.value,
    label: status.label,
    tone: asTone(status.tone),
    serverValues: status.serverValues ?? [],
    businessRefs: object.businessRefs ?? []
  }
}

export function businessObjectLabel(objectKey: string | undefined): string {
  return stateObjects.find((item) => item.key === objectKey)?.label ?? '业务对象'
}

export function unregisteredStatusLabel(): string {
  return '待确认'
}
