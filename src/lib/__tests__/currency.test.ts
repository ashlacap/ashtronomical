import { describe, it, expect } from 'vitest'
import { formatCurrency, formatCurrencyCompact } from '../currency'

describe('formatCurrency', () => {
  it('formats USD with two decimals', () => {
    expect(formatCurrency(1234.5, 'USD')).toBe('$1,234.50')
  })

  it('respects other currencies', () => {
    expect(formatCurrency(1000, 'EUR')).toContain('1,000')
    expect(formatCurrency(1000, 'GBP')).toContain('£')
  })

  it('handles negatives', () => {
    expect(formatCurrency(-50, 'USD')).toBe('-$50.00')
  })
})

describe('formatCurrencyCompact', () => {
  it('drops decimals', () => {
    expect(formatCurrencyCompact(1234.99, 'USD')).toBe('$1,235')
  })
})
