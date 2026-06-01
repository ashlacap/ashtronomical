import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { plaidClient } from '@/lib/plaid'
import { guessCategory } from '@/lib/categorize'
import { decryptSecret } from '@/lib/crypto'

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const webhookType = body['webhook_type'] as string | undefined
  const webhookCode = body['webhook_code'] as string | undefined
  const itemId = body['item_id'] as string | undefined

  if (!itemId) {
    return NextResponse.json({ error: 'Missing item_id' }, { status: 400 })
  }

  // Only handle transaction sync webhooks
  if (
    webhookType !== 'TRANSACTIONS' ||
    (webhookCode !== 'SYNC_UPDATES_AVAILABLE' && webhookCode !== 'INITIAL_UPDATE' && webhookCode !== 'DEFAULT_UPDATE')
  ) {
    return NextResponse.json({ received: true })
  }

  const bankAccount = await db.bankAccount.findUnique({ where: { plaidItemId: itemId } })
  if (!bankAccount) {
    return NextResponse.json({ error: 'Bank account not found' }, { status: 404 })
  }

  const userCategories = await db.category.findMany({ where: { userId: bankAccount.userId } })

  let cursor = bankAccount.cursor ?? undefined
  let hasMore = true

  while (hasMore) {
    const res = await plaidClient.transactionsSync({
      access_token: decryptSecret(bankAccount.plaidAccessToken),
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
          userId: bankAccount.userId,
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
    where: { id: bankAccount.id },
    data: { cursor },
  })

  // Snapshot current balance
  const plaidAccounts = await db.plaidAccount.findMany({ where: { bankAccountId: bankAccount.id } })
  const totalBalance = plaidAccounts.reduce((s, a) => s + (a.currentBalance ?? 0), 0)
  await db.balanceSnapshot.create({
    data: { userId: bankAccount.userId, balance: totalBalance },
  })

  return NextResponse.json({ received: true })
}
