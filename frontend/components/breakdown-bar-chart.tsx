'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCompact } from '@/lib/format'
import type { BreakdownItem } from '@/lib/types'

const config = {
  count: { label: 'Count', color: 'var(--amber)' },
} satisfies ChartConfig

export function BreakdownBarChart({
  items,
}: {
  items?: BreakdownItem[]
}) {
  if (!items) return <Skeleton className="h-[320px] w-full" />

  const rows = [...items].sort((a, b) => b.count - a.count)

  return (
    <ChartContainer
      config={config}
      className="h-[360px] w-full"
    >
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
      >
        <CartesianGrid
          horizontal={false}
          stroke="var(--border)"
          strokeDasharray="3 3"
        />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          stroke="var(--muted-foreground)"
          fontSize={11}
          tickFormatter={(v) => formatCompact(v)}
        />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          stroke="var(--muted-foreground)"
          fontSize={11}
          width={150}
          tickFormatter={(v: string) =>
            v.length > 22 ? v.slice(0, 21) + '…' : v
          }
        />
        <ChartTooltip
          content={<ChartTooltipContent />}
          cursor={{ fill: 'var(--secondary)' }}
        />
        <Bar
          dataKey="count"
          fill="var(--color-count)"
          radius={[0, 4, 4, 0]}
          maxBarSize={26}
        />
      </BarChart>
    </ChartContainer>
  )
}
