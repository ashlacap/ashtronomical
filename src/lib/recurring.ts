import { format, subMonths } from 'date-fns'

type Transaction = {
  name: string
  merchantName: string | null
  amount: number
  date: Date
  isKnownRecurring?: boolean
}

export type RecurringBill = {
  merchant: string
  displayName: string
  avgAmount: number
  monthsDetected: number
  lastDate: Date
  isLikelyFixed: boolean  // true = consistent amount (subscription), false = variable (groceries, etc.)
  isKnown: boolean        // user has acknowledged this recurring charge
}

export function detectRecurringBills(transactions: Transaction[]): RecurringBill[] {
  // Look back 6 months to catch quarterly charges too
  const sixMonthsAgo = subMonths(new Date(), 6)
  const recent = transactions.filter((t) => t.amount > 0 && t.date >= sixMonthsAgo)

  const byMerchant = new Map<string, Transaction[]>()
  const displayNames = new Map<string, string>()
  for (const t of recent) {
    const raw = (t.merchantName ?? t.name).trim()
    const key = raw.toLowerCase()
    if (!displayNames.has(key)) displayNames.set(key, raw)
    const existing = byMerchant.get(key) ?? []
    byMerchant.set(key, [...existing, t])
  }

  const results: RecurringBill[] = []

  for (const [merchant, txns] of byMerchant) {
    // Must appear in at least 3 distinct months to be called recurring
    const months = new Set(txns.map((t) => format(t.date, 'yyyy-MM')))
    if (months.size < 3) continue

    const amounts = txns.map((t) => t.amount)
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length
    const maxAmount = Math.max(...amounts)
    const minAmount = Math.min(...amounts)

    // Coefficient of variation: low = consistent (subscription), high = variable (groceries)
    const stdDev = Math.sqrt(amounts.map((a) => Math.pow(a - avgAmount, 2)).reduce((s, v) => s + v, 0) / amounts.length)
    const cv = avgAmount > 0 ? stdDev / avgAmount : 1
    const isLikelyFixed = cv < 0.15 && (maxAmount - minAmount) < avgAmount * 0.2

    // Skip clearly variable spend unless it's consistently in the same range
    // (e.g. don't flag Amazon as a recurring bill — it's shopping)
    if (!isLikelyFixed && avgAmount > 200) continue

    const lastDate = txns.sort((a, b) => b.date.getTime() - a.date.getTime())[0].date
    const isKnown = txns.some((t) => t.isKnownRecurring)

    results.push({
      merchant,
      displayName: displayNames.get(merchant) ?? merchant,
      avgAmount,
      monthsDetected: months.size,
      lastDate,
      isLikelyFixed,
      isKnown,
    })
  }

  // Sort by amount desc, fixed bills first
  return results
    .sort((a, b) => {
      if (a.isLikelyFixed !== b.isLikelyFixed) return a.isLikelyFixed ? -1 : 1
      return b.avgAmount - a.avgAmount
    })
    .slice(0, 10)
}
