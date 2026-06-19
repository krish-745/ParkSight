'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { computeRoute } from '@/lib/api'
import type { RouteResult, Hotspot } from '@/lib/types'

const RouteMap = dynamic(() => import('@/components/patrol-route-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-[420px] w-full" />,
})

function RouteStopsTable({ route }: { route: RouteResult }) {
  return (
    <div className="overflow-auto max-h-[260px]">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-background">
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2 pr-3 font-medium">#</th>
            <th className="py-2 pr-3 font-medium">Station</th>
            <th className="py-2 pr-3 font-medium text-right">Covers</th>
            <th className="py-2 pr-3 font-medium">Shift</th>
            <th className="py-2 pr-3 font-medium text-right">Dist (km)</th>
            <th className="py-2 font-medium text-right">ETA (min)</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {route.stops.map((s) => (
            <tr key={s.order} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
              <td className="py-1.5 pr-3 text-muted-foreground">{s.order}</td>
              <td className="py-1.5 pr-3 max-w-[140px] truncate">{s.station}</td>
              <td className="py-1.5 pr-3 text-right">{s.hotspots_covered}</td>
              <td className="py-1.5 pr-3 text-muted-foreground text-[10px]">
                {s.recommended_shift.split(' ')[0]}
              </td>
              <td className="py-1.5 pr-3 text-right">{s.dist_to_next_km.toFixed(1)}</td>
              <td className="py-1.5 text-right">{s.time_to_next_min.toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function RouteOptimizerPanel({ hotspots }: { hotspots?: Hotspot[] }) {
  const [patrols, setPatrols] = useState(10)
  const [radius, setRadius] = useState(1000)
  const [speed, setSpeed] = useState(25)
  const [route, setRoute] = useState<RouteResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCompute = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await computeRoute(patrols, radius, speed)
      setRoute(result)
    } catch (e) {
      setError('Route computation failed. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }, [patrols, radius, speed])

  const handleClear = () => {
    setRoute(null)
    setError(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* controls */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Patrol Stops</CardTitle>
            <CardDescription className="text-xs">Number of stations in the circuit</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Units</span>
              <span className="font-mono font-medium tabular-nums">{patrols}</span>
            </div>
            <Slider
              value={[patrols]}
              min={2}
              max={30}
              step={1}
              onValueChange={(v) => { setPatrols(v[0]); setRoute(null) }}
              aria-label="Patrol stops"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Coverage Radius</CardTitle>
            <CardDescription className="text-xs">Per-patrol coverage radius</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Radius</span>
              <span className="font-mono font-medium tabular-nums">{radius} m</span>
            </div>
            <Slider
              value={[radius]}
              min={200}
              max={3000}
              step={100}
              onValueChange={(v) => { setRadius(v[0]); setRoute(null) }}
              aria-label="Coverage radius"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Patrol Speed</CardTitle>
            <CardDescription className="text-xs">Average driving speed (fallback)</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Speed</span>
              <span className="font-mono font-medium tabular-nums">{speed} km/h</span>
            </div>
            <Slider
              value={[speed]}
              min={5}
              max={60}
              step={5}
              onValueChange={(v) => { setSpeed(v[0]); setRoute(null) }}
              aria-label="Patrol speed"
            />
          </CardContent>
        </Card>
      </div>

      {/* compute button */}
      <div className="flex items-center gap-3">
        <Button
          id="btn-compute-route"
          onClick={handleCompute}
          disabled={loading}
          className="gap-2"
        >
          {loading ? (
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" strokeDashoffset="10" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M13 5l7 7-7 7" />
            </svg>
          )}
          {loading ? 'Computing...' : 'Compute Patrol Circuit'}
        </Button>
        {route && (
          <Button variant="ghost" size="sm" onClick={handleClear}>
            Clear route
          </Button>
        )}
        {error && (
          <span className="text-xs text-destructive">{error}</span>
        )}
      </div>

      {/* route summary bar */}
      {route && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-teal-500/30 bg-teal-500/5 px-5 py-3">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3FB6A8" strokeWidth="2">
              <path d="M3 12h18M13 5l7 7-7 7" />
            </svg>
            <span className="text-xs font-medium text-muted-foreground">Patrol Circuit</span>
          </div>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <div className="font-mono text-lg font-bold tabular-nums text-teal-400">
              {route.total_distance_km.toFixed(1)} km
            </div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Distance</div>
          </div>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <div className="font-mono text-lg font-bold tabular-nums text-teal-400">
              {Math.round(route.total_time_min)} min
            </div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Est. time</div>
          </div>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <div className="font-mono text-lg font-bold tabular-nums">
              {route.stops.length}
            </div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Stops</div>
          </div>
          <Separator orientation="vertical" className="h-6" />
          <Badge variant="outline" className="text-[10px] font-normal">
            {route.route_source === 'osrm' ? '🛣 Road-snapped (OSRM)' : '〰 Estimated (haversine)'}
          </Badge>
        </div>
      )}

      {/* map */}
      <Card className="overflow-hidden p-0">
        <div style={{ height: 420 }}>
          <RouteMap hotspots={hotspots} route={route} />
        </div>
      </Card>

      {/* stops table */}
      {route && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Stop Sequence</CardTitle>
            <CardDescription>
              TSP-optimised driving order · nearest-neighbour + 2-opt improvement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RouteStopsTable route={route} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
