'use client'

import { useActionState, useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { resetPassword } from '@/app/actions/account'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = use(searchParams)
  const router = useRouter()
  const [state, action, pending] = useActionState(resetPassword, undefined)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (state?.success) {
      setDone(true)
      const t = setTimeout(() => router.replace('/login'), 2500)
      return () => clearTimeout(t)
    }
  }, [state, router])

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Set a new password</h1>
        <p className="text-sm text-muted-foreground">Choose a strong password you don't use elsewhere.</p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm px-6 py-7 space-y-5"
        style={{ boxShadow: '0 0 40px oklch(0.14 0.012 265 / 0.8)' }}>
        {!token ? (
          <Alert variant="destructive"><AlertDescription>Missing reset token. Request a new link.</AlertDescription></Alert>
        ) : done ? (
          <Alert><AlertDescription>Password updated. Redirecting to sign in…</AlertDescription></Alert>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="token" value={token} />
            {state?.message && (
              <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs text-muted-foreground uppercase tracking-wider">New password</Label>
              <Input id="password" name="password" type="password" placeholder="••••••••" required
                className="bg-background/60 border-border/60" />
              {state?.errors?.password && <p className="text-xs text-destructive">{state.errors.password[0]}</p>}
            </div>
            <Button className="w-full" type="submit" disabled={pending}>
              {pending ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        )}
      </div>

      <p className="text-sm text-muted-foreground text-center">
        <Link href="/login" className="text-foreground font-medium hover:underline underline-offset-4">Back to sign in</Link>
      </p>
    </div>
  )
}
