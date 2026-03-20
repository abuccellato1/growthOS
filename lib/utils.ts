export function formatDistanceToNow(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffDay > 1) return `${diffDay} days`
  if (diffDay === 1) return '1 day'
  if (diffHr > 1) return `${diffHr} hours`
  if (diffHr === 1) return '1 hour'
  if (diffMin > 1) return `${diffMin} minutes`
  if (diffMin === 1) return '1 minute'
  return 'just now'
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
