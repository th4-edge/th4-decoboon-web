import type { SessionProfile } from '@/domains/identity/model'

const KEY = 'zdq.web.last-login.v1'
const TTL_MS = 180 * 24 * 60 * 60 * 1000

export interface LastLoginCompany {
  id: string
  name: string
  logo?: string
  color?: string
}

export interface LastLoginMemory {
  phone: string
  employeeName: string
  company: LastLoginCompany | null
  savedAt: number
}

function companyNameOf(profile: SessionProfile): string {
  const company = profile.employee?.company
  return String(company?.title ?? company?.name ?? '').trim()
}

export function saveLastLogin(profile: SessionProfile): void {
  const phone = String(profile.phone ?? profile.employee?.telNo ?? '').trim()
  if (!/^1\d{10}$/.test(phone)) return
  const company = profile.employee?.company
  if (!company) return
  const name = companyNameOf(profile)
  if (!name) return
  const memory: LastLoginMemory = {
    phone,
    employeeName: String(profile.employee?.name ?? '').trim(),
    company: {
      id: String(company.comId ?? ''),
      name,
      logo: String(company.logo ?? '').trim() || undefined,
      color: String(company.color ?? '').trim() || undefined
    },
    savedAt: Date.now()
  }
  localStorage.setItem(KEY, JSON.stringify(memory))
}

export function readLastLogin(): LastLoginMemory | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as LastLoginMemory
    if (!/^1\d{10}$/.test(String(value.phone ?? ''))) return null
    if (!value.savedAt || Date.now() - value.savedAt > TTL_MS) return null
    return {
      phone: String(value.phone),
      employeeName: String(value.employeeName ?? ''),
      company: value.company
        ? {
            id: String(value.company.id ?? ''),
            name: String(value.company.name ?? ''),
            logo: value.company.logo ? String(value.company.logo) : undefined,
            color: value.company.color ? String(value.company.color) : undefined
          }
        : null,
      savedAt: Number(value.savedAt)
    }
  } catch {
    return null
  }
}

export function clearLastLogin(): void {
  localStorage.removeItem(KEY)
}
