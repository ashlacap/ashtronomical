'use client'

import { useRouter, usePathname } from 'next/navigation'
import { format } from 'date-fns'
import {
  updateTransactionCategory,
  markAsTransfer,
  bulkUpdateCategory,
  createManualTransaction,
  deleteTransaction,
  restoreTransaction,
  bulkDeleteTransactions,
  setTransactionNote,
  type DeletedFullTxn,
} from '@/app/actions/transactions'
import { toast } from 'sonner'
import {
  Download, ChevronLeft, ChevronRight, Search,
  Plus, ArrowLeftRight, Trash2, Tag, StickyNote, AlertTriangle, Sparkles,
} from 'lucide-react'
import { guessCategory } from '@/lib/categorize'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useCurrency } from '@/components/CurrencyProvider'
import { useCallback, useState, useTransition, useActionState, useEffect } from 'react'

type Transaction = {
  id: string
  name: string
  merchantName: string | null
  amount: number
  date: string
  pending: boolean
  isTransfer: boolean
  isManual: boolean
  note: string | null
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
}

type Category = { id: string; name: string; color: string; keywords?: string[] }
type Month = { value: string; label: string }
type CategoryBudget = {
  id: string
  name: string
  color: string
  budget: number
  spent: number
  remaining: number
  pct: number
  overBudget: boolean
  nearBudget: boolean
}

