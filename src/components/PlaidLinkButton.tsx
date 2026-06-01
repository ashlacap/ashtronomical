'use client'

import { useState, useCallback, useEffect } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { toast } from 'sonner'
import { Building2, Loader2 } from 'lucide-react'
import { createLinkToken, exchangeToken } from '@/app/actions/plaid'
import { Button } from '@/components/ui/button'

export function PlaidLinkButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [exchanging, setExchanging] = useState(false)

  useEffect(() => {
    createLinkToken().then(setLinkToken).catch(() => {
      toast.error('Could not initialize bank connection.')
    })
  }, [])

  const onSuccess = useCallback(
    async (publicToken: string, metadata: { institution?: { name?: string } | null }) => {
      setExchanging(true)
      const result = await exchangeToken(publicToken, metadata.institution?.name ?? null)
      setExchanging(false)
      if (result.success) {
        toast.success('Bank account connected! Transactions are syncing.')
      } else {
        toast.error(result.error ?? 'Failed to connect account.')
      }
    },
    [],
  )

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess })

  const handleClick = () => {
    setLoading(true)
    open()
    setTimeout(() => setLoading(false), 1000)
  }

  const isLoading = loading || exchanging || !linkToken

  return (
    <Button onClick={handleClick} disabled={isLoading || !ready}>
      {isLoading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Building2 className="h-4 w-4 mr-2" />
      )}
      {exchanging ? 'Connecting…' : 'Connect Bank Account'}
    </Button>
  )
}
