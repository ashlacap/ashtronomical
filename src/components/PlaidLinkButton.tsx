'use client'

import { useState, useCallback, useEffect } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { toast } from 'sonner'
import { Building2, Loader2 } from 'lucide-react'
import { createLinkToken, exchangeToken } from '@/app/actions/plaid'
import { Button } from '@/components/ui/button'

const TOKEN_KEY = 'plaid_link_token'

export function PlaidLinkButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [exchanging, setExchanging] = useState(false)
  const [isOAuthReturn, setIsOAuthReturn] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // If the bank redirected back here mid-OAuth, reuse the SAME token we stored
    // before leaving — Plaid requires it to resume the flow.
    const isOAuth = window.location.search.includes('oauth_state_id=')
    if (isOAuth) {
      const stored = window.localStorage.getItem(TOKEN_KEY)
      if (stored) {
        setLinkToken(stored)
        setIsOAuthReturn(true)
        return
      }
    }

    // Normal flow: mint a fresh token and stash it for a possible OAuth redirect.
    createLinkToken()
      .then((t) => {
        setLinkToken(t)
        window.localStorage.setItem(TOKEN_KEY, t)
      })
      .catch(() => toast.error('Could not initialize bank connection.'))
  }, [])

  const onSuccess = useCallback(
    async (publicToken: string, metadata: { institution?: { name?: string } | null }) => {
      setExchanging(true)
      const result = await exchangeToken(publicToken, metadata.institution?.name ?? null)
      setExchanging(false)
      window.localStorage.removeItem(TOKEN_KEY)
      if (result.success) {
        toast.success('Bank account connected! Transactions are syncing.')
        // Strip the oauth_state_id from the URL so a refresh doesn't re-trigger.
        if (window.location.search.includes('oauth_state_id=')) {
          window.history.replaceState({}, '', window.location.pathname)
        }
      } else {
        toast.error(result.error ?? 'Failed to connect account.')
      }
    },
    [],
  )

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    ...(isOAuthReturn && typeof window !== 'undefined'
      ? { receivedRedirectUri: window.location.href }
      : {}),
  })

  // Automatically re-open Link to finish the OAuth handoff once it's ready.
  useEffect(() => {
    if (isOAuthReturn && ready) open()
  }, [isOAuthReturn, ready, open])

  const isLoading = exchanging || !linkToken

  return (
    <Button onClick={() => open()} disabled={isLoading || !ready}>
      {isLoading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Building2 className="h-4 w-4 mr-2" />
      )}
      {exchanging ? 'Connecting…' : 'Connect Bank Account'}
    </Button>
  )
}