function AddTransactionDialog({
  open,
  onClose,
  categories,
  selectedMonth,
}: {
  open: boolean
  onClose: () => void
  categories: Category[]
  selectedMonth: string
}) {
  const [state, action, pending] = useActionState(createManualTransaction, undefined)

  useEffect(() => {
    if (state?.success) {
      toast.success('Transaction added.')
      onClose()
    }
  }, [state])

  const defaultDate = `${selectedMonth}-${new Date().getDate().toString().padStart(2, '0')}`

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="txn-name">Description</Label>
            <Input id="txn-name" name="name" placeholder="e.g. Farmers market, Cash dinner" required />
            {state?.errors?.name && <p className="text-sm text-destructive">{state.errors.name[0]}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="txn-amount">Amount ($)</Label>
              <p className="text-xs text-muted-foreground">Positive = expense, negative = income</p>
              <Input id="txn-amount" name="amount" type="number" step="0.01" placeholder="e.g. 42.50" required />
              {state?.errors?.amount && <p className="text-sm text-destructive">{state.errors.amount[0]}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="txn-date">Date</Label>
              <Input id="txn-date" name="date" type="date" defaultValue={defaultDate} required />
              {state?.errors?.date && <p className="text-sm text-destructive">{state.errors.date[0]}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="txn-category">Category (optional)</Label>
            <select
              id="txn-category"
              name="categoryId"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" name="isTransfer" value="true" className="h-4 w-4 rounded border" />
            <span>This is a transfer or payment between my own accounts</span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? 'Adding…' : 'Add transaction'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function NoteButton({ txnId, note }: { txnId: string; note: string | null }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(note ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await setTransactionNote(txnId, value)
    setSaving(false)
    setOpen(false)
    toast.success(value.trim() ? 'Note saved.' : 'Note cleared.')
  }

  return (
    <>
      <button
        onClick={() => { setValue(note ?? ''); setOpen(true) }}
        className={cn(
          'p-1.5 rounded transition-colors',
          note ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent',
        )}
        title={note ? `Note: ${note}` : 'Add note'}
        aria-label={note ? 'Edit note' : 'Add note'}
      >
        <StickyNote className="h-3.5 w-3.5" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transaction note</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. Work expense, split with roommate"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && save()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save note'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function BulkBar({
  selectedIds,
  categories,
  onClear,
}: {
  selectedIds: string[]
  categories: Category[]
  onClear: () => void
}) {
  const [, startTransition] = useTransition()
  const [catValue, setCatValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  async function handleBulkCategory() {
    if (!catValue) return
    startTransition(async () => {
      await bulkUpdateCategory(selectedIds, catValue === 'none' ? null : catValue)
      toast.success(`Updated ${selectedIds.length} transactions.`)
      onClear()
    })
  }

  async function handleBulkDelete() {
    setDeleting(true)
    const count = await bulkDeleteTransactions(selectedIds)
    setDeleting(false)
    setConfirmDelete(false)
    onClear()
    router.refresh()
    toast.success(`Deleted ${count} transaction${count !== 1 ? 's' : ''}.`)
  }

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-lg text-sm">
        <span className="font-medium">{selectedIds.length} selected</span>
        <div className="flex items-center gap-2 flex-1">
          <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <select
            className="flex h-8 rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm flex-1 max-w-48"
            value={catValue}
            onChange={(e) => setCatValue(e.target.value)}
          >
            <option value="">Set category…</option>
            <option value="none">Remove category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <Button size="sm" className="h-8" onClick={handleBulkCategory} disabled={!catValue}>
            Apply
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClear}>
          Clear
        </Button>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.length} transaction{selectedIds.length !== 1 ? 's' : ''}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This can&apos;t be undone from here. Bank-synced transactions won&apos;t reappear on future syncs.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function TransactionList({
  transactions,
  categories,
  months,
  selectedMonth,
  selectedCategoryId,
  search,
  page,
  totalPages,
  total,
  pendingTotal,
  uncategorizedCount,
  rangeFrom,
  rangeTo,
  categoryBudgets,
}: {
  transactions: Transaction[]
  categories: Category[]
  months: Month[]
  selectedMonth: string
  selectedCategoryId?: string
  search: string
  page: number
  totalPages: number
  total: number
  pendingTotal: number
  uncategorizedCount: number
  rangeFrom?: string
  rangeTo?: string
  categoryBudgets: CategoryBudget[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { fmt } = useCurrency()
  const [searchValue, setSearchValue] = useState(search)
  const [, startTransition] = useTransition()
  const [addOpen, setAddOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmDeleteTxn, setConfirmDeleteTxn] = useState<Transaction | null>(null)
  const customActive = !!(rangeFrom && rangeTo)
  const [showCustom, setShowCustom] = useState(customActive)
  const [from, setFrom] = useState(rangeFrom ?? '')
  const [to, setTo] = useState(rangeTo ?? '')

  function applyCustomRange() {
    if (!from || !to) return
    startTransition(() => {
      const p = new URLSearchParams()
      p.set('from', from)
      p.set('to', to)
      if (selectedCategoryId) p.set('categoryId', selectedCategoryId)
      if (search) p.set('search', search)
      router.push(`${pathname}?${p.toString()}`)
    })
  }

  function buildParams(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams()
    if (customActive) {
      if (rangeFrom) p.set('from', rangeFrom)
      if (rangeTo) p.set('to', rangeTo)
    } else {
      p.set('month', selectedMonth)
    }
    if (selectedCategoryId) p.set('categoryId', selectedCategoryId)
    if (search) p.set('search', search)
    p.set('page', '1')
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    return p.toString()
  }

  const handleSearch = useCallback(
    (value: string) => {
      startTransition(() => {
        router.push(`${pathname}?${buildParams({ search: value || undefined, page: '1' })}`)
      })
    },
    [selectedMonth, selectedCategoryId],
  )

  async function handleCategoryChange(transactionId: string, categoryId: string) {
    await updateTransactionCategory(transactionId, categoryId === 'none' ? null : categoryId)
    toast.success('Category updated.')
    router.refresh()
  }

  async function handleMarkTransfer(txn: Transaction) {
    await markAsTransfer(txn.id, !txn.isTransfer)
    toast.success(txn.isTransfer ? 'Unmarked as transfer.' : 'Marked as transfer — excluded from spending.')
  }

  async function handleDelete(txnId: string) {
    const deleted: DeletedFullTxn = await deleteTransaction(txnId)
    router.refresh()
    if (deleted) {
      toast.success('Transaction deleted.', {
        action: {
          label: 'Undo',
          onClick: async () => {
            await restoreTransaction(deleted)
            router.refresh()
            toast.success('Transaction restored.')
          },
        },
      })
    } else {
      toast.error('Could not delete that transaction.')
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.id)))
    }
  }

  // Spending = non-transfer, non-pending positives on this page
  const pageSpent = transactions
    .filter((t) => t.amount > 0 && !t.isTransfer && !t.pending)
    .reduce((s, t) => s + t.amount, 0)

  const exportUrl = `/api/transactions/export?month=${selectedMonth}${selectedCategoryId ? `&categoryId=${selectedCategoryId}` : ''}`

  return (
    <div className="space-y-4">
      {/* Action row */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 flex-1">
          <Select
            value={customActive ? 'custom' : selectedMonth}
            onValueChange={(v: string | null) => {
              if (!v) return
              if (v === 'custom') { setShowCustom(true); return }
              setShowCustom(false)
              router.push(`${pathname}?${buildParams({ month: v, from: undefined, to: undefined })}`)
            }}
          >
            <SelectTrigger className="w-44">
              <span className="flex-1 text-left text-sm truncate">
                {customActive ? 'Custom range' : (months.find((m) => m.value === selectedMonth)?.label ?? selectedMonth)}
              </span>
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
              <SelectItem value="custom">Custom range…</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={selectedCategoryId ?? 'all'}
            onValueChange={(v: string | null) =>
              router.push(`${pathname}?${buildParams({ categoryId: v === 'all' || v === null ? undefined : v })}`)
            }
          >
            <SelectTrigger className="w-44">
              <span className="flex-1 text-left text-sm truncate">
                {selectedCategoryId === 'uncategorized'
                  ? 'Uncategorized'
                  : selectedCategoryId
                  ? (categories.find((c) => c.id === selectedCategoryId)?.name ?? 'All categories')
                  : 'All categories'}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              <SelectItem value="uncategorized">Uncategorized</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-9"
              placeholder="Search transactions…"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchValue)}
            />
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <a href={exportUrl} download className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            CSV
          </a>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add expense
          </Button>
        </div>
      </div>

      {/* Custom date range inputs */}
      {showCustom && (
        <div className="flex flex-wrap items-end gap-3 px-4 py-3 bg-muted/40 border border-border rounded-lg">
          <div className="space-y-1">
            <Label htmlFor="range-from" className="text-xs">From</Label>
            <Input id="range-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="range-to" className="text-xs">To</Label>
            <Input id="range-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
          </div>
          <Button size="sm" onClick={applyCustomRange} disabled={!from || !to}>Apply range</Button>
          {customActive && (
            <Button size="sm" variant="ghost" onClick={() => { setShowCustom(false); router.push(pathname) }}>
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Alerts */}
      {uncategorizedCount > 0 && (
        <div
          className="flex items-center justify-between px-4 py-2.5 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg cursor-pointer text-sm"
          onClick={() => router.push(`${pathname}?${buildParams({ categoryId: 'uncategorized' })}`)}
        >
          <span className="font-medium text-yellow-800 dark:text-yellow-300">
            {uncategorizedCount} transaction{uncategorizedCount !== 1 ? 's need' : ' needs'} a category
          </span>
          <span className="text-xs text-yellow-700 dark:text-yellow-400">Review →</span>
        </div>
      )}

      {/* Overspend alerts — same threshold logic as the dashboard */}
      {categoryBudgets.some((c) => c.overBudget || c.nearBudget) && (
        <div className="space-y-1.5">
          {categoryBudgets.filter((c) => c.overBudget || c.nearBudget).map((c) => (
            <div
              key={c.id}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm border cursor-pointer',
                c.overBudget
                  ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
                  : 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300',
              )}
              onClick={() => router.push(`${pathname}?${buildParams({ categoryId: c.id })}`)}
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium">
                {c.overBudget
                  ? `${c.name}: over budget by ${fmt(c.spent - c.budget)}`
                  : `${c.name}: ${Math.round(c.pct)}% of budget used (${fmt(c.remaining)} left)`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Remaining-budget strip */}
      {categoryBudgets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categoryBudgets.map((c) => (
            <button
              key={c.id}
              onClick={() => router.push(`${pathname}?${buildParams({ categoryId: c.id })}`)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition-colors',
                c.overBudget
                  ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20'
                  : 'border-border bg-card hover:bg-accent',
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
              <span className="font-medium">{c.name}</span>
              <span className={cn('tabular-nums', c.overBudget ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                {c.remaining >= 0 ? `${fmt(c.remaining)} left` : `${fmt(Math.abs(c.remaining))} over`}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground items-center">
        <span>{total} transactions</span>
        <span>Spent: <strong className="text-foreground">{fmt(pageSpent)}</strong></span>
        {pendingTotal > 0 && (
          <Badge variant="secondary" className="text-xs">
            + {fmt(pendingTotal)} pending
          </Badge>
        )}
      </div>

      {/* Bulk bar */}
      {selectedIds.size > 0 && (
        <BulkBar
          selectedIds={Array.from(selectedIds)}
          categories={categories}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {/* Select-all header */}
          {transactions.length > 0 && (
            <div className="flex items-center gap-3 px-5 py-2 border-b border-border">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border cursor-pointer"
                checked={selectedIds.size === transactions.length}
                onChange={toggleAll}
              />
              <span className="text-xs text-muted-foreground">Select all</span>
            </div>
          )}

          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              No transactions found.
            </p>
          ) : (
            transactions.map((txn, i) => (
              <div key={txn.id}>
                <div className={cn(
                  'flex items-center gap-3 px-5 py-3',
                  txn.isTransfer && 'opacity-50',
                )}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border cursor-pointer shrink-0"
                    checked={selectedIds.has(txn.id)}
                    onChange={() => toggleSelect(txn.id)}
                  />

                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: txn.categoryColor ?? '#94a3b8' }}
                    >
                      {(txn.categoryName ?? '?')[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{txn.merchantName ?? txn.name}</p>
                        {txn.isManual && <Badge variant="secondary" className="text-xs shrink-0">Manual</Badge>}
                        {txn.isTransfer && <Badge variant="outline" className="text-xs shrink-0">Transfer</Badge>}
                        {txn.pending && <Badge variant="secondary" className="text-xs shrink-0">Pending</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{format(new Date(txn.date), 'MMM d, yyyy')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!txn.categoryId && !txn.isTransfer && (() => {
                      const suggestedId = guessCategory(txn.name, txn.merchantName, categories.map((c) => ({ id: c.id, name: c.name, keywords: c.keywords ?? [] })))
                      const suggested = suggestedId ? categories.find((c) => c.id === suggestedId) : null
                      if (!suggested) return null
                      return (
                        <button
                          onClick={() => handleCategoryChange(txn.id, suggested.id)}
                          className="hidden sm:flex items-center gap-1 h-7 px-2 rounded-md border border-dashed text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors shrink-0"
                          title={`Suggested: ${suggested.name}`}
                        >
                          <Sparkles className="h-3 w-3 shrink-0" style={{ color: suggested.color }} />
                          {suggested.name}?
                        </button>
                      )
                    })()}
                    <Select
                      value={txn.categoryId ?? 'none'}
                      onValueChange={(v: string | null) => v !== null && handleCategoryChange(txn.id, v)}
                    >
                      <SelectTrigger className="h-7 w-36 text-xs border-dashed hidden sm:flex">
                        <span className="flex-1 text-left truncate">
                          {txn.categoryId
                            ? categories.find((c) => c.id === txn.categoryId)?.name ?? 'Uncategorized'
                            : 'Uncategorized'}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Uncategorized</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                              {c.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <p className={cn(
                      'text-sm font-semibold w-20 text-right tabular-nums',
                      txn.amount < 0 && 'text-green-600',
                      txn.isTransfer && 'line-through',
                    )}>
                      {txn.amount > 0 ? '-' : '+'}{fmt(Math.abs(txn.amount))}
                    </p>

                    <button
                      onClick={() => handleMarkTransfer(txn)}
                      className={cn(
                        'p-1.5 rounded transition-colors',
                        txn.isTransfer
                          ? 'text-primary hover:bg-primary/10'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                      )}
                      title={txn.isTransfer ? 'Unmark as transfer' : 'Mark as transfer / CC payment'}
                      aria-label={txn.isTransfer ? 'Unmark as transfer' : 'Mark as transfer or credit card payment'}
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                    </button>

                    <NoteButton txnId={txn.id} note={txn.note} />

                    <button
                      onClick={() => (txn.isManual ? handleDelete(txn.id) : setConfirmDeleteTxn(txn))}
                      className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
                      title="Delete transaction"
                      aria-label="Delete transaction"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {i < transactions.length - 1 && <Separator />}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1}
              onClick={() => router.push(`${pathname}?${buildParams({ page: String(page - 1) })}`)}>
              <ChevronLeft className="h-4 w-4" />Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages}
              onClick={() => router.push(`${pathname}?${buildParams({ page: String(page + 1) })}`)} >
              Next<ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <AddTransactionDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        categories={categories}
        selectedMonth={selectedMonth}
      />

      <Dialog open={!!confirmDeleteTxn} onOpenChange={(open) => !open && setConfirmDeleteTxn(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this transaction?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmDeleteTxn?.merchantName ?? confirmDeleteTxn?.name} — this can be undone right after deleting,
            but won&apos;t reappear on future bank syncs either way.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDeleteTxn(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDeleteTxn) handleDelete(confirmDeleteTxn.id)
                setConfirmDeleteTxn(null)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
