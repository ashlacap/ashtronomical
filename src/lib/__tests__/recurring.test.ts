import { describe, it, expect } from 'vitest'
import { detectRecurringBills } from '../recurring'

function monthsAgo(n: number): Date {
  // Anchor to the 15th to avoid end-of-month overflow collapsing distinct months.
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() - n, 15)
}

describe('detectRecurringBills', () => {
  it('detects a consistent monthly subscription', () => {
    const txns = [0, 1, 2, 3].map((n) => ({
      name: 'Netflix',
      merchantName: 'Netflix',
      amount: 15.99,
      date: monthsAgo(n),
    }))
    const bills = detectRecurringBills(txns)
    const netflix = bills.find((b) => b.merchant === 'netflix')
    expect(netflix).toBeDefined()
    expect(netflix!.isLikelyFixed).toBe(true)
    expect(netflix!.avgAmount).toBeCloseTo(15.99, 2)
  })

  it('ignores charges appearing in fewer than 3 months', () => {
    const txns = [0, 1].map((n) => ({
      name: 'OneOff',
      merchantName: 'OneOff',
      amount: 50,
      date: monthsAgo(n),
    }))
    expect(detectRecurringBills(txns)).toHaveLength(0)
  })

  it('does not flag large variable merchants as fixed bills', () => {
    const txns = [0, 1, 2, 3].map((n) => ({
      name: 'Amazon',
      merchantName: 'Amazon',
      amount: 250 + n * 80, // highly variable, large
      date: monthsAgo(n),
    }))
    const bills = detectRecurringBills(txns)
    const amazon = bills.find((b) => b.merchant === 'amazon')
    // Large + variable should be filtered out
    expect(amazon).toBeUndefined()
  })

  it('marks a merchant as known when any transaction is acknowledged', () => {
    const txns = [0, 1, 2].map((n) => ({
      name: 'Spotify',
      merchantName: 'Spotify',
      amount: 9.99,
      date: monthsAgo(n),
      isKnownRecurring: n === 0,
    }))
    const bills = detectRecurringBills(txns)
    expect(bills.find((b) => b.merchant === 'spotify')?.isKnown).toBe(true)
  })
})
