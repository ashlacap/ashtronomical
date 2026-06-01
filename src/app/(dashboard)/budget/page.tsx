import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'
import { BudgetClient } from '@/components/BudgetClient'

export default async function BudgetPage() {
  const session = await requireAuth()
  const now = new Date()

  const [budget, categories, savingsGoals] = await Promise.all([
    db.budget.findFirst({
      where: { userId: session.userId, month: now.getMonth() + 1, year: now.getFullYear() },
    }),
    db.category.findMany({ where: { userId: session.userId }, orderBy: { name: 'asc' } }),
    db.savingsGoal.findMany({ where: { userId: session.userId }, orderBy: { name: 'asc' } }),
  ])

  const categoryData = categories.map((c) => ({
    id: c.id,
    name: c.name,
    budgetAmount: c.budgetAmount,
    color: c.color,
    keywords: c.keywords,
    rollover: c.rollover,
    savingsGoalId: c.savingsGoalId ?? null,
  }))

  const totalBudgeted = categoryData.reduce((sum, c) => sum + c.budgetAmount, 0)

  return (
    <BudgetClient
      initialIncome={budget?.monthlyIncome ?? 5000}
      initialCategories={categoryData}
      totalBudgeted={totalBudgeted}
      savingsGoals={savingsGoals.map((g) => ({ id: g.id, name: g.name, emoji: g.emoji }))}
    />
  )
}
