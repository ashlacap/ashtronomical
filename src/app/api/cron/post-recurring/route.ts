import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { postDueRecurring } from '@/app/actions/recurring'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const userIds = await db.user.findMany({ select: { id: true } })
  let total = 0
  for (const { id } of userIds) {
    total += await postDueRecurring(id)
  }

  return NextResponse.json({ ok: true, posted: total })
}
