/**
 * 客户画像展示映射（唯一来源）。
 * `Customer.portrait` 是服务端只读投影，可能只填了部分枚举；缺失即缺失，不用默认值补齐。
 * 展示规则与「待我跟进」保持一致，避免各页出现两套画像中文。
 */
import { PORTRAIT_CONCERN_OPTIONS, PORTRAIT_LABELS, PORTRAIT_OPTIONS, optionLabel, type Option } from './options'

export interface PortraitItem {
  key: string
  label: string
  value: string
}

/** 画像字段可能是字符串、枚举对象或枚举数组，统一取其展示值。 */
function portraitText(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return String(record.name ?? record.label ?? record.value ?? record.key ?? '')
  }
  return String(value)
}

function portraitValue(key: string, value: unknown): string {
  const options: Option[] = key === 'concerns' ? PORTRAIT_CONCERN_OPTIONS : PORTRAIT_OPTIONS[key] || []
  if (Array.isArray(value)) {
    return value.map((item) => optionLabel(options, portraitText(item))).filter((item) => item && item !== '—').join('、')
  }
  return optionLabel(options, portraitText(value))
}

/** 把 portrait 投影转成可展示项；只返回真正有值的字段。 */
export function portraitItemsOf(portrait: unknown): PortraitItem[] {
  const source = portrait && typeof portrait === 'object' ? portrait as Record<string, unknown> : null
  if (!source) return []
  const fields: PortraitItem[] = Object.entries(PORTRAIT_LABELS).map(([key, label]) => ({
    key,
    label,
    value: portraitValue(key, source[key])
  }))
  fields.push({ key: 'concerns', label: '关注点', value: portraitValue('concerns', source.concerns) })
  return fields.filter((item) => item.value && item.value !== '—')
}
