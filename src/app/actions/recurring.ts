'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

const RecurringSchema = z.object({
  name: z.string().min(1, { error: 'Name is required.' }).trim(),
  amount: z.coerce.number().refine((n) => n !== 0, { error: 'Amount cannot be zero.' }),
  categoryId: z.string().optional(),
  dayOfMonth: z.coerce.number().min(1).max(28),
  isTransfer: z.coerce.boolean().optional(),
})

export type RecurringState = {
  errors?: Record<string, string[]>
  message?: string
  success?: boolean
} | undefined

export async function createRecurring(state: RecurringState, formData: FormData): Promise<RecurringState> {
  const session = await requireAuth()
  const result = RecurringSchema.safeParse({
    name: formData.get('name'),
    amount: formData.get('amount'),
    categoryId: formData.get('categoryId') || undefined,
    dayOfMonth: formData.get('dayOfMonth'),
    isTransfer: formData.get('isTransfer') === 'true' || formData.get('isTransfer') === 'on',
  })
  if (!result.success) return { errors: result.error.flatten().fieldErrors as Record<string, string[]> }

  const { name, amount, categoryId, dayOfMonth, isTransfer } = result.data
  await db.recurringTransaction.create({
    data: {
      userId: session.userId,
      name,
      amount,
      categoryId: categoryId ?? null,
      dayOfMonth,
      isTransfer: isTransfer ?? false,
    },
  })
  revalidatePath('/transactions')
  return { success: true }
}

export async function deleteRecurring(id: string): Promise<void> {
  const session = await requireAuth()
  await db.recurringTransaction.deleteMany({ where: { id, userId: session.userId } })
  revalidatePath('/transactions')
}

export async function toggleRecurring(id: string, active: boolean): Promise<void> {
  const session = await requireAuth()
  await db.recurringTransaction.updateMany({ where: { id, userId: session.userId }, data: { active } })
  revalidatePath('/transactions')
}

/**
 * Materialize any recurring rules whose day-of-month has arrived this month and
 * that haven't yet posted for the current month. Idempotent — safe to call on
 * every dashboard load or from a daily cron.
 */
export async function postDueRecurring(userId: string): Promise<number> {
  const now = new Date()
  const today = now.getDate()
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`

  const rules = await db.recurringTransaction.findMany({
    where: { userId, active: true, dayOfMonth: { lte: today } },
  })

  let posted = 0
  for (const rule of rules) {
    const last = rule.lastPostedAt
    const lastKey = last ? `${last.getFullYear()}-${last.getMonth()}` : null
    if (lastKey === monthKey) continue // already posted this month

    const postDate = new Date(now.getFullYear(), now.getMonth(), rule.dayOfMonth)
    await db.$transaction([
      db.transaction.create({
        data: {
          userId,
          name: rule.name,
          amount: rule.amount,
          date: postDate,
          categoryId: rule.categoryId,
          isManual: true,
          isTransfer: rule.isTransfer,
          pending: false,
        },
      }),
      db.recurringTransaction.update({ where: { id: rule.id }, data: { lastPostedAt: now } }),
    ])
    posted++
  }

  return posted
}
