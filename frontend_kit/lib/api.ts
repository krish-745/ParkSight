// ParkSight API client — drop into your v0/Next.js project at  lib/api.ts
// Typed fetch wrappers for every backend endpoint. Field names match the FastAPI responses
// exactly (see sample_api_responses.json). Base URL is configurable via env.

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ---------- types ----------
export interface Hotspot {
  id: number;
  rank: number;
  lat: number;
  lon: number;
  cii: number;
  cii_normalized: number;
  impact: number;
  violations: number;
  junction_pct: number;
  peak_hour: number;
  shift: string;
  radius_m: number;
  station: string;
  dominant_junction: string;
  dominant_violation: string;
  dominant_vehicle: string;
  road_class: string | null;
  lanes: number | null;
}

export interface Stats {
  total_hotspots: number;
  total_violations: number;
  clustered_pct: number;
  noise_pct: number;
  date_range: string;
  peak_window_ist: string;
  evening_share_pct: number;
  top_stations: string[];
  recommended_fleet: number;
  coverage_at_recommended_pct: number;
}

export interface PatrolStation {
  rank: number;
  lat: number;
  lon: number;
  station: string;
  road_class: string | null;
  lanes: number | null;
  hotspots_covered: number;
  covered_ids: number[];
  recommended_shift: string;
  impact_covered_pct: number;
}

export interface OptimizeResponse {
  num_patrols: number;
  cover_radius_m: number;
  total_coverage_pct: number;
  baseline_even_pct: number;
  baseline_volume_pct: number;
  plan: PatrolStation[];
}

export interface CoverageCurve {
  k: number[];
  optimized_pct: number[];
  even_pct: number[];
  volume_pct: number[];
  elbow: number;
  elbow_coverage_pct: number;
}

export interface Temporal {
  days: string[];
  hours: number[];
  matrix: number[][];
  peak_hours: number[];
  evening_share_pct: number;
}

export interface Breakdown {
  violation_types: { name: string; count: number }[];
  vehicle_types: { name: string; count: number }[];
}

// ---------- helpers ----------
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

// ---------- endpoints ----------
export const api = {
  stats: () => get<Stats>("/api/stats"),

  hotspots: (params: {
    limit?: number;
    min_cii?: number;
    violation?: string;
    station?: string;
  } = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
    });
    const qs = q.toString();
    return get<Hotspot[]>(`/api/hotspots${qs ? `?${qs}` : ""}`);
  },

  hotspot: (id: number) => get<Hotspot>(`/api/hotspots/${id}`),

  optimize: (body: { num_patrols: number; cover_radius_m?: number }) =>
    post<OptimizeResponse>("/api/optimize", {
      cover_radius_m: 1000,
      ...body,
    }),

  coverageCurve: (params: { kmax?: number; cover_radius_m?: number } = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) q.set(k, String(v));
    });
    const qs = q.toString();
    return get<CoverageCurve>(`/api/coverage-curve${qs ? `?${qs}` : ""}`);
  },

  temporal: () => get<Temporal>("/api/temporal"),
  breakdown: () => get<Breakdown>("/api/breakdown"),
};
