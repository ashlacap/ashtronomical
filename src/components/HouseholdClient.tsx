'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { Users, UserPlus, Crown, LogOut, Mail } from 'lucide-react'
import { createHousehold, inviteToHousehold, leaveHousehold } from '@/app/actions/household'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

type Household = {
  id: string
  name: string
  ownerId: string
  members: { id: string; name: string; email: string }[]
  invites: { id: string; email: string }[]
}

export function HouseholdClient({ currentUserId, household }: { currentUserId: string; household: Household | null }) {
  const [createState, createAction, createPending] = useActionState(createHousehold, undefined)
  const [inviteState, inviteAction, invitePending] = useActionState(inviteToHousehold, undefined)

  useEffect(() => { if (createState?.message) toast.error(createState.message) }, [createState])
  useEffect(() => {
    if (inviteState?.success) toast.success('Invitation sent.')
    else if (inviteState?.message) toast.error(inviteState.message)
  }, [inviteState])

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Household</h1>
        <p className="text-sm text-muted-foreground">Budget together — share event budgets like a wedding or trip with a partner.</p>
      </div>

      {!household ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Create a household</CardTitle>
            <CardDescription>Start a shared space, then invite your partner to budget together.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createAction} className="flex items-end gap-3">
              <div className="space-y-1.5 flex-1 max-w-xs">
                <Label htmlFor="hh-name">Household name</Label>
                <Input id="hh-name" name="name" placeholder="e.g. The Lacaps" required />
                {createState?.errors?.name && <p className="text-xs text-destructive">{createState.errors.name[0]}</p>}
              </div>
              <Button type="submit" disabled={createPending}>{createPending ? 'Creating…' : 'Create'}</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />{household.name}</CardTitle>
              <CardDescription>{household.members.length} member{household.members.length !== 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-0">
              {household.members.map((m, i) => (
                <div key={m.id}>
                  <div className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                        {(m.name || m.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          {m.name || m.email}
                          {m.id === household.ownerId && <Crown className="h-3 w-3 text-yellow-500" />}
                          {m.id === currentUserId && <Badge variant="secondary" className="text-xs">You</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground">{m.email}</p>
                      </div>
                    </div>
                  </div>
                  {i < household.members.length - 1 && <Separator />}
                </div>
              ))}
            </CardContent>
          </Card>

          {household.invites.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pending invitations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                {household.invites.map((inv, i) => (
                  <div key={inv.id}>
                    <div className="flex items-center gap-2 py-2 text-sm">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      {inv.email}
                      <Badge variant="outline" className="text-xs ml-auto">Pending</Badge>
                    </div>
                    {i < household.invites.length - 1 && <Separator />}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" />Invite a partner</CardTitle>
              <CardDescription>They'll get an email to join. Once joined, you both see shared event budgets.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={inviteAction} className="flex items-end gap-3">
                <div className="space-y-1.5 flex-1 max-w-xs">
                  <Label htmlFor="invite-email">Email address</Label>
                  <Input id="invite-email" name="email" type="email" placeholder="partner@example.com" required />
                  {inviteState?.errors?.email && <p className="text-xs text-destructive">{inviteState.errors.email[0]}</p>}
                </div>
                <Button type="submit" disabled={invitePending}>{invitePending ? 'Sending…' : 'Send invite'}</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-destructive/30">
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Leave household</p>
                <p className="text-xs text-muted-foreground">You'll lose access to shared event budgets.</p>
              </div>
              <form action={leaveHousehold}>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <LogOut className="h-3.5 w-3.5 mr-1.5" />Leave
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
