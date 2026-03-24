export async function sendICPCompletionEmail(params: {
  email: string
  firstName: string
  businessName: string
  appUrl: string
}): Promise<void> {
  const { email, firstName, businessName, appUrl } = params

  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: email,
    subject: `Your SignalMap\u2122 is ready, ${firstName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#191654;padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#43C6AC;
                         letter-spacing:-0.5px;">SignalShot\u2122</p>
              <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.6);">
                Turn signals into smarter marketing decisions
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;
                          color:#191654;line-height:1.2;">
                Your SignalMap\u2122 is ready, ${firstName}.
              </h1>
              <p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.7;">
                Alex has finished your discovery session for
                <strong style="color:#191654;">${businessName}</strong>.
                Your complete Ideal Customer Profile is built and waiting
                for you.
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.7;">
                This is the foundation for everything \u2014 your ads, your
                content, your sales conversations. Every marketing
                decision you make from here gets sharper because of
                the work you just did.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${appUrl}/dashboard/deliverables"
                       style="display:inline-block;background:#43C6AC;
                              color:#ffffff;font-size:15px;font-weight:700;
                              text-decoration:none;padding:14px 32px;
                              border-radius:10px;">
                      View My SignalMap\u2122 \u2192
                    </a>
                  </td>
                </tr>
              </table>

              <!-- What to do next -->
              <div style="background:#f8f9fc;border-radius:10px;padding:20px 24px;
                          margin-bottom:24px;">
                <p style="margin:0 0 12px;font-size:13px;font-weight:700;
                           color:#191654;text-transform:uppercase;
                           letter-spacing:0.05em;">
                  What to do with your SignalMap\u2122
                </p>
                <p style="margin:0 0 8px;font-size:14px;color:#4b5563;">
                  \u2192 Download the PDF and share it with your marketing team
                </p>
                <p style="margin:0 0 8px;font-size:14px;color:#4b5563;">
                  \u2192 Use it to rewrite your ad copy and targeting
                </p>
                <p style="margin:0 0 8px;font-size:14px;color:#4b5563;">
                  \u2192 Hand it to your copywriter before writing anything
                </p>
                <p style="margin:0;font-size:14px;color:#4b5563;">
                  \u2192 Reference it every time you create content
                </p>
              </div>

              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                Questions? Reply to this email or reach us at
                <a href="mailto:support@goodfellastech.com"
                   style="color:#43C6AC;">support@goodfellastech.com</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #f3f4f6;
                        text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Powered by SignalShot\u2122 \u00b7 Good Fellas Digital Marketing
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  })
}
