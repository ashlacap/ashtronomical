'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

type NetWorthPoint = { date: string; balance: number }

export function NetWorthChart({ data }: { data: NetWorthPoint[] }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No balance history yet — sync your accounts to start tracking
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}`, 'Balance']}
          contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
        />
        <Area
          type="monotone"
          dataKey="balance"
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#balanceGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
