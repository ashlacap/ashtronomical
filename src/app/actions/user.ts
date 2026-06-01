'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { requireAuth, deleteSession } from '@/lib/session'

// ── Profile ──────────────────────────────────────────────────────────────────

const ProfileSchema = z.object({
  name: z.string().min(2, { error: 'Name must be at least 2 characters.' }).trim(),
  email: z.email({ error: 'Please enter a valid email.' }).trim(),
})

export type UserActionState = {
  errors?: Record<string, string[]>
  message?: string
  success?: boolean
} | undefined

export async function updateProfile(state: UserActionState, formData: FormData): Promise<UserActionState> {
  const session = await requireAuth()

  const result = ProfileSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
  })
  if (!result.success) return { errors: result.error.flatten().fieldErrors as Record<string, string[]> }

  const { name, email } = result.data
  const existing = await db.user.findFirst({ where: { email, NOT: { id: session.userId } } })
  if (existing) return { errors: { email: ['This email is already in use.'] } }

  await db.user.update({ where: { id: session.userId }, data: { name, email } })
  revalidatePath('/profile')
  revalidatePath('/', 'layout')
  return { success: true }
}

const PasswordSchema = z.object({
  currentPassword: z.string().min(1, { error: 'Current password is required.' }),
  newPassword: z.string().min(8, { error: 'New password must be at least 8 characters.' }),
})

export async function changePassword(state: UserActionState, formData: FormData): Promise<UserActionState> {
  const session = await requireAuth()

  const result = PasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
  })
  if (!result.success) return { errors: result.error.flatten().fieldErrors as Record<string, string[]> }

  const user = await db.user.findUnique({ where: { id: session.userId } })
  if (!user) return { message: 'User not found.' }

  const valid = await bcrypt.compare(result.data.currentPassword, user.password)
  if (!valid) return { errors: { currentPassword: ['Incorrect password.'] } }

  const hashed = await bcrypt.hash(result.data.newPassword, 12)
  await db.user.update({ where: { id: session.userId }, data: { password: hashed } })
  return { success: true }
}

export async function deleteAccount(): Promise<void> {
  const session = await requireAuth()
  await db.user.delete({ where: { id: session.userId } })
  await deleteSession()
  redirect('/register')
}

// ── Settings ─────────────────────────────────────────────────────────────────

const SettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  currency: z.string().min(3).max(3),
  defaultPage: z.string().startsWith('/'),
  alertThreshold: z.coerce.number().min(1).max(100),
  budgetStartDay: z.coerce.number().min(1).max(28),
  weeklyDigest: z.coerce.boolean(),
  emailAlerts: z.coerce.boolean(),
})

export async function updateSettings(state: UserActionState, formData: FormData): Promise<UserActionState> {
  const session = await requireAuth()

  const result = SettingsSchema.safeParse({
    theme: formData.get('theme'),
    currency: formData.get('currency'),
    defaultPage: formData.get('defaultPage'),
    alertThreshold: formData.get('alertThreshold'),
    budgetStartDay: formData.get('budgetStartDay'),
    weeklyDigest: formData.get('weeklyDigest') === 'on' || formData.get('weeklyDigest') === 'true',
    emailAlerts: formData.get('emailAlerts') === 'on' || formData.get('emailAlerts') === 'true',
  })
  if (!result.success) return { errors: result.error.flatten().fieldErrors as Record<string, string[]> }

  await db.user.update({ where: { id: session.userId }, data: result.data })
  revalidatePath('/settings')
  return { success: true }
}
