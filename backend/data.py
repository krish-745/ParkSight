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
        self._flow = None       # lazy graph-diffusion forecaster

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

    @property
    def flow(self):
        """Lazy: learned graph-diffusion congestion forecaster (built once)."""
        if self._flow is None:
            from flow_model import FlowModel
            self._flow = FlowModel(self)
        return self._flow

    def raw_violations(self, limit: int = 2000):
        """A representative sample of individual (clustered) violation points for the
        'raw violations' map layer. Deterministic sample so the layer is stable."""
        c = self.clustered
        c = c[c.cluster != -1]  # only the clustered points (drop DBSCAN noise)
        if len(c) > limit:
            c = c.sample(n=limit, random_state=42)
        out = []
        for r in c.itertuples(index=False):
            out.append({
                "lat": float(r.latitude),
                "lon": float(r.longitude),
                "violation_type": str(r.violation_type),
                "hour": int(r.hour),
            })
        return out

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

    @lru_cache(maxsize=1)
    def blindspots(self, top_n: int = 30):
        """Identify zones with high congestion impact but low enforcement activity.

        Enforcement proxy: violations-per-zone within the same police station.
        A zone is a blind spot if its impact rank is much higher than its enforcement rank.
        blind_spot_score = normalised(impact_rank_desc) - normalised(enforcement_rank_desc)
        We only return zones where the score is positive (impact >> enforcement).
        """
        hs = self.hs.copy()
        n = len(hs)

        # ── Impact rank (1 = highest CII) ──
        # Sort descending by cii_normalized; rank 1 = most impactful
        hs["_impact_rank"] = hs["cii_normalized"].rank(ascending=False, method="min").astype(int)

        # ── Enforcement proxy ──
        # For each police station, compute avg violations per zone.
        # A zone that sits in a high-activity station AND has high violation count itself
        # is considered "well-enforced". We use:
        #   enforcement_score = violation_count / (station_mean_violations)
        # normalised to 0-100. Higher = more patrolled relative to peers.
        station_mean = hs.groupby("dominant_police_station")["violation_count"].transform("mean")
        hs["_enforcement_score"] = (hs["violation_count"] / station_mean.clip(lower=1)) * 50.0
        # Also factor in cii_density (violations per area): denser = harder to miss
        if "cii_density" in hs.columns:
            density_norm = hs["cii_density"] / hs["cii_density"].max() * 50.0
            hs["_enforcement_score"] = hs["_enforcement_score"] + density_norm
        hs["_enforcement_score"] = hs["_enforcement_score"].clip(upper=100.0)

        # enforcement rank: 1 = most enforced
        hs["_enforcement_rank"] = hs["_enforcement_score"].rank(ascending=False, method="min").astype(int)

        # ── Blind-spot score ──
        # Normalise ranks to [0,1] (lower rank number = better, so invert)
        impact_pct = 1.0 - (hs["_impact_rank"] - 1) / max(n - 1, 1)   # 1 = most impactful
        enf_pct    = 1.0 - (hs["_enforcement_rank"] - 1) / max(n - 1, 1)  # 1 = most enforced
        hs["_bss"] = (impact_pct - enf_pct).clip(lower=0.0)

        # Keep only zones that are genuinely under-covered (bss > 0)
        df = hs[hs["_bss"] > 0].sort_values("_bss", ascending=False).head(top_n)

        def _severity(score):
            if score >= 0.4: return "Critical"
            if score >= 0.2: return "High"
            return "Moderate"

        zones = []
        for _, r in df.iterrows():
            zones.append(dict(
                id=int(r.id),
                rank=int(r["rank"]),
                lat=float(r.centroid_lat),
                lon=float(r.centroid_lon),
                station=str(r.dominant_police_station),
                dominant_violation=str(r.dominant_violation_type),
                dominant_junction=str(r.dominant_junction),
                violations=int(r.violation_count),
                impact=round(float(r.impact), 2),
                cii_normalized=round(float(r.cii_normalized), 1),
                impact_rank=int(r["_impact_rank"]),
                enforcement_rank=int(r["_enforcement_rank"]),
                blind_spot_score=round(float(r["_bss"]), 3),
                severity=_severity(float(r["_bss"])),
                shift=shift_window(int(r.peak_hour)),
            ))

        critical = sum(1 for z in zones if z["severity"] == "Critical")
        high     = sum(1 for z in zones if z["severity"] == "High")
        mod      = sum(1 for z in zones if z["severity"] == "Moderate")
        return dict(
            total_blind_spots=len(zones),
            critical_count=critical,
            high_count=high,
            moderate_count=mod,
            zones=zones,
        )


_store = None


def get_store():
    global _store
    if _store is None:
        _store = Store()
    return _store
