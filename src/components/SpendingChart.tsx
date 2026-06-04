'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { formatCurrency, formatCurrencyCompact } from '@/lib/currency'

type ChartData = {
  name: string
  spent: number
  budget: number
  color: string
}

export function SpendingChart({ data, currency = 'USD' }: { data: ChartData[]; currency?: string }) {
  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm gap-1.5">
        <span className="text-2xl opacity-40">✦</span>
        <span>Add a few transactions and your spending will light up here.</span>
      </div>
    )
  }

  const tooltip = (
    <Tooltip
      formatter={(value, name) => [
        formatCurrency(Number(value ?? 0), currency),
        name === 'spent' ? 'Spent' : 'Budget',
      ]}
      contentStyle={{ borderRadius: '8px', fontSize: '14px' }}
    />
  )

  // Horizontal layout reads much better past ~6 categories with long names
  if (data.length > 6) {
    return (
      <ResponsiveContainer width="100%" height={Math.max(240, data.length * 38)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatCurrencyCompact(v, currency)}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={90}
          />
          {tooltip}
          <Bar dataKey="budget" fill="#e2e8f0" radius={[0, 4, 4, 0]} name="budget" />
          <Bar dataKey="spent" radius={[0, 4, 4, 0]} name="spent">
            {data.map((entry, idx) => (
              <Cell key={idx} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 48 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="name" tick={{ fontSize: 12, textAnchor: 'end' }} tickLine={false} axisLine={false} angle={-45} interval={0} />
        <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrencyCompact(v, currency)} />
        {tooltip}
        <Bar dataKey="budget" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="budget" />
        <Bar dataKey="spent" radius={[4, 4, 0, 0]} name="spent">
          {data.map((entry, idx) => (
            <Cell key={idx} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
