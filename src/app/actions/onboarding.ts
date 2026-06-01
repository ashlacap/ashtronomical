'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAuth, createSession } from '@/lib/session'
import { PLANS } from '@/lib/plans'

const OnboardingSchema = z.object({
  planId: z.enum(['50-30-20', '70-20-10', '60-30-10', 'custom']),
  monthlyIncome: z.coerce.number().positive(),
})

export type OnboardingState = {
  errors?: Record<string, string[]>
  message?: string
  success?: boolean
} | undefined

export async function completeOnboarding(
  state: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const session = await requireAuth()

  const result = OnboardingSchema.safeParse({
    planId: formData.get('planId'),
    monthlyIncome: formData.get('monthlyIncome'),
  })

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const { planId, monthlyIncome } = result.data
  const now = new Date()

  // Create budget for current month
  await db.budget.upsert({
    where: { userId_month_year: { userId: session.userId, month: now.getMonth() + 1, year: now.getFullYear() } },
    update: { monthlyIncome },
    create: { userId: session.userId, monthlyIncome, month: now.getMonth() + 1, year: now.getFullYear() },
  })

  // Create categories if a preset plan was selected
  if (planId !== 'custom') {
    const plan = PLANS[planId]
    await db.category.createMany({
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
  }

  // Mark onboarding complete and refresh session
  await db.user.update({
    where: { id: session.userId },
    data: { onboardingComplete: true },
  })
  await createSession(session.userId, true)

  revalidatePath('/dashboard')
  revalidatePath('/budget')
  return { success: true }
}
