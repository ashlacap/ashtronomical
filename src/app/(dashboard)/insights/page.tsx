import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'
import { format, subMonths, startOfMonth, endOfMonth, startOfYear } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { SpendingTrendsChart } from '@/components/SpendingTrendsChart'
import { NetWorthChart } from '@/components/NetWorthChart'
import { RecurringBillsList } from '@/components/RecurringBillsList'
import { detectRecurringBills } from '@/lib/recurring'
import { buildInsights, type CategoryMonthSpend } from '@/lib/spending-insights'
import { getUserSettings } from '@/lib/user-settings'
import { formatCurrency } from '@/lib/currency'
import { NOT_EXCLUDED } from '@/lib/finance'
import { TrendingUp, TrendingDown, Sparkles } from 'lucide-react'

export default async function InsightsPage() {
  const session = await requireAuth()
  const { currency } = await getUserSettings()
  const fmt = (n: number) => formatCurrency(n, currency)
  const now = new Date()

  // Last 6 months range
  const sixMonthsAgo = startOfMonth(subMonths(now, 5))
  const yearStart = startOfYear(now)

  const [categories, transactions, snapshots, ytdExpenses, ytdIncome] = await Promise.all([
    db.category.findMany({ where: { userId: session.userId }, orderBy: { budgetAmount: 'desc' } }),
    db.transaction.findMany({
      where: { userId: session.userId, date: { gte: sixMonthsAgo }, pending: false, amount: { gt: 0 }, ...NOT_EXCLUDED },
      select: { categoryId: true, amount: true, date: true, name: true, merchantName: true, isKnownRecurring: true },
      orderBy: { date: 'asc' },
    }),
    db.balanceSnapshot.findMany({
      where: { userId: session.userId, date: { gte: sixMonthsAgo } },
      orderBy: { date: 'asc' },
    }),
    // YTD expenses by category
    db.transaction.findMany({
      where: { userId: session.userId, date: { gte: yearStart }, pending: false, isTransfer: false, amount: { gt: 0 }, ...NOT_EXCLUDED },
      select: { categoryId: true, amount: true },
    }),
    // YTD income (negative-amount transactions = money in)
    db.transaction.aggregate({
      where: { userId: session.userId, date: { gte: yearStart }, pending: false, isTransfer: false, amount: { lt: 0 }, ...NOT_EXCLUDED },
      _sum: { amount: true },
    }),
  ])

  // YTD calculations
  const ytdSpent = ytdExpenses.reduce((s, t) => s + t.amount, 0)
  const ytdIncomeTotal = Math.abs(ytdIncome._sum.amount ?? 0)
  const ytdSavingsRate = ytdIncomeTotal > 0 ? ((ytdIncomeTotal - ytdSpent) / ytdIncomeTotal) * 100 : 0
  const ytdByCat = new Map<string, number>()
  for (const t of ytdExpenses) {
    const key = t.categoryId ?? 'uncategorized'
    ytdByCat.set(key, (ytdByCat.get(key) ?? 0) + t.amount)
  }
  let ytdTopCatName = '—'
  let ytdTopCatAmount = 0
  for (const [catId, amount] of ytdByCat) {
    if (amount > ytdTopCatAmount) {
      ytdTopCatAmount = amount
      ytdTopCatName = categories.find((c) => c.id === catId)?.name ?? 'Uncategorized'
    }
  }

  // Build 6-month trend data
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i)
    return { key: format(d, 'yyyy-MM'), label: format(d, 'MMM yy'), start: startOfMonth(d), end: endOfMonth(d) }
  })

  const topCategories = categories.filter((c) => c.budgetAmount > 0).slice(0, 5)

  const trendData = months.map(({ label, start, end }) => {
    const monthTxns = transactions.filter((t) => t.date >= start && t.date <= end)
    const point: { month: string; [category: string]: number | string } = { month: label }
    for (const cat of topCategories) {
      point[cat.name] = monthTxns
        .filter((t) => t.categoryId === cat.id)
        .reduce((s, t) => s + t.amount, 0)
    }
    return point
  })

  // Monthly totals for summary
  const monthlySummary = months.map(({ label, start, end }) => {
    const monthTxns = transactions.filter((t) => t.date >= start && t.date <= end)
    const total = monthTxns.reduce((s, t) => s + t.amount, 0)
    return { label, total }
  })

  const avgMonthlySpend =
    monthlySummary.reduce((s, m) => s + m.total, 0) / Math.max(monthlySummary.length, 1)

  // Build per-category month-over-month data for anomaly insights
  const insightInput: CategoryMonthSpend[] = categories.map((cat) => {
    const perMonth = months.map(({ start, end }) =>
      transactions
        .filter((t) => t.categoryId === cat.id && t.date >= start && t.date <= end)
        .reduce((s, t) => s + t.amount, 0),
    )
    const thisMonth = perMonth[perMonth.length - 1]
    const priorMonths = perMonth.slice(0, -1)
    return { categoryId: cat.id, categoryName: cat.name, thisMonth, priorMonths }
  })
  const insights = buildInsights(insightInput, fmt)

  // Net worth chart data — one point per unique date
  const netWorthData = snapshots.reduce<{ date: string; balance: number }[]>((acc, s) => {
    const label = format(s.date, 'MMM d')
    const existing = acc.findIndex((p) => p.date === label)
    if (existing >= 0) {
      acc[existing].balance = s.balance
    } else {
      acc.push({ date: label, balance: s.balance })
    }
    return acc
  }, [])

  // Recurring bills
  const recurringBills = detectRecurringBills(
    transactions.map((t) => ({ name: t.name, merchantName: t.merchantName ?? null, amount: t.amount, date: t.date, isKnownRecurring: t.isKnownRecurring })),
  )

  const totalRecurring = recurringBills.reduce((s, b) => s + b.avgAmount, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Insights <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider ml-2 align-middle">Star Charts</span></h1>
        <p className="text-muted-foreground text-sm">Spending trends and patterns over the last 6 months</p>
      </div>

      {/* Year to date */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{format(now, 'yyyy')} — Year to Date</CardTitle>
          <CardDescription>Your financial picture since January 1</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Income</p>
              <p className="text-xl font-bold tabular-nums mt-1">{fmt(ytdIncomeTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Spent</p>
              <p className="text-xl font-bold tabular-nums mt-1">{fmt(ytdSpent)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Savings Rate</p>
              <p className="text-xl font-bold tabular-nums mt-1" style={{ color: ytdSavingsRate < 10 ? '#ef4444' : ytdSavingsRate < 20 ? '#f59e0b' : '#22c55e' }}>
                {ytdIncomeTotal > 0 ? `${Math.round(ytdSavingsRate)}%` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Top Category</p>
              <p className="text-xl font-bold mt-1 truncate">{ytdTopCatName}</p>
              <p className="text-xs text-muted-foreground">{fmt(ytdTopCatAmount)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Smart insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Insights</CardTitle>
            <CardDescription>How this month compares to your recent habits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {insights.map((ins) => {
              const Icon = ins.severity === 'warning' ? TrendingUp : ins.severity === 'positive' ? TrendingDown : Sparkles
              const color = ins.severity === 'warning' ? 'text-red-500' : ins.severity === 'positive' ? 'text-green-500' : 'text-blue-500'
              return (
                <div key={ins.id} className="flex items-start gap-3">
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
                  <div>
                    <p className="text-sm font-medium">{ins.title}</p>
                    <p className="text-xs text-muted-foreground">{ins.detail}</p>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Monthly summary strip */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {monthlySummary.map(({ label, total }) => (
          <Card key={label} className="text-center">
            <CardContent className="pt-4 pb-3 px-2">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-bold mt-1">{fmt(total)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Burn Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(avgMonthlySpend)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fixed Orbits / mo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(totalRecurring)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{recurringBills.length} subscriptions detected</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Free Fuel / mo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(Math.max(0, avgMonthlySpend - totalRecurring))}</p>
            <p className="text-xs text-muted-foreground mt-0.5">After recurring bills</p>
          </CardContent>
        </Card>
      </div>

      {/* Spending trends */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sector Trajectory</CardTitle>
          <CardDescription>Top {topCategories.length} sectors over the last 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          <SpendingTrendsChart
            data={trendData}
            categories={topCategories.map((c) => ({ name: c.name, color: c.color }))}
          />
        </CardContent>
      </Card>

      {/* Net worth over time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Net Worth Over Time</CardTitle>
          <CardDescription>Total station balance tracked across syncs</CardDescription>
        </CardHeader>
        <CardContent>
          <NetWorthChart data={netWorthData} />
        </CardContent>
      </Card>

      {/* All recurring bills */}
      {recurringBills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recurring Charges</CardTitle>
            <CardDescription>Charges that appear consistently — acknowledge the ones you recognize</CardDescription>
          </CardHeader>
          <CardContent>
            <RecurringBillsList
              bills={recurringBills.map((b) => ({
                merchant: b.merchant,
                displayName: b.displayName,
                avgAmount: b.avgAmount,
                monthsDetected: b.monthsDetected,
                lastDate: b.lastDate.toISOString(),
                isLikelyFixed: b.isLikelyFixed,
                isKnown: b.isKnown,
              }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
