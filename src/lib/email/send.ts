// Resend email sender

export async function sendEmail(params: {
  to: string
  subject: string
  html: string
  replyTo?: string
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — email not sent')
    return { ok: false, error: 'RESEND_API_KEY not configured' }
  }

  const from = process.env.RESEND_FROM || 'Alexis CRM <noreply@resend.dev>'

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        reply_to: params.replyTo || 'pastoralexdocavaco@gmail.com',
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('[email] Resend error:', data)
      return { ok: false, error: data?.message ?? 'Resend API error' }
    }

    return { ok: true, id: data.id }
  } catch (e) {
    console.error('[email] Send failed:', e)
    return { ok: false, error: (e as Error).message }
  }
}
