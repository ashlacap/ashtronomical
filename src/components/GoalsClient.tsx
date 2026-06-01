'use client'

import { useActionState, useState, useEffect } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Plus, Pencil, Trash2, PlusCircle, TrendingUp, History } from 'lucide-react'
import { differenceInCalendarMonths, startOfMonth } from 'date-fns'
import { createGoal, updateGoal, deleteGoal, addToGoal, getGoalContributions } from '@/app/actions/goals'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmojiPickerButton } from '@/components/EmojiPickerButton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useCurrency } from '@/components/CurrencyProvider'

type Goal = {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  targetDate: string | null
  color: string
  emoji: string
}


function GoalDialog({
  open,
  onClose,
  goal,
}: {
  open: boolean
  onClose: () => void
  goal: Goal | null
}) {
  const isEdit = !!goal
  const [selectedEmoji, setSelectedEmoji] = useState(goal?.emoji ?? '🎯')

  useEffect(() => {
    setSelectedEmoji(goal?.emoji ?? '🎯')
  }, [goal])

  const boundUpdate = isEdit ? updateGoal.bind(null, goal!.id) : undefined

  const [createState, createAction, createPending] = useActionState(createGoal, undefined)
  const [updateState, updateAction, updatePending] = useActionState(
    boundUpdate ?? createGoal,
    undefined,
  )

  const state = isEdit ? updateState : createState
  const action = isEdit ? updateAction : createAction
  const pending = isEdit ? updatePending : createPending

  useEffect(() => {
    if (state?.success) {
      toast.success(isEdit ? 'Goal updated.' : 'Goal created.')
      onClose()
    }
  }, [state])

  const defaultDate = goal?.targetDate
    ? goal.targetDate.slice(0, 10)
    : ''

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Goal' : 'New Savings Goal'}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="goal-name">Goal name</Label>
              <Input id="goal-name" name="name" placeholder="e.g. Emergency Fund" defaultValue={goal?.name} required />
              {state?.errors?.name && <p className="text-sm text-destructive">{state.errors.name[0]}</p>}
            </div>
            <div className="space-y-1.5 flex flex-col items-center">
              <Label>Emoji</Label>
              <EmojiPickerButton name="emoji" value={selectedEmoji} onChange={setSelectedEmoji} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="goal-target">Target amount ($)</Label>
              <Input id="goal-target" name="targetAmount" type="number" min="1" step="0.01" defaultValue={goal?.targetAmount} required />
              {state?.errors?.targetAmount && <p className="text-sm text-destructive">{state.errors.targetAmount[0]}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-current">Current amount ($)</Label>
              <Input id="goal-current" name="currentAmount" type="number" min="0" step="0.01" defaultValue={goal?.currentAmount ?? 0} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="goal-date">Target date (optional)</Label>
              <Input id="goal-date" name="targetDate" type="date" defaultValue={defaultDate} />
            </div>
            <div className="space-y-1.5 self-end">
              <Label htmlFor="goal-color">Color</Label>
              <input id="goal-color" name="color" type="color" defaultValue={goal?.color ?? '#22c55e'} className="h-9 w-full rounded border cursor-pointer" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create goal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddFundsDialog({
  open,
  onClose,
  goal,
}: {
  open: boolean
  onClose: () => void
  goal: Goal | null
}) {
  const { fmt } = useCurrency()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)

  if (!goal) return null

  async function handleAdd() {
    if (!goal) return
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) return
    setPending(true)
    await addToGoal(goal.id, parsed, note)
    toast.success(`Added ${fmt(parsed)} to ${goal.name}.`)
    setPending(false)
    setAmount('')
    setNote('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add funds — {goal.emoji} {goal.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="add-amount">Amount to add ($)</Label>
            <Input
              id="add-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-note">Note (optional)</Label>
            <Input
              id="add-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Tax refund, bonus"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Current: {fmt(goal.currentAmount)} / {fmt(goal.targetAmount)}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAdd} disabled={pending || !amount}>
            {pending ? 'Adding…' : 'Add funds'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function GoalsClient({ initialGoals }: { initialGoals: Goal[] }) {
  const { fmt } = useCurrency()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [addFundsOpen, setAddFundsOpen] = useState(false)
  const [historyGoal, setHistoryGoal] = useState<Goal | null>(null)
  const [editGoal, setEditGoal] = useState<Goal | null>(null)
  const [addFundsGoal, setAddFundsGoal] = useState<Goal | null>(null)

  const totalSaved = initialGoals.reduce((s, g) => s + g.currentAmount, 0)
  const totalTarget = initialGoals.reduce((s, g) => s + g.targetAmount, 0)
  const completed = initialGoals.filter((g) => g.currentAmount >= g.targetAmount).length

  return (
    <div className="space-y-6">
      {/* Summary */}
      {initialGoals.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total saved</p>
              <p className="text-xl font-bold mt-0.5">{fmt(totalSaved)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total targets</p>
              <p className="text-xl font-bold mt-0.5">{fmt(totalTarget)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Goals completed</p>
              <p className="text-xl font-bold mt-0.5">{completed} / {initialGoals.length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Goal cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {initialGoals.map((goal) => {
          const pct = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)
          const remaining = goal.targetAmount - goal.currentAmount
          const done = goal.currentAmount >= goal.targetAmount

          return (
            <Card key={goal.id} className="relative">
              <CardHeader className="pb-2 flex flex-row items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl leading-none">{goal.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{goal.name}</p>
                    {goal.targetDate && (
                      <p className="text-xs text-muted-foreground">
                        By {format(new Date(goal.targetDate), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setHistoryGoal(goal)}
                    title="Contribution history"
                  >
                    <History className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => { setEditGoal(goal); setDialogOpen(true) }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <form action={deleteGoal.bind(null, goal.id)}>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{fmt(goal.currentAmount)} saved</span>
                    <span>{fmt(goal.targetAmount)} goal</span>
                  </div>
                  <Progress value={pct} className="h-2" style={{ '--progress-color': goal.color } as React.CSSProperties} />
                </div>
                {!done && (() => {
                  const now = new Date()
                  const targetDate = goal.targetDate ? new Date(goal.targetDate) : null
                  const monthsLeft = targetDate
                    ? Math.max(0, differenceInCalendarMonths(startOfMonth(targetDate), startOfMonth(now)))
                    : null
                  const monthlyNeeded = monthsLeft && monthsLeft > 0 && remaining > 0
                    ? remaining / monthsLeft
                    : null
                  if (!monthlyNeeded) return null
                  return (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <TrendingUp className="h-3 w-3 shrink-0" />
                      <span>Save <strong className="text-foreground">{fmt(monthlyNeeded)}/mo</strong> to reach goal in {monthsLeft} month{monthsLeft !== 1 ? 's' : ''}</span>
                    </div>
                  )
                })()}
                <div className="flex items-center justify-between">
                  {done ? (
                    <Badge variant="secondary" className="text-xs">Completed!</Badge>
                  ) : (
                    <p className="text-xs text-muted-foreground">{fmt(remaining)} to go · {pct.toFixed(0)}%</p>
                  )}
                  {!done && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => { setAddFundsGoal(goal); setAddFundsOpen(true) }}
                    >
                      <PlusCircle className="h-3 w-3 mr-1" />
                      Add funds
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}

        {/* New goal card */}
        <button
          onClick={() => { setEditGoal(null); setDialogOpen(true) }}
          className="rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 min-h-[160px] text-muted-foreground hover:text-primary"
        >
          <Plus className="h-6 w-6" />
          <span className="text-sm font-medium">New goal</span>
        </button>
      </div>

      {initialGoals.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          No missions yet — plot a course above to start tracking your savings.
        </p>
      )}

      <GoalDialog open={dialogOpen} onClose={() => setDialogOpen(false)} goal={editGoal} />
      <AddFundsDialog open={addFundsOpen} onClose={() => setAddFundsOpen(false)} goal={addFundsGoal} />
      <HistoryDialog goal={historyGoal} onClose={() => setHistoryGoal(null)} />
    </div>
  )
}

function HistoryDialog({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const { fmt } = useCurrency()
  const [contributions, setContributions] = useState<{ id: string; amount: number; note: string | null; date: string | Date }[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (goal) {
      setLoading(true)
      getGoalContributions(goal.id)
        .then((c) => setContributions(c))
        .finally(() => setLoading(false))
    }
  }, [goal])

  if (!goal) return null

  return (
    <Dialog open={!!goal} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Contributions — {goal.emoji} {goal.name}</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
          ) : contributions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No contributions logged yet. Use &ldquo;Add funds&rdquo; to start.
            </p>
          ) : (
            <div className="space-y-0">
              {contributions.map((c, i) => (
                <div key={c.id}>
                  <div className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium">{c.note || 'Contribution'}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(c.date), 'MMM d, yyyy')}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-green-600">+{fmt(c.amount)}</span>
                  </div>
                  {i < contributions.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
