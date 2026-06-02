'use client'

import { useActionState, useState, useEffect } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Plus, Pencil, Trash2, TrendingDown, Calendar, Percent, CreditCard } from 'lucide-react'
import { createDebt, updateDebt, deleteDebt } from '@/app/actions/debt'
import { calculatePayoff } from '@/lib/debt-payoff'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useCurrency } from '@/components/CurrencyProvider'

type Debt = {
  id: string
  name: string
  balance: number
  interestRate: number
  minimumPayment: number
  type: string
}

const DEBT_TYPES = [
  { value: 'credit', label: 'Credit Card' },
  { value: 'student', label: 'Student Loan' },
  { value: 'auto', label: 'Auto Loan' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'personal', label: 'Personal Loan' },
  { value: 'other', label: 'Other' },
]

function DebtDialog({ open, onClose, debt }: { open: boolean; onClose: () => void; debt: Debt | null }) {
  const isEdit = !!debt
  const boundUpdate = isEdit ? updateDebt.bind(null, debt!.id) : undefined
  const [createState, createAction, createPending] = useActionState(createDebt, undefined)
  const [updateState, updateAction, updatePending] = useActionState(boundUpdate ?? createDebt, undefined)
  const state = isEdit ? updateState : createState
  const action = isEdit ? updateAction : createAction
  const pending = isEdit ? updatePending : createPending

  useEffect(() => {
    if (state?.success) {
      toast.success(isEdit ? 'Debt updated.' : 'Debt added.')
      onClose()
    }
  }, [state])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Debt' : 'Add Debt'}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="debt-name">Name</Label>
              <Input id="debt-name" name="name" placeholder="e.g. Chase Visa" defaultValue={debt?.name} required />
              {state?.errors?.name && <p className="text-xs text-destructive">{state.errors.name[0]}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="debt-type">Type</Label>
              <select id="debt-type" name="type" defaultValue={debt?.type ?? 'credit'}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                {DEBT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="debt-balance">Current balance ($)</Label>
            <Input id="debt-balance" name="balance" type="number" min="0" step="0.01" defaultValue={debt?.balance} required />
            {state?.errors?.balance && <p className="text-xs text-destructive">{state.errors.balance[0]}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="debt-rate">Interest rate (APR %)</Label>
              <Input id="debt-rate" name="interestRate" type="number" min="0" max="100" step="0.01" defaultValue={debt?.interestRate} required />
              {state?.errors?.interestRate && <p className="text-xs text-destructive">{state.errors.interestRate[0]}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="debt-min">Minimum payment ($)</Label>
              <Input id="debt-min" name="minimumPayment" type="number" min="0" step="0.01" defaultValue={debt?.minimumPayment} required />
              {state?.errors?.minimumPayment && <p className="text-xs text-destructive">{state.errors.minimumPayment[0]}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add debt'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type ConnectedDebt = { id: string; name: string; mask: string | null; balance: number; type: string }

export function DebtClient({
  initialDebts,
  connectedDebts = [],
}: {
  initialDebts: Debt[]
  connectedDebts?: ConnectedDebt[]
}) {
  const { fmt } = useCurrency()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editDebt, setEditDebt] = useState<Debt | null>(null)
  const [extra, setExtra] = useState(0)

  const connectedTotal = connectedDebts.reduce((s, d) => s + d.balance, 0)
  const totalDebt = initialDebts.reduce((s, d) => s + d.balance, 0) + connectedTotal
  const totalMinimum = initialDebts.reduce((s, d) => s + d.minimumPayment, 0)
  // Payoff timeline only covers manual debts (Plaid gives balance but not APR/min payment)
  const payoff = calculatePayoff(initialDebts, extra)
  const hasAnyDebt = initialDebts.length > 0 || connectedDebts.length > 0

  const typeLabel = (t: string) => DEBT_TYPES.find((x) => x.value === t)?.label ?? t

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Debt</h1>
          <p className="text-sm text-muted-foreground">Track balances and see your payoff timeline (avalanche method)</p>
        </div>
        <Button onClick={() => { setEditDebt(null); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 mr-1.5" />Add debt
        </Button>
      </div>

      {!hasAnyDebt ? (
        <Card className="border-dashed border-border/40">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <TrendingDown className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground max-w-xs">
              Add your debts to see a payoff timeline and how much interest you'll pay. Debt-free? Even better — nothing to add.
            </p>
            <Button onClick={() => { setEditDebt(null); setDialogOpen(true) }} variant="outline">Add your first debt</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Debt</p>
                <p className="text-2xl font-bold tabular-nums mt-1">{fmt(totalDebt)}</p>
                {connectedTotal > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">incl. {fmt(connectedTotal)} connected</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Min. Payments</p>
                <p className="text-2xl font-bold tabular-nums mt-1">{fmt(totalMinimum)}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Calendar className="h-3 w-3" />Debt-Free In</p>
                <p className="text-2xl font-bold tabular-nums mt-1">
                  {initialDebts.length === 0 ? '—' : payoff.monthsToPayoff === Infinity ? '∞' : `${payoff.monthsToPayoff} mo`}
                </p>
                {payoff.payoffDate && <p className="text-xs text-muted-foreground">{format(payoff.payoffDate, 'MMM yyyy')}</p>}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Percent className="h-3 w-3" />Total Interest</p>
                <p className="text-2xl font-bold tabular-nums mt-1 text-red-500">
                  {payoff.monthsToPayoff === Infinity ? '—' : fmt(payoff.totalInterest)}
                </p>
                <p className="text-xs text-muted-foreground">{fmt(payoff.monthlyInterestCost)}/mo accruing</p>
              </CardContent>
            </Card>
          </div>

          {/* Extra payment slider — only meaningful with manual debts that have APR/min */}
          {initialDebts.length > 0 && (
            <Card>
              <CardContent className="pt-5 space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="extra-payment" className="text-sm font-semibold">Extra monthly payment</Label>
                  <span className="text-sm font-bold tabular-nums">{fmt(extra)}/mo</span>
                </div>
                <input
                  id="extra-payment"
                  type="range"
                  min="0"
                  max="2000"
                  step="50"
                  value={extra}
                  onChange={(e) => setExtra(Number(e.target.value))}
                  className="w-full cursor-pointer accent-primary"
                />
                <p className="text-xs text-muted-foreground">
                  Drag to see how paying more each month accelerates your payoff. Extra goes to your highest-rate debt first.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Manual debt list */}
          {initialDebts.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Your debts <span className="text-xs font-normal text-muted-foreground ml-1">— highest rate first</span></CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                {initialDebts.map((debt, i) => (
                  <div key={debt.id}>
                    <div className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        {i === 0 && initialDebts.length > 1 && (
                          <Badge variant="destructive" className="text-xs">Target</Badge>
                        )}
                        <div>
                          <p className="text-sm font-medium">{debt.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {typeLabel(debt.type)} · {debt.interestRate}% APR · {fmt(debt.minimumPayment)}/mo min
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold tabular-nums">{fmt(debt.balance)}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditDebt(debt); setDialogOpen(true) }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <form action={deleteDebt.bind(null, debt.id)}>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </form>
                      </div>
                    </div>
                    {i < initialDebts.length - 1 && <Separator />}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Connected credit cards & loans (from linked banks) */}
          {connectedDebts.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />Connected accounts
                </CardTitle>
                <CardDescription>
                  Credit cards and loans from your linked banks. Add one as a debt above (with its APR) to include it in the payoff timeline.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-0">
                {connectedDebts.map((acct, i) => (
                  <div key={acct.id}>
                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium">{acct.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {acct.type}{acct.mask ? ` ••••${acct.mask}` : ''}
                        </p>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-red-500">{fmt(acct.balance)}</span>
                    </div>
                    {i < connectedDebts.length - 1 && <Separator />}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <DebtDialog open={dialogOpen} onClose={() => setDialogOpen(false)} debt={editDebt} />
    </div>
  )
}
