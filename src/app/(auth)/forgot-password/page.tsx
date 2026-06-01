'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { requestPasswordReset } from '@/app/actions/account'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined)

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Reset password</h1>
        <p className="text-sm text-muted-foreground">We'll email you a link to set a new one.</p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm px-6 py-7 space-y-5"
        style={{ boxShadow: '0 0 40px oklch(0.14 0.012 265 / 0.8)' }}>
        {state?.success ? (
          <Alert>
            <AlertDescription>
              If an account exists for that email, a reset link is on its way. Check your inbox.
            </AlertDescription>
          </Alert>
        ) : (
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-muted-foreground uppercase tracking-wider">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@example.com" required
                className="bg-background/60 border-border/60" />
              {state?.errors?.email && <p className="text-xs text-destructive">{state.errors.email[0]}</p>}
            </div>
            <Button className="w-full" type="submit" disabled={pending}>
              {pending ? 'Sending…' : 'Send reset link'}
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
