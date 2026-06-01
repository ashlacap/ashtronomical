'use client'

import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'

type Month = { value: string; label: string }

export function MonthSelector({ months, selected }: { months: Month[]; selected: string }) {
  const router = useRouter()

  return (
    <Select
      value={selected}
      onValueChange={(v: string | null) => v && router.push(`/dashboard?month=${v}`)}
    >
      <SelectTrigger className="w-40 h-8 text-xs">
        <span className="flex-1 text-left text-xs truncate">
          {months.find((m) => m.value === selected)?.label ?? selected}
        </span>
      </SelectTrigger>
      <SelectContent align="end">
        {months.map((m) => (
          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
