'use client'

import Link from 'next/link'
import { logout } from '@/app/actions/auth'
import { User, Settings, LogOut, BarChart3 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface UserMenuProps {
  initials: string
  userName: string
  isAdmin?: boolean
}

export function UserMenu({ initials, userName, isAdmin }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="flex items-center gap-2.5 focus:outline-none" aria-label="Open user menu">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold uppercase tracking-wider leading-none">
                {userName || 'Commander'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Active</p>
            </div>
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold hover:opacity-80 transition-opacity"
              style={{ background: 'var(--sidebar)', color: 'oklch(0.92 0.004 265)' }}
            >
              {initials}
            </div>
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem className="gap-2" render={<Link href="/profile" />}>
          <User className="h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" render={<Link href="/settings" />}>
          <Settings className="h-4 w-4" />
          Settings
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem className="gap-2" render={<Link href="/admin" />}>
            <BarChart3 className="h-4 w-4" />
            Admin
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" className="gap-2" onClick={() => logout()}>
          <LogOut className="h-4 w-4" />
          Eject
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
