'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { syncAllTransactions } from '@/app/actions/plaid'
import { Button } from '@/components/ui/button'

export function SyncButton({ label = 'Sync', className }: { label?: string; className?: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [syncing, setSyncing] = useState(false)

  const busy = syncing || isPending

  async function handleSync() {
    if (busy) return
    setSyncing(true)
    const toastId = toast.loading('Syncing your transactions…')
    try {
      const result = await syncAllTransactions()
      toast.success(
        result.synced > 0
          ? `Synced — ${result.synced} new transaction${result.synced !== 1 ? 's' : ''} imported.`
          : 'Your accounts are up to date.',
        { id: toastId },
      )
      // Refresh server components so the new transactions appear
      startTransition(() => router.refresh())
    } catch {
      toast.error('Sync failed. Please try again.', { id: toastId })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSync} disabled={busy} className={className} aria-busy={busy}>
      <RefreshCw className={`h-3.5 w-3.5 mr-2 ${busy ? 'animate-spin' : ''}`} />
      {busy ? 'Syncing…' : label}
    </Button>
  )
}
