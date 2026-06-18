"""
ParkSight API — backend for the parking-congestion Enforcement Command Center.

Serves hotspot data, temporal/breakdown analytics, and the live patrol-deployment optimizer.
Frontend (designed separately) consumes these JSON endpoints. Interactive docs at /docs.

Run:  uvicorn main:app --reload --port 8000     (from the app/ folder)
"""

import os
import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

import core
from data import get_store
from schemas import (Stats, Hotspot, OptimizeRequest, OptimizeResponse, CoverageCurve)

HERE = os.path.dirname(os.path.abspath(__file__))
FRONTEND = os.path.join(HERE, "frontend", "index.html")

app = FastAPI(
    title="ParkSight API",
    version="1.0",
    description="AI-driven parking-congestion intelligence + enforcement deployment optimizer.",
)
# Frontend is hosted separately (design tool / static build) -> allow cross-origin during dev.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/", include_in_schema=False)
def home():
    """Serve the dashboard UI."""
    return FileResponse(FRONTEND)


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


@app.get("/api/temporal")
def temporal():
    """Day×hour violation heatmap (IST) + peak hours + evening coverage-gap share."""
    return get_store().temporal()


@app.get("/api/breakdown")
def breakdown():
    """Violation-type and vehicle-type distributions for bar charts."""
    return get_store().breakdown()
