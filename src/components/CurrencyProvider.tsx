'use client'

import { createContext, useContext } from 'react'
import { formatCurrency, formatCurrencyCompact } from '@/lib/currency'

const CurrencyContext = createContext<string>('USD')

export function CurrencyProvider({ currency, children }: { currency: string; children: React.ReactNode }) {
  return <CurrencyContext.Provider value={currency}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  const currency = useContext(CurrencyContext)
  return {
    currency,
    fmt: (n: number) => formatCurrency(n, currency),
    fmtCompact: (n: number) => formatCurrencyCompact(n, currency),
  }
}
