// Typed fetch helpers for all ParkSight API endpoints.
// The Next.js config proxies /api/* → http://127.0.0.1:8000/api/*

import type {
  Stats,
  Hotspot,
  OptimizeResult,
  CoverageCurve,
  TemporalData,
  BreakdownData,
  BreakdownItem,
  RouteResult,
  BlindSpotsResult,
} from './types'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

// ── Stats ──────────────────────────────────────────────────────────────────
export const getStats = (): Promise<Stats> => fetcher('/api/stats')

// ── Hotspots ───────────────────────────────────────────────────────────────
export function getHotspots(opts?: {
  violation?: string
  station?: string
  limit?: number
}): Promise<Hotspot[]> {
  const qs = new URLSearchParams({ limit: String(opts?.limit ?? 600) })
  if (opts?.violation && opts.violation !== 'all') qs.set('violation', opts.violation)
  if (opts?.station && opts.station !== 'all') qs.set('station', opts.station)
  return fetcher(`/api/hotspots?${qs}`)
}

// ── Optimizer ──────────────────────────────────────────────────────────────
export function optimizePatrols(
  num_patrols: number,
  cover_radius_m = 1000,
): Promise<OptimizeResult> {
  return fetch('/api/optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ num_patrols, cover_radius_m }),
  }).then((r) => r.json())
}

// ── Coverage curve ─────────────────────────────────────────────────────────
export function getCoverageCurve(
  kmax = 40,
  cover_radius_m = 1000,
): Promise<CoverageCurve> {
  return fetcher(`/api/coverage-curve?kmax=${kmax}&cover_radius_m=${cover_radius_m}`)
}

// ── Temporal + Breakdown ───────────────────────────────────────────────────
export const getTemporal = (): Promise<TemporalData> => fetcher('/api/temporal')
export const getBreakdown = (): Promise<BreakdownData> => fetcher('/api/breakdown')

export function getStationBreakdown(): Promise<BreakdownItem[]> {
  return getHotspots({ limit: 600 }).then((hs) => {
    const counts: Record<string, number> = {}
    for (const h of hs) {
      counts[h.station] = (counts[h.station] ?? 0) + h.violations
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  })
}

// ── Patrol Route (TSP) ─────────────────────────────────────────────────────
export function computeRoute(
  num_patrols: number,
  cover_radius_m = 1000,
  avg_speed_kmh = 25,
): Promise<RouteResult> {
  return fetch('/api/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ num_patrols, cover_radius_m, avg_speed_kmh }),
  }).then((r) => r.json())
}

// ── Enforcement Blind Spots ────────────────────────────────────────────────
export function getBlindSpots(top_n = 30): Promise<BlindSpotsResult> {
  return fetcher(`/api/blindspots?top_n=${top_n}`)
}
