'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import type { CoverageCurve } from '@/lib/types'

const config = {
  optimized_pct: { label: 'Optimized', color: 'var(--amber)' },
  volume_pct: { label: 'Volume-only', color: 'var(--dim)' },
  even_pct: { label: 'Even spread', color: 'var(--dim)' },
} satisfies ChartConfig

export function CoverageCurveChart({
  data,
  currentK,
}: {
  data?: CoverageCurve | null
  currentK?: number
}) {
  if (!data) return <Skeleton className="h-[280px] w-full" />

  const rows = data.k.map((k, i) => ({
    k,
    optimized_pct: data.optimized_pct[i],
    volume_pct: data.volume_pct[i],
    even_pct: data.even_pct[i],
  }))

  return (
    <ChartContainer config={config} className="h-[280px] w-full">
      <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid
          vertical={false}
          stroke="var(--border)"
          strokeDasharray="3 3"
        />
        <XAxis
          dataKey="k"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          stroke="var(--muted-foreground)"
          fontSize={11}
          label={{
            value: 'Patrol units (k)',
            position: 'insideBottom',
            offset: -2,
            fill: 'var(--dim)',
            fontSize: 11,
          }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          width={40}
          stroke="var(--muted-foreground)"
          fontSize={11}
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
        />
        <ChartTooltip
          content={<ChartTooltipContent labelKey="k" />}
          cursor={{ stroke: 'var(--border)' }}
        />
        <ReferenceLine
          x={data.elbow}
          stroke="var(--amber)"
          strokeDasharray="4 4"
          strokeOpacity={0.7}
          label={{
            value: `Recommended fleet · ${data.elbow}`,
            position: 'top',
            fill: 'var(--amber)',
            fontSize: 10,
          }}
        />
        {currentK ? (
          <ReferenceLine
            x={currentK}
            stroke="var(--muted-foreground)"
            strokeOpacity={0.4}
          />
        ) : null}
        <Line
          dataKey="even_pct"
          stroke="var(--color-even_pct)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
          strokeOpacity={0.55}
        />
        <Line
          dataKey="volume_pct"
          stroke="var(--color-volume_pct)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
          strokeOpacity={0.8}
        />
        <Line
          dataKey="optimized_pct"
          stroke="var(--color-optimized_pct)"
          strokeWidth={2.5}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  )
}
