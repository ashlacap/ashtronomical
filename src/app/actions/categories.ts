'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

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
): Promise<void> {
  const session = await requireAuth()
  const cat = await db.category.findFirst({
    where: { id: categoryId, userId: session.userId },
    include: { savingsGoal: true },
  })
  if (!cat?.savingsGoal) return

  await db.savingsGoal.update({
    where: { id: cat.savingsGoal.id },
    data: {
      currentAmount: {
        increment: amount,
      },
    },
  })

  revalidatePath('/dashboard')
  revalidatePath('/goals')
}
