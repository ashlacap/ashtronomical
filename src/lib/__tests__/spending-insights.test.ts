import { describe, it, expect } from 'vitest'
import { buildInsights, type CategoryMonthSpend } from '../spending-insights'

const fmt = (n: number) => `$${n.toFixed(0)}`

describe('buildInsights', () => {
  it('flags a significant spending increase', () => {
    const data: CategoryMonthSpend[] = [
      { categoryId: 'd', categoryName: 'Dining', thisMonth: 300, priorMonths: [100, 100, 100] },
    ]
    const insights = buildInsights(data, fmt)
    expect(insights).toHaveLength(1)
    expect(insights[0].severity).toBe('warning')
    expect(insights[0].title).toContain('up')
  })

  it('celebrates a significant decrease', () => {
    const data: CategoryMonthSpend[] = [
      { categoryId: 'd', categoryName: 'Dining', thisMonth: 40, priorMonths: [100, 100, 100] },
    ]
    const insights = buildInsights(data, fmt)
    expect(insights[0].severity).toBe('positive')
    expect(insights[0].title).toContain('down')
  })

  it('detects new spending in a dormant category', () => {
    const data: CategoryMonthSpend[] = [
      { categoryId: 'h', categoryName: 'Healthcare', thisMonth: 120, priorMonths: [0, 0, 0] },
    ]
    const insights = buildInsights(data, fmt)
    expect(insights[0].severity).toBe('neutral')
    expect(insights[0].title).toContain('New spending')
  })

  it('ignores small fluctuations below the noise threshold', () => {
    const data: CategoryMonthSpend[] = [
      { categoryId: 'd', categoryName: 'Dining', thisMonth: 110, priorMonths: [100, 100, 100] },
    ]
    expect(buildInsights(data, fmt)).toHaveLength(0)
  })

  it('ignores categories with a tiny baseline to avoid noise', () => {
    const data: CategoryMonthSpend[] = [
      { categoryId: 'x', categoryName: 'Misc', thisMonth: 15, priorMonths: [5, 5, 5] },
    ]
    expect(buildInsights(data, fmt)).toHaveLength(0)
  })
})
