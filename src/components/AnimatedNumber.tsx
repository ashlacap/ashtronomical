'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Counts up to `value` once when it scrolls into view (or on mount).
 * `format` controls how the running number is rendered (currency, %, etc.).
 */
export function AnimatedNumber({
  value,
  format,
  durationMs = 900,
  className,
}: {
  value: number
  format: (n: number) => string
  durationMs?: number
  className?: string
}) {
  const [display, setDisplay] = useState(0)
  const startedRef = useRef(false)
  const ref = useRef<HTMLSpanElement>(null)

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
      const from = 0
      const tick = (now: number) => {
        const t = Math.min((now - start) / durationMs, 1)
        // easeOutCubic
        const eased = 1 - Math.pow(1 - t, 3)
        setDisplay(from + (value - from) * eased)
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

  return <span ref={ref} className={className}>{format(display)}</span>
}
