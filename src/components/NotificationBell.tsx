'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, AlertTriangle, Tag, Target, TrendingDown } from 'lucide-react'
import { getNotifications, type AppNotification } from '@/app/actions/notifications'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const ICONS = {
  'over-budget': AlertTriangle,
  'near-budget': TrendingDown,
  'uncategorized': Tag,
  'goal-behind': Target,
}

const ICON_COLORS = {
  'over-budget': 'text-red-500',
  'near-budget': 'text-yellow-500',
  'uncategorized': 'text-yellow-600',
  'goal-behind': 'text-orange-500',
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getNotifications().then((n) => {
      setNotifications(n)
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  const count = notifications.length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="relative h-9 w-9 rounded-full flex items-center justify-center hover:bg-accent transition-colors" aria-label="Notifications">
            <Bell className="h-4.5 w-4.5 text-muted-foreground" style={{ width: 18, height: 18 }} />
            {count > 0 && (
              <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold">Notifications</p>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {!loaded ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
          ) : count === 0 ? (
            <div className="text-center py-10 px-4">
              <Bell className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">You're all caught up</p>
            </div>
          ) : (
            notifications.map((n) => {
              const Icon = ICONS[n.type]
              return (
                <Link
                  key={n.id}
                  href={n.href}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors border-b border-border last:border-0"
                >
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${ICON_COLORS[n.type]}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.detail}</p>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
