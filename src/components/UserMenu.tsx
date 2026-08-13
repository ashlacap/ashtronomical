'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { logout, switchAccount, type SwitchableAccount } from '@/app/actions/auth'
import { User, Settings, LogOut, BarChart3, Repeat, Lock } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface UserMenuProps {
  initials: string
  userName: string
  isAdmin?: boolean
  switchableAccounts?: SwitchableAccount[]
}

function SwitchPasswordDialog({
  account,
  onClose,
}: {
  account: SwitchableAccount | null
  onClose: () => void
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit() {
    if (!account) return
    setError(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set('userId', account.id)
      formData.set('password', password)
      const result = await switchAccount(undefined, formData)
      // switchAccount redirects on success, so only an error result reaches here.
      if (result?.error) setError(result.error === 'PASSWORD_REQUIRED' ? 'Password required.' : result.error)
    })
  }

  return (
    <Dialog open={!!account} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Switch to {account?.name || account?.email}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Confirm the password once — you won&apos;t need to re-enter it to switch back during this session.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="switch-password">Password</Label>
            <Input
              id="switch-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={pending || !password}>
            {pending ? 'Switching…' : 'Switch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function UserMenu({ initials, userName, isAdmin, switchableAccounts = [] }: UserMenuProps) {
  const [passwordPromptFor, setPasswordPromptFor] = useState<SwitchableAccount | null>(null)
  const [, startTransition] = useTransition()

  const others = switchableAccounts.filter((a) => !a.active)

  function handleSwitch(account: SwitchableAccount) {
    if (!account.unlocked) {
      setPasswordPromptFor(account)
      return
    }
    startTransition(async () => {
      const formData = new FormData()
      formData.set('userId', account.id)
      const result = await switchAccount(undefined, formData)
      if (result?.error) toast.error(result.error)
    })
  }

  return (
    <>
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
        <DropdownMenuContent align="end" className="w-52">
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
          {others.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Switch account
              </div>
              {others.map((account) => (
                <DropdownMenuItem key={account.id} className="gap-2" onClick={() => handleSwitch(account)}>
                  <Repeat className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{account.name || account.email}</span>
                  {!account.unlocked && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
                </DropdownMenuItem>
              ))}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" className="gap-2" onClick={() => logout()}>
            <LogOut className="h-4 w-4" />
            Eject
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SwitchPasswordDialog account={passwordPromptFor} onClose={() => setPasswordPromptFor(null)} />
    </>
  )
}
