'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Eye, EyeOff } from 'lucide-react'
import { setPlaidAccountExcluded } from '@/app/actions/plaid'
import { Button } from '@/components/ui/button'

export function AccountExcludeToggle({ accountRowId, excluded }: { accountRowId: string; excluded: boolean }) {
  const [isExcluded, setIsExcluded] = useState(excluded)
  const [pending, startTransition] = useTransition()

  function toggle() {
    const next = !isExcluded
    setIsExcluded(next)
    startTransition(async () => {
      await setPlaidAccountExcluded(accountRowId, next)
      toast.success(next ? 'Account excluded from totals.' : 'Account included in totals.')
    })
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      onClick={toggle}
      disabled={pending}
      title={isExcluded ? 'Include in balances and spending' : 'Exclude from balances and spending'}
      aria-label={isExcluded ? 'Include account in totals' : 'Exclude account from totals'}
    >
      {isExcluded ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5" />}
    </Button>
  )
}
