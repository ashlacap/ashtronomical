/**
 * Returns the start and end of the current budget period given a start day.
 * If budgetStartDay=1 → standard calendar month.
 * If budgetStartDay=15 → May 15–June 14, etc.
 */
export function getBudgetPeriod(startDay: number, reference: Date = new Date()) {
  const day = reference.getDate()
  const month = reference.getMonth()
  const year = reference.getFullYear()

  let periodStart: Date
  let periodEnd: Date

  if (day >= startDay) {
    // Current period started this month on startDay
    periodStart = new Date(year, month, startDay, 0, 0, 0, 0)
    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year
    periodEnd = new Date(nextYear, nextMonth, startDay - 1, 23, 59, 59, 999)
  } else {
    // Current period started last month on startDay
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    periodStart = new Date(prevYear, prevMonth, startDay, 0, 0, 0, 0)
    periodEnd = new Date(year, month, startDay - 1, 23, 59, 59, 999)
  }

  return { periodStart, periodEnd }
}

/** Label for the current budget period, e.g. "May 15 – Jun 14" */
export function getBudgetPeriodLabel(startDay: number, reference: Date = new Date()): string {
  if (startDay === 1) {
    return reference.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
  const { periodStart, periodEnd } = getBudgetPeriod(startDay, reference)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(periodStart)} – ${fmt(periodEnd)}`
}
