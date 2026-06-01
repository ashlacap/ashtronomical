'use client'

import { useActionState, useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Repeat, Power } from 'lucide-react'
import { createRecurring, deleteRecurring, toggleRecurring } from '@/app/actions/recurring'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useCurrency } from '@/components/CurrencyProvider'

type Rule = {
  id: string
  name: string
  amount: number
  dayOfMonth: number
  categoryName: string | null
  isTransfer: boolean
  active: boolean
}
type Category = { id: string; name: string }

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function RecurringManager({ rules, categories }: { rules: Rule[]; categories: Category[] }) {
  const { fmt } = useCurrency()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [state, action, pending] = useActionState(createRecurring, undefined)

  useEffect(() => {
    if (state?.success) {
      toast.success('Recurring transaction added.')
      setAdding(false)
    }
  }, [state])

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Repeat className="h-3.5 w-3.5 mr-1.5" />
        Recurring{rules.length > 0 && <Badge variant="secondary" className="ml-1.5 text-xs">{rules.filter(r => r.active).length}</Badge>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Recurring transactions</DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 -mx-1 px-1 space-y-3">
            <p className="text-xs text-muted-foreground">
              Automatically post fixed transactions (rent, salary, subscriptions) on a chosen day each month.
            </p>

            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No recurring transactions yet.</p>
            ) : (
              <div className="space-y-0">
                {rules.map((rule, i) => (
                  <div key={rule.id}>
                    <div className={`flex items-center justify-between py-2.5 ${!rule.active ? 'opacity-50' : ''}`}>
                      <div>
                        <p className="text-sm font-medium">{rule.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {ordinal(rule.dayOfMonth)} of each month
                          {rule.categoryName ? ` · ${rule.categoryName}` : ''}
                          {rule.isTransfer ? ' · transfer' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold tabular-nums ${rule.amount < 0 ? 'text-green-600' : ''}`}>
                          {rule.amount > 0 ? '-' : '+'}{fmt(Math.abs(rule.amount))}
                        </span>
                        <button
                          onClick={() => toggleRecurring(rule.id, !rule.active)}
                          className={`p-1.5 rounded transition-colors ${rule.active ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:bg-accent'}`}
                          title={rule.active ? 'Pause' : 'Resume'}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={async () => { await deleteRecurring(rule.id); toast.success('Removed.') }}
                          className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {i < rules.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}

            {adding ? (
              <form action={action} className="space-y-3 border border-border rounded-lg p-3 bg-muted/30">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="r-name" className="text-xs">Description</Label>
                    <Input id="r-name" name="name" placeholder="Rent" required className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="r-amount" className="text-xs">Amount (− for income)</Label>
                    <Input id="r-amount" name="amount" type="number" step="0.01" placeholder="1800" required className="h-8" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="r-day" className="text-xs">Day of month (1–28)</Label>
                    <Input id="r-day" name="dayOfMonth" type="number" min="1" max="28" defaultValue="1" required className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="r-cat" className="text-xs">Category</Label>
                    <select id="r-cat" name="categoryId" className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
                      <option value="">None</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" name="isTransfer" value="true" className="h-3.5 w-3.5 rounded border" />
                  Transfer between own accounts (excluded from spending)
                </label>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={pending}>{pending ? 'Adding…' : 'Add'}</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
                </div>
              </form>
            ) : (
              <Button variant="outline" size="sm" className="w-full" onClick={() => setAdding(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />Add recurring transaction
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
