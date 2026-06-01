'use server'

import { revalidatePath } from 'next/cache'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { sendEmail, emailLayout } from '@/lib/email'
import { appUrl } from '@/lib/tokens'

export type HouseholdState = {
  errors?: Record<string, string[]>
  message?: string
  success?: boolean
} | undefined

const NameSchema = z.object({ name: z.string().min(1, { error: 'Name is required.' }).trim() })

export async function createHousehold(state: HouseholdState, formData: FormData): Promise<HouseholdState> {
  const session = await requireAuth()
  const result = NameSchema.safeParse({ name: formData.get('name') })
  if (!result.success) return { errors: result.error.flatten().fieldErrors as Record<string, string[]> }

  const user = await db.user.findUnique({ where: { id: session.userId }, select: { householdId: true } })
  if (user?.householdId) return { message: 'You are already in a household.' }

  const household = await db.household.create({
    data: { name: result.data.name, ownerId: session.userId },
  })
  await db.user.update({ where: { id: session.userId }, data: { householdId: household.id } })

  revalidatePath('/household')
  return { success: true }
}

const InviteSchema = z.object({ email: z.email({ error: 'Enter a valid email.' }).trim() })

export async function inviteToHousehold(state: HouseholdState, formData: FormData): Promise<HouseholdState> {
  const session = await requireAuth()
  const result = InviteSchema.safeParse({ email: formData.get('email') })
  if (!result.success) return { errors: result.error.flatten().fieldErrors as Record<string, string[]> }

  const me = await db.user.findUnique({ where: { id: session.userId }, select: { householdId: true, name: true } })
  if (!me?.householdId) return { message: 'Create a household first.' }

  const token = randomBytes(24).toString('hex')
  await db.householdInvite.create({
    data: {
      householdId: me.householdId,
      email: result.data.email.toLowerCase(),
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  await sendEmail({
    to: result.data.email,
    subject: `${me.name ?? 'Someone'} invited you to share a budget on Ashtronomical`,
    html: emailLayout(
      'You\'ve been invited to a shared budget',
      `<p>${me.name ?? 'A partner'} wants to budget together on Ashtronomical. Join their household to share event budgets like a wedding or trip.</p>`,
      { label: 'Accept invitation', url: appUrl(`/household/join?token=${token}`) },
    ),
  })

  revalidatePath('/household')
  return { success: true }
}

export async function acceptInvite(token: string): Promise<{ ok: boolean; message: string }> {
  const session = await requireAuth()
  const invite = await db.householdInvite.findUnique({ where: { token } })
  if (!invite || invite.expiresAt < new Date()) return { ok: false, message: 'This invitation is invalid or has expired.' }

  const user = await db.user.findUnique({ where: { id: session.userId }, select: { householdId: true } })
  if (user?.householdId) return { ok: false, message: 'You are already in a household. Leave it first to join another.' }

  await db.user.update({ where: { id: session.userId }, data: { householdId: invite.householdId } })
  await db.householdInvite.delete({ where: { id: invite.id } })

  revalidatePath('/household')
  revalidatePath('/events')
  return { ok: true, message: 'You\'ve joined the household. Shared event budgets are now visible.' }
}

export async function leaveHousehold(): Promise<void> {
  const session = await requireAuth()
  const user = await db.user.findUnique({ where: { id: session.userId }, select: { householdId: true } })
  if (!user?.householdId) return

  const household = await db.household.findUnique({
    where: { id: user.householdId },
    include: { members: { select: { id: true } } },
  })

  await db.user.update({ where: { id: session.userId }, data: { householdId: null } })

  // If the last member left, clean up the household
  if (household && household.members.length <= 1) {
    await db.household.delete({ where: { id: household.id } })
  }

  revalidatePath('/household')
  revalidatePath('/events')
}

/** Returns all user IDs that share the current user's household (incl. self). */
export async function getHouseholdMemberIds(userId: string): Promise<string[]> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { householdId: true } })
  if (!user?.householdId) return [userId]
  const members = await db.user.findMany({ where: { householdId: user.householdId }, select: { id: true } })
  return members.map((m) => m.id)
}
