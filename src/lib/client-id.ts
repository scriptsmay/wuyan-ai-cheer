const STORAGE_KEY = 'wuyan-ai-cheer-client-id'

function fallbackUuid(): string {
  const random = new Uint8Array(16)
  crypto.getRandomValues(random)
  random[6] = ((random[6] ?? 0) & 0x0f) | 0x40
  random[8] = ((random[8] ?? 0) & 0x3f) | 0x80
  const hex = Array.from(random, (byte) => byte.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`
}

export function getClientId(): string {
  const existing = localStorage.getItem(STORAGE_KEY)
  if (existing) return existing
  const value = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : fallbackUuid()
  localStorage.setItem(STORAGE_KEY, value)
  return value
}
