'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { login } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined)

  return (
    <div className="space-y-8">
      {/* Brand */}
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-2">
          <StarIcon className="h-6 w-6 text-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">ashtronomical</h1>
        <p className="text-sm text-muted-foreground">Your financial universe, mapped.</p>
      </div>

      {/* Form panel */}
      <div
        className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm px-6 py-7 space-y-5"
        style={{ boxShadow: '0 0 40px oklch(0.14 0.012 265 / 0.8)' }}
      >
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Welcome back</h2>
          <p className="text-xs text-muted-foreground">Sign in to continue your mission</p>
        </div>

        {state?.message && (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}

        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs text-muted-foreground uppercase tracking-wider">Email</Label>
            <Input id="email" name="email" type="email" placeholder="you@example.com" required
              className="bg-background/60 border-border/60 focus:border-foreground/30" />
            {state?.errors?.email && (
              <p className="text-xs text-destructive">{state.errors.email[0]}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs text-muted-foreground uppercase tracking-wider">Password</Label>
            <Input id="password" name="password" type="password" placeholder="••••••••" required
              className="bg-background/60 border-border/60 focus:border-foreground/30" />
            {state?.errors?.password && (
              <p className="text-xs text-destructive">{state.errors.password[0]}</p>
            )}
          </div>
          <Button className="w-full mt-2" type="submit" disabled={pending}>
            {pending ? 'Initiating launch…' : 'Launch into orbit'}
          </Button>
          <p className="text-center">
            <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-4">
              Forgot your password?
            </Link>
          </p>
        </form>
      </div>

      <p className="text-sm text-muted-foreground text-center">
        New to the cosmos?{' '}
        <Link href="/register" className="text-foreground font-medium hover:underline underline-offset-4">
          Create your universe
        </Link>
      </p>
    </div>
  )
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L13.8 8.8L20.9 10L13.8 11.2L12 18L10.2 11.2L3.1 10L10.2 8.8L12 2Z" />
      <circle cx="4" cy="4" r="1" opacity="0.4" />
      <circle cx="20" cy="6" r="0.7" opacity="0.3" />
      <circle cx="19" cy="18" r="0.9" opacity="0.35" />
      <circle cx="5" cy="19" r="0.6" opacity="0.3" />
    </svg>
  )
}
