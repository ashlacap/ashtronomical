'use client'

import { useState, useEffect } from 'react'

/**
 * Time-of-day greeting computed from the user's local (browser) clock,
 * so it's correct regardless of the server's timezone.
 */
export function Greeting({ name }: { name: string }) {
  const [greeting, setGreeting] = useState<string | null>(null)

  useEffect(() => {
    const h = new Date().getHours()
    if (h < 5) setGreeting(`Working late, ${name}?`)
    else if (h < 12) setGreeting(`Good morning, ${name}.`)
    else if (h < 17) setGreeting(`Good afternoon, ${name}.`)
    else setGreeting(`Good evening, ${name}.`)
  }, [name])

  return (
    <h1 className="text-2xl font-bold tracking-tight">
      {/* Before mount, show the name alone to avoid a wrong-timezone flash */}
      {greeting ?? name}
    </h1>
  )
}
