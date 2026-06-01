import { NextRequest, NextResponse } from 'next/server'
import { startOfMonth, endOfMonth, subDays } from 'date-fns'
import { db } from '@/lib/db'
import { sendEmail, emailLayout } from '@/lib/email'
import { formatCurrency } from '@/lib/currency'
import { appUrl } from '@/lib/tokens'

// Triggered by a scheduled job (e.g. Vercel Cron) once a week.
// Protect with CRON_SECRET so it can't be invoked publicly.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const now = new Date()
  const weekAgo = subDays(now, 7)
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const users = await db.user.findMany({
    where: { weeklyDigest: true },
    select: { id: true, name: true, email: true, currency: true, alertThreshold: true },
  })

  let sent = 0

  for (const user of users) {
    const fmt = (n: number) => formatCurrency(n, user.currency)

    const [weekTxns, monthTxns, categories, budget] = await Promise.all([
      db.transaction.findMany({
        where: { userId: user.id, date: { gte: weekAgo, lte: now }, pending: false, isTransfer: false, amount: { gt: 0 } },
        select: { amount: true },
      }),
      db.transaction.findMany({
        where: { userId: user.id, date: { gte: monthStart, lte: monthEnd }, pending: false, isTransfer: false, amount: { gt: 0 } },
        select: { categoryId: true, amount: true },
      }),
      db.category.findMany({ where: { userId: user.id } }),
      db.budget.findFirst({ where: { userId: user.id, month: now.getMonth() + 1, year: now.getFullYear() } }),
    ])

    // Skip users with no activity to avoid spamming empty digests
    if (weekTxns.length === 0 && monthTxns.length === 0) continue

    const weekSpent = weekTxns.reduce((s, t) => s + t.amount, 0)
    const monthSpent = monthTxns.reduce((s, t) => s + t.amount, 0)
    const totalBudget = categories.reduce((s, c) => s + c.budgetAmount, 0)
    const income = budget?.monthlyIncome ?? totalBudget

    // Over-budget categories
    const spendByCat = new Map<string, number>()
    for (const t of monthTxns) if (t.categoryId) spendByCat.set(t.categoryId, (spendByCat.get(t.categoryId) ?? 0) + t.amount)
    const overBudget = categories
      .filter((c) => c.budgetAmount > 0 && (spendByCat.get(c.id) ?? 0) > c.budgetAmount)
      .map((c) => `<li><strong>${c.name}</strong>: ${fmt(spendByCat.get(c.id) ?? 0)} of ${fmt(c.budgetAmount)}</li>`)

    const savingsRate = income > 0 ? Math.round(((income - monthSpent) / income) * 100) : 0

    const body = `
      <p>Here's your week at a glance.</p>
      <table style="width:100%; border-collapse:collapse; margin:16px 0;">
        <tr><td style="padding:6px 0; color:#64748b;">Spent this week</td><td style="padding:6px 0; text-align:right; font-weight:700;">${fmt(weekSpent)}</td></tr>
        <tr><td style="padding:6px 0; color:#64748b;">Spent this month</td><td style="padding:6px 0; text-align:right; font-weight:700;">${fmt(monthSpent)} of ${fmt(totalBudget)}</td></tr>
        <tr><td style="padding:6px 0; color:#64748b;">Savings rate</td><td style="padding:6px 0; text-align:right; font-weight:700;">${savingsRate}%</td></tr>
      </table>
      ${overBudget.length > 0 ? `<p style="color:#dc2626; font-weight:600;">Over budget:</p><ul>${overBudget.join('')}</ul>` : '<p style="color:#16a34a;">You\'re within budget across all categories. Nice work.</p>'}
    `

    const res = await sendEmail({
      to: user.email,
      subject: `Your weekly money summary — ${fmt(weekSpent)} spent`,
      html: emailLayout(`Hi ${user.name?.split(' ')[0] ?? 'there'}, here's your week`, body, {
        label: 'Open dashboard',
        url: appUrl('/dashboard'),
      }),
    })
    if (res.ok) sent++
  }

  return NextResponse.json({ ok: true, usersProcessed: users.length, emailsSent: sent })
}
