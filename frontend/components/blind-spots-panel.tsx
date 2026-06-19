'use client'

import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { BlindSpotsResult, BlindSpot } from '@/lib/types'

const SEVERITY_VARIANT: Record<string, 'destructive' | 'outline' | 'secondary'> = {
  Critical: 'destructive',
  High: 'outline',
  Moderate: 'secondary',
}

const SEVERITY_COLOR: Record<string, string> = {
  Critical: 'text-red-400',
  High: 'text-orange-400',
  Moderate: 'text-yellow-400',
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color =
    score >= 0.4 ? 'bg-red-500' : score >= 0.2 ? 'bg-orange-400' : 'bg-yellow-400'
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="relative h-1.5 w-16 rounded-full bg-muted/30">
        <div
          className={`absolute left-0 top-0 h-full rounded-full ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-[10px] font-mono tabular-nums text-muted-foreground">{score.toFixed(2)}</span>
    </div>
  )
}

function BlindSpotRow({ zone, idx }: { zone: BlindSpot; idx: number }) {
  return (
    <div
      className="grid items-center gap-x-3 gap-y-0.5 py-2.5 border-b border-border/40 last:border-0"
      style={{
        gridTemplateColumns: '1.5rem 1fr auto auto',
      }}
    >
      {/* index */}
      <span className="text-xs font-mono text-muted-foreground tabular-nums">{idx + 1}</span>

      {/* station + details */}
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium leading-snug">{zone.station}</div>
        <div className="truncate text-[11px] text-muted-foreground leading-snug">
          {zone.dominant_violation} · {zone.shift.split(' ')[0]}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
          <span>Impact #{zone.impact_rank}</span>
          <span className="text-border/60">·</span>
          <span>Enf #{zone.enforcement_rank}</span>
          <span className="text-border/60">·</span>
          <span>{zone.violations.toLocaleString('en-IN')} violations</span>
        </div>
      </div>

      {/* score bar */}
      <ScoreBar score={zone.blind_spot_score} />

      {/* severity badge */}
      <Badge
        variant={SEVERITY_VARIANT[zone.severity] ?? 'secondary'}
        className={`text-[10px] px-1.5 py-0 shrink-0 ${SEVERITY_COLOR[zone.severity] ?? ''}`}
      >
        {zone.severity}
      </Badge>
    </div>
  )
}

export function BlindSpotsPanel({
  data,
  loading,
}: {
  data?: BlindSpotsResult | null
  loading?: boolean
}) {
  if (loading && !data) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="flex flex-col gap-4">
      {/* summary KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-center">
          <div className="text-2xl font-bold tabular-nums text-red-400">
            {data.critical_count}
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Critical
          </div>
        </div>
        <div className="rounded-lg border border-orange-400/30 bg-orange-400/5 px-4 py-3 text-center">
          <div className="text-2xl font-bold tabular-nums text-orange-400">
            {data.high_count}
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            High
          </div>
        </div>
        <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/5 px-4 py-3 text-center">
          <div className="text-2xl font-bold tabular-nums text-yellow-400">
            {data.moderate_count}
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Moderate
          </div>
        </div>
      </div>

      {/* caveat banner */}
      <p className="rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
        <strong className="text-foreground">Relative under-coverage</strong> — zones where
        congestion impact rank significantly exceeds enforcement activity rank. These are not
        proven absent of policing, but indicate where redeployment could close the gap.
      </p>

      {/* ranked list */}
      <div className="flex flex-col divide-y divide-border/30 rounded-lg border border-border/50 overflow-hidden">
        <div
          className="grid gap-x-3 bg-muted/30 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"
          style={{ gridTemplateColumns: '1.5rem 1fr auto auto' }}
        >
          <span>#</span>
          <span>Zone</span>
          <span>BSS</span>
          <span>Severity</span>
        </div>
        <div className="divide-y divide-border/30 max-h-[440px] overflow-y-auto px-3">
          {data.zones.map((zone, idx) => (
            <BlindSpotRow key={zone.id} zone={zone} idx={idx} />
          ))}
        </div>
      </div>
    </div>
  )
}
