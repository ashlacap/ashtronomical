'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

const DebtSchema = z.object({
  name: z.string().min(1, { error: 'Name is required.' }).trim(),
  balance: z.coerce.number().min(0, { error: 'Balance must be 0 or more.' }),
  interestRate: z.coerce.number().min(0).max(100, { error: 'Rate must be between 0 and 100.' }),
  minimumPayment: z.coerce.number().min(0, { error: 'Payment must be 0 or more.' }),
  type: z.enum(['credit', 'student', 'auto', 'mortgage', 'personal', 'other']),
})

export type DebtState = {
  errors?: Record<string, string[]>
  message?: string
  success?: boolean
} | undefined

export async function createDebt(state: DebtState, formData: FormData): Promise<DebtState> {
  const session = await requireAuth()
  const result = DebtSchema.safeParse({
    name: formData.get('name'),
    balance: formData.get('balance'),
    interestRate: formData.get('interestRate'),
    minimumPayment: formData.get('minimumPayment'),
    type: formData.get('type'),
  })
  if (!result.success) return { errors: result.error.flatten().fieldErrors as Record<string, string[]> }

  // Optionally link this debt to a connected Plaid credit/loan account
  const plaidAccountId = (formData.get('plaidAccountId') as string) || null

  await db.debt.create({ data: { userId: session.userId, ...result.data, plaidAccountId } })
  revalidatePath('/debt')
  revalidatePath('/dashboard')
  revalidatePath('/accounts')
  return { success: true }
}

export async function updateDebt(debtId: string, state: DebtState, formData: FormData): Promise<DebtState> {
  const session = await requireAuth()
  const result = DebtSchema.safeParse({
    name: formData.get('name'),
    balance: formData.get('balance'),
    interestRate: formData.get('interestRate'),
    minimumPayment: formData.get('minimumPayment'),
    type: formData.get('type'),
  })
  if (!result.success) return { errors: result.error.flatten().fieldErrors as Record<string, string[]> }

  const debt = await db.debt.findFirst({ where: { id: debtId, userId: session.userId } })
  if (!debt) return { message: 'Debt not found.' }

  await db.debt.update({ where: { id: debtId }, data: result.data })
  revalidatePath('/debt')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteDebt(debtId: string): Promise<void> {
  const session = await requireAuth()
  const debt = await db.debt.findFirst({ where: { id: debtId, userId: session.userId } })
  if (!debt) return
  await db.debt.delete({ where: { id: debtId } })
  revalidatePath('/debt')
  revalidatePath('/dashboard')
}
