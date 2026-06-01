import { describe, it, expect } from 'vitest'
import { getBudgetPeriod, getBudgetPeriodLabel } from '../budget-period'

describe('getBudgetPeriod', () => {
  it('returns the calendar month when start day is 1', () => {
    const ref = new Date(2026, 4, 15) // May 15, 2026
    const { periodStart, periodEnd } = getBudgetPeriod(1, ref)
    expect(periodStart.getMonth()).toBe(4) // May
    expect(periodStart.getDate()).toBe(1)
    expect(periodEnd.getMonth()).toBe(4)
    expect(periodEnd.getDate()).toBe(31)
  })

  it('handles a mid-month start day when reference is after the start', () => {
    const ref = new Date(2026, 4, 20) // May 20
    const { periodStart, periodEnd } = getBudgetPeriod(15, ref)
    expect(periodStart.getMonth()).toBe(4) // May 15
    expect(periodStart.getDate()).toBe(15)
    expect(periodEnd.getMonth()).toBe(5) // June 14
    expect(periodEnd.getDate()).toBe(14)
  })

  it('handles a mid-month start day when reference is before the start', () => {
    const ref = new Date(2026, 4, 10) // May 10
    const { periodStart, periodEnd } = getBudgetPeriod(15, ref)
    expect(periodStart.getMonth()).toBe(3) // April 15
    expect(periodStart.getDate()).toBe(15)
    expect(periodEnd.getMonth()).toBe(4) // May 14
    expect(periodEnd.getDate()).toBe(14)
  })

  it('rolls over the year boundary correctly', () => {
    const ref = new Date(2026, 0, 5) // Jan 5
    const { periodStart, periodEnd } = getBudgetPeriod(15, ref)
    expect(periodStart.getFullYear()).toBe(2025)
    expect(periodStart.getMonth()).toBe(11) // Dec 15, 2025
    expect(periodEnd.getFullYear()).toBe(2026)
    expect(periodEnd.getMonth()).toBe(0) // Jan 14, 2026
  })
})

describe('getBudgetPeriodLabel', () => {
  it('shows month + year when start day is 1', () => {
    const label = getBudgetPeriodLabel(1, new Date(2026, 4, 15))
    expect(label).toBe('May 2026')
  })

  it('shows a range when start day is not 1', () => {
    const label = getBudgetPeriodLabel(15, new Date(2026, 4, 20))
    expect(label).toMatch(/May 15.*Jun 14/)
  })
})
