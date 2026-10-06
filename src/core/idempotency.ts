function randomToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  return `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
}

export function createIdempotencyKey(prefix = ''): string {
  const normalizedPrefix = prefix.trim().replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
  const token = randomToken()
  return normalizedPrefix ? `${normalizedPrefix}-${token}` : token
}
