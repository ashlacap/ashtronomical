'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { createSession, deleteSession } from '@/lib/session'
import { checkRateLimit, recordFailure, clearRateLimit } from '@/lib/rate-limit'
import { sendEmail, emailLayout } from '@/lib/email'
import { createVerificationToken, appUrl } from '@/lib/tokens'

const RegisterSchema = z.object({
  name: z.string().min(2, { error: 'Name must be at least 2 characters.' }).trim(),
  email: z.email({ error: 'Please enter a valid email.' }).trim(),
  password: z.string().min(8, { error: 'Password must be at least 8 characters.' }).trim(),
})

const LoginSchema = z.object({
  email: z.email({ error: 'Please enter a valid email.' }).trim(),
  password: z.string().min(1, { error: 'Password is required.' }).trim(),
})

export type AuthState = {
  errors?: Record<string, string[]>
  message?: string
} | undefined

export async function register(state: AuthState, formData: FormData): Promise<AuthState> {
  const result = RegisterSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const { name, email, password } = result.data
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) return { errors: { email: ['An account with this email already exists.'] } }

  const hashedPassword = await bcrypt.hash(password, 12)
  const user = await db.user.create({
    data: { name, email, password: hashedPassword, onboardingComplete: false },
  })

  // Fire a verification email (non-blocking on failure)
  try {
    const token = await createVerificationToken(user.id, 'email-verify')
    await sendEmail({
      to: user.email,
      subject: 'Verify your Ashtronomical email',
      html: emailLayout(
        'Welcome to Ashtronomical',
        `<p>Hi ${name}, confirm your email to secure your account.</p>`,
        { label: 'Verify email', url: appUrl(`/verify-email?token=${token}`) },
      ),
    })
  } catch (e) {
    console.error('Verification email failed:', e)
  }

  await createSession(user.id, false)
  redirect('/onboarding')
}

export async function login(state: AuthState, formData: FormData): Promise<AuthState> {
  const result = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const { email, password } = result.data

  // Rate limit by IP + email to slow brute-force attacks
  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rlKey = `login:${ip}:${email.toLowerCase()}`
  const limit = checkRateLimit(rlKey)
  if (!limit.allowed) {
    const mins = Math.ceil((limit.retryAfterSeconds ?? 900) / 60)
    return { message: `Too many failed attempts. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.` }
  }

  const user = await db.user.findUnique({ where: { email } })
  if (!user || !(await bcrypt.compare(password, user.password))) {
    recordFailure(rlKey)
    return { message: 'Invalid email or password.' }
  }

  clearRateLimit(rlKey)
  await createSession(user.id, user.onboardingComplete)
  redirect(user.onboardingComplete ? user.defaultPage : '/onboarding')
}

export async function logout(): Promise<void> {
  await deleteSession()
  redirect('/login')
}
