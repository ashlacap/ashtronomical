import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'
import { DebtClient } from '@/components/DebtClient'
import { getPlaidDebtAccounts } from '@/lib/finance'

export default async function DebtPage() {
  const session = await requireAuth()
  const [debts, plaidDebtAccounts] = await Promise.all([
    db.debt.findMany({ where: { userId: session.userId }, orderBy: { interestRate: 'desc' } }),
    getPlaidDebtAccounts(session.userId),
  ])

  // A connected card that's already been set up as a tracked debt shouldn't
  // appear in the read-only "Connected accounts" list (avoids double-counting).
  const linkedIds = new Set(debts.map((d) => d.plaidAccountId).filter(Boolean))
  const connectedDebts = plaidDebtAccounts.filter((a) => !linkedIds.has(a.plaidAccountId))

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
      connectedDebts={connectedDebts}
    />
  )
}
