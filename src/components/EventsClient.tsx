'use client'

import { useActionState, useState, useEffect } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Plus, Pencil, Trash2, X, CalendarDays, TrendingUp, Users } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { differenceInCalendarMonths, startOfMonth } from 'date-fns'
import { createEvent, updateEvent, deleteEvent, assignTransaction, removeTransaction } from '@/app/actions/events'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { EmojiPickerButton } from '@/components/EmojiPickerButton'
import { useCurrency } from '@/components/CurrencyProvider'

type Txn = {
  id: string
  name: string
  merchantName: string | null
  amount: number
  date: string
}

type EventBudget = {
  id: string
  name: string
  emoji: string
  color: string
  totalBudget: number
  eventDate: string | null
  ownerName?: string | null
  transactions: Txn[]
}

function DonutChart({ spent, total, color }: { spent: number; total: number; color: string }) {
  const { fmt } = useCurrency()
  const pct = total > 0 ? Math.min((spent / total) * 100, 100) : 0
  const remaining = Math.max(total - spent, 0)
  const data = [
    { name: 'Spent', value: spent },
    { name: 'Remaining', value: remaining > 0 ? remaining : 0.001 },
  ]

  return (
    <div className="relative w-36 h-36">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={44}
            outerRadius={64}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            strokeWidth={0}
          >
            <Cell fill={color} />
            <Cell fill="var(--border)" />
          </Pie>
          <Tooltip
            formatter={(value, name) => [fmt(Number(value ?? 0)), String(name)]}
            contentStyle={{ fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-lg font-bold leading-none">{Math.round(pct)}%</span>
        <span className="text-xs text-muted-foreground mt-0.5">used</span>
      </div>
    </div>
  )
}

function EventDialog({
  open,
  onClose,
  event,
}: {
  open: boolean
  onClose: () => void
  event: EventBudget | null
}) {
  const isEdit = !!event
  const [selectedEmoji, setSelectedEmoji] = useState(event?.emoji ?? '🎉')
  const boundUpdate = isEdit ? updateEvent.bind(null, event!.id) : undefined

  const [createState, createAction, createPending] = useActionState(createEvent, undefined)
  const [updateState, updateAction, updatePending] = useActionState(boundUpdate ?? createEvent, undefined)

  const state = isEdit ? updateState : createState
  const action = isEdit ? updateAction : createAction
  const pending = isEdit ? updatePending : createPending

  useEffect(() => { setSelectedEmoji(event?.emoji ?? '🎉') }, [event])

  useEffect(() => {
    if (state?.success) {
      toast.success(isEdit ? 'Event updated.' : 'Event created.')
      onClose()
    }
  }, [state])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Event' : 'New Event Budget'}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="event-name">Event name</Label>
              <Input id="event-name" name="name" placeholder="e.g. Wedding" defaultValue={event?.name} required />
              {state?.errors?.name && <p className="text-sm text-destructive">{state.errors.name[0]}</p>}
            </div>
            <div className="space-y-1.5 flex flex-col items-center">
              <Label>Emoji</Label>
              <EmojiPickerButton name="emoji" value={selectedEmoji} onChange={setSelectedEmoji} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="event-budget">Total budget ($)</Label>
              <Input id="event-budget" name="totalBudget" type="number" min="1" step="0.01" defaultValue={event?.totalBudget} required />
              {state?.errors?.totalBudget && <p className="text-sm text-destructive">{state.errors.totalBudget[0]}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-date">Event date (optional)</Label>
              <Input id="event-date" name="eventDate" type="date" defaultValue={event?.eventDate?.slice(0, 10) ?? ''} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-color">Color</Label>
            <input id="event-color" name="color" type="color" defaultValue={event?.color ?? '#8b5cf6'} className="h-9 w-full rounded border cursor-pointer" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AssignDialog({
  open,
  onClose,
  event,
  allTransactions,
}: {
  open: boolean
  onClose: () => void
  event: EventBudget | null
  allTransactions: Txn[]
}) {
  const { fmt } = useCurrency()
  const [loading, setLoading] = useState<string | null>(null)
  if (!event) return null

  const assignedIds = new Set(event.transactions.map((t) => t.id))
  const unassigned = allTransactions.filter((t) => !assignedIds.has(t.id))

  async function handleAssign(txnId: string) {
    if (!event) return
    setLoading(txnId)
    await assignTransaction(event.id, txnId)
    setLoading(null)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add transactions — {event.emoji} {event.name}</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {unassigned.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No more transactions to add. Sync your accounts to load new ones.
            </p>
          ) : (
            <div className="space-y-0">
              {unassigned.map((txn, i) => (
                <div key={txn.id}>
                  <div className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium">{txn.merchantName ?? txn.name}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(txn.date), 'MMM d, yyyy')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums">{fmt(Math.abs(txn.amount))}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={loading === txn.id}
                        onClick={() => handleAssign(txn.id)}
                      >
                        {loading === txn.id ? '…' : 'Add'}
                      </Button>
                    </div>
                  </div>
                  {i < unassigned.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EventsClient({
  initialEvents,
  allTransactions,
}: {
  initialEvents: EventBudget[]
  allTransactions: Txn[]
}) {
  const { fmt } = useCurrency()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [editEvent, setEditEvent] = useState<EventBudget | null>(null)
  const [activeEvent, setActiveEvent] = useState<EventBudget | null>(null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Events <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider ml-2 align-middle">Event Budgets</span></h1>
          <p className="text-sm text-muted-foreground">Track spending for weddings, trips, and other events</p>
        </div>
        <Button onClick={() => { setEditEvent(null); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 mr-1.5" />
          New event
        </Button>
      </div>

      {initialEvents.length === 0 && (
        <Card className="border-dashed border-border/40">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <span className="text-5xl">🎉</span>
            <p className="text-sm text-muted-foreground max-w-xs">
              Create an event budget to track spending for a specific occasion — a wedding, vacation, or any milestone.
            </p>
            <Button onClick={() => { setEditEvent(null); setDialogOpen(true) }} variant="outline">
              Create your first event
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {initialEvents.map((event) => {
          const spent = event.transactions.reduce((s, t) => s + Math.abs(t.amount), 0)
          const pct = event.totalBudget > 0 ? Math.min((spent / event.totalBudget) * 100, 100) : 0
          const overBudget = spent > event.totalBudget

          return (
            <Card key={event.id}>
              <CardHeader className="pb-3 flex flex-row items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl leading-none">{event.emoji}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{event.name}</CardTitle>
                      {event.ownerName && <Badge variant="secondary" className="text-xs gap-1"><Users className="h-2.5 w-2.5" />{event.ownerName}</Badge>}
                    </div>
                    {event.eventDate && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <CalendarDays className="h-3 w-3" />
                        {format(new Date(event.eventDate), 'MMMM d, yyyy')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => { setEditEvent(event); setDialogOpen(true) }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <form action={deleteEvent.bind(null, event.id)}>
                    <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Chart + stats row */}
                {(() => {
                  const remaining = event.totalBudget - spent
                  const now = new Date()
                  const eventDate = event.eventDate ? new Date(event.eventDate) : null
                  const monthsLeft = eventDate
                    ? Math.max(0, differenceInCalendarMonths(startOfMonth(eventDate), startOfMonth(now)))
                    : null
                  const monthlyPace = monthsLeft && monthsLeft > 0 && remaining > 0
                    ? remaining / monthsLeft
                    : null

                  return (
                    <div className="flex items-center gap-6">
                      <DonutChart spent={spent} total={event.totalBudget} color={event.color} />
                      <div className="space-y-2 flex-1">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Spent</p>
                            <p className="text-lg font-bold tabular-nums">{fmt(spent)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Budget</p>
                            <p className="text-lg font-bold tabular-nums">{fmt(event.totalBudget)}</p>
                          </div>
                        </div>
                        {overBudget ? (
                          <Badge variant="destructive" className="text-xs">Over by {fmt(spent - event.totalBudget)}</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">{fmt(remaining)} remaining</Badge>
                        )}
                        {monthlyPace && (
                          <div className="flex items-start gap-1.5 pt-1 border-t border-border">
                            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs font-semibold">{fmt(monthlyPace)}/mo to stay on track</p>
                              <p className="text-xs text-muted-foreground">{monthsLeft} month{monthsLeft !== 1 ? 's' : ''} until event</p>
                            </div>
                          </div>
                        )}
                        {monthsLeft === 0 && eventDate && (
                          <p className="text-xs text-muted-foreground pt-1 border-t border-border">Event is this month</p>
                        )}
                      </div>
                    </div>
                  )
                })()}

                <Separator />

                {/* Assigned transactions */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Transactions ({event.transactions.length})
                    </p>
                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2"
                      onClick={() => { setActiveEvent(event); setAssignOpen(true) }}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>

                  {event.transactions.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      No transactions yet — click Add to link expenses from your accounts.
                    </p>
                  ) : (
                    <div className="space-y-0 max-h-48 overflow-y-auto">
                      {event.transactions.map((txn, i) => (
                        <div key={txn.id}>
                          <div className="flex items-center justify-between py-1.5">
                            <div>
                              <p className="text-xs font-medium leading-tight">{txn.merchantName ?? txn.name}</p>
                              <p className="text-xs text-muted-foreground">{format(new Date(txn.date), 'MMM d')}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold tabular-nums">{fmt(Math.abs(txn.amount))}</span>
                              <button
                                onClick={() => removeTransaction(event.id, txn.id)}
                                className="text-muted-foreground hover:text-destructive transition-colors"
                                aria-label="Remove"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          {i < event.transactions.length - 1 && <Separator />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <EventDialog open={dialogOpen} onClose={() => setDialogOpen(false)} event={editEvent} />
      <AssignDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        event={activeEvent}
        allTransactions={allTransactions}
      />
    </div>
  )
}
