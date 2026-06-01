import { describe, it, expect } from 'vitest'
import { calculatePayoff } from '../debt-payoff'

describe('calculatePayoff', () => {
  it('returns zeros for no debts', () => {
    const r = calculatePayoff([])
    expect(r.monthsToPayoff).toBe(0)
    expect(r.totalInterest).toBe(0)
    expect(r.payoffDate).toBeNull()
  })

  it('pays off a simple interest-free debt in the expected months', () => {
    const r = calculatePayoff([
      { id: '1', name: 'Loan', balance: 1000, interestRate: 0, minimumPayment: 100 },
    ])
    expect(r.monthsToPayoff).toBe(10)
    expect(r.totalInterest).toBe(0)
  })

  it('accrues interest on a carried balance', () => {
    const r = calculatePayoff([
      { id: '1', name: 'Card', balance: 1000, interestRate: 12, minimumPayment: 100 },
    ])
    // 1% monthly interest means it takes longer than 10 months and accrues interest
    expect(r.monthsToPayoff).toBeGreaterThan(10)
    expect(r.totalInterest).toBeGreaterThan(0)
    expect(r.monthlyInterestCost).toBeCloseTo(10, 1) // 1000 * 12% / 12 = 10
  })

  it('extra payments accelerate payoff', () => {
    const debts = [{ id: '1', name: 'Card', balance: 2000, interestRate: 18, minimumPayment: 50 }]
    const base = calculatePayoff(debts, 0)
    const withExtra = calculatePayoff(debts, 200)
    expect(withExtra.monthsToPayoff).toBeLessThan(base.monthsToPayoff)
    expect(withExtra.totalInterest).toBeLessThan(base.totalInterest)
  })

  it('targets the highest-rate debt first (avalanche)', () => {
    // Two debts, extra payment should reduce total interest vs. spreading evenly
    const debts = [
      { id: 'hi', name: 'High', balance: 1000, interestRate: 25, minimumPayment: 25 },
      { id: 'lo', name: 'Low', balance: 1000, interestRate: 5, minimumPayment: 25 },
    ]
    const r = calculatePayoff(debts, 200)
    expect(r.monthsToPayoff).toBeGreaterThan(0)
    expect(r.monthsToPayoff).toBeLessThan(Infinity)
  })

  it('flags non-amortizing debt as effectively infinite', () => {
    // Minimum payment below monthly interest never pays down
    const r = calculatePayoff([
      { id: '1', name: 'Trap', balance: 10000, interestRate: 30, minimumPayment: 10 },
    ])
    expect(r.monthsToPayoff).toBe(Infinity)
  })
})
