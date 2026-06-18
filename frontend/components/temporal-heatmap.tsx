'use client'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { formatIN } from '@/lib/format'
import type { Temporal } from '@/lib/types'

function cellColor(value: number, max: number): string {
  if (value <= 0) return 'var(--secondary)'
  const t = value / max
  // amber-weighted single-hue ramp from dim surface to amber
  const stops = [
    [28, 31, 36], // #1c1f24
    [120, 75, 20],
    [245, 166, 35], // amber
  ]
  const seg = t < 0.5 ? 0 : 1
  const local = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5
  const a = stops[seg]
  const b = stops[seg + 1]
  const r = Math.round(a[0] + (b[0] - a[0]) * local)
  const g = Math.round(a[1] + (b[1] - a[1]) * local)
  const bl = Math.round(a[2] + (b[2] - a[2]) * local)
  return `rgb(${r}, ${g}, ${bl})`
}

function hourLabel(h: number) {
  if (h === 0) return '12a'
  if (h === 12) return '12p'
  return h < 12 ? `${h}a` : `${h - 12}p`
}

export function TemporalHeatmap({ data }: { data?: Temporal | null }) {
  if (!data) return <Skeleton className="h-[260px] w-full" />

  const max = Math.max(...data.matrix.flat())

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* hour header */}
          <div className="flex pl-10">
            {data.hours.map((h) => (
              <div
                key={h}
                className="flex-1 text-center text-[9px] tabular-nums text-dim"
              >
                {h % 3 === 0 ? hourLabel(h) : ''}
              </div>
            ))}
          </div>
          {/* rows */}
          <div className="flex flex-col gap-1 pt-1">
            {data.days.map((day, di) => (
              <div key={day} className="flex items-center gap-1">
                <div className="w-9 shrink-0 text-right text-[11px] font-medium text-muted-foreground">
                  {day}
                </div>
                <div className="flex flex-1 gap-1">
                  {data.hours.map((h, hi) => {
                    const v = data.matrix[di][hi]
                    return (
                      <Tooltip key={h}>
                        <TooltipTrigger
                          render={
                            <div
                              className="aspect-square flex-1 rounded-[3px] border border-border/40 transition-transform hover:scale-110"
                              style={{ backgroundColor: cellColor(v, max) }}
                            />
                          }
                        />
                        <TooltipContent>
                          <span className="font-medium">
                            {day} {hourLabel(h)}
                          </span>{' '}
                          · {formatIN(v)} violations
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* legend */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Evenings (5–9 PM) ={' '}
          <span className="font-medium text-foreground">
            {data.evening_share_pct}%
          </span>{' '}
          of violations →{' '}
          <span className="text-primary">enforcement gap</span>. Peak window is
          mornings 8–11 AM IST.
        </p>
        <div className="hidden items-center gap-2 sm:flex">
          <span className="text-[10px] text-dim">Low</span>
          <div className="flex">
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <div
                key={t}
                className="size-3"
                style={{ backgroundColor: cellColor(t * max, max) }}
              />
            ))}
          </div>
          <span className="text-[10px] text-dim">High</span>
        </div>
      </div>
    </div>
  )
}
