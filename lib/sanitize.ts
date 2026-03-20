export function sanitizeMessage(input: unknown): string {
  if (!input || typeof input !== 'string') return ''
  return input
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, 2000)
}

export function sanitizeText(input: unknown): string {
  if (!input || typeof input !== 'string') return ''
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '')
    .trim()
    .slice(0, 1000)
}

export function sanitizeEmail(email: unknown): string {
  if (!email || typeof email !== 'string') return ''
  return email.trim().toLowerCase().slice(0, 254)
}

export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return ''
  const allowedTags = /^(h[1-6]|p|ul|ol|li|strong|em|blockquote|hr|br|div|span)$/i
  return html
    .replace(/<([a-z][a-z0-9]*)\b([^>]*)>/gi, (_match, tag) => {
      if (allowedTags.test(tag)) return `<${tag}>`
      return ''
    })
    .replace(/<\/([a-z][a-z0-9]*)>/gi, (_match, tag) => {
      if (allowedTags.test(tag)) return `</${tag}>`
      return ''
    })
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
}

export function validateUrl(url: unknown): boolean {
  if (!url || typeof url !== 'string') return false
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}
