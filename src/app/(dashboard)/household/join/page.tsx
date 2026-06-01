import Link from 'next/link'
import { CheckCircle2, XCircle } from 'lucide-react'
import { acceptInvite } from '@/app/actions/household'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'

export default async function JoinHouseholdPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  const result = token
    ? await acceptInvite(token)
    : { ok: false, message: 'Missing invitation token.' }

  return (
    <div className="max-w-md mx-auto py-12">
      <Card>
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          {result.ok ? (
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
          ) : (
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
          )}
          <div>
            <h1 className="text-xl font-bold">{result.ok ? 'Welcome to the household' : 'Couldn\'t join'}</h1>
            <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
          </div>
          <div className="flex gap-2 justify-center">
            <Link href="/events" className={cn(buttonVariants())}>View shared events</Link>
            <Link href="/household" className={cn(buttonVariants({ variant: 'outline' }))}>Household</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
