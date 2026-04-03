import { Resend } from 'resend'
import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  let body: {
    businessId: string
    emailNumber: number
    totalEmails: number
    subjectLine: string
    previewText: string
    bodyText: string
    cta: string
    ctaUrl: string
    title: string
  }
  try { body = await request.json() } catch { return apiError('Invalid body', 400, 'INVALID_BODY') }

  const { businessId, emailNumber, totalEmails, subjectLine, previewText, bodyText, cta, ctaUrl, title } = body
  if (!businessId || !emailNumber || !subjectLine || !bodyText) {
    return apiError('Missing required fields', 400, 'VALIDATION_ERROR')
  }

  const adminClient = createAdminClient()

  // Verify business ownership
  const { data: biz } = await adminClient.from('businesses').select('customer_id').eq('id', businessId).single()
  if (!biz) return apiError('Business not found', 404, 'NOT_FOUND')
  const { data: cust } = await adminClient.from('customers').select('id').eq('id', biz.customer_id).eq('auth_user_id', auth.user.id).single()
  if (!cust) return apiError('Access denied', 403, 'FORBIDDEN')

  // Rate limit: 10 previews per hour per business
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: recentCount } = await adminClient
    .from('module_outputs')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('module_type', 'signal_sequences_preview')
    .gte('created_at', oneHourAgo)
  if ((recentCount ?? 0) >= 10) {
    return apiError('Preview limit reached — try again in an hour', 429, 'RATE_LIMITED')
  }

  // Get user email from auth
  const userEmail = auth.user.email
  if (!userEmail) return apiError('No email on account', 400, 'NO_EMAIL')

  // Convert body text line breaks to HTML
  const bodyHtml = bodyText
    .split('\n')
    .map(line => line.trim() === '' ? '<br/>' : `<p style="margin:0 0 12px 0;line-height:1.6;">${line}</p>`)
    .join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${subjectLine}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

  <!-- Preview text (hidden, shows in inbox) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    ${previewText}&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- SignalShot banner -->
          <tr>
            <td style="background:#191654;border-radius:12px 12px 0 0;padding:16px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="color:#43C6AC;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">SignalShot Preview</span>
                    <span style="color:rgba(255,255,255,0.4);font-size:11px;margin-left:8px;">·</span>
                    <span style="color:rgba(255,255,255,0.6);font-size:11px;margin-left:8px;">Email ${emailNumber} of ${totalEmails} · ${title}</span>
                  </td>
                  <td align="right">
                    <span style="color:rgba(255,255,255,0.4);font-size:11px;">Test only — not sent to your list</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Subject + Preview callout -->
          <tr>
            <td style="background:#fefce8;border:1px solid #fde68a;border-top:none;padding:20px 24px;">
              <p style="margin:0 0 4px 0;font-size:10px;font-weight:700;color:#92400e;letter-spacing:1px;text-transform:uppercase;">Subject Line</p>
              <p style="margin:0 0 16px 0;font-size:16px;font-weight:700;color:#1c1917;">${subjectLine}</p>
              <p style="margin:0 0 4px 0;font-size:10px;font-weight:700;color:#92400e;letter-spacing:1px;text-transform:uppercase;">Preview Text</p>
              <p style="margin:0;font-size:13px;color:#57534e;">${previewText}</p>
            </td>
          </tr>

          <!-- Email body -->
          <tr>
            <td style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;padding:32px 24px;">
              <div style="font-size:15px;color:#374151;">
                ${bodyHtml}
              </div>

              ${cta ? `
              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr>
                  <td style="background:#191654;border-radius:8px;padding:14px 28px;">
                    <a href="${ctaUrl || '#'}" style="color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;display:inline-block;">${cta}</a>
                  </td>
                </tr>
              </table>` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:16px 24px;">
              <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">
                This is a test preview sent from <strong>SignalShot</strong>. It was not sent to your email list.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  // Track preview for rate limiting
  await adminClient.from('module_outputs').insert({
    business_id: businessId,
    module_type: 'signal_sequences_preview',
    status: 'complete',
    output_data: { emailNumber, sentTo: userEmail },
  })

  try {
    await resend.emails.send({
      from: 'SignalShot <noreply@goodfellastech.com>',
      to: userEmail,
      subject: `[Preview] ${subjectLine}`,
      html,
    })
  } catch {
    return apiError('Failed to send preview email', 500, 'SEND_FAILED')
  }

  return apiSuccess({ sent: true, sentTo: userEmail })
}
