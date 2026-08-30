"""
ParkSight API — backend for the parking-congestion Enforcement Command Center.

Serves hotspot data, temporal/breakdown analytics, and the live patrol-deployment optimizer.
Frontend (designed separately) consumes these JSON endpoints. Interactive docs at /docs.

Run:  uvicorn main:app --reload --port 8000     (from the app/ folder)
"""

import os
import logging
import numpy as np
import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import core
from data import get_store
from schemas import (Stats, Hotspot, OptimizeRequest, OptimizeResponse, CoverageCurve,
                     RouteRequest, RouteResponse, BlindSpotsResponse,
                     MultiRouteRequest, MultiRouteResponse)

logger = logging.getLogger("parksight")

HERE = os.path.dirname(os.path.abspath(__file__))

app = FastAPI(
    title="ParkSight API",
    version="1.0",
    description="AI-driven parking-congestion intelligence + enforcement deployment optimizer.",
)
# Frontend is hosted separately (design tool / static build) -> allow cross-origin during dev.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8080", "http://127.0.0.1:5173", "http://127.0.0.1:8080", "http://localhost:3000"],
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import traceback
from fastapi.responses import JSONResponse
from fastapi import Request

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception: {exc}")
    tb = traceback.format_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "traceback": tb},
        headers={"Access-Control-Allow-Origin": "*"}
    )



