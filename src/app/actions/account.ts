'use server'

import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { sendEmail, emailLayout } from '@/lib/email'
import { createVerificationToken, consumeVerificationToken, appUrl } from '@/lib/tokens'

export type FlowState = {
  errors?: Record<string, string[]>
  message?: string
  success?: boolean
} | undefined

// ── Email verification ───────────────────────────────────────────────────────

export async function sendVerificationEmail(): Promise<FlowState> {
  const session = await requireAuth()
  const user = await db.user.findUnique({ where: { id: session.userId } })
  if (!user) return { message: 'User not found.' }
  if (user.emailVerified) return { success: true, message: 'Already verified.' }

  const token = await createVerificationToken(user.id, 'email-verify')
  const url = appUrl(`/verify-email?token=${token}`)
  const result = await sendEmail({
    to: user.email,
    subject: 'Verify your Ashtronomical email',
    html: emailLayout(
      'Confirm your email',
      `<p>Hi ${user.name ?? 'there'}, please confirm your email address to secure your account.</p>`,
      { label: 'Verify email', url },
    ),
  })
  if (!result.ok) return { message: result.error ?? 'Could not send the email.' }
  return { success: true }
}

export async function verifyEmailToken(token: string): Promise<boolean> {
  const userId = await consumeVerificationToken(token, 'email-verify')
  if (!userId) return false
  await db.user.update({ where: { id: userId }, data: { emailVerified: true } })
  return true
}

// ── Password reset ───────────────────────────────────────────────────────────

const EmailSchema = z.object({ email: z.email({ error: 'Enter a valid email.' }).trim() })

export async function requestPasswordReset(state: FlowState, formData: FormData): Promise<FlowState> {
  const result = EmailSchema.safeParse({ email: formData.get('email') })
  if (!result.success) return { errors: result.error.flatten().fieldErrors as Record<string, string[]> }

  const user = await db.user.findUnique({ where: { email: result.data.email } })
  // Always return success to avoid leaking which emails exist
  if (user) {
    const token = await createVerificationToken(user.id, 'password-reset')
    const url = appUrl(`/reset-password?token=${token}`)
    await sendEmail({
      to: user.email,
      subject: 'Reset your Ashtronomical password',
      html: emailLayout(
        'Reset your password',
        `<p>We received a request to reset your password. This link expires in 1 hour.</p>`,
        { label: 'Reset password', url },
      ),
    })
  }
  return { success: true }
}

const ResetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, { error: 'Password must be at least 8 characters.' }),
})

export async function resetPassword(state: FlowState, formData: FormData): Promise<FlowState> {
  const result = ResetSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
  })
  if (!result.success) return { errors: result.error.flatten().fieldErrors as Record<string, string[]> }

  const userId = await consumeVerificationToken(result.data.token, 'password-reset')
  if (!userId) return { message: 'This reset link is invalid or has expired.' }

  const hashed = await bcrypt.hash(result.data.password, 12)
  await db.user.update({ where: { id: userId }, data: { password: hashed } })
  return { success: true }
}
