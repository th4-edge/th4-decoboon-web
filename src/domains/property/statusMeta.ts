/**
 * 房屋状态展示映射（唯一来源）。
 * 量房、设计、报价等以房屋为主对象的工作台，状态标签一律显示**房屋状态**，
 * 不得用客户生命周期状态或工作台任务状态代替。
 */
import type { StatusTone } from '@/core/tone'
import type { PropertyStatus } from './model'

export const PROPERTY_STATUS_META: Record<PropertyStatus, { label: string; tone: StatusTone }> = {
  pendingMeasure: { label: '待量房', tone: 'pending' },
  measuring: { label: '量房中', tone: 'doing' },
  measured: { label: '已量房', tone: 'done' },
  designing: { label: '设计中', tone: 'progress' },
  quoted: { label: '已报价', tone: 'info' },
  contracted: { label: '已签约', tone: 'special' },
  serving: { label: '施工中', tone: 'alert' },
  completed: { label: '已完工', tone: 'dark' }
}

/** 服务端可能返回 PascalCase 枚举名（如 PendingMeasure），统一归一为小驼峰键。 */
export function normalizePropertyStatusKey(raw?: string | null): PropertyStatus | null {
  if (!raw) return null
  const key = raw.charAt(0).toLowerCase() + raw.slice(1)
  return (key in PROPERTY_STATUS_META) ? key as PropertyStatus : null
}

/** 取房屋状态的展示标签与色调；未登记时回退服务端中文名或"待业务确认"。 */
export function propertyStatusMeta(raw?: string | null, fallbackLabel?: string | null): { label: string; tone: StatusTone } {
  const key = normalizePropertyStatusKey(raw)
  if (key) return PROPERTY_STATUS_META[key]
  return { label: fallbackLabel || '待业务确认', tone: 'info' }
}
