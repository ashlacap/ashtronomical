'use client'

import { useActionState, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { completeOnboarding } from '@/app/actions/onboarding'
import { PLANS, type PlanId } from '@/lib/plans'
import { AshtroIcon } from '@/components/AshtroIcon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { CheckCircle, SlidersHorizontal } from 'lucide-react'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

type AnyPlanId = PlanId | 'custom'

const CUSTOM_PLAN = {
  id: 'custom' as const,
  name: 'Set it up myself',
  description: 'Skip the presets and build your own categories from scratch in the Budget page.',
  buckets: {} as Record<string, number>,
  categories: [] as { name: string; color: string; pct: number; bucket: string }[],
}

const ALL_PLANS = [...Object.values(PLANS), CUSTOM_PLAN]

const BUCKET_COLORS: Record<string, string> = {
  Needs:   'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  Wants:   'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  Savings: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  Living:  'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  Debt:    'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
}

export default function OnboardingPage() {
  const router = useRouter()
  const [selectedPlan, setSelectedPlan] = useState<AnyPlanId>('50-30-20')
  const [income, setIncome] = useState(5000)
  const [state, action, pending] = useActionState(completeOnboarding, undefined)

  useEffect(() => {
    if (state?.success) router.replace('/dashboard')
  }, [state])

  const plan = selectedPlan === 'custom' ? CUSTOM_PLAN : PLANS[selectedPlan]
  const isCustom = selectedPlan === 'custom'

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Left panel ── */}
      <div className="w-full lg:w-[460px] shrink-0 flex flex-col border-r border-border px-10 py-12 overflow-y-auto">
        <div className="space-y-8 flex-1">
          <div className="flex items-center gap-2">
            <AshtroIcon className="h-5 w-5" />
            <span className="font-bold text-xs tracking-[0.25em] uppercase">Ashtronomical</span>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Set up your budget</h1>
            <p className="text-sm text-muted-foreground">
              Pick a plan and enter your monthly take-home income. Everything is editable after setup.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="income-input" className="text-sm font-semibold">Monthly take-home income</Label>
            <p className="text-xs text-muted-foreground">After taxes and deductions</p>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-semibold">$</span>
              <Input
                id="income-input"
                type="number"
                min="1"
                step="100"
                value={income}
                onChange={(e) => setIncome(parseFloat(e.target.value) || 0)}
                className="text-base font-semibold max-w-xs"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Choose a budgeting plan</p>
            <div className="space-y-2">
              {ALL_PLANS.map((p) => {
                const active = selectedPlan === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPlan(p.id as AnyPlanId)}
                    className={cn(
                      'w-full text-left rounded-xl border-2 px-4 py-3 transition-all',
                      active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 bg-card',
                    )}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{p.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{p.description}</p>
                        {Object.keys(p.buckets).length > 0 && (
                          <div className="flex gap-1.5 flex-wrap mt-2">
                            {Object.entries(p.buckets).map(([bucket, pct]) => (
                              <span key={bucket} className={cn('text-xs px-2 py-0.5 rounded-full font-medium', BUCKET_COLORS[bucket] ?? 'bg-muted')}>
                                {pct}% {bucket}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {active
                        ? <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                        : p.id === 'custom'
                        ? <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
                        : <div className="h-5 w-5 rounded-full border-2 border-muted shrink-0" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <form action={action} className="mt-8 space-y-2">
          <input type="hidden" name="planId" value={selectedPlan} />
          <input type="hidden" name="monthlyIncome" value={income} />
          <Button type="submit" className="w-full h-11" disabled={pending || income <= 0}>
            {pending ? 'Setting up…' : isCustom ? 'Launch and set up manually →' : 'Launch my budget →'}
          </Button>
          {state?.errors?.monthlyIncome && (
            <p className="text-sm text-destructive">{state.errors.monthlyIncome[0]}</p>
          )}
        </form>
      </div>

      {/* ── Right panel: live preview ── */}
      <div className="hidden lg:flex flex-1 flex-col justify-center px-16 py-12 bg-muted/20 overflow-y-auto">
        {isCustom ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 text-muted-foreground">
            <SlidersHorizontal className="h-16 w-16 opacity-20" />
            <div>
              <p className="font-semibold text-lg text-foreground">You're in full control</p>
              <p className="text-sm mt-1">After launching, go to Fuel Allocation to add your own spending categories.</p>
            </div>
          </div>
        ) : income > 0 ? (
          <div className="space-y-6 max-w-2xl w-full mx-auto">
            <div>
              <h2 className="text-xl font-bold">Budget preview</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Based on <strong>{fmt(income)}/mo</strong> · {plan.name}
              </p>
            </div>

            {/* Bucket totals */}
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Object.keys(plan.buckets).length}, 1fr)` }}>
              {Object.entries(plan.buckets).map(([bucket, pct]) => (
                <div key={bucket} className="bg-card border border-border rounded-xl p-4 text-center space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{bucket}</p>
                  <p className="text-2xl font-bold">{pct}%</p>
                  <p className="text-sm font-semibold">{fmt((pct / 100) * income)}/mo</p>
                </div>
              ))}
            </div>

            {/* Per-category rows */}
            <div className="space-y-2">
              {plan.categories.map((cat) => {
                const amount = Math.round((cat.pct / 100) * income)
                return (
                  <div key={cat.name} className="bg-card border border-border rounded-lg px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-sm font-medium">{cat.name}</span>
                        <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', BUCKET_COLORS[cat.bucket] ?? 'bg-muted')}>
                          {cat.bucket}
                        </span>
                      </div>
                      <span className="text-sm font-bold tabular-nums">{fmt(amount)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${cat.pct}%`, backgroundColor: cat.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
