export type CategoryMonthSpend = {
  categoryId: string
  categoryName: string
  thisMonth: number
  priorMonths: number[] // spend in each of the prior N months
}

export type Insight = {
  id: string
  severity: 'positive' | 'neutral' | 'warning'
  title: string
  detail: string
}

/**
 * Compares this month's spending per category against the average of prior
 * months and produces plain-language insights. Pure & testable.
 */
export function buildInsights(data: CategoryMonthSpend[], currencyFmt: (n: number) => string): Insight[] {
  const insights: Insight[] = []

  for (const cat of data) {
    const priors = cat.priorMonths.filter((_, i) => i < cat.priorMonths.length)
    if (priors.length === 0) continue
    const avg = priors.reduce((s, v) => s + v, 0) / priors.length
    if (avg < 1 && cat.thisMonth < 1) continue

    // Need a meaningful baseline to call something anomalous
    if (avg >= 20) {
      const pctChange = ((cat.thisMonth - avg) / avg) * 100
      if (pctChange >= 40) {
        insights.push({
          id: `up-${cat.categoryId}`,
          severity: 'warning',
          title: `${cat.categoryName} spending is up ${Math.round(pctChange)}%`,
          detail: `${currencyFmt(cat.thisMonth)} this month vs. a ${currencyFmt(avg)} average.`,
        })
      } else if (pctChange <= -40) {
        insights.push({
          id: `down-${cat.categoryId}`,
          severity: 'positive',
          title: `${cat.categoryName} spending is down ${Math.round(Math.abs(pctChange))}%`,
          detail: `${currencyFmt(cat.thisMonth)} this month vs. a ${currencyFmt(avg)} average. Nice.`,
        })
      }
    }

    // New spending in a category that was previously dormant
    if (avg < 1 && cat.thisMonth >= 50) {
      insights.push({
        id: `new-${cat.categoryId}`,
        severity: 'neutral',
        title: `New spending in ${cat.categoryName}`,
        detail: `${currencyFmt(cat.thisMonth)} this month — nothing in recent months.`,
      })
    }
  }

  // Sort: warnings first, then neutral, then positive
  const order = { warning: 0, neutral: 1, positive: 2 }
  return insights.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 6)
}
