'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

const BudgetSchema = z.object({
  monthlyIncome: z.coerce.number().positive({ error: 'Monthly income must be a positive number.' }),
  previousIncome: z.coerce.number().optional(),
  adjustCategories: z.coerce.boolean().optional(),
})

export type BudgetState = {
  errors?: Record<string, string[]>
  message?: string
  success?: boolean
} | undefined

export async function upsertBudget(state: BudgetState, formData: FormData): Promise<BudgetState> {
  const session = await requireAuth()

  const result = BudgetSchema.safeParse({
    monthlyIncome: formData.get('monthlyIncome'),
    previousIncome: formData.get('previousIncome'),
    adjustCategories: formData.get('adjustCategories'),
  })
  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const { monthlyIncome, previousIncome, adjustCategories } = result.data
  const now = new Date()

  await db.budget.upsert({
    where: {
      userId_month_year: {
        userId: session.userId,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      },
    },
    update: { monthlyIncome },
    create: {
      userId: session.userId,
      monthlyIncome,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    },
  })

  // Scale all category budgets proportionally if income changed — opt-in,
  // since not everyone wants their categories auto-rebalanced.
  if (adjustCategories && previousIncome && previousIncome > 0 && monthlyIncome !== previousIncome) {
    const ratio = monthlyIncome / previousIncome
    const categories = await db.category.findMany({
      where: { userId: session.userId },
      select: { id: true, budgetAmount: true },
    })
    await Promise.all(
      categories.map((cat) =>
        db.category.update({
          where: { id: cat.id },
          data: { budgetAmount: Math.round(cat.budgetAmount * ratio * 100) / 100 },
        })
      )
    )
  }

  revalidatePath('/dashboard')
  revalidatePath('/budget')
  return { success: true }
}