@app.get("/", include_in_schema=False)
def home():
    """API Root."""
    return {"message": "ParkSight API is running!"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/stats", response_model=Stats)
def stats():
    """KPI summary for the dashboard header + the recommended fleet size."""
    s = get_store()
    base = s.stats()
    curve = _coverage_curve(kmax=40, cover_radius_m=1000)
    base["recommended_fleet"] = curve["elbow"]
    base["coverage_at_recommended_pct"] = curve["elbow_coverage_pct"]
    return base


@app.get("/api/hotspots", response_model=list[Hotspot])
def hotspots(
    limit: int = Query(None, ge=1, le=1000),
    min_cii: float = Query(0.0, ge=0),
    violation: str = Query(None, description="filter by dominant violation type substring"),
    station: str = Query(None, description="filter by police station substring"),
):
    """All hotspots for the map / table (filterable)."""
    return get_store().hotspot_records(limit=limit, min_cii=min_cii,
                                       violation=violation, station=station)


@app.get("/api/hotspots/{hid}", response_model=Hotspot)
def hotspot(hid: int):
    """Single hotspot detail (click-through)."""
    h = get_store().hotspot(hid)
    if h is None:
        raise HTTPException(404, "hotspot not found")
    return h


@app.post("/api/optimize", response_model=OptimizeResponse)
def optimize(req: OptimizeRequest):
    """Optimal patrol deployment for the requested fleet size + coverage vs baselines."""
    s = get_store()
    hs = s.hs
    impact = hs["impact"].values
    nbrs = s.index.neighbors(req.cover_radius_m)
    total = s.total_impact

    chosen, curve = core.greedy_maxcover(impact, nbrs, req.num_patrols)
    even = np.mean([core.baseline_curve(impact, nbrs, req.num_patrols, o)
                    for o in core.even_order(len(impact))], axis=0)
    vol_order = hs["violation_count"].values.argsort()[::-1]
    vol = core.baseline_curve(impact, nbrs, req.num_patrols, vol_order)

    covered = np.zeros(len(impact), dtype=bool)
    plan = []
    for rank, i in enumerate(chosen, 1):
        cov = nbrs[i]
        r = hs.iloc[i]
        plan.append(dict(
            rank=rank, lat=float(r.centroid_lat), lon=float(r.centroid_lon),
            station=str(r.dominant_police_station),
            road_class=str(r.get("road_class", "n/a")), lanes=int(r.get("lanes", 0) or 0),
            hotspots_covered=int(len(cov)), covered_ids=[int(x) for x in cov],
            recommended_shift=core.shift_window(int(r.peak_hour)),
            impact_covered_pct=round(float(impact[cov].sum()) / total * 100, 2),
        ))
        covered[cov] = True

    return dict(
        num_patrols=req.num_patrols, cover_radius_m=req.cover_radius_m,
        total_coverage_pct=round(float(impact[covered].sum()) / total * 100, 1),
        baseline_even_pct=round(float(even[-1]) / total * 100, 1) if len(even) else 0.0,
        baseline_volume_pct=round(float(vol[-1]) / total * 100, 1) if len(vol) else 0.0,
        plan=plan,
    )


def _coverage_curve(kmax: int, cover_radius_m: int):
    s = get_store()
    impact = s.hs["impact"].values
    nbrs = s.index.neighbors(cover_radius_m)
    total = s.total_impact
    _, opt = core.greedy_maxcover(impact, nbrs, kmax)
    even = np.mean([core.baseline_curve(impact, nbrs, kmax, o)
                    for o in core.even_order(len(impact))], axis=0)
    vol_order = s.hs["violation_count"].values.argsort()[::-1]
    vol = core.baseline_curve(impact, nbrs, kmax, vol_order)
    elbow = core.elbow_k(opt, total)
    pct = lambda a: [round(float(x) / total * 100, 1) for x in a]
    return dict(
        k=list(range(1, len(opt) + 1)),
        optimized_pct=pct(opt), even_pct=pct(even), volume_pct=pct(vol),
        elbow=elbow,
        elbow_coverage_pct=round(float(opt[min(elbow, len(opt)) - 1]) / total * 100, 1) if len(opt) else 0.0,
    )


@app.get("/api/coverage-curve", response_model=CoverageCurve)
def coverage_curve(kmax: int = Query(40, ge=5, le=80), cover_radius_m: int = Query(1000, ge=200, le=3000)):
    """Impact-covered vs fleet-size, optimized vs baselines, + recommended fleet (elbow)."""
    return _coverage_curve(kmax, cover_radius_m)


# ─────────────────────────────────────────────────────────────────────────────
# Patrol Route Optimizer (TSP + OSRM road-snapped routing)
# ─────────────────────────────────────────────────────────────────────────────

OSRM_BASE = "https://router.project-osrm.org/route/v1/driving"
ROAD_FACTOR = 1.4  # haversine → road distance multiplier when OSRM unavailable


def _osrm_route(lats, lons):
    """Fetch a road-snapped route from the public OSRM API.
    Returns (polyline_coords, leg_distances_km, leg_durations_min) or None on failure."""
    coords_str = ";".join(f"{lon},{lat}" for lat, lon in zip(lats, lons))
    url = f"{OSRM_BASE}/{coords_str}?overview=full&geometries=geojson&steps=false"
    try:
        resp = httpx.get(url, timeout=10.0)
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") != "Ok":
            return None
        route = data["routes"][0]
        # GeoJSON coords are [lon, lat]; convert to [lat, lon]
        polyline = [[c[1], c[0]] for c in route["geometry"]["coordinates"]]
        legs = route["legs"]
        leg_dist = [leg["distance"] / 1000.0 for leg in legs]   # meters → km
        leg_time = [leg["duration"] / 60.0 for leg in legs]     # seconds → min
        return polyline, leg_dist, leg_time
    except Exception as e:
        logger.warning(f"OSRM request failed: {e}")
        return None


def _haversine_fallback(lats, lons, dist_matrix, tour, avg_speed_kmh):
    """Straight-line fallback with a road-factor multiplier."""
    n = len(tour)
    polyline = [[float(lats[tour[i]]), float(lons[tour[i]])] for i in range(n)]
    # close the loop visually
    polyline.append(polyline[0])
    leg_dist = []
    leg_time = []
    for i in range(n):
        d = dist_matrix[tour[i], tour[(i + 1) % n]] * ROAD_FACTOR
        leg_dist.append(round(d, 2))
        leg_time.append(round(d / avg_speed_kmh * 60, 1))
    return polyline, leg_dist, leg_time


@app.post("/api/route", response_model=RouteResponse)
def patrol_route(req: RouteRequest):
    """Compute the optimal patrol driving circuit (TSP) through the selected stations.

    1. Runs the max-coverage optimizer to pick station locations
    2. Solves TSP (nearest-neighbor + 2-opt) for the driving order
    3. Fetches road-snapped geometry from OSRM (falls back to haversine × 1.4)
    """
    s = get_store()
    hs = s.hs
    impact = hs["impact"].values
    nbrs = s.index.neighbors(req.cover_radius_m)

    # step 1: pick patrol stations via greedy max-coverage
    chosen, _ = core.greedy_maxcover(impact, nbrs, req.num_patrols)
    if len(chosen) < 2:
        raise HTTPException(400, "Need at least 2 patrol stations to compute a route")

    patrol_lats = [float(hs.iloc[i].centroid_lat) for i in chosen]
    patrol_lons = [float(hs.iloc[i].centroid_lon) for i in chosen]

    # step 2: solve TSP for optimal visit order
    tour_order, dist_matrix = core.solve_tsp(patrol_lats, patrol_lons)

    # reorder chosen indices to match tour
    ordered_chosen = [chosen[i] for i in tour_order]
    ordered_lats = [patrol_lats[i] for i in tour_order]
    ordered_lons = [patrol_lons[i] for i in tour_order]

    # step 3: get road-snapped route (OSRM) or fallback
    # OSRM needs the loop closed: append the start point
    loop_lats = ordered_lats + [ordered_lats[0]]
    loop_lons = ordered_lons + [ordered_lons[0]]

    osrm_result = _osrm_route(loop_lats, loop_lons)
    if osrm_result is not None:
        polyline, leg_dist, leg_time = osrm_result
        route_source = "osrm"
    else:
        polyline, leg_dist, leg_time = _haversine_fallback(
            patrol_lats, patrol_lons, dist_matrix, tour_order, req.avg_speed_kmh
        )
        route_source = "haversine_fallback"

    # build response stops
    stops = []
    for idx, ci in enumerate(ordered_chosen):
        r = hs.iloc[ci]
        cov = nbrs[ci]
        stops.append(dict(
            order=idx + 1,
            lat=float(r.centroid_lat),
            lon=float(r.centroid_lon),
            station=str(r.dominant_police_station),
            hotspots_covered=int(len(cov)),
            recommended_shift=core.shift_window(int(r.peak_hour)),
            dist_to_next_km=round(leg_dist[idx], 2),
            time_to_next_min=round(leg_time[idx], 1),
        ))

    total_dist = round(sum(leg_dist), 2)
    total_time = round(sum(leg_time), 1)

    return dict(
        stops=stops,
        total_distance_km=total_dist,
        total_time_min=total_time,
        polyline=polyline,
        route_source=route_source,
    )


@app.get("/api/temporal")
def temporal():
    """Day×hour violation heatmap (IST) + peak hours + evening coverage-gap share."""
    return get_store().temporal()


@app.get("/api/breakdown")
def breakdown():
    """Violation-type and vehicle-type distributions for bar charts."""
    return get_store().breakdown()


# ─────────────────────────────────────────────────────────────────────────────
# Enforcement Blind Spots
# ─────────────────────────────────────────────────────────────────────────────


@app.get("/api/blindspots", response_model=BlindSpotsResponse)
def blindspots(top_n: int = Query(30, ge=5, le=100)):
    """Zones with high predicted impact but low current enforcement activity.

    Returns zones where the blind-spot score is positive, sorted highest-first.
    Frame as 'relative under-coverage', not absolute proof of absence.
    """
    return get_store().blindspots(top_n=top_n)


# ─────────────────────────────────────────────────────────────────────────────
# Raw violation sample (for the 'raw violations' map layer)
# ─────────────────────────────────────────────────────────────────────────────


@app.get("/api/violations")
def violations(limit: int = Query(2000, ge=100, le=8000)):
    """A deterministic sample of individual violation points for the raw-violations
    map layer (the full ~115k set is too dense to render client-side)."""
    return get_store().raw_violations(limit=limit)


# ─────────────────────────────────────────────────────────────────────────────
# Graph-diffusion congestion forecaster  (flow algorithm + learned weights)
# ─────────────────────────────────────────────────────────────────────────────


@app.get("/api/hotspot-hourly")
def hotspot_hourly():
    """Real per-hotspot 24-hour intensity profile (normalised 0..1) — powers the
    time-of-day scrubber on the map."""
    return get_store().flow.hourly()


@app.get("/api/forecast")
def forecast(hour: int = Query(..., ge=0, le=23), steps: int = Query(1, ge=1, le=6)):
    """Predict the hotspot heatmap `steps` hours ahead of `hour` by rolling the learned
    graph-diffusion operator forward. Returns now / predicted / actual per hotspot."""
    return get_store().flow.forecast(hour=hour, steps=steps)


@app.get("/api/flow-graph")
def flow_graph(max_edges: int = Query(400, ge=20, le=2000)):
    """The learned diffusion graph (strongest spill-over edges) + fitted parameters
    (alpha/beta/sigma) and diagnostics."""
    return get_store().flow.graph(max_edges=max_edges)


@app.get("/api/displacement/{hotspot_id}")
def displacement(hotspot_id: int, steps: int = Query(4, ge=1, le=10), top: int = Query(12, ge=1, le=40)):
    """If this hotspot is cleared/enforced, where does the displaced parking demand flow?
    Random walk over the learned spill-over graph."""
    return get_store().flow.displacement(source_id=hotspot_id, steps=steps, top=top)


# ─────────────────────────────────────────────────────────────────────────────
# Multi-Vehicle Route Optimizer
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/multi-route", response_model=MultiRouteResponse)
def multi_route(req: MultiRouteRequest):
    """Cluster the top hotspots (filtered by shift time window) into per-car mini-routes.

    - shift_hours filters hotspots to those whose peak_hour falls in the window
      [current_hour, current_hour + shift_hours).  Falls back to all hotspots if
      the window yields fewer candidates than needed.
    - Each car gets a geographically tight cluster of stops_per_car hotspots.
    - TSP is solved within each cluster → optimal open route (no return to depot).
    - Routes are road-snapped via OSRM if available, haversine fallback otherwise.
    """
    import datetime

    s = get_store()
    hs = s.hs
    nbrs = s.index.neighbors(1000)   # 1km radius for hotspots_in_radius count

    # ── Determine shift window ──────────────────────────────────────────────
    if req.current_hour is not None:
        cur_h = req.current_hour
    else:
        ist = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
        cur_h = datetime.datetime.now(ist).hour

    end_h = (cur_h + req.shift_hours) % 24

    if cur_h <= end_h:
        mask = (hs["peak_hour"] >= cur_h) & (hs["peak_hour"] < end_h)
    else:  # wraps midnight
        mask = (hs["peak_hour"] >= cur_h) | (hs["peak_hour"] < end_h)

    filtered = hs[mask].copy()

    # fall back to full hotspot set if window is too narrow
    n_needed = req.num_cars * req.stops_per_car
    if len(filtered) < n_needed:
        filtered = hs.copy()

    # ── Cluster + TSP ───────────────────────────────────────────────────────
    lats       = filtered["centroid_lat"].values
    lons       = filtered["centroid_lon"].values
    impacts    = filtered["impact"].values
    h_indices  = filtered.index.values          # positional indices into s.hs

    cars_raw = core.cluster_and_route(
        lats, lons, impacts, h_indices,
        num_cars=req.num_cars, stops_per_car=req.stops_per_car,
    )

    if not cars_raw:
        raise HTTPException(400, "Not enough hotspots to build routes")

    # ── Build per-car response ──────────────────────────────────────────────
    cars_out = []
    for car in cars_raw:
        tour      = car["tour"]
        c_lats    = car["lats"]
        c_lons    = car["lons"]
        g_idx     = car["global_indices"]
        dist_mat  = car["dist_matrix"]

        ordered_lats = [float(c_lats[i]) for i in tour]
        ordered_lons = [float(c_lons[i]) for i in tour]
        ordered_g    = [g_idx[i] for i in tour]

        # open route polyline (no return to depot)
        osrm = _osrm_route(ordered_lats, ordered_lons)
        if osrm:
            polyline, leg_dist, leg_time = osrm
            src = "osrm"
        else:
            n = len(tour)
            polyline = [[ordered_lats[i], ordered_lons[i]] for i in range(n)]
            leg_dist, leg_time = [], []
            for i in range(n - 1):
                d = float(dist_mat[tour[i], tour[i + 1]]) * ROAD_FACTOR
                leg_dist.append(round(d, 2))
                leg_time.append(round(d / req.avg_speed_kmh * 60, 1))
            # last leg has no "next" stop → 0
            leg_dist.append(0.0)
            leg_time.append(0.0)
            src = "haversine_fallback"

        stops = []
        for stop_idx, df_pos in enumerate(ordered_g):
            r = s.hs.iloc[df_pos]
            stops.append(dict(
                order=stop_idx + 1,
                lat=float(r.centroid_lat),
                lon=float(r.centroid_lon),
                station=str(r.dominant_police_station),
                dominant_violation=str(r.dominant_violation_type),
                hotspots_in_radius=int(len(nbrs[df_pos])),
                dist_to_next_km=leg_dist[stop_idx] if stop_idx < len(leg_dist) else 0.0,
                time_to_next_min=leg_time[stop_idx] if stop_idx < len(leg_time) else 0.0,
            ))

        total_dist = round(sum(leg_dist[:-1]), 2)   # exclude trailing 0
        total_time = round(sum(leg_time[:-1]), 1)

        cars_out.append(dict(
            car_id=car["car_id"],
            color=car["color"],
            stops=stops,
            polyline=polyline,
            total_distance_km=total_dist,
            total_time_min=total_time,
            route_source=src,
        ))

    return dict(
        num_cars=len(cars_out),
        stops_per_car=req.stops_per_car,
        total_hotspots=len(cars_out) * req.stops_per_car,
        shift_window=core.shift_window(cur_h),
        shift_hours=req.shift_hours,
        cars=cars_out,
    )
