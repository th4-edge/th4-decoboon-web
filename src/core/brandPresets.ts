import { deriveBrandTheme } from './brandTheme'

export interface CompanyBrandPreset {
  value: string
  label: string
  description: string
}

export interface CompanyBrandPresetView extends CompanyBrandPreset {
  base: string
  soft: string
  lighter: string
  deep: string
  ink: string
}

/**
 * 装企可选主题色。
 *
 * 约束：
 * - 仅装得清默认项使用空值，空值保持当前端的产品品牌语义；
 * - 推荐色均为低饱和、可长期使用的空间/材料色，不使用科技蓝和霓虹紫；
 * - 主色只是输入，浅色、边框、悬停、深色和可读前景由 deriveBrandTheme 统一派生。
 */
export const COMPANY_BRAND_PRESETS: CompanyBrandPreset[] = [
  { value: '', label: '装得清默认', description: '保留装得清产品品牌色' },
  { value: '#5C7C6E', label: '青瓷', description: '清润克制，适合设计与软装型团队' },
  { value: '#2F6E63', label: '松石墨绿', description: '稳健耐看，适合综合型装企' },
  { value: '#4F708C', label: '岩蓝', description: '理性清晰，适合工程与交付管理' },
  { value: '#A65F46', label: '赤陶', description: '温暖有辨识度，适合住宅整装' },
  { value: '#7A5540', label: '胡桃', description: '沉静有质感，适合中高端定制' },
  { value: '#675D7B', label: '黛紫', description: '雅致克制，适合设计主导型团队' },
  { value: '#3F4B53', label: '墨灰', description: '专业中性，适合工程与财务协同' }
]

export function companyBrandPresetViews(): CompanyBrandPresetView[] {
  return COMPANY_BRAND_PRESETS.map((preset) => {
    const theme = deriveBrandTheme(preset.value)
    return {
      ...preset,
      base: theme.primaryBase,
      soft: theme.lighter,
      lighter: theme.lightest,
      deep: theme.primaryDeep,
      ink: theme.ink
    }
  })
}
