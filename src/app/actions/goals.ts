'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

const GoalSchema = z.object({
  name: z.string().min(1, { error: 'Name is required.' }).trim(),
  targetAmount: z.coerce.number().min(1, { error: 'Target amount must be at least $1.' }),
  currentAmount: z.coerce.number().min(0).optional(),
  targetDate: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: 'Must be a valid hex color.' }),
  emoji: z.string().min(1).max(4).optional(),
})

export type GoalState = {
  errors?: Record<string, string[]>
  message?: string
  success?: boolean
} | undefined

export async function createGoal(state: GoalState, formData: FormData): Promise<GoalState> {
  const session = await requireAuth()

  const result = GoalSchema.safeParse({
    name: formData.get('name'),
    targetAmount: formData.get('targetAmount'),
    currentAmount: formData.get('currentAmount'),
    targetDate: formData.get('targetDate'),
    color: formData.get('color'),
    emoji: formData.get('emoji'),
  })

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const { name, targetAmount, currentAmount, targetDate, color, emoji } = result.data

  await db.savingsGoal.create({
    data: {
      userId: session.userId,
      name,
      targetAmount,
      currentAmount: currentAmount ?? 0,
      targetDate: targetDate ? new Date(targetDate) : undefined,
      color,
      emoji: emoji ?? '🎯',
    },
  })

  revalidatePath('/goals')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateGoal(
  goalId: string,
  state: GoalState,
  formData: FormData,
): Promise<GoalState> {
  const session = await requireAuth()

  const result = GoalSchema.safeParse({
    name: formData.get('name'),
    targetAmount: formData.get('targetAmount'),
    currentAmount: formData.get('currentAmount'),
    targetDate: formData.get('targetDate'),
    color: formData.get('color'),
    emoji: formData.get('emoji'),
  })

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const goal = await db.savingsGoal.findFirst({ where: { id: goalId, userId: session.userId } })
  if (!goal) return { message: 'Goal not found.' }

  const { name, targetAmount, currentAmount, targetDate, color, emoji } = result.data

  await db.savingsGoal.update({
    where: { id: goalId },
    data: {
      name,
      targetAmount,
      currentAmount: currentAmount ?? goal.currentAmount,
      targetDate: targetDate ? new Date(targetDate) : null,
      color,
      emoji: emoji ?? goal.emoji,
    },
  })

  revalidatePath('/goals')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteGoal(goalId: string): Promise<void> {
  const session = await requireAuth()
  const goal = await db.savingsGoal.findFirst({ where: { id: goalId, userId: session.userId } })
  if (!goal) return

  await db.savingsGoal.delete({ where: { id: goalId } })

  revalidatePath('/goals')
  revalidatePath('/dashboard')
}

export async function addToGoal(goalId: string, amount: number, note?: string): Promise<void> {
  const session = await requireAuth()
  const goal = await db.savingsGoal.findFirst({ where: { id: goalId, userId: session.userId } })
  if (!goal) return

  await db.$transaction([
    db.savingsGoal.update({
      where: { id: goalId },
      data: { currentAmount: Math.min(goal.currentAmount + amount, goal.targetAmount) },
    }),
    db.goalContribution.create({
      data: { goalId, amount, note: note?.trim() || null },
    }),
  ])

  revalidatePath('/goals')
  revalidatePath('/dashboard')
}

export async function getGoalContributions(goalId: string) {
  const session = await requireAuth()
  const goal = await db.savingsGoal.findFirst({ where: { id: goalId, userId: session.userId } })
  if (!goal) return []

  return db.goalContribution.findMany({
    where: { goalId },
    orderBy: { date: 'desc' },
    take: 50,
  })
}
