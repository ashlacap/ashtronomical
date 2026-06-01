'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

type TrendPoint = { month: string; [category: string]: number | string }

export function SpendingTrendsChart({
  data,
  categories,
}: {
  data: TrendPoint[]
  categories: { name: string; color: string }[]
}) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No trend data yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}`]}
          contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
        />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        {categories.map((cat) => (
          <Line
            key={cat.name}
            type="monotone"
            dataKey={cat.name}
            stroke={cat.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
