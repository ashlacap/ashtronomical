'use client'

import { useTransition } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Check, HelpCircle } from 'lucide-react'
import { markKnownRecurring } from '@/app/actions/transactions'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCurrency } from '@/components/CurrencyProvider'

type Bill = {
  merchant: string
  displayName: string
  avgAmount: number
  monthsDetected: number
  lastDate: string
  isLikelyFixed: boolean
  isKnown: boolean
}

export function RecurringBillsList({ bills }: { bills: Bill[] }) {
  const { fmt } = useCurrency()
  const [, startTransition] = useTransition()

  function toggle(bill: Bill) {
    startTransition(async () => {
      await markKnownRecurring(bill.displayName, bill.displayName, !bill.isKnown)
      toast.success(bill.isKnown ? 'Unmarked.' : `Acknowledged ${bill.displayName}.`)
    })
  }

  const unacknowledged = bills.filter((b) => !b.isKnown).length

  return (
    <div className="space-y-0">
      {unacknowledged > 0 && (
        <div className="flex items-center gap-2 px-1 pb-3 text-xs text-muted-foreground">
          <HelpCircle className="h-3.5 w-3.5" />
          {unacknowledged} unacknowledged — mark the ones you recognize so surprises stand out.
        </div>
      )}
      {bills.map((bill, i) => (
        <div key={bill.merchant}>
          <div className="flex items-center justify-between py-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium capitalize truncate">{bill.displayName}</p>
                {bill.isKnown ? (
                  <Badge variant="secondary" className="text-xs gap-0.5"><Check className="h-2.5 w-2.5" />Known</Badge>
                ) : (
                  <Badge className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">New?</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Detected in {bill.monthsDetected} months · last {format(new Date(bill.lastDate), 'MMM d')}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">{fmt(bill.avgAmount)}<span className="text-xs text-muted-foreground font-normal">/mo</span></p>
                {bill.isLikelyFixed && <p className="text-xs text-muted-foreground">{fmt(bill.avgAmount * 12)}/yr</p>}
              </div>
              <Button
                size="sm"
                variant={bill.isKnown ? 'ghost' : 'outline'}
                className="h-7 text-xs"
                onClick={() => toggle(bill)}
              >
                {bill.isKnown ? 'Unmark' : 'I know this'}
              </Button>
            </div>
          </div>
          {i < bills.length - 1 && <Separator />}
        </div>
      ))}
    </div>
  )
}
