import 'server-only'

// Pluggable email transport. Uses Resend's HTTP API when RESEND_API_KEY is set;
// otherwise logs the message to the console (development).

type SendEmailArgs = {
  to: string
  subject: string
  html: string
  text?: string
}

const FROM = process.env.EMAIL_FROM ?? 'Ashtronomical <noreply@ashtronomical.app>'

export async function sendEmail({ to, subject, html, text }: SendEmailArgs): Promise<{ ok: boolean }> {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    // Dev fallback — surface the email in server logs so flows are testable.
    console.log('\n────────── EMAIL (dev console transport) ──────────')
    console.log(`To:      ${to}`)
    console.log(`Subject: ${subject}`)
    console.log(`\n${text ?? stripHtml(html)}`)
    console.log('───────────────────────────────────────────────────\n')
    return { ok: true }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to, subject, html, text: text ?? stripHtml(html) }),
    })
    if (!res.ok) {
      console.error('Email send failed:', await res.text())
      return { ok: false }
    }
    return { ok: true }
  } catch (err) {
    console.error('Email send error:', err)
    return { ok: false }
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

// ── Shared email layout ──────────────────────────────────────────────────────
export function emailLayout(heading: string, body: string, cta?: { label: string; url: string }): string {
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #0f172a;">
    <div style="font-size: 13px; letter-spacing: 0.25em; text-transform: uppercase; font-weight: 700; color: #6366f1;">✦ Ashtronomical</div>
    <h1 style="font-size: 22px; margin: 24px 0 12px;">${heading}</h1>
    <div style="font-size: 15px; line-height: 1.6; color: #334155;">${body}</div>
    ${cta ? `<a href="${cta.url}" style="display: inline-block; margin-top: 24px; background: #0f172a; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">${cta.label}</a>` : ''}
    <p style="margin-top: 32px; font-size: 12px; color: #94a3b8;">If you didn't request this, you can safely ignore this email.</p>
  </div>`
}
