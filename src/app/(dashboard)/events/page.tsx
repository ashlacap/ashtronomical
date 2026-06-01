import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'
import { EventsClient } from '@/components/EventsClient'
import { getHouseholdMemberIds } from '@/app/actions/household'
import { subMonths } from 'date-fns'

export default async function EventsPage() {
  const session = await requireAuth()
  const memberIds = await getHouseholdMemberIds(session.userId)
  const shared = memberIds.length > 1

  const [events, transactions, members] = await Promise.all([
    // Event budgets across the whole household
    db.eventBudget.findMany({
      where: { userId: { in: memberIds } },
      orderBy: { createdAt: 'desc' },
      include: {
        transactions: {
          include: { transaction: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    }),
    db.transaction.findMany({
      where: {
        userId: session.userId,
        pending: false,
        amount: { gt: 0 },
        date: { gte: subMonths(new Date(), 12) },
      },
      orderBy: { date: 'desc' },
      take: 200,
    }),
    shared ? db.user.findMany({ where: { id: { in: memberIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ])

  const memberName = (id: string) => members.find((m) => m.id === id)?.name?.split(' ')[0] ?? null

  const serializedEvents = events.map((e) => ({
    id: e.id,
    name: e.name,
    emoji: e.emoji,
    color: e.color,
    totalBudget: e.totalBudget,
    eventDate: e.eventDate?.toISOString() ?? null,
    ownerName: shared && e.userId !== session.userId ? memberName(e.userId) : null,
    transactions: e.transactions.map((et) => ({
      id: et.transaction.id,
      name: et.transaction.name,
      merchantName: et.transaction.merchantName,
      amount: et.transaction.amount,
      date: et.transaction.date.toISOString(),
    })),
  }))

  const serializedTxns = transactions.map((t) => ({
    id: t.id,
    name: t.name,
    merchantName: t.merchantName,
    amount: t.amount,
    date: t.date.toISOString(),
  }))

  return <EventsClient initialEvents={serializedEvents} allTransactions={serializedTxns} />
}
