'use client'

import { useActionState, useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Home, Car, TrendingUp, Wallet, Package } from 'lucide-react'
import { createAsset, deleteAsset } from '@/app/actions/assets'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useCurrency } from '@/components/CurrencyProvider'

type Asset = { id: string; name: string; value: number; type: string }

const TYPES = [
  { value: 'property',   label: 'Property',   Icon: Home },
  { value: 'vehicle',    label: 'Vehicle',    Icon: Car },
  { value: 'investment', label: 'Investment', Icon: TrendingUp },
  { value: 'cash',       label: 'Cash',       Icon: Wallet },
  { value: 'other',      label: 'Other',      Icon: Package },
]

function iconFor(type: string) {
  return TYPES.find((t) => t.value === type)?.Icon ?? Package
}

export function ManualAssetsCard({ assets }: { assets: Asset[] }) {
  const { fmt } = useCurrency()
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(createAsset, undefined)

  useEffect(() => {
    if (state?.success) {
      toast.success('Asset added.')
      setOpen(false)
    }
  }, [state])

  const total = assets.reduce((s, a) => s + a.value, 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base">Other Assets</CardTitle>
          <CardDescription>
            Property, vehicles, and investments not linked to a bank · {fmt(total)}
          </CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-0">
        {assets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Add assets like a car or property to complete your net worth.
          </p>
        ) : (
          assets.map((asset, i) => {
            const Icon = iconFor(asset.type)
            return (
              <div key={asset.id}>
                <div className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{asset.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{asset.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">{fmt(asset.value)}</span>
                    <form action={deleteAsset.bind(null, asset.id)}>
                      <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </form>
                  </div>
                </div>
                {i < assets.length - 1 && <Separator />}
              </div>
            )
          })
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Asset</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="asset-name">Name</Label>
              <Input id="asset-name" name="name" placeholder="e.g. Honda Civic, 401(k)" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="asset-value">Current value ($)</Label>
                <Input id="asset-value" name="value" type="number" step="0.01" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="asset-type">Type</Label>
                <select id="asset-type" name="type" defaultValue="property"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending ? 'Adding…' : 'Add asset'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
