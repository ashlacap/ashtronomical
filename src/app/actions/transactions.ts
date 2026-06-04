'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { guessCategory } from '@/lib/categorize'

export async function updateTransactionCategory(
  transactionId: string,
  categoryId: string | null,
): Promise<void> {
  const session = await requireAuth()
  await db.transaction.updateMany({
    where: { id: transactionId, userId: session.userId },
    data: { categoryId },
  })
  revalidatePath('/transactions')
  revalidatePath('/dashboard')
}

export async function bulkUpdateCategory(
  transactionIds: string[],
  categoryId: string | null,
): Promise<void> {
  const session = await requireAuth()
  await db.transaction.updateMany({
    where: { id: { in: transactionIds }, userId: session.userId },
    data: { categoryId },
  })
  revalidatePath('/transactions')
  revalidatePath('/dashboard')
}

export async function markAsTransfer(
  transactionId: string,
  isTransfer: boolean,
): Promise<void> {
  const session = await requireAuth()
  await db.transaction.updateMany({
    where: { id: transactionId, userId: session.userId },
    data: { isTransfer },
  })
  revalidatePath('/transactions')
  revalidatePath('/dashboard')
}

export async function setTransactionNote(
  transactionId: string,
  note: string,
): Promise<void> {
  const session = await requireAuth()
  await db.transaction.updateMany({
    where: { id: transactionId, userId: session.userId },
    data: { note: note.trim() || null },
  })
  revalidatePath('/transactions')
}

export async function markKnownRecurring(
  transactionName: string,
  merchantName: string | null,
  isKnown: boolean,
): Promise<void> {
  const session = await requireAuth()
  // Flag all transactions matching this merchant/name so the recurring detector knows
  await db.transaction.updateMany({
    where: {
      userId: session.userId,
      ...(merchantName
        ? { merchantName: { equals: merchantName, mode: 'insensitive' } }
        : { name: { equals: transactionName, mode: 'insensitive' } }),
    },
    data: { isKnownRecurring: isKnown },
  })
  revalidatePath('/insights')
}

const ManualTransactionSchema = z.object({
  name: z.string().min(1, { error: 'Description is required.' }).trim(),
  amount: z.coerce.number({ error: 'Amount must be a number.' }),
  date: z.string().min(1, { error: 'Date is required.' }),
  categoryId: z.string().optional(),
  isTransfer: z.string().optional(),
})

export type ManualTxnState = {
  errors?: Record<string, string[]>
  message?: string
  success?: boolean
} | undefined

export async function createManualTransaction(
  state: ManualTxnState,
  formData: FormData,
): Promise<ManualTxnState> {
  const session = await requireAuth()

  const result = ManualTransactionSchema.safeParse({
    name: formData.get('name'),
    amount: formData.get('amount'),
    date: formData.get('date'),
    categoryId: formData.get('categoryId') || undefined,
    isTransfer: formData.get('isTransfer') || undefined,
  })

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const { name, amount, date, categoryId, isTransfer } = result.data

  // Positive amount = expense, negative = income (matches Plaid convention)
  await db.transaction.create({
    data: {
      userId: session.userId,
      name,
      amount,
      date: new Date(date),
      categoryId: categoryId ?? null,
      isManual: true,
      isTransfer: isTransfer === 'true',
      pending: false,
    },
  })

  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  return { success: true }
}

export type DeletedTxn = {
  name: string
  merchantName: string | null
  amount: number
  date: string
  categoryId: string | null
  note: string | null
  isTransfer: boolean
} | null

export async function deleteManualTransaction(transactionId: string): Promise<DeletedTxn> {
  const session = await requireAuth()
  const txn = await db.transaction.findFirst({
    where: { id: transactionId, userId: session.userId, isManual: true },
  })
  if (!txn) return null

  await db.transaction.delete({ where: { id: txn.id } })
  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  return {
    name: txn.name,
    merchantName: txn.merchantName,
    amount: txn.amount,
    date: txn.date.toISOString(),
    categoryId: txn.categoryId,
    note: txn.note,
    isTransfer: txn.isTransfer,
  }
}

export async function restoreManualTransaction(data: NonNullable<DeletedTxn>): Promise<void> {
  const session = await requireAuth()
  await db.transaction.create({
    data: {
      userId: session.userId,
      name: data.name,
      merchantName: data.merchantName,
      amount: data.amount,
      date: new Date(data.date),
      categoryId: data.categoryId,
      note: data.note,
      isTransfer: data.isTransfer,
      isManual: true,
      pending: false,
    },
  })
  revalidatePath('/transactions')
  revalidatePath('/dashboard')
}

const ImportRowSchema = z.object({
  date: z.string().min(1),
  name: z.string().min(1),
  amount: z.coerce.number(),
})

export type ImportResult = { imported: number; skipped: number; error?: string }

export async function importTransactions(
  rows: { date: string; name: string; amount: number }[],
): Promise<ImportResult> {
  const session = await requireAuth()
  if (!Array.isArray(rows) || rows.length === 0) return { imported: 0, skipped: 0, error: 'No rows to import.' }
  if (rows.length > 2000) return { imported: 0, skipped: 0, error: 'Too many rows (max 2000).' }

  // Auto-categorize using the user's existing categories
  const categories = await db.category.findMany({
    where: { userId: session.userId },
    select: { id: true, name: true, keywords: true },
  })

  let imported = 0
  let skipped = 0

  for (const raw of rows) {
    const parsed = ImportRowSchema.safeParse(raw)
    if (!parsed.success) { skipped++; continue }
    const { date, name, amount } = parsed.data
    const when = new Date(date)
    if (isNaN(when.getTime())) { skipped++; continue }

    const categoryId = guessCategory(name, null, categories)
    await db.transaction.create({
      data: {
        userId: session.userId,
        name,
        amount,
        date: when,
        categoryId,
        isManual: true,
        pending: false,
      },
    })
    imported++
  }

  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  return { imported, skipped }
}
