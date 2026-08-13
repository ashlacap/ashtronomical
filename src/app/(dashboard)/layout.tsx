import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'
import { Sidebar, MobileSidebar } from '@/components/Sidebar'
import { AshtroIcon } from '@/components/AshtroIcon'
import { UserMenu } from '@/components/UserMenu'
import { NotificationBell } from '@/components/NotificationBell'
import { CurrencyProvider } from '@/components/CurrencyProvider'
import { isAdmin } from '@/lib/admin'
import { getSwitchableAccounts } from '@/app/actions/auth'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuth()
  const [user, admin, switchableAccounts] = await Promise.all([
    db.user.findUnique({ where: { id: session.userId }, select: { name: true, currency: true } }),
    isAdmin(session.userId),
    getSwitchableAccounts(),
  ])
  const userName = user?.name ?? ''
  const currency = user?.currency ?? 'USD'
  const initials = userName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'A'

  return (
    <CurrencyProvider currency={currency}>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:bg-card focus:text-foreground focus:px-3 focus:py-2 focus:rounded-md focus:ring-2 focus:ring-primary">
        Skip to content
      </a>
      <div className="flex min-h-screen">
        <Sidebar userName={userName} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 sm:px-5 sticky top-0 z-10 shrink-0">
            <div className="flex items-center gap-3">
              <MobileSidebar userName={userName} />
              <div className="flex items-center gap-2">
                <AshtroIcon className="h-4 w-4" />
                <span className="font-bold text-xs tracking-[0.25em] uppercase hidden xs:inline sm:inline">Ashtronomical</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <NotificationBell />
              <UserMenu initials={initials} userName={userName} isAdmin={admin} switchableAccounts={switchableAccounts} />
            </div>
          </header>

          <main id="main-content" className="flex-1 overflow-auto">
            <div className="max-w-6xl mx-auto px-4 sm:px-5 py-6">{children}</div>
          </main>
        </div>
      </div>
    </CurrencyProvider>
  )
}
