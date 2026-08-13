import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { NOT_EXCLUDED } from '@/lib/finance'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session?.userId) return new Response('Unauthorized', { status: 401 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') ?? format(new Date(), 'yyyy-MM')
  const categoryId = searchParams.get('categoryId')

  const targetDate = new Date(month + '-01')
  const monthStart = startOfMonth(targetDate)
  const monthEnd = endOfMonth(targetDate)

  const transactions = await db.transaction.findMany({
    where: {
      userId: session.userId,
      date: { gte: monthStart, lte: monthEnd },
      ...(categoryId ? { categoryId } : {}),
      ...NOT_EXCLUDED,
    },
    include: { category: true },
    orderBy: { date: 'desc' },
  })

  const rows = [
    ['Date', 'Merchant', 'Name', 'Amount', 'Category', 'Pending'],
    ...transactions.map((t) => [
      format(t.date, 'yyyy-MM-dd'),
      t.merchantName ?? '',
      t.name,
      t.amount.toFixed(2),
      t.category?.name ?? 'Uncategorized',
      t.pending ? 'Yes' : 'No',
    ]),
  ]

  const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="clearflow-${month}.csv"`,
    },
  })
}
