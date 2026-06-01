import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'
import { GoalsClient } from '@/components/GoalsClient'

export default async function GoalsPage() {
  const session = await requireAuth()

  const goals = await db.savingsGoal.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Missions</h1>
        <p className="text-muted-foreground text-sm">Chart your course toward financial milestones.</p>
      </div>
      <GoalsClient
        initialGoals={goals.map((g) => ({
          id: g.id,
          name: g.name,
          targetAmount: g.targetAmount,
          currentAmount: g.currentAmount,
          targetDate: g.targetDate?.toISOString() ?? null,
          color: g.color,
          emoji: g.emoji,
        }))}
      />
    </div>
  )
}
