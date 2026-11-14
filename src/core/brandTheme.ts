/** 企业品牌色是 Web 主题唯一运行时输入，其他品牌色阶由同一算法派生。 */
export const DEFAULT_WEB_BRAND_COLOR = '#2F7D5A'
const DEFAULT_FAVICON = '/brand/logo-mark-color.svg?v=1.0.73'

export interface WebCompanyBrand {
  name?: string
  logo?: string
  color?: string
}

export interface BrandTheme {
  source: string
  primary: string
  primaryBase: string
  primaryHover: string
  primaryActive: string
  primaryLight: string
  primaryDark: string
  primaryDeep: string
  primaryBorder: string
  feedbackBg: string
  feedbackBorder: string
  feedbackInk: string
  chartPrimary: string
  lighter: string
  lightest: string
  ink: string
  inkDeep: string
  onPrimary: string
}

function normalizeHex(input?: string): string {
  const value = String(input || '').trim()
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value)
  if (!match) return DEFAULT_WEB_BRAND_COLOR
  const hex = match[1].length === 3 ? match[1].split('').map((part) => part + part).join('') : match[1]
  return `#${hex.toUpperCase()}`
}

export function isValidBrandColor(input?: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(input || '').trim())
}

function mixHex(source: string, target: string, targetWeight: number): string {
  const parse = (hex: string) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))
  const a = parse(normalizeHex(source))
  const b = parse(normalizeHex(target))
  const weight = Math.max(0, Math.min(1, targetWeight))
  return `#${a.map((value, index) => Math.round(value * (1 - weight) + b[index] * weight)
    .toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

function channel(value: number): number {
  const normalized = value / 255
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
}

export function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string) => {
    const values = [1, 3, 5].map((start) => parseInt(normalizeHex(hex).slice(start, start + 2), 16))
    return 0.2126 * channel(values[0]) + 0.7152 * channel(values[1]) + 0.0722 * channel(values[2])
  }
  const first = luminance(a)
  const second = luminance(b)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

function accessibleAction(base: string): string {
  let candidate = base
  for (let step = 0; step <= 60 && contrastRatio(candidate, '#FFFFFF') < 4.5; step += 5) {
    candidate = mixHex(base, '#000000', step / 100)
  }
  return candidate
}

function alpha(hex: string, value: number): string {
  const values = [1, 3, 5].map((start) => parseInt(normalizeHex(hex).slice(start, start + 2), 16))
  return `rgba(${values.join(', ')}, ${value})`
}

export function deriveBrandTheme(color?: string): BrandTheme {
  const base = isValidBrandColor(color) ? normalizeHex(color) : DEFAULT_WEB_BRAND_COLOR
  const action = accessibleAction(base)
  return {
    source: base,
    primary: action,
    primaryBase: base,
    primaryHover: mixHex(action, '#000000', 0.08),
    primaryActive: mixHex(action, '#000000', 0.16),
    primaryLight: mixHex(base, '#FFFFFF', 0.28),
    primaryDark: action,
    primaryDeep: mixHex(base, '#000000', 0.40),
    primaryBorder: mixHex(base, '#FFFFFF', 0.70),
    feedbackBg: mixHex(base, '#FFFFFF', 0.92),
    feedbackBorder: mixHex(base, '#FFFFFF', 0.76),
    feedbackInk: action,
    chartPrimary: action,
    lighter: mixHex(base, '#FFFFFF', 0.86),
    lightest: mixHex(base, '#FFFFFF', 0.94),
    ink: mixHex(base, '#000000', 0.58),
    inkDeep: mixHex(base, '#000000', 0.43),
    onPrimary: contrastRatio(action, '#FFFFFF') >= 4.5 ? '#FFFFFF' : '#17212B'
  }
}

export function applyWebBrandTheme(color?: string): BrandTheme {
  const theme = deriveBrandTheme(color)
  if (typeof document === 'undefined') return theme
  const root = document.documentElement
  const values: Record<string, string> = {
    '--zdq-brand-source': theme.source,
    '--zdq-brand-50': mixHex(theme.source, '#FFFFFF', 0.94),
    '--zdq-brand-100': theme.lighter,
    '--zdq-brand-200': mixHex(theme.source, '#FFFFFF', 0.72),
    '--zdq-brand-300': mixHex(theme.source, '#FFFFFF', 0.55),
    '--zdq-brand-400': theme.primaryLight,
    '--zdq-brand-500': theme.primary,
    '--zdq-brand-600': mixHex(theme.source, '#000000', 0.14),
    '--zdq-brand-700': theme.primaryDeep,
    '--zdq-brand-hover': theme.primaryHover,
    '--zdq-brand-active': theme.primaryActive,
    '--zdq-brand-border': theme.primaryBorder,
    '--zdq-brand-feedback-bg': theme.feedbackBg,
    '--zdq-brand-feedback-border': theme.feedbackBorder,
    '--zdq-brand-feedback-ink': theme.feedbackInk,
    '--zdq-brand-chart-primary': theme.chartPrimary,
    '--zdq-brand-800': theme.inkDeep,
    '--zdq-brand-900': theme.ink,
    '--zdq-brand-on-primary': theme.onPrimary,
    '--zdq-brand-focus': `0 0 0 3px ${alpha(theme.source, 0.18)}`,
    '--zdq-brand-a06': alpha(theme.source, 0.06),
    '--zdq-brand-a12': alpha(theme.source, 0.12),
    '--zdq-brand-a13': alpha(theme.source, 0.13),
    '--zdq-brand-a18': alpha(theme.source, 0.18),
    '--zdq-brand-a24': alpha(theme.source, 0.24),
    '--zdq-brand-a30': alpha(theme.source, 0.30),
    '--zdq-brand-a46': alpha(theme.source, 0.46),
    '--el-color-primary': theme.primary,
    '--el-color-primary-light-3': mixHex(theme.source, '#FFFFFF', 0.30),
    '--el-color-primary-light-5': mixHex(theme.source, '#FFFFFF', 0.50),
    '--el-color-primary-light-7': mixHex(theme.source, '#FFFFFF', 0.70),
    '--el-color-primary-light-8': mixHex(theme.source, '#FFFFFF', 0.80),
    '--el-color-primary-light-9': mixHex(theme.source, '#FFFFFF', 0.90),
    '--el-color-primary-dark-2': theme.primaryDeep
  }
  Object.entries(values).forEach(([key, value]) => root.style.setProperty(key, value))
  return theme
}

function absoluteAsset(path?: string): string {
  if (!path) return ''
  if (/^https?:\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path
  const base = String(import.meta.env.VITE_API_BASE || '/api/').replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

function generatedEnterpriseFavicon(company: WebCompanyBrand, theme: BrandTheme): string {
  const initial = Array.from((company.name || '企').trim())[0] || '企'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${theme.primaryBase}"/><text x="32" y="43" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-size="34" font-weight="500" fill="${contrastRatio(theme.primaryBase, '#FFFFFF') >= 3 ? '#FFFFFF' : '#17212B'}">${initial}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function withFaviconVersion(url: string): string {
  if (!url || url.startsWith('data:')) return url
  return `${url}${url.includes('?') ? '&' : '?'}_favicon=${Date.now()}`
}

export function applyCompanyFavicon(company?: WebCompanyBrand | null): void {
  if (typeof document === 'undefined') return
  const theme = deriveBrandTheme(company?.color)
  const href = company?.logo
    ? withFaviconVersion(absoluteAsset(company.logo))
    : company?.name
      ? generatedEnterpriseFavicon(company, theme)
      : DEFAULT_FAVICON
  document.querySelectorAll<HTMLLinkElement>('link[data-company-favicon="true"]').forEach((link) => {
    link.href = href
    link.type = company?.logo ? 'image/png' : 'image/svg+xml'
  })
  const touchIcon = document.getElementById('app-touch-icon') as HTMLLinkElement | null
  if (touchIcon) touchIcon.href = href
}

export function applyCompanyWebBrand(company?: WebCompanyBrand | null): BrandTheme {
  const theme = applyWebBrandTheme(company?.color)
  applyCompanyFavicon(company)
  return theme
}
