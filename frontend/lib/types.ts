// TypeScript interfaces for all ParkSight API responses

export interface Hotspot {
  id: number
  rank: number
  lat: number
  lon: number
  cii: number
  cii_normalized: number
  impact: number
  violations: number
  junction_pct: number
  peak_hour: number
  shift: string
  radius_m: number
  station: string
  dominant_junction: string
  dominant_violation: string
  dominant_vehicle: string
  road_class?: string
  lanes?: number
}

export interface Stats {
  total_hotspots: number
  total_violations: number
  clustered_pct: number
  noise_pct: number
  date_range: string
  peak_window_ist: string
  evening_share_pct: number
  top_stations: string[]
  recommended_fleet: number
  coverage_at_recommended_pct: number
}

export interface PatrolStation {
  rank: number
  lat: number
  lon: number
  station: string
  road_class?: string
  lanes?: number
  hotspots_covered: number
  covered_ids: number[]
  recommended_shift: string
  impact_covered_pct: number
}

export interface OptimizeResult {
  num_patrols: number
  cover_radius_m: number
  total_coverage_pct: number
  baseline_even_pct: number
  baseline_volume_pct: number
  plan: PatrolStation[]
}

export interface CoverageCurve {
  k: number[]
  optimized_pct: number[]
  even_pct: number[]
  volume_pct: number[]
  elbow: number
  elbow_coverage_pct: number
}

export interface TemporalData {
  days: string[]
  hours: number[]
  matrix: number[][]
  peak_hours: number[]
  evening_share_pct: number
}

export interface BreakdownItem {
  name: string
  count: number
}

export interface BreakdownData {
  violation_types: BreakdownItem[]
  vehicle_types: BreakdownItem[]
}

// Patrol Route Optimizer (TSP)
export interface RouteStop {
  order: number
  lat: number
  lon: number
  station: string
  hotspots_covered: number
  recommended_shift: string
  dist_to_next_km: number
  time_to_next_min: number
}

export interface RouteResult {
  stops: RouteStop[]
  total_distance_km: number
  total_time_min: number
  polyline: [number, number][]
  route_source: 'osrm' | 'haversine_fallback'
}

// Enforcement Blind Spots
export interface BlindSpot {
  id: number
  rank: number
  lat: number
  lon: number
  station: string
  dominant_violation: string
  dominant_junction: string
  violations: number
  impact: number
  cii_normalized: number
  impact_rank: number
  enforcement_rank: number
  blind_spot_score: number
  severity: 'Critical' | 'High' | 'Moderate'
  shift: string
}

export interface BlindSpotsResult {
  total_blind_spots: number
  critical_count: number
  high_count: number
  moderate_count: number
  zones: BlindSpot[]
}
