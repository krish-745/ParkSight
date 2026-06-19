// ParkSight API client (Vite). Talks to the FastAPI backend on :8000.
export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export interface Stats {
  total_hotspots: number; total_violations: number; clustered_pct: number;
  noise_pct: number; date_range: string; peak_window_ist: string;
  evening_share_pct: number; top_stations: string[];
  recommended_fleet: number; coverage_at_recommended_pct: number;
}
export interface Hotspot {
  id: number; rank: number; lat: number; lon: number; cii: number; cii_normalized: number;
  impact: number; violations: number; junction_pct: number; peak_hour: number; shift: string;
  radius_m: number; station: string; dominant_junction: string; dominant_violation: string;
  dominant_vehicle: string; road_class: string | null; lanes: number | null;
}
export interface PatrolStation {
  rank: number; lat: number; lon: number; station: string; road_class: string | null;
  lanes: number | null; hotspots_covered: number; covered_ids: number[];
  recommended_shift: string; impact_covered_pct: number;
}
export interface OptimizeResult {
  num_patrols: number; cover_radius_m: number; total_coverage_pct: number;
  baseline_even_pct: number; baseline_volume_pct: number; plan: PatrolStation[];
}
export interface CoverageCurve {
  k: number[]; optimized_pct: number[]; even_pct: number[]; volume_pct: number[];
  elbow: number; elbow_coverage_pct: number;
}
export interface Temporal { days: string[]; hours: number[]; matrix: number[][]; peak_hours: number[]; evening_share_pct: number; }
export interface Breakdown { violation_types: { name: string; count: number }[]; vehicle_types: { name: string; count: number }[]; }

const get = async <T,>(p: string): Promise<T> => {
  const r = await fetch(`${API_BASE}${p}`); if (!r.ok) throw new Error(`${p} ${r.status}`); return r.json();
};
const post = async <T,>(p: string, body: unknown): Promise<T> => {
  const r = await fetch(`${API_BASE}${p}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${p} ${r.status}`); return r.json();
};

export const api = {
  stats: () => get<Stats>("/api/stats"),
  hotspots: (limit = 600, violation?: string, station?: string) => {
    const q = new URLSearchParams({ limit: String(limit) });
    if (violation) q.set("violation", violation);
    if (station) q.set("station", station);
    return get<Hotspot[]>(`/api/hotspots?${q}`);
  },
  optimize: (num_patrols: number, cover_radius_m = 1000) => post<OptimizeResult>("/api/optimize", { num_patrols, cover_radius_m }),
  coverageCurve: (kmax = 40) => get<CoverageCurve>(`/api/coverage-curve?kmax=${kmax}`),
  temporal: () => get<Temporal>("/api/temporal"),
  breakdown: () => get<Breakdown>("/api/breakdown"),
};
