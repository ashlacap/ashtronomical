import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { TransactionList } from '@/components/TransactionList'
import { RecurringManager } from '@/components/RecurringManager'
import { ImportCsv } from '@/components/ImportCsv'
import { getUserSettings } from '@/lib/user-settings'

const PAGE_SIZE = 25

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; categoryId?: string; search?: string; page?: string; from?: string; to?: string }>
}) {
  const session = await requireAuth()
  const params = await searchParams

  const now = new Date()
  const targetDate = params.month ? new Date(params.month + '-01') : now

  // Custom date range overrides month selection
  const useCustomRange = !!(params.from && params.to)
  const rangeStart = useCustomRange ? new Date(params.from + 'T00:00:00') : startOfMonth(targetDate)
  const rangeEnd = useCustomRange ? new Date(params.to + 'T23:59:59') : endOfMonth(targetDate)

  const page = Math.max(1, parseInt(params.page ?? '1'))
  const search = params.search?.trim() ?? ''

  // Handle special "uncategorized" filter
  const categoryFilter =
    params.categoryId === 'uncategorized'
      ? { categoryId: null }
      : params.categoryId
      ? { categoryId: params.categoryId }
      : {}

  const where = {
    userId: session.userId,
    date: { gte: rangeStart, lte: rangeEnd },
    ...categoryFilter,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { merchantName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const settings = await getUserSettings()

  const [transactions, total, categories, pendingTxns, uncategorizedCount, recurringRules, periodSpendTxns] = await Promise.all([
    db.transaction.findMany({
      where,
      include: { category: true },
      orderBy: { date: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.transaction.count({ where }),
    db.category.findMany({ where: { userId: session.userId }, orderBy: { name: 'asc' } }),
    // Pending in range (for display)
    db.transaction.findMany({
      where: { userId: session.userId, date: { gte: rangeStart, lte: rangeEnd }, pending: true, amount: { gt: 0 } },
      select: { amount: true },
    }),
    // Uncategorized non-transfer transactions in range (expenses and credits)
    db.transaction.count({
      where: {
        userId: session.userId,
        date: { gte: rangeStart, lte: rangeEnd },
        categoryId: null,
        isTransfer: false,
        pending: false,
      },
    }),
    // Recurring rules with category names
    db.recurringTransaction.findMany({
      where: { userId: session.userId },
      orderBy: { dayOfMonth: 'asc' },
    }),
    // All spend in range, for the remaining-budget strip (independent of filters/pagination)
    db.transaction.findMany({
      where: { userId: session.userId, date: { gte: rangeStart, lte: rangeEnd }, pending: false, isTransfer: false, amount: { gt: 0 } },
      select: { categoryId: true, amount: true },
    }),
  ])

  const pendingTotal = pendingTxns.reduce((s, t) => s + t.amount, 0)

  // Remaining budget per category for the selected period — same math as the
  // dashboard, minus rollover (that's month-specific and this can be a custom range).
  const spendByCategory = new Map<string, number>()
  for (const t of periodSpendTxns) {
    if (t.categoryId) spendByCategory.set(t.categoryId, (spendByCategory.get(t.categoryId) ?? 0) + t.amount)
  }
  const categoryBudgets = categories
    .filter((c) => c.budgetAmount > 0)
    .map((c) => {
      const spent = spendByCategory.get(c.id) ?? 0
      const pct = (spent / c.budgetAmount) * 100
      return {
        id: c.id,
        name: c.name,
        color: c.color,
        budget: c.budgetAmount,
        spent,
        remaining: c.budgetAmount - spent,
        pct,
        overBudget: spent > c.budgetAmount,
        nearBudget: spent <= c.budgetAmount && pct >= settings.alertThreshold,
      }
    })

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, i)
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') }
  })

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider ml-2 align-middle">Transmissions</span></h1>
          <p className="text-muted-foreground text-sm">
            {useCustomRange
              ? `${format(rangeStart, 'MMM d, yyyy')} – ${format(rangeEnd, 'MMM d, yyyy')}`
              : format(targetDate, 'MMMM yyyy')}
          </p>
        </div>
        <div className="flex gap-2">
          <ImportCsv />
          <RecurringManager
            rules={recurringRules.map((r) => ({
              id: r.id,
              name: r.name,
              amount: r.amount,
              dayOfMonth: r.dayOfMonth,
              categoryName: categories.find((c) => c.id === r.categoryId)?.name ?? null,
              isTransfer: r.isTransfer,
              active: r.active,
            }))}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          />
        </div>
      </div>

      <TransactionList
        transactions={transactions.map((t) => ({
          id: t.id,
          name: t.name,
          merchantName: t.merchantName,
          amount: t.amount,
          date: t.date.toISOString(),
          pending: t.pending,
          isTransfer: t.isTransfer,
          isManual: t.isManual,
          note: t.note,
          categoryId: t.categoryId,
          categoryName: t.category?.name ?? null,
          categoryColor: t.category?.color ?? null,
        }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name, color: c.color, keywords: c.keywords }))}
        months={months}
        selectedMonth={params.month ?? format(now, 'yyyy-MM')}
        selectedCategoryId={params.categoryId}
        search={search}
        page={page}
        totalPages={totalPages}
        total={total}
        pendingTotal={pendingTotal}
        uncategorizedCount={uncategorizedCount}
        rangeFrom={params.from}
        rangeTo={params.to}
        categoryBudgets={categoryBudgets}
      />
    </div>
  )
}
