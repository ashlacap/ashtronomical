'use server'

import { revalidatePath } from 'next/cache'
import { CountryCode, Products } from 'plaid'
import { plaidClient } from '@/lib/plaid'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { guessCategory } from '@/lib/categorize'
import { encryptSecret, decryptSecret } from '@/lib/crypto'

export async function createLinkToken(): Promise<string> {
  const session = await requireAuth()

  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: session.userId },
    client_name: 'Clearflow',
    products: [Products.Transactions],
    language: 'en',
    country_codes: [CountryCode.Us],
  })

  return response.data.link_token
}

export async function exchangeToken(
  publicToken: string,
  institutionName: string | null,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAuth()

  try {
    const exchangeRes = await plaidClient.itemPublicTokenExchange({ public_token: publicToken })
    const accessToken = exchangeRes.data.access_token
    const itemId = exchangeRes.data.item_id

    const itemRes = await plaidClient.itemGet({ access_token: accessToken })
    const institutionId = itemRes.data.item.institution_id

    const bankAccount = await db.bankAccount.create({
      data: {
        userId: session.userId,
        plaidItemId: itemId,
        plaidAccessToken: encryptSecret(accessToken),
        institutionName: institutionName ?? undefined,
        institutionId: institutionId ?? undefined,
      },
    })

    const accountsRes = await plaidClient.accountsGet({ access_token: accessToken })
    await db.plaidAccount.createMany({
      data: accountsRes.data.accounts.map((a) => ({
        bankAccountId: bankAccount.id,
        plaidAccountId: a.account_id,
        name: a.name,
        mask: a.mask ?? undefined,
        type: a.type,
        subtype: a.subtype ?? undefined,
        currentBalance: a.balances.current ?? undefined,
        availableBalance: a.balances.available ?? undefined,
      })),
    })

    await syncTransactionsForAccount(session.userId, bankAccount.id, accessToken)

    revalidatePath('/dashboard')
    revalidatePath('/accounts')
    revalidatePath('/transactions')
    return { success: true }
  } catch (err) {
    console.error('Plaid exchange error:', err)
    return { success: false, error: 'Failed to connect account. Please try again.' }
  }
}

export async function syncAllTransactions(_formData?: FormData): Promise<void> {
  const session = await requireAuth()
  const accounts = await db.bankAccount.findMany({ where: { userId: session.userId } })
  let totalSynced = 0

  for (const account of accounts) {
    totalSynced += await syncTransactionsForAccount(
      session.userId,
      account.id,
      decryptSecret(account.plaidAccessToken),
    )
  }

  revalidatePath('/dashboard')
  revalidatePath('/transactions')
}

async function syncTransactionsForAccount(
  userId: string,
  bankAccountId: string,
  accessToken: string,
): Promise<number> {
  const bankAccount = await db.bankAccount.findUnique({ where: { id: bankAccountId } })
  const userCategories = await db.category.findMany({ where: { userId } })

  let cursor = bankAccount?.cursor ?? undefined
  let added = 0
  let hasMore = true

  while (hasMore) {
    const res = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor,
    })

    const data = res.data

    for (const txn of data.added) {
      const categoryId = guessCategory(txn.name, txn.merchant_name, userCategories)
      await db.transaction.upsert({
        where: { plaidTransactionId: txn.transaction_id },
        update: {
          name: txn.name,
          merchantName: txn.merchant_name ?? undefined,
          amount: txn.amount,
          pending: txn.pending,
          categoryId,
        },
        create: {
          userId,
          plaidAccountId: txn.account_id,
          plaidTransactionId: txn.transaction_id,
          name: txn.name,
          merchantName: txn.merchant_name ?? undefined,
          amount: txn.amount,
          date: new Date(txn.date),
          pending: txn.pending,
          categoryId,
        },
      })
      added++
    }

    for (const txn of data.modified) {
      const categoryId = guessCategory(txn.name, txn.merchant_name, userCategories)
      await db.transaction.updateMany({
        where: { plaidTransactionId: txn.transaction_id },
        data: {
          name: txn.name,
          merchantName: txn.merchant_name ?? undefined,
          amount: txn.amount,
          pending: txn.pending,
          categoryId,
        },
      })
    }

    for (const txn of data.removed) {
      await db.transaction.deleteMany({
        where: { plaidTransactionId: txn.transaction_id ?? '' },
      })
    }

    cursor = data.next_cursor
    hasMore = data.has_more
  }

  await db.bankAccount.update({
    where: { id: bankAccountId },
    data: { cursor },
  })

  // Snapshot total balance for net worth tracking
  const accounts = await db.plaidAccount.findMany({ where: { bankAccountId } })
  const totalBalance = accounts.reduce((s, a) => s + (a.currentBalance ?? 0), 0)
  await db.balanceSnapshot.create({
    data: { userId, balance: totalBalance },
  })

  return added
}

export async function disconnectAccount(bankAccountId: string): Promise<void> {
  const session = await requireAuth()
  const account = await db.bankAccount.findFirst({
    where: { id: bankAccountId, userId: session.userId },
  })
  if (!account) return

  try {
    await plaidClient.itemRemove({ access_token: decryptSecret(account.plaidAccessToken) })
  } catch {
    // Proceed with local removal even if Plaid call fails
  }

  await db.bankAccount.delete({ where: { id: bankAccountId } })

  revalidatePath('/accounts')
  revalidatePath('/dashboard')
}
