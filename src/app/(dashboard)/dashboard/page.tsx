import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'
import { format, subMonths } from 'date-fns'
import Link from 'next/link'
import { ArrowRight, AlertTriangle, Calendar, Zap, Flame, Vault, Orbit, Tag, TrendingUp, ShieldCheck, CheckCircle2, Circle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PlaidLinkButton } from '@/components/PlaidLinkButton'
import { SpendingChart } from '@/components/SpendingChart'
import { MonthSelector } from '@/components/MonthSelector'
import { AnimatedNumber } from '@/components/AnimatedNumber'
import { cn } from '@/lib/utils'
import { detectRecurringBills } from '@/lib/recurring'
import { getUserSettings } from '@/lib/user-settings'
import { formatCurrency } from '@/lib/currency'
import { postDueRecurring } from '@/app/actions/recurring'
import { getDebtTotals } from '@/lib/finance'
import type { Category, Transaction } from '@/generated/prisma/client'

type TxnWithCat = Transaction & { category: Category | null }

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const session = await requireAuth()
  // Materialize any due recurring transactions (idempotent; cron also does this in prod)
  await postDueRecurring(session.userId)
  const params = await searchParams
  const settings = await getUserSettings()
  const { currency, alertThreshold, budgetStartDay } = settings
  const fmt = (n: number) => formatCurrency(n, currency)

  const now = new Date()
  const selectedMonth = params.month ?? format(now, 'yyyy-MM')
  const [yr, mo] = selectedMonth.split('-').map(Number)

  // Budget period honoring the user's start day
  const periodStart = new Date(yr, mo - 1, budgetStartDay, 0, 0, 0, 0)
  const periodEnd = new Date(yr, mo, budgetStartDay - 1, 23, 59, 59, 999)
  const prevPeriodStart = new Date(yr, mo - 2, budgetStartDay, 0, 0, 0, 0)
  const prevPeriodEnd = new Date(yr, mo - 1, budgetStartDay - 1, 23, 59, 59, 999)
  const threeMonthsAgo = subMonths(periodStart, 3)

  const periodLabel = budgetStartDay === 1
    ? format(periodStart, 'MMMM yyyy')
    : `${format(periodStart, 'MMM d')} – ${format(periodEnd, 'MMM d')}`

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(now, i)
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') }
  })

  const [user, budget, categories, transactions, pendingTxns, allRecentTxns, bankAccounts, goals, prevMonthTxns, savedAgg, debtTotals] =
    await Promise.all([
      db.user.findUnique({ where: { id: session.userId }, select: { name: true } }),
      db.budget.findFirst({
        where: { userId: session.userId, month: mo, year: yr },
      }),
      db.category.findMany({ where: { userId: session.userId }, orderBy: { name: 'asc' } }),
      db.transaction.findMany({
        where: { userId: session.userId, date: { gte: periodStart, lte: periodEnd }, pending: false, isTransfer: false },
        include: { category: true },
        orderBy: { date: 'desc' },
      }) as Promise<TxnWithCat[]>,
      db.transaction.findMany({
        where: { userId: session.userId, date: { gte: periodStart, lte: periodEnd }, pending: true, isTransfer: false, amount: { gt: 0 } },
        select: { amount: true },
      }),
      db.transaction.findMany({
        where: { userId: session.userId, date: { gte: threeMonthsAgo }, pending: false, isTransfer: false, amount: { gt: 0 } },
        select: { name: true, merchantName: true, amount: true, date: true },
      }),
      db.bankAccount.findMany({ where: { userId: session.userId } }),
      db.savingsGoal.findMany({ where: { userId: session.userId }, orderBy: { createdAt: 'desc' }, take: 3 }),
      db.transaction.findMany({
        where: { userId: session.userId, date: { gte: prevPeriodStart, lte: prevPeriodEnd }, pending: false, isTransfer: false, amount: { gt: 0 } },
        select: { categoryId: true, amount: true },
      }),
      db.savingsGoal.aggregate({ where: { userId: session.userId }, _sum: { currentAmount: true } }),
      getDebtTotals(session.userId),
    ])

  const totalDebt = debtTotals.totalDebt

  // Rollover
  const prevMonthSpendByCat = new Map<string, number>()
  for (const t of prevMonthTxns) {
    if (t.categoryId) prevMonthSpendByCat.set(t.categoryId, (prevMonthSpendByCat.get(t.categoryId) ?? 0) + t.amount)
  }
  const effectiveBudgetByCat = new Map<string, number>()
  for (const cat of categories) {
    let effective = cat.budgetAmount
    if (cat.rollover) effective += Math.max(0, cat.budgetAmount - (prevMonthSpendByCat.get(cat.id) ?? 0))
    effectiveBudgetByCat.set(cat.id, effective)
  }

  const totalBudgeted = Array.from(effectiveBudgetByCat.values()).reduce((s, v) => s + v, 0)
  const expenses = transactions.filter((t) => t.amount > 0)
  const totalSpent = expenses.reduce((s, t) => s + t.amount, 0)
  const pendingTotal = pendingTxns.reduce((s, t) => s + t.amount, 0)
  const income = budget?.monthlyIncome ?? totalBudgeted
  const remaining = income - totalSpent
  const pctUsed = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0

  // Savings rate
  const savingsRate = income > 0 ? ((income - totalSpent) / income) * 100 : 0
  const savingsRateColor = savingsRate < 10 ? '#ef4444' : savingsRate < 20 ? '#f59e0b' : '#22c55e'
  const savingsRateLabel = savingsRate < 10 ? 'Below target' : savingsRate < 20 ? 'Getting there' : 'Healthy'

  // Emergency fund runway
  const totalSaved = savedAgg._sum.currentAmount ?? 0
  const avgMonthlySpend = allRecentTxns.reduce((s, t) => s + t.amount, 0) / 3 || totalSpent
  const runwayMonths = avgMonthlySpend > 0 ? totalSaved / avgMonthlySpend : 0
  const runwayColor = runwayMonths < 1 ? '#ef4444' : runwayMonths < 3 ? '#f59e0b' : '#22c55e'

  // Uncategorized
  const uncategorizedTxns = transactions.filter((t) => !t.categoryId)
  const uncategorizedSpend = uncategorizedTxns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const uncategorizedCount = uncategorizedTxns.length

  const categorySpend = categories.map((cat: Category) => {
    const effective = effectiveBudgetByCat.get(cat.id) ?? cat.budgetAmount
    const spent = expenses.filter((t) => t.categoryId === cat.id).reduce((s, t) => s + t.amount, 0)
    const pct = effective > 0 ? Math.min((spent / effective) * 100, 100) : 0
    const overBudget = effective > 0 && spent > effective
    const nearBudget = effective > 0 && !overBudget && pct >= alertThreshold
    const rolledOver = cat.rollover ? Math.max(0, cat.budgetAmount - (prevMonthSpendByCat.get(cat.id) ?? 0)) : 0
    return { ...cat, spent, pct, overBudget, nearBudget, effectiveBudget: effective, rolledOver }
  })

  const alerts = categorySpend.filter((c) => c.overBudget || c.nearBudget)
  const chartData = [
    ...categorySpend.filter((c) => c.effectiveBudget > 0 || c.spent > 0)
      .map((c) => ({ name: c.name, spent: c.spent, budget: c.effectiveBudget, color: c.color })),
    ...(uncategorizedSpend > 0 ? [{ name: 'Uncategorized', spent: uncategorizedSpend, budget: 0, color: '#94a3b8' }] : []),
  ]

  const recurringBills = detectRecurringBills(allRecentTxns)
  const totalRecurring = recurringBills.reduce((s, b) => s + b.avgAmount, 0)

  // Onboarding checklist state
  const hasBank = bankAccounts.length > 0
  const hasTransactions = transactions.length > 0
  const allCategorized = hasTransactions && uncategorizedCount === 0
  // The getting-started card shows until the user has both a bank link and transactions.
  const setupComplete = hasBank && hasTransactions

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {getGreeting()} {user?.name?.split(' ')[0] ?? 'Commander'}
          </h1>
          <p className="text-muted-foreground text-sm">{periodLabel} overview</p>
        </div>
        <div className="flex items-center gap-3">
          <MonthSelector months={months} selected={selectedMonth} />
          {!hasBank && <PlaidLinkButton />}
        </div>
      </div>

      {/* Hero answer — "Am I okay this month?" */}
      {setupComplete && (
        <div className="rounded-2xl px-6 py-5 flex items-center justify-between gap-4" style={{ background: 'var(--sidebar)' }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'oklch(0.6 0.006 265)' }}>
              {remaining >= 0 ? 'Left to spend this month' : 'Over budget this month'}
            </p>
            <p className="text-3xl sm:text-4xl font-bold tabular-nums mt-1" style={{ color: remaining >= 0 ? '#a3e635' : '#f87171' }}>
              <AnimatedNumber value={Math.abs(remaining)} format={fmt} />
            </p>
            <p className="text-sm mt-1" style={{ color: 'oklch(0.7 0.006 265)' }}>
              {remaining >= 0
                ? pctUsed < 80
                  ? "You're pacing comfortably. Keep it up. ✦"
                  : "Getting close to your limit — ease off where you can."
                : "You've gone over — trim a category or adjust your budget."}
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end shrink-0">
            <span className="text-xs uppercase tracking-wider" style={{ color: 'oklch(0.55 0.006 265)' }}>Budget used</span>
            <span className="text-2xl font-bold tabular-nums" style={{ color: pctUsed >= 100 ? '#f87171' : 'oklch(0.92 0.004 265)' }}>
              {Math.round(pctUsed)}%
            </span>
          </div>
        </div>
      )}

      {/* Getting-started checklist (new users) */}
      {!setupComplete && (
        <Card className="border-primary/30 bg-primary/[0.03]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Get started with Ashtronomical</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ChecklistItem done={hasBank} label="Connect a bank account" hint="Automatically import your transactions">
              {!hasBank && <PlaidLinkButton />}
            </ChecklistItem>
            <ChecklistItem done={hasTransactions} label="Import or add transactions" hint="Sync your bank or add expenses manually">
              {hasBank && !hasTransactions && (
                <Link href="/transactions" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>Add expense</Link>
              )}
            </ChecklistItem>
            <ChecklistItem done={allCategorized} label="Categorize your spending" hint="Make sure every transaction has a category">
              {hasTransactions && !allCategorized && (
                <Link href="/transactions?categoryId=uncategorized" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>Review</Link>
              )}
            </ChecklistItem>
          </CardContent>
        </Card>
      )}

      {/* Uncategorized alert */}
      {uncategorizedCount > 0 && setupComplete && (
        <Link href={`/transactions?month=${selectedMonth}&categoryId=uncategorized`}
          className="flex items-center justify-between px-4 py-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-950/50 transition-colors">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-yellow-700 dark:text-yellow-400" />
            <span className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
              {uncategorizedCount} transaction{uncategorizedCount !== 1 ? 's need' : ' needs'} a category this month
              {uncategorizedSpend > 0 && ` — ${fmt(uncategorizedSpend)} untracked`}
            </span>
          </div>
          <span className="text-xs text-yellow-700 dark:text-yellow-400">Review →</span>
        </Link>
      )}

      {/* Spending alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((cat) => (
            <Alert key={cat.id} variant={cat.overBudget ? 'destructive' : 'default'} className={cat.nearBudget && !cat.overBudget ? 'border-yellow-500 text-yellow-800 dark:text-yellow-400' : ''}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {cat.overBudget
                  ? `You've exceeded your ${cat.name} budget by ${fmt(cat.spent - cat.effectiveBudget)}.`
                  : `You're at ${Math.round(cat.pct)}% of your ${cat.name} budget (${fmt(cat.spent)} of ${fmt(cat.effectiveBudget)}).`}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Financial health row: Savings rate + Emergency runway */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0">
              <svg viewBox="0 0 36 36" className="h-16 w-16" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="18" cy="18" r="15.9155" fill="none" strokeWidth="3" style={{ stroke: 'var(--border)' }} />
                <circle cx="18" cy="18" r="15.9155" fill="none" strokeWidth="3" strokeLinecap="round"
                  style={{ stroke: savingsRateColor }}
                  strokeDasharray={`${Math.max(0, Math.min(savingsRate, 100)).toFixed(1)} 100`} pathLength={100} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <TrendingUp className="h-5 w-5" style={{ color: savingsRateColor }} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Savings Rate</p>
              <p className="text-2xl font-bold tabular-nums">{Math.round(savingsRate)}%</p>
              <p className="text-xs" style={{ color: savingsRateColor }}>{savingsRateLabel} · aim for 20%+</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 rounded-full flex items-center justify-center" style={{ background: `${runwayColor}1a` }}>
              <ShieldCheck className="h-7 w-7" style={{ color: runwayColor }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Emergency Runway</p>
              <p className="text-2xl font-bold tabular-nums">{runwayMonths.toFixed(1)} <span className="text-base font-medium text-muted-foreground">months</span></p>
              {runwayMonths < 3 ? (
                <Link href="/goals" className="text-xs hover:underline" style={{ color: runwayColor }}>
                  Below 3-month target — build your fund →
                </Link>
              ) : (
                <p className="text-xs" style={{ color: runwayColor }}>Well covered · 3–6 months ideal</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 1: Spending chart + Budget ring */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card className="md:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Spending vs. Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <SpendingChart data={chartData} currency={currency} />
          </CardContent>
        </Card>

        <Card className="md:col-span-2 flex flex-col items-center justify-center gap-4 py-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Budget Used</p>
          <BudgetRing pct={pctUsed} />
          <div className="text-center space-y-1">
            <p className="text-sm text-muted-foreground">
              {fmt(totalSpent)} <span className="text-foreground/40">of</span> {fmt(totalBudgeted)}
            </p>
            {pendingTotal > 0 && <p className="text-xs text-muted-foreground">+ {fmt(pendingTotal)} pending</p>}
          </div>
        </Card>
      </div>

      {/* Row 2: stat cards + Sector breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="grid grid-cols-2 gap-3">
          <DarkStatCard label="Monthly Income" amount={income} format={fmt} sub="set in Fuel Allocation" Icon={Zap} />
          <DarkStatCard label="Total Spent" amount={totalSpent} format={fmt} sub={`of ${fmt(totalBudgeted)} budgeted`} Icon={Flame} />
          <DarkStatCard label="Remaining" amount={remaining} format={fmt} sub={remaining < 0 ? 'over budget' : 'left this period'} Icon={Vault} />
          <DarkStatCard label="Total Debt" amount={totalDebt} format={fmt} sub={totalDebt > 0 ? 'track on Debt page' : 'debt-free'} Icon={Orbit} />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Spending by Category</CardTitle>
            <Link href="/budget" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-xs h-7 gap-1')}>
              Edit <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {categorySpend.filter((c) => c.effectiveBudget > 0).map((cat) => (
              <div key={cat.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm">{cat.name}</span>
                    {cat.rolledOver > 0 && <Badge variant="secondary" className="text-xs py-0">+{fmt(cat.rolledOver)} rollover</Badge>}
                    {cat.overBudget && <Badge variant="destructive" className="text-xs py-0">Over</Badge>}
                    {cat.nearBudget && <Badge className="text-xs py-0 bg-yellow-100 text-yellow-800 border-yellow-300">{alertThreshold}%+</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">{fmt(cat.spent)} / {fmt(cat.effectiveBudget)}</span>
                </div>
                <Progress value={cat.pct} className="h-1.5" />
              </div>
            ))}
            {uncategorizedSpend > 0 && (
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full shrink-0 bg-slate-400" />
                  <span className="text-sm text-muted-foreground">Uncategorized</span>
                </div>
                <Link href={`/transactions?month=${selectedMonth}&categoryId=uncategorized`} className="text-xs text-yellow-700 dark:text-yellow-400 hover:underline tabular-nums">
                  {fmt(uncategorizedSpend)} — categorize →
                </Link>
              </div>
            )}
            {categorySpend.filter((c) => c.effectiveBudget > 0).length === 0 && uncategorizedSpend === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                <Link href="/budget" className="text-primary hover:underline">Set up budget categories</Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Recurring + Goals */}
      {(recurringBills.length > 0 || goals.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {recurringBills.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Recurring Bills</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-0">
                {recurringBills.slice(0, 5).map((bill, i) => (
                  <div key={bill.merchant}>
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm font-medium capitalize">{bill.merchant}</p>
                        <p className="text-xs text-muted-foreground">{bill.monthsDetected} of last 3 months · last {format(bill.lastDate, 'MMM d')}</p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums">{fmt(bill.avgAmount)}<span className="text-xs text-muted-foreground font-normal">/mo</span></p>
                    </div>
                    {i < recurringBills.slice(0, 5).length - 1 && <Separator />}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {goals.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Savings Goals</CardTitle>
                <Link href="/goals" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-xs h-7 gap-1')}>
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {goals.map((goal) => {
                  const pct = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
                  return (
                    <div key={goal.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">{goal.emoji} {goal.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{fmt(goal.currentAmount)} / {fmt(goal.targetAmount)}</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Row 4: Recent transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Recent Transactions</CardTitle>
          <Link href={`/transactions?month=${selectedMonth}`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-xs h-7 gap-1')}>
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No transactions yet. Connect a bank account or add one manually.</p>
          ) : (
            <div>
              {transactions.slice(0, 8).map((txn, i) => (
                <div key={txn.id}>
                  <div className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0" style={{ backgroundColor: txn.category?.color ?? '#94a3b8' }}>
                        {(txn.category?.name ?? '?')[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-none">{txn.merchantName ?? txn.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{format(txn.date, 'MMM d')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold tabular-nums ${txn.amount < 0 ? 'text-green-600' : ''}`}>
                        {txn.amount > 0 ? '-' : '+'}{fmt(Math.abs(txn.amount))}
                      </p>
                      {txn.category && <p className="text-xs text-muted-foreground">{txn.category.name}</p>}
                    </div>
                  </div>
                  {i < Math.min(transactions.length, 8) - 1 && <Separator />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ChecklistItem({ done, label, hint, children }: { done: boolean; label: string; hint: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      {done ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" /> : <Circle className="h-5 w-5 text-muted-foreground shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium', done && 'line-through text-muted-foreground')}>{label}</p>
        {!done && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {!done && children}
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 5)  return 'Working late,'
  if (h < 12) return 'Good morning,'
  if (h < 17) return 'Good afternoon,'
  return 'Good evening,'
}

function BudgetRing({ pct }: { pct: number }) {
  const clamped = Math.min(Math.max(pct, 0), 100)
  const filled = clamped
  const dasharray = `${filled.toFixed(1)} ${(100 - filled).toFixed(1)}`
  return (
    <div className="relative w-32 h-32">
      <svg viewBox="0 0 36 36" className="w-32 h-32" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="18" cy="18" r="15.9155" fill="none" strokeWidth="2.5" style={{ stroke: 'var(--border)' }} />
        <circle cx="18" cy="18" r="15.9155" fill="none" strokeWidth="2.5"
          style={{ stroke: clamped >= 100 ? '#ef4444' : 'var(--foreground)' }}
          strokeDasharray={dasharray} strokeLinecap="round" pathLength={100} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold leading-none">{Math.round(clamped)}%</span>
        <span className="text-xs text-muted-foreground mt-0.5">used</span>
      </div>
    </div>
  )
}

function DarkStatCard({ label, amount, format, sub, Icon }: { label: string; amount: number; format: (n: number) => string; sub: string; Icon: LucideIcon }) {
  return (
    <div className="rounded-xl p-5 flex flex-col justify-between min-h-[160px] relative overflow-hidden transition-transform hover:-translate-y-0.5" style={{ background: 'var(--sidebar)' }}>
      <div className="absolute bottom-3 right-3 opacity-[0.06]" aria-hidden="true">
        <Icon strokeWidth={1} style={{ width: 90, height: 90, color: 'oklch(0.92 0.004 265)' }} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'var(--font-poppins)', color: 'oklch(0.55 0.006 265)' }}>{label}</p>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'oklch(0.27 0.015 265)' }}>
          <Icon style={{ width: 16, height: 16, color: 'var(--sidebar-primary)' }} strokeWidth={2} />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold tabular-nums leading-none" style={{ fontFamily: 'var(--font-manrope)', color: 'oklch(0.95 0.004 265)' }}>
          <AnimatedNumber value={amount} format={format} />
        </p>
        <p className="text-xs mt-1.5 uppercase tracking-wide" style={{ color: 'oklch(0.50 0.006 265)', fontFamily: 'var(--font-poppins)' }}>{sub}</p>
      </div>
    </div>
  )
}
