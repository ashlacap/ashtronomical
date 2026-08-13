'use client'

import { useActionState, useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, RefreshCw, PiggyBank, SlidersHorizontal } from 'lucide-react'
import { upsertBudget } from '@/app/actions/budget'
import { createCategory, updateCategory, deleteCategory, applyPlan, resetToPlan } from '@/app/actions/categories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useCurrency } from '@/components/CurrencyProvider'
import { PlanPicker } from '@/components/PlanPicker'

export type Category = {
  id: string
  name: string
  budgetAmount: number
  color: string
  keywords: string[]
  rollover: boolean
  savingsGoalId: string | null
}

type SavingsGoal = { id: string; name: string; emoji: string }

type EditCategory = Category | null

function CategoryDialog({
  open,
  onClose,
  category,
  savingsGoals,
}: {
  open: boolean
  onClose: () => void
  category: EditCategory
  savingsGoals: SavingsGoal[]
}) {
  const isEdit = !!category
  const boundUpdate = isEdit ? updateCategory.bind(null, category!.id) : undefined
  const [sweepToSavings, setSweepToSavings] = useState(!!category?.savingsGoalId)

  const [createState, createAction, createPending] = useActionState(createCategory, undefined)
  const [updateState, updateAction, updatePending] = useActionState(
    boundUpdate ?? createCategory,
    undefined,
  )

  const state = isEdit ? updateState : createState
  const action = isEdit ? updateAction : createAction
  const pending = isEdit ? updatePending : createPending

  useEffect(() => {
    if (state?.success) {
      toast.success(isEdit ? 'Category updated.' : 'Category created.')
      onClose()
    }
  }, [state])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Category' : 'New Category'}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name</Label>
            <Input id="cat-name" name="name" defaultValue={category?.name} required />
            {state?.errors?.name && <p className="text-sm text-destructive">{state.errors.name[0]}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-budget">Monthly Budget ($)</Label>
            <Input id="cat-budget" name="budgetAmount" type="number" min="0" step="0.01" defaultValue={category?.budgetAmount} required />
            {state?.errors?.budgetAmount && <p className="text-sm text-destructive">{state.errors.budgetAmount[0]}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-color">Color</Label>
            <div className="flex items-center gap-2">
              <input id="cat-color" name="color" type="color" defaultValue={category?.color ?? '#6366f1'} className="h-9 w-16 rounded border cursor-pointer" />
              <span className="text-sm text-muted-foreground">Category accent color</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-keywords">Keywords (comma-separated)</Label>
            <Input
              id="cat-keywords"
              name="keywords"
              placeholder="e.g. starbucks, coffee, cafe"
              defaultValue={category?.keywords.join(', ')}
            />
            <p className="text-xs text-muted-foreground">Used to auto-categorize transactions</p>
          </div>

          <Separator />

          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">At month-end, unspent budget…</p>

          <div className="flex items-center gap-2">
            <input
              id="cat-rollover"
              name="rollover"
              type="checkbox"
              value="true"
              defaultChecked={category?.rollover ?? false}
              className="h-4 w-4 rounded border cursor-pointer"
            />
            <Label htmlFor="cat-rollover" className="cursor-pointer font-normal flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
              Roll over to next month's budget
            </Label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                id="cat-sweep"
                type="checkbox"
                checked={sweepToSavings}
                onChange={(e) => setSweepToSavings(e.target.checked)}
                className="h-4 w-4 rounded border cursor-pointer"
              />
              <Label htmlFor="cat-sweep" className="cursor-pointer font-normal flex items-center gap-1.5">
                <PiggyBank className="h-3.5 w-3.5 text-muted-foreground" />
                Transfer to a savings goal
              </Label>
            </div>
            {sweepToSavings && (
              <div className="ml-6 space-y-1.5">
                {savingsGoals.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No savings goals yet. <a href="/goals" className="text-primary hover:underline">Create one first →</a>
                  </p>
                ) : (
                  <>
                    <Label htmlFor="cat-savingsGoalId" className="text-xs">Which goal?</Label>
                    <select
                      id="cat-savingsGoalId"
                      name="savingsGoalId"
                      defaultValue={category?.savingsGoalId ?? ''}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    >
                      <option value="">Select a goal…</option>
                      {savingsGoals.map((g) => (
                        <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      A sweep prompt will appear on the dashboard when this month closes.
                    </p>
                  </>
                )}
              </div>
            )}
            {!sweepToSavings && <input type="hidden" name="savingsGoalId" value="" />}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ResetPlanSection({ suggestedIncome, onCustom }: { suggestedIncome: number; onCustom: () => void }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="text-center py-2">
        <p className="text-xs text-muted-foreground">
          Want a different starting point?
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-2 gap-1.5" onClick={() => setOpen(true)}>
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Re-choose allocation split
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-choose allocation split</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This replaces all of your current categories and budgets with the plan you pick below.
            Transactions already assigned to a category will go back to Uncategorized.
          </p>
          <PlanPicker
            suggestedIncome={suggestedIncome}
            onCustom={() => { setOpen(false); onCustom() }}
            onApply={resetToPlan}
            successVerb="Replaced with"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

export function BudgetClient({
  initialIncome,
  initialCategories,
  totalBudgeted,
  savingsGoals,
}: {
  initialIncome: number
  initialCategories: Category[]
  totalBudgeted: number
  savingsGoals: SavingsGoal[]
}) {
  const { fmt: formatCurrency } = useCurrency()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<EditCategory>(null)
  const [incomeState, incomeAction, incomePending] = useActionState(upsertBudget, undefined)

  useEffect(() => {
    if (incomeState?.success) toast.success('Income updated.')
  }, [incomeState])

  const remaining = initialIncome - totalBudgeted

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Allocations <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider ml-2 align-middle">Fuel Allocation</span></h1>
        <p className="text-muted-foreground text-sm">Set your monthly income and allocate it across spending categories so you always know what&apos;s left.</p>
      </div>

      {/* Income card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Fuel</CardTitle>
          <CardDescription>Your total take-home income for the month.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={incomeAction} className="space-y-3">
            <input type="hidden" name="previousIncome" value={initialIncome} />
            <div className="flex items-end gap-3">
              <div className="space-y-1.5 flex-1 max-w-xs">
                <Label htmlFor="monthlyIncome">Amount</Label>
                <Input
                  id="monthlyIncome"
                  name="monthlyIncome"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={initialIncome}
                  required
                />
              </div>
              <Button type="submit" disabled={incomePending}>
                {incomePending ? 'Saving…' : 'Update'}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="adjustCategories"
                name="adjustCategories"
                type="checkbox"
                value="true"
                defaultChecked
                className="h-4 w-4 rounded border cursor-pointer"
              />
              <Label htmlFor="adjustCategories" className="cursor-pointer font-normal text-xs text-muted-foreground">
                Proportionally adjust all category budgets when income changes
              </Label>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Allocation summary */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">Income: <strong className="text-foreground">{formatCurrency(initialIncome)}</strong></span>
        <span className="text-muted-foreground">Budgeted: <strong className="text-foreground">{formatCurrency(totalBudgeted)}</strong></span>
        <Badge variant={remaining < 0 ? 'destructive' : 'secondary'}>
          {remaining < 0 ? 'Over by ' : 'Unallocated: '}{formatCurrency(Math.abs(remaining))}
        </Badge>
      </div>

      {/* Categories */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Sectors</CardTitle>
            <CardDescription>Allocate fuel to each sector and set auto-tagging keywords.</CardDescription>
          </div>
          <Button size="sm" onClick={() => { setEditCategory(null); setDialogOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Add Category
          </Button>
        </CardHeader>
        <CardContent className="space-y-0">
          {initialCategories.map((cat, i) => (
            <div key={cat.id}>
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{cat.name}</p>
                      {cat.rollover && (
                        <Badge variant="secondary" className="text-xs h-4 px-1.5 gap-0.5">
                          <RefreshCw className="h-2.5 w-2.5" />
                          Rollover
                        </Badge>
                      )}
                      {cat.savingsGoalId && (
                        <Badge variant="secondary" className="text-xs h-4 px-1.5 gap-0.5">
                          <PiggyBank className="h-2.5 w-2.5" />
                          {savingsGoals.find(g => g.id === cat.savingsGoalId)?.name ?? 'Savings'}
                        </Badge>
                      )}
                    </div>
                    {cat.keywords.length > 0 && (
                      <p className="text-xs text-muted-foreground">{cat.keywords.slice(0, 3).join(', ')}{cat.keywords.length > 3 ? '…' : ''}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{formatCurrency(cat.budgetAmount)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => { setEditCategory(cat); setDialogOpen(true) }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <form action={deleteCategory.bind(null, cat.id)}>
                    <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                </div>
              </div>
              {i < initialCategories.length - 1 && <Separator />}
            </div>
          ))}
          {initialCategories.length === 0 && (
            <PlanPicker
              suggestedIncome={initialIncome}
              onCustom={() => { setEditCategory(null); setDialogOpen(true) }}
              onApply={applyPlan}
            />
          )}
        </CardContent>
      </Card>

      {initialCategories.length > 0 && (
        <ResetPlanSection
          suggestedIncome={initialIncome}
          onCustom={() => { setEditCategory(null); setDialogOpen(true) }}
        />
      )}

      <CategoryDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        category={editCategory}
        savingsGoals={savingsGoals}
      />
    </div>
  )
}
