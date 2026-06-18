"""Pydantic request/response models — also documents the API contract for the frontend."""

from typing import List, Optional
from pydantic import BaseModel, Field


class Hotspot(BaseModel):
    id: int
    rank: int
    lat: float
    lon: float
    cii: float                      # congestion impact index (severity-weighted)
    cii_normalized: float           # 0-100
    impact: float                   # road-capacity-weighted impact (used by optimizer)
    violations: int
    junction_pct: float
    peak_hour: int                  # IST
    shift: str
    radius_m: float
    station: str
    dominant_junction: str
    dominant_violation: str
    dominant_vehicle: str
    road_class: Optional[str] = None
    lanes: Optional[int] = None


class Stats(BaseModel):
    total_hotspots: int
    total_violations: int
    clustered_pct: float
    noise_pct: float
    date_range: str
    peak_window_ist: str
    evening_share_pct: float
    top_stations: List[str]
    recommended_fleet: int
    coverage_at_recommended_pct: float


class OptimizeRequest(BaseModel):
    num_patrols: int = Field(15, ge=1, le=100, description="Number of patrol units to deploy")
    cover_radius_m: int = Field(1000, ge=200, le=3000, description="Coverage radius per patrol (m)")


class PatrolStation(BaseModel):
    rank: int
    lat: float
    lon: float
    station: str
    road_class: Optional[str]
    lanes: Optional[int]
    hotspots_covered: int
    covered_ids: List[int]
    recommended_shift: str
    impact_covered_pct: float


class OptimizeResponse(BaseModel):
    num_patrols: int
    cover_radius_m: int
    total_coverage_pct: float
    baseline_even_pct: float
    baseline_volume_pct: float
    plan: List[PatrolStation]


class CoverageCurve(BaseModel):
    k: List[int]
    optimized_pct: List[float]
    even_pct: List[float]
    volume_pct: List[float]
    elbow: int
    elbow_coverage_pct: float


# ── Patrol Route Optimizer (TSP) ──

class RouteStop(BaseModel):
    order: int                       # 1-indexed stop order in the tour
    lat: float
    lon: float
    station: str
    hotspots_covered: int
    recommended_shift: str
    dist_to_next_km: float           # road distance to the next stop
    time_to_next_min: float          # estimated travel time to the next stop


class RouteRequest(BaseModel):
    num_patrols: int = Field(10, ge=2, le=50, description="Number of patrol stations to route through")
    cover_radius_m: int = Field(1000, ge=200, le=3000, description="Coverage radius per patrol (m)")
    avg_speed_kmh: float = Field(25.0, ge=5, le=80, description="Average patrol driving speed (km/h)")


class RouteResponse(BaseModel):
    stops: List[RouteStop]
    total_distance_km: float
    total_time_min: float
    polyline: List[List[float]]      # [[lat, lon], ...] road-snapped or straight-line
    route_source: str                # "osrm" or "haversine_fallback"
