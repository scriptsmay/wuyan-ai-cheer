const PREFIX = 'wuyan'

function formatDate(): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function usageKey(prefix: string): string {
  return `${PREFIX}-${prefix}-usage-${formatDate()}`
}

export function getDailyUsage(key: string): number {
  try {
    return parseInt(localStorage.getItem(key) || '0', 10) || 0
  } catch {
    return 0
  }
}

export function incrementDailyUsage(key: string): number {
  try {
    const current = getDailyUsage(key)
    const next = current + 1
    localStorage.setItem(key, String(next))
    return next
  } catch {
    return 0
  }
}
