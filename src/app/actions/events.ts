'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { getHouseholdMemberIds } from '@/app/actions/household'

const EventSchema = z.object({
  name: z.string().min(1, { error: 'Name is required.' }).trim(),
  totalBudget: z.coerce.number().min(1, { error: 'Budget must be at least $1.' }),
  emoji: z.string().min(1).max(4).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: 'Must be a valid hex color.' }),
  eventDate: z.string().optional(),
})

export type EventState = {
  errors?: Record<string, string[]>
  message?: string
  success?: boolean
} | undefined

export async function createEvent(state: EventState, formData: FormData): Promise<EventState> {
  const session = await requireAuth()

  const result = EventSchema.safeParse({
    name: formData.get('name'),
    totalBudget: formData.get('totalBudget'),
    emoji: formData.get('emoji'),
    color: formData.get('color'),
    eventDate: formData.get('eventDate'),
  })

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const { name, totalBudget, emoji, color, eventDate } = result.data

  await db.eventBudget.create({
    data: {
      userId: session.userId,
      name,
      totalBudget,
      emoji: emoji ?? '🎉',
      color,
      eventDate: eventDate ? new Date(eventDate) : undefined,
    },
  })

  revalidatePath('/events')
  return { success: true }
}

export async function updateEvent(
  eventId: string,
  state: EventState,
  formData: FormData,
): Promise<EventState> {
  const session = await requireAuth()

  const result = EventSchema.safeParse({
    name: formData.get('name'),
    totalBudget: formData.get('totalBudget'),
    emoji: formData.get('emoji'),
    color: formData.get('color'),
    eventDate: formData.get('eventDate'),
  })

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const memberIds = await getHouseholdMemberIds(session.userId)
  const event = await db.eventBudget.findFirst({ where: { id: eventId, userId: { in: memberIds } } })
  if (!event) return { message: 'Event not found.' }

  const { name, totalBudget, emoji, color, eventDate } = result.data

  await db.eventBudget.update({
    where: { id: eventId },
    data: {
      name,
      totalBudget,
      emoji: emoji ?? event.emoji,
      color,
      eventDate: eventDate ? new Date(eventDate) : null,
    },
  })

  revalidatePath('/events')
  return { success: true }
}

export async function deleteEvent(eventId: string): Promise<void> {
  const session = await requireAuth()
  const memberIds = await getHouseholdMemberIds(session.userId)
  const event = await db.eventBudget.findFirst({ where: { id: eventId, userId: { in: memberIds } } })
  if (!event) return

  await db.eventBudget.delete({ where: { id: eventId } })
  revalidatePath('/events')
}

export async function assignTransaction(eventId: string, transactionId: string): Promise<void> {
  const session = await requireAuth()
  const memberIds = await getHouseholdMemberIds(session.userId)
  const event = await db.eventBudget.findFirst({ where: { id: eventId, userId: { in: memberIds } } })
  if (!event) return
  // Only allow assigning the user's own transactions
  const txn = await db.transaction.findFirst({ where: { id: transactionId, userId: session.userId } })
  if (!txn) return

  await db.eventTransaction.upsert({
    where: { eventBudgetId_transactionId: { eventBudgetId: eventId, transactionId } },
    create: { eventBudgetId: eventId, transactionId },
    update: {},
  })

  revalidatePath('/events')
}

export async function removeTransaction(eventId: string, transactionId: string): Promise<void> {
  const session = await requireAuth()
  const memberIds = await getHouseholdMemberIds(session.userId)
  const event = await db.eventBudget.findFirst({ where: { id: eventId, userId: { in: memberIds } } })
  if (!event) return

  await db.eventTransaction.deleteMany({
    where: { eventBudgetId: eventId, transactionId },
  })

  revalidatePath('/events')
}
