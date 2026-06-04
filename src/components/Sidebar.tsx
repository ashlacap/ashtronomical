'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

const NAV_ITEMS = [
  // label = plain, scannable word (primary). accent = space-theme flavor (secondary).
  { href: '/dashboard',    label: 'Overview',     accent: 'Mission Control' },
  { href: '/budget',       label: 'Budget',       accent: 'Fuel Allocation' },
  { href: '/transactions', label: 'Transactions', accent: 'Transmissions'   },
  { href: '/accounts',     label: 'Accounts',     accent: 'Stations'        },
  { href: '/insights',     label: 'Insights',     accent: 'Star Charts'     },
  { href: '/goals',        label: 'Goals',        accent: 'Missions'        },
  { href: '/debt',         label: 'Debt',         accent: 'Black Holes'     },
  { href: '/events',       label: 'Events',       accent: 'Event Budgets'   },
  { href: '/household',    label: 'Household',    accent: 'Crew'            },
]

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="flex-1 px-4 py-4 space-y-0.5" aria-label="Main navigation">
      {NAV_ITEMS.map(({ href, label, accent }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'block px-3 py-2 rounded-lg transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary',
              active
                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            )}
          >
            <span className="block text-sm font-semibold">{label}</span>
            <span className={cn(
              'block text-[0.7rem] mt-0.5 tracking-wider uppercase',
              active ? 'opacity-60' : 'opacity-40',
            )}>{accent}</span>
          </Link>
        )
      })}
    </nav>
  )
}

function SidebarContent({ userName, onNavigate }: { userName?: string; onNavigate?: () => void }) {
  const initials = userName
    ? userName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'A'
  const displayName = userName?.split(' ')[0]?.toUpperCase() ?? 'COMMANDER'

  return (
    <div className="flex flex-col h-full">
      {/* Profile section */}
      <div className="flex flex-col items-center gap-3 py-8 px-4">
        <div
          className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold ring-2"
          style={{
            background: 'var(--sidebar-accent)',
            color: 'oklch(0.92 0.004 265)',
            boxShadow: '0 0 0 2px var(--sidebar-primary)',
          }}
        >
          {initials}
        </div>
        <div className="text-center">
          <p className="text-sm font-bold tracking-wider" style={{ color: 'oklch(0.92 0.004 265)' }}>
            {displayName}
          </p>
          <div className="flex items-center justify-center gap-1.5 mt-0.5">
            <div className="h-1.5 w-1.5 rounded-full bg-sidebar-primary" />
            <p className="text-xs text-sidebar-foreground">Commander</p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-sidebar-border" />

      <NavLinks onNavigate={onNavigate} />

    </div>
  )
}

export function Sidebar({ userName }: { userName?: string }) {
  return (
    <aside className="hidden md:flex flex-col w-52 min-h-screen shrink-0 bg-sidebar">
      <SidebarContent userName={userName} />
    </aside>
  )
}

export function MobileSidebar({ userName }: { userName?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-52 border-r-0" style={{ background: 'var(--sidebar)' }}>
        <SidebarContent userName={userName} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
