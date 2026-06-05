'use client'

import { useActionState, useState, useEffect } from 'react'
import { toast } from 'sonner'
import { updateProfile, changePassword, deleteAccount } from '@/app/actions/user'
import { sendVerificationEmail } from '@/app/actions/account'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertTriangle, CalendarDays, Mail, User, BadgeCheck, MailWarning } from 'lucide-react'

export function ProfileClient({
  name,
  email,
  createdAt,
  emailVerified,
}: {
  name: string
  email: string
  createdAt: string
  emailVerified: boolean
}) {
  const [resending, setResending] = useState(false)
  const [profileState, profileAction, profilePending] = useActionState(updateProfile, undefined)
  const [passwordState, passwordAction, passwordPending] = useActionState(changePassword, undefined)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  useEffect(() => {
    if (profileState?.success) toast.success('Profile updated.')
  }, [profileState])

  useEffect(() => {
    if (passwordState?.success) toast.success('Password changed.')
  }, [passwordState])

  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : email[0].toUpperCase()

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your personal information and account security</p>
      </div>

      {/* Avatar + info */}
      <Card>
        <CardContent className="pt-6 flex items-center gap-5">
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold shrink-0 text-white"
            style={{ background: 'var(--sidebar)' }}
          >
            {initials}
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-lg">{name || 'No name set'}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />{email}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />Member since {createdAt}
            </p>
            <div className="pt-1">
              {emailVerified ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                  <BadgeCheck className="h-3.5 w-3.5" /> Email verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-600">
                  <MailWarning className="h-3.5 w-3.5" /> Email not verified
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {!emailVerified && (
        <Card className="border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="pt-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <MailWarning className="h-5 w-5 text-yellow-600 shrink-0" />
              <div>
                <p className="text-sm font-medium">Verify your email address</p>
                <p className="text-xs text-muted-foreground">Confirm your email to secure your account and enable recovery.</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={resending}
              onClick={async () => {
                setResending(true)
                const res = await sendVerificationEmail()
                setResending(false)
                if (res?.success) toast.success('Verification email sent — check your inbox (and spam).')
                else toast.error(res?.message ?? 'Could not send the email.')
              }}
            >
              {resending ? 'Sending…' : 'Resend'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" />Personal information</CardTitle>
          <CardDescription>Update your name and email address</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={profileAction} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="profile-name">Full name</Label>
                <Input id="profile-name" name="name" defaultValue={name} required />
                {profileState?.errors?.name && <p className="text-xs text-destructive">{profileState.errors.name[0]}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-email">Email address</Label>
                <Input id="profile-email" name="email" type="email" defaultValue={email} required />
                {profileState?.errors?.email && <p className="text-xs text-destructive">{profileState.errors.email[0]}</p>}
              </div>
            </div>
            <Button type="submit" disabled={profilePending}>
              {profilePending ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Password</CardTitle>
          <CardDescription>Change your account password</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={passwordAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Current password</Label>
              <Input id="current-password" name="currentPassword" type="password" required />
              {passwordState?.errors?.currentPassword && <p className="text-xs text-destructive">{passwordState.errors.currentPassword[0]}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" name="newPassword" type="password" required />
              {passwordState?.errors?.newPassword && <p className="text-xs text-destructive">{passwordState.errors.newPassword[0]}</p>}
            </div>
            <Button type="submit" disabled={passwordPending}>
              {passwordPending ? 'Changing…' : 'Change password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />Danger zone
          </CardTitle>
          <CardDescription>Permanently delete your account and all associated data</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            Delete account
          </Button>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>This will permanently delete your account, all transactions, budgets, goals, and linked bank accounts. <strong className="text-foreground">This cannot be undone.</strong></p>
            <p>Type <strong className="text-foreground">DELETE</strong> to confirm.</p>
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Type DELETE to confirm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <form action={deleteAccount}>
              <Button
                type="submit"
                variant="destructive"
                disabled={deleteConfirm !== 'DELETE'}
              >
                Delete my account
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
