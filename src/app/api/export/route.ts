import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { format } from 'date-fns'

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = row[h]
        if (val === null || val === undefined) return ''
        const str = String(val)
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      }).join(',')
    ),
  ]
  return lines.join('\n')
}

export async function GET() {
  const session = await getSession()
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [transactions, categories, goals, budgets] = await Promise.all([
    db.transaction.findMany({
      where: { userId: session.userId },
      include: { category: true },
      orderBy: { date: 'desc' },
    }),
    db.category.findMany({ where: { userId: session.userId }, orderBy: { name: 'asc' } }),
    db.savingsGoal.findMany({ where: { userId: session.userId } }),
    db.budget.findMany({ where: { userId: session.userId }, orderBy: { year: 'desc' } }),
  ])

  const txnCSV = toCSV(transactions.map((t) => ({
    date: format(t.date, 'yyyy-MM-dd'),
    name: t.name,
    merchant: t.merchantName ?? '',
    amount: t.amount,
    category: t.category?.name ?? '',
    pending: t.pending,
    transfer: t.isTransfer,
    manual: t.isManual,
  })))

  const catCSV = toCSV(categories.map((c) => ({
    name: c.name,
    budgetAmount: c.budgetAmount,
    color: c.color,
    rollover: c.rollover,
    keywords: c.keywords.join('; '),
  })))

  const goalCSV = toCSV(goals.map((g) => ({
    name: g.name,
    emoji: g.emoji,
    targetAmount: g.targetAmount,
    currentAmount: g.currentAmount,
    targetDate: g.targetDate ? format(g.targetDate, 'yyyy-MM-dd') : '',
  })))

  const budgetCSV = toCSV(budgets.map((b) => ({
    year: b.year,
    month: b.month,
    monthlyIncome: b.monthlyIncome,
  })))

  const boundary = 'AshtroExport'
  const exportDate = format(new Date(), 'yyyy-MM-dd')

  const body = [
    `=== TRANSACTIONS (${exportDate}) ===`,
    txnCSV,
    '',
    `=== BUDGET CATEGORIES ===`,
    catCSV,
    '',
    `=== SAVINGS GOALS ===`,
    goalCSV,
    '',
    `=== MONTHLY BUDGETS ===`,
    budgetCSV,
  ].join('\n')

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="ashtronomical-export-${exportDate}.csv"`,
    },
  })
}
