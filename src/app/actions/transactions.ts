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

export type DeletedFullTxn = {
  name: string
  merchantName: string | null
  amount: number
  date: string
  categoryId: string | null
  note: string | null
  isTransfer: boolean
  isManual: boolean
  plaidTransactionId: string | null
  plaidAccountId: string | null
  pending: boolean
} | null

/**
 * Deletes any transaction the user owns — manual or bank-synced. Synced
 * transactions also get their plaidTransactionId recorded as dismissed, so a
 * future sync (which otherwise re-creates anything Plaid still reports)
 * doesn't bring it back. Returns enough to restore it via the Undo toast.
 */
export async function deleteTransaction(transactionId: string): Promise<DeletedFullTxn> {
  const session = await requireAuth()
  const txn = await db.transaction.findFirst({
    where: { id: transactionId, userId: session.userId },
  })
  if (!txn) return null

  await db.$transaction([
    db.transaction.delete({ where: { id: txn.id } }),
    ...(txn.plaidTransactionId
      ? [
          db.dismissedTransaction.upsert({
            where: { userId_plaidTransactionId: { userId: session.userId, plaidTransactionId: txn.plaidTransactionId } },
            update: {},
            create: { userId: session.userId, plaidTransactionId: txn.plaidTransactionId },
          }),
        ]
      : []),
  ])

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
    isManual: txn.isManual,
    plaidTransactionId: txn.plaidTransactionId,
    plaidAccountId: txn.plaidAccountId,
    pending: txn.pending,
  }
}

/** Bulk version of deleteTransaction, for the Transactions list's multi-select bar. */
export async function bulkDeleteTransactions(transactionIds: string[]): Promise<number> {
  const session = await requireAuth()
  if (transactionIds.length === 0) return 0

  const txns = await db.transaction.findMany({
    where: { id: { in: transactionIds }, userId: session.userId },
    select: { id: true, plaidTransactionId: true },
  })
  if (txns.length === 0) return 0

  const plaidIds = txns.map((t) => t.plaidTransactionId).filter((id): id is string => !!id)

  await db.$transaction([
    db.transaction.deleteMany({ where: { id: { in: txns.map((t) => t.id) } } }),
    ...(plaidIds.length > 0
      ? [
          db.dismissedTransaction.createMany({
            data: plaidIds.map((plaidTransactionId) => ({ userId: session.userId, plaidTransactionId })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ])

  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  return txns.length
}

/** Undoes a single deleteTransaction — re-creates the row and clears the dismissal so future syncs work normally again. */
export async function restoreTransaction(data: NonNullable<DeletedFullTxn>): Promise<void> {
  const session = await requireAuth()

  await db.$transaction([
    db.transaction.create({
      data: {
        userId: session.userId,
        name: data.name,
        merchantName: data.merchantName,
        amount: data.amount,
        date: new Date(data.date),
        categoryId: data.categoryId,
        note: data.note,
        isTransfer: data.isTransfer,
        isManual: data.isManual,
        pending: data.pending,
        plaidTransactionId: data.plaidTransactionId,
        plaidAccountId: data.plaidAccountId,
      },
    }),
    ...(data.plaidTransactionId
      ? [
          db.dismissedTransaction.deleteMany({
            where: { userId: session.userId, plaidTransactionId: data.plaidTransactionId },
          }),
        ]
      : []),
  ])

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
