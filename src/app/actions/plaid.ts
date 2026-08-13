'use server'

import { revalidatePath } from 'next/cache'
import { CountryCode, Products } from 'plaid'
import { plaidClient } from '@/lib/plaid'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { categorizeTransactions } from '@/lib/ai-categorize'
import { encryptSecret, decryptSecret } from '@/lib/crypto'

export async function createLinkToken(): Promise<string> {
  const session = await requireAuth()

  // Required for OAuth banks (Bank of America, USAA, Chase, etc.). Must exactly
  // match a redirect URI registered in the Plaid dashboard. Omitted when unset
  // (sandbox / non-OAuth banks work without it).
  const redirectUri = process.env.PLAID_REDIRECT_URI

  // Tells Plaid where to POST transaction-update notifications so new
  // transactions sync automatically without the user ever clicking "Sync".
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL
  const webhookUrl = appUrl ? `${appUrl.replace(/\/$/, '')}/api/plaid/webhook` : undefined

  const baseParams = {
    user: { client_user_id: session.userId },
    client_name: 'Ashtronomical',
    products: [Products.Transactions],
    language: 'en',
    country_codes: [CountryCode.Us],
    ...(webhookUrl ? { webhook: webhookUrl } : {}),
  }

  try {
    const response = await plaidClient.linkTokenCreate({
      ...baseParams,
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
    })
    return response.data.link_token
  } catch (err) {
    // A misregistered redirect_uri (mismatched with the Plaid dashboard)
    // makes Plaid reject the whole request. Retry without it rather than
    // breaking bank linking entirely — OAuth banks just won't work until
    // the mismatch is fixed, but everything else still can.
    if (redirectUri) {
      console.error('linkTokenCreate failed with redirect_uri set, retrying without it:', err)
      const response = await plaidClient.linkTokenCreate(baseParams)
      return response.data.link_token
    }
    throw err
  }
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

/**
 * Syncs every linked bank account for a single user. Used by the daily cron
 * backstop (and internally after linking a new account) — there is no
 * user-facing manual sync anymore; Plaid's webhook plus this cron job keep
 * transactions current automatically.
 */
export async function syncAllTransactionsForUser(userId: string): Promise<number> {
  const accounts = await db.bankAccount.findMany({ where: { userId } })
  let totalSynced = 0

  for (const account of accounts) {
    const accessToken = decryptSecret(account.plaidAccessToken)
    await ensureWebhookRegistered(accessToken)
    totalSynced += await syncTransactionsForAccount(userId, account.id, accessToken)
  }

  return totalSynced
}

/**
 * Points an already-linked Plaid item at our webhook, in case it was linked
 * before webhook registration existed (or the URL changed). Safe to call
 * repeatedly — Plaid just overwrites the stored webhook URL.
 */
export async function ensureWebhookRegistered(accessToken: string): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL
  if (!appUrl) return
  const webhookUrl = `${appUrl.replace(/\/$/, '')}/api/plaid/webhook`
  try {
    await plaidClient.itemWebhookUpdate({ access_token: accessToken, webhook: webhookUrl })
  } catch (err) {
    console.error('Failed to register Plaid webhook:', err)
  }
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

    const categoryIds = await categorizeTransactions(
      [...data.added, ...data.modified].map((t) => ({
        id: t.transaction_id,
        name: t.name,
        merchantName: t.merchant_name,
      })),
      userCategories,
    )

    for (const txn of data.added) {
      const categoryId = categoryIds.get(txn.transaction_id) ?? null
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
      const categoryId = categoryIds.get(txn.transaction_id) ?? null
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
    include: { plaidAccounts: { select: { plaidAccountId: true } } },
  })
  if (!account) return

  try {
    await plaidClient.itemRemove({ access_token: decryptSecret(account.plaidAccessToken) })
  } catch {
    // Proceed with local removal even if Plaid call fails
  }

  // Delete this account's transaction history too — otherwise a later
  // reconnect runs a full historical sync again and duplicates everything,
  // since Plaid transaction IDs aren't guaranteed stable across re-links.
  const plaidAccountIds = account.plaidAccounts.map((a) => a.plaidAccountId)
  if (plaidAccountIds.length > 0) {
    await db.transaction.deleteMany({
      where: { userId: session.userId, plaidAccountId: { in: plaidAccountIds } },
    })
  }

  await db.bankAccount.delete({ where: { id: bankAccountId } })

  revalidatePath('/accounts')
  revalidatePath('/dashboard')
  revalidatePath('/transactions')
}

/**
 * Excludes/includes a single Plaid sub-account (e.g. one of two checking
 * accounts under the same bank connection) from balance and spending totals,
 * without disconnecting the whole bank item. The account keeps syncing so its
 * balance stays current if it's ever re-included.
 */
export async function setPlaidAccountExcluded(plaidAccountRowId: string, excluded: boolean): Promise<void> {
  const session = await requireAuth()
  const account = await db.plaidAccount.findFirst({
    where: { id: plaidAccountRowId, bankAccount: { userId: session.userId } },
  })
  if (!account) return

  await db.plaidAccount.update({ where: { id: plaidAccountRowId }, data: { excluded } })

  revalidatePath('/accounts')
  revalidatePath('/dashboard')
  revalidatePath('/transactions')
}

const BACKFILL_BATCH_SIZE = 60
const BACKFILL_MAX_BATCHES = 5 // caps a single run at 300 transactions

/**
 * Catches transactions that were synced before auto-categorization existed
 * (or before a category/keyword was added) and are still sitting uncategorized.
 * Runs silently — no button, no indication anything "AI" touched them; they
 * just show up categorized, same as ones that arrive via sync. Batched small
 * so each Claude call stays fast and well under its output token budget.
 */
export async function categorizeExistingTransactions(userId: string): Promise<number> {
  const userCategories = await db.category.findMany({ where: { userId } })
  if (userCategories.length === 0) return 0

  let updated = 0

  for (let batch = 0; batch < BACKFILL_MAX_BATCHES; batch++) {
    const uncategorized = await db.transaction.findMany({
      where: { userId, categoryId: null, isTransfer: false },
      select: { id: true, name: true, merchantName: true },
      take: BACKFILL_BATCH_SIZE,
    })
    if (uncategorized.length === 0) break

    const categoryIds = await categorizeTransactions(
      uncategorized.map((t) => ({ id: t.id, name: t.name, merchantName: t.merchantName })),
      userCategories,
    )

    for (const txn of uncategorized) {
      const categoryId = categoryIds.get(txn.id) ?? null
      if (categoryId) {
        await db.transaction.update({ where: { id: txn.id }, data: { categoryId } })
        updated++
      }
    }

    // Fewer than a full page means we've drained the backlog.
    if (uncategorized.length < BACKFILL_BATCH_SIZE) break
  }

  return updated
}
