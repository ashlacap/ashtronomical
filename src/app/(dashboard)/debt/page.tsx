import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'
import { DebtClient } from '@/components/DebtClient'

export default async function DebtPage() {
  const session = await requireAuth()
  const debts = await db.debt.findMany({
    where: { userId: session.userId },
    orderBy: { interestRate: 'desc' },
  })

  return (
    <DebtClient
      initialDebts={debts.map((d) => ({
        id: d.id,
        name: d.name,
        balance: d.balance,
        interestRate: d.interestRate,
        minimumPayment: d.minimumPayment,
        type: d.type,
      }))}
    />
  )
}
