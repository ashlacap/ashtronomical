'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Upload, FileText } from 'lucide-react'
import { importTransactions } from '@/app/actions/transactions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

// Minimal CSV parser handling quoted fields and commas inside quotes.
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') inQuotes = false
      else field += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (c === '\r') { /* ignore */ }
      else field += c
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

export function ImportCsv() {
  const [open, setOpen] = useState(false)
  const [headers, setHeaders] = useState<string[]>([])
  const [dataRows, setDataRows] = useState<string[][]>([])
  const [map, setMap] = useState<{ date: number; name: number; amount: number }>({ date: -1, name: -1, amount: -1 })
  const [importing, setImporting] = useState(false)

  function guessColumn(hdrs: string[], candidates: string[]): number {
    const lower = hdrs.map((h) => h.toLowerCase())
    for (const cand of candidates) {
      const idx = lower.findIndex((h) => h.includes(cand))
      if (idx >= 0) return idx
    }
    return -1
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result))
      if (parsed.length < 2) { toast.error('CSV looks empty.'); return }
      const [hdr, ...rest] = parsed
      setHeaders(hdr)
      setDataRows(rest)
      setMap({
        date: guessColumn(hdr, ['date', 'posted', 'time']),
        name: guessColumn(hdr, ['description', 'name', 'merchant', 'payee', 'memo']),
        amount: guessColumn(hdr, ['amount', 'debit', 'value']),
      })
    }
    reader.readAsText(file)
  }

  async function doImport() {
    if (map.date < 0 || map.name < 0 || map.amount < 0) {
      toast.error('Please map date, description, and amount columns.')
      return
    }
    setImporting(true)
    const rows = dataRows.map((r) => ({
      date: r[map.date] ?? '',
      name: r[map.name] ?? '',
      amount: parseFloat((r[map.amount] ?? '').replace(/[^0-9.-]/g, '')) || 0,
    })).filter((r) => r.date && r.name)

    const result = await importTransactions(rows)
    setImporting(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`Imported ${result.imported} transactions${result.skipped ? `, skipped ${result.skipped}` : ''}.`)
      reset()
      setOpen(false)
    }
  }

  function reset() {
    setHeaders([])
    setDataRows([])
    setMap({ date: -1, name: -1, amount: -1 })
  }

  const colSelect = (field: 'date' | 'name' | 'amount', label: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <select
        className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
        value={map[field]}
        onChange={(e) => setMap({ ...map, [field]: Number(e.target.value) })}
      >
        <option value={-1}>— select —</option>
        {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
      </select>
    </div>
  )

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="h-3.5 w-3.5 mr-1.5" />Import
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
        <DialogContent className="max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Import transactions from CSV</DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 space-y-4">
            {headers.length === 0 ? (
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-12 cursor-pointer hover:border-primary/40 transition-colors">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium">Choose a CSV file</span>
                <span className="text-xs text-muted-foreground">Export one from your bank, then map the columns</span>
                <input type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
              </label>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Found {dataRows.length} rows. Map your columns — positive amounts are treated as spending, negative as income.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {colSelect('date', 'Date')}
                  {colSelect('name', 'Description')}
                  {colSelect('amount', 'Amount')}
                </div>

                {/* Preview */}
                {map.date >= 0 && map.name >= 0 && map.amount >= 0 && (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-3 gap-2 px-3 py-2 bg-muted/50 text-xs font-semibold">
                      <span>Date</span><span>Description</span><span className="text-right">Amount</span>
                    </div>
                    {dataRows.slice(0, 4).map((r, i) => (
                      <div key={i} className="grid grid-cols-3 gap-2 px-3 py-1.5 text-xs border-t border-border">
                        <span className="truncate">{r[map.date]}</span>
                        <span className="truncate">{r[map.name]}</span>
                        <span className="text-right tabular-nums">{r[map.amount]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); reset() }}>Cancel</Button>
            {headers.length > 0 && (
              <Button onClick={doImport} disabled={importing}>
                {importing ? 'Importing…' : `Import ${dataRows.length} rows`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
