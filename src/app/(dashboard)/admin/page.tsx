import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { isAdmin } from '@/lib/admin'
import { startOfDay, subDays, startOfMonth, format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Users, UserPlus, BadgeCheck, Landmark, Receipt, TrendingUp } from 'lucide-react'

export default async function AdminPage() {
  const session = await requireAuth()
  if (!(await isAdmin(session.userId))) redirect('/dashboard')

  const now = new Date()
  const todayStart = startOfDay(now)
  const weekStart = subDays(todayStart, 7)
  const monthStart = startOfMonth(now)

  const [
    totalUsers,
    signupsToday,
    signupsThisWeek,
    signupsThisMonth,
    verifiedUsers,
    onboardedUsers,
    usersWithBank,
    totalTransactions,
    recentUsers,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: todayStart } } }),
    db.user.count({ where: { createdAt: { gte: weekStart } } }),
    db.user.count({ where: { createdAt: { gte: monthStart } } }),
    db.user.count({ where: { emailVerified: true } }),
    db.user.count({ where: { onboardingComplete: true } }),
    db.user.count({ where: { bankAccounts: { some: {} } } }),
    db.transaction.count(),
    db.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { id: true, name: true, email: true, createdAt: true, onboardingComplete: true, emailVerified: true },
    }),
  ])

  // Last 14 days signup sparkline data
  const days = Array.from({ length: 14 }, (_, i) => subDays(todayStart, 13 - i))
  const dailyCounts = await Promise.all(
    days.map((d) =>
      db.user.count({ where: { createdAt: { gte: d, lt: subDays(d, -1) } } }),
    ),
  )
  const maxDaily = Math.max(1, ...dailyCounts)

  const pct = (n: number) => (totalUsers > 0 ? Math.round((n / totalUsers) * 100) : 0)
  const maskEmail = (email: string) => {
    const [u, domain] = email.split('@')
    if (!domain) return email
    const masked = u.length <= 2 ? u[0] + '•' : u.slice(0, 2) + '•'.repeat(Math.max(1, u.length - 2))
    return `${masked}@${domain}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider ml-2 align-middle">Mission Log</span></h1>
        <p className="text-muted-foreground text-sm">Who's using Ashtronomical and how engaged they are.</p>
      </div>

      {/* Headline */}
      <div className="rounded-2xl px-6 py-5" style={{ background: 'var(--sidebar)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'oklch(0.6 0.006 265)' }}>Total signups</p>
        <p className="text-4xl font-bold tabular-nums mt-1" style={{ color: 'oklch(0.95 0.004 265)' }}>{totalUsers.toLocaleString()}</p>
        <div className="flex gap-4 mt-2 text-sm" style={{ color: 'oklch(0.7 0.006 265)' }}>
          <span><strong style={{ color: '#a3e635' }}>+{signupsToday}</strong> today</span>
          <span><strong style={{ color: '#a3e635' }}>+{signupsThisWeek}</strong> this week</span>
          <span><strong style={{ color: '#a3e635' }}>+{signupsThisMonth}</strong> this month</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard Icon={Users} label="Total users" value={totalUsers.toLocaleString()} />
        <StatCard Icon={BadgeCheck} label="Email verified" value={`${verifiedUsers} · ${pct(verifiedUsers)}%`} />
        <StatCard Icon={TrendingUp} label="Completed onboarding" value={`${onboardedUsers} · ${pct(onboardedUsers)}%`} />
        <StatCard Icon={Landmark} label="Connected a bank" value={`${usersWithBank} · ${pct(usersWithBank)}%`} />
      </div>

      {/* Signups sparkline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Signups — last 14 days</CardTitle>
          <CardDescription>{totalTransactions.toLocaleString()} transactions tracked across all users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1.5 h-28">
            {dailyCounts.map((c, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t bg-primary/80" style={{ height: `${(c / maxDaily) * 100}%`, minHeight: c > 0 ? 4 : 1 }} title={`${c} on ${format(days[i], 'MMM d')}`} />
                <span className="text-[0.6rem] text-muted-foreground">{format(days[i], 'd')}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent signups */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" />Recent signups</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {recentUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No users yet.</p>
          ) : (
            recentUsers.map((u, i) => (
              <div key={u.id}>
                <div className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                      {(u.name || u.email)[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{u.name || 'No name'}</p>
                      <p className="text-xs text-muted-foreground">{maskEmail(u.email)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.emailVerified && <Badge variant="secondary" className="text-xs gap-0.5"><BadgeCheck className="h-2.5 w-2.5" />Verified</Badge>}
                    {u.onboardingComplete && <Badge variant="outline" className="text-xs">Onboarded</Badge>}
                    <span className="text-xs text-muted-foreground tabular-nums w-20 text-right">{format(u.createdAt, 'MMM d, yyyy')}</span>
                  </div>
                </div>
                {i < recentUsers.length - 1 && <Separator />}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ Icon, label, value }: { Icon: typeof Users; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          <p className="text-xs uppercase tracking-wider">{label}</p>
        </div>
        <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
      </CardContent>
    </Card>
  )
}
