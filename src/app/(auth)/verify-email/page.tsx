import Link from 'next/link'
import { CheckCircle2, XCircle } from 'lucide-react'
import { verifyEmailToken } from '@/app/actions/account'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  const ok = token ? await verifyEmailToken(token) : false

  return (
    <div className="space-y-8 text-center">
      <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm px-6 py-10 space-y-4"
        style={{ boxShadow: '0 0 40px oklch(0.14 0.012 265 / 0.8)' }}>
        {ok ? (
          <>
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <h1 className="text-xl font-bold">Email verified</h1>
            <p className="text-sm text-muted-foreground">Your account is now secured. You're all set.</p>
          </>
        ) : (
          <>
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-xl font-bold">Link invalid or expired</h1>
            <p className="text-sm text-muted-foreground">Request a fresh verification email from your profile.</p>
          </>
        )}
        <Link href="/dashboard" className={cn(buttonVariants(), 'mt-2')}>Go to dashboard</Link>
      </div>
    </div>
  )
}
