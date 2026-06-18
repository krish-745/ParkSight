import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatIN } from '@/lib/format'
import type { Stats } from '@/lib/types'

function Kpi({
  label,
  value,
  suffix,
  accent,
}: {
  label: string
  value: string
  suffix?: string
  accent?: boolean
}) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex flex-col gap-1.5 p-4">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span
          className={`font-mono text-3xl font-semibold tabular-nums tracking-tight ${
            accent ? 'text-primary' : 'text-foreground'
          }`}
        >
          {value}
          {suffix ? (
            <span className="ml-0.5 text-lg font-medium text-muted-foreground">
              {suffix}
            </span>
          ) : null}
        </span>
      </CardContent>
    </Card>
  )
}

export function KpiCards({ stats }: { stats?: Stats }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="py-0">
            <CardContent className="flex flex-col gap-2 p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi label="Hotspots" value={formatIN(stats.total_hotspots)} />
      <Kpi label="Violations" value={formatIN(stats.total_violations)} />
      <Kpi
        label="Recommended patrols"
        value={String(stats.recommended_fleet)}
      />
      <Kpi
        label="Achievable coverage"
        value={String(stats.coverage_at_recommended_pct)}
        suffix="%"
        accent
      />
    </div>
  )
}
