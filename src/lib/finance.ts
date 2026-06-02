import 'server-only'
import { db } from '@/lib/db'

export type PlaidDebtAccount = {
  id: string
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
    select: { id: true, name: true, mask: true, currentBalance: true, type: true },
  })
  return accounts.map((a) => ({
    id: a.id,
    name: a.name,
    mask: a.mask,
    balance: a.currentBalance ?? 0,
    type: a.type,
  }))
}

export function isDebtType(plaidType: string): boolean {
  return DEBT_TYPES.includes(plaidType)
}
