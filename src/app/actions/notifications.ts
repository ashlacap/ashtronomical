'use server'

import { startOfMonth, endOfMonth, differenceInCalendarMonths } from 'date-fns'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { getUserSettings } from '@/lib/user-settings'

export type AppNotification = {
  id: string
  type: 'over-budget' | 'near-budget' | 'uncategorized' | 'goal-behind'
  title: string
  detail: string
  href: string
}

export async function getNotifications(): Promise<AppNotification[]> {
  const session = await requireAuth()
  const settings = await getUserSettings()
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const [categories, transactions, goals, uncategorizedCount] = await Promise.all([
    db.category.findMany({ where: { userId: session.userId } }),
    db.transaction.findMany({
      where: { userId: session.userId, date: { gte: monthStart, lte: monthEnd }, pending: false, isTransfer: false, amount: { gt: 0 } },
      select: { categoryId: true, amount: true },
    }),
    db.savingsGoal.findMany({ where: { userId: session.userId } }),
    db.transaction.count({
      where: { userId: session.userId, date: { gte: monthStart, lte: monthEnd }, pending: false, isTransfer: false, categoryId: null },
    }),
  ])

  const notifications: AppNotification[] = []

  // Budget categories
  const spendByCat = new Map<string, number>()
  for (const t of transactions) {
    if (t.categoryId) spendByCat.set(t.categoryId, (spendByCat.get(t.categoryId) ?? 0) + t.amount)
  }
  for (const cat of categories) {
    if (cat.budgetAmount <= 0) continue
    const spent = spendByCat.get(cat.id) ?? 0
    const pct = (spent / cat.budgetAmount) * 100
    if (spent > cat.budgetAmount) {
      notifications.push({
        id: `over-${cat.id}`,
        type: 'over-budget',
        title: `${cat.name} over budget`,
        detail: `You've exceeded this category's budget`,
        href: '/budget',
      })
    } else if (pct >= settings.alertThreshold) {
      notifications.push({
        id: `near-${cat.id}`,
        type: 'near-budget',
        title: `${cat.name} at ${Math.round(pct)}%`,
        detail: `Approaching your budget limit`,
        href: '/transactions',
      })
    }
  }

  // Uncategorized
  if (uncategorizedCount > 0) {
    notifications.push({
      id: 'uncategorized',
      type: 'uncategorized',
      title: `${uncategorizedCount} uncategorized transaction${uncategorizedCount !== 1 ? 's' : ''}`,
      detail: 'Categorize them to keep your budget accurate',
      href: '/transactions?categoryId=uncategorized',
    })
  }

  // Goals behind pace
  for (const goal of goals) {
    if (!goal.targetDate || goal.currentAmount >= goal.targetAmount) continue
    const monthsLeft = differenceInCalendarMonths(new Date(goal.targetDate), now)
    if (monthsLeft <= 0) continue
    const pctComplete = (goal.currentAmount / goal.targetAmount) * 100
    const totalMonths = differenceInCalendarMonths(new Date(goal.targetDate), new Date(goal.createdAt))
    const expectedPct = totalMonths > 0 ? ((totalMonths - monthsLeft) / totalMonths) * 100 : 0
    if (pctComplete < expectedPct - 10) {
      notifications.push({
        id: `goal-${goal.id}`,
        type: 'goal-behind',
        title: `${goal.emoji} ${goal.name} behind pace`,
        detail: `${Math.round(pctComplete)}% saved with ${monthsLeft} month${monthsLeft !== 1 ? 's' : ''} left`,
        href: '/goals',
      })
    }
  }

  return notifications
}
