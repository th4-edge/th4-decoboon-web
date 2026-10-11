import type { StatusTone } from '@/core/tone'

/**
 * 凭证模板版本状态口径。
 * 与后端 `DocumentTemplateVersionStatus` 同源：Draft(草稿) / Published(已发布) / Superseded(已替代) / Disabled(已停用)。
 * 未登记状态必须显示「待业务确认」，**不得默认成某个真实状态**（ANT-010）。
 */
export const TEMPLATE_VERSION_STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: '草稿', tone: 'todo' },
  published: { label: '已发布', tone: 'done' },
  superseded: { label: '已替代', tone: 'muted' },
  disabled: { label: '已停用', tone: 'closed' }
}

/** 平台/企业模板作用域口径。 */
export const TEMPLATE_SCOPE_META: Record<string, string> = {
  platform: '平台基线',
  enterprise: '企业模板',
  company: '企业模板'
}

export function templateVersionStatusLabel(status: string): string {
  return TEMPLATE_VERSION_STATUS_META[status?.toLowerCase()]?.label || '待业务确认'
}

export function templateVersionStatusTone(status: string): StatusTone {
  return TEMPLATE_VERSION_STATUS_META[status?.toLowerCase()]?.tone || 'todo'
}
