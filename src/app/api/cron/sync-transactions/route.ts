import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { syncAllTransactionsForUser, categorizeExistingTransactions } from '@/app/actions/plaid'

// Daily backstop for autonomous transaction syncing. Plaid's webhook
// (see /api/plaid/webhook) syncs near-real-time as banks post new
// transactions; this cron catches anything a missed/failed webhook delivery
// left behind, and re-registers each item's webhook URL in case it was
// linked before webhook registration existed. Users never need to sync
// manually. Also backfills any transactions still sitting uncategorized
// (e.g. synced before auto-categorization existed) — kept out of page
// requests so it never blocks a page load.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const userIds = await db.user.findMany({ select: { id: true } })
  let totalSynced = 0
  let totalBackfilled = 0
  let usersWithErrors = 0

  for (const { id } of userIds) {
    try {
      totalSynced += await syncAllTransactionsForUser(id)
      totalBackfilled += await categorizeExistingTransactions(id)
    } catch (err) {
      usersWithErrors++
      console.error(`Sync failed for user ${id}:`, err)
    }
  }

  return NextResponse.json({
    ok: true,
    usersProcessed: userIds.length,
    usersWithErrors,
    transactionsSynced: totalSynced,
    transactionsBackfilled: totalBackfilled,
  })
}
