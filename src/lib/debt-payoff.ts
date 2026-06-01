export type DebtInput = {
  id: string
  name: string
  balance: number
  interestRate: number
  minimumPayment: number
}

export type PayoffResult = {
  monthsToPayoff: number
  totalInterest: number
  payoffDate: Date | null
  monthlyInterestCost: number
}

/**
 * Avalanche method: pay minimums on everything, throw any extra at the
 * highest-interest debt first. Here we simulate paying just the sum of
 * minimum payments each month (no extra), which gives a realistic baseline
 * timeline and total interest. Returns aggregate stats across all debts.
 */
export function calculatePayoff(debts: DebtInput[], extraMonthly = 0): PayoffResult {
  const active = debts
    .filter((d) => d.balance > 0)
    .map((d) => ({ ...d }))
    .sort((a, b) => b.interestRate - a.interestRate)

  if (active.length === 0) {
    return { monthsToPayoff: 0, totalInterest: 0, payoffDate: null, monthlyInterestCost: 0 }
  }

  const monthlyInterestCost = active.reduce(
    (s, d) => s + (d.balance * (d.interestRate / 100)) / 12,
    0,
  )

  let months = 0
  let totalInterest = 0
  const MAX_MONTHS = 1200 // 100 years safety cap

  while (active.some((d) => d.balance > 0.01) && months < MAX_MONTHS) {
    months++
    let extra = extraMonthly

    // Apply interest + minimum payments
    for (const d of active) {
      if (d.balance <= 0) continue
      const interest = (d.balance * (d.interestRate / 100)) / 12
      totalInterest += interest
      d.balance += interest
      const payment = Math.min(d.minimumPayment, d.balance)
      d.balance -= payment
    }

    // Throw extra at highest-rate debt with a balance
    for (const d of active) {
      if (extra <= 0) break
      if (d.balance <= 0) continue
      const applied = Math.min(extra, d.balance)
      d.balance -= applied
      extra -= applied
    }

    // If no progress is being made (minimums don't cover interest), bail
    if (months > 1 && active.every((d) => d.minimumPayment === 0)) break
  }

  const payoffDate = months > 0 && months < MAX_MONTHS
    ? new Date(new Date().setMonth(new Date().getMonth() + months))
    : null

  return {
    monthsToPayoff: months >= MAX_MONTHS ? Infinity : months,
    totalInterest,
    payoffDate,
    monthlyInterestCost,
  }
}
