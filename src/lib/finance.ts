import 'server-only'
import { db } from '@/lib/db'

export type PlaidDebtAccount = {
  id: string
  plaidAccountId: string // Plaid's stable account ID — used to link a Debt to this card
  name: string
  mask: string | null
  balance: number
  type: string // "credit" | "loan"
}

// Plaid account types that represent money owed, not money held.
const DEBT_TYPES = ['credit', 'loan']

/** Credit cards and loans from connected banks — these are debts, not assets. */
export async function getPlaidDebtAccounts(userId: string): Promise<PlaidDebtAccount[]> {
  const accounts = await db.plaidAccount.findMany({
    where: { bankAccount: { userId }, type: { in: DEBT_TYPES } },
    select: { id: true, plaidAccountId: true, name: true, mask: true, currentBalance: true, type: true },
  })
  return accounts.map((a) => ({
    id: a.id,
    plaidAccountId: a.plaidAccountId,
    name: a.name,
    mask: a.mask,
    balance: a.currentBalance ?? 0,
    type: a.type,
  }))
}

export function isDebtType(plaidType: string): boolean {
  return DEBT_TYPES.includes(plaidType)
}

/**
 * Total debt across manual debts + connected credit/loan accounts, without
 * double-counting cards that have been promoted to a tracked debt.
 */
export async function getDebtTotals(userId: string): Promise<{ totalDebt: number; manualTotal: number; connectedUnlinkedTotal: number }> {
  const [debts, plaidDebtAccounts] = await Promise.all([
    db.debt.findMany({ where: { userId }, select: { balance: true, plaidAccountId: true } }),
    getPlaidDebtAccounts(userId),
  ])
  const linkedIds = new Set(debts.map((d) => d.plaidAccountId).filter(Boolean))
  const manualTotal = debts.reduce((s, d) => s + d.balance, 0)
  const connectedUnlinkedTotal = plaidDebtAccounts
    .filter((a) => !linkedIds.has(a.plaidAccountId))
    .reduce((s, a) => s + a.balance, 0)
  return { totalDebt: manualTotal + connectedUnlinkedTotal, manualTotal, connectedUnlinkedTotal }
}
