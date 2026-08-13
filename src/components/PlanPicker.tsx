'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { SlidersHorizontal, Sparkles } from 'lucide-react'
import { PLANS, type PlanId } from '@/lib/plans'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * Plan-picker UI shared by two places on Allocations: the empty-state (zero
 * categories yet) and the "reset allocation split" flow further down the
 * page. The two differ only in which server action they call and what
 * happens to existing categories, so that's passed in rather than forked.
 */
export function PlanPicker({
  suggestedIncome,
  onCustom,
  onApply,
  successVerb = 'Added',
}: {
  suggestedIncome: number
  onCustom: () => void
  onApply: (planId: PlanId, income: number) => Promise<{ success: boolean; created: number }>
  successVerb?: string
}) {
  const [selectedPlan, setSelectedPlan] = useState<PlanId | ''>('')
  const [income, setIncome] = useState(suggestedIncome > 0 ? String(suggestedIncome) : '')
  const [pending, startTransition] = useTransition()

  function handleApply() {
    const parsedIncome = parseFloat(income)
    if (!selectedPlan || !parsedIncome || parsedIncome <= 0) return
    startTransition(async () => {
      const result = await onApply(selectedPlan, parsedIncome)
      if (result.success) {
        toast.success(`${successVerb} ${result.created} categories from ${PLANS[selectedPlan].name}.`)
      } else {
        toast.error('Could not apply that plan.')
      }
    })
  }

  return (
    <div className="py-6 space-y-5 max-w-xl mx-auto text-center">
      <div>
        <p className="text-sm font-medium">Choose a starting plan</p>
        <p className="text-xs text-muted-foreground mt-1">
          Pick a preset split to get categories and budgets set up instantly — everything&apos;s editable after.
        </p>
      </div>

      <div className="space-y-2 text-left">
        {Object.values(PLANS).map((plan) => {
          const active = selectedPlan === plan.id
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedPlan(plan.id)}
              className={cn(
                'w-full text-left rounded-xl border-2 px-4 py-3 transition-all',
                active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 bg-card',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{plan.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
                </div>
                {active
                  ? <Sparkles className="h-4 w-4 text-primary shrink-0" />
                  : <div className="h-4 w-4 rounded-full border-2 border-muted shrink-0" />}
              </div>
            </button>
          )
        })}
      </div>

      {selectedPlan && (
        <div className="space-y-2 text-left">
          <Label htmlFor="plan-income" className="text-xs">Monthly income</Label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-semibold">$</span>
            <Input
              id="plan-income"
              type="number"
              min="1"
              step="100"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              className="max-w-[10rem]"
            />
            <Button onClick={handleApply} disabled={pending || !income || parseFloat(income) <= 0}>
              {pending ? 'Applying…' : 'Apply plan'}
            </Button>
          </div>
        </div>
      )}

      <div className="pt-1">
        <Button type="button" variant="ghost" size="sm" className="text-xs gap-1.5 text-muted-foreground" onClick={onCustom}>
          <SlidersHorizontal className="h-3.5 w-3.5" />
          None of these — I&apos;ll build my own
        </Button>
      </div>
    </div>
  )
}
