// ParkSight API client — talks to FastAPI backend via Vite proxy (/api → :8000)
const API_BASE = import.meta.env.VITE_API_URL ?? "";

// ── Types ──────────────────────────────────────────────────────────────────

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

export interface OptimizeResult {
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

export interface RouteStop {
  order: number;
  lat: number;
  lon: number;
  station: string;
  hotspots_covered: number;
  recommended_shift: string;
  dist_to_next_km: number;
  time_to_next_min: number;
}

export interface RouteResponse {
  stops: RouteStop[];
  total_distance_km: number;
  total_time_min: number;
  polyline: [number, number][];
  route_source: string;
}

export interface BlindSpot {
  id: number;
  rank: number;
  lat: number;
  lon: number;
  station: string;
  dominant_violation: string;
  dominant_junction: string;
  violations: number;
  impact: number;
  cii_normalized: number;
  impact_rank: number;
  enforcement_rank: number;
  blind_spot_score: number;
  severity: string;
  shift: string;
}

export interface BlindSpotsResponse {
  total_blind_spots: number;
  critical_count: number;
  high_count: number;
  moderate_count: number;
  zones: BlindSpot[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

const get = async <T,>(p: string): Promise<T> => {
  const r = await fetch(`${API_BASE}${p}`);
  if (!r.ok) throw new Error(`${p} ${r.status}`);
  return r.json();
};

const post = async <T,>(p: string, body: unknown): Promise<T> => {
  const r = await fetch(`${API_BASE}${p}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${p} ${r.status}`);
  return r.json();
};

// ── API methods ────────────────────────────────────────────────────────────

export const api = {
  stats: () => get<Stats>("/api/stats"),

  hotspots: (limit = 600, violation?: string, station?: string) => {
    const q = new URLSearchParams({ limit: String(limit) });
    if (violation && violation !== "all") q.set("violation", violation);
    if (station && station !== "all") q.set("station", station);
    return get<Hotspot[]>(`/api/hotspots?${q}`);
  },

  hotspot: (id: number) => get<Hotspot>(`/api/hotspots/${id}`),

  optimize: (num_patrols: number, cover_radius_m = 1000) =>
    post<OptimizeResult>("/api/optimize", { num_patrols, cover_radius_m }),

  coverageCurve: (kmax = 40, cover_radius_m = 1000) =>
    get<CoverageCurve>(`/api/coverage-curve?kmax=${kmax}&cover_radius_m=${cover_radius_m}`),

  temporal: () => get<Temporal>("/api/temporal"),

  breakdown: () => get<Breakdown>("/api/breakdown"),

  route: (num_patrols = 10, cover_radius_m = 1000, avg_speed_kmh = 25) =>
    post<RouteResponse>("/api/route", { num_patrols, cover_radius_m, avg_speed_kmh }),

  blindspots: (top_n = 30) => get<BlindSpotsResponse>(`/api/blindspots?top_n=${top_n}`),
};

// ── Utility: heat color (teal → orange → red) ─────────────────────────────

export function heatColor(norm: number): string {
  const t = Math.max(0, Math.min(1, norm / 100));
  if (t < 0.5) {
    const u = t / 0.5;
    const r = Math.round(56 + (245 - 56) * u);
    const g = Math.round(178 + (166 - 178) * u);
    const b = Math.round(172 + (35 - 172) * u);
    return `rgb(${r},${g},${b})`;
  }
  const u = (t - 0.5) / 0.5;
  const r = Math.round(245 + (239 - 245) * u);
  const g = Math.round(166 + (68 - 166) * u);
  const b = Math.round(35 + (68 - 35) * u);
  return `rgb(${r},${g},${b})`;
}

export function severityLabel(norm: number): [string, string] {
  if (norm >= 50) return ["Critical", "red"];
  if (norm >= 20) return ["High", "orange"];
  return ["Moderate", "teal"];
}

export function formatIN(n: number): string {
  return n.toLocaleString("en-IN");
}

// Station list for filters
export const STATIONS = [
  "Upparpet", "Shivajinagar", "HAL Old Airport", "Malleshwaram",
  "Vijayanagara", "Cubbon Park", "Magadi Road", "Banaswadi",
  "Jeevanbheemanagar", "Halasuru Gate", "Commercial Street",
  "Wilson Garden", "Basavanagudi", "Rajajinagar", "Yeshwantpur",
  "Cottonpet", "Kempegowda Nagar", "Ashoknagar", "Seshadripuram",
  "High Grounds",
];

export const VIOLATIONS = [
  "WRONG PARKING", "NO PARKING", "PARKING IN A MAIN ROAD",
  "DEFECTIVE NUMBER PLATE", "PARKING ON FOOTPATH",
  "PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC",
  "PARKING NEAR ROAD CROSSING", "DOUBLE PARKING",
];
