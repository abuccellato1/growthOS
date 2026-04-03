import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/webp',
]

const MAX_SIZE = 20 * 1024 * 1024

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  let formData: FormData
  try { formData = await request.formData() } catch { return apiError('Invalid form data', 400, 'INVALID_BODY') }

  const file = formData.get('file') as File | null
  const businessId = formData.get('businessId') as string | null
  const sessionId = formData.get('sessionId') as string | null

  if (!file || !businessId) return apiError('Missing file or businessId', 400, 'VALIDATION_ERROR')
  if (!ALLOWED_TYPES.includes(file.type)) return apiError('File type not supported', 400, 'INVALID_TYPE')
  if (file.size > MAX_SIZE) return apiError('File too large \u2014 max 20MB', 400, 'FILE_TOO_LARGE')

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

  const folder = sessionId ? `${businessId}/${sessionId}` : `${businessId}/unsorted`
  const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
  const storagePath = `${folder}/${filename}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await adminClient
    .storage
    .from('nora-attachments')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) return apiError('Upload failed', 500, 'UPLOAD_FAILED')

  if (sessionId) {
    const { data: session } = await adminClient
      .from('research_sessions')
      .select('attachments')
      .eq('id', sessionId)
      .single()

    const existingAttachments = (session?.attachments as unknown[]) || []
    await adminClient
      .from('research_sessions')
      .update({
        attachments: [...existingAttachments, {
          storagePath,
          filename: file.name,
          mediaType: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
        }]
      })
      .eq('id', sessionId)
  }

  return apiSuccess({ storagePath, filename: file.name, mediaType: file.type, size: file.size })
}
