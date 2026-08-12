'use client'

import { useState } from 'react'
import { PiggyBank, X } from 'lucide-react'
import { toast } from 'sonner'
import { sweepUnspentToSavings, dismissSweepPrompt } from '@/app/actions/categories'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useCurrency } from '@/components/CurrencyProvider'

type SweepCandidate = {
  id: string
  name: string
  color: string
  leftover: number
  goal: { id: string; name: string; emoji: string }
}

export function SweepPrompt({ candidates, period }: { candidates: SweepCandidate[]; period: string }) {
  const { fmt } = useCurrency()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<string | null>(null)

  const visible = candidates.filter((c) => !dismissed.has(c.id))
  if (visible.length === 0) return null

  async function handleSweep(c: SweepCandidate) {
    setPending(c.id)
    try {
      await sweepUnspentToSavings(c.id, c.leftover, period)
      setDismissed((prev) => new Set(prev).add(c.id))
      toast.success(`Moved ${fmt(c.leftover)} from ${c.name} to ${c.goal.name}.`)
    } finally {
      setPending(null)
    }
  }

  async function handleDismiss(c: SweepCandidate) {
    setDismissed((prev) => new Set(prev).add(c.id))
    await dismissSweepPrompt(c.id, period)
  }

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-center gap-2">
          <PiggyBank className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Last month&apos;s leftover budget</p>
        </div>
        <div className="space-y-2">
          {visible.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <p className="text-sm min-w-0 truncate">
                  <span className="font-medium">{fmt(c.leftover)}</span> left in {c.name} — move to {c.goal.emoji} {c.goal.name}?
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button size="sm" className="h-7 text-xs" disabled={pending === c.id} onClick={() => handleSweep(c)}>
                  {pending === c.id ? 'Moving…' : 'Move it'}
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDismiss(c)} aria-label="Dismiss">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
