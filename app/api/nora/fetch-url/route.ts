import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  let body: { businessId: string; url: string }
  try { body = await request.json() } catch { return apiError('Invalid body', 400, 'INVALID_BODY') }

  const { businessId, url } = body
  if (!businessId || !url) return apiError('Missing required fields', 400, 'VALIDATION_ERROR')

  let parsedUrl: URL
  try { parsedUrl = new URL(url) } catch { return apiError('Invalid URL', 400, 'INVALID_URL') }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return apiError('Only HTTP/HTTPS URLs allowed', 400, 'INVALID_URL')
  }

  const adminClient = createAdminClient()
  const { data: biz } = await adminClient
    .from('businesses')
    .select('customer_id')
    .eq('id', businessId)
    .single()
  if (!biz) return apiError('Business not found', 404, 'NOT_FOUND')

  const { data: cust } = await adminClient
    .from('customers')
    .select('id')
    .eq('id', biz.customer_id)
    .eq('auth_user_id', auth.user.id)
    .single()
  if (!cust) return apiError('Access denied', 403, 'FORBIDDEN')

  let title = url
  let content = ''

  try {
    const fetchRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SignalShot/1.0; research bot)',
        'Accept': 'text/html,application/xhtml+xml,text/plain',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!fetchRes.ok) return apiError(`Failed to fetch URL: ${fetchRes.status}`, 400, 'FETCH_FAILED')

    const html = await fetchRes.text()
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (titleMatch) title = titleMatch[1].trim()

    content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 12000)

  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return apiError('URL fetch timed out', 408, 'FETCH_TIMEOUT')
    }
    return apiError('Failed to fetch URL', 500, 'FETCH_FAILED')
  }

  return apiSuccess({ url, title, content, charCount: content.length })
}
