'use client'

import { useEffect, useRef, useState } from 'react'
import { useCurrency } from '@/components/CurrencyProvider'

type FormatMode = 'currency' | 'percent' | 'plain'

/**
 * Counts up to `value` once when it scrolls into view (or on mount).
 * Formatting is done internally (it reads currency from context) so this
 * client component never needs a non-serializable function prop.
 */
export function AnimatedNumber({
  value,
  format = 'currency',
  durationMs = 900,
  className,
}: {
  value: number
  format?: FormatMode
  durationMs?: number
  className?: string
}) {
  const { fmt } = useCurrency()
  const [display, setDisplay] = useState(0)
  const startedRef = useRef(false)
  const ref = useRef<HTMLSpanElement>(null)

  const render = (n: number) => {
    if (format === 'currency') return fmt(n)
    if (format === 'percent') return `${Math.round(n)}%`
    return Math.round(n).toLocaleString()
  }

  useEffect(() => {
    const prefersReduced = typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) { setDisplay(value); return }

    const el = ref.current
    if (!el) { setDisplay(value); return }

    const run = () => {
      if (startedRef.current) return
      startedRef.current = true
      const start = performance.now()
      const tick = (now: number) => {
        const t = Math.min((now - start) / durationMs, 1)
        const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
        setDisplay(value * eased)
        if (t < 1) requestAnimationFrame(tick)
        else setDisplay(value)
      }
      requestAnimationFrame(tick)
    }

    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && run()),
      { threshold: 0.3 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [value, durationMs])

  return <span ref={ref} className={className}>{render(display)}</span>
}
