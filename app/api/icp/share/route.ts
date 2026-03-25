/*
  Run in Supabase before deploying:

  CREATE TABLE IF NOT EXISTS public.share_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token text UNIQUE NOT NULL,
    session_id uuid REFERENCES public.sessions(id),
    business_id uuid REFERENCES public.businesses(id),
    expires_at timestamptz NOT NULL,
    view_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
  );

  ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "share_links_public_read" ON public.share_links
    FOR SELECT USING (true);

  CREATE POLICY "share_links_owner_write" ON public.share_links
    FOR INSERT WITH CHECK (
      business_id IN (
        SELECT b.id FROM public.businesses b
        JOIN public.customers c ON c.id = b.customer_id
        WHERE c.auth_user_id = auth.uid()
      )
    );
*/

import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  let body: { sessionId: string; expiresInDays?: number }
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_BODY')
  }

  const { sessionId, expiresInDays = 30 } = body

  if (!sessionId) {
    return apiError('sessionId is required', 400, 'VALIDATION_ERROR')
  }

  const adminClient = createAdminClient()

  // Verify session belongs to authenticated user's business
  const { data: session } = await adminClient
    .from('sessions')
    .select('id, business_id, customer_id')
    .eq('id', sessionId)
    .single()

  if (!session) {
    return apiError('Session not found', 404, 'NOT_FOUND')
  }

  if (session.customer_id !== auth.customer.id) {
    return apiError('Session does not belong to this user', 403, 'FORBIDDEN')
  }

  // Generate secure token
  const token = crypto.randomBytes(32).toString('hex')

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + expiresInDays)

  // Store share link
  const { error } = await adminClient.from('share_links').insert({
    token,
    session_id: sessionId,
    business_id: session.business_id,
    expires_at: expiresAt.toISOString(),
  })

  if (error) {
    console.error('Share link creation error:', error)
    return apiError('Failed to create share link', 500, 'CREATE_FAILED')
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  return apiSuccess({ shareUrl: `${appUrl}/share/${token}` })
}
