"""
Data layer: load the (precomputed) enriched hotspots + the clustered violations, build the
coverage index once, and expose cached stats / temporal / breakdown computations.

All heavy lifting (OSM road-grounding) is done offline by precompute.py; here we only read CSVs.
"""

import ast
import os
from functools import lru_cache

import numpy as np
import pandas as pd

from core import CoverageIndex, shift_window

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
OUT = os.path.join(PROJ, "output")
APP_DATA = os.path.join(HERE, "data")

_ENRICHED = os.path.join(APP_DATA, "hotspots_enriched.csv")
_FALLBACK = os.path.join(OUT, "hotspot_summary.csv")
_CLUSTERED = os.path.join(OUT, "clustered_violations.csv")


def _parse_types(x):
    try:
        return ast.literal_eval(x) if isinstance(x, str) and x.startswith("[") else []
    except Exception:
        return []


class Store:
    """Loaded once at startup; holds hotspots, the coverage index, and lazy aggregates."""

    def __init__(self):
        path = _ENRICHED if os.path.exists(_ENRICHED) else _FALLBACK
        self.grounded = os.path.exists(_ENRICHED)
        hs = pd.read_csv(path)
        if "impact" not in hs.columns:
            hs["impact"] = hs["congestion_impact_index"]
        if "road_class" not in hs.columns:
            hs["road_class"], hs["lanes"] = "n/a", 0
        hs = hs.reset_index(drop=True)
        hs["id"] = hs.index
        self.hs = hs
        self.index = CoverageIndex(hs["centroid_lat"].values, hs["centroid_lon"].values)
        self.total_impact = float(hs["impact"].sum())
        self._clustered = None  # lazy

    # ---- hotspots ----
    def hotspot_records(self, limit=None, min_cii=0.0, violation=None, station=None):
        df = self.hs
        if min_cii:
            df = df[df.congestion_impact_index >= min_cii]
        if violation:
            df = df[df.dominant_violation_type.str.contains(violation, case=False, na=False)]
        if station:
            df = df[df.dominant_police_station.str.contains(station, case=False, na=False)]
        if limit:
            df = df.head(int(limit))
        return [self._to_hotspot(r) for _, r in df.iterrows()]

    def hotspot(self, hid):
        r = self.hs[self.hs.id == hid]
        return self._to_hotspot(r.iloc[0]) if len(r) else None

    def _to_hotspot(self, r):
        return dict(
            id=int(r.id), rank=int(r["rank"]),
            lat=float(r.centroid_lat), lon=float(r.centroid_lon),
            cii=round(float(r.congestion_impact_index), 1),
            cii_normalized=round(float(r.get("cii_normalized", 0)), 2),
            impact=round(float(r.impact), 2),
            violations=int(r.violation_count),
            junction_pct=round(float(r.junction_pct) * 100, 1),
            peak_hour=int(r.peak_hour), shift=shift_window(int(r.peak_hour)),
            radius_m=round(float(r.get("approx_radius_m", 0)), 1),
            station=str(r.dominant_police_station),
            dominant_junction=str(r.dominant_junction),
            dominant_violation=str(r.dominant_violation_type),
            dominant_vehicle=str(r.dominant_vehicle_type),
            road_class=str(r.get("road_class", "n/a")),
            lanes=int(r.get("lanes", 0) or 0),
        )

    # ---- clustered violations (lazy) ----
    @property
    def clustered(self):
        if self._clustered is None:
            self._clustered = pd.read_csv(_CLUSTERED, low_memory=False)
        return self._clustered

    @lru_cache(maxsize=1)
    def stats(self):
        c = self.clustered
        n_noise = int((c.cluster == -1).sum())
        total = len(c)
        hours = c.hour.value_counts(normalize=True)
        evening = float(c.hour.between(17, 21).mean() * 100)
        top = (self.hs.groupby("dominant_police_station").congestion_impact_index.sum()
               .sort_values(ascending=False).head(5).index.tolist())
        peak_hr = int(hours.idxmax())
        return dict(
            total_hotspots=int(self.hs.shape[0]),
            total_violations=total,
            clustered_pct=round((total - n_noise) / total * 100, 1),
            noise_pct=round(n_noise / total * 100, 1),
            date_range="Nov 2023 - Apr 2024",
            peak_window_ist=shift_window(peak_hr),
            evening_share_pct=round(evening, 1),
            top_stations=top,
        )

    @lru_cache(maxsize=1)
    def temporal(self):
        c = self.clustered
        days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        mat = (c.groupby(["day_of_week", "hour"]).size()
               .unstack(fill_value=0).reindex(index=range(7), columns=range(24), fill_value=0))
        peak_hours = c.hour.value_counts().head(4).index.tolist()
        return dict(days=days, hours=list(range(24)),
                    matrix=mat.values.tolist(),
                    peak_hours=[int(h) for h in peak_hours],
                    evening_share_pct=round(float(c.hour.between(17, 21).mean() * 100), 1))

    @lru_cache(maxsize=1)
    def breakdown(self):
        c = self.clustered
        vt = c["violation_type"].apply(_parse_types).explode().value_counts().head(8)
        veh = c["vehicle_type"].value_counts().head(8)
        return dict(
            violation_types=[{"name": k, "count": int(v)} for k, v in vt.items()],
            vehicle_types=[{"name": str(k), "count": int(v)} for k, v in veh.items()],
        )


_store = None


def get_store():
    global _store
    if _store is None:
        _store = Store()
    return _store
