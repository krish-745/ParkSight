'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { OptimizeResult } from '@/lib/types'

const VIOLATION_OPTIONS = [
  'WRONG PARKING',
  'NO PARKING',
  'PARKING IN A MAIN ROAD',
  'DEFECTIVE NUMBER PLATE',
  'PARKING ON FOOTPATH',
  'PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC',
  'PARKING NEAR ROAD CROSSING',
  'DOUBLE PARKING',
]

export function PatrolOptimizer({
  patrols,
  radius,
  onPatrols,
  onRadius,
  result,
  loading,
  stations,
  violation,
  station,
  onViolation,
  onStation,
}: {
  patrols: number
  radius: number
  onPatrols: (v: number) => void
  onRadius: (v: number) => void
  result?: OptimizeResult | null
  loading?: boolean
  stations: string[]
  violation: string
  station: string
  onViolation: (v: string) => void
  onStation: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Patrol Optimizer</CardTitle>
          <CardDescription>
            Maximum-coverage deployment across congestion impact.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* coverage hero */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Impact coverage
            </span>
            {loading && !result ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <span className="font-mono text-5xl font-semibold tabular-nums tracking-tight text-primary">
                {result?.total_coverage_pct ?? 0}
                <span className="text-2xl text-muted-foreground">%</span>
              </span>
            )}
            <div className="mt-1 flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1 font-normal">
                Even spread
                <span className="font-mono tabular-nums text-muted-foreground">
                  {result?.baseline_even_pct ?? '—'}%
                </span>
              </Badge>
              <Badge variant="outline" className="gap-1 font-normal">
                Volume-only
                <span className="font-mono tabular-nums text-muted-foreground">
                  {result?.baseline_volume_pct ?? '—'}%
                </span>
              </Badge>
            </div>
          </div>

          <Separator />

          {/* sliders */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Patrol units</span>
              <span className="font-mono font-medium tabular-nums">
                {patrols}
              </span>
            </div>
            <Slider
              value={[patrols]}
              min={1}
              max={40}
              step={1}
              onValueChange={(v) => onPatrols(v[0])}
              aria-label="Patrol units"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Coverage radius</span>
              <span className="font-mono font-medium tabular-nums">
                {radius} m
              </span>
            </div>
            <Slider
              value={[radius]}
              min={200}
              max={3000}
              step={100}
              onValueChange={(v) => onRadius(v[0])}
              aria-label="Coverage radius"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Violation type
            </span>
            <Select value={violation} onValueChange={onViolation}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string) => (v === 'all' ? 'All violations' : v)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All violations</SelectItem>
                  {VIOLATION_OPTIONS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Police station
            </span>
            <Select value={station} onValueChange={onStation}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string) => (v === 'all' ? 'All stations' : v)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All stations</SelectItem>
                  {stations.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
