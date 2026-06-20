// Live ParkSight API layer — fetches from the FastAPI backend and transforms
// responses into the exact shapes the (Lovable) components already consume, so the
// design stays pixel-identical and only the data becomes real.
import { useEffect, useState } from "react";
import type { Hotspot } from "./mock";

// @ts-ignore
export const API_BASE = "https://flipkartround2-production.up.railway.app";

// ---- raw API types ----
export interface Stats {
  total_hotspots: number; total_violations: number; clustered_pct: number; noise_pct: number;
  date_range: string; peak_window_ist: string; evening_share_pct: number; top_stations: string[];
  recommended_fleet: number; coverage_at_recommended_pct: number;
}
export interface ApiHotspot {
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
export interface RouteResp {
  stops: { order: number; lat: number; lon: number; station: string; hotspots_covered: number; recommended_shift: string; dist_to_next_km: number; time_to_next_min: number }[];
  total_distance_km: number; total_time_min: number; polyline: number[][]; route_source: string;
}

// ---- fetch helpers ----
const get = async <T,>(p: string): Promise<T> => {
  const r = await fetch(`${API_BASE}${p}`); if (!r.ok) throw new Error(`${p} ${r.status}`); return r.json();
};
const post = async <T,>(p: string, body: unknown): Promise<T> => {
  const r = await fetch(`${API_BASE}${p}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${p} ${r.status}`); return r.json();
};

// blind spots: high predicted impact + low current enforcement activity
export interface BlindSpot {
  id: number; rank: number; lat: number; lon: number; station: string;
  dominant_violation: string; violations: number; impact: number; cii_normalized: number;
  blind_spot_score: number; severity: string; shift: string;
}
export interface BlindSpotsResp {
  total_blind_spots: number; critical_count: number; high_count: number; moderate_count: number;
  zones: BlindSpot[];
}
export interface RawViolation { lat: number; lon: number; violation_type: string; hour: number; }

// ---- graph-diffusion / flow layer ----
export interface HotspotHourly { id: number; lat: number; lon: number; name: string; peak_hour: number; hourly: number[]; }
export interface HotspotHourlyResp { hours: number[]; count: number; hotspots: HotspotHourly[]; }
export interface FlowParams { alpha: number; beta: number; sigma_m: number; k: number; }
export interface FlowReceiver { id: number; lat: number; lon: number; name: string; share: number; }
export interface DisplacementResp {
  source: { id: number; lat: number; lon: number; name: string };
  sigma_m: number; steps: number; receivers: FlowReceiver[];
}

export const apiGetStats = () => get<Stats>("/api/stats");
export const apiGetHotspots = (limit = 600) => get<ApiHotspot[]>(`/api/hotspots?limit=${limit}`);
export const apiGetBlindspots = (top_n = 40) => get<BlindSpotsResp>(`/api/blindspots?top_n=${top_n}`);
export const apiGetViolations = (limit = 2500) => get<RawViolation[]>(`/api/violations?limit=${limit}`);
export const apiGetHotspotHourly = () => get<HotspotHourlyResp>("/api/hotspot-hourly");
export const apiGetDisplacement = (id: number, steps = 4) => get<DisplacementResp>(`/api/displacement/${id}?steps=${steps}`);
export const apiOptimize = (num_patrols: number, cover_radius_m = 1000) => post<OptimizeResult>("/api/optimize", { num_patrols, cover_radius_m });
export const apiCoverageCurve = (kmax = 60) => get<CoverageCurve>(`/api/coverage-curve?kmax=${kmax}`);
export const apiTemporal = () => get<Temporal>("/api/temporal");
export const apiBreakdown = () => get<Breakdown>("/api/breakdown");
export const apiRoute = (num_patrols: number, cover_radius_m = 1000) => post<RouteResp>("/api/route", { num_patrols, cover_radius_m });

// ---- geo → SVG (0..100) projection over the Bengaluru bbox ----
const BBOX = { s: 12.8, n: 13.3, w: 77.3, e: 77.8 };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export function project(lat: number, lon: number): { x: number; y: number } {
  return {
    x: clamp(((lon - BBOX.w) / (BBOX.e - BBOX.w)) * 100, 2, 98),
    y: clamp(((BBOX.n - lat) / (BBOX.n - BBOX.s)) * 100, 2, 98),
  };
}

// ---- geo points (real lat/lon) for the interactive Leaflet map ----
export type GeoPoint = {
  id: string; lat: number; lon: number; intensity: number; violations: number;
  name: string; dominant_violation: string; shift: string; road_class: string;
};
export const toGeoPoints = (hs: ApiHotspot[]): GeoPoint[] =>
  hs.map((h) => ({
    id: `H-${h.id}`, lat: h.lat, lon: h.lon, intensity: clamp(h.cii_normalized / 100, 0, 1),
    violations: h.violations, name: h.station, dominant_violation: h.dominant_violation,
    shift: h.shift, road_class: h.road_class ?? "n/a",
  }));

// ---- transforms → the shapes components already use ----
export const toMapPoints = (hs: ApiHotspot[]): Hotspot[] =>
  hs.map((h) => {
    const { x, y } = project(h.lat, h.lon);
    return { id: `H-${h.id}`, x, y, intensity: clamp(h.cii_normalized / 100, 0, 1), violations: h.violations, name: h.station };
  });

export const toTopHotspots = (hs: ApiHotspot[]) =>
  hs.slice(0, 5).map((h) => ({ rank: h.rank, name: `${h.station}${h.dominant_junction && h.dominant_junction !== "Unknown" ? " · " + h.dominant_junction : ""}`, violations: h.violations, trend: 0 }));

export const toPeakHours = (t: Temporal): number[] => {
  const perHour = Array.from({ length: 24 }, (_, h) => t.matrix.reduce((a, row) => a + (row[h] ?? 0), 0));
  const max = Math.max(...perHour, 1);
  return perHour.map((v) => Math.round((v / max) * 100));
};

// ---- generic client-side live hook (SSR renders `fallback`, client swaps in real) ----
export function useLive<T>(fetcher: () => Promise<T>, fallback: T): T {
  const [data, setData] = useState<T>(fallback);
  useEffect(() => {
    let on = true;
    fetcher().then((d) => { if (on) setData(d); }).catch(() => {});
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return data;
}
