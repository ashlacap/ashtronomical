'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { PLANS, type PlanId } from '@/lib/plans'

const CategorySchema = z.object({
  name: z.string().min(1, { error: 'Name is required.' }).trim(),
  budgetAmount: z.coerce.number().min(0, { error: 'Budget amount must be 0 or more.' }),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: 'Must be a valid hex color.' }),
  keywords: z.string().optional(),
  rollover: z.coerce.boolean().optional(),
  savingsGoalId: z.string().optional(),
})

export type CategoryState = {
  errors?: Record<string, string[]>
  message?: string
  success?: boolean
} | undefined

function parseKeywords(raw: string | undefined): string[] {
  if (!raw) return []
  return raw.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean)
}

export async function createCategory(state: CategoryState, formData: FormData): Promise<CategoryState> {
  const session = await requireAuth()

  const result = CategorySchema.safeParse({
    name: formData.get('name'),
    budgetAmount: formData.get('budgetAmount'),
    color: formData.get('color'),
    keywords: formData.get('keywords'),
    rollover: formData.get('rollover'),
    savingsGoalId: formData.get('savingsGoalId') || undefined,
  })

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const existing = await db.category.findUnique({
    where: { userId_name: { userId: session.userId, name: result.data.name } },
  })
  if (existing) return { errors: { name: ['A category with this name already exists.'] } }

  await db.category.create({
    data: {
      userId: session.userId,
      name: result.data.name,
      budgetAmount: result.data.budgetAmount,
      color: result.data.color,
      keywords: parseKeywords(result.data.keywords),
      rollover: result.data.rollover ?? false,
      savingsGoalId: result.data.savingsGoalId ?? null,
    },
  })

  revalidatePath('/budget')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateCategory(
  categoryId: string,
  state: CategoryState,
  formData: FormData,
): Promise<CategoryState> {
  const session = await requireAuth()

  const result = CategorySchema.safeParse({
    name: formData.get('name'),
    budgetAmount: formData.get('budgetAmount'),
    color: formData.get('color'),
    keywords: formData.get('keywords'),
    rollover: formData.get('rollover'),
    savingsGoalId: formData.get('savingsGoalId') || undefined,
  })

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const cat = await db.category.findFirst({ where: { id: categoryId, userId: session.userId } })
  if (!cat) return { message: 'Category not found.' }

  await db.category.update({
    where: { id: categoryId },
    data: {
      name: result.data.name,
      budgetAmount: result.data.budgetAmount,
      color: result.data.color,
      keywords: parseKeywords(result.data.keywords),
      rollover: result.data.rollover ?? false,
      savingsGoalId: result.data.savingsGoalId ?? null,
    },
  })

  revalidatePath('/budget')
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Applies a preset budget plan (e.g. 50/30/20) as a starting set of
 * categories, for anyone who reached Allocations with none yet — whether
 * they skipped onboarding, chose "set it up myself" then changed their mind,
 * or joined a household without going through it. Skips any category name
 * that already exists rather than erroring, so it's safe to apply on top of
 * a few categories someone already added by hand.
 */
export async function applyPlan(planId: PlanId, monthlyIncome: number): Promise<{ success: boolean; created: number }> {
  const session = await requireAuth()
  const plan = PLANS[planId]
  if (!plan || monthlyIncome <= 0) return { success: false, created: 0 }

  const now = new Date()
  await db.budget.upsert({
    where: { userId_month_year: { userId: session.userId, month: now.getMonth() + 1, year: now.getFullYear() } },
    update: { monthlyIncome },
    create: { userId: session.userId, monthlyIncome, month: now.getMonth() + 1, year: now.getFullYear() },
  })

  const result = await db.category.createMany({
    data: plan.categories.map((cat) => ({
      userId: session.userId,
      name: cat.name,
      color: cat.color,
      keywords: [...cat.keywords],
      budgetAmount: Math.round((cat.pct / 100) * monthlyIncome * 100) / 100,
      rollover: false,
    })),
    skipDuplicates: true,
  })

  revalidatePath('/budget')
  revalidatePath('/dashboard')
  return { success: true, created: result.count }
}

export async function deleteCategory(categoryId: string): Promise<void> {
  const session = await requireAuth()
  const cat = await db.category.findFirst({ where: { id: categoryId, userId: session.userId } })
  if (!cat) return

  await db.transaction.updateMany({
    where: { categoryId, userId: session.userId },
    data: { categoryId: null },
  })

  await db.category.delete({ where: { id: categoryId } })

  revalidatePath('/budget')
  revalidatePath('/dashboard')
  revalidatePath('/transactions')
}

export async function sweepUnspentToSavings(
  categoryId: string,
  amount: number,
  period?: string,
): Promise<void> {
  const session = await requireAuth()
  const cat = await db.category.findFirst({
    where: { id: categoryId, userId: session.userId },
    include: { savingsGoal: true },
  })
  if (!cat?.savingsGoal || amount <= 0) return

  // Tag the contribution with the category+period so a sweep is never applied
  // twice for the same month (e.g. if the dashboard banner is clicked twice).
  const note = period ? `sweep:${categoryId}:${period}` : null
  if (note) {
    const already = await db.goalContribution.findFirst({
      where: { goalId: cat.savingsGoal.id, note },
    })
    if (already) return
  }

  await db.$transaction([
    db.savingsGoal.update({
      where: { id: cat.savingsGoal.id },
      data: { currentAmount: Math.min(cat.savingsGoal.currentAmount + amount, cat.savingsGoal.targetAmount) },
    }),
    db.goalContribution.create({
      data: { goalId: cat.savingsGoal.id, amount, note },
    }),
  ])

  revalidatePath('/dashboard')
  revalidatePath('/goals')
}

/**
 * Dismisses the month-end sweep prompt for a category/period without
 * transferring anything, so the banner doesn't keep reappearing.
 */
export async function dismissSweepPrompt(categoryId: string, period: string): Promise<void> {
  const session = await requireAuth()
  const cat = await db.category.findFirst({
    where: { id: categoryId, userId: session.userId },
    include: { savingsGoal: true },
  })
  if (!cat?.savingsGoal) return

  const note = `sweep-dismissed:${categoryId}:${period}`
  const already = await db.goalContribution.findFirst({ where: { goalId: cat.savingsGoal.id, note } })
  if (already) return

  await db.goalContribution.create({
    data: { goalId: cat.savingsGoal.id, amount: 0, note },
  })

  revalidatePath('/dashboard')
}
