import 'server-only'

// Pluggable email transport, picked in this order:
//   1. Resend HTTP API   — if RESEND_API_KEY is set
//   2. SMTP (e.g. Gmail) — if SMTP_USER + SMTP_PASS are set
//   3. Console log        — development fallback

type SendEmailArgs = {
  to: string
  subject: string
  html: string
  text?: string
}

const FROM = process.env.EMAIL_FROM ?? process.env.SMTP_USER ?? 'Ashtronomical <noreply@ashtronomical.app>'

export async function sendEmail({ to, subject, html, text }: SendEmailArgs): Promise<{ ok: boolean }> {
  const plain = text ?? stripHtml(html)

  // 1. Resend
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to, subject, html, text: plain }),
      })
      if (!res.ok) { console.error('Resend send failed:', await res.text()); return { ok: false } }
      return { ok: true }
    } catch (err) {
      console.error('Resend send error:', err)
      return { ok: false }
    }
  }

  // 2. SMTP (Gmail or any SMTP server)
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const nodemailer = (await import('nodemailer')).default
      const host = process.env.SMTP_HOST ?? 'smtp.gmail.com'
      const port = Number(process.env.SMTP_PORT ?? 465)
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // 465 = SSL, 587 = STARTTLS
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      })
      await transporter.sendMail({ from: FROM, to, subject, html, text: plain })
      return { ok: true }
    } catch (err) {
      console.error('SMTP send error:', err)
      return { ok: false }
    }
  }

  // 3. Dev fallback — surface the email in server logs so flows are testable.
  console.log('\n────────── EMAIL (dev console transport) ──────────')
  console.log(`To:      ${to}`)
  console.log(`Subject: ${subject}`)
  console.log(`\n${plain}`)
  console.log('───────────────────────────────────────────────────\n')
  return { ok: true }
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
